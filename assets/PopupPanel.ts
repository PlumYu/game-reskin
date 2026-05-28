import { _decorator, Component, Node, Label, Sprite, tween, Tween, v3, UITransform, Size, Graphics, Color } from 'cc';
import GameApp from './Core/GameApp';
import { UIID, GameMode } from './Core/Enum';
import SfxManager from './Core/SfxManager';
import CountdownController from './Core/CountdownController';
import {
    createNode, createLabel, createSprite, createFullScreenOverlay, createRoundedButton,
    COLOR_WHITE, COLOR_BLACK,
} from './Utils/UIBuilder';

const { ccclass } = _decorator;

@ccclass('PopupPanel')
export default class PopupPanel extends Component {
    private xgSprite!: Sprite;
    private dec!: Label;
    private useBtn!: Node;
    private useBtnLabel!: Label;
    private closeBtn!: Node;

    onLoad(): void {
        this.buildUI();
    }

    private buildUI(): void {
        createFullScreenOverlay('bgOverlay', this.node, COLOR_BLACK, 150);

        const card = createNode('card', this.node);
        const ut = card.getComponent(UITransform)!;
        const cardW = 540;
        const cardH = 430;
        ut.setContentSize(new Size(cardW, cardH));
        card.setPosition(0, 20, 0);
        const cardG = card.addComponent(Graphics);
        cardG.fillColor = new Color(35, 68, 112, 62);
        cardG.roundRect(-cardW / 2 + 8, -cardH / 2 - 10, cardW - 16, cardH, 30);
        cardG.fill();
        cardG.fillColor = new Color(247, 252, 255, 252);
        cardG.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 28);
        cardG.fill();
        cardG.strokeColor = new Color(179, 213, 243, 230);
        cardG.lineWidth = 3;
        cardG.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 28);
        cardG.stroke();
        cardG.fillColor = new Color(229, 243, 255, 255);
        cardG.roundRect(-cardW / 2 + 28, cardH / 2 - 98, cardW - 56, 72, 20);
        cardG.fill();

        this.xgSprite = createSprite('xg', card, new Color(255, 255, 255, 0), new Size(1, 1));
        this.xgSprite.node.active = false;
        this.drawPromptIcon(card, -180, 112, 94);

        const title = createLabel('title', card, '课堂提示', 34, new Color(42, 80, 132, 255), true);
        title.node.getComponent(UITransform)!.setContentSize(new Size(300, 48));
        title.node.setPosition(40, 112, 0);

        this.dec = createLabel('dec', card, '', 25, new Color(68, 88, 120, 255));
        this.dec.node.getComponent(UITransform)!.setContentSize(new Size(430, 72));
        this.dec.node.setPosition(0, 26, 0);
        this.dec.lineHeight = 34;
        this.dec.overflow = Label.Overflow.SHRINK;

        const btn = createRoundedButton('useBtn', card, '', 320, 68, new Color(63, 132, 232, 255), COLOR_WHITE, 26, 24);
        btn.node.setPosition(0, -118, 0);
        this.useBtn = btn.node;
        this.useBtnLabel = btn.label;

        const close = createRoundedButton('closeBtn', card, '×', 64, 64, new Color(238, 246, 255, 255), new Color(74, 100, 136, 255), 30, 32);
        close.node.setPosition(218, 160, 0);
        this.closeBtn = close.node;
    }

    private drawPromptIcon(parent: Node, x: number, y: number, size: number): void {
        const icon = createNode('promptClipboardIcon', parent);
        icon.setPosition(x, y, 0);
        icon.getComponent(UITransform)!.setContentSize(new Size(size, size));
        const g = icon.addComponent(Graphics);
        const s = size / 100;
        g.fillColor = new Color(44, 98, 160, 60);
        g.roundRect(-34 * s + 4, -38 * s - 5, 68 * s, 76 * s, 12 * s);
        g.fill();
        g.fillColor = COLOR_WHITE;
        g.roundRect(-36 * s, -38 * s, 72 * s, 76 * s, 12 * s);
        g.fill();
        g.strokeColor = new Color(63, 132, 232, 255);
        g.lineWidth = Math.max(3, 4 * s);
        g.roundRect(-36 * s, -38 * s, 72 * s, 76 * s, 12 * s);
        g.stroke();
        g.fillColor = new Color(255, 207, 42, 255);
        g.roundRect(-18 * s, 28 * s, 36 * s, 14 * s, 7 * s);
        g.fill();
        g.strokeColor = new Color(63, 132, 232, 255);
        g.lineWidth = Math.max(2, 3 * s);
        for (let i = 0; i < 3; i++) {
            const rowY = 13 * s - i * 20 * s;
            g.rect(-20 * s, rowY - 5 * s, 10 * s, 10 * s);
            g.moveTo(-2 * s, rowY);
            g.lineTo(22 * s, rowY);
        }
        g.stroke();
    }

    onEnable(): void {
        if (this.xgSprite.node.active) {
            tween(this.xgSprite.node)
                .by(1, { eulerAngles: v3(0, 0, -180) })
                .repeatForever()
                .start();
        }

        if (GameApp.popupIndex === 1) {
            this.dec.string = '点名册：直接锁定一个座位';
            this.useBtnLabel.string = '继续游戏';
        } else if (GameApp.popupIndex === 2) {
            this.dec.string = '确认返回主菜单?';
            this.useBtnLabel.string = '返回主菜单';
        }

        // Pause countdown in survival mode
        if (GameApp.gameMode === GameMode.survival) {
            const cdc = GameApp.countDownControl as CountdownController | null;
            cdc?.pauseCountDown();
        }

        this.useBtn.on(Node.EventType.TOUCH_END, this.onUseBtnClick, this);
        this.closeBtn.on(Node.EventType.TOUCH_END, this.onCloseBtnClick, this);
    }

    onDisable(): void {
        Tween.stopAllByTarget(this.xgSprite.node);
        this.useBtn.off(Node.EventType.TOUCH_END, this.onUseBtnClick, this);
        this.closeBtn.off(Node.EventType.TOUCH_END, this.onCloseBtnClick, this);
    }

    private onUseBtnClick(): void {
        SfxManager.instance.playUiClick();
        if (GameApp.popupIndex === 1) {
            GameApp.uiManager?.close(UIID.PopupPanel);
            // Resume countdown in survival mode
            if (GameApp.gameMode === GameMode.survival) {
                const cdc = GameApp.countDownControl as CountdownController | null;
                cdc?.startCountDown();
            }
        } else if (GameApp.popupIndex === 2) {
            // Stop countdown before returning to menu
            if (GameApp.gameMode === GameMode.survival) {
                const cdc = GameApp.countDownControl as CountdownController | null;
                cdc?.endCountDown();
            }
            GameApp.isStartGame = false;
            const dg = GameApp.drawGrid as { setGameUIVisible?: (v: boolean) => void };
            dg?.setGameUIVisible?.(false);
            GameApp.uiManager?.closeAndOpen(UIID.PopupPanel, UIID.MainPanel);
        }
    }

    private onCloseBtnClick(): void {
        SfxManager.instance.playUiClick();
        GameApp.uiManager?.close(UIID.PopupPanel);
        // Resume countdown in survival mode
        if (GameApp.gameMode === GameMode.survival) {
            const cdc = GameApp.countDownControl as CountdownController | null;
            cdc?.startCountDown();
        }
    }
}

export function createPopupPanel(parent: Node): Component {
    const node = createNode('PopupPanel', parent);
    return node.addComponent(PopupPanel);
}
