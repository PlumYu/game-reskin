import { _decorator, Component, Node, Label, LabelOutline, Graphics, UITransform, Color, Size } from 'cc';
import GameApp from './Core/GameApp';
import { UIID } from './Core/Enum';
import SfxManager from './Core/SfxManager';
import RewardService from './Core/RewardService';
import { getAdaptivePanelLayout } from './Utils/LayoutService';
import {
    createNode, createLabel, createFullScreenOverlay, addButtonFeedback, getScreenSize,
    showToast,
    COLOR_WHITE,
} from './Utils/UIBuilder';

const { ccclass } = _decorator;

const CARD_WIDTH = 560;
const CARD_HEIGHT = 700;
const DIALOG_HEIGHT = 850;
const SHARE_DAILY_LIMIT = 3;

const CARD_BG = new Color(255, 255, 255, 255);
const CARD_SHADOW = new Color(0, 0, 0, 44);
const TITLE_COLOR = new Color(70, 105, 132, 255);
const SUBTITLE_COLOR = new Color(152, 169, 180, 255);
const REWARD_ORANGE = new Color(255, 166, 18, 255);
const REWARD_ORANGE_DARK = new Color(248, 145, 8, 255);
const REWARD_BLUE = new Color(45, 170, 237, 255);
const REWARD_BLUE_DARK = new Color(23, 111, 224, 255);
const ACTION_BLUE = new Color(59, 145, 232, 255);
const ACTION_GREEN = new Color(91, 202, 65, 255);
const COUNT_TEXT = new Color(126, 151, 168, 255);
const CLOSE_STROKE = new Color(71, 96, 121, 255);

@ccclass('PowerPanel')
export default class PowerPanel extends Component {
    private closeBtn!: Node;
    private quadBtn!: Node;
    private shareBtn!: Node;
    private adCountLabel!: Label;
    private staminaSubLabel!: Label;
    private quadLabel!: Label;
    private shareLabel!: Label;

    onLoad(): void {
        this.buildUI();
    }

    private buildUI(): void {
        const screenSize = getScreenSize();
        const ut = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ut.setContentSize(screenSize);

        createFullScreenOverlay('bgOverlay', this.node, new Color(0, 0, 0, 255), 170);

        const panelLayout = getAdaptivePanelLayout(CARD_WIDTH, DIALOG_HEIGHT, {
            horizontalMargin: 56,
            topMargin: 124,
            bottomMargin: 72,
            preferredY: 4,
            maxScale: 1,
        });

        const dialogRoot = createNode('dialogRoot', this.node);
        dialogRoot.getComponent(UITransform)!.setContentSize(new Size(CARD_WIDTH, DIALOG_HEIGHT));
        dialogRoot.setPosition(0, panelLayout.y, 0);
        dialogRoot.setScale(panelLayout.scale, panelLayout.scale, 1);

        const card = createNode('card', dialogRoot);
        card.setPosition(0, 30, 0);
        card.getComponent(UITransform)!.setContentSize(new Size(CARD_WIDTH, CARD_HEIGHT));
        this.drawCardSurface(card.addComponent(Graphics), CARD_WIDTH, CARD_HEIGHT);

        const title = createLabel('title', card, '免费体力', 44, TITLE_COLOR, true);
        title.node.getComponent(UITransform)!.setContentSize(new Size(440, 62));
        title.node.setPosition(0, 282, 0);

        this.staminaSubLabel = createLabel('subtitle', card, '观看广告领取体力', 30, SUBTITLE_COLOR, true);
        this.staminaSubLabel.node.getComponent(UITransform)!.setContentSize(new Size(470, 48));
        this.staminaSubLabel.node.setPosition(0, 228, 0);

        this.createRewardHero(card).setPosition(0, 58, 0);

        const quad = this.createActionButton('quadBtn', card, '四倍获得', ACTION_BLUE, 'video');
        quad.node.setPosition(0, -182, 0);
        this.quadBtn = quad.node;
        this.quadLabel = quad.label;

        const share = this.createActionButton('shareBtn', card, '分享获得', ACTION_GREEN, 'share');
        share.node.setPosition(0, -282, 0);
        this.shareBtn = share.node;
        this.shareLabel = share.label;

        this.adCountLabel = createLabel('adCountLabel', card, '使用次数:0/3', 24, COUNT_TEXT, true);
        this.adCountLabel.node.getComponent(UITransform)!.setContentSize(new Size(300, 40));
        this.adCountLabel.node.setPosition(0, -338, 0);

        this.closeBtn = this.createFloatingCloseButton(dialogRoot);
        this.closeBtn.setPosition(0, -392, 0);
    }

    private drawCardSurface(g: Graphics, width: number, height: number): void {
        g.fillColor = CARD_SHADOW;
        g.roundRect(-width / 2 + 8, -height / 2 - 10, width - 16, height, 44);
        g.fill();
        g.fillColor = CARD_BG;
        g.roundRect(-width / 2, -height / 2, width, height, 42);
        g.fill();
    }

