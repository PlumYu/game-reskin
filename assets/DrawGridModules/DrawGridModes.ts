import { Graphics, Color, Vec3, v3, input, Input, EventTouch, tween, SpriteFrame, Node, Sprite, UITransform as CcUITransform, Label, EditBox, director, Layers, Texture2D, UIOpacity, view, Button, Widget } from 'cc';
import GameApp from '../Core/GameApp';
import { GameMode, UIID } from '../Core/Enum';
import UIManager from '../Core/UIManager';
import CountdownController from '../Core/CountdownController';
import SfxManager from '../Core/SfxManager';
import TiliManager from '../Core/TiliManager';
import AssetService from '../Core/AssetService';
import { createLabel, createNode, createFullScreenOverlay, createCircle, addButtonFeedback, createRoundedCard, COLOR_GOLD, COLOR_WHITE, COLOR_TOOLBAR_BG, RADIUS_MD, getScreenSize } from '../Utils/UIBuilder';
import { generateRandomLevel } from '../Game/LevelGenerator';
import { generateDailyChallengeLevel } from '../Game/DailyChallengeLevelGenerator';
import { applyLevelConfigData, isValidLevelConfig, type LevelConfigData } from '../Game/LevelConfig';
import { getDailyChallengeLevelPath, getDailyChallengeStagePath, getSurvivalLevelPath, getSurvivalStagePath } from '../Game/SurvivalConfig';
import { formatClockTime } from '../Utils/TimeFormat';
import PerfDebug from '../Utils/PerfDebug';
type HiddenChallengeConfig = {
    key: 'noMistake' | 'noHint' | 'fastClear' | 'firstTry' | 'markFive' | 'steadyFinish';
    text: string;
};
type CowIdleActionKind = 'idle1' | 'idle2' | 'found';
type CowFrameLayout = {
    scale: number;
    x: number;
    y: number;
};
type BalloonFloatState = {
    x: number;
    y: number;
    angle: number;
    scale: number;
};

const SHARED_GAMEPLAY_SPLASH_NODE_NAMES = new Set([
    'Label',
    'dikuang',
    'dikuang-001',
    'Node',
    'tips1',
    'tips2',
    'clear',
    'point',
]);
const SURVIVAL_COUNTDOWN_SECONDS = 60;
const DAILY_CHALLENGE_COUNTDOWN_SECONDS = 180;
const COUNTDOWN_CLOCK_ICON_SIZE = 34;
const COUNTDOWN_CLOCK_VISUAL_SCALE = 0.82;

