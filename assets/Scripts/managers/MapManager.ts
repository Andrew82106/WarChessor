import { _decorator, Component, Node, instantiate, Prefab, Vec2, resources, JsonAsset, Vec3, UITransform, view, Layout, director } from 'cc';
import { TileComponent } from '../components/TileComponent';
import { LevelData, MapData, TerrainType } from '../models/MapData';
import { PlayerManager } from './PlayerManager';

const { ccclass, property } = _decorator;

/**
 * 地图管理器
 * 负责地图生成、格子状态管理
 */
@ccclass('MapManager')
export class MapManager extends Component {
    @property(Prefab)
    tilePrefab: Prefab = null!;
    
    @property(Node)
    mapContainer: Node = null!;
    
    @property
    tileSize: number = 60;
    
    @property
    tileGap: number = 1;
    
    @property
    currentLevelId: string = "level1";
    
    // 地图数据
    private _mapData: MapData | null = null;
    private _levelData: LevelData | null = null;
    private _mapTiles: TileComponent[][] = [];
    private _mapWidth: number = 0;
    private _mapHeight: number = 0;
    
    // 引用其他管理器
    private _playerManager: PlayerManager | null = null;
    
    /**
     * 设置玩家管理器引用
     */
    setPlayerManager(playerManager: PlayerManager): void {
        this._playerManager = playerManager;
    }
    
    /**
     * 加载关卡数据
     */
    async loadLevelData(levelId: string): Promise<LevelData | null> {
        return new Promise((resolve) => {
            // 修改资源路径，确保与实际路径匹配
            resources.load('levels/levelData', JsonAsset, (err, jsonAsset) => {
                if (err) {
                    console.error("加载关卡数据失败：", err);
                    resolve(null);
                    return;
                }
                
                if (!jsonAsset || !jsonAsset.json) {
                    console.error("加载的JSON资产为空或无效");
                    resolve(null);
                    return;
                }
                
                const levelsData = jsonAsset.json as { levels: LevelData[] };
                
                if (!levelsData || !levelsData.levels || !Array.isArray(levelsData.levels)) {
                    console.error("关卡数据格式无效");
                    resolve(null);
                    return;
                }
                
                const level = levelsData.levels.find(level => level.id === levelId);
                
                if (!level) {
                    console.error(`未找到ID为${levelId}的关卡`);
                    resolve(null);
                    return;
                }
                
                // 验证关卡数据完整性 - 修改以匹配实际JSON结构
                if (!level.mapData) {
                    console.error(`关卡${levelId}的地图数据无效`);
                    resolve(null);
                    return;
                }
                
                // 如果mapData中没有size，但关卡顶层有mapSize，则复制过来
                if (!level.mapData.size && level.mapSize) {
                    level.mapData.size = level.mapSize;
                }
                
                if (!level.mapData.size) {
                    console.error(`关卡${levelId}的地图大小数据无效`);
                    resolve(null);
                    return;
                }
                
                this._levelData = level;
                this._mapData = level.mapData;
                this._mapWidth = level.mapData.size.width;
                this._mapHeight = level.mapData.size.height;
                
                // 记录加载成功的日志，便于调试
                console.log(`成功加载关卡数据: ${level.name}, 地图大小: ${this._mapWidth}x${this._mapHeight}`);
                
                // 在初始化地图或加载关卡时添加
                console.log("地图初始化开始：检查玩家初始地块分配");
                // 打印每个地块的初始所有权
                level.mapData.ownership.forEach((tileRow, y) => {
                    tileRow.forEach((tile, x) => {
                        if (tile !== -1) {
                            console.log(`初始地块 [${x},${y}] 分配给玩家${tile}, 兵力=${level.mapData.troops[y][x]}, 类型=${level.mapData.terrain[y][x]}`);
                        }
                    });
                });
                
                resolve(level);
            });
        });
    }
    
