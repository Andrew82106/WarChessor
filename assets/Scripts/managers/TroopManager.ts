import { _decorator, Component, Node, Vec2, director } from 'cc';
import { MapManager } from './MapManager';
import { PlayerManager } from './PlayerManager';
import { TerrainType } from '../models/MapData';

const { ccclass, property } = _decorator;

/**
 * 行军路径类型
 */
interface MarchingPath {
    playerId: number;
    pathTiles: Vec2[];    // 完整路径，包含所有节点
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
     * @param sourceTile 起始格子坐标
     * @param targetTiles 目标格子坐标数组
     * @param troops 派遣的兵力数量
     * @returns 是否成功创建行军路径
     */
    createMarchingPath(playerId: number, sourceTile: Vec2, targetTiles: Vec2[], troops: number): boolean {
        ////console.log(`TroopManager: createMarchingPath调用 - 玩家ID=${playerId}, 起点=[${sourceTile.x},${sourceTile.y}], 目标点数=${targetTiles.length}, 兵力=${troops}`);
        
        // 检查地图管理器是否可用
        if (!this._mapManager) {
            console.error("TroopManager: 地图管理器未初始化，无法创建行军路径");
            return false;
        }
        
        // 检查玩家管理器是否可用
        if (!this._playerManager) {
            console.error("TroopManager: 玩家管理器未初始化，无法创建行军路径");
            return false;
        }
        
        // 获取玩家对象
        const player = this._playerManager.getPlayerById(playerId);
        if (!player) {
            console.error(`TroopManager: 找不到ID为${playerId}的玩家，无法创建行军路径`);
            return false;
        }
        
        // 获取起始格子
        const sourceTileObj = this._mapManager.getTile(sourceTile.x, sourceTile.y);
        if (!sourceTileObj) {
            console.error(`TroopManager: 起始格子 [${sourceTile.x},${sourceTile.y}] 不存在`);
            return false;
        }
        
        // 检查格子所有权
        if (sourceTileObj.ownerId !== playerId) {
            console.error(`TroopManager: 起始格子 [${sourceTile.x},${sourceTile.y}] 不属于玩家 ${playerId}，当前所有者: ${sourceTileObj.ownerId}`);
            return false;
        }
        
        // 检查兵力是否足够（应保留至少1个兵力在原地）
        const minRequiredTroops = troops + 1; // 需要派遣的兵力 + 1个留守兵力
        ////console.log(`TroopManager: 检查起始格子兵力 - 当前兵力: ${sourceTileObj.troops}, 需要: ${minRequiredTroops} (派遣${troops} + 留守1)`);
        
        if (sourceTileObj.troops < minRequiredTroops) {
            console.error(`TroopManager: 起始格子 [${sourceTile.x},${sourceTile.y}] 兵力不足，当前兵力: ${sourceTileObj.troops}, 需要至少: ${minRequiredTroops}`);
            return false;
        }
        
        // 检查目标路径是否有效
        if (!targetTiles || targetTiles.length === 0) {
            console.error("TroopManager: 目标路径为空，无法创建行军路径");
            return false;
        }
        
        // 打印所有目标点
        ////console.log("TroopManager: 目标路径包含以下坐标:");
        //targetTiles.forEach((pos, index) => {
        //    //console.log(`目标点 ${index}: [${pos.x},${pos.y}]`);
        //});
        
        // 创建完整路径，包含起始点和所有目标点
        const completePath = [sourceTile, ...targetTiles];
        
        // 创建行军路径对象
        const marchingPath: MarchingPath = {
            playerId: playerId,
            pathTiles: completePath,
            currentStep: 0,
            troops: troops,
            assignedTroops: troops  // 设置已分配兵力为派遣的兵力数量
        };
        
        // 从源格子减少兵力
        sourceTileObj.troops -= troops;
        ////console.log(`TroopManager: 从起始格子 [${sourceTile.x},${sourceTile.y}] 减少 ${troops} 兵力, 剩余: ${sourceTileObj.troops}`);
        
        // 添加到行军路径队列
        this._marchingPaths.push(marchingPath);
        
        // 增加玩家的行军路线计数
        player.activePathCount++;
        ////console.log(`TroopManager: 玩家${playerId}的行军路线数增加到 ${player.activePathCount}，当前队列中${this.getPlayerActivePathCount(playerId)}条`);
        
        ////console.log(`TroopManager: 行军路径创建成功，当前队列长度: ${this._marchingPaths.length}`);
        
        return true;
    }
    
