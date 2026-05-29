import { _decorator, Component, Node, Label, UITransform, Size, Color, Graphics } from 'cc';
import GameApp from './Core/GameApp';
import { GameMode, UIID } from './Core/Enum';
import SfxManager from './Core/SfxManager';
import { CountdownController } from './Core/CountdownController';
import RewardService from './Core/RewardService';
import { formatClockTime } from './Utils/TimeFormat';
import { GlobalHudMode } from './GlobalHud';
import { getAdaptivePanelLayout } from './Utils/LayoutService';
import {
    createNode, createLabel, createFullScreenOverlay,
    createRoundedButton, createRoundedCard,
    animateNumber, staggerEntrance,
    COLOR_GOLD, COLOR_WHITE, COLOR_BLACK, COLOR_DEEP_NAVY,
    COLOR_TEAL, COLOR_RED, COLOR_AD_BLUE, COLOR_STAMINA,
} from './Utils/UIBuilder';

const { ccclass } = _decorator;

const PANEL_WIDTH = 600;
const PANEL_HEIGHT = 760;
const STAT_WIDTH = 252;
const STAT_HEIGHT = 86;
const TEXT_DARK = new Color(112, 78, 48, 255);
const TEXT_MUTED = new Color(160, 118, 80, 255);
const CARD_LINE = new Color(232, 199, 154, 255);
const PANEL_BG = new Color(255, 249, 240, 252);
const WIN_SOFT = new Color(255, 236, 192, 255);
const FAIL_SOFT = new Color(255, 225, 214, 255);
const BUTTON_PRIMARY = new Color(241, 156, 72, 255);
const BUTTON_SECONDARY = new Color(207, 118, 94, 255);
const BUTTON_PALE = new Color(255, 241, 221, 255);
const TITLE_WIN = new Color(220, 145, 47, 255);
const TITLE_FAIL = new Color(219, 103, 77, 255);

@ccclass('DailyChallengeOverPanel')
export default class DailyChallengeOverPanel extends Component {
    private isWin: boolean = false;
    private doubleStaminaBtn: Node | null = null;
    private reviveBtn: Node | null = null;
    private doubleStaminaClaimed: boolean = false;
    private staminaValueLabel: Label | null = null;
    private coinValueLabel: Label | null = null;
    private foundValueLabel: Label | null = null;

    onLoad(): void {
        this.isWin = GameApp.dailyChallengeIsWin;
        this.buildUI();
    }

    private buildUI(): void {
        const panelLayout = getAdaptivePanelLayout(PANEL_WIDTH, PANEL_HEIGHT, {
            horizontalMargin: 52,
            topMargin: 116,
            bottomMargin: 96,
            preferredY: 4,
        });
        const rootTransform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        rootTransform.setContentSize(new Size(panelLayout.layout.width, panelLayout.layout.height));
        createFullScreenOverlay('bgOverlay', this.node, COLOR_BLACK, 185);

        const card = createRoundedCard('card', this.node, PANEL_WIDTH, PANEL_HEIGHT, PANEL_BG, 34, 8, 42);
        card.setPosition(0, panelLayout.y, 0);
        card.setScale(panelLayout.scale, panelLayout.scale, 1);
        this.createRoundedBlock('topGlow', card, 536, 136, this.isWin ? WIN_SOFT : FAIL_SOFT, 28).setPosition(0, 284, 0);

        if (this.isWin) {
            this.buildWinUI(card);
        } else {
            this.buildFailUI(card);
        }
    }

    private buildWinUI(card: Node): void {
        const titleArea = this.createTitleArea(card, true, '每日挑战成功', `连续挑战成功 ${GameApp.user.dailyChallengeStreak} 天`);

        const statsArea = createNode('statsArea', card);
        statsArea.setPosition(0, 46, 0);
        this.createStatCard(statsArea, 'time', '用时', this.formatTime(GameApp.useTime), -138, 56, COLOR_TEAL, TEXT_DARK);
        this.createStatCard(statsArea, 'beat', '击败玩家', '98%', 138, 56, COLOR_AD_BLUE, TEXT_DARK);
        this.staminaValueLabel = this.createStatCard(statsArea, 'stamina', '体力奖励', '0', -138, -48, COLOR_STAMINA, COLOR_STAMINA);
        this.coinValueLabel = this.createStatCard(statsArea, 'coin', '金币奖励', '0', 138, -48, COLOR_GOLD, COLOR_GOLD);

        const btnArea = createNode('btnArea', card);
        btnArea.setPosition(0, -270, 0);

        const dbBtn = this.createRewardButton('doubleBtn', btnArea, '双倍体力 体力+30', '免费领取 体力+30', 440, 64);
        dbBtn.node.setPosition(0, 94, 0);
        this.doubleStaminaBtn = dbBtn.node;

        const contBtn = createRoundedButton('continueBtn', btnArea, '继续闯关', 440, 62, BUTTON_PRIMARY, COLOR_WHITE, 22, 22);
        contBtn.node.setPosition(0, 18, 0);

        const shareBtn = createRoundedButton('shareBtn', btnArea, '分享好友', 440, 56, BUTTON_SECONDARY, COLOR_WHITE, 20, 20);
        shareBtn.node.setPosition(0, -54, 0);

        titleArea.setSiblingIndex(card.children.length - 1);
    }

