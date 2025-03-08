import { _decorator, Component, Node, Color, Vec2 } from 'cc';
import { Player, PLAYER_COLORS } from '../models/Player';
import { LevelData, PlayerData } from '../models/MapData';

const { ccclass, property } = _decorator;

/**
 * 玩家管理器
 * 负责玩家创建、状态管理和轮换
 */
@ccclass('PlayerManager')
export class PlayerManager extends Component {
    // 所有玩家数组
    private _players: Player[] = [];
    
    // 当前活跃玩家索引
    private _currentPlayerIndex: number = 0;
    
    // 游戏是否结束
    private _gameOver: boolean = false;
    
    /**
     * 初始化玩家
     */
    initPlayers(playerDataList: PlayerData[]): void {
        this._players = [];
        this._currentPlayerIndex = 0;
        this._gameOver = false;
        
        // 根据玩家数据创建玩家对象
        playerDataList.forEach((playerData, index) => {
            const playerColor = PLAYER_COLORS[index % PLAYER_COLORS.length];
            const player = new Player(
                playerData.id,
                playerData.name,
                playerColor,
                playerData.isAI,
                playerData.aiLevel
            );
            
            this._players.push(player);
        });
    }
    
    /**
     * 获取所有玩家
     */
    getPlayers(): Player[] {
        return this._players;
    }
    
    /**
     * 获取当前活跃玩家
     */
    getCurrentPlayer(): Player {
        return this._players[this._currentPlayerIndex];
    }
    
    /**
     * 获取当前活跃玩家ID
     */
    getCurrentPlayerId(): number {
        return this.getCurrentPlayer().id;
    }
    
    /**
     * 获取当前活跃玩家是否为AI
     */
    isCurrentPlayerAI(): boolean {
        return this.getCurrentPlayer().isAI;
    }
    
    /**
     * 根据ID获取玩家
     */
    getPlayerById(id: number): Player | null {
        return this._players.find(player => player.id === id) || null;
    }
    
    /**
     * 获取玩家颜色
     */
    getPlayerColor(id: number): Color {
        //console.log(`尝试获取玩家ID ${id} 的颜色, 当前玩家数量: ${this._players.length}`);
        
        // 打印所有玩家信息以便调试
        if (this._players.length <= 0)  {
            console.warn("玩家列表为空，可能PlayerManager未正确初始化");
        }
        
        const player = this.getPlayerById(id);
        if (player) {
            //console.log(`找到玩家 ${id}, 返回颜色: ${player.color.toString()}`);
            return player.color;
        }
        
        // 默认返回灰色
        console.warn(`未找到ID为 ${id} 的玩家，返回默认灰色`);
        return new Color(200, 200, 200, 255);
    }
    
    /**
     * 切换到下一个玩家
     * @returns 是否成功切换
     */
    switchToNextPlayer(): boolean {
        if (this._gameOver) return false;
        
        let nextIndex = (this._currentPlayerIndex + 1) % this._players.length;
        let attempts = 0;
        
        // 寻找下一个未被击败的玩家
        while (attempts < this._players.length) {
            const nextPlayer = this._players[nextIndex];
            
            if (!nextPlayer.defeated) {
                this._currentPlayerIndex = nextIndex;
                // 发送玩家切换事件
                this.node.emit('player-switched', this.getCurrentPlayer());
                return true;
            }
            
            nextIndex = (nextIndex + 1) % this._players.length;
            attempts++;
        }
        
        // 如果所有玩家都被击败，游戏结束
        return false;
    }
    
    /**
     * 检查玩家是否被击败
     */
    checkPlayerDefeat(playerId: number): boolean {
        const player = this.getPlayerById(playerId);
        if (!player) return false;
        
        return player.checkDefeated();
    }
    
    /**
     * 更新玩家的政治中心数量
     */
    updatePoliticalCenters(): void {
        // 重置所有玩家的政治中心数量
        this._players.forEach(player => {
            player.politicalCenters = 0;
        });
        
        // 这个方法会被MapManager调用，当地图更新时重新计算
    }
    
    /**
     * 设置玩家大本营位置
     */
    setPlayerHeadquarters(playerId: number, position: Vec2): void {
        const player = this.getPlayerById(playerId);
        if (player) {
            player.headquarters = position;
        }
    }
    
    /**
     * 检查游戏胜利条件
     * @returns 胜利玩家ID，如果没有则返回-1
     */
    checkWinCondition(): number {
        // 检查是否只剩一个玩家未被击败
        const activePlayers = this._players.filter(player => !player.defeated);
        
        if (activePlayers.length === 1) {
            this._gameOver = true;
            return activePlayers[0].id;
        }
        
        return -1;
    }
    
    /**
     * 获取游戏是否结束
     */
    isGameOver(): boolean {
        return this._gameOver;
    }
} 