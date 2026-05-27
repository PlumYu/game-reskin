import { _decorator, Component, Node, Label, LabelOutline, UITransform, Size, Color, Graphics, UIOpacity, tween, v3, Sprite, SpriteFrame } from 'cc';
import GameApp from './Core/GameApp';
import { GameMode, UIID } from './Core/Enum';
import SfxManager from './Core/SfxManager';
import { CountdownController } from './Core/CountdownController';
import RewardService from './Core/RewardService';
import AssetService from './Core/AssetService';
import { GlobalHudMode } from './GlobalHud';
import { getAdaptivePanelLayout } from './Utils/LayoutService';
import {
    createNode,
    createLabel,
    createFullScreenOverlay,
    addButtonFeedback,
    COLOR_WHITE,
    COLOR_BLACK,
} from './Utils/UIBuilder';

const { ccclass } = _decorator;

const PANEL_WIDTH = 640;
const PANEL_HEIGHT = 1030;
const GREEN_REVIVE = new Color(132, 204, 14, 255);
const BLUE_RESTART = new Color(36, 181, 232, 255);
const BLUE_DOUBLE = new Color(52, 139, 236, 255);
const WHITE_BUTTON = new Color(255, 255, 255, 255);
const GOLD_TEXT = new Color(255, 214, 54, 255);
const RED_TEXT = new Color(255, 66, 64, 255);
const SOFT_WHITE = new Color(255, 255, 255, 238);
const MUTED_WHITE = new Color(255, 255, 255, 186);
const DARK_TEXT = new Color(52, 66, 96, 255);
const MENU_IDLE_STATIC_PATH = 'characters/menu_idle_static';
const MENU_IDLE_DIR_PATH = 'characters/menu_idle';
const SETTLEMENT_MASCOT_FRAME_INTERVAL = 0.12;
const SETTLEMENT_VERTICAL_LIFT = 38;
const SETTLEMENT_HOME_X_OFFSET = 56;
const REVIVE_BUTTON_WIDTH = 396;

type ButtonTone = 'revive' | 'restart' | 'double' | 'friend' | 'home' | 'disabled';

@ccclass('SurvivalOverPanel')
export default class SurvivalOverPanel extends Component {
    private isWin: boolean = false;
    private baseStaminaReward: number = 20;
    private settlementPassLevel: number = 0;
    private settlementFoundCowNum: number = 0;
    private settlementUseTime: number = 0;
    private doubleStaminaClaimed: boolean = false;
    private reviveBtn: Node | null = null;
    private restartBtn: Node | null = null;
    private doubleStaminaBtn: Node | null = null;
    private friendBtn: Node | null = null;
    private homeBtn: Node | null = null;
    private staminaRewardLabel: Label | null = null;
    private doubleButtonTitle: Label | null = null;
    private doubleButtonSub: Label | null = null;
    private settlementMascotNode: Node | null = null;
    private settlementMascotSprite: Sprite | null = null;
    private settlementMascotFrames: SpriteFrame[] = [];
    private settlementMascotFrameIndex: number = 0;
    private reviveContentNode: Node | null = null;

    onLoad(): void {
        this.settlementPassLevel = Math.max(0, Math.floor(GameApp.survivalSettlementPassLevel || GameApp.passLevel || 0));
        this.settlementFoundCowNum = Math.max(0, Math.floor(GameApp.survivalSettlementFoundCowNum || GameApp.foundCowNum || 0));
        this.settlementUseTime = Math.max(0, Math.floor(GameApp.survivalSettlementUseTime || GameApp.useTime || 0));
        this.isWin = this.settlementPassLevel >= 10 || GameApp.survivalIsWin;
        this.baseStaminaReward = this.getBaseStaminaReward();
        this.buildUI();
    }

