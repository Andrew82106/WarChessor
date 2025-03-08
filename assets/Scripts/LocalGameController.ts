import { _decorator, Component, Node, Label, Button, Vec2, Prefab, instantiate, Color, Camera, director, Layout } from 'cc';
import { MapManager } from './managers/MapManager';
import { PlayerManager } from './managers/PlayerManager';
import { TurnManager } from './managers/TurnManager';
import { TroopManager } from './managers/TroopManager';
import { AIManager } from './managers/AIManager';
import { TileComponent } from './components/TileComponent';
import { LevelData } from './models/MapData';
import { TerrainType } from './models/MapData';

const { ccclass, property } = _decorator;

/**
 * 本地游戏控制器
 * 整合所有系统并控制游戏流程
 */
@ccclass('LocalGameController')
export class LocalGameController extends Component {
    @property(Node)
    gameUI: Node = null!;
    
    @property(Label)
    turnLabel: Label = null!;
    
    @property(Label)
    playerLabel: Label = null!;
    
    @property(Button)
    endTurnButton: Button = null!;
    
    @property(Button)
    dispatchButton: Button = null!;  // 派遣按钮
    
    @property(Label)
    dispatchCountLabel: Label = null!;  // 派遣次数显示标签
    
    @property(Node)
    mapContainer: Node = null!;
    
    @property(Prefab)
    tilePrefab: Prefab = null!;
    
    @property
    currentLevelId: string = "level1";
    
    @property(Node)
    marchingStatusPanel: Node = null!;  // 行军状态面板
    
    @property(Prefab)
    marchingStatusItemPrefab: Prefab = null!;  // 行军状态项预制体
    
    // 各个管理器引用
    private _mapManager: MapManager | null = null;
    private _playerManager: PlayerManager | null = null;
    private _turnManager: TurnManager | null = null;
    private _troopManager: TroopManager | null = null;
    private _aiManager: AIManager | null = null;
    
    // 游戏状态
    private _gameStarted: boolean = false;
    private _gameOver: boolean = false;
    private _levelData: LevelData | null = null;
    
    // 选择状态
    private _selectedTile: TileComponent | null = null;
    private _targetTiles: Vec2[] = [];
    private _troopsToSend: number = 0;
    
    // 派遣模式
    private _isInDispatchMode: boolean = false;
    private _dispatchCount: number = 10;
    private _maxDispatchCount: number = 10; // 最大派遣次数
    private _dispatchPath: Vec2[] = [];
    
    /**
     * 组件加载时调用
     */
    onLoad() {
        // 初始化管理器
        this._initManagers();
        
        // 设置事件监听
        this._setupEventListeners();
        
        // 初始化行军状态面板
        this._initMarchingStatusPanel();
    }
    