    /**
     * 处理行军队列
     * 每个时间间隔调用一次，推进所有行军路径的进度
     */
    processMarchingQueues(): void {
        // 如果没有行军路径，不输出大量日志
        if (this._marchingPaths.length === 0) {
            return;
        }
        
        ////console.log(`----- TroopManager: processMarchingQueues调用, 当前队列长度: ${this._marchingPaths.length} -----`);
        ////console.log(`TroopManager: 当前行军路径队列: ${JSON.stringify(this._marchingPaths)}`);
        if (!this._mapManager) {
            console.error(`TroopManager: 地图管理器未初始化，无法处理行军队列`);
            return;
        }
        
        // 获取当前行军路径（队列中的第一条）
        const currentPath = this._marchingPaths[0];
        ////console.log(`TroopManager: 处理行军路径 - 玩家ID=${currentPath.playerId}, 当前步骤=${currentPath.currentStep}/${currentPath.pathTiles.length-1}, 兵力=${currentPath.troops}`);
        
        // 检查路径是否完整
        if (!currentPath.pathTiles || currentPath.pathTiles.length <= 1) {
            console.error("TroopManager: 行军路径不完整或没有足够的点，移除此路径");
            
            // 当移除路径时，减少玩家的行军路线计数
            if (this._playerManager) {
                const player = this._playerManager.getPlayerById(currentPath.playerId);
                if (player) {
                    player.activePathCount = Math.max(0, player.activePathCount - 1);
                    ////console.log(`TroopManager: 玩家${currentPath.playerId}的行军路线数减少到 ${player.activePathCount}`);
                }
            }
            
            this._marchingPaths.shift();
            return;
        }
        
        // 获取当前步骤的from节点（当前位置）
        const fromPos = currentPath.pathTiles[currentPath.currentStep];
        ////console.log(`TroopManager: 当前位置是 [${fromPos.x},${fromPos.y}]`);
        
        // 获取当前步骤的to节点（下一个目标位置）
        const nextStep = currentPath.currentStep + 1;
        
        // 如果已经到达最后一步，完成行军
        if (nextStep >= currentPath.pathTiles.length) {
            ////console.log(`TroopManager: 行军路径已完成，从队列中移除, 总步数: ${currentPath.pathTiles.length-1}`);
            
            // 当移除路径时，减少玩家的行军路线计数
            if (this._playerManager) {
                const player = this._playerManager.getPlayerById(currentPath.playerId);
                if (player) {
                    player.activePathCount = Math.max(0, player.activePathCount - 1);
                    ////console.log(`TroopManager: 玩家${currentPath.playerId}的行军路径已完成，行军路线数减少到 ${player.activePathCount}`);
                }
            }
            
            this._marchingPaths.shift();
            ////console.log(`TroopManager: 行军路径队列长度: ${this._marchingPaths.length}`);
            
            // 触发行军状态更新事件
            this.node.emit('marching-status-updated');
            // 也向场景发送事件，确保LocalGameController能够接收到
            const scene = director.getScene();
            if (scene) {
                scene.emit('marching-status-updated');
            }
            
            return;
        }
        
        // 获取下一步位置
        const toPos = currentPath.pathTiles[nextStep];
        ////console.log(`TroopManager: 下一个目标点是 [${toPos.x},${toPos.y}]`);
        
        // 计算两点间的曼哈顿距离
        const distance = Math.abs(fromPos.x - toPos.x) + Math.abs(fromPos.y - toPos.y);
        ////console.log(`TroopManager: 当前步骤的曼哈顿距离为 ${distance}`);
        
        // 获取from和to节点的格子对象
        const fromTile = this._mapManager.getTile(fromPos.x, fromPos.y);
        const toTile = this._mapManager.getTile(toPos.x, toPos.y);
        
        if (!fromTile || !toTile) {
            console.error(`TroopManager: 格子不存在，跳过此步骤, fromTile=${!!fromTile}, toTile=${!!toTile}`);
            currentPath.currentStep++; // 增加步骤
            return;
        }
        if (fromTile.ownerId !== currentPath.playerId) {
            console.error(`TroopManager: 起点格子不属于当前玩家，中止该路线, fromTile=${!!fromTile}, toTile=${!!toTile}`);
            
            // 当移除路径时，减少玩家的行军路线计数
            if (this._playerManager) {
                const player = this._playerManager.getPlayerById(currentPath.playerId);
                if (player) {
                    player.activePathCount = Math.max(0, player.activePathCount - 1);
                    ////console.log(`TroopManager: 玩家${currentPath.playerId}的行军路线因起点问题被取消，行军路线数减少到 ${player.activePathCount}`);
                }
            }
            
            this._marchingPaths.shift(); // 移除当前路径
            ////console.log(`TroopManager: 行军路径队列长度: ${this._marchingPaths.length}`)
            return;
        }
        
        // 显示当前两个格子的状态
        ////console.log(`TroopManager: 处理行军：从 [${fromPos.x},${fromPos.y}] 到 [${toPos.x},${toPos.y}]`);
        ////console.log(`起点格子状态: 所有者=${fromTile.ownerId}, 兵力=${fromTile.troops}`);
        ////console.log(`终点格子状态: 所有者=${toTile.ownerId}, 兵力=${toTile.troops}`);

        const availableTroops = Math.max(0, fromTile.troops - 1);
        
        if (availableTroops > 0) {
            // 移动到目标格子
            // 检查目标格子所有权
            if (toTile.ownerId === currentPath.playerId) {
                // 如果目标格子是己方的，增加兵力
                ////console.log(`TroopManager: 目标是己方格子，增加兵力 ${availableTroops}`);
                toTile.troops += availableTroops;
                ////console.log(`TroopManager: 目标格子兵力更新为 ${toTile.troops}`);
            } else if (toTile.ownerId === -1 || toTile.troops === 0) {
                // 如果目标格子是无主的或没有兵力，占领它
                ////console.log(`TroopManager: 目标是无主格子或无兵力格子，占领它，设置兵力 ${availableTroops}`);
                toTile.ownerId = currentPath.playerId;
                toTile.troops = availableTroops;
                ////console.log(`TroopManager: 目标格子已被占领，所有者更新为 ${toTile.ownerId}, 兵力为 ${toTile.troops}`);
            } else {
                // 如果目标格子是敌方的，计算战斗结果
                ////console.log(`TroopManager: 目标是敌方格子，发生战斗, 攻击方兵力=${availableTroops}, 防守方兵力=${toTile.troops}`);
                this.resolveCombat(currentPath.playerId, toPos.x, toPos.y, availableTroops);
            }
            // 从源格子减少兵力
            fromTile.troops -= availableTroops;
            ////console.log(`TroopManager: 从起始格子 [${fromPos.x},${fromPos.y}] 减少 ${availableTroops} 兵力, 剩余: ${fromTile.troops}`);
        }
        
        // 前进到下一步
        currentPath.currentStep++;
        ////console.log(`TroopManager: 行军前进到下一步, 新的当前步骤=${currentPath.currentStep}/${currentPath.pathTiles.length-1}`);
        
        // 检查是否已经到达最后一步
        if (currentPath.currentStep >= currentPath.pathTiles.length - 1) {
            ////console.log(`TroopManager: 行军路径已完成所有步骤，从队列中移除`);
            this._marchingPaths.shift(); // 移除当前路径
        }
        
        ////console.log(`----- TroopManager: 行军处理完成 -----`);
    }
    