    /**
     * 初始化地图
     */
    async initMap(): Promise<boolean> {
        // 到这里就是在初始化地图了
        /*
        async的作用：
            异步函数：
            使用async关键字定义的函数会返回一个Promise对象。
            这意味着该函数可以在执行过程中进行异步操作，而不会阻塞主线程。
            使用await：
            在async函数内部，可以使用await关键字来等待一个Promise的完成。
            await会暂停函数的执行，直到Promise被解决（resolved）或拒绝（rejected）。
            这使得异步代码的书写方式更接近于同步代码，便于理解和维护。
            错误处理：
            在async函数中，可以使用try...catch语句来捕获异步操作中的错误。
            这使得错误处理变得更加简单和直观。
        
            在initMap函数中的具体应用：
            在initMap函数中，async的使用使得可以在函数内部调用异步方法loadLevelData，
            并使用await来等待其完成：
            const levelData = await this.loadLevelData(this.currentLevelId);
            这行代码会暂停initMap函数的执行，直到loadLevelData返回结果。
            这意味着在加载关卡数据之前，后续的地图初始化逻辑不会执行，从而确保地图数据的完整性。

        */
        //console.log("MapManager节点路径:", this.node.name);
        //console.log("Tile预制体状态:", this.tilePrefab ? "已设置" : "未设置");
        //console.log("地图容器状态:", this.mapContainer ? "已设置" : "未设置");
        
        // 确保地图数据已加载
        if (!this._mapData) {
            //console.log("地图数据未加载，开始加载关卡数据...");
            const levelData = await this.loadLevelData(this.currentLevelId);
            if (!levelData) {
                console.error("加载关卡数据失败，无法初始化地图");
                return false;
            }
            //console.log("加载关卡数据成功，开始初始化地图...");
        }
        
        // 清除现有地图
        this.clearMap();
        
        //console.log("in MapManager initMap function, going to create map grid");
        // 创建新地图
        this.createMapGrid();
        
        // 设置地图中心位置
        // this.centerMap();
        //console.log("地图初始化完成");
        return true;
    }
    
    /**
     * 清除地图
     */
    clearMap(): void {
        this.mapContainer.removeAllChildren();
        this._mapTiles = [];
    }
    
    /**
     * 创建地图网格
     */
    createMapGrid(): void {
        // 这里就是创建地图网格了
        // 检查地图数据是否已加载
        if (!this._mapData) {
            console.error("地图数据未加载");
            return;
        }
        
        // 禁用任何布局组件，以防止它们干扰地图网格的布局
        const layout = this.mapContainer.getComponent(Layout);
        if (layout) {
            layout.enabled = false;
        }
        const containerSize = this.mapContainer.getComponent(UITransform).contentSize;
        const tileSize = Math.min(containerSize.width / this._mapWidth, containerSize.height / this._mapHeight);
        
        // 计算有效瓷砖尺寸，包括间隙
        const effectiveTileSize = tileSize + this.tileGap;
        const mapWidth = this._mapWidth * effectiveTileSize;
        const mapHeight = this._mapHeight * effectiveTileSize;
        
        // 获取容器尺寸并设置地图容器的宽度和高度
        const containerTransform = this.mapContainer.getComponent(UITransform);
        if (containerTransform) {
            containerTransform.width = mapWidth;
            containerTransform.height = mapHeight;
        }
        
        // 计算起始位置，确保地图居中显示
        const startX = -mapWidth / 2 + tileSize / 2;
        const startY = mapHeight / 2 - tileSize / 2;
        
        // 初始化地图格子二维数组
        this._mapTiles = Array(this._mapHeight).fill(null)
            .map(() => Array(this._mapWidth).fill(null));
        
        // 日志输出，标记地图格子创建开始
        // console.log("in MapManager createMapGrid function, 正在创建地图格子，应用地形、所有权和兵力数据...");
        
        // 创建所有格子
        for (let y = 0; y < this._mapHeight; y++) {
            for (let x = 0; x < this._mapWidth; x++) {
                // 实例化格子预制体并添加到地图容器
                //console.log("in MapManager createMapGrid function, going to instantiate tile prefab");
                const tileNode = instantiate(this.tilePrefab); 
                // 实例化格子预制体，这里会调用TileComponent的onLoad函数
                this.mapContainer.addChild(tileNode);
                //console.log("tileNode added to mapContainer");
                
                // 计算格子位置，使地图居中显示
                const posX = startX + x * effectiveTileSize;
                const posY = startY - y * effectiveTileSize;
                
                //console.log("in MapManager createMapGrid function, going to set tileNode position");
                tileNode.setPosition(posX, posY, 0);
                //console.log("tileNode position set");
                
                // 设置格子组件并应用基本属性及地图数据
                const tile = tileNode.getComponent(TileComponent);
                if (tile) {
                    tile.gridPosition = new Vec2(x, y);
                    this._mapTiles[y][x] = tile;
                    
                    //console.log("in MapManager createMapGrid function, going to apply terrain type");
                    // 从地图数据中应用地形类型
                    if (this._mapData.terrain && this._mapData.terrain[y] && this._mapData.terrain[y][x] !== undefined) {
                        tile.terrainType = this._mapData.terrain[y][x];
                    }
                    // 从地图数据中应用所有权
                    if (this._mapData.ownership && this._mapData.ownership[y] && this._mapData.ownership[y][x] !== undefined) {
                        const ownerId = this._mapData.ownership[y][x];
                        tile.ownerId = ownerId;
                        // 这里设置了ownerId，会调用TileComponent的updateOwnerDisplay函数
                        //console.log(`设置 Tile [${x},${y}] 的所有者ID为: ${ownerId}`);
                    }
                    //console.log("ownership applied");
                    // 从地图数据中应用兵力
                    if (this._mapData.troops && this._mapData.troops[y] && this._mapData.troops[y][x] !== undefined) {
                        tile.troops = this._mapData.troops[y][x];
                        //console.log(`设置 Tile [${x},${y}] 的兵力为: ${tile.troops}`);
                    }
                    //console.log("troops applied");
                    // 检查背景组件是否存在
                    if (!tile.background) {
                        console.error(`Tile [${x},${y}] 背景组件不存在!`);
                    }
                    //console.log("background component checked");
                }
                
                // 调整节点层级，确保格子按顺序绘制
                tileNode.setSiblingIndex(y * this._mapWidth + x);
            }
        }
        
        // 添加额外调试信息，输出地图格子总数及地图容器的相关信息
        // console.log(`in MapManager createMapGrid function, 创建了 ${this._mapWidth * this._mapHeight} 个Tile`);
        // console.log(`in MapManager createMapGrid function, 地图容器节点层级: ${this.mapContainer.getSiblingIndex()}`);
        // console.log(`in MapManager createMapGrid function, 地图容器世界坐标: ${this.mapContainer.worldPosition}`);
    }
    