    private buildFailUI(card: Node): void {
        const totalCows = 5;
        const remaining = Math.max(0, totalCows - GameApp.foundCowNum);
        const titleArea = this.createTitleArea(card, false, '每日挑战失败', `还差 ${remaining} 只猫猫`);

        const statsArea = createNode('statsArea', card);
        statsArea.setPosition(0, 52, 0);
        this.foundValueLabel = this.createStatCard(statsArea, 'found', '找到猫猫', '0', -138, 56, COLOR_RED, TEXT_DARK);
        this.createStatCard(statsArea, 'remaining', '剩余目标', `${remaining} 只`, 138, 56, COLOR_GOLD, TEXT_DARK);
        this.createStatCard(statsArea, 'time', '用时', this.formatTime(GameApp.useTime), -138, -48, COLOR_TEAL, TEXT_DARK);
        this.createStatCard(statsArea, 'revive', '复活机会', `${GameApp.dailyChallengeReviveTime} 次`, 138, -48, COLOR_AD_BLUE, TEXT_DARK);

        const btnArea = createNode('btnArea', card);
        btnArea.setPosition(0, -250, 0);
        let btnY = GameApp.dailyChallengeReviveTime > 0 ? 118 : 82;
        const btnGap = -70;

        if (GameApp.dailyChallengeReviveTime > 0) {
            const revBtn = this.createRewardButton('reviveBtn', btnArea, '复活继续 +60s+心', '免费复活 +60s+心', 440, 58);
            revBtn.node.setPosition(0, btnY, 0);
            this.reviveBtn = revBtn.node;
            btnY += btnGap;
        }

        const restartBtn = this.createRewardButton('restartBtn', btnArea, '重新挑战', '重新挑战', 440, 60);
        restartBtn.node.setPosition(0, btnY, 0);
        btnY += btnGap;

        const friendBtn = createRoundedButton('friendBtn', btnArea, '求助好友', 440, 56, BUTTON_SECONDARY, COLOR_WHITE, 20, 20);
        friendBtn.node.setPosition(0, btnY, 0);
        btnY += btnGap;

        const menuBtn = createRoundedButton('menuLink', btnArea, '返回主页', 260, 50, BUTTON_PALE, new Color(136, 101, 66, 255), 18, 20);
        menuBtn.node.setPosition(0, btnY + 4, 0);

        titleArea.setSiblingIndex(card.children.length - 1);
    }

    private createRewardButton(name: string, parent: Node, adText: string, freeText: string, width: number, height: number): { node: Node; label: Label } {
        const buttonText = RewardService.isRewardAdAvailable() ? `看广告 ${adText}` : freeText;
        return createRoundedButton(name, parent, buttonText, width, height, BUTTON_PRIMARY, COLOR_WHITE, 22, Math.round(height / 2));
    }

    private createTitleArea(card: Node, isWin: boolean, title: string, subtitle: string): Node {
        const titleArea = createNode('titleArea', card);
        titleArea.setPosition(0, 264, 0);
        this.createResultBadge(titleArea, isWin);

        const titleLabel = createLabel('title', titleArea, title, 38, isWin ? TITLE_WIN : TITLE_FAIL, true);
        titleLabel.node.setPosition(0, -28, 0);
        this.setLabelSize(titleLabel, 470, 54);

        const subtitleLabel = createLabel('subtitle', titleArea, subtitle, 20, TEXT_MUTED);
        subtitleLabel.node.setPosition(0, -74, 0);
        this.setLabelSize(subtitleLabel, 470, 34);
        return titleArea;
    }

    private createResultBadge(parent: Node, isWin: boolean): Node {
        const badge = createNode('resultBadge', parent);
        badge.setPosition(0, 70, 0);
        badge.getComponent(UITransform)!.setContentSize(new Size(142, 142));

        const g = badge.addComponent(Graphics);
        g.fillColor = isWin ? new Color(255, 220, 146, 110) : new Color(255, 191, 177, 108);
        g.circle(0, 0, 70);
        g.fill();
        g.fillColor = isWin ? new Color(244, 174, 78, 255) : new Color(231, 123, 90, 255);
        g.circle(0, 0, 52);
        g.fill();

        g.lineWidth = 10;
        g.lineCap = Graphics.LineCap.ROUND;
        g.strokeColor = COLOR_WHITE;
        if (isWin) {
            g.moveTo(-22, 0);
            g.lineTo(-6, -16);
            g.lineTo(26, 20);
        } else {
            g.moveTo(-21, -21);
            g.lineTo(21, 21);
            g.moveTo(21, -21);
            g.lineTo(-21, 21);
        }
        g.stroke();
        return badge;
    }