    private buildUI(): void {
        const layout = getAdaptivePanelLayout(PANEL_WIDTH, PANEL_HEIGHT, {
            horizontalMargin: 30,
            topMargin: 42,
            bottomMargin: 42,
            minScale: 0.74,
            maxScale: 1,
            preferredY: SETTLEMENT_VERTICAL_LIFT,
        });
        const rootTransform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        rootTransform.setContentSize(new Size(layout.layout.width, layout.layout.height));
        createFullScreenOverlay('SurvivalSettlementOverlay', this.node, COLOR_BLACK, 205);

        this.homeBtn = this.createHomeButton(this.node, layout.layout.contentLeft + SETTLEMENT_HOME_X_OFFSET, layout.layout.topRowY);

        const root = createNode('SurvivalSettlementRoot', this.node);
        root.getComponent(UITransform)!.setContentSize(new Size(PANEL_WIDTH, PANEL_HEIGHT));
        root.setPosition(0, layout.y, 0);
        root.setScale(layout.scale, layout.scale, 1);

        this.createResultHeader(root);
        this.createSettlementTitle(root);
        this.createStats(root);
        this.createRewardRow(root);
        this.createActions(root);
    }

    private createResultHeader(parent: Node): void {
        const result = this.getResultLine();
        const label = createLabel('SurvivalResultLine', parent, result, 44, SOFT_WHITE, true);
        label.node.setPosition(0, 392, 0);
        this.setLabelSize(label, 590, 62);
        this.addTextOutline(label, this.isWin ? new Color(126, 70, 12, 210) : new Color(40, 40, 40, 180), 4);
    }

    private createSettlementTitle(parent: Node): void {
        const burst = createNode('SurvivalSettlementBurst', parent);
        burst.setPosition(0, 250, 0);
        const g = burst.addComponent(Graphics);
        for (let i = 0; i < 18; i++) {
            const angle = Math.PI * 2 * i / 18;
            const inner = 46;
            const outer = 238 + (i % 3) * 26;
            const width = 18 + (i % 2) * 10;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const nx = Math.cos(angle + Math.PI / 2);
            const ny = Math.sin(angle + Math.PI / 2);
            g.fillColor = new Color(255, 255, 255, i % 2 === 0 ? 34 : 22);
            g.moveTo(cos * inner - nx * width, sin * inner - ny * width);
            g.lineTo(cos * inner + nx * width, sin * inner + ny * width);
            g.lineTo(cos * outer + nx * width * 0.22, sin * outer + ny * width * 0.22);
            g.lineTo(cos * outer - nx * width * 0.22, sin * outer - ny * width * 0.22);
            g.close();
            g.fill();
        }

        const title = createLabel('SurvivalSettlementTitle', parent, '关卡结算', 70, this.isWin ? GOLD_TEXT : COLOR_WHITE, true);
        title.node.setPosition(0, 248, 0);
        this.setLabelSize(title, 600, 92);
        this.addTextOutline(title, this.isWin ? new Color(255, 255, 255, 230) : new Color(66, 66, 66, 230), this.isWin ? 5 : 7);
        if (this.isWin) {
            this.createSuccessConfetti(parent);
        }

        this.drawDivider(parent, 0, 171, 500);
    }

    private createSuccessConfetti(parent: Node): void {
        const colors = [
            new Color(255, 67, 49, 230),
            new Color(255, 190, 45, 230),
            new Color(28, 179, 255, 230),
            new Color(48, 218, 88, 230),
            new Color(255, 132, 35, 230),
        ];
        for (let i = 0; i < 26; i++) {
            const piece = createNode(`SuccessConfetti_${i}`, parent);
            const width = 14 + (i % 3) * 5;
            const height = 7 + (i % 2) * 4;
            piece.getComponent(UITransform)!.setContentSize(new Size(width, height));
            const x = -305 + ((i * 47) % 610);
            const y = 352 - (i % 6) * 62;
            const drift = (i % 2 === 0 ? 1 : -1) * (28 + (i % 5) * 8);
            const angle = (i * 37) % 180;
            piece.setPosition(x, y, 0);
            piece.angle = angle;
            const g = piece.addComponent(Graphics);
            g.fillColor = colors[i % colors.length];
            g.roundRect(-width / 2, -height / 2, width, height, 2);
            g.fill();
            tween(piece)
                .delay(i * 0.035)
                .repeatForever(
                    tween()
                        .to(1.8 + (i % 4) * 0.18, { position: v3(x + drift, y - 390, 0), angle: angle + 260 }, { easing: 'sineIn' })
                        .call(() => {
                            if (!piece.isValid) return;
                            piece.setPosition(x, y, 0);
                            piece.angle = angle;
                        })
                )
                .start();
        }
    }