    /**
     * 居中显示地图容器
     */
    private centerMap(): void {
        // 因为MapContainer已经是GameRoot的子节点，且GameRoot在屏幕中心
        // 所以MapContainer应该位于(0,0,0)
        this.mapContainer.setPosition(0, 0, 0);
        
        // 记录调试信息
        console.log("in MapManager centerMap function, 地图容器位置重置为原点(0,0,0)");
        console.log(`in MapManager centerMap function, 地图容器世界坐标: ${this.mapContainer.worldPosition}`);
    }
    
    /**
     * 获取指定位置的格子
     */
    getTile(x: number, y: number): TileComponent | null {
        if (x < 0 || x >= this._mapWidth || y < 0 || y >= this._mapHeight) {
            return null;
        }
        return this._mapTiles[y][x];
    }
    
    /**
     * 获取格子的坐标位置（屏幕坐标）
     */
    getTilePosition(x: number, y: number): Vec3 | null {
        const tile = this.getTile(x, y);
        if (!tile) {
            return null;
        }
        return tile.node.worldPosition.clone();
    }
    
    /**
     * 获取相邻的格子坐标
     * @param x 格子X坐标
     * @param y 格子Y坐标
     * @returns 相邻格子坐标数组
     */
    getAdjacentTiles(x: number, y: number): Vec2[] {
        console.log(`MapManager: 获取格子 [${x},${y}] 的相邻格子`);
        const adjacentCoords: Vec2[] = [];
        
        // 上下左右四个方向
        const directions = [
            { dx: 0, dy: -1 }, // 上
            { dx: 1, dy: 0 },  // 右
            { dx: 0, dy: 1 },  // 下
            { dx: -1, dy: 0 }  // 左
        ];
        
        for (const dir of directions) {
            const newX = x + dir.dx;
            const newY = y + dir.dy;
            
            // 检查坐标是否在地图范围内
            if (newX >= 0 && newX < this._mapWidth && newY >= 0 && newY < this._mapHeight) {
                adjacentCoords.push(new Vec2(newX, newY));
            }
        }
        
        console.log(`MapManager: 找到 ${adjacentCoords.length} 个相邻格子`);
        return adjacentCoords;
    }
    
    /**
     * 处理格子点击事件
     */
    onTileClicked(tile: TileComponent): void {
        console.log(`MapManager: 收到格子点击事件，格子位置 [${tile.gridPosition.x},${tile.gridPosition.y}]`);
        
        // 向游戏控制器分发事件
        this.node.emit('tile-selected', tile);
    }
    
