import { _decorator, Component, Node, Label, Color, Sprite, Button, Vec2, UITransform, director, Graphics, Texture2D, SpriteFrame, ImageAsset, Canvas } from 'cc';
import { TerrainType } from '../models/MapData';
import { PlayerManager } from '../managers/PlayerManager';
const { ccclass, property } = _decorator;

/**
 * 地图格子组件
 */
@ccclass('TileComponent')
export class TileComponent extends Component {
    @property(Sprite)
    background: Sprite = null!;
    
    @property(Label)
    troopsLabel: Label = null!;
    
    @property(Node)
    highlightNode: Node = null!;
    
    @property(Node)
    fogNode: Node = null!;
    
    @property(Sprite)
    terrainIcon: Sprite = null!;
    
    // 格子数据
    private _gridPosition: Vec2 = new Vec2(0, 0); // 格子在网格中的位置
    private _terrainType: TerrainType = TerrainType.BASIC_LAND; // 地形类型
    private _ownerId: number = -1; // 所有者ID，-1表示无主
    private _troops: number = 0; // 驻军数量
    private _isVisible: boolean = false; // A是否在玩家视野中
    private _isSelected: boolean = false; // 是否被选中
    private _isMarkedForMove: boolean = false; // 是否被标记为行军目标
    
    // 地形颜色映射 - 使用更明确的颜色，避免与玩家颜色混淆
    private _terrainColors: {[key: number]: Color} = {
        [TerrainType.BASIC_LAND]: new Color(200, 200, 200, 255),          // 基本土地：中灰色
        [TerrainType.POPULATION_CENTER]: new Color(70, 180, 70, 255),     // 人口重镇：绿色
        [TerrainType.POLITICAL_CENTER]: new Color(160, 120, 220, 255),    // 政治中心：紫色
        [TerrainType.HEADQUARTERS]: new Color(220, 180, 80, 255),         // 大本营：金色（主要被边框体现）
        [TerrainType.MOUNTAIN]: new Color(130, 110, 90, 255),             // 山脉：棕色
        [TerrainType.LAKE]: new Color(140, 190, 230, 255)                 // 湖泊：浅灰蓝色
    };
    
    // 地形图标索引（用于设置terrainIcon的精灵帧索引）
    private _terrainIconIndices: {[key: number]: number} = {
        [TerrainType.BASIC_LAND]: -1,               // 基本土地：无图标
        [TerrainType.POPULATION_CENTER]: 0,         // 人口重镇：图标0
        [TerrainType.POLITICAL_CENTER]: 1,          // 政治中心：图标1
        [TerrainType.HEADQUARTERS]: 2,              // 大本营：图标2
        [TerrainType.MOUNTAIN]: 3,                  // 山脉：图标3
        [TerrainType.LAKE]: 4                       // 湖泊：图标4
    };
    
    // 是否是不可到达的地形
    private get _isImpassable(): boolean {
        return this._terrainType === TerrainType.MOUNTAIN || 
               this._terrainType === TerrainType.LAKE;
    }
    
    // 大本营检查
    private get _isHeadquarters(): boolean {
        return this._terrainType === TerrainType.HEADQUARTERS;
    }
    
    // 地形是否可被占领
    private get _canBeOwned(): boolean {
        return !this._isImpassable;
    }
    
    // 混合颜色方法：将地形颜色和玩家颜色混合
    private _blendColors(terrainColor: Color, playerColor: Color, blendFactor: number = 0.4): Color {
        // 创建新的颜色对象，防止修改原始颜色
        const result = new Color();
        
        // 混合公式：result = terrainColor * (1 - blendFactor) + playerColor * blendFactor
        result.r = Math.floor(terrainColor.r * (1 - blendFactor) + playerColor.r * blendFactor);
        result.g = Math.floor(terrainColor.g * (1 - blendFactor) + playerColor.g * blendFactor);
        result.b = Math.floor(terrainColor.b * (1 - blendFactor) + playerColor.b * blendFactor);
        result.a = 255; // 确保完全不透明
        
        return result;
    }
    