    private createStats(parent: Node): void {
        const found = createNode('SurvivalFoundRow', parent);
        found.setPosition(0, 114, 0);
        found.getComponent(UITransform)!.setContentSize(new Size(570, 64));
        this.createMenuIdleMascot(found, -188, 0, 58, 58);
        const foundPrefix = createLabel('SurvivalFoundPrefix', found, '找到了', 34, COLOR_WHITE, true);
        foundPrefix.node.setPosition(-70, 0, 0);
        this.setLabelSize(foundPrefix, 150, 50);
        const foundNumber = createLabel('SurvivalFoundNumber', found, `${this.settlementFoundCowNum}`, 44, RED_TEXT, true);
        foundNumber.node.setPosition(43, 0, 0);
        this.setLabelSize(foundNumber, 58, 58);
        const foundSuffix = createLabel('SurvivalFoundSuffix', found, '只牛', 34, COLOR_WHITE, true);
        foundSuffix.node.setPosition(123, 0, 0);
        this.setLabelSize(foundSuffix, 100, 50);

        this.drawDivider(parent, 0, 64, 430);

        const roundTimeRow = createNode('SurvivalRoundTimeRow', parent);
        roundTimeRow.setPosition(0, 8, 0);
        roundTimeRow.getComponent(UITransform)!.setContentSize(new Size(560, 70));
        this.createRoundTimeStat(roundTimeRow, 'SurvivalRoundStat', '轮数', `${this.settlementPassLevel}`, -138);
        this.createRoundTimeStat(roundTimeRow, 'SurvivalTimeStat', '用时', this.formatDuration(this.settlementUseTime), 138);

        this.drawDivider(parent, 0, -52, 430);

        const beat = createLabel('SurvivalBeatText', parent, `击败了 ${this.getBeatPercent()} 的玩家`, 43, GOLD_TEXT, true);
        beat.node.setPosition(0, -106, 0);
        this.setLabelSize(beat, 610, 60);
    }

    private createRewardRow(parent: Node): void {
        const reward = createNode('SurvivalRewardRow', parent);
        reward.setPosition(0, -196, 0);
        reward.getComponent(UITransform)!.setContentSize(new Size(250, 52));
        this.drawLightningIcon(reward, -58, 0, 44);
        this.staminaRewardLabel = createLabel('SurvivalRewardValue', reward, `+${this.baseStaminaReward}`, 36, COLOR_WHITE, true);
        this.staminaRewardLabel.node.setPosition(22, 0, 0);
        this.setLabelSize(this.staminaRewardLabel, 130, 52);
    }

    private createActions(parent: Node): void {
        const reviveText = GameApp.survivalReviveTime > 0 ? '复活' : '复活已用';
        this.reviveBtn = this.createPillButton('SurvivalReviveBtn', parent, reviveText, '+60秒', REVIVE_BUTTON_WIDTH, 106, 0, -326, GameApp.survivalReviveTime > 0 ? 'revive' : 'disabled', GameApp.survivalReviveTime > 0, 'clock');
        if (GameApp.survivalReviveTime <= 0) {
            this.setButtonDisabled(this.reviveBtn);
        }

        const restartSub = GameApp.user.freeSurvivalTime > 0
            ? `今日免费${GameApp.user.freeSurvivalTime}/2次`
            : '看广告继续挑战';
        this.restartBtn = this.createPillButton('SurvivalRestartBtn', parent, '重新挑战', restartSub, 342, 86, 0, -442, 'restart', GameApp.user.freeSurvivalTime <= 0, null);

        this.doubleStaminaBtn = this.createPillButton('SurvivalDoubleStaminaBtn', parent, '双倍体力', '', 282, 74, -154, -548, 'double', true, 'lightning');
        this.doubleButtonTitle = this.doubleStaminaBtn.getChildByName('title')?.getComponent(Label) || null;
        this.doubleButtonSub = this.doubleStaminaBtn.getChildByName('subtitle')?.getComponent(Label) || null;

        this.friendBtn = this.createPillButton('SurvivalFriendBtn', parent, '求助好友', '', 282, 74, 154, -548, 'friend', false, 'share');
    }

