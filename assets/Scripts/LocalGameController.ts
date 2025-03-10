import { _decorator, Component, Node, Label, Button, AudioSource, Vec2, Prefab, instantiate, Color, Camera, director, Layout, UIOpacity } from 'cc';
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
    SpeedButton: Button = null!;
    
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

    @property(AudioSource)
    dispatchButtonClickSound: AudioSource = null!;
    
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
        /*
        在Cocos Creator中，`onLoad`函数和`start`函数的执行顺序是固定的。具体来说，`onLoad`函数会在组件被加载时首先执行，而`start`函数会在组件的所有`onLoad`函数执行完毕后执行。

        ### 执行顺序：
        1. **`onLoad`**：
        - 当节点被添加到场景中时，所有组件的`onLoad`方法会被调用。
        这个方法通常用于初始化组件的状态、设置事件监听器、加载资源等。
        - 在`onLoad`中，组件的属性已经被赋值，但其他组件的`onLoad`方法尚未执行。

        2. **`start`**：
        - 在所有组件的`onLoad`方法执行完毕后，Cocos Creator会调用每个组件的`start`方法。
        这个方法通常用于在游戏开始时执行一些逻辑，比如开始游戏、初始化游戏状态等。
        - 在`start`中，所有其他组件的`onLoad`方法都已经执行完毕，因此可以安全地访问其他组件的状态和数据。

        ### 总结：
        因此，在你的代码中，`onLoad`函数会先执行，然后是`start`函数。
        这种设计确保了在`start`中可以安全地使用在`onLoad`中初始化的状态和数据。

        */

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
        //console.log("======== 开始初始化玩家 ========");
        //console.log(`关卡 ${this._levelData.name} 包含 ${this._levelData.players.length} 个玩家:`);
        //this._levelData.players.forEach((player, index) => {
        //    console.log(`玩家 ${index+1}: ID=${player.id}, 名称=${player.name}, 是否AI=${player.isAI}`);
        //});
        
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
            // console.log("【大本营】开始设置玩家大本营位置...");
            this._levelData.mapData.headquarters.forEach(hq => {
                const playerId = hq[0];
                const x = hq[1];
                const y = hq[2];
                // console.log(`【大本营】玩家${playerId}的大本营位置设为[${x},${y}]`);
                this._playerManager?.setPlayerHeadquarters(playerId, new Vec2(x, y));
            });
        }
        
        // 确保地图数据中的所有权数据应用到每个格子
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
        /*
        逐部分解释：
            this.schedule(...)：
            schedule是Cocos Creator中的一个方法，用于在指定的时间间隔内重复调用某个函数。它会在每个游戏帧更新时检查是否到了调用该函数的时间。
            this._increaseTroops：
            这是一个方法，通常用于处理兵力的增长逻辑。具体的实现可能在LocalGameController类中定义。这个方法会在每次定时器触发时被调用。
            5：
            这是时间间隔，单位是秒。意味着每5秒钟，_increaseTroops方法会被调用一次。
        */
    }
    
    /**
     * 初始化各个管理器
     */
    private _initManagers() {
        // 创建地图管理器
        this._mapManager = this.getComponent(MapManager) || this.addComponent(MapManager);
        /*
        逐部分解释：
            this.getComponent(MapManager)：
            这个方法尝试从当前组件（LocalGameController）中获取名为MapManager的组件实例。
            如果当前组件上已经存在MapManager，则返回该实例；如果不存在，则返回null。

            ||（逻辑或运算符）：
            这是一个逻辑或运算符，用于在左侧表达式为null或undefined时，返回右侧的表达式。
            在这里，如果this.getComponent(MapManager)返回null（即当前组件上没有MapManager），
            则会执行右侧的代码。
            
            this.addComponent(MapManager)：
            如果左侧的getComponent返回null，则调用addComponent(MapManager)方法来添加一个新的MapManager组件到当前组件上。
            这个方法会创建一个新的MapManager实例，并将其附加到当前节点（LocalGameController的节点）上。
            
            this._mapManager = ...：
            最终，无论是通过getComponent获取的现有实例，还是通过addComponent创建的新实例，都会被赋值给this._mapManager属性。
            这样，_mapManager就可以在LocalGameController类的其他方法中使用，方便管理地图相关的逻辑。
            
            总结：
            这行代码的主要目的是确保LocalGameController类中始终有一个有效的MapManager实例。
            通过这种方式，LocalGameController可以安全地调用MapManager的方法和属性，而不必担心_mapManager为null的情况。
            这种设计模式在Cocos Creator中非常常见，确保了组件之间的依赖关系能够正确建立。

            实际上，cocos中我们也并没有加入MapManager组件，而是通过这里的代码来实现地图管理器的功能。
        */
        
        // 创建玩家管理器
        this._playerManager = this.getComponent(PlayerManager) || this.addComponent(PlayerManager);
        
        // 创建时间管理器
        this._timeManager = this.getComponent(TimeManager) || this.addComponent(TimeManager);
        
        // 创建部队管理器
        this._troopManager = this.getComponent(TroopManager) || this.addComponent(TroopManager);
        
        // 创建AI管理器
        this._aiManager = this.getComponent(AIManager) || this.addComponent(AIManager);
        
        // 这些管理器都是用脚本挂载上去的，所以上面用了这么多||
        // 每一个Manager其实都是一个脚本，写在Scripts下的managers文件夹中

        // 设置管理器之间的引用关系
        if (this._mapManager && this._playerManager && this._timeManager && this._troopManager && this._aiManager) {
            // 将管理器与地图容器以及地图格子预制体关联
            this._mapManager.mapContainer = this.mapContainer;
            this._mapManager.tilePrefab = this.tilePrefab;
            
            // 设置管理器引用
            this._timeManager.setManagers(this._playerManager, this._troopManager, this._aiManager);
            this._troopManager.setManagers(this._mapManager, this._playerManager);
            this._aiManager.setManagers(this._mapManager, this._playerManager, this._troopManager);
            // 设置好引用后这些管理器才能相互共通状态
            
            // 设置游戏规则
            if (this._levelData) {
                this._timeManager.setGameRules(this._levelData.gameRules);
            }
            // 这里面还重置了计时器，所以要放在setManagers之后
        }
    }
    
    /**
     * 设置事件监听
     */
    private _setupEventListeners() {
        // 设置结束回合按钮点击事件
        if (this.SpeedButton) {
            this.SpeedButton.node.on(Button.EventType.CLICK, this._onSpeedUpTurnButtonClicked, this);
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
        /*
        逐部分解释：
            const scene = director.getScene();：
            这行代码通过director.getScene()方法获取当前活动的场景实例。
            director是Cocos Creator中的一个全局对象，负责管理场景的生命周期和状态。

            if (scene) { ... }：
            这个条件语句检查是否成功获取到场景实例。如果场景存在，则执行后续的代码。

            scene.on('tile-selected', this._onTileSelected, this);：
            这行代码为场景注册了一个事件监听器，监听名为"tile-selected"的事件。
            当"tile-selected"事件被触发时，this._onTileSelected方法将被调用。
            this参数确保在事件处理函数中，this的上下文仍然指向当前的LocalGameController实例。
            这是重要的，因为事件处理函数需要访问类的属性和方法。

            事件的作用：
            "tile-selected"事件通常是在用户选择某个地块（tile）时触发的。
            通过在场景级别监听这个事件，LocalGameController可以确保无论用户在场景的哪个部分选择地块，
            都能正确处理这个选择。
            这使得游戏的交互更加灵活和响应迅速，确保用户的操作能够被及时捕获并处理。
            
            总结：
            这段代码的主要目的是在游戏场景中设置一个全局的事件监听器，
            以便能够捕获用户选择地块的操作，并通过调用_onTileSelected方法来处理相应的逻辑。
            这种设计模式在Cocos Creator中非常常见，能够有效地管理和响应用户的输入。

            把场景级别监听去掉之后就点不动了反正
        */
        
        // 监听时间更新事件
        this.node.on('time-updated', this._onTimeUpdated, this);
        
        // 监听玩家击败和游戏结束事件
        this.node.on('player-defeated', this._onPlayerDefeated, this);
        this.node.on('game-over', this._onGameOver, this);
        
        // 监听地块所有权变更事件，检查是否影响大本营
        this.node.on('tile-ownership-changed', (data) => {
            // console.log(`【大本营】接收到地块所有权变更事件: 坐标[${data.x},${data.y}], 从玩家${data.oldOwnerId}变为玩家${data.newOwnerId}`);
            
            // 当任何地块所有权变更时，主动检查一次游戏结束条件
            this._checkGameEndCondition();
            
            // 更新玩家拥有地块和状态
            this._updatePlayerOwnedTiles();
            this._updatePlayerStats();
        });
        /*
        逐部分解释：
            this.node.on('tile-ownership-changed', (data) => { ... });：
            这行代码为当前节点（LocalGameController的节点）注册了一个事件监听器，
            监听名为"tile-ownership-changed"的事件。
            当这个事件被触发时，后面的箭头函数将被调用，并接收一个参数data，
            该参数通常包含有关地块所有权变更的信息。
            
            // console.log(...)：
            这行代码被注释掉了，原本用于输出地块所有权变更的详细信息，包括地块的坐标、旧的所有者ID和新的所有者ID。
            这可以帮助开发者调试和跟踪地块所有权的变化。
            
            this._checkGameEndCondition();：
            这行代码调用了_checkGameEndCondition方法，检查游戏是否满足结束条件。
            例如，如果某个玩家的大本营被占领，游戏可能会结束。通过在地块所有权变更时检查游戏状态，可以及时响应游戏的变化。
            
            this._updatePlayerOwnedTiles();：
            这行代码调用了_updatePlayerOwnedTiles方法，更新所有玩家的拥有地块列表。
            当地块的所有权发生变化时，玩家的地块拥有情况也需要更新，以确保游戏状态的准确性。
            
            this._updatePlayerStats();：
            this行代码调用了_updatePlayerStats方法，更新玩家的状态信息。
            这可能包括玩家的兵力、地块数量等信息，以便在UI上正确显示。
            
            总结：
            这段代码的主要目的是在地块所有权发生变化时，自动检查游戏结束条件，并更新玩家的地块拥有情况和状态信息。
            这种设计确保了游戏状态的实时更新，使得玩家能够及时看到游戏的变化，并且能够正确响应游戏的进程。
            通过监听事件并执行相应的逻辑，增强了游戏的互动性和动态性。
        */
        
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
     * 创建行军状态项并设置文本
     * @param text 显示文本
     * @param color 文本颜色
     * @returns 创建的状态项节点
     */
    private _createMarchingStatusItem(text: string, color: Color): Node {
        // 实例化行军路线预制体，这个预制体就叫做marchingStatusItemPrefab
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
        //console.log("LocalGameController: 更新行军状态面板");
        
        // 获取所有行军路径
        const marchingPathsMap = this._troopManager.getMarchingPaths();
        //console.log(`当前行军路径数量: ${marchingPathsMap.size} 个玩家队列`);
        
        // 如果有玩家管理器，显示各玩家的行军路线数量
        if (this._playerManager) {
            const players = this._playerManager.getPlayers();
            
            // 获取人类玩家和AI玩家
            const humanPlayer = players.find(p => !p.isAI && !p.defeated);
            const aiPlayers = players.filter(p => p.isAI && !p.defeated);
            
            // 更新面板内容
            this.marchingStatusPanel.removeAllChildren();
            
            // 1. 显示人类玩家信息
            if (humanPlayer) {
                // 获取玩家颜色
                const playerColor = humanPlayer.color;
                
                // 创建标题项
                const titleItem = this._createMarchingStatusItem(`你的行军路线 (${humanPlayer.activePathCount}/${humanPlayer.maxPathCount})`, playerColor);
                this.marchingStatusPanel.addChild(titleItem);
                
                // 显示队列中的路径详情
                const playerPaths = marchingPathsMap.get(humanPlayer.id) || [];
                
                if (playerPaths.length > 0) {
                    for (let i = 0; i < playerPaths.length; i++) {
                        const path = playerPaths[i];
                        
                        // 计算当前步骤和总步数
                        const currentStep = path.currentStep + 1;
                        const totalSteps = path.pathTiles.length;
                        
                        // 获取起点和终点
                        const startPoint = path.pathTiles[0];
                        const endPoint = path.pathTiles[path.pathTiles.length - 1];
                        
                        // 创建路径项
                        const pathInfo = `路线${i+1}: [${startPoint.x},${startPoint.y}] → [${endPoint.x},${endPoint.y}] (${currentStep}/${totalSteps})`;
                        const pathItem = this._createMarchingStatusItem(pathInfo, playerColor);
                        
                        // 将路径项添加到面板
                        this.marchingStatusPanel.addChild(pathItem);
                    }
                } else {
                    // 如果没有行军路线，显示提示
                    const emptyItem = this._createMarchingStatusItem("  没有行军路线", playerColor);
                    this.marchingStatusPanel.addChild(emptyItem);
                }
            }
            
            // 2. 显示AI玩家信息
            if (aiPlayers.length > 0) {
                // 添加分隔行
                const separatorItem = this._createMarchingStatusItem("AI行军路线", new Color(200, 200, 200, 255));
                this.marchingStatusPanel.addChild(separatorItem);
                
                // 遍历每个AI玩家
                for (const aiPlayer of aiPlayers) {
                    // 获取玩家颜色
                    const playerColor = aiPlayer.color;
                    
                    // 创建AI玩家标题项
                    const aiTitleItem = this._createMarchingStatusItem(`AI ${aiPlayer.id} (${aiPlayer.activePathCount}/${aiPlayer.maxPathCount})`, playerColor);
                    this.marchingStatusPanel.addChild(aiTitleItem);
                    
                    // 显示AI的行军路线数量
                    const aiPaths = marchingPathsMap.get(aiPlayer.id) || [];
                    
                    if (aiPaths.length > 0) {
                        // 仅显示AI路线数量，不显示详情
                        const aiInfoItem = this._createMarchingStatusItem(`  共${aiPaths.length}条行军路线`, playerColor);
                        this.marchingStatusPanel.addChild(aiInfoItem);
                    } else {
                        // 如果没有行军路线，显示提示
                        const emptyItem = this._createMarchingStatusItem("  没有行军路线", playerColor);
                        this.marchingStatusPanel.addChild(emptyItem);
                    }
                }
            }
        } else {
            // 无玩家管理器时显示简单信息
            this.marchingStatusPanel.removeAllChildren();
            const infoItem = this._createMarchingStatusItem("无法获取行军信息", new Color(255, 0, 0, 255));
            this.marchingStatusPanel.addChild(infoItem);
        }
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
            // 如果已经选择了一个己方格子，并且点击了另一个己方格子，检查是否相邻
            if (this._selectedTile && this._selectedTile.ownerId === currentPlayerId) {
                // 检查两个格子是否相邻
                const isAdjacent = this._targetTiles.some(pos => 
                    pos.x === tile.gridPosition.x && pos.y === tile.gridPosition.y);
                
                if (isAdjacent) {
                    // 它们相邻，执行派遣操作
                    const availableTroops = this._selectedTile.troops - 1;
                    this._troopsToSend = Math.floor(availableTroops / 2) > 0 ? Math.floor(availableTroops / 2) : 0;
                    
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
                    return;
                }
            }
            
            // 普通的选择自己的格子逻辑
            this._selectedTile = tile;
            this._targetTiles = this._mapManager.getAdjacentTiles(tile.gridPosition.x, tile.gridPosition.y);
            
            // 高亮显示可移动目标
            this._highlightTargetTiles();
            
            console.log(`in LocalGameController 选中己方格子 [${tile.gridPosition.x},${tile.gridPosition.y}], 兵力: ${tile.troops}`);
            
            // 选择派遣兵力数量
            if (tile.troops > 1) {
                // 默认派遣一半兵力
                this._troopsToSend = Math.floor(tile.troops / 2);
                console.log(`in LocalGameController 选中己方格子 [${tile.gridPosition.x},${tile.gridPosition.y}], 兵力: ${tile.troops}, 准备派遣兵力: ${this._troopsToSend}`);
                // 更新派遣按钮状态
                this._updateDispatchButton();
            } else {
                console.log(`in LocalGameController 格子兵力不足，无法派遣`);
                this._troopsToSend = 0;
                this._updateDispatchButton();
            }
        } 
        // 选中目标格子 - 恢复这部分关键逻辑
        else if (this._selectedTile && this._targetTiles.some(pos => 
            pos.x === tile.gridPosition.x && pos.y === tile.gridPosition.y)) {
            
            // 计算派遣兵力 - 使用一半兵力，而不是全部
            const availableTroops = this._selectedTile.troops - 1;
            // 默认派遣一半兵力
            this._troopsToSend = Math.floor(availableTroops / 2) > 0 ? Math.floor(availableTroops / 2) : 0;
            
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
    private _onSpeedUpTurnButtonClicked() {
        if (!this._gameStarted || this._gameOver || !this._timeManager) return;
        
        // 播放速度按钮点击音效
        this.dispatchButtonClickSound.play();

        // 在实时模式下，此按钮可用于切换游戏速度
        const currentSpeed = this._timeManager.getGameSpeed();
        const newSpeed = currentSpeed >= 4 ? 1 : currentSpeed * 2;
        this._timeManager.setGameSpeed(newSpeed);
        
        // 更新按钮显示
        this.SpeedButton.getComponentInChildren(Label)!.string = `速度 x${newSpeed}`;
    }
    
    /**
     * 派遣按钮点击处理
     */
    private _onDispatchButtonClicked() {
        console.log("in LocalGameController: 派遣按钮被点击");
        console.log(`当前派遣模式状态: ${this._isInDispatchMode}`);
        // 播放派遣按钮点击音效
        this.dispatchButtonClickSound.play();
        
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
        /*
        在Cocos Creator中，`update`函数的参数`dt`代表"delta time"，即自上一次更新以来经过的时间（通常以秒为单位）。
        具体来说，`dt`的作用如下：

            ### `dt`的作用：

            1. **时间间隔**：
            - `dt`表示从上一帧到当前帧的时间间隔。这使得游戏逻辑可以根据实际时间进行更新，而不是依赖于固定的帧率。

            2. **平滑运动**：
            - 使用`dt`可以实现平滑的运动和动画。
            例如，如果你想让一个对象以每秒`speed`的速度移动，你可以使用以下公式来计算移动的距离：
            \[
            \text{distance} = \text{speed} \times dt
            \]
            这样，无论帧率如何变化，物体的移动速度都将保持一致。

            3. **游戏逻辑更新**：
            - 在游戏中，许多逻辑（如物理模拟、动画、计时器等）都依赖于时间。
            使用`dt`可以确保这些逻辑在不同的帧率下都能正常工作。

            ### 示例：
            假设你有一个物体需要以每秒5个单位的速度移动，你可以在`update`函数中这样实现：

            ```typescript
            update(dt: number) {
                const speed = 5; // 每秒5个单位
                this.node.position.x += speed * dt; // 根据dt更新位置
            }
            ```

            ### 总结：
            `dt`是一个非常重要的参数，它使得游戏的更新逻辑能够根据实际时间进行调整，从而实现平滑的动画和一致的游戏体验。
            通过使用`dt`，开发者可以确保游戏在不同的设备和帧率下都能保持相同的行为。

        */
        if (!this._gameStarted || this._gameOver) {
            return;
        }
        
        // 检查初始化状态
        if (!this._mapManager || !this._playerManager || !this._timeManager || !this._troopManager || !this._aiManager) {
            console.error("LocalGameController: 游戏组件未完全初始化，无法更新");
            return;
        }
        
        const gameTime = this._timeManager.getGameTime();

        // 定期检查游戏结束条件
        if (gameTime % 3 === 0) {
            this._checkGameEndCondition();
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
        // console.log(`【大本营】周期性检查: 所有AI被击败=${allAIDefeated}, 人类被击败=${humanDefeated}`);
        
        // 检查胜利条件
        if (allAIDefeated && !humanDefeated) {
            // 人类玩家胜利
            // console.log(`【大本营】检测到胜利条件：所有AI大本营被占领，人类玩家胜利`);
            this._gameOver = true;
            this._timeManager?.pauseGame();
            
            // 显示胜利画面
            const gameOverPanelComponent = this.gameOverPanel.getComponent(GameOverPanel);
            if (!gameOverPanelComponent) return;
            
            gameOverPanelComponent.showGameOver(true, aiPlayers.length);
        } 
        else if (humanDefeated) {
            // 人类玩家失败
            // console.log(`【大本营】检测到失败条件：人类玩家大本营被占领，游戏失败`);
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
        // 将写有"无行军路线"的Label预制体实例化，并添加到行军状态面板上
        
        // 设置面板样式
        const layout = this.marchingStatusPanel.getComponent(Layout) || this.marchingStatusPanel.addComponent(Layout);
        layout.type = Layout.Type.VERTICAL;
        layout.resizeMode = Layout.ResizeMode.CONTAINER;
        layout.paddingTop = 10;
        layout.paddingBottom = 10;
        layout.paddingLeft = 10;
        layout.paddingRight = 10;
        layout.spacingY = 1;
        /*
        逐部分解释：
            const layout = this.marchingStatusPanel.getComponent(Layout) || this.marchingStatusPanel.addComponent(Layout);：
            这行代码尝试从marchingStatusPanel中获取名为Layout的组件实例。
            如果marchingStatusPanel上已经存在Layout组件，则返回该实例；
            如果不存在，则通过addComponent(Layout)方法添加一个新的Layout组件。
            这样，layout变量将始终引用一个有效的Layout组件实例。

            layout.type = Layout.Type.VERTICAL;：
            这行代码设置布局的类型为垂直（VERTICAL），这意味着面板中的子项将按垂直方向排列。
            这种布局方式适合于需要在竖直方向上显示多个状态项的场景。

            layout.resizeMode = Layout.ResizeMode.CONTAINER;：
            这行代码设置布局的调整模式为CONTAINER，表示布局将根据容器的大小来调整子项的排列。
            这种模式通常用于确保子项在容器内的适当显示。

            layout.paddingTop = 10;、layout.paddingBottom = 10;、layout.paddingLeft = 10;、layout.paddingRight = 10;：
            这些行代码分别设置了面板的上下左右填充（padding）为10个像素。
            填充用于在面板的边缘和子项之间留出空间，使得界面看起来更加美观和整洁。

            layout.spacingY = 5;：
            这行代码设置子项之间的垂直间距（spacingY）为1个像素。
            这确保了面板中每个状态项之间有一定的间隔，使得信息更加易于阅读。

            总结：
            这段代码的主要目的是为行军状态面板设置布局属性，以确保面板中的子项能够以垂直方向排列，并具有适当的填充和间距。这种布局设置有助于提升用户界面的可读性和美观性，使玩家能够清晰地看到行军状态信息。通过动态添加或获取布局组件，确保了面板的灵活性和可扩展性。
        */
        
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
            // ownedTiles是该玩家拥有的土地坐标列表
            
            // 重置行军路线计数
            player.activePathCount = 0;
            // activePathCount是该玩家当前活跃的行军路线数量
        });
        
        // 遍历所有地块，将地块添加到对应玩家的列表中
        // 每次都要清空其实很慢，后面有机会得改改这个算法
        // 怪不得越跑越慢
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this._mapManager.getTile(x, y);
                if (tile && tile.ownerId !== -1) {
                    const player = this._playerManager.getPlayerById(tile.ownerId);
                    /*
                    _playerManager.getPlayerById() 返回的是玩家对象的直接引用。
                    当调用 player.addOwnedTile() 时，修改的是内存中的同一个玩家实例，
                    因此数据会实时更新，无需担心引用不一致。
                    */
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
            const marchingPathsMap = this._troopManager.getMarchingPaths();
            
            // 更新每个玩家的行军路线计数
            players.forEach(player => {
                const playerPaths = marchingPathsMap.get(player.id) || [];
                player.activePathCount = playerPaths.length;
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
        // 创建玩家状态项
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
                // 这里又遍历一遍，我勒个豆，咋回事这AI写的可真是
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
        layout.spacingY = 1;
        /*
        逐部分解释：
            layout.type = Layout.Type.VERTICAL;：
            这行代码设置布局的类型为垂直（VERTICAL），这意味着面板中的子项将按垂直方向排列。
            这种布局方式适合于需要在竖直方向上显示多个状态项的场景。

            layout.resizeMode = Layout.ResizeMode.CONTAINER;：
            这行代码设置布局的调整模式为CONTAINER，表示布局将根据容器的大小来调整子项的排列。
            这种模式通常用于确保子项在容器内的适当显示。

            layout.paddingTop = 10;、layout.paddingBottom = 10;、layout.paddingLeft = 10;、layout.paddingRight = 10;：
            这些行代码分别设置了面板的上下左右填充（padding）为10个像素。
            填充用于在面板的边缘和子项之间留出空间，使得界面看起来更加美观和整洁。

            layout.spacingY = 1;：
            这行代码设置子项之间的垂直间距（spacingY）为1个像素。
            这确保了面板中每个状态项之间有一定的间隔，使得信息更加易于阅读。

            总结：
            这段代码的主要目的是为玩家状态面板设置布局属性，以确保面板中的子项能够以垂直方向排列，并具有适当的填充和间距。这种布局设置有助于提升用户界面的可读性和美观性，使玩家能够清晰地看到玩家状态信息。通过动态添加或获取布局组件，确保了面板的灵活性和可扩展性。
        */
        
        // 添加标题
        const titleItem = instantiate(this.playerStatItemPrefab);
        const titleLabel = titleItem.getComponent(Label) || titleItem.getComponentInChildren(Label);
        if (titleLabel) {
            titleLabel.string = "玩家状态";
            titleLabel.color = new Color(255, 255, 255, 255);
            titleLabel.fontSize += 2; // 标题稍大一些
            this.playerStatsPanel.addChild(titleItem);
        }
        /*
        逐部分解释：
            const titleItem = instantiate(this.playerStatItemPrefab);：
            这行代码通过instantiate方法实例化一个预制体（playerStatItemPrefab），创建一个新的节点（titleItem）。
            这个预制体通常包含一个Label组件，用于显示文本。
            
            const titleLabel = titleItem.getComponent(Label) || titleItem.getComponentInChildren(Label);：
            这行代码尝试从titleItem中获取名为Label的组件实例。
            如果titleItem上存在Label组件，则返回该实例；如果没有，则尝试获取其子节点中的Label组件。
            
            if (titleLabel) { ... }：
            这个条件语句检查是否成功获取到Label组件。如果成功，则执行后续的代码。
            
            titleLabel.string = "玩家状态";：
            这行代码设置Label组件的文本内容为"玩家状态"，用于作为标题显示。
            
            titleLabel.color = new Color(255, 255, 255, 255);：
            这行代码将Label的颜色设置为白色（RGBA值为255, 255, 255, 255），确保标题在面板上清晰可见。
            
            titleLabel.fontSize += 2;：
            这行代码将标题的字体大小增加2个单位，使其稍微显得更大，以便突出显示。
            
            this.playerStatsPanel.addChild(titleItem);：
            这行代码将创建的标题项（titleItem）添加到玩家状态面板（playerStatsPanel）中，使其在UI上可见。

            哦对，playerStatsPanel和playerStatItemPrefab不是一个东西
        */
        
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
        // 运行到这里就是在更新玩家状态了
        
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

    private _syncAllPlayerPathCounts() {
        if (!this._playerManager || !this._troopManager) {
            return;
        }
        
        // 获取当前行军路径队列
        const marchingPathsMap = this._troopManager.getMarchingPaths();
        
        // 获取所有玩家
        const players = this._playerManager.getPlayers();
        
        // 更新每个玩家的行军路线数量
        players.forEach(player => {
            const playerPaths = marchingPathsMap.get(player.id) || [];
            const count = playerPaths.length;
            
            if (player.activePathCount !== count) {
                ////console.log(`LocalGameController: 同步玩家${player.id}的行军路线计数，从${player.activePathCount}更新为${count}`);
                player.activePathCount = count;
            }
        });
    }
} 