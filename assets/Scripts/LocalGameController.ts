import { _decorator, Component, Node, Label, Button, Vec2, Prefab, instantiate, Color, Camera, director, Layout, UIOpacity } from 'cc';
import { MapManager } from './managers/MapManager';
import { PlayerManager } from './managers/PlayerManager';
import { TimeManager } from './managers/TimeManager';
import { TroopManager } from './managers/TroopManager';
import { AIManager } from './managers/AIManager';
import { TileComponent } from './components/TileComponent';
import { LevelData } from './models/MapData';
import { TerrainType } from './models/MapData';
import { tween } from 'cc';
import { Tween } from 'cc';
import { GameOverPanel } from './ui/GameOverPanel';

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
    
    @property(Node)
    playerStatsPanel: Node = null!;  // 玩家状态面板
    
    @property(Prefab)
    playerStatItemPrefab: Prefab = null!;  // 玩家状态项预制体
    
    @property(Node)
    gameOverPanel: Node = null!;  // 游戏结束面板
    
    // 各个管理器引用
    private _mapManager: MapManager | null = null;
    private _playerManager: PlayerManager | null = null;
    private _timeManager: TimeManager | null = null;
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
        
        // 初始化玩家状态面板
        this._initPlayerStatsPanel();
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
        this._timeManager?.setGameRules(this._levelData.gameRules);
        
        // 设置大本营位置
        if (this._levelData.mapData.headquarters) {
            console.log("【大本营】开始设置玩家大本营位置...");
            this._levelData.mapData.headquarters.forEach(hq => {
                const playerId = hq[0];
                const x = hq[1];
                const y = hq[2];
                console.log(`【大本营】玩家${playerId}的大本营位置设为[${x},${y}]`);
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
        
        // 更新玩家拥有的地块列表
        this._updatePlayerOwnedTiles();
        
        // 开始游戏回合
        this._timeManager?.startGame();
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
        // 创建地图管理器
        this._mapManager = this.getComponent(MapManager) || this.addComponent(MapManager);
        
        // 创建玩家管理器
        this._playerManager = this.getComponent(PlayerManager) || this.addComponent(PlayerManager);
        
        // 创建时间管理器
        this._timeManager = this.getComponent(TimeManager) || this.addComponent(TimeManager);
        
        // 创建部队管理器
        this._troopManager = this.getComponent(TroopManager) || this.addComponent(TroopManager);
        
        // 创建AI管理器
        this._aiManager = this.getComponent(AIManager) || this.addComponent(AIManager);
        
        // 设置管理器之间的引用关系
        if (this._mapManager && this._playerManager && this._timeManager && this._troopManager && this._aiManager) {
            // 将管理器与地图容器关联
            this._mapManager.mapContainer = this.mapContainer;
            this._mapManager.tilePrefab = this.tilePrefab;
            
            // 设置管理器引用
            this._timeManager.setManagers(this._playerManager, this._troopManager, this._aiManager);
            this._troopManager.setManagers(this._mapManager, this._playerManager);
            this._aiManager.setManagers(this._mapManager, this._playerManager, this._troopManager);
            
            // 设置游戏规则
            if (this._levelData) {
                this._timeManager.setGameRules(this._levelData.gameRules);
            }
        }
    }
    
    /**
     * 设置事件监听
     */
    private _setupEventListeners() {
        // 设置结束回合按钮点击事件
        if (this.endTurnButton) {
            this.endTurnButton.node.on(Button.EventType.CLICK, this._onEndTurnButtonClicked, this);
        }
        
        // 设置派遣按钮点击事件
        if (this.dispatchButton) {
            this.dispatchButton.node.on(Button.EventType.CLICK, this._onDispatchButtonClicked, this);
        }
        
        // 监听tile选择事件
        this.node.on('tile-selected', this._onTileSelected, this);
        
        // 在场景级别监听tile选择事件，确保在任何地方都能捕获
        const scene = director.getScene();
        if (scene) {
            scene.on('tile-selected', this._onTileSelected, this);
        }
        
        // 监听时间更新事件
        this.node.on('time-updated', this._onTimeUpdated, this);
        
        // 监听玩家击败和游戏结束事件
        this.node.on('player-defeated', this._onPlayerDefeated, this);
        this.node.on('game-over', this._onGameOver, this);
        
        // 监听地块所有权变更事件，检查是否影响大本营
        this.node.on('tile-ownership-changed', (data) => {
            console.log(`【大本营】接收到地块所有权变更事件: 坐标[${data.x},${data.y}], 从玩家${data.oldOwnerId}变为玩家${data.newOwnerId}`);
            
            // 当任何地块所有权变更时，主动检查一次游戏结束条件
            this._checkGameEndCondition();
            
            // 更新玩家拥有地块和状态
            this._updatePlayerOwnedTiles();
            this._updatePlayerStats();
        });
        
        // 监听行军状态变化事件，及时更新玩家状态
        this.node.on('marching-status-updated', () => {
            // 行军状态变化可能导致玩家地块和兵力变化，需要更新状态
            this._updatePlayerOwnedTiles();
            this._updatePlayerStats();
            
            // 行军状态变化也可能导致大本营变更，检查游戏结束条件
            this._checkGameEndCondition();
        }, this);
        
        // 监听战斗结果事件，及时更新玩家状态
        this.node.on('combat-resolved', () => {
            // 战斗结束后需要更新玩家地块和兵力
            this._updatePlayerOwnedTiles();
            this._updatePlayerStats();
            
            // 战斗可能导致大本营被占领，检查游戏结束条件
            this._checkGameEndCondition();
        }, this);
        
        // 也在场景级别监听这些事件
        if (scene) {
            scene.on('tile-ownership-changed', (data) => {
                // 场景级别也执行相同的逻辑
                console.log(`【大本营】场景级接收到地块所有权变更: [${data.x},${data.y}]`);
                this._updatePlayerOwnedTiles();
                this._updatePlayerStats();
                this._checkGameEndCondition();
            }, this);
            
            scene.on('marching-status-updated', () => {
                this._updatePlayerOwnedTiles();
                this._updatePlayerStats();
                this._checkGameEndCondition();
            }, this);
            
            scene.on('combat-resolved', () => {
                this._updatePlayerOwnedTiles();
                this._updatePlayerStats();
                this._checkGameEndCondition();
            }, this);
            
            scene.on('player-defeated', this._onPlayerDefeated, this);
            scene.on('game-over', this._onGameOver, this);
        }
    }
    
    /**
     * 更新UI显示
     */
    private _updateUI() {
        if (!this._playerManager) return;
        
        // 更新回合数显示
        const gameTime = this._timeManager?.getGameTime() || 0;
        this.turnLabel.string = `时间: ${Math.floor(gameTime)}秒`;
        
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
        
        // 更新AI路径限制UI（如果存在）
        this._updateAIPathLimitUI();
    }
    
    /**
     * 更新AI路径限制UI
     */
    private _updateAIPathLimitUI() {
        if (!this._aiManager) return;
        
        // 如果有AI路径限制显示标签，更新其内容
        const aiPathLimitLabel = this.gameUI?.getChildByName('AIPathLimitLabel')?.getComponent(Label);
        if (aiPathLimitLabel) {
            aiPathLimitLabel.string = `AI路径限制: ${this._aiManager.maxAIPathLimit}`;
        }
    }
    
    /**
     * 增加AI路径限制
     */
    private _increaseAIPathLimit() {
        if (!this._aiManager) return;
        
        this._aiManager.maxAIPathLimit++;
        console.log(`AI路径限制增加到 ${this._aiManager.maxAIPathLimit}`);
        this._updateAIPathLimitUI();
    }
    
    /**
     * 减少AI路径限制
     */
    private _decreaseAIPathLimit() {
        if (!this._aiManager) return;
        
        // 确保不小于1
        if (this._aiManager.maxAIPathLimit > 1) {
            this._aiManager.maxAIPathLimit--;
            console.log(`AI路径限制减少到 ${this._aiManager.maxAIPathLimit}`);
        }
        this._updateAIPathLimitUI();
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
        
        // 如果有玩家管理器，显示各玩家的行军路线数量
        if (this._playerManager) {
            const players = this._playerManager.getPlayers();
            
            // 获取人类玩家和AI玩家
            const humanPlayers = players.filter(player => !player.isAI && !player.defeated);
            const aiPlayers = players.filter(player => player.isAI && !player.defeated);
            
            // 显示人类玩家的行军路线数量
            humanPlayers.forEach(player => {
                // 获取最新的行军路线数量（当前队列中的）
                const count = this._troopManager!.getPlayerActivePathCount(player.id);
                const statusText = `玩家${player.name}: ${count}条行军路线`;
                const statusColor = new Color(50, 150, 255, 255); // 蓝色
                
                const item = this._createMarchingStatusItem(statusText, statusColor);
                this.marchingStatusPanel.addChild(item);
            });
            
            // 显示AI玩家的行军路线数量
            aiPlayers.forEach(player => {
                // 获取最新的行军路线数量（当前队列中的）
                const count = this._troopManager!.getPlayerActivePathCount(player.id);
                const statusText = `AI(${player.name}): ${count}条行军路线`;
                const statusColor = new Color(255, 100, 100, 255); // 红色
                
                const item = this._createMarchingStatusItem(statusText, statusColor);
                this.marchingStatusPanel.addChild(item);
            });
            
            // 添加分隔行
            if ((humanPlayers.length > 0 || aiPlayers.length > 0) && marchingPaths.length > 0) {
                const item = this._createMarchingStatusItem("───────────", new Color(150, 150, 150, 255));
                this.marchingStatusPanel.addChild(item);
            }
        }
        
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
            
            // 获取路径所属玩家名称
            let playerName = `玩家${path.playerId}`;
            if (this._playerManager) {
                const player = this._playerManager.getPlayerById(path.playerId);
                if (player) {
                    playerName = player.name;
                }
            }
            
            // 第一条显示为"执行中"，其余显示为"排队中"
            if (index === 0) {
                const currentStep = path.currentStep + 1; // +1是为了显示为从1开始而不是0
                const totalSteps = path.pathTiles.length; // 完整路径的总步数
                statusText = `${playerName} 执行中: (${currentStep}/${totalSteps})`;
                statusColor = new Color(50, 200, 50, 255); // 绿色
            } else {
                const totalSteps = path.pathTiles.length;
                statusText = `${playerName} 排队中: (${index}/${marchingPaths.length})`;
                statusColor = new Color(200, 150, 50, 255); // 橙色
            }
            
            const item = this._createMarchingStatusItem(statusText, statusColor);
            this.marchingStatusPanel.addChild(item);
        });
    }
    
    /**
     * Tile被选中的事件处理
     */
    private _onTileSelected(event: any): void {
        console.log("======= 触发tile-selected事件 =======");
        console.log("事件数据:", event);
        console.log("当前游戏状态: 派遣模式=", this._isInDispatchMode);
        console.log("当前选中tile:", this._selectedTile);
        
        if (!this._gameStarted || this._gameOver || !this._mapManager || !this._playerManager) {
            console.log("LocalGameController: 游戏未开始，已结束，或缺少必要管理器引用，忽略点击");
            return;
        }
        
        // 无论是否在派遣模式，都让当前点击的tile短暂高亮
        const tile = event as TileComponent;
        tile.setHighlight(true);
        const highlightNode = tile.highlightNode;
        if (highlightNode) {
            // 获取或添加UIOpacity组件
            let uiOpacity = highlightNode.getComponent(UIOpacity);
            if (!uiOpacity) {
                uiOpacity = highlightNode.addComponent(UIOpacity);
            }
            
            // 设置短暂高亮效果
            uiOpacity.opacity = 0;
            highlightNode.active = true;
            
            tween(uiOpacity)
                .to(0.1, { opacity: 255 }) // 快速淡入
                .delay(0.3) // 短暂高亮
                .to(0.2, { opacity: 0 }) // 缓慢淡出
                .call(() => {
                    // 如果不是选中的格子或目标格子，完全关闭高亮
                    if (!this._isInDispatchMode && 
                        (this._selectedTile !== tile) && 
                        !this._targetTiles.some(pos => pos.x === tile.gridPosition.x && pos.y === tile.gridPosition.y)) {
                        highlightNode.active = false;
                    }
                })
                .start();
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
                // 更新派遣按钮状态
                this._updateDispatchButton();
            } else {
                console.log(`格子兵力不足，无法派遣`);
                this._troopsToSend = 0;
                this._updateDispatchButton();
            }
        } 
        // 选中目标格子 - 恢复这部分关键逻辑
        else if (this._selectedTile && this._targetTiles.some(pos => 
            pos.x === tile.gridPosition.x && pos.y === tile.gridPosition.y)) {
            
            // 计算派遣兵力 - 尽可能多地派遣，只在原地留1个
            const availableTroops = this._selectedTile.troops - 1;
            this._troopsToSend = availableTroops > 0 ? availableTroops : 0;
            
            // 派遣兵力到目标格子
            if (this._troopsToSend > 0 && this._troopManager) {
                console.log(`派遣 ${this._troopsToSend} 兵力从 [${this._selectedTile.gridPosition.x},${this._selectedTile.gridPosition.y}] 到 [${tile.gridPosition.x},${tile.gridPosition.y}]`);
                
                this._troopManager.sendTroops(
                    this._selectedTile.gridPosition.x, 
                    this._selectedTile.gridPosition.y,
                    tile.gridPosition.x,
                    tile.gridPosition.y,
                    this._troopsToSend
                );
            }
            
            // 短暂高亮目标格子
            tile.setHighlight(true);
            
            // 清除选择状态
            this._selectedTile = null;
            this._targetTiles = [];
            this._troopsToSend = 0;
            this._updateDispatchButton();
            
            // 清除高亮显示
            this._clearHighlights();
        }
        else {
            // 点击其他格子，清除选择
            this._selectedTile = null;
            this._targetTiles = [];
            this._troopsToSend = 0;
            this._updateDispatchButton();
            
            // 清除高亮
            this._clearHighlights();
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
     * 公开此方法以供AIManager等其他组件使用
     */
    calculatePathBetweenPoints(start: Vec2, end: Vec2): Vec2[] {
        console.log(`计算从 [${start.x},${start.y}] 到 [${end.x},${end.y}] 的最短路径`);
        
        if (!this._mapManager) return [start, end];
        
        // 如果两点相邻，直接返回
        if (Math.abs(start.x - end.x) + Math.abs(start.y - end.y) === 1) {
            // 检查终点是否为不可到达的地形
            const endTile = this._mapManager.getTile(end.x, end.y);
            if (endTile && (endTile.terrainType === TerrainType.MOUNTAIN || 
                            endTile.terrainType === TerrainType.LAKE)) {
                console.log(`终点 [${end.x},${end.y}] 是不可到达的地形，无法生成路径`);
                return [start]; // 只返回起点
            }
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
                    // 检查是否是不可到达的地形
                    const tile = this._mapManager.getTile(newX, newY);
                    if (tile && (tile.terrainType === TerrainType.MOUNTAIN || 
                                 tile.terrainType === TerrainType.LAKE)) {
                        // 跳过不可到达的地形
                        console.log(`跳过不可到达的地形 [${newX},${newY}]`);
                        continue;
                    }
                    
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
            
            // 检查终点是否为不可到达的地形
            const endTile = this._mapManager.getTile(end.x, end.y);
            if (endTile && (endTile.terrainType === TerrainType.MOUNTAIN || 
                            endTile.terrainType === TerrainType.LAKE)) {
                console.log(`终点 [${end.x},${end.y}] 是不可到达的地形，返回只有起点的路径`);
                return [start]; // 只返回起点
            }
            
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
    
    // 保留原来的方法但将其重定向到公共方法，确保向后兼容性
    private _calculatePathBetweenPoints(start: Vec2, end: Vec2): Vec2[] {
        return this.calculatePathBetweenPoints(start, end);
    }
    
    /**
     * 完成派遣模式
     */
    private _finishDispatchMode() {
        console.log("========= 开始执行派遣模式完成操作 =========");
        
        if (!this._mapManager) {
            console.error("地图管理器未初始化，取消派遣");
            this._cancelDispatchMode();
            return;
        }
        
        if (!this._selectedTile) {
            console.error("没有选择起始格子，取消派遣");
            this._cancelDispatchMode();
            return;
        }
        
        if (this._dispatchPath.length === 0) {
            console.error("派遣路径为空，取消派遣");
            this._cancelDispatchMode();
            return;
        }
        
        console.log(`派遣路径包含 ${this._dispatchPath.length} 个点:`);
        this._dispatchPath.forEach((pos, index) => {
            console.log(`路径点 ${index}: [${pos.x},${pos.y}]`);
        });
        
        // 计算完整的行军路径，将选择的关键点连接起来
        const completePathWithDuplicates: Vec2[] = [];
        
        // 添加起始点
        completePathWithDuplicates.push(this._dispatchPath[0]);
        
        // 计算相邻点之间的最短路径
        console.log("计算中间路径连接点...");
        for (let i = 0; i < this._dispatchPath.length - 1; i++) {
            const startPoint = this._dispatchPath[i];
            const endPoint = this._dispatchPath[i + 1];
            
            console.log(`计算从 [${startPoint.x},${startPoint.y}] 到 [${endPoint.x},${endPoint.y}] 的路径`);
            
            // 使用Dijkstra算法计算两点间的最短路径
            const segmentPath = this._calculatePathBetweenPoints(startPoint, endPoint);
            
            console.log(`计算的路径段包含 ${segmentPath.length} 个点`);
            
            // 添加中间路径点（跳过第一个点，避免重复）
            for (let j = 1; j < segmentPath.length; j++) {
                completePathWithDuplicates.push(segmentPath[j]);
            }
        }
        
        // 去重，移除连续重复的点
        const completePath: Vec2[] = [];
        for (let i = 0; i < completePathWithDuplicates.length; i++) {
            const currentPoint = completePathWithDuplicates[i];
            
            // 添加第一个点或与前一个点不同的点
            if (i === 0 || 
                currentPoint.x !== completePathWithDuplicates[i-1].x || 
                currentPoint.y !== completePathWithDuplicates[i-1].y) {
                completePath.push(new Vec2(currentPoint.x, currentPoint.y));
            }
        }
        
        console.log(`完整行军路径计算完成，包含 ${completePath.length} 个点:`);
        completePath.forEach((pos, index) => {
            console.log(`完整路径点 ${index}: [${pos.x},${pos.y}]`);
        });
        
        // 创建行军路径
        if (this._troopManager && this._playerManager) {
            // 获取选中格子的当前兵力
            const currentTroops = this._selectedTile.troops;
            console.log(`起始格子当前兵力: ${currentTroops}`);
            
            // 检查兵力是否够派遣（至少需要2个兵力才能派遣）
            if (currentTroops <= 1) {
                console.error("格子兵力不足，无法派遣，需要至少2个兵力");
                this._cancelDispatchMode();
                return;
            }
            
            // 如果_troopsToSend未设置，设为最大可能值(当前兵力-1)
            if (this._troopsToSend <= 0) {
                this._troopsToSend = currentTroops - 1;
                console.log(`自动设置派遣兵力为最大值: ${this._troopsToSend}（当前兵力-1）`);
            }
            
            // 确保不超过当前兵力减1（始终在原地保留1个兵力）
            const troopsToSend = Math.min(this._troopsToSend, currentTroops - 1);
            console.log(`最终派遣兵力: ${troopsToSend}，原地将保留1个兵力`);
            
            // 去掉起始点，只保留目标路径
            const targetPath = completePath.slice(1);
            console.log(`最终目标路径包含 ${targetPath.length} 个点`);
            
            // 确保创建前所有参数正确
            const playerId = this._playerManager.getCurrentPlayer()?.id;
            if (playerId === undefined) {
                console.error("无法获取当前玩家ID，取消派遣");
                this._cancelDispatchMode();
                return;
            }
            
            console.log(`创建行军路径：玩家ID=${playerId}, 起点=[${this._selectedTile.gridPosition.x},${this._selectedTile.gridPosition.y}], 目标点数=${targetPath.length}, 派遣兵力=${troopsToSend}`);
            
            // 创建行军路径
            this._troopManager.createMarchingPath(
                playerId,
                this._selectedTile.gridPosition,
                targetPath,
                troopsToSend
            );
            
            console.log(`行军路径创建成功！从 [${this._selectedTile.gridPosition.x},${this._selectedTile.gridPosition.y}] 派遣 ${troopsToSend} 兵力`);
            
            // 减少剩余派遣次数
            this._dispatchCount--;
            
            // 更新UI显示
            this._updateUI();
            
            // 更新行军状态面板
            this._updateMarchingStatus();
        } else {
            console.error("部队管理器或玩家管理器未初始化，取消派遣");
            this._cancelDispatchMode();
            return;
        }
        
        // 短暂高亮显示最终目标格子
        if (this._dispatchPath.length > 1) {
            const finalPos = this._dispatchPath[this._dispatchPath.length - 1];
            const finalTile = this._mapManager.getTile(finalPos.x, finalPos.y);
            if (finalTile) {
                finalTile.setHighlight(true);
                const highlightNode = finalTile.highlightNode;
                if (highlightNode) {
                    // 获取或添加UIOpacity组件
                    let uiOpacity = highlightNode.getComponent(UIOpacity);
                    if (!uiOpacity) {
                        uiOpacity = highlightNode.addComponent(UIOpacity);
                    }
                    
                    // 设置短暂高亮效果
                    uiOpacity.opacity = 0;
                    highlightNode.active = true;
                    
                    tween(uiOpacity)
                        .to(0.1, { opacity: 255 }) // 快速淡入
                        .delay(0.5) // 保持高亮0.5秒
                        .to(0.2, { opacity: 0 }) // 缓慢淡出
                        .call(() => {
                            highlightNode.active = false;
                        })
                        .start();
                }
            }
        }
        
        // 重置派遣模式状态
        this._isInDispatchMode = false;
        this._selectedTile = null;
        this._targetTiles = [];
        this._troopsToSend = 0;
        this._dispatchPath = [];
        
        // 清除所有高亮
        this._clearHighlights();
        
        // 更新派遣按钮状态
        this._updateDispatchButton();
        
        console.log("========= 派遣模式完成操作结束 =========");
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
    private _highlightTargetTiles(): void {
        console.log("======= 高亮目标tiles =======");
        console.log("当前选中tile:", this._selectedTile);
        console.log("目标tiles数量:", this._targetTiles?.length || 0);
        
        if (!this._mapManager) return;
        
        // 渐变高亮选中的格子
        if (this._selectedTile) {
            // 设置高亮，但不立即激活highlightNode
            this._selectedTile.setHighlight(true);
            
            // 查找高亮节点，TileComponent中的setHighlight方法会设置highlightNode.active = true
            const highlightNode = this._selectedTile.highlightNode;
            if (highlightNode) {
                // 获取或添加UIOpacity组件
                let uiOpacity = highlightNode.getComponent(UIOpacity);
                if (!uiOpacity) {
                    uiOpacity = highlightNode.addComponent(UIOpacity);
                }
                
                // 停止任何可能正在进行的动画
                Tween.stopAllByTarget(uiOpacity);
                
                // 设置初始透明度为0
                uiOpacity.opacity = 0;
                highlightNode.active = true;
                
                // 添加淡入淡出效果
                tween(uiOpacity)
                    .to(0.1, { opacity: 255 }) // 0.1秒内渐变至完全不透明
                    .delay(0.5) // 保持高亮0.5秒
                    .to(0.2, { opacity: 0 }) // 0.2秒内淡出
                    .call(() => {
                        // 如果不在派遣模式且不是当前选中的格子，则关闭高亮
                        if (!this._isInDispatchMode && !this._selectedTile) {
                            highlightNode.active = false;
                        }
                    })
                    .start();
            }
        }
        
        // 在派遣模式下或有选中格子时，高亮显示目标格子
        if (this._targetTiles.length > 0) {
            for (const pos of this._targetTiles) {
                const tile = this._mapManager.getTile(pos.x, pos.y);
                if (tile) {
                    tile.setHighlight(true);
                    
                    const highlightNode = tile.highlightNode;
                    if (highlightNode) {
                        // 获取或添加UIOpacity组件
                        let uiOpacity = highlightNode.getComponent(UIOpacity);
                        if (!uiOpacity) {
                            uiOpacity = highlightNode.addComponent(UIOpacity);
                        }
                        
                        // 停止任何可能正在进行的动画
                        Tween.stopAllByTarget(uiOpacity);
                        
                        // 设置初始透明度为0
                        uiOpacity.opacity = 0;
                        highlightNode.active = true;
                        
                        // 渐变效果
                        tween(uiOpacity)
                            .to(0.1, { opacity: 255 }) // 快速淡入
                            .delay(0.5) // 保持高亮0.5秒
                            .to(0.2, { opacity: 0 }) // 缓慢淡出
                            .call(() => {
                                // 如果不在派遣模式且不是目标格子，则关闭高亮
                                if (!this._isInDispatchMode && 
                                    !this._targetTiles.some(p => p.x === pos.x && p.y === pos.y)) {
                                    highlightNode.active = false;
                                }
                            })
                            .start();
                    }
                }
            }
        }
    }
    
    /**
     * 清除所有格子的高亮显示
     */
    private _clearHighlights() {
        if (!this._mapManager) return;
        
        const mapSize = this._mapManager.getMapSize();
        
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this._mapManager.getTile(x, y);
                if (tile) {
                    const highlightNode = tile.highlightNode;
                    
                    if (highlightNode && highlightNode.active) {
                        // 获取或添加UIOpacity组件
                        let uiOpacity = highlightNode.getComponent(UIOpacity);
                        if (!uiOpacity) {
                            uiOpacity = highlightNode.addComponent(UIOpacity);
                        }
                        
                        // 停止任何可能正在进行的动画
                        Tween.stopAllByTarget(uiOpacity);
                        
                        // 渐变消失效果
                        tween(uiOpacity)
                            .to(0.1, { opacity: 0 }) // 0.1秒内渐变至完全透明
                            .call(() => {
                                highlightNode.active = false; // 动画完成后隐藏节点
                            })
                            .start();
                    }
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
            console.log(`【大本营】玩家${player.name}(ID=${playerId})被击败，大本营已被占领`);
            
            // 判断是否为人类玩家（通过isAI属性判断，不假设固定ID）
            if (!player.isAI) {
                // 人类玩家被击败，游戏结束
                this._gameOver = true;
                this._timeManager?.pauseGame();
                
                console.log(`【大本营】用户大本营被攻陷，游戏失败`);
                
                // 获取游戏结束面板组件
                const gameOverPanelComponent = this.gameOverPanel.getComponent(GameOverPanel);
                if (!gameOverPanelComponent) return;
                
                // 显示失败画面
                gameOverPanelComponent.showGameOver(false);
            } else {
                // 检查是否所有AI玩家都被击败了
                const remainingAIPlayers = this._playerManager.getPlayers().filter(p => 
                    p.isAI && !p.defeated
                );
                
                console.log(`【大本营】检查游戏胜利条件: 剩余未击败AI敌人=${remainingAIPlayers.length}`);
                
                if (remainingAIPlayers.length === 0) {
                    // 所有AI敌人都被击败，玩家获胜
                    this._gameOver = true;
                    this._timeManager?.pauseGame();
                    
                    // 计算AI玩家总数
                    const allAIPlayers = this._playerManager.getPlayers().filter(p => p.isAI);
                    
                    console.log(`【大本营】所有敌方大本营已占领，游戏胜利，共消灭${allAIPlayers.length}个敌人`);
                    
                    // 获取游戏结束面板组件
                    const gameOverPanelComponent = this.gameOverPanel.getComponent(GameOverPanel);
                    if (!gameOverPanelComponent) return;
                    
                    // 显示胜利画面
                    gameOverPanelComponent.showGameOver(true, allAIPlayers.length);
                }
            }
        }
    }
    
    /**
     * 游戏结束事件处理
     */
    private _onGameOver(winnerId: number) {
        if (!this._playerManager) return;
        
        this._gameOver = true;
        this._timeManager?.pauseGame();
        
        const winner = this._playerManager.getPlayerById(winnerId);
        if (winner) {
            // 判断胜利条件
            const isVictory = !winner.isAI;
            
            if (isVictory) {
                console.log(`【大本营】游戏结束! 玩家${winner.name}(ID=${winner.id})胜利，所有敌方大本营已被占领`);
            } else {
                console.log(`【大本营】游戏结束! AI玩家${winner.name}(ID=${winner.id})胜利，用户大本营已被占领`);
            }
            
            // 获取游戏结束面板组件
            const gameOverPanelComponent = this.gameOverPanel.getComponent(GameOverPanel);
            if (!gameOverPanelComponent) return;
            
            // 计算AI玩家数量
            const allPlayers = this._playerManager.getPlayers();
            const aiPlayers = allPlayers.filter(p => p.isAI);
            
            // 计算消灭的敌人数量（只有在玩家胜利时才需要）
            let defeatedEnemies = 0;
            if (isVictory) {
                // 计算被击败的AI玩家数量
                defeatedEnemies = aiPlayers.length;
            }
            
            // 显示游戏结束面板
            gameOverPanelComponent.showGameOver(isVictory, defeatedEnemies);
        }
    }
    
    /**
     * 结束回合按钮点击处理
     */
    private _onEndTurnButtonClicked() {
        if (!this._gameStarted || this._gameOver || !this._timeManager) return;
        
        // 在实时模式下，此按钮可用于切换游戏速度
        const currentSpeed = this._timeManager.getGameSpeed();
        const newSpeed = currentSpeed >= 4 ? 1 : currentSpeed * 2;
        this._timeManager.setGameSpeed(newSpeed);
        
        // 更新按钮显示
        this.endTurnButton.getComponentInChildren(Label)!.string = `速度 x${newSpeed}`;
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
                
                // 计算派遣的兵力数量（最大可能：当前兵力-1）
                if (this._dispatchPath.length > 0 && this._mapManager) {
                    const startPos = this._dispatchPath[0];
                    const startTile = this._mapManager.getTile(startPos.x, startPos.y);
                    if (startTile && startTile.troops > 1) {
                        // 修改: 派遣兵力为(当前兵力-1)，而不是一半
                        this._troopsToSend = startTile.troops - 1;
                        console.log(`设置派遣兵力为: ${this._troopsToSend}，起始点兵力: ${startTile.troops}，起始点将保留1个兵力`);
                        this._selectedTile = startTile; // 确保设置了选中的格子
                    }
                }
                
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
     * 时间更新事件处理
     */
    private _onTimeUpdated(gameTime: number) {
        // 更新UI显示
        this._updateUI();
        
        // 每隔30秒保存游戏状态
        if (Math.floor(gameTime) % 30 === 0) {
            // 这里可以实现游戏存档功能
        }

    }
    
    /**
     * 游戏主循环更新
     */
    update(dt: number) {
        if (!this._gameStarted || this._gameOver) {
            return;
        }
        
        // 检查初始化状态
        if (!this._mapManager || !this._playerManager || !this._timeManager || !this._troopManager || !this._aiManager) {
            console.error("LocalGameController: 游戏组件未完全初始化，无法更新");
            return;
        }
        
        // 定期检查游戏结束条件（每秒一次）
        const gameTime = Math.floor(this._timeManager.getGameTime());
        if (gameTime % 3 === 0) {
            this._checkGameEndCondition();
        }
        
        // 调试信息
        if (gameTime % 10 === 0) {
            //console.log(`=== 游戏状态信息 ===`);
            //console.log(`游戏时间: ${this._timeManager.getGameTime().toFixed(1)}秒`);
            //console.log(`游戏速度: x${this._timeManager.getGameSpeed()}`);
            
            // 玩家状态
            const players = this._playerManager.getPlayers();
            //console.log(`玩家数量: ${players.length}`);
            //players.forEach(player => {
            //    const status = player.defeated ? "已击败" : "活跃中";
            //    const aiInfo = player.isAI ? `(AI 难度:${player.aiLevel})` : "(人类)";
            //    console.log(`- 玩家${player.id} ${player.name} ${aiInfo}: ${status}, 地块数:${player.ownedTiles.length}`);
            //});
        }
        
        // 调用时间管理器更新 - 这会触发AI逻辑和部队移动
        this._timeManager.update(dt);
        
        // 更新行军状态面板
        this._updateMarchingStatus();
        
        // 更新玩家状态面板（每秒更新一次）
        if (Math.floor(this._timeManager.getGameTime()) % 1 === 0) {
            this._updatePlayerStats();
        }
    }
    
    /**
     * 检查游戏结束条件
     */
    private _checkGameEndCondition() {
        if (!this._playerManager || !this._mapManager) return;
        
        // 检查每个玩家的大本营
        let allAIDefeated = true;
        let humanDefeated = true;
        
        // 找出人类玩家和AI玩家
        const players = this._playerManager.getPlayers();
        const humanPlayers = players.filter(p => !p.isAI);
        const aiPlayers = players.filter(p => p.isAI);
        
        // 检查人类玩家状态
        for (const player of humanPlayers) {
            if (!player.headquarters) continue;
            
            const hqTile = this._mapManager.getTile(player.headquarters.x, player.headquarters.y);
            if (hqTile && hqTile.ownerId === player.id) {
                humanDefeated = false; // 至少有一个人类玩家大本营未被占领
            }
        }
        
        // 检查AI玩家状态
        for (const player of aiPlayers) {
            if (!player.headquarters) continue;
            
            const hqTile = this._mapManager.getTile(player.headquarters.x, player.headquarters.y);
            if (hqTile && hqTile.ownerId === player.id) {
                allAIDefeated = false; // 至少有一个AI玩家大本营未被占领
            }
        }
        
        // 输出调试信息（每3秒一次）
        console.log(`【大本营】周期性检查: 所有AI被击败=${allAIDefeated}, 人类被击败=${humanDefeated}`);
        
        // 检查胜利条件
        if (allAIDefeated && !humanDefeated) {
            // 人类玩家胜利
            console.log(`【大本营】检测到胜利条件：所有AI大本营被占领，人类玩家胜利`);
            this._gameOver = true;
            this._timeManager?.pauseGame();
            
            // 显示胜利画面
            const gameOverPanelComponent = this.gameOverPanel.getComponent(GameOverPanel);
            if (!gameOverPanelComponent) return;
            
            gameOverPanelComponent.showGameOver(true, aiPlayers.length);
        } 
        else if (humanDefeated) {
            // 人类玩家失败
            console.log(`【大本营】检测到失败条件：人类玩家大本营被占领，游戏失败`);
            this._gameOver = true;
            this._timeManager?.pauseGame();
            
            // 显示失败画面
            const gameOverPanelComponent = this.gameOverPanel.getComponent(GameOverPanel);
            if (!gameOverPanelComponent) return;
            
            gameOverPanelComponent.showGameOver(false);
        }
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
        
        //console.log("LocalGameController: 行军状态面板初始化完成");
    }

    /**
     * 更新所有玩家的拥有地块列表
     */
    private _updatePlayerOwnedTiles(): void {
        //console.log("========== 开始更新玩家拥有地块列表 ==========");
        
        if (!this._mapManager || !this._playerManager) {
            console.error("无法更新玩家拥有地块：管理器未初始化");
            return;
        }
        
        // 获取地图尺寸
        const mapSize = this._mapManager.getMapSize();
        
        // 清空所有玩家的地块列表
        const players = this._playerManager.getPlayers();
        players.forEach(player => {
            player.ownedTiles = [];
            
            // 重置行军路线计数
            player.activePathCount = 0;
        });
        
        // 遍历所有地块，将地块添加到对应玩家的列表中
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this._mapManager.getTile(x, y);
                if (tile && tile.ownerId !== -1) {
                    const player = this._playerManager.getPlayerById(tile.ownerId);
                    if (player) {
                        player.addOwnedTile(new Vec2(x, y));
                        //console.log(`将地块 [${x},${y}] 添加到玩家${player.id}的拥有列表，兵力=${tile.troops}`);
                    }
                }
            }
        }
        
        // 如果有部队管理器，重新计算每个玩家当前队列中的行军路线数量
        if (this._troopManager) {
            // 获取当前行军路径队列
            const marchingPaths = this._troopManager.getMarchingPaths();
            
            // 根据当前队列重新计算每个玩家的行军路线数量
            const pathCountByPlayer: {[playerId: number]: number} = {};
            
            // 对队列中的每条路径进行统计
            marchingPaths.forEach(path => {
                if (!pathCountByPlayer[path.playerId]) {
                    pathCountByPlayer[path.playerId] = 0;
                }
                pathCountByPlayer[path.playerId]++;
            });
            
            // 更新每个玩家的行军路线计数
            players.forEach(player => {
                player.activePathCount = pathCountByPlayer[player.id] || 0;
                //console.log(`玩家${player.id}的当前队列中行军路线数量: ${player.activePathCount}`);
            });
        }
        
        // 打印更新后的统计信息
        //players.forEach(player => {
        //    console.log(`玩家${player.id} (${player.name}) 现在拥有 ${player.ownedTiles.length} 块地, ${player.activePathCount} 条行军路线`);
        //});
        
        //console.log("========== 玩家拥有地块列表更新完成 ==========");
    }

    /**
     * 创建玩家状态项
     * @param player 玩家对象
     * @returns 创建的状态项节点
     */
    private _createPlayerStatItem(player: any): Node {
        // 实例化预制体
        const item = instantiate(this.playerStatItemPrefab);
        
        // 获取Label组件
        const itemLabel = item.getComponent(Label) || item.getComponentInChildren(Label);
        if (itemLabel) {
            // 计算玩家拥有的总兵力 - 直接查询地图上属于玩家的所有格子
            let totalTroops = 0;
            let tileCount = 0;
            
            if (this._mapManager) {
                // 获取地图尺寸
                const mapSize = this._mapManager.getMapSize();
                
                // 遍历所有地块
                for (let y = 0; y < mapSize.height; y++) {
                    for (let x = 0; x < mapSize.width; x++) {
                        const tile = this._mapManager.getTile(x, y);
                        // 检查地块是否存在且属于当前玩家
                        if (tile && tile.ownerId === player.id) {
                            tileCount++;
                            totalTroops += tile.troops;
                        }
                    }
                }
            }
            
            // 设置文本内容
            const playerType = player.isAI ? "AI" : "玩家";
            itemLabel.string = `${player.name} (${playerType}): ${tileCount}地块, ${totalTroops}兵力`;
            
            // 设置文本颜色为玩家颜色
            itemLabel.color = player.color;
        }
        
        return item;
    }
    
    /**
     * 初始化玩家状态面板
     */
    private _initPlayerStatsPanel() {
        if (!this.playerStatsPanel || !this.playerStatItemPrefab) {
            console.error("LocalGameController: 玩家状态面板或预制体未设置，请在Inspector中指定playerStatsPanel和playerStatItemPrefab");
            return;
        }
        
        // 确保面板是空的
        this.playerStatsPanel.removeAllChildren();
        
        // 设置面板样式
        const layout = this.playerStatsPanel.getComponent(Layout) || this.playerStatsPanel.addComponent(Layout);
        layout.type = Layout.Type.VERTICAL;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;
        layout.paddingTop = 10;
        layout.paddingBottom = 10;
        layout.paddingLeft = 10;
        layout.paddingRight = 10;
        layout.spacingY = 5;
        
        // 添加标题
        const titleItem = instantiate(this.playerStatItemPrefab);
        const titleLabel = titleItem.getComponent(Label) || titleItem.getComponentInChildren(Label);
        if (titleLabel) {
            titleLabel.string = "玩家状态";
            titleLabel.color = new Color(255, 255, 255, 255);
            titleLabel.fontSize += 2; // 标题稍大一些
            this.playerStatsPanel.addChild(titleItem);
        }
        
        // 初始状态更新
        this._updatePlayerStats();
        
        console.log("LocalGameController: 玩家状态面板初始化完成");
    }
    
    /**
     * 更新玩家状态面板
     */
    private _updatePlayerStats() {
        if (!this.playerStatsPanel || !this.playerStatItemPrefab || !this._playerManager || !this._mapManager) {
            return;
        }
        
        // 先更新玩家拥有地块列表，确保数据准确
        this._updatePlayerOwnedTiles();
        
        // 保留标题，移除其他子节点
        const children = this.playerStatsPanel.children.slice();
        for (let i = 1; i < children.length; i++) { // 从索引1开始，保留标题
            children[i].removeFromParent();
        }
        
        // 获取所有玩家
        const players = this._playerManager.getPlayers();
        
        // 为每个玩家创建状态项
        players.forEach(player => {
            if (!player.defeated) { // 只显示未被击败的玩家
                const item = this._createPlayerStatItem(player);
                this.playerStatsPanel.addChild(item);
            }
        });
    }
} 