    private createPillButton(
        name: string,
        parent: Node,
        title: string,
        subtitle: string,
        width: number,
        height: number,
        x: number,
        y: number,
        tone: ButtonTone,
        showAd: boolean,
        icon: 'clock' | 'lightning' | 'share' | 'home' | null,
    ): Node {
        const node = createNode(name, parent);
        node.setPosition(x, y, 0);
        node.getComponent(UITransform)!.setContentSize(new Size(width, height));
        const g = node.addComponent(Graphics);
        this.drawButtonSurface(g, width, height, tone);

        if (icon) {
            this.drawButtonIcon(node, icon, -width / 2 + Math.min(78, height * 0.72), 0, tone);
        }

        const labelParent = tone === 'revive' ? createNode('ReviveContentPulse', node) : node;
        if (tone === 'revive') {
            labelParent.setPosition(0, 0, 0);
            this.reviveContentNode = labelParent;
        }
        const textOffsetX = tone === 'revive' ? 0 : (icon ? Math.min(34, width * 0.08) : 0);
        const titleLabel = createLabel('title', labelParent, title, height >= 100 ? 42 : 34, tone === 'friend' ? new Color(224, 64, 54, 255) : COLOR_WHITE, true);
        titleLabel.node.setPosition(textOffsetX, subtitle ? 13 : 0, 0);
        this.setLabelSize(titleLabel, width - (icon ? 126 : 38), subtitle ? Math.round(height * 0.52) : height - 8);

        if (subtitle) {
            const subColor = tone === 'restart' ? new Color(34, 86, 138, 255) : COLOR_WHITE;
            const subtitleLabel = createLabel('subtitle', labelParent, subtitle, height >= 100 ? 25 : 21, subColor, true);
            subtitleLabel.node.setPosition(textOffsetX, -24, 0);
            this.setLabelSize(subtitleLabel, width - (icon ? 126 : 38), Math.round(height * 0.36));
        }

        if (showAd) {
            this.drawAdBadge(node, width / 2 - 46, height / 2 - 5);
        }

        addButtonFeedback(node);
        return node;
    }

    private drawButtonSurface(g: Graphics, width: number, height: number, tone: ButtonTone): void {
        const radius = height / 2;
        const x = -width / 2;
        const y = -height / 2;
        let fill = BLUE_RESTART;
        let shadow = new Color(0, 72, 120, 78);
        if (tone === 'revive') {
            fill = GREEN_REVIVE;
            shadow = new Color(48, 105, 6, 88);
        } else if (tone === 'double') {
            fill = BLUE_DOUBLE;
            shadow = new Color(18, 74, 150, 86);
        } else if (tone === 'friend') {
            fill = WHITE_BUTTON;
            shadow = new Color(22, 30, 44, 76);
        } else if (tone === 'disabled') {
            fill = new Color(146, 156, 170, 230);
            shadow = new Color(44, 50, 62, 54);
        }

        g.clear();
        g.fillColor = shadow;
        g.roundRect(x + 4, y - 7, width - 8, height, radius);
        g.fill();
        g.fillColor = fill;
        g.roundRect(x, y, width, height, radius);
        g.fill();
        if (tone !== 'friend' && tone !== 'disabled') {
            g.fillColor = new Color(255, 255, 255, 42);
            g.roundRect(x + 24, y + height - 24, width - 48, 10, 5);
            g.fill();
        }
    }

    private drawButtonIcon(parent: Node, icon: 'clock' | 'lightning' | 'share' | 'home', x: number, y: number, tone: ButtonTone): void {
        const iconNode = createNode(`${icon}Icon`, parent);
        iconNode.setPosition(x, y, 0);
        iconNode.getComponent(UITransform)!.setContentSize(new Size(58, 58));
        const g = iconNode.addComponent(Graphics);
        const color = tone === 'friend' ? new Color(224, 64, 54, 255) : COLOR_WHITE;
        if (icon === 'clock') {
            g.fillColor = new Color(255, 238, 170, 255);
            g.circle(0, 0, 20);
            g.fill();
            g.strokeColor = color;
            g.lineWidth = 4;
            g.circle(0, 0, 20);
            g.moveTo(0, 0);
            g.lineTo(0, 10);
            g.moveTo(0, 0);
            g.lineTo(9, -5);
            g.stroke();
            return;
        }
        if (icon === 'lightning') {
            this.drawLightningIcon(iconNode, 0, 0, 46);
            return;
        }
        if (icon === 'share') {
            g.strokeColor = color;
            g.lineWidth = 6;
            g.lineCap = Graphics.LineCap.ROUND;
            g.moveTo(-14, 0);
            g.lineTo(14, 16);
            g.moveTo(-14, 0);
            g.lineTo(14, -16);
            g.stroke();
            g.fillColor = color;
            g.circle(-18, 0, 7);
            g.circle(18, 19, 7);
            g.circle(18, -19, 7);
            g.fill();
            return;
        }
        if (icon === 'home') {
            g.fillColor = color;
            g.moveTo(-19, -3);
            g.lineTo(0, 17);
            g.lineTo(19, -3);
            g.lineTo(13, -3);
            g.lineTo(13, -22);
            g.lineTo(-13, -22);
            g.lineTo(-13, -3);
            g.close();
            g.fill();
        }
    }