    /**
     * 初始化
     */
    onLoad() {
        // 初始化
        console.log(`TileComponent: 加载格子 [${this._gridPosition.x},${this._gridPosition.y}]`);
        
        // 确保精灵帧正确加载
        if (this.background) {
            // 检查精灵帧
            if (!this.background.spriteFrame) {
                console.error("in TileComponent: 背景精灵帧未设置，Tile将不可见!");
            }
        } else {
            console.error("in TileComponent: 背景组件不存在，请检查预制体配置!");
        }
        
        // 添加点击事件监听
        this.node.on(Node.EventType.TOUCH_END, () => {
            console.log(`TileComponent: 触发TOUCH_END事件 [${this._gridPosition.x},${this._gridPosition.y}]`);
            this.onTileClicked();
        }, this);
        
        // 初始化节点状态
        if (this.highlightNode) {
            this.highlightNode.active = false;
        }
        
        // 设置初始值
        this._isVisible = true;
        this._isSelected = false;
        this._isMarkedForMove = false;
        
        // 强制关闭战争迷雾
        if (this.fogNode) {
            this.fogNode.active = false;
        }
        
        // 设置字体颜色
        if (this.troopsLabel) {
            this.troopsLabel.color = new Color(255, 255, 255, 255); // 白色文字
        }
        
        // 更新地形显示
        this.updateTerrainDisplay();
        
        // 更新兵力显示
        this.updateTroopsDisplay();
        
        // 更新可见性
        this.updateVisibility();
    }
    
    /**
     * 设置格子在网格中的位置
     */
    set gridPosition(pos: Vec2) {
        this._gridPosition = pos;
    }
    
    get gridPosition(): Vec2 {
        return this._gridPosition;
    }
    
    /**
     * 设置格子的地形类型
     */
    set terrainType(type: TerrainType) {
        const oldType = this._terrainType;
        this._terrainType = type;
        
        // 仅当地形类型改变时更新显示
        if (oldType !== type) {
            console.log(`Tile [${this._gridPosition.x},${this._gridPosition.y}] 地形类型从 ${oldType} 变为 ${type}`);
            this.updateTerrainDisplay();
        }
    }
    
    get terrainType(): TerrainType {
        return this._terrainType;
    }
    
    /**
     * 设置格子的所有者
     */
    set ownerId(id: number) {
        const oldId = this._ownerId;
        this._ownerId = id;
        
        // 仅当所有者改变时更新显示
        if (oldId !== id) {
            console.log(`Tile [${this._gridPosition.x},${this._gridPosition.y}] 所有者从 ${oldId} 变为 ${id}`);
            this.updateOwnerDisplay();
        }
    }
    
    get ownerId(): number {
        return this._ownerId;
    }
    
    /**
     * 设置格子上的驻军数量
     */
    set troops(amount: number) {
        const oldAmount = this._troops;
        this._troops = Math.max(0, amount); // 确保不小于0
        
        // 仅当兵力改变时更新显示
        if (oldAmount !== this._troops) {
            // 当兵力为0或从0变为非0时，可能需要更新所有者显示
            if (oldAmount === 0 || this._troops === 0) {
                this.updateOwnerDisplay(); // 兵力变为0可能需要变更颜色
            }
            
            this.updateTroopsDisplay();
        }
    }
    
    get troops(): number {
        return this._troops;
    }
    
    /**
     * 设置格子是否可见（在玩家视野中）
     */
    set isVisible(visible: boolean) {
        this._isVisible = visible;
        this.updateVisibility();
    }
    
    get isVisible(): boolean {
        return this._isVisible;
    }
    
    /**
     * 设置格子是否被选中
     */
    set isSelected(selected: boolean) {
        this._isSelected = selected;
        if (this.highlightNode) {
            this.highlightNode.active = selected;
        }
    }
    
    get isSelected(): boolean {
        return this._isSelected;
    }
    
    /**
     * 设置格子是否被标记为移动目标
     */
    set isMarkedForMove(marked: boolean) {
        this._isMarkedForMove = marked;
        // 这里可以添加一些视觉效果
        if (this.background) {
            // 添加一个边框或其他效果
            if (marked) {
                this.background.node.setScale(1.1, 1.1);
            } else {
                this.background.node.setScale(1.0, 1.0);
            }
        }
    }
    
    get isMarkedForMove(): boolean {
        return this._isMarkedForMove;
    }
    
    /**
     * 更新地形显示
     */
    private updateTerrainDisplay() {
        if (!this.background) return;

        // 是否有地形图标，设置显示
        if (this.terrainIcon) {
            // 为除了基本土地外的地形显示图标
            const shouldShowIcon = this._terrainType !== TerrainType.BASIC_LAND;
            this.terrainIcon.node.active = shouldShowIcon;
            
            // 注意：需要在Cocos Creator中为不同地形准备图标资源
            // 当前默认将特殊地形的图标打开，但未设置具体图片
        }
        
        // 更新所有者显示，这会设置颜色
        this.updateOwnerDisplay();
    }
    