    /**
     * 更新地块所有权
     * @param x 格子X坐标
     * @param y 格子Y坐标
     * @param ownerId 新的所有者ID
     */
    updateTileOwnership(x: number, y: number, ownerId: number): void {
        const tile = this.getTile(x, y);
        if (!tile) {
            console.error(`无法更新地块所有权：坐标[${x},${y}]上没有地块`);
            return;
        }
        
        const oldOwnerId = tile.ownerId;
        console.log(`地块所有权变更：[${x},${y}] 从玩家${oldOwnerId} -> 玩家${ownerId}`);
        
        // 从旧拥有者的地块列表中移除
        if (oldOwnerId !== -1 && this._playerManager) {
            const oldOwner = this._playerManager.getPlayerById(oldOwnerId);
            if (oldOwner) {
                oldOwner.removeOwnedTile(new Vec2(x, y));
            }
        }
        
        // 更新地块所有权
        tile.ownerId = ownerId;
        
        // 添加到新拥有者的地块列表
        if (ownerId !== -1 && this._playerManager) {
            const newOwner = this._playerManager.getPlayerById(ownerId);
            if (newOwner) {
                newOwner.addOwnedTile(new Vec2(x, y));
            }
        }
        
        // 更新地块显示
        const tileComponent = tile.getComponent(TileComponent);
        if (tileComponent) {
            tileComponent.ownerId = ownerId;
        }
        
        // 触发地块所有权变更事件
        this.node.emit('tile-ownership-changed', { x, y, oldOwnerId, newOwnerId: ownerId });
        
        // 检查大本营状况
        this.checkHeadquartersStatus(x, y, ownerId, oldOwnerId);
    }
    
    /**
     * 检查大本营状况，判断游戏是否结束
     */
    private checkHeadquartersStatus(x: number, y: number, newOwnerId: number, oldOwnerId: number): void {
        if (!this._playerManager) return;
        
        const tile = this.getTile(x, y);
        if (!tile || tile.terrainType !== TerrainType.HEADQUARTERS) return;
        
        console.log(`【大本营】检测到大本营位置[${x},${y}]所有权变更: 从玩家${oldOwnerId}变为玩家${newOwnerId}`);
        
        // 如果是大本营，检查它是否是某个玩家的
        let headquarters = false;
        this._playerManager.getPlayers().forEach(player => {
            if (player.headquarters && player.headquarters.x === x && player.headquarters.y === y) {
                headquarters = true;
                console.log(`【大本营】确认位置[${x},${y}]是玩家${player.id}(${player.name})的大本营`);
                
                // 如果大本营被其他玩家占领，标记玩家为已击败
                if (player.id !== newOwnerId) {
                    console.log(`【大本营】玩家${player.id}(${player.name})的大本营被玩家${newOwnerId}占领，该玩家被击败`);
                    player.defeated = true;
                    
                    // 通知玩家被击败事件
                    this.node.emit('player-defeated', player.id);
                    
                    // 检查游戏胜利条件
                    const winnerId = this._playerManager.checkWinCondition();
                    if (winnerId !== -1) {
                        console.log(`【大本营】检测到游戏结束条件，胜利者ID: ${winnerId}`);
                        this.node.emit('game-over', winnerId);
                    }
                }
            }
        });
    }
    
    /**
     * 更新格子驻军数量
     */
    updateTileTroops(x: number, y: number, troops: number): void {
        const tile = this.getTile(x, y);
        if (!tile) return;
        
        tile.troops = troops;
    }
    
    /**
     * 更新玩家视野
     */
    updateVisibility(): void {
        console.log("in MapManager updateVisibility function, 强制显示所有格子...");
        
        // 强制显示所有格子
        for (let y = 0; y < this._mapHeight; y++) {
            for (let x = 0; x < this._mapWidth; x++) {
                const tile = this._mapTiles[y][x];
                if (tile) {
                    tile.isVisible = true;
                    
                    // 强制关闭迷雾
                    //if (tile.fogNode) {
                    //    tile.fogNode.active = false;
                    //}
                    
                    // 确保节点激活
                    tile.node.active = true;
                }
            }
        }
    }
    
    /**
     * 获取地图尺寸
     */
    getMapSize(): {width: number, height: number} {
        return {
            width: this._mapWidth,
            height: this._mapHeight
        };
    }
    
    /**
     * 检查格子坐标是否在地图范围内
     */
    isValidPosition(x: number, y: number): boolean {
        return x >= 0 && x < this._mapWidth && y >= 0 && y < this._mapHeight;
    }
    
    /**
     * 获取所有地图格子
     */
    getMapTiles(): TileComponent[][] {
        return this._mapTiles;
    }
    
    // 添加到LocalGameController或创建专门的LayoutManager
    adjustMapLayout(): void {
        const screenSize = view.getVisibleSize();
        const mapSize = this.getMapSize();
        
        // 计算理想的缩放比例
        const scaleX = screenSize.width / (mapSize.width * this.tileSize);
        const scaleY = screenSize.height / (mapSize.height * this.tileSize);
        const scale = Math.min(scaleX, scaleY) * 0.9; // 留出一些边距
        
        // 应用缩放到MapContainer
        this.mapContainer.scale = new Vec3(scale, scale, 1);
        
        // 调整位置使其居中
        this.mapContainer.position = new Vec3(
            (screenSize.width - mapSize.width * scale) / 2,
            (screenSize.height - mapSize.height * scale) / 2,
            0
        );
    }
} 