    /**
     * 启动游戏
     */
    async start() {
        // 先加载关卡数据
        this._levelData = await this._mapManager?.loadLevelData(this.currentLevelId) || null;
        if (!this._levelData) {
            console.error("in LocalGameController start function, 加载关卡数据失败");
            return;
        }
        
        // 初始化玩家
        this._playerManager?.initPlayers(this._levelData.players);
        // 获取关卡数据
        console.log("======== 开始初始化玩家 ========");
        console.log(`关卡 ${this._levelData.name} 包含 ${this._levelData.players.length} 个玩家:`);
        this._levelData.players.forEach((player, index) => {
            console.log(`玩家 ${index+1}: ID=${player.id}, 名称=${player.name}, 是否AI=${player.isAI}`);
        });
        
        // 初始化地图
        const mapInitialized = await this._mapManager?.initMap();
        if (!mapInitialized) {
            console.error("in LocalGameController start function, 地图初始化失败");
            return;
        }
        //console.log("in LocalGameController start function, map initialized");
        
        
        
        // 设置游戏规则
        this._troopManager?.setGameRules(this._levelData.gameRules);
        this._turnManager?.setGameRules(this._levelData.gameRules);
        
        // 设置大本营位置
        if (this._levelData.mapData.headquarters) {
            //console.log("in LocalGameController start function, 设置玩家大本营位置...");
            this._levelData.mapData.headquarters.forEach(hq => {
                const playerId = hq[0];
                const x = hq[1];
                const y = hq[2];
                //console.log(`玩家 ${playerId} 的大本营位置设为 (${x}, ${y})`);
                this._playerManager?.setPlayerHeadquarters(playerId, new Vec2(x, y));
            });
        }
        
        // 确保地图数据应用到每个格子
        //console.log("in LocalGameController start function, 应用地图所有权数据到格子...");
        if (this._mapManager && this._levelData.mapData.ownership) {
            for (let y = 0; y < this._mapManager.getMapSize().height; y++) {
                for (let x = 0; x < this._mapManager.getMapSize().width; x++) {
                    const tile = this._mapManager.getTile(x, y);
                    const ownerId = this._levelData.mapData.ownership[y][x];
                    if (tile && ownerId !== undefined && ownerId !== -1) {
                        //console.log(`设置格子 [${x}, ${y}] 的所有者为玩家 ${ownerId}`);
                        tile.ownerId = ownerId;
                    }
                }
            }
        }
        
        // 初始化派遣按钮文本
        this._updateDispatchButton();
        
        // 更新UI显示
        this._updateUI();
        
        // 开始游戏回合
        this._turnManager?.startTurnLoop();
        this._gameStarted = true;
        
        // 启动兵力增长计时器 - 每5秒增加一次兵力
        this.schedule(this._increaseTroops, 5);
        
        // 检查所有Tile的显示状态
        this.scheduleOnce(() => {
            //console.log("in LocalGameController start function, 强制检查所有Tile的显示状态...");
            if (this._mapManager) {
                // 获取摄像机信息
                const camera = director.getScene()?.getComponentInChildren(Camera);
                //console.log(`摄像机信息: 位置=${camera?.node.position}, 正交高度=${camera?.orthoHeight}`);
                
                // 遍历所有格子
                for (let y = 0; y < this._mapManager.getMapSize().height; y++) {
                    for (let x = 0; x < this._mapManager.getMapSize().width; x++) {
                        const tile = this._mapManager.getTile(x, y);
                        if (tile) {
                            // 强制设置可见
                            //tile.isVisible = true;
                            //if (tile.fogNode) tile.fogNode.active = false;
                            //tile.node.active = true;
                            
                            // 设置橙色背景
                            //if (tile.background) {
                            //    tile.background.color = new Color(255, 165, 0, 255);
                            //}
                            
                            // 设置兵力显示
                            //tile.troops = (x + y) % 5 + 1;
                            
                            //console.log(`检查Tile [${x},${y}]: 激活=${tile.node.active}, 位置=${tile.node.position}`);
                        }
                    }
                }
            }
        }, 1.0);
    }
    
    /**
     * 初始化各个管理器
     */
    private _initManagers() {
        // 正确获取地图容器节点上的MapManager
        const mapContainerNode = this.mapContainer;
        this._mapManager = mapContainerNode.getComponent(MapManager) || mapContainerNode.addComponent(MapManager);
        
        // 确保预制体和容器正确关联
        this._mapManager.tilePrefab = this.tilePrefab;
        this._mapManager.mapContainer = mapContainerNode;
        
        // 创建玩家管理器
        this._playerManager = this.getComponent(PlayerManager) || this.addComponent(PlayerManager);
        
        // 创建兵力管理器
        this._troopManager = this.getComponent(TroopManager) || this.addComponent(TroopManager);
        
        // 创建回合管理器
        this._turnManager = this.getComponent(TurnManager) || this.addComponent(TurnManager);
        
        // 创建AI管理器
        this._aiManager = this.getComponent(AIManager) || this.addComponent(AIManager);
        
        // 设置管理器之间的引用
        this._mapManager.setPlayerManager(this._playerManager);
        this._troopManager.setManagers(this._mapManager, this._playerManager);
        this._turnManager.setManagers(this._playerManager, this._troopManager);
        this._aiManager.setManagers(this._mapManager, this._playerManager, this._troopManager);
    }
    