    /**
     * 更新所有者显示
     */
    private updateOwnerDisplay() {
        if (!this.background) {
            console.error(`Tile [${this._gridPosition.x},${this._gridPosition.y}] 背景组件为空`);
            return;
        }
        
        // 查看错误的地形类型
        if (this._terrainType < 0 || this._terrainType > 5) {
            console.error(`非法地形类型: ${this._terrainType}，位置: [${this._gridPosition.x},${this._gridPosition.y}]`);
            this.background.color = new Color(255, 0, 255, 255); // 紫色表示错误
            return;
        }
        
        // 获取当前地形的基础颜色
        const terrainColor = this._terrainColors[this._terrainType];
        if (!terrainColor) {
            console.error(`未知地形类型: ${this._terrainType}，使用默认灰色, 位置: [${this._gridPosition.x},${this._gridPosition.y}]`);
            this.background.color = new Color(150, 150, 150, 255);
            return;
        }
        
        // 设置默认颜色为地形颜色的副本（避免修改原始对象）
        const finalColor = new Color(
            terrainColor.r,
            terrainColor.g,
            terrainColor.b,
            255
        );
        
        // 不可到达的地形保持原始颜色
        if (this._isImpassable) {
            this.background.color = finalColor;
            return;
        }
        
        // 根据格子所有者设置颜色
        if (this._ownerId !== -1 && this._troops > 0) {
            // 有主地块
            // 尝试获取PlayerManager
            const playerManager = director.getScene()?.getComponentInChildren(PlayerManager);
            if (playerManager) {
                // 获取玩家
                const player = playerManager.getPlayerById(this._ownerId);
                if (player) {
                    const playerColor = player.color;
                    
                    // 对于大本营，直接使用玩家颜色（金色边框会在节点结构中添加）
                    if (this._isHeadquarters) {
                        // 将背景设置为金色
                        finalColor.r = 255; // 金色
                        finalColor.g = 215;
                        finalColor.b = 0;
                        
                        // 不再更新大本营边框
                        // this.updateHeadquartersBorder(true);
                        
                        // 更新数字标签为玩家颜色
                        if (this.troopsLabel) {
                            this.troopsLabel.color = new Color(
                                playerColor.r,
                                playerColor.g,
                                playerColor.b,
                                255
                            );
                        }
                    } else {
                        // 混合地形颜色和玩家颜色
                        // 为特殊地形保留更多原始颜色
                        let blendFactor = 0.6; // 默认混合比例：60%玩家颜色
                        
                        if (this._terrainType !== TerrainType.BASIC_LAND) {
                            // 特殊地形使用较低的混合比例
                            blendFactor = 0.3; // 特殊地形：30%玩家颜色
                        }
                        
                        // 安全的颜色混合
                        finalColor.r = Math.max(0, Math.min(255, Math.round(terrainColor.r * (1 - blendFactor) + playerColor.r * blendFactor)));
                        finalColor.g = Math.max(0, Math.min(255, Math.round(terrainColor.g * (1 - blendFactor) + playerColor.g * blendFactor)));
                        finalColor.b = Math.max(0, Math.min(255, Math.round(terrainColor.b * (1 - blendFactor) + playerColor.b * blendFactor)));
                    }
                } else {
                    console.warn(`找不到ID为${this._ownerId}的玩家，使用原始地形颜色, 位置: [${this._gridPosition.x},${this._gridPosition.y}]`);
                    
                    // 如果是大本营但找不到玩家，仍需处理边框
                    if (this._isHeadquarters) {
                        // this.updateHeadquartersBorder(false);
                    }
                }
            } else {
                console.error(`无法获取PlayerManager，使用原始地形颜色, 位置: [${this._gridPosition.x},${this._gridPosition.y}]`);
                
                // 如果是大本营但找不到PlayerManager，仍需处理边框
                if (this._isHeadquarters) {
                    // this.updateHeadquartersBorder(false);
                }
            }
        } else {
            // 无主地块，如果是大本营则去除金色边框
            if (this._isHeadquarters) {
                // this.updateHeadquartersBorder(false);
            }
        }
        
        // 应用最终颜色
        this.background.color = finalColor;
    }
    
    /**
     * 更新大本营金色边框
     * @param show 是否显示金色边框
     */
    public updateHeadquartersBorder(show: boolean): void {
        console.log(`【大本营】格子[${this._gridPosition.x},${this._gridPosition.y}]${show ? '显示' : '隐藏'}金色边框`);
        
        // 查找或创建边框节点
        let borderNode = this.node.getChildByName('GoldenBorder');
        
        if (!borderNode && show) {
            // 创建金色边框节点
            borderNode = new Node('GoldenBorder');
            this.node.addChild(borderNode);
            
            // 添加Sprite组件
            const sprite = borderNode.addComponent(Sprite);
            
            // 大小略大于背景
            borderNode.setScale(1.1, 1.1);
            
            // 设置z索引使其在背景下方但在其他元素上方
            borderNode.setSiblingIndex(1);
            
            // 设置金色
            sprite.color = new Color(255, 215, 0, 255); // 金色
            console.log(`【大本营】为格子[${this._gridPosition.x},${this._gridPosition.y}]创建了新的金色边框`);
        }
        
        if (borderNode) {
            borderNode.active = show;
        }
    }
    