    private createRewardHero(parent: Node): Node {
        const width = 500;
        const height = 270;
        const hero = createNode('rewardHero', parent);
        hero.getComponent(UITransform)!.setContentSize(new Size(width, height));

        const g = hero.addComponent(Graphics);
        this.drawRewardHeroSurface(g, width, height);
        this.drawLightning(g, -28, 34, 142, REWARD_BLUE_DARK);
        this.drawLightning(g, -36, 40, 142, REWARD_BLUE);

        const rewardShadow = createLabel('rewardValueShadow', hero, '+15', 72, REWARD_BLUE_DARK, true);
        rewardShadow.node.getComponent(UITransform)!.setContentSize(new Size(210, 90));
        rewardShadow.node.setPosition(62, 24, 0);

        const rewardValue = createLabel('rewardValue', hero, '+15', 72, COLOR_WHITE, true);
        rewardValue.node.getComponent(UITransform)!.setContentSize(new Size(210, 90));
        rewardValue.node.setPosition(58, 30, 0);
        const outline = rewardValue.node.addComponent(LabelOutline);
        outline.color = new Color(47, 96, 180, 255);
        outline.width = 3;

        const hint = createLabel('rewardHint', hero, '更多免费体力可在每日挑战和生存模式中获取', 22, new Color(73, 150, 220, 255), true);
        hint.node.getComponent(UITransform)!.setContentSize(new Size(460, 36));
        hint.node.setPosition(0, -96, 0);
        return hero;
    }

    private drawRewardHeroSurface(g: Graphics, width: number, height: number): void {
        const radius = 34;
        g.fillColor = REWARD_ORANGE_DARK;
        g.roundRect(-width / 2, -height / 2 - 6, width, height, radius);
        g.fill();
        g.fillColor = REWARD_ORANGE;
        g.roundRect(-width / 2, -height / 2, width, height, radius);
        g.fill();

        const rayCount = 18;
        const centerY = 0;
        for (let i = 0; i < rayCount; i++) {
            const a0 = Math.PI * 2 * i / rayCount;
            const a1 = Math.PI * 2 * (i + 0.48) / rayCount;
            const r = 320;
            g.fillColor = new Color(255, 224, 106, i % 2 === 0 ? 34 : 18);
            g.moveTo(0, centerY);
            g.lineTo(Math.cos(a0) * r, centerY + Math.sin(a0) * r);
            g.lineTo(Math.cos(a1) * r, centerY + Math.sin(a1) * r);
            g.close();
            g.fill();
        }

        g.fillColor = new Color(255, 210, 82, 86);
        g.roundRect(-width / 2 + 22, height / 2 - 74, width - 44, 34, 17);
        g.fill();
    }

    private drawLightning(g: Graphics, x: number, y: number, size: number, color: Color): void {
        const s = size / 100;
        g.fillColor = color;
        g.moveTo(x - 12 * s, y + 46 * s);
        g.lineTo(x + 32 * s, y + 46 * s);
        g.lineTo(x + 9 * s, y + 9 * s);
        g.lineTo(x + 38 * s, y + 9 * s);
        g.lineTo(x - 20 * s, y - 56 * s);
        g.lineTo(x - 5 * s, y - 15 * s);
        g.lineTo(x - 38 * s, y - 15 * s);
        g.close();
        g.fill();
    }

    private createActionButton(name: string, parent: Node, text: string, color: Color, icon: 'video' | 'share'): { node: Node; label: Label } {
        const width = 300;
        const height = 78;
        const node = createNode(name, parent);
        node.getComponent(UITransform)!.setContentSize(new Size(width, height));
        this.drawPillButton(node.addComponent(Graphics), width, height, color);

        if (icon === 'video') {
            this.drawVideoIcon(node, -100, color);
        } else {
            this.drawShareIcon(node, -102);
        }

        const label = createLabel('label', node, text, 36, COLOR_WHITE, true);
        label.node.getComponent(UITransform)!.setContentSize(new Size(190, height));
        label.node.setPosition(42, 1, 0);
        addButtonFeedback(node);
        return { node, label };
    }

    private drawPillButton(g: Graphics, width: number, height: number, color: Color): void {
        const radius = height / 2;
        g.fillColor = new Color(0, 0, 0, 38);
        g.roundRect(-width / 2 + 3, -height / 2 - 6, width - 6, height, radius);
        g.fill();
        g.fillColor = color;
        g.roundRect(-width / 2, -height / 2, width, height, radius);
        g.fill();
        g.fillColor = new Color(255, 255, 255, 38);
        g.roundRect(-width / 2 + 18, 5, width - 36, 22, 11);
        g.fill();
    }

    private drawVideoIcon(parent: Node, x: number, buttonColor: Color): void {
        const icon = createNode('videoIcon', parent);
        icon.getComponent(UITransform)!.setContentSize(new Size(58, 42));
        icon.setPosition(x, 0, 0);
        const g = icon.addComponent(Graphics);
        g.fillColor = COLOR_WHITE;
        g.roundRect(-29, -21, 58, 42, 7);
        g.fill();
        g.fillColor = buttonColor;
        g.moveTo(-7, -11);
        g.lineTo(-7, 11);
        g.lineTo(15, 0);
        g.close();
        g.fill();
    }