    /**
     * 设置事件监听
     */
    private _setupEventListeners() {
        //console.log("LocalGameController: 设置事件监听");
        
        // 注册Tile选中事件
        this.node.on('tile-selected', this._onTileSelected, this);
        
        // 注册回合更新事件
        this.node.on('turn-updated', this._onTurnUpdated, this);
        
        // 注册玩家切换事件
        this.node.on('player-switched', this._onPlayerSwitched, this);
        
        // 注册玩家被击败事件
        this.node.on('player-defeated', this._onPlayerDefeated, this);
        
        // 注册游戏结束事件
        this.node.on('game-over', this._onGameOver, this);
        
        // 注册结束回合按钮点击
        if (this.endTurnButton) {
            this.endTurnButton.node.on(Button.EventType.CLICK, this._onEndTurnButtonClicked, this);
        }
        
        // 注册派遣按钮点击事件
        if (this.dispatchButton) {
            console.log("LocalGameController: 派遣按钮已找到，正在注册点击事件");
            this.dispatchButton.node.on('click', this._onDispatchButtonClicked, this);
        } else {
            console.error("LocalGameController: 派遣按钮未找到！请检查Inspector中的引用设置");
        }
        
        // 在场景级别监听tile-selected事件
        console.log("LocalGameController: 在Scene级别注册tile-selected事件");
        director.getScene()?.on('tile-selected', (tile) => {
            console.log(`LocalGameController: Scene级别收到tile-selected事件，tile位置：[${tile.gridPosition.x},${tile.gridPosition.y}]`);
            this._onTileSelected(tile);
        }, this);
    }
    
    /**
     * 更新UI显示
     */
    private _updateUI() {
        if (!this._playerManager) return;
        
        // 更新回合显示
        if (this.turnLabel) {
            const currentTurn = this._turnManager?.getCurrentTurn() || 0;
            this.turnLabel.string = `回合: ${currentTurn}`;
        }
        
        // 更新当前玩家显示
        if (this.playerLabel) {
            const currentPlayer = this._playerManager.getCurrentPlayer();
            if (currentPlayer) {
                this.playerLabel.string = `当前玩家: ${currentPlayer.name}`;
                // 设置玩家标签颜色与玩家颜色一致
                this.playerLabel.color = currentPlayer.color;
            }
        }
        
        // 更新派遣按钮状态
        this._updateDispatchButton();
        
        // 更新行军状态信息
        this._updateMarchingStatus();
    }
    
    /**
     * 创建行军状态项并设置文本
     * @param text 显示文本
     * @param color 文本颜色
     * @returns 创建的状态项节点
     */
    private _createMarchingStatusItem(text: string, color: Color): Node {
        // 实例化预制体
        const item = instantiate(this.marchingStatusItemPrefab);
        
        // 获取Label组件并设置文本和颜色
        const itemLabel = item.getComponent(Label) || item.getComponentInChildren(Label);
        if (itemLabel) {
            // 设置文本内容
            itemLabel.string = text;
            // 设置文本颜色
            itemLabel.color = color;
            //console.log(`创建行军状态项：${text}`);
        } else {
            // 如果没有找到Label组件，创建一个新的
            console.warn("预制体中未找到Label组件，创建新的Label组件");
            const newLabel = item.addComponent(Label);
            newLabel.string = text;
            newLabel.color = color;
            newLabel.fontSize = 20;
            newLabel.lineHeight = 24;
        }
        
        return item;
    }