export function installDrawGridModes(target: any): void {
    Object.assign(target.prototype, {
    reStartGame: function (): void {
        PerfDebug.begin('gameplay restart', { mode: GameApp.gameMode, level: this.currentLevel, passLevel: GameApp.passLevel });
        // Switch to level BGM when entering gameplay
        SfxManager.instance.playLevelBgm();

        this.isGameOver = false;
        this.loadCowAnimationFrames();
        if (this.resultNode) {
            this.resultNode.active = false;
        }
        this.loadBalloonAssets(() => {
            if (GameApp.gameMode === GameMode.survival) {
                this.loadSurvivalLevel(() => {
                    this.renderGrid();
                    PerfDebug.end('gameplay restart', { mode: 'survival', gridSize: this.gridSize });
                    AssetService.logCacheStats('gameplay restart end');
                    PerfDebug.flushCounters('gameplay restart end');
                    PerfDebug.startFpsProbe('gameplay survival', 20000);
                    this.refreshTimedChallengeHud?.();
                    this.warmupCowAnimationAfterFirstFrame?.();
                });
            } else if (GameApp.gameMode === GameMode.daily_challenge) {
                this.loadDailyChallengeLevel(() => {
                    this.renderGrid();
                    PerfDebug.end('gameplay restart', { mode: 'daily_challenge', gridSize: this.gridSize });
                    AssetService.logCacheStats('gameplay restart end');
                    PerfDebug.flushCounters('gameplay restart end');
                    PerfDebug.startFpsProbe('gameplay daily_challenge', 20000);
                    this.refreshTimedChallengeHud?.();
                    this.warmupCowAnimationAfterFirstFrame?.();
                });
            } else {
                this.setGameUIVisible?.(true);
                this.initGrid(() => {
                    this.renderGrid();
                    PerfDebug.end('gameplay restart', { mode: 'level', gridSize: this.gridSize, level: this.currentLevel });
                    AssetService.logCacheStats('gameplay restart end');
                    PerfDebug.flushCounters('gameplay restart end');
                    PerfDebug.startFpsProbe('gameplay level', 20000);
                    this.scheduleHintUnlockGuideIfNeeded?.();
                    this.warmupCowAnimationAfterFirstFrame?.();
                });
            }
            this.syncProgressLabels();
        });
    },
    warmupCowAnimationAfterFirstFrame: function (): void {
        this.scheduleOnce(() => {
            this.loadCowAnimationFrames();
        }, 0.05);
    },
    startSurvivalMode: function (): void {
        PerfDebug.begin('start survival mode', { passLevel: GameApp.passLevel });
        // Switch to level BGM for survival mode
        SfxManager.instance.playLevelBgm();

        GameApp.gameMode = GameMode.survival;
        GameApp.isGuideSettlement = false;
        this.resetGuideRuntimeState?.(false);
        const countdownSessionId = this.beginCountdownRuntime();
        this.isGameOver = false;
        GameApp.survivalIsWin = false;
        if (this.resultNode) this.resultNode.active = false;

        this.setSurvivalSplashUI(true);
        this.loadCowAnimationFrames();

        this.setupCountdownLabel();
        this.buildMilestoneBar();
        this.refreshTimedChallengeHud?.();

        this.loadBalloonAssets(() => {
            this.loadSurvivalLevel(() => {
                this.renderGrid();
                PerfDebug.end('start survival mode', { gridSize: this.gridSize, totalCows: this.totalCows });
                AssetService.logCacheStats('start survival mode end');
                PerfDebug.flushCounters('start survival mode end');
                PerfDebug.startFpsProbe('gameplay survival', 20000);
                this.refreshTimedChallengeHud?.();
                this.warmupCowAnimationAfterFirstFrame?.();
                this.scheduleOnce(() => {
                    if (!this.isCountdownRuntimeActive(countdownSessionId, GameMode.survival)) return;
                    const cdc = this.getOrCreateCountdownController();
                    cdc.initAndStart(SURVIVAL_COUNTDOWN_SECONDS, this.countdownLabel, () => {
                        if (!this.isCountdownRuntimeActive(countdownSessionId, GameMode.survival)) return;
                        this.survivalOver();
                    });
                    this.unschedule(this.updateCountdownWarning);
                    this.schedule(this.updateCountdownWarning, 0.1);
                }, 1);
            });
        });
    },
    setSurvivalSplashUI: function (isSurvival: boolean): void {
        const canvas = director.getScene()?.getChildByName('Canvas');
        if (!canvas) return;
        const splash = canvas.getChildByName('SpriteSplash');
        if (!splash) return;

        if (!isSurvival) {
            this.destroyMilestoneBar();
            this.destroySurvivalFoundCowsPanel?.();
        }

        const survivalNodeNames = new Set([
            ...SHARED_GAMEPLAY_SPLASH_NODE_NAMES,
            'CountdownLabel',
            'MilestoneBar',
        ]);
        const staleTips = splash.getChildByName('SurvivalTips');
        if (staleTips) {
            staleTips.removeFromParent();
            staleTips.destroy();
        }
        const staleRules = splash.getChildByName('SurvivalRules');
        if (staleRules) {
            staleRules.removeFromParent();
            staleRules.destroy();
        }
        for (let i = 0; i < splash.children.length; i++) {
            const child = splash.children[i];
            if (this.isGlobalHudNode(child)) {
                child.active = false;
                continue;
            }
            child.active = !isSurvival || survivalNodeNames.has(child.name) || child === this.ruleBoxNode;
        }

        const jumpLabel = canvas.getChildByName('JumpLabel');
        if (jumpLabel) jumpLabel.active = !isSurvival;

        if (this.debugPanelNode) {
            this.debugPanelNode.active = false;
        }

        if (!isSurvival) {
            this.stopCountdownRuntime();
            const survivalTips = splash.getChildByName('SurvivalTips');
            if (survivalTips) survivalTips.destroy();
            const survivalRules = splash.getChildByName('SurvivalRules');
            if (survivalRules) survivalRules.destroy();
            const countdownNode = splash.getChildByName('CountdownLabel');
            if (countdownNode) countdownNode.destroy();
            this.countdownLabel = null;
            this.destroySurvivalFoundCowsPanel?.();
        }
    },
    clearCountdownLabelChildren: function (labelNode: Node): void {
        const children = labelNode.children.slice();
        for (const child of children) {
            child.removeFromParent();
            child.destroy();
        }
    },
    drawDailyCountdownClock: function (node: Node): void {
        const graphics = node.getComponent(Graphics) || node.addComponent(Graphics);
        graphics.clear();
        const s = COUNTDOWN_CLOCK_VISUAL_SCALE;
        const p = (value: number): number => value * s;
        const lw = (value: number): number => Math.max(1, value * s);

        graphics.fillColor = new Color(142, 87, 26, 58);
        graphics.circle(p(2), p(-3), p(19));
        graphics.fill();

        graphics.fillColor = new Color(231, 49, 85, 255);
        graphics.ellipse(p(-11), p(17), p(9), p(7));
        graphics.fill();
        graphics.ellipse(p(11), p(17), p(9), p(7));
        graphics.fill();

        graphics.fillColor = new Color(255, 184, 57, 255);
        graphics.roundRect(p(-5), p(19), p(10), p(7), p(3));
        graphics.fill();

        graphics.fillColor = new Color(255, 158, 40, 255);
        graphics.circle(0, 0, p(18));
        graphics.fill();

        graphics.fillColor = new Color(255, 230, 109, 255);
        graphics.circle(p(-3), p(3), p(15));
        graphics.fill();

        graphics.strokeColor = new Color(220, 126, 30, 255);
        graphics.lineWidth = lw(2.4);
        graphics.circle(0, 0, p(18));
        graphics.stroke();

        graphics.fillColor = new Color(255, 248, 216, 255);
        graphics.circle(0, 0, p(12));
        graphics.fill();

        graphics.strokeColor = new Color(255, 202, 88, 255);
        graphics.lineWidth = lw(1.8);
        graphics.circle(0, 0, p(12));
        graphics.stroke();

        graphics.strokeColor = new Color(36, 66, 95, 255);
        graphics.lineWidth = lw(2.8);
        graphics.lineCap = Graphics.LineCap.ROUND;
        graphics.lineJoin = Graphics.LineJoin.ROUND;
        graphics.moveTo(0, 0);
        graphics.lineTo(0, p(7));
        graphics.moveTo(0, 0);
        graphics.lineTo(p(7), p(-4));
        graphics.stroke();

        graphics.fillColor = new Color(36, 66, 95, 255);
        graphics.circle(0, 0, p(2.6));
        graphics.fill();

        graphics.fillColor = new Color(255, 255, 255, 130);
        graphics.ellipse(p(-6), p(8), p(4), p(2));
        graphics.fill();
    },
    drawDailyCountdownCard: function (node: Node, width: number, height: number): void {
        const graphics = node.getComponent(Graphics) || node.addComponent(Graphics);
        graphics.clear();
        graphics.fillColor = new Color(48, 82, 140, 58);
        graphics.roundRect(-width / 2 + 4, -height / 2 - 4, width, height, height / 2);
        graphics.fill();
        graphics.fillColor = new Color(248, 252, 255, 248);
        graphics.roundRect(-width / 2, -height / 2, width, height, height / 2);
        graphics.fill();
        graphics.strokeColor = new Color(184, 214, 247, 255);
        graphics.lineWidth = 2;
        graphics.roundRect(-width / 2, -height / 2, width, height, height / 2);
        graphics.stroke();
    },
    setupDailyCountdownLabel: function (labelNode: Node): void {
        const width = 146;
        const height = 52;
        const defaultText = this.formatCountdownSeconds(
            GameApp.gameMode === GameMode.daily_challenge ? DAILY_CHALLENGE_COUNTDOWN_SECONDS : SURVIVAL_COUNTDOWN_SECONDS
        );
        labelNode.getComponent(CcUITransform)?.setContentSize(width, height);
        if (!labelNode.getChildByName('DailyCountdownCard')) {
            this.clearCountdownLabelChildren(labelNode);

            const card = new Node('DailyCountdownCard');
            card.layer = Layers.Enum.UI_2D;
            card.addComponent(CcUITransform).setContentSize(width, height);
            labelNode.addChild(card);
            card.setPosition(0, 0, 0);
            this.drawDailyCountdownCard(card, width, height);

            const iconNode = new Node('DailyCountdownClock');
            iconNode.layer = Layers.Enum.UI_2D;
            iconNode.addComponent(CcUITransform).setContentSize(COUNTDOWN_CLOCK_ICON_SIZE, COUNTDOWN_CLOCK_ICON_SIZE);
            card.addChild(iconNode);
            iconNode.setPosition(-45, 0, 0);
            this.drawDailyCountdownClock(iconNode);

            const textNode = new Node('CountdownText');
            textNode.layer = Layers.Enum.UI_2D;
            textNode.addComponent(CcUITransform).setContentSize(82, 36);
            card.addChild(textNode);
            textNode.setPosition(28, 0, 0);
            const lbl = textNode.addComponent(Label);
            lbl.fontSize = 29;
            lbl.lineHeight = 34;
            lbl.isBold = true;
            lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
            lbl.verticalAlign = Label.VerticalAlign.CENTER;
            lbl.color = new Color(36, 92, 180, 255);
            lbl.string = defaultText;
            this.countdownLabel = lbl;
        } else {
            const oldPrefix = this.findChildByNameDeep(labelNode, 'DailyCountdownPrefix');
            if (oldPrefix) {
                oldPrefix.removeFromParent();
                oldPrefix.destroy();
            }
            const textNode = this.findChildByNameDeep(labelNode, 'CountdownText');
            const lbl = textNode?.getComponent(Label);
            if (lbl) {
                textNode?.getComponent(CcUITransform)?.setContentSize(82, 36);
                textNode?.setPosition(28, 0, 0);
                lbl.fontSize = 29;
                lbl.lineHeight = 34;
                lbl.isBold = true;
                lbl.color = new Color(36, 92, 180, 255);
                lbl.string = defaultText;
                this.countdownLabel = lbl;
            }
            const card = labelNode.getChildByName('DailyCountdownCard');
            if (card) {
                card.getComponent(CcUITransform)?.setContentSize(width, height);
                this.drawDailyCountdownCard(card, width, height);
            }
            const clock = this.findChildByNameDeep(labelNode, 'DailyCountdownClock');
            if (clock) {
                clock.getComponent(CcUITransform)?.setContentSize(COUNTDOWN_CLOCK_ICON_SIZE, COUNTDOWN_CLOCK_ICON_SIZE);
                clock.setPosition(-45, 0, 0);
                this.drawDailyCountdownClock(clock);
            }
        }
    },
    setupSurvivalCountdownLabel: function (labelNode: Node): void {
        const width = 260;
        const height = 64;
        labelNode.getComponent(CcUITransform)?.setContentSize(width, height);
        if (!labelNode.getChildByName('CountdownBg')) {
            this.clearCountdownLabelChildren(labelNode);

            const bg = new Node('CountdownBg');
            bg.layer = Layers.Enum.UI_2D;
            bg.addComponent(CcUITransform).setContentSize(width, height);
            labelNode.addChild(bg);
            bg.setPosition(0, 0, 0);
            const g = bg.addComponent(Graphics);
            g.fillColor = new Color(25, 25, 50, 200);
            g.roundRect(-width / 2, -height / 2, width, height, height / 2);
            g.fill();
            g.strokeColor = new Color(255, 255, 255, 40);
            g.lineWidth = 1.5;
            g.roundRect(-width / 2, -height / 2, width, height, height / 2);
            g.stroke();

            const textNode = new Node('CountdownText');
            textNode.layer = Layers.Enum.UI_2D;
            textNode.addComponent(CcUITransform).setContentSize(240, 60);
            labelNode.addChild(textNode);
            textNode.setPosition(0, 0, 0);
            const lbl = textNode.addComponent(Label);
            lbl.fontSize = 42;
            lbl.lineHeight = 48;
            lbl.isBold = true;
            lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
            lbl.verticalAlign = Label.VerticalAlign.CENTER;
            lbl.color = new Color(255, 255, 255, 255);
            lbl.string = this.formatCountdownSeconds(SURVIVAL_COUNTDOWN_SECONDS);
            this.countdownLabel = lbl;
        } else {
            const textNode = labelNode.getChildByName('CountdownText');
            const lbl = textNode?.getComponent(Label);
            if (lbl) {
                lbl.fontSize = 42;
                lbl.lineHeight = 48;
                lbl.isBold = true;
                lbl.color = new Color(255, 255, 255, 255);
                lbl.string = this.formatCountdownSeconds(SURVIVAL_COUNTDOWN_SECONDS);
                this.countdownLabel = lbl;
            }
        }
    },
    formatCountdownSeconds: function (seconds: number): string {
        return `${Math.max(0, Math.floor(seconds || 0))}s`;
    },
    setupCountdownLabel: function (): void {
        const canvas = director.getScene()?.getChildByName('Canvas');
        if (!canvas) return;
        const splash = canvas.getChildByName('SpriteSplash');
        if (!splash) return;

        let labelNode = splash.getChildByName('CountdownLabel');
        if (!labelNode) {
            labelNode = new Node('CountdownLabel');
            labelNode.layer = Layers.Enum.UI_2D;
            labelNode.addComponent(CcUITransform);
            splash.addChild(labelNode);
        }

        if (GameApp.gameMode === GameMode.daily_challenge || GameApp.gameMode === GameMode.survival) {
            this.setupDailyCountdownLabel(labelNode);
        } else {
            this.setupSurvivalCountdownLabel(labelNode);
        }

        if (GameApp.gameMode === GameMode.daily_challenge || GameApp.gameMode === GameMode.survival) {
            labelNode.setPosition(112, 360, 0);
        } else {
            labelNode.setPosition(0, 560, 0);
        }
        labelNode.active = true;
        this.syncRemainingCowsPosition?.();
    },
    beginCountdownRuntime: function (): number {
        this.countdownSessionId = (this.countdownSessionId || 0) + 1;
        this.unschedule(this.updateCountdownWarning);
        const cdc = GameApp.countDownControl as CountdownController | null;
        cdc?.endCountDown();
        return this.countdownSessionId;
    },
    stopCountdownRuntime: function (): void {
        this.countdownSessionId = (this.countdownSessionId || 0) + 1;
        this.unschedule(this.updateCountdownWarning);
        const cdc = GameApp.countDownControl as CountdownController | null;
        cdc?.endCountDown();
    },
    isCountdownRuntimeActive: function (sessionId: number, mode: GameMode): boolean {
        const label = this.countdownLabel;
        return this.countdownSessionId === sessionId
            && GameApp.gameMode === mode
            && GameApp.isStartGame
            && !!label
            && !!label.node
            && label.node.isValid;
    },
    setupSurvivalTips: function (): void {
        const canvas = director.getScene()?.getChildByName('Canvas');
        if (!canvas) return;
        const splash = canvas.getChildByName('SpriteSplash');
        if (!splash) return;
        const tipsNode = splash.getChildByName('SurvivalTips');
        if (tipsNode) {
            tipsNode.removeFromParent();
            tipsNode.destroy();
        }
    },
    setupSurvivalRules: function (): void {
        const canvas = director.getScene()?.getChildByName('Canvas');
        if (!canvas) return;
        const splash = canvas.getChildByName('SpriteSplash');
        if (!splash) return;
        const rulesNode = splash.getChildByName('SurvivalRules');
        if (rulesNode) {
            rulesNode.removeFromParent();
            rulesNode.destroy();
        }
    },
    showTimeToast: function (text: string, isPositive: boolean, anchorToCountdown: boolean = false): void {
        const canvas = director.getScene()?.getChildByName('Canvas');
        if (!canvas) return;

        const toast = new Node('TimeToast');
        toast.layer = Layers.Enum.UI_2D;
        toast.addComponent(CcUITransform).setContentSize(200, 50);
        canvas.addChild(toast);
        let startPosition = v3(0, 100, 0);
        let endPosition = v3(0, 250, 0);
        if (anchorToCountdown) {
            const labelNode = this.countdownLabel?.node as Node | null;
            const canvasTransform = canvas.getComponent(CcUITransform);
            let countdownRoot = labelNode;
            while (countdownRoot?.parent && countdownRoot.name !== 'CountdownLabel' && countdownRoot.parent !== canvas) {
                countdownRoot = countdownRoot.parent;
            }
            const countdownTransform = countdownRoot?.getComponent(CcUITransform);
            if (countdownRoot?.isValid && countdownTransform && canvasTransform) {
                const anchorY = countdownTransform.anchorPoint?.y ?? 0.5;
                const topLocalY = countdownTransform.contentSize.height * (1 - anchorY);
                const topWorld = countdownTransform.convertToWorldSpaceAR(v3(0, topLocalY + 10, 0));
                const topLocal = canvasTransform.convertToNodeSpaceAR(topWorld);
                startPosition = v3(topLocal.x, topLocal.y, 0);
                endPosition = v3(topLocal.x, topLocal.y + 62, 0);
            }
        }
        toast.setPosition(startPosition);

        const label = toast.addComponent(Label);
        label.string = text;
        label.fontSize = 38;
        label.lineHeight = 44;
        label.isBold = true;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.color = isPositive ? new Color(31, 199, 165, 255) : new Color(255, 60, 60, 255);

        tween(toast)
            .to(0.8, { position: endPosition }, { easing: 'quadOut' })
            .call(() => toast.destroy())
            .start();
    },
    updateCountdownWarning: function (): void {
        if (GameApp.gameMode !== GameMode.survival && GameApp.gameMode !== GameMode.daily_challenge) return;
        const label = this.countdownLabel;
        if (!label || !label.node || !label.node.isValid) {
            this.countdownLabel = null;
            this.unschedule(this.updateCountdownWarning);
            return;
        }
        const cdc = GameApp.countDownControl as CountdownController | null;
        if (!cdc) return;
        const remaining = cdc.getCurrentTime();
        const normalColor = new Color(36, 92, 180, 255);
        label.node.active = true;
        if (remaining <= 10) {
            label.color = new Color(255, 64, 82, 255);
        } else {
            label.color = normalColor;
        }
    },
    survivalOver: function (): void {
        this.isGameOver = true;
        this.unschedule(this.updateCountdownWarning);
        if (this.countdownLabel?.node && this.countdownLabel.node.isValid) {
            this.countdownLabel.node.active = true;
            this.countdownLabel.color = new Color(255, 50, 50, 255);
            this.countdownLabel.string = this.formatCountdownSeconds(0);
        }
        // 生存模式现在一直连续闯关，直到倒计时结束再结算。

        const settlementPassLevel = Math.max(0, Math.floor(GameApp.passLevel || 0));
        const settlementFoundCowNum = Math.max(0, Math.floor((GameApp.foundCowNum || 0) + (this.cowsFound || 0)));
        const settlementUseTime = Math.max(0, Math.floor(GameApp.useTime || 0));
        const staminaReward = GameApp.getSurvivalStaminaReward(settlementPassLevel);
        GameApp.survivalSettlementPassLevel = settlementPassLevel;
        GameApp.survivalSettlementFoundCowNum = settlementFoundCowNum;
        GameApp.survivalSettlementUseTime = settlementUseTime;
        GameApp.survivalSettlementStaminaReward = staminaReward;

        // 体力奖励
        GameApp.tiliManager?.addTili(staminaReward);

        // 最高记录持久化
        const user = GameApp.user;
        if (GameApp.passLevel > user.survivalBestRound) {
            user.survivalBestRound = GameApp.passLevel;
        }

        // 清理旧的庆祝动画，打开结算面板
        this.hideSurvivalOverCelebration();
        GameApp.uiManager?.open(UIID.SurvivalOverPanel);
    },
    showSurvivalOverCelebration: function (): void {
        this.hideSurvivalOverCelebration();
        const version = ++this.survivalOverVersion;

        const root = new Node('SurvivalOverCelebration');
        this.setUILayer(root);
        root.addComponent(CcUITransform).setContentSize(this.CELEBRATION_WIDTH, this.CELEBRATION_HEIGHT);
        root.parent = this.node;
        root.setPosition(0, 0);
        root.setSiblingIndex(430);
        this.survivalOverRoot = root;
        this.blockNodeTouch(root);

        // 暗幕层
        const overlayNode = new Node('SurvivalOverOverlay');
        this.setUILayer(overlayNode);
        overlayNode.parent = root;
        overlayNode.addComponent(CcUITransform).setContentSize(this.CELEBRATION_WIDTH, this.CELEBRATION_HEIGHT);
        const overlayG = overlayNode.addComponent(Graphics);
        overlayG.fillColor = new Color(0, 0, 0, 0);
        overlayG.rect(-this.CELEBRATION_WIDTH / 2, -this.CELEBRATION_HEIGHT / 2, this.CELEBRATION_WIDTH, this.CELEBRATION_HEIGHT);
        overlayG.fill();

        // 暗幕渐入
        const overlayState = { alpha: 0 };
        tween(overlayState)
            .to(0.5, { alpha: 200 }, {
                easing: 'quadOut',
                onUpdate: () => {
                    if (version !== this.survivalOverVersion) return;
                    overlayG.clear();
                    overlayG.fillColor = new Color(10, 5, 20, Math.floor(overlayState.alpha));
                    overlayG.rect(-this.CELEBRATION_WIDTH / 2, -this.CELEBRATION_HEIGHT / 2, this.CELEBRATION_WIDTH, this.CELEBRATION_HEIGHT);
                    overlayG.fill();
                }
            })
            .start();

        // 粒子层
        const particleNode = new Node('SurvivalOverParticles');
        this.setUILayer(particleNode);
        particleNode.parent = root;
        particleNode.addComponent(CcUITransform).setContentSize(this.CELEBRATION_WIDTH, this.CELEBRATION_HEIGHT);
        this.survivalOverGraphics = particleNode.addComponent(Graphics);

        // 初始化下落粒子
        this.survivalOverParticles = [];
        const particleColors = [
            new Color(255, 60, 60, 255),
            new Color(255, 120, 40, 255),
            new Color(200, 50, 50, 255),
            new Color(255, 80, 80, 180),
            new Color(180, 40, 40, 200),
            new Color(255, 160, 60, 160),
        ];
        for (let i = 0; i < 50; i++) {
            this.survivalOverParticles.push({
                x: (Math.random() - 0.5) * this.CELEBRATION_WIDTH,
                y: this.CELEBRATION_HEIGHT / 2 + Math.random() * 400,
                vx: (Math.random() - 0.5) * 60,
                vy: -80 - Math.random() * 120,
                size: 4 + Math.random() * 10,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 4,
                color: particleColors[Math.floor(Math.random() * particleColors.length)],
                alpha: 0.6 + Math.random() * 0.4,
            });
        }

        // 粒子动画循环
        const particleState = { time: 0 };
        tween(particleState)
            .to(3600, { time: 3600 }, {
                easing: 'linear',
                onUpdate: () => {
                    if (version !== this.survivalOverVersion) return;
                    this.renderSurvivalOverParticles();
                }
            })
            .start();

        // "挑战结束" 标题 — 从上方弹入
        const titleNode = this.createCelebrationLabel('挑战结束', 46, new Color(255, 80, 80, 255));
        titleNode.parent = root;
        titleNode.setPosition(0, 600);
        tween(titleNode)
            .to(0.4, { position: v3(0, 340, 0) }, { easing: 'backOut' })
            .start();

        // 分割线
        const lineNode = new Node('SurvivalOverLine');
        this.setUILayer(lineNode);
        lineNode.parent = root;
        lineNode.addComponent(CcUITransform).setContentSize(400, 4);
        const lineG = lineNode.addComponent(Graphics);
        lineG.fillColor = new Color(255, 255, 255, 40);
        lineG.roundRect(-200, -2, 400, 4, 2);
        lineG.fill();
        lineNode.setPosition(0, 290);
        lineNode.setScale(v3(0, 1, 1));
        tween(lineNode)
            .delay(0.3)
            .to(0.35, { scale: v3(1, 1, 1) }, { easing: 'quadOut' })
            .start();

        // 统计行 — 逐行从侧面飞入
        const stats = [
            { title: '已点到', value: `${GameApp.foundCowNum}`, unit: '个', delay: 0.45, fromX: -400 },
            { title: '通过关数', value: `${GameApp.passLevel}`, unit: '关', delay: 0.60, fromX: 400 },
            { title: '坚持时间', value: this.formatSurvivalTime(GameApp.useTime), unit: '', delay: 0.75, fromX: -400 },
        ];

        for (const stat of stats) {
            const row = new Node(`StatRow_${stat.title}`);
            this.setUILayer(row);
            row.addComponent(CcUITransform).setContentSize(460, 60);
            row.parent = root;
            const rowY = 340 - 90 - (stats.indexOf(stat)) * 80;
            row.setPosition(stat.fromX, rowY);

            const titleLabel = this.createCelebrationLabel(stat.title, 22, new Color(180, 180, 200, 255));
            const titleUt = titleLabel.getComponent(CcUITransform)!;
            titleUt.setContentSize(200, 40);
            titleLabel.parent = row;
            titleLabel.setPosition(-100, 0);
            const tl = titleLabel.getComponent(Label)!;
            tl.horizontalAlign = Label.HorizontalAlign.LEFT;

            const valueText = stat.unit ? `${stat.value} ${stat.unit}` : stat.value;
            const valueLabel = this.createCelebrationLabel(valueText, 32, new Color(255, 255, 255, 255));
            const valueUt = valueLabel.getComponent(CcUITransform)!;
            valueUt.setContentSize(200, 40);
            valueLabel.parent = row;
            valueLabel.setPosition(100, 0);
            const vl = valueLabel.getComponent(Label)!;
            vl.horizontalAlign = Label.HorizontalAlign.RIGHT;

            tween(row)
                .delay(stat.delay)
                .to(0.35, { position: v3(0, rowY, 0) }, { easing: 'backOut' })
                .start();
        }

        // 重新开始按钮 — 橙色主按钮
        const restartBtn = this.createCelebrationButton('SurvivalOverRestart', '重新开始', 280, 72, new Color(255, 140, 0, 255), 30);
        restartBtn.parent = root;
        restartBtn.setPosition(0, -260);
        restartBtn.setScale(v3(0, 0, 1));
        this.blockNodeTouch(restartBtn);
        tween(restartBtn)
            .delay(1.0)
            .to(0.3, { scale: v3(1.1, 1.1, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: v3(1, 1, 1) }, { easing: 'quadIn' })
            .repeatForever(
                tween(restartBtn)
                    .to(0.7, { scale: v3(1.06, 1.06, 1) }, { easing: 'quadInOut' })
                    .to(0.7, { scale: v3(1, 1, 1) }, { easing: 'quadInOut' })
            )
            .start();

        restartBtn.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
            SfxManager.instance.playUiClick();
            this.hideSurvivalOverCelebration();
            this.onSurvivalRestart();
        }, this);

        // 返回主菜单按钮
        const menuBtn = this.createCelebrationButton('SurvivalOverMenu', '返回主菜单', 280, 64, new Color(60, 80, 120, 255), 24);
        menuBtn.parent = root;
        menuBtn.setPosition(0, -360);
        menuBtn.setScale(v3(0, 0, 1));
        this.blockNodeTouch(menuBtn);
        tween(menuBtn)
            .delay(1.15)
            .to(0.25, { scale: v3(1.05, 1.05, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: v3(1, 1, 1) }, { easing: 'quadIn' })
            .start();

        menuBtn.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
            SfxManager.instance.playUiClick();
            this.hideSurvivalOverCelebration();
            this.onSurvivalReturnMenu();
        }, this);
    },
    hideSurvivalOverCelebration: function (): void {
        this.survivalOverVersion++;
        if (this.survivalOverRoot) {
            this.survivalOverRoot.destroy();
            this.survivalOverRoot = null;
        }
        this.survivalOverGraphics = null;
        this.survivalOverParticles = [];
    },
    renderSurvivalOverParticles: function (): void {
        const g = this.survivalOverGraphics;
        if (!g) return;
        g.clear();

        const halfW = this.CELEBRATION_WIDTH / 2;
        const halfH = this.CELEBRATION_HEIGHT / 2;

        for (const p of this.survivalOverParticles) {
            p.x += p.vx * 0.016;
            p.y += p.vy * 0.016;
            p.rot += p.rotSpeed * 0.016;
            p.vx += (Math.random() - 0.5) * 2;

            // 到底部后重置到顶部
            if (p.y < -halfH - 20) {
                p.y = halfH + Math.random() * 100;
                p.x = (Math.random() - 0.5) * this.CELEBRATION_WIDTH;
            }

            const c = p.color;
            g.fillColor = new Color(c.r, c.g, c.b, Math.floor(c.a * p.alpha));
            const s = p.size / 2;

            // 旋转的矩形粒子
            const cos = Math.cos(p.rot);
            const sin = Math.sin(p.rot);
            g.moveTo(p.x + (-s * cos - (-s) * sin), p.y + (-s * sin + (-s) * cos));
            g.lineTo(p.x + (s * cos - (-s) * sin), p.y + (s * sin + (-s) * cos));
            g.lineTo(p.x + (s * cos - s * sin), p.y + (s * sin + s * cos));
            g.lineTo(p.x + (-s * cos - s * sin), p.y + (-s * sin + s * cos));
            g.close();
            g.fill();
        }
    },
    onSurvivalRestart: function (): void {
        GameApp.useTime = 0;
        GameApp.passLevel = 0;
        GameApp.foundCowNum = 0;
        GameApp.survivalReviveTime = 1;

        this.destroyMilestoneBar();

        const cdc = this.getOrCreateCountdownController();
        cdc.addTime(60);
        cdc.startCountDown();

        this.reStartGame();
    },
    onSurvivalReturnMenu: function (): void {
        GameApp.isStartGame = false;

        this.stopCountdownRuntime();
        this.destroyMilestoneBar();

        this.setGameUIVisible(false);
        GameApp.uiManager?.open(UIID.MainPanel);
    },
    formatSurvivalTime: function (seconds: number): string {
        return formatClockTime(seconds);
    },
    buildMilestoneBar: function (): void {
        // 销毁旧的进度条
        this.destroyMilestoneBar();

        const canvas = director.getScene()?.getChildByName('Canvas');
        if (!canvas) return;
        const splash = canvas.getChildByName('SpriteSplash');
        if (!splash) return;

        const barRoot = new Node('MilestoneBar');
        barRoot.layer = Layers.Enum.UI_2D;
        splash.addChild(barRoot);
        this.milestoneBarNode = barRoot;

        const totalWidth = 430;
        const segmentGap = 5;
        const segmentCount = 10;
        const segmentWidth = (totalWidth - segmentGap * (segmentCount - 1)) / segmentCount;
        const segmentHeight = 34;
        const infinityGap = 10;
        const infinityWidth = 52;
        const groupWidth = totalWidth + infinityGap + infinityWidth;
        barRoot.addComponent(CcUITransform).setContentSize(groupWidth + 34, 52);
        this.milestoneFillNode = barRoot;
        this.milestoneNodes = [];

        const bgNode = new Node('MilestoneBarBg');
        bgNode.layer = Layers.Enum.UI_2D;
        bgNode.addComponent(CcUITransform).setContentSize(groupWidth + 24, 46);
        barRoot.addChild(bgNode);
        bgNode.setSiblingIndex(0);
        const bgGraphics = bgNode.addComponent(Graphics);
        bgGraphics.fillColor = new Color(255, 255, 255, 215);
        bgGraphics.roundRect(-(groupWidth + 24) / 2, -23, groupWidth + 24, 46, 16);
        bgGraphics.fill();
        bgGraphics.strokeColor = new Color(90, 170, 245, 235);
        bgGraphics.lineWidth = 3;
        bgGraphics.roundRect(-(groupWidth + 24) / 2 + 1.5, -21.5, groupWidth + 21, 43, 15);
        bgGraphics.stroke();

        for (let i = 0; i < segmentCount; i++) {
            const step = i + 1;
            const segmentNode = new Node('MS_' + step);
            segmentNode.layer = Layers.Enum.UI_2D;
            segmentNode.addComponent(CcUITransform).setContentSize(segmentWidth, segmentHeight);
            segmentNode.addComponent(Graphics);
            barRoot.addChild(segmentNode);
            segmentNode.setSiblingIndex(i + 1);
            segmentNode.setPosition(-groupWidth / 2 + segmentWidth / 2 + i * (segmentWidth + segmentGap), 0, 0);

            const labelNode = new Node('Label');
            labelNode.layer = Layers.Enum.UI_2D;
            labelNode.addComponent(CcUITransform).setContentSize(segmentWidth, segmentHeight);
            segmentNode.addChild(labelNode);
            const lbl = labelNode.addComponent(Label);
            lbl.string = step.toString();
            lbl.fontSize = step === 10 ? 15 : 17;
            lbl.lineHeight = 24;
            lbl.isBold = true;
            lbl.horizontalAlign = Label.HorizontalAlign.CENTER;
            lbl.verticalAlign = Label.VerticalAlign.CENTER;

            this.milestoneNodes.push(segmentNode);
        }

        const infinityNode = new Node('MS_INFINITY');
        infinityNode.layer = Layers.Enum.UI_2D;
        infinityNode.addComponent(CcUITransform).setContentSize(infinityWidth, segmentHeight);
        barRoot.addChild(infinityNode);
        infinityNode.setSiblingIndex(segmentCount + 1);
        infinityNode.setPosition(-groupWidth / 2 + totalWidth + infinityGap + infinityWidth / 2, 0, 0);
        this.milestoneInfinityNode = infinityNode;

        infinityNode.addComponent(Graphics);

        const infinityLabelNode = new Node('Label');
        infinityLabelNode.layer = Layers.Enum.UI_2D;
        infinityLabelNode.addComponent(CcUITransform).setContentSize(infinityWidth, segmentHeight);
        infinityNode.addChild(infinityLabelNode);
        const infinityLabel = infinityLabelNode.addComponent(Label);
        infinityLabel.string = '∞';
        infinityLabel.fontSize = 28;
        infinityLabel.lineHeight = 34;
        infinityLabel.isBold = true;
        infinityLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        infinityLabel.verticalAlign = Label.VerticalAlign.CENTER;
        infinityLabel.color = new Color(255, 255, 255, 255);

        this.syncSurvivalMilestoneBarPosition?.();
        this.renderMilestoneFill();
    },
    destroyMilestoneBar: function (): void {
        const oldMilestone = this.milestoneBarNode;
        if (oldMilestone && oldMilestone.isValid) {
            oldMilestone.destroy();
        }
        this.milestoneBarNode = null;

        const canvas = director.getScene()?.getChildByName('Canvas');
        const splash = canvas?.getChildByName('SpriteSplash');
        const strayMilestone = splash?.getChildByName('MilestoneBar');
        if (strayMilestone && strayMilestone !== oldMilestone && strayMilestone.isValid) {
            strayMilestone.destroy();
        }

        this.milestoneNodes = [];
        this.milestoneFillNode = null;
        this.milestoneInfinityNode = null;
    },
    renderMilestoneFill: function (): void {
        if (!this.milestoneFillNode) return;
        const completed = Math.max(0, Math.min(10, Math.floor(GameApp.passLevel || 0)));
        const activeCount = completed < 10 ? completed + 1 : 10;
        const activeBlue = new Color(55, 142, 245, 255);
        const activeStroke = new Color(202, 232, 255, 255);
        const idleFill = new Color(220, 230, 244, 245);
        const idleStroke = new Color(170, 190, 215, 235);
        const currentStroke = new Color(255, 222, 64, 255);

        for (let i = 0; i < this.milestoneNodes.length; i++) {
            const segmentNode = this.milestoneNodes[i];
            if (!segmentNode || !segmentNode.isValid) continue;
            const transform = segmentNode.getComponent(CcUITransform);
            const width = transform?.contentSize.width || 34;
            const height = transform?.contentSize.height || 28;
            const isActive = i < activeCount;
            const isCurrent = i === completed && completed < 10;
            const g = segmentNode.getComponent(Graphics);
            if (!g) continue;
            g.clear();
            g.fillColor = isActive ? activeBlue : idleFill;
            g.roundRect(-width / 2, -height / 2, width, height, 11);
            g.fill();
            g.strokeColor = isCurrent ? currentStroke : (isActive ? activeStroke : idleStroke);
            g.lineWidth = isCurrent ? 3.5 : 2.5;
            g.roundRect(-width / 2 + 1.25, -height / 2 + 1.25, width - 2.5, height - 2.5, 10);
            g.stroke();

            const label = segmentNode.getChildByName('Label')?.getComponent(Label);
            if (label) {
                label.color = isActive ? new Color(255, 255, 255, 255) : new Color(80, 98, 126, 255);
            }
        }

        const infinityNode = this.milestoneInfinityNode as Node | null;
        if (infinityNode?.isValid) {
            const transform = infinityNode.getComponent(CcUITransform);
            const width = transform?.contentSize.width || 52;
            const height = transform?.contentSize.height || 34;
            const isInfinityActive = GameApp.passLevel >= 10;
            const isInfinityCurrent = GameApp.passLevel >= 10;
            const g = infinityNode.getComponent(Graphics);
            if (g) {
                g.clear();
                g.fillColor = isInfinityActive ? activeBlue : idleFill;
                g.roundRect(-width / 2, -height / 2, width, height, 11);
                g.fill();
                g.strokeColor = isInfinityCurrent ? currentStroke : (isInfinityActive ? activeStroke : idleStroke);
                g.lineWidth = isInfinityCurrent ? 3.5 : 2.5;
                g.roundRect(-width / 2 + 1.25, -height / 2 + 1.25, width - 2.5, height - 2.5, 10);
                g.stroke();
            }
            const label = infinityNode.getChildByName('Label')?.getComponent(Label);
            if (label) {
                label.color = isInfinityActive ? new Color(255, 255, 255, 255) : new Color(80, 98, 126, 255);
            }
        }
    },
    syncSurvivalMilestoneBarPosition: function (): void {
        const bar = this.milestoneBarNode;
        if (!bar || !bar.isValid) return;

        this.setupRuleBoxNodes?.();
        const ruleNode = this.ruleBoxNode;
        const ruleTransform = ruleNode?.getComponent(CcUITransform);
        const barParentTransform = bar.parent?.getComponent(CcUITransform);
        if (ruleNode?.isValid && ruleTransform && barParentTransform) {
            const ruleTopLocalY = ruleTransform.contentSize.height * (1 - ruleTransform.anchorPoint.y);
            const ruleTopWorld = ruleTransform.convertToWorldSpaceAR(v3(0, ruleTopLocalY, 0));
            const ruleTopInBarParent = barParentTransform.convertToNodeSpaceAR(ruleTopWorld);
            bar.setPosition(0, ruleTopInBarParent.y + 34, 0);
            return;
        }

        bar.setPosition(0, 470, 0);
    },
    updateMilestoneBar: function (): void {
        this.syncSurvivalMilestoneBarPosition?.();
        this.renderMilestoneFill();

        for (let i = 0; i < this.milestoneNodes.length; i++) {
            const ms = i + 1;
            const msNode = this.milestoneNodes[i];
            if (!msNode) continue;

            // 刚到达里程碑时播放弹跳动画
            if (GameApp.passLevel === ms) {
                msNode.setScale(v3(1, 1, 1));
                tween(msNode)
                    .to(0.15, { scale: v3(1.4, 1.4, 1) }, { easing: 'backOut' })
                    .to(0.15, { scale: v3(1, 1, 1) }, { easing: 'quadIn' })
                    .start();
            }
        }
    },
    clearSurvivalBoardRuntimeState: function (): void {
        const total = Math.max(0, Math.floor((this.gridSize || 0) * (this.gridSize || 0)));
        this.clickedSquares = new Array(total).fill(false);
        this.revealedSquares = new Array(total).fill(false);
        this.xAnimationProgress = new Array(total).fill(0);
        this.squareScales = new Array(total).fill(1);
        this.markAnimationTokens = new Array(total).fill(0);
        this.balloonCellBasePositions = new Array(total).fill(null);
        this.balloonCellBaseSizes = new Array(total).fill(0);
        this.balloonCowBasePositions = new Array(total).fill(null);
        this.balloonCowBaseSizes = new Array(total).fill(0);
        this.activeMarkAnimations = 0;
        this.renderDirty = false;

        const hideNode = (node: Node | null | undefined): void => {
            if (node && node.isValid) node.active = false;
        };
        this.balloonCellNodes.forEach((node: Node | null) => {
            hideNode(node);
            hideNode(node?.getChildByName('BalloonXOverlay'));
            hideNode(node?.getChildByName('JellyEffectOverlay'));
        });
        this.balloonPopNodes.forEach((node: Node | null) => hideNode(node));
        this.coordinateNodes.forEach((node: Node | null) => hideNode(node));
        this.cowNodes.forEach((node: Node | null) => {
            if (node && node.isValid) node.destroy();
        });
        this.cowNodes = [];

        if (this.graphics) this.graphics.clear();
        this.staticBoardGraphics?.clear();
        this.dynamicBoardGraphics?.clear();
        this.staticBoardSignature = '';
        this.staticBoardDirty = true;
    },
    loadSurvivalLevel: function (onDone?: () => void): void {
        const loadSessionId = ++this.levelLoadSessionId;
        PerfDebug.begin('load survival level', { passLevel: GameApp.passLevel, launchStageOverride: this.launchStageOverride });
        this.clearSurvivalBoardRuntimeState?.();
        this.cowsFound = 0;
        this.mistakeCount = 0;
        this.isGameOver = false;
        this.cowNodes.forEach(node => { if (node) node.destroy(); });
        this.cowNodes = [];
        this.gridColors = [];
        this.cowPositions = [];
        this.totalCows = 0;
        if (this.graphics) this.graphics.clear();

        const path = this.launchStageOverride > 0
            ? getSurvivalStagePath(this.launchStageOverride)
            : getSurvivalLevelPath(GameApp.passLevel);
        if (this.launchStageOverride > 0) this.launchStageOverride = 0;

        AssetService.loadJson(path, asset => {
            if (this.levelLoadSessionId !== loadSessionId || GameApp.gameMode !== GameMode.survival) {
                return;
            }
            if (asset && asset.json) {
                const data = asset.json as { n?: number; c?: number[]; cows?: number[] };
                if (isValidLevelConfig(data)) {
                    this.applyLevelConfig(data);
                    this.finishInitGrid();
                    PerfDebug.end('load survival level', { source: 'json', path, gridSize: this.gridSize, totalCows: this.totalCows });
                    onDone?.();
                    return;
                }
            }
            const message = `[SurvivalLevel] load failed: ${path}`;
            console.error(message);
            PerfDebug.end('load survival level', { source: 'error', path });
            throw new Error(message);
        });
    },
    getOrCreateCountdownController: function (): CountdownController {
        let cdc = GameApp.countDownControl as CountdownController | null;
        if (!cdc) {
            const canvas = director.getScene()!.getChildByName('Canvas')!;
            let cdcNode = canvas.getChildByName('CountdownController');
            if (!cdcNode) {
                cdcNode = new Node('CountdownController');
                cdcNode.layer = Layers.Enum.UI_2D;
                canvas.addChild(cdcNode);
            }
            cdc = cdcNode.getComponent(CountdownController) || cdcNode.addComponent(CountdownController);
            GameApp.countDownControl = cdc;
        }
        return cdc;
    },
    startDailyChallengeMode: function (): void {
        PerfDebug.begin('start daily challenge mode');
        // Switch to level BGM for daily_challenge mode
        SfxManager.instance.playLevelBgm();

        GameApp.gameMode = GameMode.daily_challenge;
        GameApp.isGuideSettlement = false;
        this.resetGuideRuntimeState?.(false);
        const countdownSessionId = this.beginCountdownRuntime();
        this.isGameOver = false;
        GameApp.dailyChallengeIsWin = false;
        GameApp.dailyChallengeReviveTime = 1;
        GameApp.useTime = 0;
        GameApp.foundCowNum = 0;
        if (this.resultNode) this.resultNode.active = false;

        this.setDailyChallengeSplashUI(true);
        this.loadCowAnimationFrames();
        this.setupCountdownLabel();
        this.syncProgressLabels();
        this.refreshTimedChallengeHud?.();

        this.loadBalloonAssets(() => {
            this.loadDailyChallengeLevel(() => {
                this.renderGrid();
                PerfDebug.end('start daily challenge mode', { gridSize: this.gridSize, totalCows: this.totalCows });
                AssetService.logCacheStats('start daily challenge mode end');
                PerfDebug.flushCounters('start daily challenge mode end');
                PerfDebug.startFpsProbe('gameplay daily_challenge', 20000);
                this.refreshTimedChallengeHud?.();
                this.warmupCowAnimationAfterFirstFrame?.();
                this.scheduleOnce(() => {
                    if (!this.isCountdownRuntimeActive(countdownSessionId, GameMode.daily_challenge)) return;
                    const cdc = this.getOrCreateCountdownController();
                    cdc.initAndStart(DAILY_CHALLENGE_COUNTDOWN_SECONDS, this.countdownLabel, () => {
                        if (!this.isCountdownRuntimeActive(countdownSessionId, GameMode.daily_challenge)) return;
                        this.dailyChallengeOver();
                    });
                    this.unschedule(this.updateCountdownWarning);
                    this.schedule(this.updateCountdownWarning, 0.1);
                }, 1);
            });
        });
    },
    setDailyChallengeSplashUI: function (isDailyChallenge: boolean): void {
        const canvas = director.getScene()?.getChildByName('Canvas');
        if (!canvas) return;
        const splash = canvas.getChildByName('SpriteSplash');
        if (!splash) return;

        const dailyChallengeNodeNames = new Set([
            ...SHARED_GAMEPLAY_SPLASH_NODE_NAMES,
            'CountdownLabel',
        ]);
        for (let i = 0; i < splash.children.length; i++) {
            const child = splash.children[i];
            if (this.isGlobalHudNode(child)) {
                child.active = false;
                continue;
            }
            child.active = !isDailyChallenge || dailyChallengeNodeNames.has(child.name) || child === this.ruleBoxNode;
        }

        const jumpLabel = canvas.getChildByName('JumpLabel');
        if (jumpLabel) jumpLabel.active = !isDailyChallenge;

        if (this.debugPanelNode) {
            this.debugPanelNode.active = false;
        }

        if (!isDailyChallenge) {
            this.stopCountdownRuntime();
            const countdownNode = splash.getChildByName('CountdownLabel');
            if (countdownNode) countdownNode.destroy();
            this.countdownLabel = null;
        }
    },
    loadDailyChallengeLevel: function (onDone?: () => void): void {
        const loadSessionId = ++this.levelLoadSessionId;
        PerfDebug.begin('load daily challenge level', { date: GameApp.user.getTodayDateString(), launchStageOverride: this.launchStageOverride });
        this.cowsFound = 0;
        this.mistakeCount = 0;
        this.isGameOver = false;
        this.cowNodes.forEach(node => { if (node) node.destroy(); });
        this.cowNodes = [];
        this.gridColors = [];
        this.cowPositions = [];
        this.totalCows = 0;
        if (this.graphics) this.graphics.clear();

        const path = this.launchStageOverride > 0
            ? getDailyChallengeStagePath(this.launchStageOverride)
            : getDailyChallengeLevelPath(GameApp.user.getTodayDateString());

        AssetService.loadJson(path, asset => {
            if (this.levelLoadSessionId !== loadSessionId || GameApp.gameMode !== GameMode.daily_challenge) {
                return;
            }
            if (asset && asset.json) {
                const data = asset.json as { n?: number; c?: number[]; cows?: number[] };
                if (isValidLevelConfig(data)) {
                    this.applyLevelConfig(data);
                    this.finishInitGrid();
                    PerfDebug.end('load daily challenge level', { source: 'json', path, gridSize: this.gridSize, totalCows: this.totalCows });
                    onDone?.();
                    return;
                }
            }
            const message = `[DailyChallengeLevel] load failed: ${path}`;
            console.error(message);
            PerfDebug.end('load daily challenge level', { source: 'error', path });
            throw new Error(message);
        });
    },
    dailyChallengeOver: function (): void {
        this.isGameOver = true;
        this.unschedule(this.updateCountdownWarning);

        const cdc = this.getOrCreateCountdownController();
        cdc.endCountDown();

        if (this.countdownLabel?.node && this.countdownLabel.node.isValid) {
            this.countdownLabel.node.active = true;
            if (!GameApp.dailyChallengeIsWin) {
                this.countdownLabel.color = new Color(255, 50, 50, 255);
                this.countdownLabel.string = this.formatCountdownSeconds(0);
            }
        }

        // stamina reward
        const staminaReward = GameApp.dailyChallengeIsWin ? 30 : 0;
        if (staminaReward > 0) {
            GameApp.tiliManager?.addTili(staminaReward);
        }

        // coin reward for win
        if (GameApp.dailyChallengeIsWin) {
            const user = GameApp.user;
            user.coin += 4;
            user.checkAndUpdateDailyChallengeStreak();
        }

        GameApp.uiManager?.open(UIID.DailyChallengeOverPanel);
    },
    onDailyChallengeRestart: function (): void {
        GameApp.useTime = 0;
        GameApp.foundCowNum = 0;
        GameApp.dailyChallengeReviveTime = 1;
        GameApp.dailyChallengeIsWin = false;
        this.stopCountdownRuntime();
        this.startDailyChallengeMode();
    },
    onDailyChallengeReturnMenu: function (): void {
        GameApp.isStartGame = false;
        this.stopCountdownRuntime();
        this.setDailyChallengeSplashUI(false);
        this.setGameUIVisible(false);
        GameApp.uiManager?.open(UIID.MainPanel);
    },
    });
}
