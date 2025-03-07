import { _decorator, AudioSource, Component, Node, ScrollView, Prefab, instantiate, Label, Button, UITransform, JsonAsset, director, Vec3, Sprite, Color, resources, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

// 定义关卡数据接口
interface LevelData {
    id: number;           // 关卡ID
    name: string;         // 关卡名称
    description: string;  // 关卡描述
    difficulty: number;   // 难度等级 (1-5)
    unlocked: boolean;    // 是否已解锁
    developed: boolean;   // 是否已开发
    imgPath?: string;     // 关卡预览图路径（可选）
}

@ccclass('ChooseLevel')
export class ChooseLevel extends Component {
    @property(Node)
    public background: Node = null!;

    @property(ScrollView)
    public scrollView: ScrollView = null!;

    @property(Node)
    public content: Node = null!;

    @property(Prefab)
    public levelItemPrefab: Prefab = null!;

    @property(Button)
    public backButton: Button = null!;

    @property(AudioSource)
    public buttonClickSound: AudioSource = null!;

    @property(Label)
    public toastLabel: Label = null!;

    @property(Node)
    public toastNode: Node = null!;

    private levelDataList: LevelData[] = [];

    start() {
        // 注册返回按钮事件
        if (this.backButton) {
            this.backButton.node.on(Button.EventType.CLICK, this.onBackButtonClick, this);
        }

        // 加载关卡数据
        this.loadLevelData();
    }

    /**
     * 加载关卡数据
     */
    loadLevelData() {
        // 从resources目录加载JSON资源
        resources.load('levels/levelData', JsonAsset, (err, jsonAsset) => {
            if (err) {
                console.error('加载关卡数据失败:', err);
                return;
            }

            // 获取JSON数据
            const jsonData = jsonAsset.json;
            if (jsonData && jsonData.levels) {
                this.levelDataList = jsonData.levels;
                this.createLevelItems();
            } else {
                console.error('关卡数据格式不正确');
            }
        });
    }

    /**
     * 创建关卡项目
     */
    createLevelItems() {
        if (!this.content || !this.levelItemPrefab) {
            console.error('缺少必要组件: content或levelItemPrefab');
            return;
        }

        // 清空内容区域
        this.content.removeAllChildren();

        // 计算项目间的垂直间距
        const padding = 20;
        let posY = 0;

        // 获取ScrollView的宽度
        const scrollViewWidth = this.scrollView.getComponent(UITransform)?.contentSize.width || 600;
        
        // 动态创建关卡项目
        for (let i = 0; i < this.levelDataList.length; i++) {
            const levelData = this.levelDataList[i];
            
            // 实例化预制体
            const levelItem = instantiate(this.levelItemPrefab);
            this.content.addChild(levelItem);

            // 设置项目尺寸占满ScrollView宽度
            const itemTransform = levelItem.getComponent(UITransform);
            if (itemTransform) {
                itemTransform.setContentSize(scrollViewWidth - 40, 150); // 保留左右边距
            }

            // 设置位置（使用布局组件更可靠）
            levelItem.setPosition(0, posY, 0);
            posY -= (itemTransform?.height || 150) + padding;

            // 设置关卡数据
            this.setupLevelItem(levelItem, levelData);
        }

        // 更新滚动视图内容高度
        const contentHeight = Math.abs(posY) + padding;
        const contentSize = this.content.getComponent(UITransform)?.contentSize;
        if (contentSize) {
            this.content.getComponent(UITransform)?.setContentSize(contentSize.width, contentHeight);
        }
    }

    /**
     * 设置关卡项目的内容
     */
    setupLevelItem(item: Node, data: LevelData) {
        // 设置关卡名称
        const nameLabel = item.getChildByName('NameLabel')?.getComponent(Label);
        if (nameLabel) {
            nameLabel.string = data.name;
        }

        // 设置关卡描述
        const descLabel = item.getChildByName('DescriptionLabel')?.getComponent(Label);
        if (descLabel) {
            descLabel.string = data.description;
        }

        // 设置难度
        const difficultyLabel = item.getChildByName('DifficultyLabel')?.getComponent(Label);
        if (difficultyLabel) {
            difficultyLabel.string = '难度: ' + '★'.repeat(data.difficulty) + '☆'.repeat(5 - data.difficulty);
        }

        // 设置锁定状态
        const lockNode = item.getChildByName('LockIcon');
        if (lockNode) {
            lockNode.active = !data.unlocked;
        }

        // 设置开始按钮状态
        const startButton = item.getChildByName('StartButton')?.getComponent(Button);
        if (startButton) {
            // 只有已解锁且已开发的关卡才可点击
            startButton.interactable = data.unlocked && data.developed;
            startButton.node.on(Button.EventType.CLICK, () => {
                this.onLevelSelected(data.id, data.developed);
            }, this);
        }

        // 设置关卡图片（如果有）
        if (data.imgPath) {
            const previewImage = item.getChildByName('PreviewImage')?.getComponent(Sprite);
            if (previewImage) {
                // 加载图片资源
                resources.load(data.imgPath, SpriteFrame, (err, asset) => {
                    if (!err && asset) {
                        previewImage.spriteFrame = asset;
                    }
                });
            }
        }

        // 设置背景颜色（根据是否解锁和是否开发使用不同颜色）
        const bgNode = item.getChildByName('Background')?.getComponent(Sprite);
        if (bgNode) {
            if (!data.unlocked) {
                // 未解锁关卡
                bgNode.color = new Color(200, 200, 200, 255);
            } else if (!data.developed) {
                // 已解锁但未开发的关卡
                bgNode.color = new Color(230, 230, 180, 255);
            } else {
                // 已解锁且已开发的关卡
                bgNode.color = new Color(255, 255, 255, 255);
            }
        }
    }

    /**
     * 选择关卡回调
     */
    onLevelSelected(levelId: number, developed: boolean) {
        console.log('选择关卡:', levelId);
        
        if (!developed) {
            // 如果关卡未开发，显示提示
            this.showToast("此关卡正在开发中");
            return;
        }
        
        // TODO: 这里应该跳转到游戏场景，并传递关卡ID
        // director.loadScene('Game', { levelId });
    }

    /**
     * 返回按钮点击回调
     */
    onBackButtonClick() {
        console.log('返回主菜单');
        director.loadScene('Main');
    }

    /**
     * 显示提示消息
     */
    showToast(text: string) {
        // 添加空值检查
        if (!this.toastNode || !this.toastLabel) {
            console.error("Toast节点或Label未正确设置");
            return;
        }
        
        this.toastLabel.string = text;
        this.toastNode.active = true;
        
        // 2秒后自动隐藏
        setTimeout(() => {
            // 再次检查防止场景已切换
            if (this.toastNode) {
                this.toastNode.active = false;
            }
        }, 2000);
    }
} 