    /**
     * 更新行军状态面板
     */
    private _updateMarchingStatus() {
        if (!this.marchingStatusPanel || !this.marchingStatusItemPrefab || !this._troopManager) {
            console.error("LocalGameController: 行军状态面板或预制体未设置，无法更新行军状态");
            return;
        }
        
        // 清除现有状态项
        this.marchingStatusPanel.removeAllChildren();
        //console.log("LocalGameController: 更新行军状态面板");
        
        // 获取所有行军路径
        const marchingPaths = this._troopManager.getMarchingPaths();
        //console.log(`当前行军路径数量: ${marchingPaths.length}`);
        
        // 如果没有行军路径，显示"无行军路线"
        if (marchingPaths.length === 0) {
            const item = this._createMarchingStatusItem("无行军路线", new Color(200, 200, 200, 255));
            this.marchingStatusPanel.addChild(item);
            return;
        }
        
        // 显示所有行军路径状态
        marchingPaths.forEach((path, index) => {
            let statusText: string;
            let statusColor: Color;
            
            // 第一条显示为"执行中"，其余显示为"排队中"
            if (index === 0) {
                const currentStep = path.currentStep + 1; // +1是为了显示为从1开始而不是0
                const totalSteps = path.targetTiles.length + 1; // +1是为了包括起始点
                statusText = `执行中: 行军路线 (${currentStep}/${totalSteps})`;
                statusColor = new Color(50, 200, 50, 255); // 绿色
            } else {
                const totalSteps = path.targetTiles.length + 1;
                statusText = `排队中: 行军路线 (${totalSteps})`;
                statusColor = new Color(200, 150, 50, 255); // 橙色
            }
            
            const item = this._createMarchingStatusItem(statusText, statusColor);
            this.marchingStatusPanel.addChild(item);
        });
        
        // 确保布局更新
        const layout = this.marchingStatusPanel.getComponent(Layout);
        if (layout) {
            // 手动触发布局更新
            layout.enabled = false;
            layout.enabled = true;
        }
    }
    
    /**
     * Tile被选中的事件处理
     */
    private _onTileSelected(tile: TileComponent) {
        console.log(`LocalGameController: _onTileSelected被调用，tile位置：[${tile.gridPosition.x},${tile.gridPosition.y}]`);
        console.log(`当前派遣模式状态: ${this._isInDispatchMode}`);
        
        if (!this._gameStarted || this._gameOver || !this._mapManager || !this._playerManager) {
            console.log("LocalGameController: 游戏未开始，已结束，或缺少必要管理器引用，忽略点击");
            return;
        }
        
        // 如果处于派遣模式，处理派遣逻辑
        if (this._isInDispatchMode) {
            console.log(`LocalGameController: 处于派遣模式，调用_handleDispatchModeSelection，剩余次数：${this._dispatchCount}`);
            this._handleDispatchModeSelection(tile);
            return;
        }
        
        // 普通选择逻辑
        const currentPlayerId = this._playerManager.getCurrentPlayer()?.id ?? -1;
        //console.log(`LocalGameController: 当前玩家ID：${currentPlayerId}，选中的tile所有者ID：${tile.ownerId}`);
        
        // 选中自己的格子
        if (tile.ownerId === currentPlayerId) {
            this._selectedTile = tile;
            this._targetTiles = this._mapManager.getAdjacentTiles(tile.gridPosition.x, tile.gridPosition.y);
            
            // 高亮显示可移动目标
            this._highlightTargetTiles();
            
            console.log(`选中己方格子 [${tile.gridPosition.x},${tile.gridPosition.y}], 兵力: ${tile.troops}`);
            
            // 选择派遣兵力数量
            if (tile.troops > 1) {
                // 默认派遣一半兵力
                this._troopsToSend = Math.floor(tile.troops / 2);
                console.log(`默认派遣兵力: ${this._troopsToSend}`);
            } else {
                this._troopsToSend = 0;
                this._selectedTile = null;
                this._targetTiles = [];
                console.log("该格子兵力不足，无法派遣");
            }
        }
        // 选中目标格子
        else if (this._selectedTile && this._targetTiles.some(pos => 
            pos.x === tile.gridPosition.x && pos.y === tile.gridPosition.y)) {
            
            // 派遣兵力到目标格子
            if (this._troopsToSend > 0) {
                this._troopManager?.sendTroops(
                    this._selectedTile.gridPosition.x, 
                    this._selectedTile.gridPosition.y,
                    tile.gridPosition.x,
                    tile.gridPosition.y,
                    this._troopsToSend
                );
                
                console.log(`派遣 ${this._troopsToSend} 兵力从 [${this._selectedTile.gridPosition.x},${this._selectedTile.gridPosition.y}] 到 [${tile.gridPosition.x},${tile.gridPosition.y}]`);
            }
            
            // 清除选择状态
            this._selectedTile = null;
            this._targetTiles = [];
            this._troopsToSend = 0;
            
            // 清除高亮显示
            this._clearHighlights();
        }
        // 取消选择
        else {
            this._selectedTile = null;
            this._targetTiles = [];
            this._troopsToSend = 0;
            
            // 清除高亮显示
            this._clearHighlights();
            
            console.log("取消选择");
        }
    }
    
