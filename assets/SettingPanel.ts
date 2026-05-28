import { _decorator, Component, Node, Label, Graphics, UITransform, Color, Size, tween, v3 } from 'cc';
import GameApp from './Core/GameApp';
import { GameMode, UIID } from './Core/Enum';
import SfxManager from './Core/SfxManager';
import CountdownController from './Core/CountdownController';
import {
    createNode, createLabel, createFullScreenOverlay, getScreenSize, addButtonFeedback,
    COLOR_DARK_BLUE, COLOR_WHITE, COLOR_RED, COLOR_TITLE_NAVY,
    COLOR_TOGGLE_BLUE, COLOR_TOGGLE_GRAY, COLOR_SETTING_BG,
} from './Utils/UIBuilder';

const { ccclass } = _decorator;

@ccclass('SettingPanel')
export default class SettingPanel extends Component {
    private bgmToggle!: Node;
    private sfxToggle!: Node;
    private vibrateToggle: Node | null = null;
    private nightToggle: Node | null = null;
    private closeBtn!: Node;

    private bgmDot!: Node;
    private sfxDot!: Node;
    private vibrateDot: Node | null = null;
    private nightDot: Node | null = null;

    private bgmStatusLabel!: Label;
    private sfxStatusLabel!: Label;
    private vibrateStatusLabel: Label | null = null;
    private nightStatusLabel: Label | null = null;

    private backBtn: Node | null = null;
    private survivalExitConfirmRoot: Node | null = null;

    private readonly settingCardY = 100;

    public isInGame: boolean = false;

    onLoad(): void {
        this.isInGame = GameApp.isStartGame;
        this.buildUI();
    }

