import { _decorator, Component, Node, Label, Button, Sprite } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LevelItem')
export class LevelItem extends Component {
    @property(Label)
    public nameLabel: Label = null!;

    @property(Label)
    public descriptionLabel: Label = null!;

    @property(Label)
    public difficultyLabel: Label = null!;

    @property(Button)
    public startButton: Button = null!;

    @property(Node)
    public lockIcon: Node = null!;

    @property(Sprite)
    public previewImage: Sprite = null!;

    @property(Sprite)
    public background: Sprite = null!;

    private levelId: number = 0;

    /**
     * 设置关卡ID
     * @param id 关卡ID
     */
    setLevelId(id: number) {
        this.levelId = id;
    }

    /**
     * 获取关卡ID
     * @returns 关卡ID
     */
    getLevelId(): number {
        return this.levelId;
    }
} 