    /**
     * 处理派遣模式下的选择
     */
    private _handleDispatchModeSelection(tile: TileComponent) {
        console.log(`LocalGameController: _handleDispatchModeSelection被调用，tile位置：[${tile.gridPosition.x},${tile.gridPosition.y}]`);
        
        if (!this._mapManager || !this._playerManager || this._dispatchCount <= 0) {
            console.log("LocalGameController: 缺少必要管理器引用或派遣次数用完，忽略处理");
            return;
        }
        
        const currentPlayerId = this._playerManager.getCurrentPlayer()?.id ?? -1;
        console.log(`LocalGameController: 当前玩家ID：${currentPlayerId}，选中的tile所有者ID：${tile.ownerId}，剩余派遣次数：${this._dispatchCount}`);
        
        // 第一次选择必须是自己的格子
        if (this._dispatchPath.length === 0) {
            if (tile.ownerId === currentPlayerId && tile.troops > 1) {
                console.log(`派遣模式：选择起始点 [${tile.gridPosition.x},${tile.gridPosition.y}], 兵力: ${tile.troops}`);
                this._dispatchPath.push(tile.gridPosition.clone());
                
                // 高亮显示起始点
                tile.setHighlight(true);
                
                // 减少派遣次数
                this._dispatchCount--;
                this._updateDispatchButton();
            } else {
                console.log(`派遣模式：起始点必须是己方且兵力大于1的格子`);
            }
            return;
        }
        
        // 允许选择任意点作为路径点（不再要求必须相邻）
        console.log(`派遣模式：添加路径点 [${tile.gridPosition.x},${tile.gridPosition.y}]`);
        this._dispatchPath.push(tile.gridPosition.clone());
        
        // 高亮显示路径点
        tile.setHighlight(true);
        
        // 减少派遣次数
        this._dispatchCount--;
        this._updateDispatchButton();
        
        // 如果派遣次数用完，自动结束派遣模式
        if (this._dispatchCount <= 0) {
            this._finishDispatchMode();
        }
    }
    
    /**
     * 计算两点之间的最短路径（使用Dijkstra算法）
     */
    private _calculatePathBetweenPoints(start: Vec2, end: Vec2): Vec2[] {
        console.log(`计算从 [${start.x},${start.y}] 到 [${end.x},${end.y}] 的最短路径`);
        
        if (!this._mapManager) return [start, end];
        
        // 如果两点相邻，直接返回
        if (Math.abs(start.x - end.x) + Math.abs(start.y - end.y) === 1) {
            return [start, end];
        }
        
        // 方向数组：上、右、下、左
        const directions = [
            { dx: 0, dy: -1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }
        ];
        
        const mapSize = this._mapManager.getMapSize();
        const width = mapSize.width;
        const height = mapSize.height;
        
        // 创建已访问矩阵和前驱节点矩阵
        const visited: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
        const previous: { x: number, y: number }[][] = Array(height).fill(null).map(() => 
            Array(width).fill(null).map(() => ({ x: -1, y: -1 })));
        
        // 使用队列进行BFS
        const queue: Vec2[] = [start];
        visited[start.y][start.x] = true;
        
        while (queue.length > 0) {
            const current = queue.shift()!;
            
            // 如果到达终点，结束搜索
            if (current.x === end.x && current.y === end.y) {
                break;
            }
            
            // 检查四个方向
            for (const dir of directions) {
                const newX = current.x + dir.dx;
                const newY = current.y + dir.dy;
                
                // 检查是否在地图范围内且未访问过
                if (newX >= 0 && newX < width && newY >= 0 && newY < height && !visited[newY][newX]) {
                    // 标记为已访问
                    visited[newY][newX] = true;
                    
                    // 记录前驱节点
                    previous[newY][newX] = { x: current.x, y: current.y };
                    
                    // 加入队列
                    queue.push(new Vec2(newX, newY));
                }
            }
        }
        
        // 如果没有找到路径，直接返回起点和终点
        if (!visited[end.y][end.x]) {
            console.log(`未找到从 [${start.x},${start.y}] 到 [${end.x},${end.y}] 的路径，使用直线连接`);
            return [start, end];
        }
        
        // 从终点回溯到起点，构建路径
        const path: Vec2[] = [end];
        let current = { x: end.x, y: end.y };
        
        while (current.x !== start.x || current.y !== start.y) {
            current = previous[current.y][current.x];
            path.unshift(new Vec2(current.x, current.y));
        }
        
        console.log(`找到路径，长度: ${path.length}`);
        return path;
    }
    