    private createStatCard(parent: Node, name: string, title: string, value: string, x: number, y: number, accent: Color, valueColor: Color): Label {
        const card = this.createRoundedBlock(`${name}Card`, parent, STAT_WIDTH, STAT_HEIGHT, new Color(255, 253, 248, 255), 18, CARD_LINE, 2);
        card.setPosition(x, y, 0);
        this.createRoundedBlock(`${name}Accent`, card, 8, 54, accent, 4).setPosition(-108, 0, 0);

        const titleLabel = createLabel(`${name}Title`, card, title, 17, TEXT_MUTED);
        titleLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        titleLabel.node.setPosition(18, 18, 0);
        this.setLabelSize(titleLabel, 166, 26);

        const valueLabel = createLabel(`${name}Value`, card, value, 25, valueColor, true);
        valueLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        valueLabel.node.setPosition(18, -17, 0);
        this.setLabelSize(valueLabel, 166, 34);
        return valueLabel;
    }

    private createRoundedBlock(name: string, parent: Node, width: number, height: number, color: Color, radius: number, strokeColor?: Color, lineWidth: number = 0): Node {
        const node = createNode(name, parent);
        node.getComponent(UITransform)!.setContentSize(new Size(width, height));
        const g = node.addComponent(Graphics);
        g.fillColor = color;
        g.roundRect(-width / 2, -height / 2, width, height, radius);
        g.fill();
        if (strokeColor && lineWidth > 0) {
            g.lineWidth = lineWidth;
            g.strokeColor = strokeColor;
            g.roundRect(-width / 2, -height / 2, width, height, radius);
            g.stroke();
        }
        return node;
    }

    private setLabelSize(label: Label, width: number, height: number): void {
        label.node.getComponent(UITransform)!.setContentSize(new Size(width, height));
        label.overflow = Label.Overflow.SHRINK;
    }

    onEnable(): void {
        const globalHud = GameApp.globalHud as { setMode?: (mode: GlobalHudMode) => void; syncLayout?: () => void } | null;
        globalHud?.setMode?.(GlobalHudMode.ChallengeSettlement);
        globalHud?.syncLayout?.();
        const card = this.node.getChildByName('card');
        if (!card) return;

        const titleArea = card.getChildByName('titleArea');
        const statsArea = card.getChildByName('statsArea');
        const btnArea = card.getChildByName('btnArea');
        const entranceNodes: Node[] = [];
        if (titleArea) entranceNodes.push(titleArea);
        if (statsArea) entranceNodes.push(statsArea);
        if (btnArea) entranceNodes.push(btnArea);
        staggerEntrance(entranceNodes);

        if (this.isWin) {
            if (this.staminaValueLabel) animateNumber(this.staminaValueLabel, 0, 30, 0.8, '体力+', '');
            if (this.coinValueLabel) animateNumber(this.coinValueLabel, 0, 4, 0.8, '金币+', '', () => {
                SfxManager.instance.playCoinGain();
            });
        } else {
            if (this.foundValueLabel) animateNumber(this.foundValueLabel, 0, GameApp.foundCowNum, 0.8, '', ' / 5');
        }

        this.doubleStaminaBtn?.on(Node.EventType.TOUCH_END, this.onDoubleStaminaClick, this);
        this.reviveBtn?.on(Node.EventType.TOUCH_END, this.onReviveClick, this);

        const continueBtn = btnArea?.getChildByName('continueBtn');
        continueBtn?.on(Node.EventType.TOUCH_END, this.onContinueClick, this);

        const shareBtn = btnArea?.getChildByName('shareBtn');
        shareBtn?.on(Node.EventType.TOUCH_END, this.onShareClick, this);

        const restartBtn = btnArea?.getChildByName('restartBtn');
        restartBtn?.on(Node.EventType.TOUCH_END, this.onRestartClick, this);

        const friendBtn = btnArea?.getChildByName('friendBtn');
        friendBtn?.on(Node.EventType.TOUCH_END, this.onFriendClick, this);

        const menuLink = btnArea?.getChildByName('menuLink');
        menuLink?.on(Node.EventType.TOUCH_END, this.onMenuClick, this);
    }

