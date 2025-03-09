import { _decorator, Component, Node, Vec2 } from 'cc';
import { MapManager } from './MapManager';
import { PlayerManager } from './PlayerManager';
import { TroopManager } from './TroopManager';
import { Player } from '../models/Player';
import { TerrainType } from '../models/MapData';
import { LocalGameController } from '../LocalGameController';

const { ccclass, property } = _decorator;

/**
 * AI管理器
 * 负责管理AI玩家的决策逻辑
 */
@ccclass('AIManager')
export class AIManager extends Component {
    @property
    maxAIPathLimit: number = 3; // AI玩家在队列中的最大行军路径数量限制
    
    // 引用其他管理器
    private _mapManager: MapManager | null = null;
    private _playerManager: PlayerManager | null = null;
    private _troopManager: TroopManager | null = null;
    private _gameController: LocalGameController | null = null;
    
    /**
     * 设置管理器引用
     */
    setManagers(mapManager: MapManager, playerManager: PlayerManager, troopManager: TroopManager): void {
        this._mapManager = mapManager;
        this._playerManager = playerManager;
        this._troopManager = troopManager;
        
        // 监听AI行动请求
        this.node.on('ai-action-requested', this.handleAIAction, this);
    }
    
    /**
     * 实时处理AI逻辑
     * 根据时间增量更新AI决策
     * @param deltaTime 时间增量（秒）
     */
    processAILogic(deltaTime: number): void {
        if (!this._mapManager || !this._playerManager || !this._troopManager) {
            console.warn("AIManager: processAILogic - 管理器未初始化，无法处理AI逻辑");
            return;
        }
        
        // 获取所有AI玩家
        const aiPlayers = this._playerManager.getPlayers().filter(player => player.isAI && !player.defeated);
        //console.log(`AIManager: 处理AI逻辑 - 找到 ${aiPlayers.length} 个AI玩家，deltaTime=${deltaTime.toFixed(3)}`);
        
        if (aiPlayers.length === 0) {
            // console.log("AIManager: 没有活跃的AI玩家");
            return;
        }
        
        // 更新每个AI玩家的决策计时器
        aiPlayers.forEach(aiPlayer => {
            // 确保AI决策计时器已初始化
            if (aiPlayer.decisionTimer === undefined || aiPlayer.decisionTimer === null) {
                aiPlayer.decisionTimer = this._getDecisionInterval(aiPlayer.aiLevel || 1);
                //console.log(`AIManager: 初始化AI玩家 ${aiPlayer.id} 的决策计时器为 ${aiPlayer.decisionTimer.toFixed(2)}秒`);
            }
            
            // 更新决策计时器
            const oldTimer = aiPlayer.decisionTimer;
            aiPlayer.decisionTimer -= deltaTime;
            
            // 当计时器归零时，执行AI决策
            if (aiPlayer.decisionTimer <= 0) {
                //console.log(`AIManager: AI玩家 ${aiPlayer.id} (${aiPlayer.name}) 准备执行决策`);
                
                // 重置计时器
                aiPlayer.decisionTimer = this._getDecisionInterval(aiPlayer.aiLevel || 1);
                ////console.log(`AIManager: 重置AI玩家 ${aiPlayer.id} 的决策计时器为 ${aiPlayer.decisionTimer.toFixed(2)}秒`);
                
                // 执行AI行动
                this.handleAIAction(aiPlayer);
            }
        });
    }
    
    /**
     * 获取基于AI难度的决策间隔时间
     * @param aiLevel AI难度等级
     * @returns 决策间隔时间（秒）
     */
    private _getDecisionInterval(aiLevel: number): number {
        let interval: number;
        switch (aiLevel) {
            case 1: // 简单 - 较长决策间隔（3-5秒）
                interval = 3 + Math.random() * 2;
                break;
            case 2: // 中等 - 中等决策间隔（2-3秒）
                interval = 2 + Math.random();
                break;
            case 3: // 困难 - 较短决策间隔（1-2秒）
                interval = 1 + Math.random();
                break;
            default:
                interval = 3;
                break;
        }
        //console.log(`AIManager: AI难度${aiLevel}的决策间隔为${interval.toFixed(2)}秒`);
        return interval;
    }
    