    private buildUI(): void {
        const screenSize = getScreenSize();
        const ut = this.node.getComponent(UITransform)!;
        ut.setContentSize(screenSize);

        createFullScreenOverlay('bgOverlay', this.node, new Color(0, 0, 0, 255), 170);

        const card = createNode('card', this.node);
        card.setPosition(0, this.settingCardY, 0);
        card.setScale(v3(1.25, 1.25, 1));
        const cardW = 360;
        const cardH = 470;
        const cardUt = card.getComponent(UITransform)!;
        cardUt.setContentSize(new Size(cardW, cardH));

        const cardG = card.addComponent(Graphics);
        cardG.fillColor = new Color(35, 68, 112, 58);
        cardG.roundRect(-cardW / 2 + 8, -cardH / 2 - 10, cardW - 16, cardH, 32);
        cardG.fill();
        cardG.fillColor = new Color(247, 252, 255, 255);
        cardG.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 30);
        cardG.fill();
        cardG.strokeColor = new Color(181, 215, 244, 230);
        cardG.lineWidth = 2;
        cardG.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 30);
        cardG.stroke();
        cardG.fillColor = new Color(63, 132, 232, 255);
        cardG.roundRect(-cardW / 2 + 22, cardH / 2 - 88, cardW - 44, 66, 20);
        cardG.fill();
        cardG.fillColor = new Color(255, 255, 255, 54);
        cardG.roundRect(-cardW / 2 + 48, cardH / 2 - 42, cardW - 96, 8, 4);
        cardG.fill();
        cardG.strokeColor = new Color(180, 213, 243, 130);
        cardG.lineWidth = 1.5;
        for (let y = cardH / 2 - 118; y > -cardH / 2 + 78; y -= 44) {
            cardG.moveTo(-cardW / 2 + 64, y);
            cardG.lineTo(cardW / 2 - 36, y);
        }
        cardG.stroke();
        this.drawNotebookRings(card, -cardW / 2 + 30, cardH / 2 - 128);

        // 标题
        const title = createLabel('title', card, '点名设置', 32, COLOR_WHITE, true);
        title.node.getComponent(UITransform)!.setContentSize(new Size(cardW - 90, 44));
        title.node.setPosition(10, cardH / 2 - 56, 0);

        // 背景音乐 toggle
        this.bgmToggle = this.buildToggleRow(card, 'music', cardH / 2 - 132, SfxManager.instance.isBgmEnabled());
        this.bgmDot = this.bgmToggle.getChildByName('dot')!;
        this.bgmStatusLabel = this.bgmToggle.getChildByName('status')!.getComponent(Label)!;

        // 游戏音效 toggle
        this.sfxToggle = this.buildToggleRow(card, 'sound', cardH / 2 - 218, SfxManager.instance.isSfxEnabled());
        this.sfxDot = this.sfxToggle.getChildByName('dot')!;
        this.sfxStatusLabel = this.sfxToggle.getChildByName('status')!.getComponent(Label)!;

        this.vibrateToggle = this.buildToggleRow(card, 'vibrate', cardH / 2 - 304, SfxManager.instance.isVibrateEnabled());
        this.vibrateDot = this.vibrateToggle.getChildByName('dot')!;
        this.vibrateStatusLabel = this.vibrateToggle.getChildByName('status')!.getComponent(Label)!;

        // 游戏内只保留退出按钮；关闭叉负责关闭设置并继续游戏。
        if (this.isInGame) {
            const backNode = createNode('backBtn', card);
            backNode.setPosition(0, -cardH / 2 + 48, 0);
            const backUt = backNode.getComponent(UITransform)!;
            const backW = 168;
            const backH = 56;
            backUt.setContentSize(new Size(backW, backH));
            const backG = backNode.addComponent(Graphics);
            backG.fillColor = new Color(63, 132, 232, 245);
            backG.roundRect(-backW / 2, -backH / 2, backW, backH, 18);
            backG.fill();
            createLabel('backLabel', backNode, '结束点名', 22, COLOR_WHITE, true);
            this.backBtn = backNode;
        }

        // 关闭按钮（圆形 X）
        const closeBtnY = -cardH / 2 - 58;
        const closeNode = createNode('closeBtn', card);
        closeNode.setPosition(0, closeBtnY, 0);
        const closeUt = closeNode.getComponent(UITransform)!;
        closeUt.setContentSize(new Size(64, 64));
        const closeG = closeNode.addComponent(Graphics);
        closeG.fillColor = new Color(63, 132, 232, 255);
        closeG.circle(0, 0, 32);
        closeG.fill();
        closeG.strokeColor = new Color(226, 242, 255, 255);
        closeG.lineWidth = 3;
        closeG.circle(0, 0, 29);
        closeG.stroke();
        // X 线条
        closeG.strokeColor = COLOR_WHITE;
        closeG.lineWidth = 9;
        closeG.lineCap = Graphics.LineCap.ROUND;
        closeG.moveTo(-15, 15);
        closeG.lineTo(15, -15);
        closeG.stroke();
        closeG.moveTo(15, 15);
        closeG.lineTo(-15, -15);
        closeG.stroke();
        this.closeBtn = closeNode;
    }

    private drawNotebookRings(parent: Node, x: number, topY: number): void {
        const node = createNode('settingNotebookRings', parent);
        const g = node.addComponent(Graphics);
        for (let i = 0; i < 4; i++) {
            const y = topY - i * 70;
            g.fillColor = new Color(113, 151, 196, 215);
            g.circle(x, y, 7);
            g.fill();
            g.fillColor = new Color(247, 252, 255, 255);
            g.circle(x, y, 3);
            g.fill();
        }
    }

    private buildToggleRow(parent: Node, type: 'music' | 'sound' | 'vibrate', yPos: number, initialState: boolean): Node {
        const row = createNode('row_' + type, parent);
        row.setPosition(0, yPos, 0);
        row.getComponent(UITransform)!.setContentSize(new Size(308, 78));

        const rowG = row.addComponent(Graphics);
        rowG.fillColor = new Color(255, 255, 255, 242);
        rowG.roundRect(-154, -39, 308, 78, 18);
        rowG.fill();
        rowG.strokeColor = new Color(190, 219, 245, 210);
        rowG.lineWidth = 2;
        rowG.roundRect(-154, -39, 308, 78, 18);
        rowG.stroke();
        rowG.fillColor = new Color(63, 132, 232, 255);
        rowG.roundRect(-154, -39, 9, 78, 5);
        rowG.fill();

        this.createSettingIcon(row, type);
        const labelText = type === 'music' ? '背景音乐' : (type === 'sound' ? '按键音效' : '震动反馈');
        const nameLabel = createLabel('name', row, labelText, 22, COLOR_TITLE_NAVY, true);
        nameLabel.node.setPosition(-28, 0, 0);

        // toggle 轨道
        const trackW = 72;
        const trackH = 34;
        const track = createNode('track', row);
        track.setPosition(56, 0, 0);
        const trackUt = track.getComponent(UITransform)!;
        trackUt.setContentSize(new Size(trackW, trackH));

        const trackG = track.addComponent(Graphics);
        const trackColor = initialState ? COLOR_TOGGLE_BLUE : COLOR_TOGGLE_GRAY;
        trackG.fillColor = trackColor;
        trackG.roundRect(-trackW / 2, -trackH / 2, trackW, trackH, trackH / 2);
        trackG.fill();

        // toggle 圆点
        const dot = createNode('dot', row);
        const dotX = initialState ? 74 : 38;
        dot.setPosition(dotX, 0, 0);
        const dotG = dot.addComponent(Graphics);
        dotG.fillColor = COLOR_WHITE;
        dotG.circle(0, 0, 13);
        dotG.fill();

        // 状态文字
        const status = createLabel('status', row, initialState ? '开' : '关', 18, initialState ? COLOR_TOGGLE_BLUE : COLOR_TOGGLE_GRAY);
        status.node.setPosition(108, 0, 0);

        return row;
    }

    private createSettingIcon(parent: Node, type: 'music' | 'sound' | 'vibrate'): void {
        const icon = createNode(`${type}Icon`, parent);
        icon.setPosition(-110, 0, 0);
        icon.getComponent(UITransform)!.setContentSize(new Size(48, 48));

        const g = icon.addComponent(Graphics);
        g.fillColor = new Color(229, 243, 255, 255);
        g.circle(0, 0, 24);
        g.fill();

        g.strokeColor = COLOR_TOGGLE_BLUE;
        g.lineWidth = 4;
        g.lineCap = Graphics.LineCap.ROUND;

        if (type === 'music') {
            g.moveTo(-4, 12);
            g.lineTo(10, 12);
            g.moveTo(-4, 12);
            g.lineTo(-4, -8);
            g.moveTo(10, 12);
            g.lineTo(10, -4);
            g.stroke();
            g.fillColor = COLOR_TOGGLE_BLUE;
            g.circle(-9, -10, 6);
            g.fill();
            g.circle(5, -6, 6);
            g.fill();
            return;
        }

        if (type === 'vibrate') {
            g.strokeColor = COLOR_TOGGLE_BLUE;
            g.lineWidth = 3;
            g.roundRect(-8, -15, 16, 30, 5);
            g.stroke();

            g.lineWidth = 2;
            g.moveTo(-3, 10);
            g.lineTo(3, 10);
            g.stroke();

            g.fillColor = new Color(COLOR_TOGGLE_BLUE.r, COLOR_TOGGLE_BLUE.g, COLOR_TOGGLE_BLUE.b, 80);
            g.roundRect(-5, -8, 10, 15, 3);
            g.fill();

            g.strokeColor = COLOR_TOGGLE_BLUE;
            g.lineWidth = 3;
            g.moveTo(-17, -15);
            g.bezierCurveTo(-26, -10, -8, -5, -17, 0);
            g.bezierCurveTo(-26, 5, -8, 10, -17, 15);
            g.moveTo(17, -15);
            g.bezierCurveTo(26, -10, 8, -5, 17, 0);
            g.bezierCurveTo(26, 5, 8, 10, 17, 15);
            g.stroke();
            return;
        }

        g.fillColor = COLOR_TOGGLE_BLUE;
        g.moveTo(-13, -8);
        g.lineTo(-4, -8);
        g.lineTo(8, -18);
        g.lineTo(8, 18);
        g.lineTo(-4, 8);
        g.lineTo(-13, 8);
        g.close();
        g.fill();
        g.strokeColor = COLOR_TOGGLE_BLUE;
        g.lineWidth = 2.5;
        g.moveTo(13, -11);
        g.bezierCurveTo(17, -7, 17, 7, 13, 11);
        g.moveTo(17, -15);
        g.bezierCurveTo(22, -9, 22, 9, 17, 15);
        g.stroke();
    }

    onEnable(): void {
        addButtonFeedback(this.closeBtn);
        if (this.backBtn) addButtonFeedback(this.backBtn);

        this.bgmToggle.on(Node.EventType.TOUCH_END, this.onBgmToggle, this);
        this.sfxToggle.on(Node.EventType.TOUCH_END, this.onSfxToggle, this);
        this.vibrateToggle?.on(Node.EventType.TOUCH_END, this.onVibrateToggle, this);
        this.nightToggle?.on(Node.EventType.TOUCH_END, this.onNightToggle, this);
        this.closeBtn.on(Node.EventType.TOUCH_END, this.onClose, this);
        if (this.backBtn) this.backBtn.on(Node.EventType.TOUCH_END, this.onBackToMain, this);

        // 生存模式暂停倒计时
        this.pauseSurvivalCountdown();
    }

    onDisable(): void {
        this.bgmToggle.off(Node.EventType.TOUCH_END, this.onBgmToggle, this);
        this.sfxToggle.off(Node.EventType.TOUCH_END, this.onSfxToggle, this);
        this.vibrateToggle?.off(Node.EventType.TOUCH_END, this.onVibrateToggle, this);
        this.nightToggle?.off(Node.EventType.TOUCH_END, this.onNightToggle, this);
        this.closeBtn.off(Node.EventType.TOUCH_END, this.onClose, this);
        if (this.backBtn) this.backBtn.off(Node.EventType.TOUCH_END, this.onBackToMain, this);
        this.destroySurvivalExitConfirm();
    }

    private onBgmToggle(): void {
        SfxManager.instance.playUiClick();
        const newState = !SfxManager.instance.isBgmEnabled();
        SfxManager.instance.setBgmEnabled(newState);
        this.updateToggleVisual(this.bgmToggle, this.bgmDot, this.bgmStatusLabel, newState);
    }

    private onSfxToggle(): void {
        const newState = !SfxManager.instance.isSfxEnabled();
        SfxManager.instance.setSfxEnabled(newState);
        this.updateToggleVisual(this.sfxToggle, this.sfxDot, this.sfxStatusLabel, newState);
        if (newState) SfxManager.instance.playUiClick();
    }

    private onVibrateToggle(): void {
        SfxManager.instance.playUiClick();
        const newState = !SfxManager.instance.isVibrateEnabled();
        SfxManager.instance.setVibrateEnabled(newState);
        if (newState) {
            SfxManager.instance.vibrateShort(30);
        }
        if (this.vibrateToggle && this.vibrateDot && this.vibrateStatusLabel) {
            this.updateToggleVisual(this.vibrateToggle, this.vibrateDot, this.vibrateStatusLabel, newState);
        }
    }

    private onNightToggle(): void {
        SfxManager.instance.playUiClick();
        const newState = !GameApp.user.nightMode;
        GameApp.user.nightMode = newState;
        if (this.nightToggle && this.nightDot && this.nightStatusLabel) {
            this.updateToggleVisual(this.nightToggle, this.nightDot, this.nightStatusLabel, newState);
        }
    }

    private updateToggleVisual(row: Node, dot: Node, statusLabel: Label, enabled: boolean): void {
        const track = row.getChildByName('track')!;
        const trackG = track.getComponent(Graphics)!;
        const trackW = 72;
        const trackH = 34;
        trackG.clear();
        trackG.fillColor = enabled ? COLOR_TOGGLE_BLUE : COLOR_TOGGLE_GRAY;
        trackG.roundRect(-trackW / 2, -trackH / 2, trackW, trackH, trackH / 2);
        trackG.fill();

        const targetX = enabled ? 74 : 38;
        tween(dot).to(0.15, { position: v3(targetX, 0, 0) }).start();

        statusLabel.string = enabled ? '开' : '关';
        statusLabel.color = enabled ? COLOR_TOGGLE_BLUE : COLOR_TOGGLE_GRAY;
    }

    private onBackToMain(): void {
        SfxManager.instance.playUiClick();
        if (GameApp.gameMode === GameMode.survival) {
            this.showSurvivalExitConfirm();
            return;
        }

        GameApp.isStartGame = false;
        GameApp.isGuideSettlement = false;
        const drawGrid = GameApp.drawGrid as { setGameUIVisible?: (visible: boolean) => void } | null;
        const uiManager = GameApp.uiManager;
        if (!uiManager) return;
        uiManager.openImmediate(UIID.MainPanel);
        drawGrid?.setGameUIVisible?.(false);
        uiManager.close(UIID.SettingPanel);
        uiManager.closeSettlementPanels();
    }

    private showSurvivalExitConfirm(): void {
        if (this.survivalExitConfirmRoot?.isValid) return;
        this.pauseSurvivalCountdown();

        const screenSize = getScreenSize();
        const root = createNode('SurvivalExitConfirm', this.node);
        root.getComponent(UITransform)!.setContentSize(screenSize);
        root.setSiblingIndex(999);
        this.survivalExitConfirmRoot = root;

        createFullScreenOverlay('SurvivalExitConfirmOverlay', root, new Color(0, 0, 0, 255), 128);

        const card = createNode('SurvivalExitConfirmCard', root);
        card.setPosition(0, 25, 0);
        const cardW = 450;
        const cardH = 560;
        card.getComponent(UITransform)!.setContentSize(new Size(cardW, cardH));
        const cardG = card.addComponent(Graphics);
        cardG.fillColor = new Color(35, 68, 112, 58);
        cardG.roundRect(-cardW / 2 + 8, -cardH / 2 - 10, cardW - 16, cardH, 44);
        cardG.fill();
        cardG.fillColor = new Color(247, 252, 255, 255);
        cardG.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 44);
        cardG.fill();
        cardG.strokeColor = new Color(181, 215, 244, 230);
        cardG.lineWidth = 3;
        cardG.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 44);
        cardG.stroke();
        cardG.fillColor = new Color(63, 132, 232, 255);
        cardG.roundRect(-cardW / 2 + 28, cardH / 2 - 116, cardW - 56, 82, 24);
        cardG.fill();

        const title = createLabel('SurvivalExitTitle', card, '结束点名？', 42, COLOR_WHITE, true);
        title.node.setPosition(0, cardH / 2 - 76, 0);

        const messageBox = createNode('SurvivalExitMessageBox', card);
        const messageW = 380;
        const messageH = 230;
        messageBox.setPosition(0, 62, 0);
        messageBox.getComponent(UITransform)!.setContentSize(new Size(messageW, messageH));
        const messageG = messageBox.addComponent(Graphics);
        messageG.fillColor = new Color(232, 244, 255, 255);
        messageG.roundRect(-messageW / 2, -messageH / 2, messageW, messageH, 28);
        messageG.fill();
        messageG.strokeColor = new Color(180, 213, 243, 210);
        messageG.lineWidth = 2;
        messageG.roundRect(-messageW / 2, -messageH / 2, messageW, messageH, 28);
        messageG.stroke();

        const question = createLabel('SurvivalExitQuestion', messageBox, '确定离开当前点名？', 28, new Color(52, 77, 112, 255), true);
        question.node.getComponent(UITransform)!.setContentSize(new Size(messageW - 50, 44));
        question.node.setPosition(0, 26, 0);

        const warning = createLabel('SurvivalExitWarning', messageBox, '离开后会立即结算本次生存挑战', 25, new Color(63, 132, 232, 255), true);
        warning.node.getComponent(UITransform)!.setContentSize(new Size(messageW - 44, 46));
        warning.node.setPosition(0, -22, 0);
        warning.overflow = Label.Overflow.SHRINK;

        const settleBtn = createNode('SurvivalExitSettleBtn', card);
        settleBtn.setPosition(0, -188, 0);
        const settleW = 310;
        const settleH = 76;
        settleBtn.getComponent(UITransform)!.setContentSize(new Size(settleW, settleH));
        const settleG = settleBtn.addComponent(Graphics);
        settleG.fillColor = new Color(35, 80, 142, 72);
        settleG.roundRect(-settleW / 2 + 3, -settleH / 2 - 6, settleW - 6, settleH, 30);
        settleG.fill();
        settleG.fillColor = new Color(63, 132, 232, 255);
        settleG.roundRect(-settleW / 2, -settleH / 2, settleW, settleH, 30);
        settleG.fill();
        createLabel('SurvivalExitSettleLabel', settleBtn, '确认结算', 32, COLOR_WHITE, true);
        addButtonFeedback(settleBtn);
        settleBtn.on(Node.EventType.TOUCH_END, this.onConfirmSurvivalExit, this);

        const closeNode = createNode('SurvivalExitCancelBtn', root);
        closeNode.setPosition(0, -330, 0);
        closeNode.getComponent(UITransform)!.setContentSize(new Size(72, 72));
        const closeG = closeNode.addComponent(Graphics);
        closeG.fillColor = new Color(63, 132, 232, 238);
        closeG.circle(0, 0, 34);
        closeG.fill();
        closeG.strokeColor = new Color(226, 242, 255, 245);
        closeG.lineWidth = 5;
        closeG.circle(0, 0, 31);
        closeG.stroke();
        closeG.strokeColor = COLOR_WHITE;
        closeG.lineWidth = 10;
        closeG.lineCap = Graphics.LineCap.ROUND;
        closeG.moveTo(-15, 15);
        closeG.lineTo(15, -15);
        closeG.stroke();
        closeG.moveTo(15, 15);
        closeG.lineTo(-15, -15);
        closeG.stroke();
        addButtonFeedback(closeNode);
        closeNode.on(Node.EventType.TOUCH_END, this.onCancelSurvivalExit, this);
    }

    private destroySurvivalExitConfirm(): void {
        if (this.survivalExitConfirmRoot?.isValid) {
            this.survivalExitConfirmRoot.destroy();
        }
        this.survivalExitConfirmRoot = null;
    }

    private pauseSurvivalCountdown(): void {
        if (this.isInGame && GameApp.gameMode === GameMode.survival) {
            const cdc = GameApp.countDownControl as CountdownController | null;
            cdc?.pauseCountDown();
        }
    }

    private resumeSurvivalCountdown(): void {
        if (this.isInGame && GameApp.gameMode === GameMode.survival) {
            const cdc = GameApp.countDownControl as CountdownController | null;
            if (cdc && cdc.getCurrentTime() > 0 && !cdc.isCountingDown()) {
                cdc.startCountDown();
            }
        }
    }

    private onCancelSurvivalExit(): void {
        SfxManager.instance.playUiClick();
        this.destroySurvivalExitConfirm();
        this.resumeSurvivalCountdown();
        GameApp.uiManager?.close(UIID.SettingPanel);
    }

    private onConfirmSurvivalExit(): void {
        SfxManager.instance.playUiClick();
        this.destroySurvivalExitConfirm();
        GameApp.survivalIsWin = false;
        const drawGrid = GameApp.drawGrid as {
            stopCountdownRuntime?: () => void;
            survivalOver?: () => void;
        } | null;
        drawGrid?.stopCountdownRuntime?.();
        GameApp.uiManager?.close(UIID.SettingPanel);
        drawGrid?.survivalOver?.();
    }

    private onClose(): void {
        SfxManager.instance.playUiClick();

        // 生存模式恢复倒计时
        this.resumeSurvivalCountdown();

        GameApp.uiManager?.close(UIID.SettingPanel);
    }
}

export function createSettingPanel(parent: Node): Component {
    const node = createNode('SettingPanel', parent);
    return node.addComponent(SettingPanel);
}