    private createHomeButton(parent: Node, x: number, y: number): Node {
        const node = createNode('SurvivalHomeBtn', parent);
        node.setPosition(x, y, 0);
        node.getComponent(UITransform)!.setContentSize(new Size(76, 76));
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(98, 126, 238, 255);
        g.circle(0, 0, 38);
        g.fill();
        g.strokeColor = new Color(255, 255, 255, 120);
        g.lineWidth = 3;
        g.circle(0, 0, 35);
        g.stroke();
        this.drawButtonIcon(node, 'home', 0, 0, 'home');
        addButtonFeedback(node);
        return node;
    }

    private drawAdBadge(parent: Node, x: number, y: number): void {
        const badge = createNode('AdBadge', parent);
        badge.setPosition(x, y, 0);
        badge.getComponent(UITransform)!.setContentSize(new Size(52, 42));
        badge.setRotationFromEuler(0, 0, -12);
        const g = badge.addComponent(Graphics);
        g.fillColor = new Color(28, 28, 32, 255);
        g.roundRect(-22, -17, 44, 34, 6);
        g.fill();
        g.fillColor = COLOR_WHITE;
        g.moveTo(-5, -8);
        g.lineTo(-5, 8);
        g.lineTo(9, 0);
        g.close();
        g.fill();
        g.strokeColor = COLOR_WHITE;
        g.lineWidth = 4;
        g.moveTo(-22, 17);
        g.lineTo(22, 17);
        g.moveTo(-14, 22);
        g.lineTo(-6, 14);
        g.moveTo(4, 22);
        g.lineTo(12, 14);
        g.stroke();
    }

    private createRoundTimeStat(parent: Node, name: string, title: string, value: string, x: number): void {
        const group = createNode(name, parent);
        group.setPosition(x, 0, 0);
        group.getComponent(UITransform)!.setContentSize(new Size(260, 62));
        const fontSize = 34;

        const titleLabel = createLabel(`${name}Title`, group, title, fontSize, COLOR_WHITE, true);
        titleLabel.node.setPosition(-64, 0, 0);
        this.setLabelSize(titleLabel, 92, 48);

        const valueLabel = createLabel(`${name}Value`, group, value, fontSize, GOLD_TEXT, true);
        valueLabel.node.setPosition(58, 0, 0);
        this.setLabelSize(valueLabel, 166, 48);
    }

    private createMenuIdleMascot(parent: Node, x: number, y: number, maxWidth: number, maxHeight: number): void {
        const mascot = createNode('SettlementMenuIdleMascot', parent);
        mascot.setPosition(x, y, 0);
        mascot.getComponent(UITransform)!.setContentSize(new Size(maxWidth, maxHeight));

        const visual = createNode('SettlementMenuIdleMascotVisual', mascot);
        visual.getComponent(UITransform)!.setContentSize(new Size(maxWidth, maxHeight));
        const sprite = visual.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;

        this.settlementMascotNode = mascot;
        this.settlementMascotSprite = sprite;
        this.startSettlementMascotMotion(visual);

        AssetService.loadSpriteFrame(MENU_IDLE_STATIC_PATH, frame => {
            this.applySettlementMascotFrame(frame, maxWidth, maxHeight);
        }, 'smooth');
        AssetService.loadSpriteFrameDir(MENU_IDLE_DIR_PATH, frames => {
            this.settlementMascotFrames = frames;
            this.settlementMascotFrameIndex = 0;
            if (frames.length > 0) {
                this.applySettlementMascotFrame(frames[0], maxWidth, maxHeight);
            }
            this.startSettlementMascotFrameLoop();
        }, 'smooth');
    }