    onDisable(): void {
        const card = this.node.getChildByName('card');
        if (!card) return;
        const btnArea = card.getChildByName('btnArea');

        this.doubleStaminaBtn?.off(Node.EventType.TOUCH_END, this.onDoubleStaminaClick, this);
        this.reviveBtn?.off(Node.EventType.TOUCH_END, this.onReviveClick, this);

        const continueBtn = btnArea?.getChildByName('continueBtn');
        continueBtn?.off(Node.EventType.TOUCH_END, this.onContinueClick, this);

        const shareBtn = btnArea?.getChildByName('shareBtn');
        shareBtn?.off(Node.EventType.TOUCH_END, this.onShareClick, this);

        const restartBtn = btnArea?.getChildByName('restartBtn');
        restartBtn?.off(Node.EventType.TOUCH_END, this.onRestartClick, this);

        const friendBtn = btnArea?.getChildByName('friendBtn');
        friendBtn?.off(Node.EventType.TOUCH_END, this.onFriendClick, this);

        const menuLink = btnArea?.getChildByName('menuLink');
        menuLink?.off(Node.EventType.TOUCH_END, this.onMenuClick, this);
    }

    private onDoubleStaminaClick(): void {
        SfxManager.instance.playUiClick();
        if (this.doubleStaminaClaimed) return;
        RewardService.requestReward((rewarded) => {
            if (!rewarded) return;
            GameApp.tiliManager?.addTili(30);
            this.doubleStaminaClaimed = true;
            if (this.doubleStaminaBtn) {
                this.doubleStaminaBtn.off(Node.EventType.TOUCH_END, this.onDoubleStaminaClick, this);
                const lbl = this.doubleStaminaBtn.getChildByName('label')?.getComponent(Label);
                if (lbl) {
                    lbl.color = new Color(160, 160, 160, 255);
                    lbl.string = '已领取';
                }
            }
        });
    }

    private onContinueClick(): void {
        SfxManager.instance.playUiClick();
        GameApp.gameMode = GameMode.level;
        GameApp.isStartGame = true;
        GameApp.uiManager?.close(UIID.DailyChallengeOverPanel);
        const dg = GameApp.drawGrid as { reStartGame?: () => void };
        dg?.reStartGame?.();
    }

    private onShareClick(): void {
        SfxManager.instance.playUiClick();
        GameApp.platform.share((success) => {
            if (success) {
                GameApp.tiliManager?.addTili(10);
            }
        });
    }

    private onReviveClick(): void {
        SfxManager.instance.playUiClick();
        RewardService.requestReward((rewarded) => {
            if (!rewarded) return;
            GameApp.dailyChallengeReviveTime--;

            const cdc = GameApp.countDownControl as CountdownController;
            cdc.addTime(60);
            cdc.startCountDown();

            const dg = GameApp.drawGrid as {
                heartContainer?: Node;
                mistakeCount?: number;
                isGameOver?: boolean;
            };
            if (dg?.heartContainer) {
                const hearts = dg.heartContainer.children;
                for (let i = 0; i < hearts.length; i++) {
                    if (!hearts[i].active) {
                        hearts[i].active = true;
                        break;
                    }
                }
            }
            if (dg && typeof dg.mistakeCount === 'number') {
                dg.mistakeCount--;
            }
            if (dg) {
                dg.isGameOver = false;
            }

            if (this.reviveBtn) {
                this.reviveBtn.off(Node.EventType.TOUCH_END, this.onReviveClick, this);
                const lbl = this.reviveBtn.getChildByName('label')?.getComponent(Label);
                if (lbl) {
                    lbl.color = new Color(160, 160, 160, 255);
                    lbl.string = '已使用';
                }
            }

            GameApp.uiManager?.close(UIID.DailyChallengeOverPanel);
        });
    }

    private onRestartClick(): void {
        SfxManager.instance.playUiClick();
        RewardService.requestReward((rewarded) => {
            if (!rewarded) return;
            GameApp.uiManager?.close(UIID.DailyChallengeOverPanel);
            const dg = GameApp.drawGrid as { onDailyChallengeRestart?: () => void };
            dg?.onDailyChallengeRestart?.();
        });
    }

    private onFriendClick(): void {
        SfxManager.instance.playUiClick();
        GameApp.platform.share((success) => {
            if (success) {
                GameApp.tiliManager?.addTili(10);
            }
        });
    }

    private onMenuClick(): void {
        SfxManager.instance.playUiClick();
        GameApp.isStartGame = false;
        GameApp.uiManager?.close(UIID.DailyChallengeOverPanel);
        const dg = GameApp.drawGrid as { onDailyChallengeReturnMenu?: () => void };
        dg?.onDailyChallengeReturnMenu?.();
    }

    private formatTime(seconds: number): string {
        return formatClockTime(seconds);
    }
}

export function createDailyChallengeOverPanel(parent: Node): Component {
    const node = createNode('DailyChallengeOverPanel', parent);
    return node.addComponent(DailyChallengeOverPanel);
}