    private drawShareIcon(parent: Node, x: number): void {
        const icon = createNode('shareIcon', parent);
        icon.getComponent(UITransform)!.setContentSize(new Size(64, 54));
        icon.setPosition(x, 0, 0);
        const g = icon.addComponent(Graphics);
        g.strokeColor = COLOR_WHITE;
        g.lineWidth = 8;
        g.lineCap = Graphics.LineCap.ROUND;
        g.moveTo(-16, 0);
        g.lineTo(14, 17);
        g.moveTo(-16, 0);
        g.lineTo(14, -17);
        g.stroke();
        g.fillColor = COLOR_WHITE;
        g.circle(-22, 0, 9);
        g.circle(21, 22, 9);
        g.circle(21, -22, 9);
        g.fill();
    }

    private createFloatingCloseButton(parent: Node): Node {
        const node = createNode('closeBtn', parent);
        node.getComponent(UITransform)!.setContentSize(new Size(108, 108));
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 54);
        g.circle(4, -6, 48);
        g.fill();
        g.fillColor = new Color(255, 255, 255, 255);
        g.circle(0, 0, 48);
        g.fill();
        g.strokeColor = new Color(255, 255, 255, 165);
        g.lineWidth = 7;
        g.circle(0, 0, 55);
        g.stroke();
        g.strokeColor = CLOSE_STROKE;
        g.lineWidth = 10;
        g.lineCap = Graphics.LineCap.ROUND;
        g.moveTo(-17, -17);
        g.lineTo(17, 17);
        g.moveTo(17, -17);
        g.lineTo(-17, 17);
        g.stroke();
        addButtonFeedback(node);
        return node;
    }

    onEnable(): void {
        this.quadBtn.on(Node.EventType.TOUCH_END, this.onQuadClick, this);
        this.shareBtn.on(Node.EventType.TOUCH_END, this.onShareClick, this);
        this.closeBtn.on(Node.EventType.TOUCH_END, this.onClose, this);
        this.refreshDisplay();
    }

    onDisable(): void {
        this.quadBtn.off(Node.EventType.TOUCH_END, this.onQuadClick, this);
        this.shareBtn.off(Node.EventType.TOUCH_END, this.onShareClick, this);
        this.closeBtn.off(Node.EventType.TOUCH_END, this.onClose, this);
    }

    private refreshDisplay(): void {
        this.staminaSubLabel.string = RewardService.isRewardAdAvailable()
            ? '观看广告领取体力'
            : '免费领取体力';
        this.quadLabel.string = RewardService.isRewardAdAvailable()
            ? '四倍获得'
            : '免费领取';

        const shareLeft = Math.max(0, Math.floor(GameApp.user.shareNum || 0));
        const shareUsed = Math.max(0, Math.min(SHARE_DAILY_LIMIT, SHARE_DAILY_LIMIT - shareLeft));
        this.adCountLabel.string = `使用次数:${shareUsed}/${SHARE_DAILY_LIMIT}`;
        this.adCountLabel.color = shareLeft <= 0
            ? new Color(184, 112, 112, 255)
            : COUNT_TEXT;
        if (this.shareLabel) {
            this.shareLabel.string = shareLeft <= 0 ? '今日已满' : '分享获得';
        }
    }

    private onQuadClick(): void {
        SfxManager.instance.playUiClick();
        RewardService.requestReward((rewarded) => {
            if (rewarded) {
                GameApp.tiliManager?.addTili(60);
                GameApp.user.save();
                this.refreshMainPanelStamina();
                this.refreshAndClose();
            }
        });
    }

    private onShareClick(): void {
        SfxManager.instance.playUiClick();
        const shareLeft = Math.max(0, Math.floor(GameApp.user.shareNum || 0));
        if (shareLeft <= 0) {
            this.refreshDisplay();
            return;
        }
        GameApp.platform.share((success) => {
            if (success) {
                GameApp.user.shareNum = Math.max(0, shareLeft - 1);
                GameApp.tiliManager?.addTili(15);
                GameApp.user.save();
                this.refreshMainPanelStamina();
                this.refreshAndClose();
            } else {
                showToast(GameApp.uiManager?.node || this.node, '分享暂不可用，请稍后再试');
            }
        });
    }

    private refreshMainPanelStamina(): void {
        const globalHud = GameApp.globalHud as { refreshStamina?: () => void } | null;
        globalHud?.refreshStamina?.();
    }

    private refreshAndClose(): void {
        GameApp.uiManager?.close(UIID.PowerPanel);
    }

    private onClose(): void {
        SfxManager.instance.playUiClick();
        GameApp.uiManager?.close(UIID.PowerPanel);
    }
}

export function createPowerPanel(parent: Node): Component {
    const node = createNode('PowerPanel', parent);
    return node.addComponent(PowerPanel);
}