    /**
     * 处理AI行动
     */
    handleAIAction(aiPlayer: Player): void {
        if (!this._mapManager || !this._playerManager || !this._troopManager) {
            console.error("AIManager: handleAIAction - 管理器未初始化，无法执行AI行动");
            return;
        }
        
        //console.log(`========== AIManager: 执行AI玩家 ${aiPlayer.id} (${aiPlayer.name}) 行动 ==========`);
        //console.log(`AI难度等级: ${aiPlayer.aiLevel || 1}, 拥有地块数: ${aiPlayer.ownedTiles.length}`);
        
        // 检查AI当前在队列中的行军路径数量
        const currentPathCount = this._troopManager.getPlayerActivePathCount(aiPlayer.id);
        //console.log(`AIManager: AI玩家 ${aiPlayer.id} 当前有 ${currentPathCount} 条行军路径在队列中`);
        
        // 如果AI已有的行军路径数量超过限制，暂时跳过决策
        if (currentPathCount >= this.maxAIPathLimit) {
            //console.log(`AIManager: AI玩家 ${aiPlayer.id} 行军路径数已达上限(${currentPathCount}/${this.maxAIPathLimit})，暂停决策`);
            return;
        }
        
        // 如果AI没有地块，则跳过
        if (aiPlayer.ownedTiles.length === 0) {
            console.warn(`AIManager: AI玩家 ${aiPlayer.id} 没有地块，跳过行动`);
            return;
        }
        
        // 根据AI难度级别执行不同策略
        try {
            switch (aiPlayer.aiLevel) {
                case 1: // 简单
                    //console.log(`AIManager: 执行简单AI策略 (玩家${aiPlayer.id})`);
                    this.executeEasyAIStrategy(aiPlayer);
                    break;
                case 2: // 中等
                    //console.log(`AIManager: 执行中等AI策略 (玩家${aiPlayer.id})`);
                    this.executeMediumAIStrategy(aiPlayer);
                    break;
                case 3: // 困难
                    //console.log(`AIManager: 执行困难AI策略 (玩家${aiPlayer.id})`);
                    this.executeHardAIStrategy(aiPlayer);
                    break;
                default:
                    //console.log(`AIManager: 执行默认(简单)AI策略 (玩家${aiPlayer.id})`);
                    this.executeEasyAIStrategy(aiPlayer);
                    break;
            }
            //console.log(`AIManager: AI玩家 ${aiPlayer.id} 行动执行完成`);
        } catch (error) {
            console.error(`AIManager: 执行AI行动时发生错误:`, error);
        }
    }
    
