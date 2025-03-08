import { _decorator, Component, Node, Vec2 } from 'cc';
import { MapManager } from './MapManager';
import { PlayerManager } from './PlayerManager';
import { TerrainType } from '../models/MapData';

const { ccclass, property } = _decorator;

/**
 * 行军路径类型
 */
interface MarchingPath {
    playerId: number;
    sourceTile: Vec2;
    targetTiles: Vec2[];
    troops: number;
    currentStep: number;
    assignedTroops: number;
}

/**
 * 兵力管理器
 * 负责处理兵力增长、移动和战斗
 */
@ccclass('TroopManager')
export class TroopManager extends Component {
    @property
    maxPathLength: number = 10; // 最大行军路径长度
    
    // 引用其他管理器
    private _mapManager: MapManager | null = null;
    private _playerManager: PlayerManager | null = null;
    
    // 行军队列
    private _marchingPaths: MarchingPath[] = [];
    
    // 游戏规则
    private _gameRules: any = null;
    
    /**
     * 设置管理器引用
     */
    setManagers(mapManager: MapManager, playerManager: PlayerManager): void {
        this._mapManager = mapManager;
        this._playerManager = playerManager;
    }
    
    /**
     * 设置游戏规则
     */
    setGameRules(gameRules: any): void {
        this._gameRules = gameRules;
    }
    
    /**
     * 创建行军路径
     * @param playerId 玩家ID
     * @param sourceTile 起始格子
     * @param targetTiles 目标格子数组
     * @param troops 派遣的兵力数量
     * @returns 是否成功创建
     */
    createMarchingPath(
        playerId: number,
        sourceTile: Vec2,
        targetTiles: Vec2[],
        troops: number
    ): boolean {
        console.log(`in TroopManager: 创建行军路径: 玩家${playerId}从[${sourceTile.x},${sourceTile.y}]出发, 目标数量${targetTiles.length}, 分配兵力${troops}`);
        //输出行军路径
        console.log(`in TroopManager: 行军路径: ${JSON.stringify(targetTiles)}`);
        if (!this._mapManager) {
            console.error("in TroopManager: 地图管理器未设置，无法创建行军路径");
            return false;
        }
        
        // 获取源格子
        const sourceTileObj = this._mapManager.getTile(sourceTile.x, sourceTile.y);
        if (!sourceTileObj) {
            console.error(`in TroopManager: 源格子不存在: [${sourceTile.x}, ${sourceTile.y}]`);
            return false;
        }

        // 验证是否是自己的格子且有足够兵力
        if (sourceTileObj.ownerId !== playerId) {
            console.error(`in TroopManager: 源格子不属于玩家${playerId}`);
            return false;
        }
        
        // 验证兵力是否足够，且留下至少1个兵力
        if (sourceTileObj.troops < 2) {
            console.error(`in TroopManager: 源格子兵力不足: 拥有${sourceTileObj.troops}，需要至少2个兵力（1个用于行军，1个留守）`);
            return false;
        }
        
        // 验证目标点数量是否超过最大允许值
        if (targetTiles.length > this.maxPathLength) {
            console.error(`in TroopManager: 行军路径过长: ${targetTiles.length}，最大允许${this.maxPathLength}`);
            targetTiles = targetTiles.slice(0, this.maxPathLength);
            console.log(`in TroopManager: 已截断为${this.maxPathLength}个点`);
        }
        
        // 创建行军路径对象
        const marchingPath: MarchingPath = {
            playerId: playerId,
            sourceTile: new Vec2(sourceTile.x, sourceTile.y),
            targetTiles: targetTiles.map(tile => new Vec2(tile.x, tile.y)),
            troops: troops,
            currentStep: 0,
            assignedTroops: 0  // 初始值为0，在处理行军队列时会更新
        };
        
        // 添加到行军队列
        this._marchingPaths.push(marchingPath);
        
        console.log(`in TroopManager: 行军路径创建成功，当前队列长度: ${this._marchingPaths.length}`);
        return true;
    }
    
