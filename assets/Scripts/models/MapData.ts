import { Vec2 } from 'cc';

/**
 * 土地类型枚举
 */
export enum TerrainType {
    BASIC_LAND = 0,        // 基本土地
    POPULATION_CENTER = 1, // 人口重镇
    POLITICAL_CENTER = 2,  // 政治中心
    HEADQUARTERS = 3,       // 大本营
    MOUNTAIN = 4,          // 高山（不可通行）
    LAKE = 5               // 湖泊（不可通行）
}

/**
 * 地图数据结构
 */
export interface MapData {
    size?: {width: number, height: number},  // 地图尺寸（可选，可能在LevelData.mapSize中）
    terrain: number[][],                    // 地形类型矩阵
    ownership: number[][],                  // 土地所有权
    troops: number[][]                      // 驻军数量
    headquarters: number[][]                // 大本营位置 [playerID, x, y]
}

/**
 * 关卡数据接口
 */
export interface LevelData {
    id: string;
    name: string;
    description: string;
    difficulty: number;
    mapSize: {width: number, height: number};  // 地图尺寸（JSON中的实际位置）
    developed: boolean;
    unlocked: boolean;
    mapData: MapData;
    players: PlayerData[];
    gameRules: GameRules;
}

/**
 * 玩家数据接口
 */
export interface PlayerData {
    id: number;
    name: string;
    isAI: boolean;
    aiLevel?: number;
}

/**
 * 游戏规则接口
 */
export interface GameRules {
    baseIncreaseRate: number;            // 基本土地增长周期
    populationIncreaseRate: number;      // 人口重镇增长速率
    headquartersIncreaseRate: number;    // 大本营增长速率
    politicalCenterEffect: number;       // 政治中心效果
    fogOfWar: boolean;                   // 是否开启战争迷雾
    visibilityRange: number;             // 视野范围
    winCondition: string;                // 胜利条件
} 