    /**
     * 执行简单AI策略
     * 简单AI: 防守型，兵力分散，随机选择目标
     */
    private executeEasyAIStrategy(aiPlayer: Player): void {
        if (!this._mapManager || !this._playerManager || !this._troopManager) {
            console.error("AIManager: executeEasyAIStrategy - 管理器未初始化");
            return;
        }
        
        //console.log(`AIManager: 执行简单AI策略 - 玩家${aiPlayer.id}(${aiPlayer.name})`);
        
        // 获取AI拥有的所有格子
        const ownedTiles = aiPlayer.ownedTiles;
        //console.log(`AIManager: 玩家${aiPlayer.id}拥有${ownedTiles.length}块地`);
        
        // 记录派遣次数和当前路径数量
        let dispatchCount = 0;
        const currentPathCount = this._troopManager.getPlayerActivePathCount(aiPlayer.id);
        const remainingPathSlots = this.maxAIPathLimit - currentPathCount;
        

        // 如果已经达到上限，直接返回
        if (remainingPathSlots <= 0) {
            //console.log(`AIManager: 已达到路径数量上限，跳过派遣`);
            return;
        }
        
        // 按照随机顺序遍历拥有的格子
        const shuffledTiles = this.shuffleArray([...ownedTiles]);
        //console.log(`AIManager: 已随机打乱${shuffledTiles.length}块地准备检查`);
        
        shuffledTiles.forEach((tilePos, index) => {
            // 如果已经派遣达到剩余槽位数量，停止
            if (dispatchCount >= remainingPathSlots) {
                //console.log(`AIManager: 已达到剩余可派遣次数(${remainingPathSlots})，停止派遣`);
                return;
            }
            
            // 如果已经派遣了3次，停止
            if (dispatchCount >= 3) {
                //console.log(`AIManager: 已达到简单AI最大派遣次数(3)，停止派遣`);
                return;
            }
            
            const tile = this._mapManager!.getTile(tilePos.x, tilePos.y);
            // 这是起始点tile
            if (!tile) {
                console.warn(`AIManager: 无法获取格子 [${tilePos.x},${tilePos.y}]`);
                return;
            }
            
            if (tile.ownerId !== aiPlayer.id) {
                console.warn(`AIManager: 格子 [${tilePos.x},${tilePos.y}] 不属于AI玩家${aiPlayer.id}，实际所有者: ${tile.ownerId}`);
                return;
            }
            
            // 记录检查的格子信息
            //console.log(`AIManager: 检查格子 [${tilePos.x},${tilePos.y}], 序号: ${index+1}/${shuffledTiles.length}, 当前兵力: ${tile.troops}`);
            
            // 只为拥有至少2个兵力的格子创建行军路径
            if (tile.troops < 2) {
                //console.log(`AIManager: 格子 [${tilePos.x},${tilePos.y}] 兵力不足，跳过 (${tile.troops} < 2)`);
                return;
            }
            
            // 计算可分配的兵力
            const troops = Math.max(0, tile.troops - 1);
            if (troops < 1) {
                //console.log(`AIManager: 格子 [${tilePos.x},${tilePos.y}] 可派遣兵力不足，跳过 (${troops} < 1)`);
                return;
            }
            
            // 获取周围一圈的格子
            const surroundingTiles = this.getSurroundingTiles(tilePos, 1);
            //console.log(`AIManager: 格子 [${tilePos.x},${tilePos.y}] 周围有 ${surroundingTiles.length} 个相邻格子`);
            
            if (surroundingTiles.length === 0) {
                //console.log(`AIManager: 格子 [${tilePos.x},${tilePos.y}] 周围没有可用格子，跳过`);
                return;
            }
            
            // 随机选择一个周围的格子
            const targetTiles = this.shuffleArray([...surroundingTiles]).slice(0, 1);
            // 这是目标点tile
            if (targetTiles.length === 0) {
                //console.log(`AIManager: 无法选择目标格子，跳过`);
                return;
            }
            
            const targetPos = targetTiles[0];
            //console.log(`AIManager: 选择目标格子 [${targetPos.x},${targetPos.y}]`);
            
            const targetTile = this._mapManager.getTile(targetPos.x, targetPos.y);
            if (targetTile) {
                //console.log(`AIManager: 目标格子状态 - 所有者: ${targetTile.ownerId}, 兵力: ${targetTile.troops}`);
            }
            
            // 尝试创建行军路径
            //console.log(`AIManager: 尝试从 [${tilePos.x},${tilePos.y}] 派遣 ${troops} 兵力到 [${targetPos.x},${targetPos.y}]`);
            const sourceTile = tilePos;
            // 调用最短路径算法计算目标点
            const targetTilesList = this._gameController ? 
                this._gameController.calculatePathBetweenPoints(sourceTile, targetPos) :
                this.findPathToTarget(sourceTile, targetPos);
            try {
                // 创建行军路径
                const success = this._troopManager!.createMarchingPath(
                    aiPlayer.id,
                    sourceTile,
                    targetTilesList,
                    troops
                );
                
                if (success) {
                    //console.log(`AIManager: 成功创建行军路径! 从 [${tilePos.x},${tilePos.y}] 到 [${targetPos.x},${targetPos.y}], 兵力: ${troops}`);
                    dispatchCount++;
                } else {
                    console.warn(`AIManager: 创建行军路径失败`);
                }
            } catch (error) {
                console.error(`AIManager: 创建行军路径时发生错误:`, error);
            }
        });
        
        //console.log(`AIManager: 玩家${aiPlayer.id}的简单AI策略执行完成，共派遣${dispatchCount}次`);
    }
    