    /**
     * 处理行军队列
     * 每回合调用一次，推进所有行军路径的进度
     */
    processMarchingQueues(): void {
        // 如果没有行军路径或地图管理器未初始化，直接返回
        if (this._marchingPaths.length === 0 || !this._mapManager) return;
        
        // 获取当前行军路径（队列中的第一条）
        const currentPath = this._marchingPaths[0];
        
        // 获取当前步骤的from节点（当前位置）
        let fromPos: Vec2;
        if (currentPath.currentStep === 0) {
            // 如果是第一步，from就是起始点
            fromPos = currentPath.sourceTile;
        } else {
            // 否则from是上一步的to节点
            fromPos = currentPath.targetTiles[currentPath.currentStep - 1];
        }
        
        // 获取当前步骤的to节点（目标位置）
        // 如果已经到达最后一步，完成行军
        if (currentPath.currentStep >= currentPath.targetTiles.length) {
            console.log(`行军路径已完成，从队列中移除`);
            this._marchingPaths.shift(); // 移除当前路径
            return this.processMarchingQueues(); // 处理下一条路径
        }
        
        const toPos = currentPath.targetTiles[currentPath.currentStep];
        
        // 获取from和to节点的格子对象
        const fromTile = this._mapManager.getTile(fromPos.x, fromPos.y);
        const toTile = this._mapManager.getTile(toPos.x, toPos.y);
        
        if (!fromTile || !toTile) {
            console.error(`格子不存在，跳过此步骤`);
            currentPath.currentStep++; // 增加步骤
            return;
        }
        
        console.log(`处理行军：从 [${fromPos.x},${fromPos.y}] 到 [${toPos.x},${toPos.y}]`);
        
        // 检查from节点是否属于当前行军的玩家，且有足够兵力
        if (fromTile.ownerId !== currentPath.playerId) {
            console.log(`起始格子不再属于该玩家，取消行军路径`);
            this._marchingPaths.shift();
            return this.processMarchingQueues();
        }
        
        // 计算可调遣的兵力
        const availableTroops = fromTile.troops - 1;
        
        // 如果from节点兵力不足，取消行军
        if (availableTroops <= 0) {
            console.log(`起始格子兵力不足，取消行军路径`);
            this._marchingPaths.shift();
            return this.processMarchingQueues();
        }
        
        // 设置实际调遣的兵力
        let troopsToMove: number;
        troopsToMove = availableTroops;

        // 处理from节点：留下1个兵力
        fromTile.troops = 1;
        this._mapManager.updateTileTroops(fromPos.x, fromPos.y, 1);
        console.log(`从 [${fromPos.x},${fromPos.y}] 调出 ${troopsToMove} 兵力，留下1个士兵`);
        
        // 处理to节点（根据所有权分类）
        if (toTile.ownerId === currentPath.playerId) {
            // 情况1：目标是己方格子，增加兵力
            const newTroops = toTile.troops + troopsToMove;
            this._mapManager.updateTileTroops(toPos.x, toPos.y, newTroops);
            console.log(`到达己方格子 [${toPos.x},${toPos.y}]，增加兵力至 ${newTroops}`);
        } else {
            // 情况2：目标是无人控制或敌方格子，进行战斗
            this.resolveCombat(currentPath.playerId, toPos.x, toPos.y, troopsToMove);
        }
        
        // 移动到下一步
        currentPath.currentStep++;
        
        // 如果行军已完成，移除当前路径
        if (currentPath.currentStep >= currentPath.targetTiles.length) {
            console.log(`行军路径已完成，从队列中移除`);
            this._marchingPaths.shift();
            
            // 如果还有其他路径，继续处理
            if (this._marchingPaths.length > 0) {
                console.log(`处理下一条行军路径`);
            }
        }
    }
    
