import { _decorator, Component, Node } from 'cc';
import { PlayerManager } from './PlayerManager';
import { TroopManager } from './TroopManager';
import { LevelData } from '../models/MapData';

const { ccclass, property } = _decorator;

/**
 * 回合管理器
 * 负责管理游戏回合和进度
 */
@ccclass('TurnManager')
export class TurnManager extends Component {
    @property
    turnIntervalSeconds: number = 1.0; // 回合间隔时间（秒）
    
    // 引用其他管理器
    private _playerManager: PlayerManager | null = null;
    private _troopManager: TroopManager | null = null;
    
    // 回合数据
    private _currentTurn: number = 0;
    private _isRunning: boolean = false;
    private _timer: number = 0;
    private _gameRules: any = null;
    
    // 基本土地增长计数器
    private _baseIncreaseCounters: {[playerId: number]: number} = {};
    
    /**
     * 设置管理器引用
     */
    setManagers(playerManager: PlayerManager, troopManager: TroopManager): void {
        this._playerManager = playerManager;
        this._troopManager = troopManager;
    }
    
    /**
     * 设置游戏规则
     */
    setGameRules(gameRules: any): void {
        this._gameRules = gameRules;
        
        // 初始化每个玩家的基本土地增长计数器
        if (this._playerManager) {
            this._playerManager.getPlayers().forEach(player => {
                this._baseIncreaseCounters[player.id] = 0;
            });
        }
    }
    
    /**
     * 开始回合循环
     */
    startTurnLoop(): void {
        this._isRunning = true;
        this._currentTurn = 0;
        this._timer = 0;
    }
    
    /**
     * 暂停回合循环
     */
    pauseTurnLoop(): void {
        this._isRunning = false;
    }
    
    /**
     * 恢复回合循环
     */
    resumeTurnLoop(): void {
        this._isRunning = true;
    }
    
    /**
     * 获取当前回合数
     */
    getCurrentTurn(): number {
        return this._currentTurn;
    }
    
    /**
     * 更新回合
     */
    update(dt: number): void {
        if (!this._isRunning || !this._playerManager || !this._troopManager) return;
        
        // 更新计时器
        this._timer += dt;
        
        // 达到回合间隔时间时执行回合逻辑
        if (this._timer >= this.turnIntervalSeconds) {
            this._timer -= this.turnIntervalSeconds;
            this.executeTurn();
        }
    }
    
    /**
     * 执行回合逻辑
     */
    private executeTurn(): void {
        //console.log(`TurnManager: 执行回合 ${this._currentTurn}`);
        
        // 增加回合计数
        this._currentTurn++;
        
        // 处理兵力增长
        this.handleTroopGrowth();
        
        // 处理AI行动
        if (this._playerManager?.isCurrentPlayerAI()) {
            this.handleAIAction();
        }
        
        // 处理行军移动
        if (this._troopManager) {
            console.log("处理行军队列");
            this._troopManager.processMarchingQueues();
        }
        
        // 通知回合更新
        this.node.emit('turn-updated', this._currentTurn);
    }
    
    /**
     * 处理兵力增长
     */
    private handleTroopGrowth(): void {
        if (!this._playerManager || !this._troopManager || !this._gameRules) return;
        
        const players = this._playerManager.getPlayers();
        
        players.forEach(player => {
            if (player.defeated) return;
            
            const playerId = player.id;
            
            // 更新基本土地增长计数器
            this._baseIncreaseCounters[playerId] = (this._baseIncreaseCounters[playerId] || 0) + 1;
            
            // 计算基本土地增长周期
            let baseIncreaseRate = this._gameRules.baseIncreaseRate;
            
            // 根据拥有的政治中心数量降低增长周期
            if (player.politicalCenters > 0) {
                baseIncreaseRate = Math.max(1, baseIncreaseRate - player.politicalCenters * this._gameRules.politicalCenterEffect);
            }
            
            // 检查基本土地是否应该增长
            const shouldIncreaseBaseLand = this._baseIncreaseCounters[playerId] >= baseIncreaseRate;
            
            if (shouldIncreaseBaseLand) {
                this._baseIncreaseCounters[playerId] = 0;
                this._troopManager.growTroopsForPlayer(playerId, 'BASIC_LAND');
            }
            
            // 每回合增长人口重镇
            this._troopManager.growTroopsForPlayer(playerId, 'POPULATION_CENTER');
            
            // 每回合增长大本营
            this._troopManager.growTroopsForPlayer(playerId, 'HEADQUARTERS');
        });
    }
    
    /**
     * 处理AI行动
     */
    private handleAIAction(): void {
        if (!this._playerManager || !this._troopManager) return;
        
        const currentPlayer = this._playerManager.getCurrentPlayer();
        
        if (currentPlayer.isAI) {
            // 这里将由AIManager处理，后续会实现
            this.node.emit('ai-action-requested', currentPlayer);
        }
    }
    
    /**
     * 切换到下一个玩家回合
     */
    switchToNextPlayer(): boolean {
        if (!this._playerManager) return false;
        
        // 清理当前玩家的行军队列
        if (this._troopManager) {
            this._troopManager.clearMarchingQueuesForPlayer(this._playerManager.getCurrentPlayerId());
        }
        
        // 切换到下一个玩家
        const success = this._playerManager.switchToNextPlayer();
        
        // 检查游戏胜利条件
        const winnerId = this._playerManager.checkWinCondition();
        if (winnerId !== -1) {
            this.pauseTurnLoop();
            this.node.emit('game-over', winnerId);
        }
        
        return success;
    }
} 