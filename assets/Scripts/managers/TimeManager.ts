import { _decorator, Component, Node } from 'cc';
import { PlayerManager } from './PlayerManager';
import { TroopManager } from './TroopManager';
import { AIManager } from './AIManager';
import { LevelData } from '../models/MapData';

const { ccclass, property } = _decorator;

/**
 * 时间管理器
 * 负责管理游戏实时时钟和进度
 */
@ccclass('TimeManager')
export class TimeManager extends Component {
    @property
    defaultGameSpeed: number = 1.0; // 默认游戏速度倍率
    
    @property
    maxGameSpeed: number = 4.0; // 最大游戏速度倍率
    
    // 引用其他管理器
    private _playerManager: PlayerManager | null = null;
    private _troopManager: TroopManager | null = null;
    private _aiManager: AIManager | null = null;
    
    // 时间数据
    private _gameTime: number = 0; // 游戏时间（秒）
    private _isRunning: boolean = false;
    private _gameSpeed: number = 1.0; // 游戏速度倍率
    private _gameRules: any = null;
    
    // 事件计时器
    private _resourceGrowthTimers: {[playerId: number]: {[resourceType: string]: number}} = {};
    private _troopMovementTimer: number = 0; // 新增：部队移动计时器
    
    /**
     * 设置管理器引用
     */
    setManagers(playerManager: PlayerManager, troopManager: TroopManager, aiManager: AIManager): void {
        this._playerManager = playerManager;
        this._troopManager = troopManager;
        this._aiManager = aiManager;
    }
    
    /**
     * 设置游戏规则
     */
    setGameRules(gameRules: any): void {
        this._gameRules = gameRules;
        
        // 初始化每个玩家的资源增长计时器
        if (this._playerManager) {
            this._playerManager.getPlayers().forEach(player => {
                this._resourceGrowthTimers[player.id] = {
                    'BASIC_LAND': 0,
                    'POPULATION_CENTER': 0,
                    'POLITICAL_CENTER': 0,
                    'HEADQUARTERS': 0
                };
            });
        }
    }
    
    /**
     * 开始游戏时钟
     */
    startGame(): void {
        this._isRunning = true;
        this._gameTime = 0;
        this._gameSpeed = this.defaultGameSpeed;
    }
    
    /**
     * 暂停游戏
     */
    pauseGame(): void {
        this._isRunning = false;
    }
    
    /**
     * 恢复游戏
     */
    resumeGame(): void {
        this._isRunning = true;
    }
    
    /**
     * 设置游戏速度
     * @param speed 速度倍率
     */
    setGameSpeed(speed: number): void {
        this._gameSpeed = Math.min(Math.max(0.5, speed), this.maxGameSpeed);
    }
    
    /**
     * 获取当前游戏时间（秒）
     */
    getGameTime(): number {
        return this._gameTime;
    }
    
    /**
     * 获取当前游戏速度
     */
    getGameSpeed(): number {
        return this._gameSpeed;
    }
    
    /**
     * 更新游戏时间
     */
    update(dt: number): void {
        if (!this._isRunning || !this._playerManager || !this._troopManager) return;
        
        // 根据游戏速度计算实际时间增量, 这里的dt是每帧的时间
        const scaledDt = dt * this._gameSpeed;

        
        // 更新游戏时间
        this._gameTime += scaledDt;
        
        // 处理资源增长
        this.handleResourceGrowth(scaledDt);
        
        // 处理AI行为
        this.handleAIBehavior(scaledDt);
        
        // 处理部队移动
        this.handleTroopMovement(scaledDt);
        
        // 发送时间更新事件
        this.node.emit('time-updated', this._gameTime);
    }
    