    /**
     * 完成派遣模式
     */
    private _finishDispatchMode() {
        console.log("in LocalGameController: 完成派遣模式");
        
        if (!this._mapManager || !this._troopManager || !this._playerManager) {
            console.error("in LocalGameController: 缺少必要管理器引用，无法完成派遣");
            this._cancelDispatchMode();
            return;
        }
        
        // 至少需要2个点（起点和终点）
        if (this._dispatchPath.length < 2) {
            console.log("派遣模式：路径点不足，无法完成派遣");
            this._cancelDispatchMode();
            return;
        }
        
        console.log(`派遣模式：完成路径设置，共${this._dispatchPath.length}个点`);
        
        // 生成完整的行军路径
        const finalPath: Vec2[] = [];
        
        // 计算相邻点之间的最短路径并连接
        for (let i = 0; i < this._dispatchPath.length - 1; i++) {
            const start = this._dispatchPath[i];
            const end = this._dispatchPath[i + 1];
            
            // 计算这两点之间的最短路径
            const segmentPath = this._calculatePathBetweenPoints(start, end);
            
            // 添加到最终路径，但去掉重复的连接点
            if (i > 0) {
                // 去掉第一个点，因为它已经在前一段的最后
                finalPath.push(...segmentPath.slice(1));
            } else {
                finalPath.push(...segmentPath);
            }
        }
        
        // 截断路径如果超过20个点
        const maxPathLength = 20;
        if (finalPath.length > maxPathLength) {
            console.log(`路径过长(${finalPath.length})，截断为${maxPathLength}个点`);
            finalPath.splice(maxPathLength);
        }
        
        console.log(`in LocalGameController: 最终行军路径包含${finalPath.length}个点`);
        
        // 获取起始点的兵力
        const startPos = finalPath[0];
        const startTile = this._mapManager?.getTile(startPos.x, startPos.y);
        
        if (!startTile) {
            console.error("in LocalGameController: 派遣模式：起始点无效");
            this._cancelDispatchMode();
            return;
        }
        
        // 获取当前玩家ID
        const currentPlayerId = this._playerManager.getCurrentPlayer()?.id ?? -1;
        
        // 计算派遣兵力（默认一半，但不少于1，不超过源格子兵力-1）
        const availableTroops = Math.max(0, startTile.troops - 1); // 保留1个兵力在原地
        const troopsToSend = Math.min(Math.floor(startTile.troops / 2), availableTroops);
        
        if (troopsToSend <= 0) {
            console.error(`in LocalGameController: 派遣模式：起始格子兵力不足，当前兵力${startTile.troops}`);
            this._cancelDispatchMode();
            return;
        }
        
        console.log(`in LocalGameController: 派遣模式：从 [${startPos.x},${startPos.y}] 派遣 ${troopsToSend} 兵力`);
        
        // 创建行军路径
        this._troopManager.createMarchingPath(
            currentPlayerId,
            startPos,
            finalPath.slice(1), // 移除起始点，因为它在createMarchingPath中会被单独处理
            troopsToSend
        );
        
        // 清除派遣模式状态
        this._isInDispatchMode = false;
        this._dispatchPath = [];
        this._dispatchCount = this._maxDispatchCount;
        
        // 恢复按钮状态
        this._updateDispatchButton();
        
        // 清除高亮显示
        this._clearHighlights();
        
        // 更新行军状态面板
        this._updateMarchingStatus();
    }
    