    /**
     * 执行中等AI策略
     * 中等AI: 均衡型，有一定的扩张性，优先攻击弱点
     */
    private executeMediumAIStrategy(aiPlayer: Player): void {
        if (!this._mapManager || !this._playerManager || !this._troopManager) return;
        
        //console.log(`AIManager: 执行中等AI策略 - 玩家${aiPlayer.id}`);
        
        // 获取AI拥有的所有格子
        const ownedTiles = aiPlayer.ownedTiles;
        //console.log(`AIManager: 玩家${aiPlayer.id}拥有${ownedTiles.length}块地`);
        
        // 记录派遣次数和当前路径数量
        let dispatchCount = 0;
        const currentPathCount = this._troopManager.getPlayerActivePathCount(aiPlayer.id);
        const remainingPathSlots = this.maxAIPathLimit - currentPathCount;
        
        //console.log(`AIManager: 当前路径数${currentPathCount}，最大限制${this.maxAIPathLimit}，剩余可派遣次数${remainingPathSlots}`);
        
        // 如果已经达到上限，直接返回
        if (remainingPathSlots <= 0) {
            //console.log(`AIManager: 已达到路径数量上限，跳过派遣`);
            return;
        }
        
        // 计算AI总兵力和平均兵力
        let totalTroops = 0;
        ownedTiles.forEach(tilePos => {
            const tile = this._mapManager!.getTile(tilePos.x, tilePos.y);
            if (tile && tile.ownerId === aiPlayer.id) {
                totalTroops += tile.troops;
            }
        });
        
        const avgTroops = totalTroops / Math.max(1, ownedTiles.length);
        
        // 按照随机顺序遍历拥有的格子
        this.shuffleArray(ownedTiles).forEach(tilePos => {
            // 如果已经派遣达到剩余槽位数量，停止
            if (dispatchCount >= remainingPathSlots) {
                //console.log(`AIManager: 已达到剩余可派遣次数(${remainingPathSlots})，停止派遣`);
                return;
            }
            
            // 中等AI最多派遣5条路径
            if (dispatchCount >= 5) {
                //console.log(`AIManager: 已达到中等AI最大派遣次数(5)，停止派遣`);
                return;
            }
            
            const tile = this._mapManager!.getTile(tilePos.x, tilePos.y);
            // 这是起始点tile
            if (!tile || tile.ownerId !== aiPlayer.id) return;
            
            // 只为拥有超过平均兵力的格子创建行军路径
            if (tile.troops <= avgTroops) return;
            
            // 计算可分配的兵力（保留1/3守备）
            const troops = Math.floor(tile.troops * 2 / 3);
            if (troops < 1) return;
            
            // 获取周围两圈的格子
            const surroundingTiles = this.getSurroundingTiles(tilePos, 2);
            
            // 按照优先级排序目标格子
            const prioritizedTargets = this.prioritizeTargets(surroundingTiles, aiPlayer.id, 'MEDIUM');
            
            // 选择最多3个目标
            const targetTiles = prioritizedTargets.slice(0, 3);
            if (targetTiles.length === 0) return;
            const targetPos = targetTiles[0];
            // 这是目标点tile
            if (targetTiles.length === 0) {
                //console.log(`AIManager: 无法选择目标格子，跳过`);
                return;
            }  
            const sourceTile = tilePos;
            
            // 调用最短路径算法计算目标点
            const targetTilesList = this._gameController ? 
                this._gameController.calculatePathBetweenPoints(sourceTile, targetPos) :
                this.findPathToTarget(sourceTile, targetPos);
            
            
            
            
            // 创建行军路径
            this._troopManager!.createMarchingPath(
                aiPlayer.id,
                tilePos,
                targetTilesList,
                troops
            );
            console.log(`AIManager: 成功创建行军路径! 路径内容: ${targetTilesList}`);
            
            // 增加派遣计数
            dispatchCount++;
        });
    }
    