    private applySettlementMascotFrame(frame: SpriteFrame | null | undefined, maxWidth: number, maxHeight: number): void {
        if (!frame || !this.settlementMascotSprite || !this.settlementMascotSprite.node?.isValid) return;
        this.settlementMascotSprite.spriteFrame = frame;
        const fitted = this.getSpriteFitSize(frame, maxWidth, maxHeight);
        this.settlementMascotSprite.node.getComponent(UITransform)?.setContentSize(new Size(fitted.width, fitted.height));
    }

    private startSettlementMascotFrameLoop(): void {
        this.unschedule(this.advanceSettlementMascotFrame);
        if (this.settlementMascotFrames.length <= 1 || !this.node.activeInHierarchy) return;
        this.schedule(this.advanceSettlementMascotFrame, SETTLEMENT_MASCOT_FRAME_INTERVAL);
    }

    private advanceSettlementMascotFrame = (): void => {
        if (!this.settlementMascotSprite || !this.settlementMascotSprite.node?.isValid || this.settlementMascotFrames.length <= 1) {
            this.unschedule(this.advanceSettlementMascotFrame);
            return;
        }
        this.settlementMascotFrameIndex = (this.settlementMascotFrameIndex + 1) % this.settlementMascotFrames.length;
        this.settlementMascotSprite.spriteFrame = this.settlementMascotFrames[this.settlementMascotFrameIndex];
    };

    private startSettlementMascotMotion(node: Node): void {
        if (!node?.isValid) return;
        tween(node).stop();
        node.setPosition(0, 0, 0);
        node.setScale(v3(1, 1, 1));
        tween(node)
            .repeatForever(
                tween()
                    .to(0.58, { position: v3(0, 4, 0), scale: v3(1.06, 1.06, 1) }, { easing: 'sineOut' })
                    .to(0.58, { position: v3(0, 0, 0), scale: v3(1, 1, 1) }, { easing: 'sineIn' })
            )
            .start();
    }