    /**
     * 取消派遣模式
     */
    private _cancelDispatchMode() {
        // 清除高亮显示
        if (this._mapManager) {
            for (const pos of this._dispatchPath) {
                const tile = this._mapManager.getTile(pos.x, pos.y);
                if (tile) {
                    tile.setHighlight(false);
                }
            }
        }
        
        // 重置派遣模式状态
        this._isInDispatchMode = false;
        this._dispatchPath = [];
        this._dispatchCount = this._maxDispatchCount;
        
        // 更新按钮显示
        this._updateDispatchButton();
        
        console.log("in LocalGameController: 派遣模式：已取消");
    }
    
    /**
     * 高亮显示目标格子
     */
    private _highlightTargetTiles() {
        if (!this._mapManager) return;
        
        // 高亮选中的格子
        if (this._selectedTile) {
            this._selectedTile.setHighlight(true);
        }
        
        // 高亮可移动的目标格子
        for (const pos of this._targetTiles) {
            const tile = this._mapManager.getTile(pos.x, pos.y);
            if (tile) {
                tile.setHighlight(true);
            }
        }
    }
    
    /**
     * 清除所有高亮显示
     */
    private _clearHighlights() {
        if (!this._mapManager) return;
        
        const mapSize = this._mapManager.getMapSize();
        
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this._mapManager.getTile(x, y);
                if (tile) {
                    tile.setHighlight(false);
                }
            }
        }
    }
    
    /**
     * 回合更新事件处理
     */
    private _onTurnUpdated(turnNumber: number) {
        // 更新UI
        this._updateUI();
    }
    
    /**
     * 玩家切换事件处理
     */
    private _onPlayerSwitched(player: any) {
        // 更新UI
        this._updateUI();
        
        // 重置选择状态
        if (this._selectedTile) {
            this._selectedTile.isSelected = false;
            this._selectedTile = null;
        }
        this._targetTiles = [];
        
        // 如果当前玩家是AI，则执行AI行动
        if (player.isAI && this._aiManager) {
            console.log(`执行AI玩家 ${player.name} 的行动`);
            this._aiManager.performAITurn(player.id);
        }
    }
    
    /**
     * 玩家被击败事件处理
     */
    private _onPlayerDefeated(playerId: number) {
        if (!this._playerManager) return;
        
        const player = this._playerManager.getPlayerById(playerId);
        if (player) {
            console.log(`玩家${player.name}被击败了!`);
            // 这里可以添加一些视觉效果或提示
        }
    }
    
    /**
     * 游戏结束事件处理
     */
    private _onGameOver(winnerId: number) {
        if (!this._playerManager) return;
        
        this._gameOver = true;
        this._turnManager?.pauseTurnLoop();
        
        const winner = this._playerManager.getPlayerById(winnerId);
        if (winner) {
            console.log(`游戏结束! 胜利者: ${winner.name}`);
            // 这里可以显示游戏结束画面
        }
    }
    
    /**
     * 结束回合按钮点击处理
     */
    private _onEndTurnButtonClicked() {
        if (!this._gameStarted || this._gameOver || !this._turnManager) return;
        
        // 切换到下一个玩家
        this._turnManager.switchToNextPlayer();
    }
    
    /**
     * 派遣按钮点击处理
     */
    private _onDispatchButtonClicked() {
        console.log("in LocalGameController: 派遣按钮被点击");
        console.log(`当前派遣模式状态: ${this._isInDispatchMode}`);
        
        if (!this._gameStarted || this._gameOver) {
            console.log("in LocalGameController: 游戏未开始或已结束，忽略点击");
            return;
        }
        
        // 如果已经在派遣模式，则完成派遣模式(原来是取消)
        if (this._isInDispatchMode) {
            console.log("in LocalGameController: 正在完成当前派遣路径设置");
            
            // 如果至少有起始点和一个目标点，完成路径设置
            if (this._dispatchPath.length >= 2) {
                console.log(`in LocalGameController: 已选择${this._dispatchPath.length}个点，完成路径计算并执行`);
                this._finishDispatchMode(); // 执行路径规划和行军
            } else if (this._dispatchPath.length === 1) {
                // 如果只有起始点但没有目标点，提醒玩家
                console.log("in LocalGameController: 当前只选择了起始点，无法完成路径设置");
                // 可以考虑显示一个提示面板
            } else {
                // 没有任何点选择，取消派遣模式
                console.log("in LocalGameController: 没有选择任何点，取消派遣模式");
                this._cancelDispatchMode();
            }
            return;
        }
        
        // 进入派遣模式
        this._isInDispatchMode = true;
        this._dispatchPath = [];
        this._dispatchCount = this._maxDispatchCount;
        
        // 更新按钮显示
        this._updateDispatchButton();
        
        console.log("in LocalGameController: 进入派遣模式：请选择起始格子和路径点，剩余次数：10");
    }
    
    /**
     * 更新派遣按钮显示
     */
    private _updateDispatchButton() {
        if (!this.dispatchButton || !this.dispatchCountLabel) {
            console.error("LocalGameController: 派遣按钮或计数标签未设置");
            return;
        }
        
        if (this._isInDispatchMode) {
            //console.log(`LocalGameController: 更新派遣按钮为完成模式，剩余次数：${this._dispatchCount}`);
            this.dispatchButton.getComponentInChildren(Label)!.string = "完成";
            this.dispatchCountLabel.string = `(${this._dispatchCount})`;
            this.dispatchCountLabel.node.active = true;
        } else {
            //console.log("LocalGameController: 更新派遣按钮为普通模式");
            this.dispatchButton.getComponentInChildren(Label)!.string = "派遣";
            this.dispatchCountLabel.node.active = false;
        }
    }
    
    /**
     * 增加所有地块的兵力
     */
    private _increaseTroops(): void {
        if (!this._mapManager || !this._gameStarted) return;
        
        const mapSize = this._mapManager.getMapSize();
        let changesCount = 0;
        
        //console.log("开始执行兵力增长...");
        
        // 遍历所有格子
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this._mapManager.getTile(x, y);
                if (tile) {
                    const currentTroops = tile.troops;
                    
                    // 只有被玩家占领且不是政治中心的地块才增加兵力
                    if (tile.ownerId !== -1 && tile.terrainType !== TerrainType.POLITICAL_CENTER) {
                        // 增加1-2个兵力
                        const increase = Math.floor(Math.random() * 2) + 1;
                        tile.troops = currentTroops + increase;
                        changesCount++;
                        
                        // 调试信息
                        //console.log(`格子[${x},${y}] 所有者ID: ${tile.ownerId}, 兵力从 ${currentTroops} 增加到 ${tile.troops}`);
                    }
                }
            }
        }
        
        //console.log(`兵力增长完成，更新了${changesCount}个地块`);
    }
    
    /**
     * 每帧更新
     */
    update(dt: number) {
        // 如果游戏未开始或已结束，则不执行更新
        if (!this._gameStarted || this._gameOver) return;
        
        // 更新行军状态面板
        this._updateMarchingStatus();
    }
    
    /**
     * 初始化行军状态面板
     */
    private _initMarchingStatusPanel() {
        if (!this.marchingStatusPanel) {
            console.error("LocalGameController: 行军状态面板未设置，请在Inspector中指定marchingStatusPanel");
            return;
        }
        
        // 确保面板是空的
        this.marchingStatusPanel.removeAllChildren();
        
        // 初始状态显示"无行军路线"
        const item = this._createMarchingStatusItem("无行军路线", new Color(200, 200, 200, 255));
        this.marchingStatusPanel.addChild(item);
        
        // 设置面板样式
        const layout = this.marchingStatusPanel.getComponent(Layout) || this.marchingStatusPanel.addComponent(Layout);
        layout.type = Layout.Type.VERTICAL;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;
        layout.paddingTop = 10;
        layout.paddingBottom = 10;
        layout.paddingLeft = 10;
        layout.paddingRight = 10;
        layout.spacingY = 5;
        
        console.log("LocalGameController: 行军状态面板初始化完成");
    }
} 