    /**
     * 解决战斗
     */
    resolveCombat(attackerId: number, x: number, y: number, attackingTroops: number): void {
        if (!this._mapManager || !this._playerManager) return;
        
        const targetTile = this._mapManager.getTile(x, y);
        if (!targetTile) return;
        
        const defenderId = targetTile.ownerId;
        const defendingTroops = targetTile.troops;
        
        console.log(`in TroopManager: 解决战斗: 玩家${attackerId}用${attackingTroops}兵力攻击坐标[${x},${y}]，防守方ID=${defenderId}，兵力=${defendingTroops}`);
        
        // 情况1：目标是己方土地（增援）
        if (defenderId === attackerId) {
            // 更新格子兵力为己方行军部队兵力
            this._mapManager.updateTileTroops(x, y, attackingTroops);
            console.log(`in TroopManager: 己方格子，更新兵力为 ${attackingTroops}`);
            return;
        }
        
        // 情况2：目标是无主土地
        if (defenderId === -1) {
            // 占领无主土地并放置兵力（攻击兵力 - 无主土地上的兵力）
            const resultTroops = Math.max(1, attackingTroops - defendingTroops);
            this._mapManager.updateTileOwnership(x, y, attackerId);
            this._mapManager.updateTileTroops(x, y, resultTroops);
            console.log(`in TroopManager: 占领无主土地，剩余兵力 ${resultTroops}`);
            return;
        }
        
        // 情况3：目标是敌方土地（战斗）
        // 计算战斗结果
        const result = attackingTroops - defendingTroops;
        
        // 攻击方胜利
        if (result > 0) {
            // 更新格子所有权和兵力
            this._mapManager.updateTileOwnership(x, y, attackerId);
            this._mapManager.updateTileTroops(x, y, result);
            
            console.log(`in TroopManager: 攻击方胜利，剩余兵力 ${result}`);
            
            // 检查是否占领政治中心或大本营
            if (targetTile.terrainType === TerrainType.POLITICAL_CENTER) {
                // 更新政治中心数量
                const attacker = this._playerManager.getPlayerById(attackerId);
                if (attacker) {
                    attacker.politicalCenters++;
                    console.log(`in TroopManager: 玩家${attackerId}占领了政治中心，当前拥有${attacker.politicalCenters}个政治中心`);
                }
                
                if (defenderId !== -1) {
                    const defender = this._playerManager.getPlayerById(defenderId);
                    if (defender) {
                        defender.politicalCenters--;
                        console.log(`in TroopManager: 玩家${defenderId}失去了政治中心，剩余${defender.politicalCenters}个政治中心`);
                    }
                }
            } else if (targetTile.terrainType === TerrainType.HEADQUARTERS) {
                // 如果占领了对方大本营，对方被击败
                if (defenderId !== -1) {
                    console.log(`in TroopManager: 玩家${attackerId}占领了玩家${defenderId}的大本营`);
                    this.defeatPlayer(defenderId);
                }
            }
        } 
        // 攻守双方兵力相等，防守方保持所有权，双方兵力归零
        else if (result === 0) {
            this._mapManager.updateTileTroops(x, y, 0);
            console.log(`in TroopManager: 战斗平局，双方兵力归零，格子保持原所有权`);
        }
        // 防守方胜利，减少兵力
        else {
            this._mapManager.updateTileTroops(x, y, -result);
            console.log(`in TroopManager: 防守方胜利，剩余兵力 ${-result}`);
        }
    }
    
    /**
     * 击败玩家
     */
    defeatPlayer(playerId: number): void {
        if (!this._playerManager || !this._mapManager) return;
        
        const player = this._playerManager.getPlayerById(playerId);
        if (!player) return;
        
        // 设置玩家为已击败状态
        player.defeated = true;
        
        // 通知玩家被击败事件
        this.node.emit('player-defeated', playerId);
        
        // 检查游戏胜利条件
        const winnerId = this._playerManager.checkWinCondition();
        if (winnerId !== -1) {
            this.node.emit('game-over', winnerId);
        }
    }
    