    /**
     * 记录节点层次结构，用于调试
     */
    private logNodeHierarchy(node: Node, depth: number) {
        const indent = "  ".repeat(depth);
        //console.log(`${indent}${node.name} (组件: ${this.getComponentNames(node)})`);
        
        node.children.forEach(child => {
            this.logNodeHierarchy(child, depth + 1);
        });
    }
    
    /**
     * 获取节点上的组件名称
     */
    private getComponentNames(node: Node): string {
        const components = node.components;
        return components.map(comp => comp.constructor.name).join(", ");
    }
    
    /**
     * 设置高亮显示状态
     * @param highlight 是否高亮
     */
    setHighlight(highlight: boolean): void {
        // 不可到达的地形不能高亮
        if (this._isImpassable) {
            return;
        }
        
        // 查找高亮节点
        const highlightNode = this.node.getChildByName('Highlight');
        if (highlightNode) {
            // 确保高亮节点总是能被激活，无论tile的状态或所有权
            highlightNode.active = highlight;
            
            // 根据方块类型调整高亮颜色
            const highlightSprite = highlightNode.getComponent(Sprite);
            if (highlightSprite) {
                if (this._ownerId !== -1) {
                    // 有主方块使用深色高亮
                    highlightSprite.color = new Color(255, 255, 255, 180);
                } else {
                    // 无主方块使用亮色高亮，确保更明显
                    highlightSprite.color = new Color(255, 255, 255, 220);
                }
            }
        } else {
            console.warn(`Tile [${this._gridPosition.x},${this._gridPosition.y}] 无法找到Highlight节点`);
        }
    }
    
    /**
     * 更新兵力显示
     */
    private updateTroopsDisplay() {
        if (!this.troopsLabel) {
            console.error(`Tile [${this._gridPosition.x},${this._gridPosition.y}] 兵力标签为空`);
            return;
        }
        
        // 不可到达的地形（山脉/湖泊）不显示兵力
        if (this._isImpassable) {
            this.troopsLabel.node.active = false;
            return;
        }
        
        // 设置兵力文本
        this.troopsLabel.string = this._troops.toString();
        
        // 确保标签节点激活
        this.troopsLabel.node.active = true;
        
        // 根据兵力数量设置文本颜色
        if (this._troops === 0) {
            this.troopsLabel.color = new Color(100, 100, 100, 255); // 灰色文本
        } else {
            this.troopsLabel.color = new Color(255, 255, 255, 255); // 白色文本
        }
    }
    
    /**
     * 更新可见性
     */
    private updateVisibility() {
        if (this.fogNode) {
            this.fogNode.active = !this._isVisible;
            const fogSprite = this.fogNode.getComponent(Sprite);
            if (fogSprite) {
                fogSprite.color = new Color(0, 0, 0, this._isVisible ? 50 : 200);
            }
        }
        
        // 如果不可见，应该隐藏一些信息
        if (!this._isVisible) {
            if (this.troopsLabel) {
                this.troopsLabel.node.active = false;
            }
            
            if (this.terrainIcon) {
                this.terrainIcon.node.active = false;
            }
        } else {
            this.updateTroopsDisplay();
            this.updateTerrainDisplay();
        }
    }
    
    /**
     * 处理Tile点击事件
     */
    private onTileClicked() {
        console.log(`======= Tile [${this.gridPosition.x},${this.gridPosition.y}] 被点击 =======`);
        console.log("所有者:", this.ownerId, "兵力:", this.troops);
        console.log("当前高亮状态:", this.highlightNode.active);
        console.log("地形类型:", this._terrainType, "是否不可到达:", this._isImpassable);
        
        // 如果是不可到达的地形，不触发选择事件
        if (this._isImpassable) {
            console.log(`TileComponent: 不可到达的地形 [${this.gridPosition.x},${this.gridPosition.y}] 被点击，忽略`);
            return;
        }
        
        // 发送事件到场景
        const scene = director.getScene();
        if (scene) {
            console.log(`TileComponent: 向场景 ${scene.name} 发送tile-selected事件`);
            scene.emit('tile-selected', this);
        } else {
            console.error("TileComponent: 无法获取场景引用，事件发送失败");
        }
    }
} 