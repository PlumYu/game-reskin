import { _decorator, Component, Node, Label, Graphics, UITransform, Color, Size } from 'cc';
import GameApp from './Core/GameApp';
import SfxManager from './Core/SfxManager';
import { createNode, createLabel, createFullScreenOverlay, createRoundedButton, getScreenSize, COLOR_WHITE } from './Utils/UIBuilder';

const { ccclass } = _decorator;

@ccclass('AntiAddictionPanel')
export default class AntiAddictionPanel extends Component {
    private exitBtn!: Node;

    onLoad(): void {
        this.buildUI();
    }

    private buildUI(): void {
        const screenSize = getScreenSize();
        const ut = this.node.getComponent(UITransform)!;
        ut.setContentSize(screenSize);

        createFullScreenOverlay('bgOverlay', this.node, new Color(0, 0, 0, 255), 185);

        const card = createNode('card', this.node);
        const cardW = 560;
        const cardH = 460;
        card.getComponent(UITransform)!.setContentSize(new Size(cardW, cardH));
        const cg = card.addComponent(Graphics);
        cg.fillColor = new Color(247, 249, 255, 255);
        cg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 24);
        cg.fill();

        const title = createLabel('title', card, '当前无法继续游戏', 34, new Color(186, 70, 70, 255), true);
        title.node.setPosition(0, 145, 0);

        const desc = createLabel('desc', card, GameApp.antiAddictionMessage, 22, new Color(90, 106, 136, 255));
        desc.node.getComponent(UITransform)!.setContentSize(new Size(450, 120));
        desc.overflow = Label.Overflow.SHRINK;
        desc.node.setPosition(0, 20, 0);

        const tips = createLabel('tips', card, '请稍后再试，或更换已通过平台限制校验的账号进入。', 18, new Color(120, 132, 156, 255));
        tips.node.getComponent(UITransform)!.setContentSize(new Size(450, 60));
        tips.overflow = Label.Overflow.SHRINK;
        tips.node.setPosition(0, -70, 0);

        const exit = createRoundedButton('exitBtn', card, '关闭小游戏', 260, 64, new Color(58, 118, 235, 255), COLOR_WHITE, 22, 16);
        exit.node.setPosition(0, -155, 0);
        this.exitBtn = exit.node;
    }

    onEnable(): void {
        this.exitBtn.on(Node.EventType.TOUCH_END, this.onExit, this);
    }

    onDisable(): void {
        this.exitBtn.off(Node.EventType.TOUCH_END, this.onExit, this);
    }

    private onExit(): void {
        SfxManager.instance.playUiClick();
        const wxApi = (globalThis as { wx?: { exitMiniProgram?: () => void } }).wx;
        wxApi?.exitMiniProgram?.();
    }
}

export function createAntiAddictionPanel(parent: Node): Component {
    const node = createNode('AntiAddictionPanel', parent);
    return node.addComponent(AntiAddictionPanel);
}
