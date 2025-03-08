import { Color, Vec2 } from 'cc';

/**
 * 玩家数据结构
 */
export class Player {
    id: number;                  // 玩家ID
    name: string;                // 玩家名称
    color: Color;                // 玩家颜色
    isAI: boolean;               // 是否为AI
    aiLevel?: number;            // AI难度等级
    ownedTiles: Vec2[] = [];     // 拥有的土地坐标
    politicalCenters: number = 0;// 拥有的政治中心数量
    headquarters?: Vec2;         // 大本营位置
    defeated: boolean = false;   // 是否已被击败
    decisionTimer: number = 0;   // AI决策计时器（用于实时游戏模式）

    constructor(id: number, name: string, color: Color, isAI: boolean, aiLevel?: number) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.isAI = isAI;
        this.aiLevel = aiLevel;
    }

    /**
     * 添加拥有的地块
     * @param position 地块坐标
     */
    addOwnedTile(position: Vec2): void {
        const existingIndex = this.ownedTiles.findIndex(tile => 
            tile.x === position.x && tile.y === position.y);
        
        if (existingIndex === -1) {
            this.ownedTiles.push(position.clone());
        }
    }

    /**
     * 移除拥有的地块
     * @param position 地块坐标
     */
    removeOwnedTile(position: Vec2): void {
        const index = this.ownedTiles.findIndex(tile => 
            tile.x === position.x && tile.y === position.y);
        
        if (index !== -1) {
            this.ownedTiles.splice(index, 1);
        }
    }

    /**
     * 判断是否已经被击败
     * @returns 是否被击败
     */
    checkDefeated(): boolean {
        // 如果玩家没有任何地块，或者大本营被占领，则被击败
        if (this.ownedTiles.length === 0) {
            this.defeated = true;
        }
        return this.defeated;
    }
}

/**
 * 玩家颜色常量
 */
export const PLAYER_COLORS: Color[] = [
    new Color(255, 0, 0, 255),    // 红色
    new Color(0, 0, 255, 255),    // 蓝色
    new Color(0, 255, 0, 255),    // 绿色
    new Color(255, 255, 0, 255),  // 黄色
    new Color(128, 0, 128, 255),  // 紫色
    new Color(255, 165, 0, 255),  // 橙色
    new Color(0, 128, 128, 255),  // 青色
    new Color(255, 192, 203, 255) // 粉色
]; 