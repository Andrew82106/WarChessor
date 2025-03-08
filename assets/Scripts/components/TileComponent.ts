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
    
    // 地形颜色映射
    private _terrainColors: {[key: number]: Color} = {
        [TerrainType.BASIC_LAND]: new Color(220, 220, 220, 255),
        [TerrainType.POPULATION_CENTER]: new Color(150, 220, 150, 255),
        [TerrainType.POLITICAL_CENTER]: new Color(150, 150, 220, 255),
        [TerrainType.HEADQUARTERS]: new Color(220, 150, 150, 255)
    };
    
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
        this._terrainType = type;
        this.updateTerrainDisplay();
    }
    
    get terrainType(): TerrainType {
        return this._terrainType;
    }
    
    /**
     * 设置格子的所有者
     */
    set ownerId(id: number) {
        this._ownerId = id;
        this.updateOwnerDisplay();
    }
    
    get ownerId(): number {
        return this._ownerId;
    }
    
    /**
     * 设置格子上的驻军数量
     */
    set troops(amount: number) {
        this._troops = Math.max(0, amount); // 确保不小于0
        this.updateTroopsDisplay();
        
        // 当兵力为0时，可能需要更新显示
        if (this._troops === 0) {
            this.updateOwnerDisplay(); // 更新为灰色
        }
        
        //console.log(`Tile [${this._gridPosition.x},${this._gridPosition.y}] 设置兵力: ${this._troops}`);
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

        // 如果有地形图标，设置显示
        if (this.terrainIcon) {
            this.terrainIcon.node.active = this._terrainType !== TerrainType.BASIC_LAND;
            
            // 根据地形类型可以设置不同的图标
            switch(this._terrainType) {
                case TerrainType.POPULATION_CENTER:
                    // 设置人口重镇图标
                    break;
                case TerrainType.POLITICAL_CENTER:
                    // 设置政治中心图标
                    break;
                case TerrainType.HEADQUARTERS:
                    // 设置大本营图标
                    break;
            }
        }
    }
    
    /**
     * 更新所有者显示
     */
    private updateOwnerDisplay() {
        if (!this.background) {
            console.error(`Tile [${this._gridPosition.x},${this._gridPosition.y}] 背景组件为空`);
            return;
        }
        
        // 检查精灵帧
        if (!this.background.spriteFrame) {
            console.error(`Tile [${this._gridPosition.x},${this._gridPosition.y}] 精灵帧未设置，请在编辑器中为Tile预制体的背景组件设置精灵帧!`);
        }
        
        // 根据格子所有者设置不同颜色
        let color: Color;
        if (this._ownerId !== -1) {
            // 当玩家ID为-1时表示无主
            // 尝试从游戏根节点获取PlayerManager
            const playerManager = director.getScene()?.getComponentInChildren(PlayerManager);
            if (playerManager) {
                // 使用玩家颜色，这里会调用PlayerManager的getPlayerColor函数
                color = playerManager.getPlayerColor(this._ownerId);
                
                // 玩家ID超出范围或未找到时的警告
                if (color.equals(new Color(200, 200, 200, 255))) {
                    console.warn(`警告: Tile [${this._gridPosition.x},${this._gridPosition.y}] 所有者ID ${this._ownerId} 可能无效，正使用默认灰色`);
                }
            } else {
                console.error(`无法获取PlayerManager，Tile [${this._gridPosition.x},${this._gridPosition.y}] 使用默认红色`);
                color = new Color(255, 100, 100, 255); // 默认红色
                
                // 尝试从不同路径获取PlayerManager
                const scene = director.getScene();
                if (scene) {
                    //console.log(`当前场景名: ${scene.name}, 节点结构:`);
                    this.logNodeHierarchy(scene, 0);
                }
            }
        } else {
            // 无主地块 或 无士兵地块，使用灰色
            if (this._troops <= 0) {
                color = new Color(150, 150, 150, 255); // 暗灰色
            } else {
                color = new Color(180, 180, 180, 255); // 浅灰色
            }
        }
        
        // 确保颜色完全不透明
        color.a = 255;
        this.background.color = color;
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
        //console.log(`TileComponent: 设置高亮状态 [${this._gridPosition.x},${this._gridPosition.y}], highlight=${highlight}`);
        
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
        
        // 设置兵力文本
        this.troopsLabel.string = this._troops.toString();
        
        // 确保标签节点激活
        this.troopsLabel.node.active = true;
        
        // 根据兵力数量设置文本颜色
        if (this._troops === 0) {
            this.troopsLabel.color = new Color(100, 100, 100, 255); // 灰色文本
            //console.log(`Tile [${this._gridPosition.x},${this._gridPosition.y}] 兵力为0，设置灰色文本`);
        } else {
            this.troopsLabel.color = new Color(255, 255, 255, 255); // 白色文本
            //console.log(`Tile [${this._gridPosition.x},${this._gridPosition.y}] 兵力为${this._troops}，设置黑色文本`);
        }
        
        //console.log(`Tile [${this._gridPosition.x},${this._gridPosition.y}] 更新兵力显示: ${this._troops}`);
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
        //console.log(`TileComponent: 格子 [${this._gridPosition.x},${this._gridPosition.y}] 被点击`);
        console.log(`======= Tile [${this.gridPosition.x},${this.gridPosition.y}] 被点击 =======`);
        console.log("所有者:", this.ownerId, "兵力:", this.troops);
        console.log("当前高亮状态:", this.highlightNode.active);
        
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