    /**
     * 增长指定玩家特定类型土地的兵力
     */
    growTroopsForPlayer(playerId: number, terrainTypeStr: string): void {
        if (!this._mapManager || !this._playerManager || !this._gameRules) return;
        
        // 获取地形类型枚举值
        let terrainType: TerrainType;
        switch (terrainTypeStr) {
            case 'BASIC_LAND':
                terrainType = TerrainType.BASIC_LAND;
                break;
            case 'POPULATION_CENTER':
                terrainType = TerrainType.POPULATION_CENTER;
                break;
            case 'POLITICAL_CENTER':
                terrainType = TerrainType.POLITICAL_CENTER;
                break;
            case 'HEADQUARTERS':
                terrainType = TerrainType.HEADQUARTERS;
                break;
            default:
                return;
        }
        
        // 获取玩家拥有的所有格子
        const player = this._playerManager.getPlayerById(playerId);
        if (!player || player.defeated) return;
        
        // 遍历玩家拥有的所有格子
        player.ownedTiles.forEach(tilePos => {
            const tile = this._mapManager!.getTile(tilePos.x, tilePos.y);
            if (!tile || tile.ownerId !== playerId) return;
            
            // 根据地形类型增长兵力
            if (tile.terrainType === terrainType) {
                let growthAmount = 0;
                
                switch (terrainType) {
                    case TerrainType.BASIC_LAND:
                        growthAmount = 1;
                        break;
                    case TerrainType.POPULATION_CENTER:
                        growthAmount = this._gameRules.populationIncreaseRate;
                        break;
                    case TerrainType.HEADQUARTERS:
                        growthAmount = this._gameRules.headquartersIncreaseRate;
                        break;
                    case TerrainType.POLITICAL_CENTER:
                        // 政治中心本身不产兵
                        break;
                }
                
                if (growthAmount > 0) {
                    this._mapManager!.updateTileTroops(tilePos.x, tilePos.y, tile.troops + growthAmount);
                }
            }
        });
    }
    
    /**
     * 清除指定玩家的所有行军队列
     */
    clearMarchingQueuesForPlayer(playerId: number): void {
        this._marchingPaths = this._marchingPaths.filter(path => path.playerId !== playerId);
    }
    
    /**
     * 获取所有行军路径
     */
    getMarchingPaths(): MarchingPath[] {
        return [...this._marchingPaths];
    }
    
    /**
     * 设置玩家管理器引用
     */
    setPlayerManager(playerManager: PlayerManager): void {
        this._playerManager = playerManager;
    }
    
    /**
     * 发送兵力
     * @param fromX 源格子X坐标
     * @param fromY 源格子Y坐标
     * @param toX 目标格子X坐标
     * @param toY 目标格子Y坐标
     * @param troops 想要派遣的兵力
     * @returns 是否成功派遣
     */
    sendTroops(fromX: number, fromY: number, toX: number, toY: number, troops: number): boolean {
        if (!this._mapManager || !this._playerManager) {
            console.error("in TroopManager: 无法派遣部队：管理器未设置");
            return false;
        }
        
        // 获取源格子和玩家信息
        const sourceTile = this._mapManager.getTile(fromX, fromY);
        if (!sourceTile) {
            console.error(`in TroopManager: 派遣失败：源格子[${fromX},${fromY}]不存在`);
            return false;
        }
        
        const player = this._playerManager.getCurrentPlayer();
        if (!player) {
            console.error("in TroopManager: 派遣失败：无法获取当前玩家");
            return false;
        }
        
        // 检查格子所有权
        if (sourceTile.ownerId !== player.id) {
            console.error(`in TroopManager: 派遣失败：源格子不属于当前玩家，所有者为${sourceTile.ownerId}`);
            return false;
        }
        
        // 确保源格子至少留下1个兵力
        const availableTroops = sourceTile.troops - 1;
        if (availableTroops <= 0) {
            console.error(`in TroopManager: 派遣失败：源格子兵力不足，需要至少2个兵力才能派遣`);
            return false;
        }
        
        // 调整派遣的兵力数量，不能超过可用兵力
        const actualTroops = Math.min(troops, availableTroops);
        
        // 创建从源到目标的简单路径
        const targetTiles: Vec2[] = [new Vec2(toX, toY)];
        
        // 创建行军路径
        return this.createMarchingPath(player.id, new Vec2(fromX, fromY), targetTiles, actualTroops);
    }
} 