    private getSpriteFitSize(frame: SpriteFrame, maxWidth: number, maxHeight: number): { width: number; height: number } {
        const rect = frame.rect;
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            return { width: maxWidth, height: maxHeight };
        }
        const scale = Math.min(maxWidth / rect.width, maxHeight / rect.height);
        return {
            width: Math.max(1, Math.round(rect.width * scale)),
            height: Math.max(1, Math.round(rect.height * scale)),
        };
    }

    private drawCowFace(parent: Node, x: number, y: number, size: number): void {
        const node = createNode('CowFaceIcon', parent);
        node.setPosition(x, y, 0);
        const g = node.addComponent(Graphics);
        const s = size / 48;
        g.fillColor = new Color(255, 238, 214, 255);
        g.circle(0, 0, 19 * s);
        g.fill();
        g.fillColor = new Color(70, 46, 36, 255);
        g.ellipse(-15 * s, 16 * s, 10 * s, 7 * s);
        g.ellipse(15 * s, 16 * s, 10 * s, 7 * s);
        g.fill();
        g.fillColor = new Color(42, 32, 28, 255);
        g.circle(-7 * s, 3 * s, 3 * s);
        g.circle(7 * s, 3 * s, 3 * s);
        g.fill();
        g.fillColor = new Color(245, 126, 118, 255);
        g.ellipse(0, -8 * s, 11 * s, 7 * s);
        g.fill();
    }

    private drawLightningIcon(parent: Node, x: number, y: number, size: number): void {
        const node = createNode('LightningIcon', parent);
        node.setPosition(x, y, 0);
        const g = node.addComponent(Graphics);
        const s = size / 48;
        g.fillColor = new Color(20, 180, 255, 255);
        g.moveTo(-5 * s, 22 * s);
        g.lineTo(-20 * s, -3 * s);
        g.lineTo(-5 * s, -3 * s);
        g.lineTo(-12 * s, -24 * s);
        g.lineTo(18 * s, 7 * s);
        g.lineTo(4 * s, 7 * s);
        g.lineTo(10 * s, 22 * s);
        g.close();
        g.fill();
    }

    private drawDivider(parent: Node, x: number, y: number, width: number): void {
        const line = createNode('Divider', parent);
        line.setPosition(x, y, 0);
        const g = line.addComponent(Graphics);
        g.strokeColor = new Color(255, 255, 255, 155);
        g.lineWidth = 3;
        g.moveTo(-width / 2, 0);
        g.lineTo(width / 2, 0);
        g.stroke();
    }

    private setButtonDisabled(button: Node | null): void {
        if (!button) return;
        const opacity = button.getComponent(UIOpacity) || button.addComponent(UIOpacity);
        opacity.opacity = 190;
    }

    private startRevivePulse(): void {
        const node = this.reviveContentNode;
        if (!node?.isValid || GameApp.survivalReviveTime <= 0) return;
        tween(node).stop();
        node.setScale(v3(1, 1, 1));
        tween(node)
            .repeatForever(
                tween()
                    .to(0.64, { scale: v3(1.1, 1.1, 1) }, { easing: 'quadInOut' })
                    .to(0.64, { scale: v3(1, 1, 1) }, { easing: 'quadInOut' })
            )
            .start();
    }

    private setLabelSize(label: Label, width: number, height: number): void {
        label.node.getComponent(UITransform)!.setContentSize(new Size(width, height));
        label.overflow = Label.Overflow.SHRINK;
    }

    private addTextOutline(label: Label, color: Color, width: number): void {
        const outline = label.node.getComponent(LabelOutline) || label.node.addComponent(LabelOutline);
        outline.color = color;
        outline.width = width;
    }

    onEnable(): void {
        const globalHud = GameApp.globalHud as { setMode?: (mode: GlobalHudMode) => void; syncLayout?: () => void } | null;
        globalHud?.setMode?.(GlobalHudMode.ChallengeSettlement);
        globalHud?.syncLayout?.();

        const root = this.node.getChildByName('SurvivalSettlementRoot');
        if (root) {
            const opacity = root.getComponent(UIOpacity) || root.addComponent(UIOpacity);
            opacity.opacity = 0;
            root.setScale(root.scale.x * 0.96, root.scale.y * 0.96, 1);
            tween(opacity).to(0.18, { opacity: 255 }, { easing: 'quadOut' }).start();
            tween(root).to(0.22, { scale: v3(root.scale.x / 0.96, root.scale.y / 0.96, 1) }, { easing: 'backOut' }).start();
        }

        this.homeBtn?.on(Node.EventType.TOUCH_END, this.onMenuClick, this);
        if (GameApp.survivalReviveTime > 0) {
            this.reviveBtn?.on(Node.EventType.TOUCH_END, this.onReviveClick, this);
        }
        this.restartBtn?.on(Node.EventType.TOUCH_END, this.onRestartClick, this);
        this.doubleStaminaBtn?.on(Node.EventType.TOUCH_END, this.onDoubleStaminaClick, this);
        this.friendBtn?.on(Node.EventType.TOUCH_END, this.onFriendClick, this);
        this.startRevivePulse();
        const mascotVisual = this.settlementMascotNode?.getChildByName('SettlementMenuIdleMascotVisual');
        if (mascotVisual?.isValid) this.startSettlementMascotMotion(mascotVisual);
        this.startSettlementMascotFrameLoop();
    }

    onDisable(): void {
        this.homeBtn?.off(Node.EventType.TOUCH_END, this.onMenuClick, this);
        this.reviveBtn?.off(Node.EventType.TOUCH_END, this.onReviveClick, this);
        this.restartBtn?.off(Node.EventType.TOUCH_END, this.onRestartClick, this);
        this.doubleStaminaBtn?.off(Node.EventType.TOUCH_END, this.onDoubleStaminaClick, this);
        this.friendBtn?.off(Node.EventType.TOUCH_END, this.onFriendClick, this);
        this.unschedule(this.advanceSettlementMascotFrame);
        if (this.reviveContentNode?.isValid) tween(this.reviveContentNode).stop();
        const mascotVisual = this.settlementMascotNode?.getChildByName('SettlementMenuIdleMascotVisual');
        if (mascotVisual?.isValid) tween(mascotVisual).stop();
    }

    private onDoubleStaminaClick(): void {
        SfxManager.instance.playUiClick();
        if (this.doubleStaminaClaimed) return;
        RewardService.requestReward((rewarded) => {
            if (!rewarded) return;
            GameApp.tiliManager?.addTili(this.baseStaminaReward);
            const globalHud = GameApp.globalHud as { refreshStamina?: () => void } | null;
            globalHud?.refreshStamina?.();
            this.doubleStaminaClaimed = true;
            if (this.staminaRewardLabel) {
                this.staminaRewardLabel.string = `+${this.baseStaminaReward * 2}`;
            }
            if (this.doubleButtonTitle) {
                this.doubleButtonTitle.string = '已领取';
                this.doubleButtonTitle.color = new Color(235, 240, 248, 255);
            }
            if (this.doubleButtonSub) {
                this.doubleButtonSub.string = '';
            }
            this.doubleStaminaBtn?.off(Node.EventType.TOUCH_END, this.onDoubleStaminaClick, this);
            this.setButtonDisabled(this.doubleStaminaBtn);
        });
    }

    private onReviveClick(): void {
        SfxManager.instance.playUiClick();
        if (GameApp.survivalReviveTime <= 0) return;
        RewardService.requestReward((rewarded) => {
            if (!rewarded) return;
            GameApp.survivalReviveTime = Math.max(0, GameApp.survivalReviveTime - 1);
            GameApp.isStartGame = true;
            GameApp.gameMode = GameMode.survival;

            const cdc = GameApp.countDownControl as CountdownController | null;
            cdc?.addTime(60);
            cdc?.startCountDown();

            GameApp.uiManager?.close(UIID.SurvivalOverPanel);
            const dg = GameApp.drawGrid as { reStartGame?: () => void; isGameOver?: boolean };
            if (dg) dg.isGameOver = false;
            dg?.reStartGame?.();
        });
    }

    private onRestartClick(): void {
        SfxManager.instance.playUiClick();
        if (GameApp.user.freeSurvivalTime <= 0) {
            RewardService.requestReward((rewarded) => {
                if (rewarded) this.restartSurvival();
            });
            return;
        }
        GameApp.user.freeSurvivalTime--;
        GameApp.user.save();
        this.restartSurvival();
    }

    private restartSurvival(): void {
        GameApp.useTime = 0;
        GameApp.passLevel = 0;
        GameApp.foundCowNum = 0;
        GameApp.survivalReviveTime = 1;
        GameApp.survivalIsWin = false;
        GameApp.isStartGame = true;
        GameApp.gameMode = GameMode.survival;
        GameApp.uiManager?.close(UIID.SurvivalOverPanel);
        const dg = GameApp.drawGrid as { startSurvivalMode?: () => void };
        dg?.startSurvivalMode?.();
    }

    private onFriendClick(): void {
        SfxManager.instance.playUiClick();
        GameApp.platform.share(() => {});
    }

    private onMenuClick(): void {
        SfxManager.instance.playUiClick();
        GameApp.isStartGame = false;
        const dg = GameApp.drawGrid as { setGameUIVisible?: (v: boolean) => void };
        dg?.setGameUIVisible?.(false);
        GameApp.uiManager?.closeAndOpen(UIID.SurvivalOverPanel, UIID.MainPanel);
    }

    private getBaseStaminaReward(): number {
        return GameApp.survivalSettlementStaminaReward || GameApp.getSurvivalStaminaReward(this.settlementPassLevel);
    }

    private getResultLine(): string {
        if (this.settlementPassLevel < 10) {
            return '你没撑过第十轮!';
        }
        return '恭喜通过第十轮！';
    }

    private getBeatPercent(): string {
        const raw = this.settlementPassLevel * 7.4 + this.settlementFoundCowNum * 1.15 + Math.min(18, this.settlementUseTime / 8);
        const clamped = Math.max(3.5, Math.min(99.2, raw));
        return `${clamped.toFixed(1)}%`;
    }

    private formatDuration(seconds: number): string {
        const safe = Math.max(0, Math.floor(seconds || 0));
        const minutes = Math.floor(safe / 60).toString().padStart(2, '0');
        const rest = (safe % 60).toString().padStart(2, '0');
        return `${minutes}分${rest}秒`;
    }
}

export function createSurvivalOverPanel(parent: Node): Component {
    const node = createNode('SurvivalOverPanel', parent);
    return node.addComponent(SurvivalOverPanel);
}
