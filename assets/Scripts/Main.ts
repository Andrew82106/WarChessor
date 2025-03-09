import { _decorator, Component, AudioSource,Node, Label, Button, Color, tween, Vec3, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Main')
export class Main extends Component {
    @property(Node)
    public background: Node = null!; // 这里就定义了在组件中要插入的数据项是什么类型的，这个就是一个Node节点，下面还有Button，Label等类型

    @property(Node)
    public titleNode: Node = null!;
    
    @property(Label)
    public titleLabel: Label = null!;

    @property(Button)
    public LocalGameButton: Button = null!;
    
    @property(Button)
    public OnlineGameButton: Button = null!;

    @property(AudioSource)
    public buttonClickSound: AudioSource = null!;

    @property(Label)
    public toastLabel: Label = null!;

    @property(Node)
    public toastNode: Node = null!;

    start() {
        console.log("进入了start方法");
        // 程序一开始就从这里进入的逻辑
        // 设置背景尺寸铺满屏幕
        // 不用设置了，在cocos中进行设置
        // 以后的内容都在cocos中写，不要写在这里
        // if (this.background) {
        //     const canvasSize = this.node.getComponent(UITransform).contentSize;
        //     this.background.getComponent(UITransform).setContentSize(canvasSize);
        // }

        // 设置标题
        // 这里的this应该就是cocos中的Main场景中的Canvas节点，因为这个节点挂载了Main脚本
        if (this.titleLabel) {
            // 这个if的含义应该是，当this.titleLabel不为空时就进入这个if，如果在cocos中Canvas节点的titleLabel挂在了某个节点，那么this.titleLabel就是那个节点，这个if里面的条件也满足
            this.titleLabel.string = "WarChessor";
            // 相当于将Canvas节点的titleLabel的string属性设置为"WarChessor"
            // 在代码中，titleLabel是和Title节点绑定的，因此this.titleLabel.string = "WarChessor"相当于将Title节点的string属性设置为"WarChessor"
            //this.titleLabel.fontSize = 60;
            this.titleLabel.color = new Color(255, 255, 255, 255);
        }

        // 设置本地对战按钮
        if (this.LocalGameButton) {
            const startLabel = this.LocalGameButton.getComponentInChildren(Label);
            // getComponentInChildren的意思就是递归查找所有子节点中第一个匹配指定类型的组件
            // 找到了之后就可以进行文本的设置了
            // 我们在这里不进行设置
            //startLabel.string = "本地对战";
            //startLabel.fontSize = 23;
            
            // 注册按钮点击事件
            this.LocalGameButton.node.on(Button.EventType.CLICK, this.onLocalGame, this);
            /*
                this.LocalGameButton：这是一个按钮对象，通常是一个UI组件，代表游戏中的'本地游戏'按钮。
                node：这是Cocos Creator中每个组件的基本属性，表示该组件所附加的节点。按钮是附加在一个节点上的，使用node可以访问这个节点。
                on：这是一个事件监听方法，用于注册一个事件处理函数。当指定的事件发生时，注册的函数会被调用。
                Button.EventType.CLICK：这是一个事件类型，表示按钮被点击时触发的事件。在这里，它指定了我们要监听的事件是“点击”。
                this.onLocalGame：这是一个方法，也写在Main脚本中，表示当按钮被点击时要执行的回调函数。这个函数通常会包含启动本地游戏的逻辑。
                this：这是上下文参数，表示在调用onLocalGame方法时，this的指向仍然是当前的类实例。这是为了确保在onLocalGame方法中可以访问到类的其他属性和方法。
            */ 
        }

        // 设置联机对战按钮
        if (this.OnlineGameButton) {
            const settingsLabel = this.OnlineGameButton.getComponentInChildren(Label);
            //settingsLabel.string = "联机对战";
            //settingsLabel.fontSize = 23;
            
            // 注册按钮点击事件
            this.OnlineGameButton.node.on(Button.EventType.CLICK, this.onOnlineGame, this);
            console.log("绑定联机对战按钮事件");
        }

        // 在start方法添加
        this.toastNode.active = false;
        // 一开始就将toastNode设置为false，表示一开始不显示toast
        // 在cocos中，toastNode是一个节点，表示一个UI组件，通常是一个UI节点，代表游戏中的'toast'节点。这个设置其实在cocos中也可以设置
    }

    onLocalGame() {
        console.log("进入了onLocalGame方法");
        console.log("点击了本地对战按钮");
        this.buttonClickSound.play();
        // 播放按钮点击声音
        
        // 跳转到关卡选择页面
        director.loadScene('Chooselevel');
    }

    onOnlineGame() {
        console.log("进入了onOnlineGame方法");
        console.log("点击了联机对战按钮");
        this.buttonClickSound.play();
        
        // 显示提示
        this.showToast("远征系统正在开发中");
    }

    showToast(text: string) {
        this.toastLabel.string = text;
        this.toastNode.active = true;
        // 设置toastNode为true，表示显示toast，在start函数中已经设置为false了，这里进行一个重定
        
        // 使用新的tween API
        tween(this.toastNode)
            .set({ scale: new Vec3(0, 0, 0) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .delay(1)
            .to(0.1, { scale: new Vec3(0, 0, 0) })
            .call(() => {
                this.toastNode.active = false;
            })
            .start();
        /*
        tween(this.toastNode)：创建一个新的tween动画，目标是toastNode，即要进行动画的UI节点。
        .set({ scale: new Vec3(0, 0, 0) })：将toastNode的初始缩放设置为(0, 0, 0)，这意味着它在开始时是不可见的。
        .to(0.1, { scale: new Vec3(1, 1, 1) })：在0.1秒内将toastNode的缩放动画到(1, 1, 1)，即恢复到正常大小，使其可见。
        .delay(1)：在正常大小状态下延迟1秒，保持提示消息可见。
        .to(0.1, { scale: new Vec3(0, 0, 0) })：在接下来的0.1秒内将toastNode的缩放再次动画到(0, 0, 0)，即逐渐隐藏它。
        .call(() => { this.toastNode.active = false; })：在动画完成后调用一个回调函数，将toastNode的active属性设置为false，这意味着它将不再显示在场景中。
        .start()：启动这个tween动画，使其开始执行。
        */
    }
} 