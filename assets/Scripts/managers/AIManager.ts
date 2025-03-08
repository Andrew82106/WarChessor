import { _decorator, Component, Node, Vec2 } from 'cc';
import { MapManager } from './MapManager';
import { PlayerManager } from './PlayerManager';
import { TroopManager } from './TroopManager';
import { Player } from '../models/Player';
import { TerrainType } from '../models/MapData';

const { ccclass, property } = _decorator;

/**
 * AI管理器
 * 负责管理AI玩家的决策逻辑
 */
@ccclass('AIManager')
export class AIManager extends Component {
    // 引用其他管理器
    private _mapManager: MapManager | null = null;
    private _playerManager: PlayerManager | null = null;
    private _troopManager: TroopManager | null = null;
    
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
     * 处理AI行动
     */
    handleAIAction(aiPlayer: Player): void {
        if (!this._mapManager || !this._playerManager || !this._troopManager) return;
        
        // 根据AI难度级别执行不同策略
        switch (aiPlayer.aiLevel) {
            case 1: // 简单
                this.executeEasyAIStrategy(aiPlayer);
                break;
            case 2: // 中等
                this.executeMediumAIStrategy(aiPlayer);
                break;
            case 3: // 困难
                this.executeHardAIStrategy(aiPlayer);
                break;
            default:
                this.executeEasyAIStrategy(aiPlayer);
                break;
        }
    }
    
    /**
     * 执行简单AI策略
     * 简单AI: 防守型，兵力分散，随机选择目标
     */
    private executeEasyAIStrategy(aiPlayer: Player): void {
        if (!this._mapManager || !this._playerManager || !this._troopManager) return;
        
        // 获取AI拥有的所有格子
        const ownedTiles = aiPlayer.ownedTiles;
        
        // 按照随机顺序遍历拥有的格子
        this.shuffleArray(ownedTiles).forEach(tilePos => {
            const tile = this._mapManager!.getTile(tilePos.x, tilePos.y);
            if (!tile || tile.ownerId !== aiPlayer.id) return;
            
            // 只为拥有至少2个兵力的格子创建行军路径
            if (tile.troops < 2) return;
            
            // 计算可分配的兵力（保留一半守备）
            const troops = Math.floor(tile.troops / 2);
            if (troops < 1) return;
            
            // 获取周围一圈的格子
            const surroundingTiles = this.getSurroundingTiles(tilePos, 1);
            
            // 随机选择一个周围的格子
            const targetTiles = this.shuffleArray(surroundingTiles).slice(0, 1);
            if (targetTiles.length === 0) return;
            
            // 创建行军路径
            this._troopManager!.createMarchingPath(
                aiPlayer.id,
                tilePos,
                targetTiles,
                troops
            );
        });
    }
    
    /**
     * 执行中等AI策略
     * 中等AI: 均衡型，有一定的扩张性，优先攻击弱点
     */
    private executeMediumAIStrategy(aiPlayer: Player): void {
        if (!this._mapManager || !this._playerManager || !this._troopManager) return;
        
        // 获取AI拥有的所有格子
        const ownedTiles = aiPlayer.ownedTiles;
        
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
            const tile = this._mapManager!.getTile(tilePos.x, tilePos.y);
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
            
            // 创建行军路径
            this._troopManager!.createMarchingPath(
                aiPlayer.id,
                tilePos,
                targetTiles,
                troops
            );
        });
    }
    
    /**
     * 执行困难AI策略
     * 困难AI: 攻击型，优先抢占政治中心和人口重镇
     */
    private executeHardAIStrategy(aiPlayer: Player): void {
        if (!this._mapManager || !this._playerManager || !this._troopManager) return;
        
        // 获取AI拥有的所有格子
        const ownedTiles = aiPlayer.ownedTiles;
        
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
            
            // 创建行军路径
            this._troopManager!.createMarchingPath(
                aiPlayer.id,
                tilePos,
                targetTiles,
                troops
            );
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
     * 找到通往目标的路径（简单实现，不是最短路径）
     */
    private findPathToTarget(source: Vec2, target: Vec2): Vec2[] {
        // 这里使用简单的直线路径，可以替换为A*等寻路算法
        const path: Vec2[] = [];
        
        // 计算方向向量
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        
        // 计算步数
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        
        // 计算每步的增量
        const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
        const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
        
        // 生成路径
        let x = source.x;
        let y = source.y;
        
        for (let i = 0; i < steps; i++) {
            if (Math.abs(x - target.x) > 0) x += stepX;
            if (Math.abs(y - target.y) > 0) y += stepY;
            
            path.push(new Vec2(x, y));
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
        
        console.log(`AI玩家 ${playerId} 开始执行回合`);
        
        // 获取AI难度
        const player = this._playerManager.getPlayerById(playerId);
        if (!player || !player.isAI) {
            console.error(`ID为 ${playerId} 的玩家不是AI或不存在`);
            return;
        }
        
        const difficulty = player.aiLevel ? this.getDifficultyString(player.aiLevel) : "normal";
        console.log(`AI难度: ${difficulty}`);
        
        // 获取AI所有的地块
        const ownedTiles = this.getPlayerOwnedTiles(playerId);
        if (ownedTiles.length === 0) {
            console.log("AI没有拥有的地块，无法行动");
            return;
        }
        
        console.log(`AI拥有 ${ownedTiles.length} 个地块`);
        
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
            
            console.log(`AI决定从 [${tilePos.x},${tilePos.y}] 派遣 ${troopsToSend} 兵力到 [${targetPos.x},${targetPos.y}]`);
            
            // 执行调兵行动
            this._troopManager.sendTroops(tilePos.x, tilePos.y, targetPos.x, targetPos.y, troopsToSend);
            actionCount++;
        }
        
        console.log(`AI玩家 ${playerId} 执行了 ${actionCount} 次行动，回合结束`);
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
} 