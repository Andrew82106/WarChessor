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
        // 传进来的就是一个玩家数据列表，里面包含所有玩家的信息
        this._players = [];
        this._currentPlayerIndex = 0;
        // 这个_currentPlayerIndex是干啥用的，可能已经没有用了吧
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
        /*
        逐部分解释：
            playerDataList.forEach((playerData, index) => { ... });：
            这行代码使用forEach方法遍历playerDataList数组中的每个元素。
            playerData是当前遍历到的玩家数据对象，index是当前元素的索引。

            const playerColor = PLAYER_COLORS[index % PLAYER_COLORS.length];：
            这行代码根据当前玩家的索引index选择一个颜色。PLAYER_COLORS是一个颜色数组，使用取模运算符%确保索引不会超出数组的范围。
            例如，如果PLAYER_COLORS数组有3种颜色，索引0、1、2分别对应第一、第二、第三种颜色，索引3会回到第一种颜色（0），以此类推。
            
            const player = new Player(...);：
            这行代码创建一个新的Player对象，使用从playerData中提取的属性来初始化该对象。
            Player构造函数的参数包括：
            playerData.id：玩家的唯一标识符。
            playerData.name：玩家的名称。
            playerColor：为玩家分配的颜色。
            playerData.isAI：布尔值，指示该玩家是否为AI。
            playerData.aiLevel：AI的难度等级（如果适用）。
            
            this._players.push(player);：
            这行代码将新创建的Player对象添加到_players数组中，_players是PlayerManager类的一个私有属性，用于存储所有玩家的实例。
            总结：
            这段代码的主要功能是从玩家数据列表playerDataList中创建多个Player对象，
            并将它们存储在PlayerManager的_players数组中。
        */
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
        if (!this._players.length) return -1;
        
        // 找出人类玩家和AI玩家
        const humanPlayers = this._players.filter(p => !p.isAI);
        const aiPlayers = this._players.filter(p => p.isAI);
        
        console.log(`【大本营】胜利条件检查: 人类玩家数=${humanPlayers.length}, AI玩家数=${aiPlayers.length}`);
        
        // 检查每个玩家的大本营归属
        this._players.forEach(player => {
            if (!player.headquarters) {
                console.log(`【大本营】警告: 玩家${player.id}(${player.name})没有设置大本营位置`);
                return;
            }
            
            // 获取该玩家大本营的当前所有者
            const mapManager = this.node.parent?.getComponentInChildren('MapManager');
            if (!mapManager) {
                console.log(`【大本营】错误: 无法获取MapManager组件`);
                return;
            }
            
            // 使用as MapManager来指定类型
            const hqTile = (mapManager as any).getTile(player.headquarters.x, player.headquarters.y);
            if (!hqTile) {
                console.log(`【大本营】错误: 找不到玩家${player.id}的大本营位置[${player.headquarters.x},${player.headquarters.y}]`);
                return;
            }
            
            const hqOwnerId = hqTile.ownerId;
            console.log(`【大本营】检查: 玩家${player.id}(${player.name})的大本营位置[${player.headquarters.x},${player.headquarters.y}]当前归属于玩家${hqOwnerId}`);
            
            // 如果大本营不属于自己，标记为已击败
            if (hqOwnerId !== player.id) {
                console.log(`【大本营】玩家${player.id}(${player.name})的大本营已被占领，玩家被击败`);
                player.defeated = true;
            }
        });
        
        // 检查是否所有AI都被击败
        const allAIDefeated = aiPlayers.every(p => p.defeated);
        
        // 检查人类玩家是否被击败
        const humanDefeated = humanPlayers.length > 0 && humanPlayers.every(p => p.defeated);
        
        console.log(`【大本营】胜利条件分析: 所有AI被击败=${allAIDefeated}, 人类被击败=${humanDefeated}`);
        
        // 如果所有AI都被击败，人类胜利
        if (allAIDefeated && !humanDefeated && humanPlayers.length > 0) {
            this._gameOver = true;
            console.log(`【大本营】胜利条件满足: 所有AI大本营被占领，人类玩家胜利`);
            return humanPlayers[0].id; // 返回人类玩家ID
        }
        
        // 如果人类被击败，AI胜利
        if (humanDefeated) {
            this._gameOver = true;
            console.log(`【大本营】胜利条件满足: 人类玩家大本营被占领，游戏失败`);
            
            // 找出没有被击败的AI作为胜利者
            const victoriousAI = aiPlayers.find(p => !p.defeated);
            return victoriousAI ? victoriousAI.id : -1;
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