    /**
     * 处理资源增长
     */
    private handleResourceGrowth(dt: number): void {
        if (!this._playerManager || !this._troopManager || !this._gameRules) return;
        
        const players = this._playerManager.getPlayers();
        
        players.forEach(player => {
            if (player.defeated) return;
            
            const playerId = player.id;
            const timers = this._resourceGrowthTimers[playerId];
            
            // 更新基本土地增长计时器
            timers['BASIC_LAND'] += dt;
            const baseIncreaseInterval = this._getResourceInterval('BASIC_LAND', player.politicalCenters);
            if (timers['BASIC_LAND'] >= baseIncreaseInterval) {
                timers['BASIC_LAND'] = 0;
                this._troopManager.growTroopsForPlayer(playerId, 'BASIC_LAND');
            }
            
            // 更新人口重镇增长计时器
            timers['POPULATION_CENTER'] += dt;
            const popIncreaseInterval = this._getResourceInterval('POPULATION_CENTER', 0);
            if (timers['POPULATION_CENTER'] >= popIncreaseInterval) {
                timers['POPULATION_CENTER'] = 0;
                this._troopManager.growTroopsForPlayer(playerId, 'POPULATION_CENTER');
            }
            
            // 更新政治中心增长计时器
            timers['POLITICAL_CENTER'] += dt;
            const polIncreaseInterval = this._getResourceInterval('POLITICAL_CENTER', 0);
            if (timers['POLITICAL_CENTER'] >= polIncreaseInterval) {
                timers['POLITICAL_CENTER'] = 0;
                // this._troopManager.growTroopsForPlayer(playerId, 'POLITICAL_CENTER');
                // 政治中心其实不需要计时器，因为政治中心不增加人口数
            }
            
            // 更新大本营增长计时器
            timers['HEADQUARTERS'] += dt;
            const hqIncreaseInterval = this._getResourceInterval('HEADQUARTERS', 0);
            if (timers['HEADQUARTERS'] >= hqIncreaseInterval) {
                timers['HEADQUARTERS'] = 0;
                this._troopManager.growTroopsForPlayer(playerId, 'HEADQUARTERS');
            }
        });
    }
    
    /**
     * 获取资源增长间隔
     */
    private _getResourceInterval(resourceType: string, politicalCenters: number): number {
        if (!this._gameRules) return 60;
        
        switch (resourceType) {
            case 'BASIC_LAND':
                // 基本土地：默认25秒，政治中心每增加1个缩短10秒
                return Math.max(5, 25 - politicalCenters * 10);
            case 'POPULATION_CENTER':
                // 人口重镇：30秒
                return 10;
            case 'POLITICAL_CENTER':
                // 政治中心：15秒
                // 政治中心其实不需要计时器，因为政治中心不增加人口数
                return 10;
            case 'HEADQUARTERS':
                // 大本营：10秒
                return 10;
            default:
                return 25;
        }
    }
    
    /**
     * 处理AI行为
     */
    private handleAIBehavior(dt: number): void {
        if (!this._playerManager || !this._aiManager) {
            console.warn("TimeManager: handleAIBehavior - 玩家管理器或AI管理器未初始化");
            return;
        }
        
        // 检查是否有AI玩家
        // const aiPlayers = this._playerManager.getPlayers().filter(player => player.isAI && !player.defeated);
        
        // AI行为由AIManager处理
        this._aiManager.processAILogic(dt);
    }
    
    /**
     * 处理部队移动
     */
    private handleTroopMovement(dt: number): void {
        if (!this._troopManager) {
            console.warn("TimeManager: handleTroopMovement - 部队管理器未初始化");
            return;
        }
        
        // 累加部队移动计时器
        this._troopMovementTimer += dt;
        
        // 每2秒处理一次部队移动
        const movementInterval = 2;
        if (this._troopMovementTimer >= movementInterval) {
            // 重置计时器
            this._troopMovementTimer = 0;
            
            // 处理部队行军队列
            try {
                const marchingPathsMap = this._troopManager.getMarchingPaths();
                // 检查是否有任何行军路径队列
                let hasAnyPaths = false;
                marchingPathsMap.forEach((paths) => {
                    if (paths.length > 0) {
                        hasAnyPaths = true;
                    }
                });
                
                if (hasAnyPaths) {
                    ////console.log(`TimeManager: 处理行军队列，当前有 ${marchingPathsMap.size} 个玩家的行军路径`);
                    this._troopManager.processMarchingQueues();
                }
                
                // 同步所有玩家的行军路线计数
                if (typeof this._troopManager.syncAllPlayerPathCounts === 'function') {
                    this._troopManager.syncAllPlayerPathCounts();
                }
                
                // 通知行军状态更新
                this.node.emit('marching-status-updated');
            } catch (error) {
                console.error("TimeManager: 处理部队移动时发生错误:", error);
            }
        }
    }
    
    /**
     * 安排定时事件
     */
    scheduleEvent(callback: Function, interval: number, repeat: boolean = false): number {
        // 实现定时事件系统（可以在这里添加更复杂的事件调度机制）
        // 简单实现返回一个ID，可以用于取消事件
        return 0;
    }
    
    /**
     * 取消定时事件
     */
    unscheduleEvent(eventId: number): void {
        // 取消已安排的事件
    }
} 