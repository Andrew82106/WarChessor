import { _decorator, AudioSource, Component, Node, ScrollView, Prefab, instantiate, Label, Button, UITransform, JsonAsset, director, Vec3, Sprite, Color, resources, SpriteFrame } from 'cc';
const { ccclass, property } = _decorator;

// 定义关卡数据接口
interface LevelData {
    id: number | string;  // 关卡ID可以是数字或字符串
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
                // 将jsonData.levels赋值给levelDataList，也就是将关卡数据赋值给levelDataList
                this.createLevelItems();
                // 调用createLevelItems方法，创建关卡项目
            } else {
                console.error('关卡数据格式不正确');
            }
        });
        /*
        在这段代码中，`this`指的是当前的`ChooseLevel`类的实例。
        具体来说，`this`的上下文是`ChooseLevel`组件的实例，它是一个继承自`Component`的类。

        ### 详细解释：
        1. **上下文**：在JavaScript和TypeScript中，`this`的值取决于函数的调用方式。
        在类的方法中，`this`通常指向该类的实例。

        2. **在`loadLevelData`方法中**：
        - 当`loadLevelData`方法被调用时，`this`指向当前的`ChooseLevel`实例。
        - 这使得我们可以访问该实例的属性和方法，例如`this.levelDataList`、`this.createLevelItems()`等。

        3. **在回调函数中**：
        - `resources.load`方法的回调函数是一个匿名函数。
        在这个回调中，`this`的值会发生变化，通常会指向全局对象（在浏览器中是`window`），而不是`ChooseLevel`实例。
        - 为了保持`this`的正确指向，通常会在类的方法中使用箭头函数（如`() => {}`），
        因为箭头函数不会创建自己的`this`上下文，而是继承外部上下文的`this`。

        ### 总结：
        在`loadLevelData`方法中，`this`指的是`ChooseLevel`类的实例，允许我们访问该实例的属性和方法。
        确保在回调中使用箭头函数可以保持`this`的正确指向。

        */
    }

    /**
     * 创建关卡项目
     */
    createLevelItems() {
        if (!this.content || !this.levelItemPrefab) {
            // 这里的this就是指的ChooseLevel类的实例，也就是cocos中ChooseLevel场景中Canvas节点，因为其挂载了ChooseLevel脚本
            console.error('缺少必要组件: content或levelItemPrefab');
            return;
        }

        // 清空内容区域
        this.content.removeAllChildren();
        // 清空content节点下的所有子节点，也就是清空关卡项目，也就是cocos中ChooseLevel场景中ScrollView节点下view节点下的content节点下的所有子节点
        // 计算项目间的垂直间距
        const padding = 20;
        let posY = 0;

        // 获取ScrollView的宽度
        const scrollViewWidth = this.scrollView.getComponent(UITransform)?.contentSize.width || 600;
        // 获取ScrollView的宽度，也就是cocos中ChooseLevel场景中ScrollView节点宽度，如果获取不到，则默认宽度为600
        
        // 动态创建关卡项目
        for (let i = 0; i < this.levelDataList.length; i++) {
            // 遍历levelDataList，也就是遍历关卡数据
            const levelData = this.levelDataList[i];
            // 将levelDataList[i]赋值给levelData，也就是将当前遍历到的关卡数据赋值给levelData
            
            // 实例化预制体
            const levelItem = instantiate(this.levelItemPrefab);
            /*
            详细解释：
                this.levelItemPrefab：
                这是一个预制体（Prefab），通常在Cocos Creator中用于创建可重复使用的游戏对象。
                预制体可以包含各种组件和属性，定义了一个对象的外观和行为。
                在ChooseLevel类中，levelItemPrefab是通过@property(Prefab)装饰器定义的，
                意味着它可以在Cocos Creator的编辑器中被赋值。
                
                instantiate(...)：
                instantiate是Cocos Creator提供的一个方法，用于创建预制体的实例。
                调用这个方法会返回一个新的节点（Node），这个节点是levelItemPrefab的一个副本。
                这个新创建的节点会包含levelItemPrefab中定义的所有组件和属性。
                
                const levelItem：
                这行代码将新创建的节点赋值给levelItem变量。之后，levelItem可以用来进行进一步的操作，
                比如设置位置、添加到场景中、修改其属性等。
            总结：
                这句代码的主要作用是创建一个新的关卡项目（level item），这个项目是从预制体levelItemPrefab实例化而来的。
                之后，程序可以对这个实例进行设置和操作，以便在关卡选择界面中显示每个关卡的相关信息。
                这里的预制体在挂载的时候就已经传进来了
            */
            this.content.addChild(levelItem);
            // 将levelItem添加到content节点下，也就是将关卡项目添加到ScrollView节点下view节点下的content节点下
            // 这就实现了添加一个关卡项目

            // 设置当前这个关卡的关卡项目节点尺寸占满ScrollView宽度
            const itemTransform = levelItem.getComponent(UITransform);
            if (itemTransform) {
                itemTransform.setContentSize(scrollViewWidth - 40, 150); // 保留左右边距
            }

            // 设置位置（使用布局组件更可靠）
            levelItem.setPosition(0, posY, 0);
            posY -= (itemTransform?.height || 150) + padding;
            // 这里做减法，是因为posY是累加的，所以每次都要减去当前关卡项目的高度和间距

            // 设置关卡数据，因为此时的levelItem是预制体，还没有填数据，并且levelData是关卡数据，还没有和levelItem绑定
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
        // 这个函数的作用就是将关卡数据和关卡项目绑定，将data绑定到item上
        // 设置关卡ID
        const levelItem = item.getComponent('LevelItem');
        // 这里为什么是取item下的LevelItem组件呢？
        // 因为levelItem变量是通过item.getComponent('LevelItem')获取的，它代表了挂载在item节点上的LevelItem.ts脚本的实例。
        /*
        详细解释：
            预制体（Prefab）：
            在Cocos Creator中，预制体是一个可以重复使用的游戏对象模板。它可以包含多个组件和属性，定义了对象的外观和行为。
            在您的情况下，levelItemPrefab是一个预制体，其中挂载了LevelItem.ts脚本。

            item：
            item是通过instantiate(this.levelItemPrefab)创建的一个节点（Node），它是levelItemPrefab的一个实例。
            这个节点包含了所有在预制体中定义的组件，包括LevelItem.ts脚本。

            getComponent('LevelItem')：
            这行代码用于从item节点中获取名为LevelItem的组件实例。
            由于LevelItem.ts是一个组件脚本，getComponent方法会返回该脚本的实例，允许您访问和修改该组件中的属性和方法。
            哦对，脚本也是一个组件，所以脚本也是可以获取的
            
            levelItem：
            levelItem变量就是item节点上挂载的LevelItem.ts脚本的实例。通过这个变量，您可以调用LevelItem中的方法和访问其属性。
        */
        if (levelItem) {
            // 检查ID是否为字符串格式的"level1"，如果是则提取数字部分
            let numericId = typeof data.id === 'number' ? data.id : 1;
            // 如果data.id是数字，则将data.id赋值给numericId，否则将1赋值给numericId
            if (typeof data.id === 'string' && data.id.startsWith('level')) {
                numericId = parseInt(data.id.replace('level', ''), 10);
                // 如果data.id是字符串，并且以"level"开头，则将data.id中的"level"去掉，并转换为数字，赋值给numericId
            }
            // 使用类型断言
            (levelItem as any).setLevelId(numericId);
            // 使用类型断言，将levelItem转换为any类型，然后调用setLevelId方法，设置关卡ID
            /*
            为什么要使用类型断言：
                类型不匹配：
                levelItem是通过getComponent('LevelItem')获取的，通常会返回一个特定类型的组件实例。
                如果LevelItem组件的类型没有在TypeScript中明确声明，或者在当前上下文中无法推断出其类型，TypeScript会认为levelItem的类型是unknown或不明确的类型。
                避免类型错误：
                使用as any可以绕过TypeScript的类型检查，允许我们调用setLevelId方法，而不必担心编译时的类型错误。
                这在某些情况下是有用的，尤其是在快速开发或原型设计阶段，但在生产代码中，最好避免使用any，因为它会失去类型安全的好处。
                确保方法可用：
                通过类型断言，我们告诉TypeScript编译器“我知道这个对象是什么类型”，并且它确实有setLevelId方法。这样可以避免编译器在调用该方法时抛出错误。
            
            总结就是因为懒，没写LevelItem类型，导致无法明确这个变量的类型，所以使用类型断言
            */
        }

        // 设置关卡名称
        const nameLabel = item.getChildByName('NameLabel')?.getComponent(Label);
        /*
        在这段代码中：

            ### 问号的作用：
            问号（`?`）是 TypeScript 和 JavaScript 中的可选链（Optional Chaining）运算符。
            它的作用是安全地访问对象的属性或方法，避免在访问过程中出现`null`或`undefined`导致的错误。

            ### 详细解释：
            1. **`item.getChildByName('NameLabel')`**：
            - 这个方法尝试从`item`节点中获取名为`'NameLabel'`的子节点。
            如果该子节点存在，它将返回该节点；如果不存在，则返回`null`。

            2. **`?.`（可选链运算符）**：
            - 当使用可选链运算符时，如果前面的表达式（在这里是`item.getChildByName('NameLabel')`）
                返回`null`或`undefined`，那么整个表达式将短路并返回`undefined`，
                而不会继续执行后面的`getComponent(Label)`方法。
            - 这避免了在尝试调用`getComponent`时出现`TypeError`，
                因为如果`item.getChildByName('NameLabel')`返回`null`，
                直接调用`getComponent`会导致错误。

            3. **`getComponent(Label)`**：
            - 如果`item.getChildByName('NameLabel')`返回一个有效的节点，
                `getComponent(Label)`将被调用，尝试获取该节点上的`Label`组件。

            ### 总结：
            问号（`?`）用于安全地访问对象的属性或方法，避免在对象为`null`或`undefined`时引发错误。
            在这段代码中，它确保了在尝试获取`Label`组件之前，`NameLabel`子节点确实存在，从而提高了代码的健壮性。
        那感觉其实不用问号也可以，报错就行
        */
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
        // 获取LockIcon节点，实际上这个节点没有挂载东西的，所以lockNode为null
        if (lockNode) {
            lockNode.active = !data.unlocked;
        }

        // 设置开始按钮状态
        const startButton = item.getChildByName('StartButton')?.getComponent(Button);
        if (startButton) {
            // 只有已解锁且已开发的关卡才可点击
            startButton.interactable = data.unlocked && data.developed;
            startButton.node.on(Button.EventType.CLICK, () => {
                // 获取关卡的数字ID
                let numId = typeof data.id === 'number' ? data.id : 1;
                if (typeof data.id === 'string' && data.id.startsWith('level')) {
                    numId = parseInt(data.id.replace('level', ''), 10);
                }
                // 调用onLevelSelected方法，传递关卡的数字ID和是否开发
                // 写在这，那么这个函数在点击按钮的时候就会运行
                this.onLevelSelected(numId, data.developed);
            }, this);
            /*
            逐行解释：
                startButton.node.on(Button.EventType.CLICK, () => {...}, this);：

                这行代码为startButton的节点注册了一个点击事件监听器。当用户点击按钮时，回调函数会被调用。
                Button.EventType.CLICK指定了监听的事件类型为点击事件。

                () => {...}是一个箭头函数，表示当按钮被点击时要执行的代码。
                this作为第三个参数传递，确保在回调函数中this仍然指向当前的ChooseLevel实例。

                let numId = typeof data.id === 'number' ? data.id : 1;：
                这行代码用于获取关卡的数字ID。首先检查data.id的类型。
                如果data.id是数字类型，则将其赋值给numId；否则，将numId初始化为1。

                if (typeof data.id === 'string' && data.id.startsWith('level')) {...}：
                这个条件检查data.id是否是字符串类型，并且是否以'level'开头。
                如果条件成立，表示data.id是以'level'格式存储的关卡ID。

                numId = parseInt(data.id.replace('level', ''), 10);：
                这行代码将data.id中的'level'部分去掉，并将剩余的部分转换为数字，赋值给numId。
                parseInt函数用于将字符串转换为整数，第二个参数10表示以十进制解析。

                this.onLevelSelected(numId, data.developed);：
                最后，调用onLevelSelected方法，传递numId（关卡的数字ID）和data.developed（关卡是否已开发的状态）。
                这个方法会处理关卡选择的逻辑，例如加载相应的场景或更新游戏状态。

                对于一个天天写Python的人来说，这种箭头过来箭头过去的写法真的有点变态。

            */
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
        // 点击关卡选择页面的确定按钮就会触发这个函数
        console.log('选择关卡:', levelId);
        
        if (!developed) {
            // 如果关卡未开发，显示提示
            this.showToast("此关卡正在开发中");
            // 其实没开发的关卡点都点不了，这个Toast是不会运行的
            return;
        }
        
        // 播放按钮音效（如果有）
        if (this.buttonClickSound) {
            this.buttonClickSound.play();
        }
        
        // 根据关卡ID准备参数
        // 所有关卡都使用'levelX'格式
        const levelParam = `level${levelId}`;
        
        // 跳转到游戏场景，并传递关卡ID
        // 运行到这里，那就说明用户点击了一个可以进去的关卡，并且准备向这个关卡的页面跳转了
        console.log(`加载LocalGame场景，关卡参数: ${levelParam}`);
        director.loadScene('LocalGame', (err, scene) => {
            if (err) {
                console.error('加载场景失败:', err);
                return;
            }
            // 运行到这里，那就说明LocalGame场景已经加载成功了
            // 找到LocalGameController组件并设置当前关卡ID
            const gameController = scene.getComponentInChildren('LocalGameController');
            if (gameController) {
                // 使用类型断言来设置属性
                (gameController as any).currentLevelId = levelParam;
                console.log(`成功设置关卡ID: ${levelParam}`);
            } else {
                console.error('未找到LocalGameController组件');
            }
        });
        /*
        逐行解释：
            director.loadScene('LocalGame', (err, scene) => {...})：
            director.loadScene是Cocos Creator中的一个方法，用于加载指定名称的场景。
            在这里，我们要加载名为LocalGame的场景。
            该方法接受两个参数：场景名称和一个回调函数。回调函数在场景加载完成后被调用。
            这里的scene就是名为LocalGame的scene的实例
            
            if (err) {...}：
            这个条件检查是否在加载场景时发生了错误。如果err不为null，则表示加载失败。
            如果加载失败，使用console.error输出错误信息，并通过return语句退出回调函数，避免后续代码执行。

            const gameController = scene.getComponentInChildren('LocalGameController');：
            这行代码尝试从加载的场景中获取名为LocalGameController的组件实例。
            实际中，这个组件是一个ts脚本组件，所以这里获取的是一个组件实例
            getComponentInChildren方法会在场景的所有子节点中查找该组件。
            gameController将保存找到的组件实例，如果没有找到，则为null。
            
            if (gameController) {...}：
            这个条件检查是否成功获取到LocalGameController组件实例。如果找到了组件，执行后续代码。

            (gameController as any).currentLevelId = levelParam;：
            这里使用类型断言将gameController转换为any类型，以便访问currentLevelId属性。
            currentLevelId是LocalGameController中的一个属性，用于存储当前关卡的ID。
            levelParam是之前定义的关卡ID，格式为levelX（例如level1、level2等）。

            console.log(成功设置关卡ID: ${levelParam});：
            如果成功设置了关卡ID，输出一条日志，确认设置成功。
            
            else {...}：
            如果没有找到LocalGameController组件，输出错误信息，表示未找到该组件。

            这个函数执行完后，就应该执行LocalGame场景的脚本了，也就是会执行LocalGameController.ts中的onLoad方法。
        */
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