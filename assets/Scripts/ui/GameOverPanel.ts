import { _decorator, Component, Node, Label, Button, director } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 游戏结束面板控制器
 */
@ccclass('GameOverPanel')
export class GameOverPanel extends Component {
    @property(Label)
    resultLabel: Label = null!;

    @property(Label)
    messageLabel: Label = null!;

    @property(Button)
    returnButton: Button = null!;

    @property
    mainMenuScene: string = 'Main';

    onLoad() {
        // 注册按钮事件
        this.returnButton.node.on('click', this.onReturnButtonClicked, this);
    }

    /**
     * 显示游戏结束面板
     * @param isVictory 是否胜利
     * @param enemyCount 消灭的敌人数量
     */
    public showGameOver(isVictory: boolean, enemyCount: number = 0) {
        // 设置显示状态
        this.node.active = true;

        // 更新文本内容
        if (isVictory) {
            this.resultLabel.string = "成功！";
            this.messageLabel.string = `共消灭${enemyCount}个敌人`;
        } else {
            this.resultLabel.string = "失败！";
            this.messageLabel.string = "您的大本营已被攻陷";
        }
    }

    /**
     * 返回按钮点击处理
     */
    private onReturnButtonClicked() {
        console.log("返回主菜单");
        director.loadScene(this.mainMenuScene);
    }
} 