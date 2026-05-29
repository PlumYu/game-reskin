import { _decorator, Component, Node, Label, Sprite, tween, Tween, v3, UITransform, Size } from 'cc';
import GameApp from './Core/GameApp';
import { UIID, GameMode } from './Core/Enum';
import SfxManager from './Core/SfxManager';
import CountdownController from './Core/CountdownController';
import {
    createNode, createLabel, createButton, createSprite, createFullScreenOverlay,
    COLOR_DARK_BLUE, COLOR_GOLD, COLOR_WHITE, COLOR_BLACK, COLOR_DEEP_NAVY,
    COLOR_LIGHT_GRAY, COLOR_GRAY,
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
        createFullScreenOverlay('bgOverlay', this.node, COLOR_BLACK, 128);

        const card = createNode('card', this.node);
        const ut = card.getComponent(UITransform)!;
        ut.setContentSize(new Size(560, 400));
        createSprite('cardBg', card, COLOR_DARK_BLUE, new Size(560, 400));

        this.xgSprite = createSprite('xg', card, COLOR_WHITE, new Size(80, 80));
        this.xgSprite.node.setPosition(0, 130, 0);

        this.dec = createLabel('dec', card, '', 24, COLOR_LIGHT_GRAY);
        this.dec.node.setPosition(0, 40, 0);

        const btn = createButton('useBtn', card, '', 320, 88, COLOR_GOLD, COLOR_DEEP_NAVY, 24);
        btn.node.setPosition(0, -60, 0);
        this.useBtn = btn.node;
        this.useBtnLabel = btn.label;

        const close = createButton('closeBtn', card, '✕', 88, 88, COLOR_DARK_BLUE, COLOR_GRAY, 24);
        close.node.setPosition(220, 160, 0);
        this.closeBtn = close.node;
    }

    onEnable(): void {
        tween(this.xgSprite.node)
            .by(1, { eulerAngles: v3(0, 0, -180) })
            .repeatForever()
            .start();

        if (GameApp.popupIndex === 1) {
            this.dec.string = '奶茶雷达：直接锁一格';
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