    /**
     * 执行困难AI策略
     * 困难AI: 攻击型，优先抢占政治中心和人口重镇
     */
    private executeHardAIStrategy(aiPlayer: Player): void {
        if (!this._mapManager || !this._playerManager || !this._troopManager) return;
        
        //console.log(`AIManager: 执行困难AI策略 - 玩家${aiPlayer.id}`);
        
        // 获取AI拥有的所有格子
        const ownedTiles = aiPlayer.ownedTiles;
        //console.log(`AIManager: 玩家${aiPlayer.id}拥有${ownedTiles.length}块地`);
        
        // 记录派遣次数和当前路径数量
        let dispatchCount = 0;
        const currentPathCount = this._troopManager.getPlayerActivePathCount(aiPlayer.id);
        const remainingPathSlots = this.maxAIPathLimit - currentPathCount;
        
        //console.log(`AIManager: 当前路径数${currentPathCount}，最大限制${this.maxAIPathLimit}，剩余可派遣次数${remainingPathSlots}`);
        
        // 如果已经达到上限，直接返回
        if (remainingPathSlots <= 0) {
            //console.log(`AIManager: 已达到路径数量上限，跳过派遣`);
            return;
        }
        
        // 寻找敌人的政治中心和人口重镇
        const strategicTargets = this.findStrategicTargets(aiPlayer.id);
        
        // 按照兵力多少排序拥有的格子（兵力多的优先）
        const sortedTiles = [...ownedTiles].sort((a, b) => {
            const tileA = this._mapManager!.getTile(a.x, a.y);
            const tileB = this._mapManager!.getTile(b.x, b.y);
            return tileB?.troops || 0 - (tileA?.troops || 0);
        });
        
        // 处理每个拥有的格子
        sortedTiles.forEach(tilePos => {
            // 如果已经派遣达到剩余槽位数量，停止
            if (dispatchCount >= remainingPathSlots) {
                //console.log(`AIManager: 已达到剩余可派遣次数(${remainingPathSlots})，停止派遣`);
                return;
            }
            
            // 困难AI最多派遣8条路径
            if (dispatchCount >= 8) {
                //console.log(`AIManager: 已达到困难AI最大派遣次数(8)，停止派遣`);
                return;
            }
            
            const tile = this._mapManager!.getTile(tilePos.x, tilePos.y);
            if (!tile || tile.ownerId !== aiPlayer.id) return;
            
            // 需要至少2个兵力
            if (tile.troops < 2) return;
            
            // 计算可分配的兵力（高级AI会更激进，只保留20%守备）
            const troops = Math.floor(tile.troops * 0.8);
            if (troops < 1) return;
            
            // 获取周围三圈的格子
            const surroundingTiles = this.getSurroundingTiles(tilePos, 3);
            
            // 找出通往战略目标的最佳路径
            let targetTiles: Vec2[] = [];
            
            if (strategicTargets.length > 0) {
                // 尝试找到通往最近战略目标的路径
                const closestTarget = this.findClosestTarget(tilePos, strategicTargets);
                if (closestTarget) {
                    // 寻找到目标的路径
                    const path = this.findPathToTarget(tilePos, closestTarget);
                    if (path.length > 0) {
                        targetTiles = path.slice(0, 6); // 限制路径长度
                    }
                }
            }
            
            // 如果没有找到战略目标路径，使用常规策略
            if (targetTiles.length === 0) {
                // 按照优先级排序目标格子
                const prioritizedTargets = this.prioritizeTargets(surroundingTiles, aiPlayer.id, 'HARD');
                targetTiles = prioritizedTargets.slice(0, 5);
            }
            
            if (targetTiles.length === 0) return;
            const sourceTile = tilePos;
            const targetPos = targetTiles[0];
            // 调用最短路径算法计算目标点
            const targetTilesList = this._gameController ? 
                this._gameController.calculatePathBetweenPoints(sourceTile, targetPos) :
                this.findPathToTarget(sourceTile, targetPos);
            
            // 创建行军路径
            this._troopManager!.createMarchingPath(
                aiPlayer.id,
                tilePos,
                targetTilesList,
                troops
            );
            
            // 增加派遣计数
            dispatchCount++;
        });
    }
    
    /**
     * 获取周围格子
     */
    private getSurroundingTiles(center: Vec2, radius: number): Vec2[] {
        if (!this._mapManager) return [];
        
        const surroundingTiles: Vec2[] = [];
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx === 0 && dy === 0) continue; // 排除中心格子
                
                const x = center.x + dx;
                const y = center.y + dy;
                
