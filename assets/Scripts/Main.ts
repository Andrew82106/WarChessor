import { _decorator, Component, AudioSource,Node, Label, Button, Color, tween, Vec3, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('Main')
export class Main extends Component {
    @property(Node)
    public background: Node = null!;

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
        // 设置背景尺寸铺满屏幕
        // 不用设置了，在cocos中进行设置
        // 以后的内容都在cocos中写，不要写在这里
        // if (this.background) {
        //     const canvasSize = this.node.getComponent(UITransform).contentSize;
        //     this.background.getComponent(UITransform).setContentSize(canvasSize);
        // }

        // 设置标题
        if (this.titleLabel) {
            this.titleLabel.string = "WarChessor";
            //this.titleLabel.fontSize = 60;
            this.titleLabel.color = new Color(255, 255, 255, 255);
        }

        // 设置本地对战按钮
        if (this.LocalGameButton) {
            const startLabel = this.LocalGameButton.getComponentInChildren(Label);
            //startLabel.string = "本地对战";
            //startLabel.fontSize = 23;
            
            // 注册按钮点击事件
            this.LocalGameButton.node.on(Button.EventType.CLICK, this.onLocalGame, this);
            console.log("绑定本地对战按钮事件");    
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
    }

    onLocalGame() {
        console.log("进入了onLocalGame方法");
        console.log("点击了本地对战按钮");
        this.buttonClickSound.play();
        
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

    /*showToast(text: string) {
        this.toastLabel.string = text;
        this.toastNode.active = true;
        
        // 2秒后自动隐藏
        setTimeout(() => {
            this.toastNode.active = false;
        }, 2000);
    }*/

    showToast(text: string) {
        this.toastLabel.string = text;
        this.toastNode.active = true;
        
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
    }
} 