    /**
     * 解决战斗
     * @param attackerId 攻击者ID
     * @param defenderX 防御者X坐标
     * @param defenderY 防御者Y坐标
     * @param attackingTroops 攻击兵力
     * @returns 战斗结果：正数表示攻击方胜利剩余兵力，负数表示防守方胜利剩余兵力，0表示平局
     */
    resolveCombat(attackerId: number, defenderX: number, defenderY: number, attackingTroops: number): number {
        if (!this._mapManager) return 0;
        
        const targetTile = this._mapManager.getTile(defenderX, defenderY);
        if (!targetTile) return 0;
        
        const defenderId = targetTile.ownerId;
        const defendingTroops = targetTile.troops;
        
        ////console.log(`in TroopManager: 解决战斗 - 攻击方: 玩家${attackerId}, 防守方: 玩家${defenderId}`);
        ////console.log(`攻击兵力: ${attackingTroops}, 防守兵力: ${defendingTroops}`);
        
        // 计算战斗结果
        const result = attackingTroops - defendingTroops;
        
        // 攻击方胜利，更改所有权
        if (result > 0) {
            // 更新地块所有权和兵力
            this._mapManager.updateTileOwnership(defenderX, defenderY, attackerId);
            this._mapManager.updateTileTroops(defenderX, defenderY, result);
            
            ////console.log(`in TroopManager: 攻击方胜利，格子 [${defenderX},${defenderY}] 所有权变为玩家${attackerId}，剩余兵力 ${result}`);
            
            // 特殊地形处理
            if (targetTile.terrainType === TerrainType.POLITICAL_CENTER) {
                // 政治中心占领
                // 增加攻击者政治中心数量
                if (this._playerManager) {
                    const attacker = this._playerManager.getPlayerById(attackerId);
                    if (attacker) {
                        attacker.politicalCenters++;
                        ////console.log(`in TroopManager: 玩家${attackerId}占领了政治中心，现有${attacker.politicalCenters}个政治中心`);
                    }
                    
                    // 减少防守者政治中心数量
                    const defender = this._playerManager.getPlayerById(defenderId);
                    if (defender) {
                        defender.politicalCenters--;
                        ////console.log(`in TroopManager: 玩家${defenderId}失去了政治中心，剩余${defender.politicalCenters}个政治中心`);
                    }
                }
            } else if (targetTile.terrainType === TerrainType.HEADQUARTERS) {
                // 如果占领了对方大本营，对方被击败
                if (defenderId !== -1) {
                    console.log(`【大本营】玩家${attackerId}占领了玩家${defenderId}的大本营`);
                    
                    // 确保更改所有权和兵力
                    this._mapManager.updateTileOwnership(defenderX, defenderY, attackerId);
                    this._mapManager.updateTileTroops(defenderX, defenderY, result);
                    
                    // 检查所有玩家大本营状态并触发胜利条件判断
                    if (this._playerManager) {
                        const winnerId = this._playerManager.checkWinCondition();
                        if (winnerId !== -1) {
                            console.log(`【大本营】大本营占领后检查胜利条件，胜利者ID: ${winnerId}`);
                            this.node.emit('game-over', winnerId);
                        }
                    }
                }
            }
        } 
        // 攻守双方兵力相等，防守方保持所有权，双方兵力归零
        else if (result === 0) {
            this._mapManager.updateTileTroops(defenderX, defenderY, 0);
            ////console.log(`in TroopManager: 战斗平局，双方兵力归零，格子保持原所有权`);
        }
        // 防守方胜利，减少兵力
        else {
            this._mapManager.updateTileTroops(defenderX, defenderY, -result);
            // //console.log(`in TroopManager: 防守方胜利，剩余兵力 ${-result}`);
        }
        
        // 触发战斗结果事件，让UI能及时更新
        this.node.emit('combat-resolved', {
            attackerId,
            defenderId,
            x: defenderX,
            y: defenderY,
            result
        });
        
        // 也向场景发送事件
        const scene = director.getScene();
        if (scene) {
            scene.emit('combat-resolved');
        }
        
        return result;
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
        
        // 打印调试信息
        console.log(`【大本营】玩家${playerId}(${player.name})的大本营被占领，该玩家被击败`);
        
        // 通知玩家被击败事件
        this.node.emit('player-defeated', playerId);
        
        // 检查游戏胜利条件
        const winnerId = this._playerManager.checkWinCondition();
        console.log(`【大本营】检查游戏胜利条件，胜利者ID: ${winnerId}`);
        
        if (winnerId !== -1) {
            console.log(`【大本营】触发游戏结束事件，胜利者: ${winnerId}`);
            this.node.emit('game-over', winnerId);
        } else {
            // 手动检查是否所有AI都被击败（人类玩家ID为1）
            const humanPlayerId = 1;
            const allDefeatedExceptHuman = this._playerManager.getPlayers().every(p => 
                p.id === humanPlayerId || p.defeated
            );
            
            if (allDefeatedExceptHuman) {
                console.log(`【大本营】所有AI玩家都被击败，触发游戏结束事件，胜利者: ${humanPlayerId}`);
                this.node.emit('game-over', humanPlayerId);
            }
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
        // 计算要清除的路径数量
        const pathsToRemove = this._marchingPaths.filter(path => path.playerId === playerId);
        const removedCount = pathsToRemove.length;
        
        if (removedCount > 0) {
            //////console.log(`TroopManager: 清除玩家${playerId}的行军队列，共${removedCount}条`);
            
            // 重置玩家的行军路线计数
            if (this._playerManager) {
                const player = this._playerManager.getPlayerById(playerId);
                if (player) {
                    player.activePathCount = 0;
                    ////console.log(`TroopManager: 重置玩家${playerId}的行军路线计数为0`);
                }
            }
            
            // 过滤掉该玩家的所有行军路径
            this._marchingPaths = this._marchingPaths.filter(path => path.playerId !== playerId);
            ////console.log(`TroopManager: 玩家${playerId}的行军队列已清除，当前队列总长度: ${this._marchingPaths.length}`);
        }
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
     * 快速派遣部队（单击操作）
     * @param fromX 源格子X坐标
     * @param fromY 源格子Y坐标
     * @param toX 目标格子X坐标
     * @param toY 目标格子Y坐标
     * @param troops 想要派遣的兵力
     * @returns 是否成功派遣
     */
    sendTroops(fromX: number, fromY: number, toX: number, toY: number, troops: number): boolean {
        // 直接相邻格子派遣
        if (!this._mapManager || !this._playerManager) {
            console.error("TroopManager: 无法派遣部队：管理器未设置");
            return false;
        }
        
        // 获取源格子和玩家信息
        const sourceTile = this._mapManager.getTile(fromX, fromY);
        if (!sourceTile) {
            console.error(`TroopManager: 派遣失败：源格子[${fromX},${fromY}]不存在`);
            return false;
        }
        
        const player = this._playerManager.getCurrentPlayer();
        if (!player) {
            console.error("TroopManager: 派遣失败：无法获取当前玩家");
            return false;
        }
        
        // 检查格子所有权
        if (sourceTile.ownerId !== player.id) {
            console.error(`TroopManager: 派遣失败：源格子不属于当前玩家，所有者为${sourceTile.ownerId}`);
            return false;
        }
        
        // 确保源格子至少留下1个兵力
        const availableTroops = sourceTile.troops - 1;
        if (availableTroops <= 0) {
            console.error(`TroopManager: 派遣失败：源格子兵力不足，需要至少2个兵力才能派遣，当前兵力：${sourceTile.troops}`);
            return false;
        }
        
        // 调整派遣的兵力数量，不能超过可用兵力
        const actualTroops = Math.min(troops, availableTroops);
        ////console.log(`TroopManager: 将派遣 ${actualTroops} 兵力（原请求：${troops}，源格子可用：${availableTroops}）`);
        
        // 获取目标格子
        const targetTile = this._mapManager.getTile(toX, toY);
        if (!targetTile) {
            console.error(`TroopManager: 派遣失败：目标格子[${toX},${toY}]不存在`);
            return false;
        }
        
        // 从源格子减少兵力
        sourceTile.troops -= actualTroops;
        ////console.log(`TroopManager: 从格子[${fromX},${fromY}]减少${actualTroops}兵力，剩余${sourceTile.troops}`);
        
        // 处理目标格子
        if (targetTile.ownerId === player.id) {
            // 如果目标格子是己方的，增加兵力
            targetTile.troops += actualTroops;
            ////console.log(`TroopManager: 增加格子[${toX},${toY}]兵力${actualTroops}，现在有${targetTile.troops}`);
        } else if (targetTile.ownerId === -1 || targetTile.troops === 0) {
            // 如果目标格子是无主的或没有兵力，占领它
            targetTile.ownerId = player.id;
            targetTile.troops = actualTroops;
            ////console.log(`TroopManager: 占领格子[${toX},${toY}]，设置兵力为${actualTroops}`);
        } else {
            // 如果目标格子是敌方的，计算战斗结果
            ////console.log(`TroopManager: 攻击格子[${toX},${toY}]，攻击兵力：${actualTroops}，防守兵力：${targetTile.troops}`);
            this.resolveCombat(player.id, toX, toY, actualTroops);
        }
        
        return true;
    }
    
    /**
     * 获取指定玩家当前的行军路线数量
     * @param playerId 玩家ID
     * @returns 行军路线数量
     */
    getPlayerActivePathCount(playerId: number): number {
        // 从当前队列中计算玩家的行军路线数量
        const actualCount = this._marchingPaths.filter(path => path.playerId === playerId).length;
        
        // 如果有玩家管理器，确保玩家对象中的计数与实际队列中的数量一致
        if (this._playerManager) {
            const player = this._playerManager.getPlayerById(playerId);
            if (player && player.activePathCount !== actualCount) {
                console.warn(`TroopManager: 玩家${playerId}的行军路线计数(${player.activePathCount})与队列中实际数量(${actualCount})不一致，已同步`);
                player.activePathCount = actualCount;
            }
        }
        
        return actualCount;
    }
    
    /**
     * 同步所有玩家的行军路线计数
     * 确保所有玩家的activePathCount与当前队列中的实际路径数量一致
     */
    syncAllPlayerPathCounts(): void {
        if (!this._playerManager) {
            console.warn("TroopManager: 同步行军路线计数失败，玩家管理器未初始化");
            return;
        }
        
        // 获取所有玩家
        const players = this._playerManager.getPlayers();
        
        // 统计当前队列中每个玩家的路径数量
        const pathCounts: {[playerId: number]: number} = {};
        this._marchingPaths.forEach(path => {
            if (!pathCounts[path.playerId]) {
                pathCounts[path.playerId] = 0;
            }
            pathCounts[path.playerId]++;
        });
        
        // 更新每个玩家的计数
        players.forEach(player => {
            const actualCount = pathCounts[player.id] || 0;
            if (player.activePathCount !== actualCount) {
                ////console.log(`TroopManager: 同步玩家${player.id}的行军路线计数，从${player.activePathCount}更新为${actualCount}`);
                player.activePathCount = actualCount;
            }
        });
        
        ////console.log("TroopManager: 所有玩家的行军路线计数已同步");
    }
} 