                // 检查格子是否在地图范围内
                if (this._mapManager.isValidPosition(x, y)) {
                    surroundingTiles.push(new Vec2(x, y));
                }
            }
        }
        
        return surroundingTiles;
    }
    
    /**
     * 按照优先级排序目标格子
     */
    private prioritizeTargets(tiles: Vec2[], playerId: number, difficulty: string): Vec2[] {
        if (!this._mapManager || !this._playerManager) return [];
        
        // 根据不同的条件评分
        const scoredTiles = tiles.map(tilePos => {
            const tile = this._mapManager!.getTile(tilePos.x, tilePos.y);
            if (!tile) return { pos: tilePos, score: -1000 }; // 无效格子
            
            let score = 0;
            
            // 已拥有的格子得分较低（除非是为了援军）
            if (tile.ownerId === playerId) {
                score = tile.troops < 3 ? 20 : -50;
            } 
            // 敌方格子得分
            else if (tile.ownerId !== -1) {
                // 攻击弱者
                score = 50 - tile.troops * 10;
                
                // 政治中心优先级
                if (tile.terrainType === TerrainType.POLITICAL_CENTER) {
                    score += 200;
                } 
                // 人口重镇优先级
                else if (tile.terrainType === TerrainType.POPULATION_CENTER) {
                    score += 100;
                }
                // 大本营最高优先级
                else if (tile.terrainType === TerrainType.HEADQUARTERS) {
                    score += 300;
                }
            } 
            // 无主格子得分
            else {
                score = 30;
                
                // 政治中心优先级
                if (tile.terrainType === TerrainType.POLITICAL_CENTER) {
                    score += 100;
                } 
                // 人口重镇优先级
                else if (tile.terrainType === TerrainType.POPULATION_CENTER) {
                    score += 50;
                }
            }
            
            // 根据AI难度调整得分
            if (difficulty === 'HARD') {
                // 困难AI更激进，更重视战略点
                if (tile.terrainType === TerrainType.POLITICAL_CENTER) {
                    score *= 1.5;
                }
            } else if (difficulty === 'EASY') {
                // 简单AI更随机，降低战略点权重
                if (tile.ownerId !== playerId) {
                    score += Math.random() * 50 - 25;
                }
            }
            
            return { pos: tilePos, score };
        });
        
        // 过滤掉无效格子，并按得分降序排序
        return scoredTiles
            .filter(item => item.score > -1000)
            .sort((a, b) => b.score - a.score)
            .map(item => item.pos);
    }
    
    /**
     * 查找战略目标（政治中心和人口重镇）
     */
    private findStrategicTargets(playerId: number): Vec2[] {
        if (!this._mapManager) return [];
        
        const targets: Vec2[] = [];
        const mapSize = this._mapManager.getMapSize();
        
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this._mapManager.getTile(x, y);
                if (!tile) continue;
                
                // 排除自己的格子
                if (tile.ownerId === playerId) continue;
                
                // 寻找政治中心和人口重镇
                if (tile.terrainType === TerrainType.POLITICAL_CENTER || 
                    tile.terrainType === TerrainType.POPULATION_CENTER ||
                    tile.terrainType === TerrainType.HEADQUARTERS) {
                    targets.push(new Vec2(x, y));
                }
            }
        }
        
        return targets;
    }
    
    /**
     * 查找最近的目标
     */
    private findClosestTarget(source: Vec2, targets: Vec2[]): Vec2 | null {
        if (targets.length === 0) return null;
        
        let closestTarget = targets[0];
        let minDistance = this.calculateDistance(source, targets[0]);
        
        for (let i = 1; i < targets.length; i++) {
            const distance = this.calculateDistance(source, targets[i]);
            if (distance < minDistance) {
                minDistance = distance;
                closestTarget = targets[i];
            }
        }
        
        return closestTarget;
    }
    
    /**
     * 计算两点间的曼哈顿距离
     */
    private calculateDistance(a: Vec2, b: Vec2): number {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }
    
    /**
     * 找到通往目标的路径（使用LocalGameController中的寻路算法）
     */
    private findPathToTarget(source: Vec2, target: Vec2): Vec2[] {
        //console.log(`AI寻路: 寻找从 [${source.x},${source.y}] 到 [${target.x},${target.y}] 的路径`);
        
        // 检查目标是否为不可到达的地形
        if (this._mapManager) {
            const targetTile = this._mapManager.getTile(target.x, target.y);
            if (targetTile && (targetTile.terrainType === TerrainType.MOUNTAIN || 
                              targetTile.terrainType === TerrainType.LAKE)) {
                //console.log(`AI寻路: 目标 [${target.x},${target.y}] 是不可到达的地形，取消寻路`);
                return []; // 返回空路径
            }
        }
        
        // 获取LocalGameController实例来使用其寻路算法
        const scene = this.node.parent;
        if (!scene) {
            console.error("AI寻路: 无法获取场景引用");
            return this.findPathToTargetFallback(source, target); // 使用备用算法
        }
        
        // 尝试获取LocalGameController组件，使用any类型避免TypeScript错误
        const localGameController = scene.getComponent('LocalGameController') as any;
        if (!localGameController) {
            console.warn("AI寻路: 无法获取LocalGameController引用，采用备用算法");
            return this.findPathToTargetFallback(source, target); // 使用备用算法
        }
        
        // 调用LocalGameController的公共路径计算方法
        if (typeof localGameController.calculatePathBetweenPoints === 'function') {
            try {
                const path = localGameController.calculatePathBetweenPoints(source, target);
                //console.log(`AI寻路: 使用LocalGameController的算法找到路径，长度: ${path.length}`);
                
                // 移除起点，因为在创建行军路径时会添加
                if (path.length > 1) {
                    const pathWithoutStart = path.slice(1);
                    return pathWithoutStart;
                }
                return [];
            } catch (error) {
                console.error("AI寻路: 使用LocalGameController的算法计算路径失败:", error);
                return this.findPathToTargetFallback(source, target); // 使用备用算法
            }
        } else {
            console.error("AI寻路: LocalGameController中找不到calculatePathBetweenPoints方法");
            return this.findPathToTargetFallback(source, target); // 使用备用算法
        }
    }
    
    /**
     * 备用寻路算法（简单实现，在无法使用主算法时使用）
     */
    private findPathToTargetFallback(source: Vec2, target: Vec2): Vec2[] {
        if (!this._mapManager) return [];
        
        const mapSize = this._mapManager.getMapSize();
        
        // 创建距离和前驱节点映射
        const distances: Map<string, number> = new Map();
        const previous: Map<string, Vec2 | null> = new Map();
        const visited: Set<string> = new Set();
        
        // 优先队列（简化实现）
        const queue: {pos: Vec2, dist: number}[] = [];
        
        // 坐标转换为字符串键
        const posToKey = (pos: Vec2): string => `${pos.x},${pos.y}`;
        
        // 初始化
        const sourceKey = posToKey(source);
        distances.set(sourceKey, 0);
        previous.set(sourceKey, null);
        queue.push({pos: source, dist: 0});
        
        // 4个方向移动：上、右、下、左
        const directions = [{x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}];
        
        // Dijkstra算法主循环
        while (queue.length > 0) {
            // 找出距离最小的节点
            queue.sort((a, b) => a.dist - b.dist);
            const current = queue.shift()!;
            const currentKey = posToKey(current.pos);
            
            // 如果已访问，跳过
            if (visited.has(currentKey)) continue;
            visited.add(currentKey);
            
            // 到达目标
            if (current.pos.x === target.x && current.pos.y === target.y) {
                break;
            }
            
            // 检查所有相邻节点
            for (const dir of directions) {
                const nextX = current.pos.x + dir.x;
                const nextY = current.pos.y + dir.y;
                
                // 检查边界
                if (nextX < 0 || nextX >= mapSize.width || nextY < 0 || nextY >= mapSize.height) {
                    continue;
                }
                
                // 检查地形可通行性
                const tile = this._mapManager.getTile(nextX, nextY);
                if (!tile || tile.terrainType === TerrainType.MOUNTAIN || tile.terrainType === TerrainType.LAKE) {
                    continue;
                }
                
                const nextPos = new Vec2(nextX, nextY);
                const nextKey = posToKey(nextPos);
                
                // 计算新距离
                const newDist = (distances.get(currentKey) || Infinity) + 1;
                
                // 如果找到更短路径
                if (!distances.has(nextKey) || newDist < (distances.get(nextKey) || Infinity)) {
                    distances.set(nextKey, newDist);
                    previous.set(nextKey, current.pos);
                    queue.push({pos: nextPos, dist: newDist});
                }
            }
        }
        
        // 构建路径
        const path: Vec2[] = [];
        let current: Vec2 | null = target;
        
        // 如果没有找到路径
        if (!previous.has(posToKey(target))) {
            return [];
        }
        
        // 从目标回溯到起点
        while (current && (current.x !== source.x || current.y !== source.y)) {
            path.unshift(current.clone());
            current = previous.get(posToKey(current)) || null;
        }
        
        return path;
    }
    
    /**
     * 数组随机排序（Fisher-Yates洗牌算法）
     */
    private shuffleArray<T>(array: T[]): T[] {
        const newArray = [...array];
        
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        
        return newArray;
    }

    /**
     * 设置地图管理器引用
     */
    setMapManager(mapManager: MapManager): void {
        this._mapManager = mapManager;
    }

    /**
     * 设置玩家管理器引用
     */
    setPlayerManager(playerManager: PlayerManager): void {
        this._playerManager = playerManager;
    }

    /**
     * 设置兵力管理器引用
     */
    setTroopManager(troopManager: TroopManager): void {
        this._troopManager = troopManager;
    }
    
    /**
     * 执行AI玩家的回合
     * @param playerId AI玩家ID
     */
    performAITurn(playerId: number): void {
        if (!this._mapManager || !this._playerManager || !this._troopManager) {
            console.error("AI回合执行失败：缺少必要的管理器引用");
            return;
        }
        
        //console.log(`AI玩家 ${playerId} 开始执行回合`);
        
        // 获取AI难度
        const player = this._playerManager.getPlayerById(playerId);
        if (!player || !player.isAI) {
            console.error(`ID为 ${playerId} 的玩家不是AI或不存在`);
            return;
        }
        
        const difficulty = player.aiLevel ? this.getDifficultyString(player.aiLevel) : "normal";
        //console.log(`AI难度: ${difficulty}`);
        
        // 获取AI所有的地块
        const ownedTiles = this.getPlayerOwnedTiles(playerId);
        if (ownedTiles.length === 0) {
            //console.log("AI没有拥有的地块，无法行动");
            return;
        }
        
        //console.log(`AI拥有 ${ownedTiles.length} 个地块`);
        
        // 对每个有足够兵力的地块尝试行动
        let actionCount = 0;
        const maxActions = difficulty === "hard" ? 3 : (difficulty === "medium" ? 2 : 1);
        
        for (const tilePos of ownedTiles) {
            if (actionCount >= maxActions) break;
            
            const tile = this._mapManager.getTile(tilePos.x, tilePos.y);
            if (!tile || tile.troops <= 1) continue;
            
            // 获取相邻的地块
            const adjacentTiles = this._mapManager.getAdjacentTiles(tilePos.x, tilePos.y);
            if (adjacentTiles.length === 0) continue;
            
            // 根据AI难度和策略选择目标
            const targetTiles = this.prioritizeTargets(adjacentTiles, playerId, difficulty);
            if (targetTiles.length === 0) continue;
            
            // 选择最高分的目标
            const targetPos = targetTiles[0];
            const troopsToSend = this.calculateTroopsToSend(tile.troops, difficulty);
            
            //console.log(`AI决定从 [${tilePos.x},${tilePos.y}] 派遣 ${troopsToSend} 兵力到 [${targetPos.x},${targetPos.y}]`);
            
            // 执行调兵行动
            this._troopManager.sendTroops(tilePos.x, tilePos.y, targetPos.x, targetPos.y, troopsToSend);
            actionCount++;
        }
        
        //console.log(`AI玩家 ${playerId} 执行了 ${actionCount} 次行动，回合结束`);
    }
    
    /**
     * 获取玩家拥有的地块
     */
    private getPlayerOwnedTiles(playerId: number): Vec2[] {
        if (!this._mapManager) return [];
        
        const ownedTiles: Vec2[] = [];
        const mapSize = this._mapManager.getMapSize();
        
        for (let y = 0; y < mapSize.height; y++) {
            for (let x = 0; x < mapSize.width; x++) {
                const tile = this._mapManager.getTile(x, y);
                if (tile && tile.ownerId === playerId) {
                    ownedTiles.push(new Vec2(x, y));
                }
            }
        }
        
        return ownedTiles;
    }
    
    /**
     * 根据难度级别返回难度字符串
     */
    private getDifficultyString(level: number): string {
        if (level >= 3) return "hard";
        if (level >= 2) return "medium";
        return "easy";
    }
    
    /**
     * 根据难度计算要派遣的兵力
     */
    private calculateTroopsToSend(totalTroops: number, difficulty: string): number {
        if (difficulty === "hard") {
            // 困难AI会根据情况留下1-2个兵力
            return Math.max(1, totalTroops - Math.floor(Math.random() * 2) - 1);
        } else if (difficulty === "medium") {
            // 中等AI派遣约70%的兵力
            return Math.floor(totalTroops * 0.7);
        } else {
            // 简单AI派遣约50%的兵力
            return Math.floor(totalTroops / 2);
        }
    }

    setGameController(controller: LocalGameController): void {
        this._gameController = controller;
    }
} 