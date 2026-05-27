import {
    _decorator,
    Component,
    Node,
    Label,
    Graphics,
    Color,
    Sprite,
    SpriteFrame,
    UITransform as CcUITransform,
    tween,
    Tween,
    v3,
    Layers,
    EventTouch,
} from 'cc';
import { GameApp } from './Core/GameApp';
import { GameMode, UIID } from './Core/Enum';
import SfxManager from './Core/SfxManager';
import AssetService from './Core/AssetService';
import RewardService from './Core/RewardService';
import { installWinPanelCelebration } from './WinPanelCelebration';
import { GlobalHudMode } from './GlobalHud';
import { getAdaptiveLayout, scaleLayout, type AdaptiveLayout } from './Utils/LayoutService';

const { ccclass } = _decorator;

type CelebrationPiece = {
    kind: 'confetti' | 'coin';
    x: number;
    y: number;
    vx: number;
    vy: number;
    rot: number;
    vr: number;
    size: number;
    color: Color;
    delay: number;
    life: number;
    side: number;
    phase: number;
    launch: number;
    widthRatio: number;
    heightRatio: number;
};

type CelebrationSpark = {
    x: number;
    y: number;
    delay: number;
    size: number;
};

type DrawGridSettlementHost = {
    node?: Node;
    coinLabel?: Label;
    cowMenuDanceFrames?: SpriteFrame[];
    reStartGame?: () => void;
    setGameUIVisible?: (visible: boolean) => void;
};

type GlobalHudHost = {
    refreshCoin?: (animated?: boolean) => void;
    playCoinBounce?: () => void;
    getCoinNode?: () => Node | null;
    getCoinSprite?: () => Sprite | null;
    setStaminaVisible?: (visible: boolean) => void;
    setMode?: (mode: GlobalHudMode) => void;
};

@ccclass('WinPanel')
export class WinPanel extends Component {
    private readonly CELEBRATION_WIDTH: number = 750;
    private readonly CELEBRATION_HEIGHT: number = 1334;
    private readonly CELEBRATION_PARTICLE_LOOP_GAP: number = 1.15;
    private readonly CELEBRATION_SPARK_LOOP_DURATION: number = 1.65;
    private readonly CELEBRATION_MENU_IDLE_FRAME_INTERVAL: number = 0.16;
    private readonly REWARD_FLY_COIN_COUNT: number = 12;
    private readonly REWARD_FLY_START_DELAY: number = 0.08;
    private readonly REWARD_FLY_INTERVAL: number = 0.06;
    private readonly REWARD_FLY_DURATION: number = 0.72;
    private readonly SETTLEMENT_REWARD_COIN_SCALE: number = 0.5;
    private readonly BONUS_BUTTON_COIN_SIZE: number = 64;
    private readonly INTERSTITIAL_FIRST_COMPLETED_LEVEL: number = 4;
    private readonly INTERSTITIAL_LEVEL_INTERVAL: number = 2;
    private readonly INTERSTITIAL_DAILY_LIMIT: number = 8;
    private readonly INTERSTITIAL_MIN_GAP_MS: number = 30000;

    private celebrationRoot: Node | null = null;
    private celebrationOverlayGraphics: Graphics | null = null;
    private celebrationGraphics: Graphics | null = null;
    private celebrationCowNode: Node | null = null;
    private celebrationCoinLabel: Label | null = null;
    private celebrationCoinSpriteFrame: SpriteFrame | null = null;
    private celebrationProgress: number = 0;
    private celebrationPieces: CelebrationPiece[] = [];
    private celebrationSparks: CelebrationSpark[] = [];
    private celebrationVersion: number = 0;
    private isGuideSettlementActive: boolean = false;
    private celebrationMenuIdleFrames: SpriteFrame[] = [];
    private celebrationMenuIdleFrameIndex: number = 0;
    private celebrationMenuIdleLoading: boolean = false;
    private celebrationMenuIdleCallbacks: Array<(frames: SpriteFrame[]) => void> = [];
    private bonusAdPlaying: boolean = false;

    onLoad(): void {
        this.setUILayer(this.node);
        const transform = this.node.getComponent(CcUITransform) || this.node.addComponent(CcUITransform);
        const size = this.getSettlementSize(this.getSettlementLayout());
        transform.setContentSize(size.width, size.height);
        this.loadCoinSpriteFrame(frame => {
            this.celebrationCoinSpriteFrame = frame;
            if (!frame) {
                this.loadEffectSpriteFrame('effects/celebration-coin', effectFrame => this.celebrationCoinSpriteFrame = effectFrame);
            }
        });
    }

    onEnable(): void {
        this.globalHud?.setMode?.(GlobalHudMode.LevelWin);
        this.showVictorySettlement(typeof GameApp.winRewardCoins === 'number' ? GameApp.winRewardCoins : 4);
    }

    onDisable(): void {
        this.hideVictorySettlement();
    }

    private get drawGrid(): DrawGridSettlementHost | null {
        return (GameApp.drawGrid || null) as DrawGridSettlementHost | null;
    }

    private get globalHud(): GlobalHudHost | null {
        return (GameApp.globalHud || null) as GlobalHudHost | null;
    }

    private showVictorySettlement(rewardCoins: number): void {
        this.hideVictorySettlement();
        const version = ++this.celebrationVersion;
        console.log('[WinPanel] show victory settlement');
        const panelTransform = this.node.getComponent(CcUITransform) || this.node.addComponent(CcUITransform);
        const layout = this.getSettlementLayout();
        const settlementSize = this.getSettlementSize(layout);
        panelTransform.setContentSize(settlementSize.width, settlementSize.height);

        const root = new Node('VictoryCelebration');
        this.setUILayer(root);
        root.addComponent(CcUITransform).setContentSize(settlementSize.width, settlementSize.height);
        root.parent = this.node;
        root.setPosition(0, 0);
        root.setSiblingIndex(430);
        this.celebrationRoot = root;
        this.blockNodeTouch(root);
        const isGuideSettlement = GameApp.isGuideSettlement === true;
        this.isGuideSettlementActive = isGuideSettlement;

        const overlayNode = new Node('VictoryCelebrationOverlay');
        this.setUILayer(overlayNode);
        overlayNode.parent = root;
        overlayNode.addComponent(CcUITransform).setContentSize(settlementSize.width, settlementSize.height);
        this.celebrationOverlayGraphics = overlayNode.addComponent(Graphics);

        const graphicsNode = new Node('VictoryCelebrationGraphics');
        this.setUILayer(graphicsNode);
        graphicsNode.parent = root;
        graphicsNode.addComponent(CcUITransform).setContentSize(settlementSize.width, settlementSize.height);
        this.celebrationGraphics = graphicsNode.addComponent(Graphics);

        const titleNode = this.createCelebrationLabel('最后一只没藏住', 44, new Color(255, 255, 255, 255));
        titleNode.parent = root;
        const titleY = Math.min(scaleLayout(472, layout), layout.topY - scaleLayout(156, layout));
        titleNode.setPosition(0, titleY);
        titleNode.setScale(v3(0, 0, 1));

        const cowNode = new Node('VictoryCow');
        this.setUILayer(cowNode);
        cowNode.parent = root;
        const cowTransform = cowNode.addComponent(CcUITransform);
        const cowVisualNode = new Node('VictoryCowVisual');
        this.setUILayer(cowVisualNode);
        cowVisualNode.parent = cowNode;
        const cowVisualTransform = cowVisualNode.addComponent(CcUITransform);
        const cowSprite = cowVisualNode.addComponent(Sprite);
        const cowFrame = this.getCelebrationMenuIdleFrame();
        cowSprite.spriteFrame = cowFrame;
        cowSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        cowSprite.trim = false;
        const fittedCowSize = this.getPixelPerfectFitSize(cowFrame, 440, 460);
        cowTransform.setContentSize(fittedCowSize.width, fittedCowSize.height);
        cowVisualTransform.setContentSize(fittedCowSize.width, fittedCowSize.height);
        cowVisualNode.setPosition(0, 0, 0);
        const cowY = titleY - scaleLayout(300, layout);
        cowNode.setPosition(0, cowY);
        cowNode.setScale(v3(0, 0, 1));
        this.celebrationCowNode = cowVisualNode;
        this.ensureCelebrationMenuIdleFrames(frames => {
            if (version !== this.celebrationVersion || this.celebrationCowNode !== cowVisualNode || frames.length === 0) return;
            const sprite = cowVisualNode.getComponent(Sprite);
            if (!sprite) return;
            sprite.spriteFrame = frames[0];
            const fittedSize = this.getPixelPerfectFitSize(frames[0], 440, 460);
            cowTransform.setContentSize(fittedSize.width, fittedSize.height);
            cowVisualTransform.setContentSize(fittedSize.width, fittedSize.height);
            this.startCelebrationMenuIdleLoop(cowVisualNode, version);
        });

        let rewardGroup: Node | null = null;
        let rewardCoinNode: Node | null = null;
        if (!isGuideSettlement) {
            rewardGroup = new Node('VictoryRewardGroup');
            this.setUILayer(rewardGroup);
            rewardGroup.parent = root;
            rewardGroup.addComponent(CcUITransform).setContentSize(150, 70);
            rewardGroup.setPosition(0, cowY - scaleLayout(264, layout));
            rewardGroup.setScale(v3(0, 0, 1));

            const hudCoinSprite = this.getHudCoinSprite();
            const hudCoinFrame = hudCoinSprite?.spriteFrame || this.celebrationCoinSpriteFrame;
            const hudCoinSize = this.getHudCoinVisualSize(hudCoinSprite);
            if (hudCoinFrame) {
                rewardCoinNode = this.createCelebrationSprite('VictoryRewardCoin', hudCoinFrame, hudCoinSize.width, hudCoinSize.height);
                rewardCoinNode.parent = rewardGroup;
                rewardCoinNode.setScale(v3(this.SETTLEMENT_REWARD_COIN_SCALE, this.SETTLEMENT_REWARD_COIN_SCALE, 1));
                rewardCoinNode.setPosition(-30, 0);
            } else {
                rewardCoinNode = this.createFallbackRewardCoinNode();
                rewardCoinNode.parent = rewardGroup;
                rewardCoinNode.setScale(v3(this.SETTLEMENT_REWARD_COIN_SCALE, this.SETTLEMENT_REWARD_COIN_SCALE, 1));
                rewardCoinNode.setPosition(-30, 0);
                this.loadCoinSpriteFrame(frame => {
                    if (!frame || !rewardCoinNode?.isValid) return;
                    const sprite = rewardCoinNode.getComponent(Sprite) || rewardCoinNode.addComponent(Sprite);
                    const graphics = rewardCoinNode.getComponent(Graphics);
                    if (graphics) {
                        graphics.clear();
                        graphics.enabled = false;
                    }
                    sprite.spriteFrame = frame;
                    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                    sprite.trim = false;
                    const fitted = this.getHudCoinVisualSize(sprite);
                    rewardCoinNode.getComponent(CcUITransform)?.setContentSize(fitted.width, fitted.height);
                });
            }
            const coinNode = this.createCelebrationLabel(`+${rewardCoins}`, 38, new Color(255, 238, 92, 255));
            coinNode.parent = rewardGroup;
            coinNode.setPosition(24, 0);
            this.celebrationCoinLabel = coinNode.getComponent(Label);
        }

        const sideButtonWidth = 190;
        const sideButtonHeight = 64;

        let homeNode: Node | null = null;
        let bonusNode: Node | null = null;
        const sideButtonX = scaleLayout(112, layout);
        const sideButtonY = layout.bottomY + scaleLayout(471, layout);
        if (!isGuideSettlement) {
            homeNode = this.createCelebrationButton('VictoryHomeButton', '主页', sideButtonWidth, sideButtonHeight, new Color(39, 139, 230, 255));
            homeNode.parent = root;
            homeNode.setPosition(-sideButtonX, sideButtonY);
            homeNode.setScale(v3(0, 0, 1));
            homeNode.on(Node.EventType.TOUCH_END, this.onHomeClick, this);
            this.blockNodeTouch(homeNode);

            bonusNode = this.createCelebrationButton('VictoryBonusButton', '五倍领取', sideButtonWidth, sideButtonHeight, new Color(39, 139, 230, 255), 22);
            bonusNode.parent = root;
            bonusNode.setPosition(sideButtonX, sideButtonY);
            bonusNode.setScale(v3(0, 0, 1));
            this.decorateFiveBonusButton(bonusNode);
            let bonusClaimed = false;
            bonusNode.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                event.propagationStopped = true;
                if (bonusClaimed) return;
                SfxManager.instance.playUiClick();
                bonusClaimed = true;
                this.bonusAdPlaying = true;
                this.setBonusButtonText(bonusNode as Node, '广告中...');
                RewardService.requestReward((rewarded) => {
                    this.bonusAdPlaying = false;
                    if (version !== this.celebrationVersion || !bonusNode?.isValid) return;
                    if (!rewarded) {
                        bonusClaimed = false;
                        this.setBonusButtonText(bonusNode as Node, '五倍领取');
                        return;
                    }
                    if (rewardGroup) {
                        this.playFiveBonusClaim(rewardCoins, rewardGroup, rewardCoinNode, bonusNode as Node, version);
                    }
                });
            }, this);
            this.blockNodeTouch(bonusNode);
        }

        const shouldRequestInterstitial = !isGuideSettlement && this.shouldShowLevelInterstitial(version);
        const nextNode = this.createCelebrationButton('VictoryNextButton', '下一关', 232, 78, new Color(255, 196, 0, 255), 34, true);
        nextNode.parent = root;
        const nextGraphics = nextNode.getComponent(Graphics);
        if (nextGraphics) {
            nextGraphics.clear();
            this.drawCelebrationButtonBlock(nextGraphics, 0, 0, 232, 78, new Color(255, 155, 0, 255));
        }
        const nextButtonY = layout.bottomY + scaleLayout(isGuideSettlement ? 441 : 361, layout);
        nextNode.setPosition(0, nextButtonY);
        nextNode.setScale(v3(0, 0, 1));
        nextNode.on(Node.EventType.TOUCH_START, this.stopTouchPropagation, this);
        nextNode.on(Node.EventType.TOUCH_END, this.onNextClick, this);
        this.blockNodeTouch(nextNode);

        this.prepareCelebrationParticles();
        if (isGuideSettlement) {
            this.celebrationPieces = this.celebrationPieces.filter(piece => piece.kind !== 'coin');
        }
        this.celebrationProgress = 0;
        if (!isGuideSettlement) {
            this.liftCoinHudForCelebration();
        }
        graphicsNode.setSiblingIndex(1);
        this.renderVictoryStaticLayer();
        this.renderVictoryCelebration(0);

        tween(titleNode)
            .delay(0.32)
            .to(0.18, { scale: v3(1.1, 1.1, 1) }, { easing: 'backOut' })
            .to(0.08, { scale: v3(1, 1, 1) }, { easing: 'quadOut' })
            .start();
        tween(cowNode)
            .delay(0.12)
            .to(0.2, { scale: v3(1.08, 1.08, 1), angle: 0 }, { easing: 'backOut' })
            .to(0.1, { scale: v3(1, 1, 1), angle: 0 }, { easing: 'quadOut' })
            .start();
        if (rewardGroup) {
            tween(rewardGroup)
                .delay(0.28)
                .to(0.18, { scale: v3(1.22, 1.22, 1) }, { easing: 'backOut' })
                .to(0.1, { scale: v3(0.96, 0.96, 1) }, { easing: 'quadIn' })
                .to(0.1, { scale: v3(1, 1, 1) }, { easing: 'quadOut' })
                .start();
        }
        if (homeNode) this.playSettlementButtonIntro(homeNode, 0.52, -sideButtonX, sideButtonY);
        if (bonusNode) this.playSettlementButtonIntro(bonusNode, 0.58, sideButtonX, sideButtonY);
        this.playSettlementButtonIntro(nextNode, shouldRequestInterstitial ? 0.48 : (isGuideSettlement ? 0.54 : 0.74), 0, nextButtonY);
        tween(nextNode)
            .delay(1.04)
            .repeatForever(
                tween(nextNode)
                    .to(0.68, { scale: v3(1.12, 1.12, 1) }, { easing: 'quadInOut' })
                    .to(0.68, { scale: v3(1, 1, 1) }, { easing: 'quadInOut' })
            )
            .start();
        if (!isGuideSettlement) {
            this.playRewardFlyAnimation(
                rewardCoinNode,
                version,
                this.REWARD_FLY_COIN_COUNT,
                this.REWARD_FLY_START_DELAY,
                this.REWARD_FLY_INTERVAL,
                this.REWARD_FLY_DURATION
            );
            if (shouldRequestInterstitial) {
                this.scheduleOnce(() => this.tryShowLevelInterstitial(version), 0);
            }
        }

        const fireworksState = { time: 0 };
        tween(fireworksState)
            .to(3600, { time: 3600 }, {
                easing: 'linear',
                onUpdate: () => {
                    if (version !== this.celebrationVersion) return;
                    this.celebrationProgress = fireworksState.time;
                    this.renderVictoryCelebration(this.celebrationProgress);
                }
            })
            .start();
    }

    private hideVictorySettlement(): void {
        this.celebrationVersion++;
        this.restoreCoinHudAfterCelebration();
        this.unschedule(this.advanceCelebrationMenuIdleFrame);
        this.unscheduleAllCallbacks();
        Tween.stopAllByTarget(this.node);
        if (this.celebrationRoot) {
            this.celebrationRoot.destroy();
            this.celebrationRoot = null;
        }
        this.celebrationOverlayGraphics = null;
        this.celebrationGraphics = null;
        this.celebrationCowNode = null;
        this.celebrationCoinLabel = null;
        this.celebrationPieces = [];
        this.celebrationSparks = [];
        this.celebrationMenuIdleFrameIndex = 0;
        this.isGuideSettlementActive = false;
        this.bonusAdPlaying = false;
    }

    private tryShowLevelInterstitial(version: number): void {
        if (!this.shouldShowLevelInterstitial(version)) return;
        RewardService.requestInterstitial({
            scene: 'level_win_gap',
            onShown: () => this.recordLevelInterstitialShown(version),
        });
    }

    private shouldShowLevelInterstitial(version: number): boolean {
        if (version !== this.celebrationVersion || !this.node?.isValid) return false;
        if (GameApp.gameMode !== GameMode.level || GameApp.isGuideSettlement === true || this.isGuideSettlementActive) return false;
        if (this.bonusAdPlaying) return false;

        const completedLevel = Math.max(0, Math.floor(GameApp.passLevel || 0));
        if (completedLevel < this.INTERSTITIAL_FIRST_COMPLETED_LEVEL) return false;
        if (!RewardService.isInterstitialAdAvailable()) return false;

        const user = GameApp.user;
        const today = user.getTodayDateString();
        if (user.lastInterstitialAdDate !== today) {
            user.lastInterstitialAdDate = today;
            user.interstitialAdShownToday = 0;
        }
        if (user.interstitialAdShownToday >= this.INTERSTITIAL_DAILY_LIMIT) return false;
        const lastShownLevel = Math.max(0, Math.floor(user.lastInterstitialAdLevel || 0));
        const levelsSinceLastAd = lastShownLevel > 0 ? completedLevel - lastShownLevel : completedLevel;
        const reachedLevelInterval = levelsSinceLastAd >= this.INTERSTITIAL_LEVEL_INTERVAL;
        const reachedTimeInterval = user.lastInterstitialAdTimestamp <= 0
            || Date.now() - user.lastInterstitialAdTimestamp >= this.INTERSTITIAL_MIN_GAP_MS;
        if (!reachedLevelInterval && !reachedTimeInterval) return false;

        return true;
    }

    private recordLevelInterstitialShown(version: number): void {
        if (version !== this.celebrationVersion) return;
        const user = GameApp.user;
        const today = user.getTodayDateString();
        if (user.lastInterstitialAdDate !== today) {
            user.lastInterstitialAdDate = today;
            user.interstitialAdShownToday = 0;
        }
        user.interstitialAdShownToday = user.interstitialAdShownToday + 1;
        user.lastInterstitialAdTimestamp = Date.now();
        user.lastInterstitialAdLevel = Math.max(0, Math.floor(GameApp.passLevel || 0));
        user.save();
    }

    private onHomeClick(event: EventTouch): void {
        event.propagationStopped = true;
        SfxManager.instance.playUiClick();
        GameApp.isStartGame = false;
        this.drawGrid?.setGameUIVisible?.(false);
        this.closeSelf(() => GameApp.uiManager?.open(UIID.MainPanel));
    }

    private onNextClick(event: EventTouch): void {
        event.propagationStopped = true;
        SfxManager.instance.playUiClick();
        const wasGuideSettlement = GameApp.isGuideSettlement === true || this.isGuideSettlementActive;
        this.closeSelf(() => {
            if (wasGuideSettlement) {
                GameApp.gameMode = GameMode.level;
                GameApp.isStartGame = true;
                GameApp.isGuideSettlement = false;
                GameApp.user.firstGame = 2;
                GameApp.user.level = 1;
                GameApp.passLevel = 0;
                GameApp.user.save();
                this.drawGrid?.setGameUIVisible?.(true);
            }
            this.drawGrid?.reStartGame?.();
        });
    }

    private closeSelf(onClosed?: () => void): void {
        const wasGuideSettlement = GameApp.isGuideSettlement === true;
        this.hideVictorySettlement();
        GameApp.uiManager?.close(UIID.WinPanel, () => {
            if (wasGuideSettlement) {
                GameApp.isGuideSettlement = false;
            }
            onClosed?.();
        });
    }

    private getCelebrationMenuIdleFrames(): SpriteFrame[] {
        const drawGridFrames = this.drawGrid?.cowMenuDanceFrames || [];
        if (drawGridFrames.length > 0) {
            return drawGridFrames;
        }
        return this.celebrationMenuIdleFrames;
    }

    private getCelebrationMenuIdleFrame(): SpriteFrame | null {
        return this.getCelebrationMenuIdleFrames()[0] || null;
    }

    private startCelebrationMenuIdleLoop(node: Node, version: number): void {
        this.unschedule(this.advanceCelebrationMenuIdleFrame);
        const frames = this.getCelebrationMenuIdleFrames();
        if (frames.length <= 1) return;
        const sprite = node.getComponent(Sprite);
        if (!sprite) return;
        if (version !== this.celebrationVersion || this.celebrationCowNode !== node) return;

        this.celebrationMenuIdleFrameIndex = 0;
        sprite.spriteFrame = frames[0];
        this.schedule(this.advanceCelebrationMenuIdleFrame, this.CELEBRATION_MENU_IDLE_FRAME_INTERVAL);
    }

    private advanceCelebrationMenuIdleFrame(): void {
        const node = this.celebrationCowNode;
        if (!node || !node.isValid) {
            this.unschedule(this.advanceCelebrationMenuIdleFrame);
            return;
        }
        const frames = this.getCelebrationMenuIdleFrames();
        const sprite = node.getComponent(Sprite);
        if (!sprite || frames.length <= 1) {
            this.unschedule(this.advanceCelebrationMenuIdleFrame);
            return;
        }

        this.celebrationMenuIdleFrameIndex = (this.celebrationMenuIdleFrameIndex + 1) % frames.length;
        sprite.spriteFrame = frames[this.celebrationMenuIdleFrameIndex];
    }

    private ensureCelebrationMenuIdleFrames(onLoaded: (frames: SpriteFrame[]) => void): void {
        const readyFrames = this.getCelebrationMenuIdleFrames();
        if (readyFrames.length > 0) {
            onLoaded(readyFrames);
            return;
        }

        this.celebrationMenuIdleCallbacks.push(onLoaded);
        if (this.celebrationMenuIdleLoading) {
            return;
        }

        this.celebrationMenuIdleLoading = true;
        const path = 'characters/menu_idle';
        AssetService.loadSpriteFrameDir(path, frames => {
            if (frames.length === 0) {
                console.warn('[WinPanel] Menu idle frames not loaded: ' + path);
            }
            this.finishCelebrationMenuIdleLoad(frames);
        }, 'smooth');
    }

    private finishCelebrationMenuIdleLoad(frames: SpriteFrame[]): void {
        this.celebrationMenuIdleFrames = AssetService.sortSpriteFrames(frames);
        this.celebrationMenuIdleLoading = false;
        const callbacks = this.celebrationMenuIdleCallbacks;
        this.celebrationMenuIdleCallbacks = [];
        callbacks.forEach(callback => callback(this.celebrationMenuIdleFrames));
    }

    private getPixelPerfectFitSize(frame: SpriteFrame | null | undefined, maxWidth: number, maxHeight: number): { width: number; height: number } {
        const rect = frame?.rect;
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            return { width: maxWidth, height: maxHeight };
        }
        const scale = Math.min(maxWidth / rect.width, maxHeight / rect.height);
        return {
            width: Math.max(1, Math.round(rect.width * scale)),
            height: Math.max(1, Math.round(rect.height * scale)),
        };
    }

    private getSettlementLayout(): AdaptiveLayout {
        return getAdaptiveLayout();
    }

    private getSettlementSize(layout: AdaptiveLayout = this.getSettlementLayout()): { width: number; height: number } {
        const parentTransform = this.node.parent?.getComponent(CcUITransform);
        return {
            width: Math.max(this.CELEBRATION_WIDTH, parentTransform?.contentSize.width || layout.width || this.CELEBRATION_WIDTH),
            height: Math.max(this.CELEBRATION_HEIGHT, parentTransform?.contentSize.height || layout.height || this.CELEBRATION_HEIGHT),
        };
    }

    private liftCoinHudForCelebration(): void {
        this.refreshCoinHudLabel();
    }

    private restoreCoinHudAfterCelebration(): void {
        this.refreshCoinHudLabel();
    }

    private getHudCoinSprite(): Sprite | null {
        const globalCoinSprite = this.globalHud?.getCoinSprite?.();
        if (globalCoinSprite) return globalCoinSprite;

        const coinLabel = this.drawGrid?.coinLabel;
        if (!coinLabel) return null;
        const hudNode = coinLabel.node.parent || coinLabel.node;
        const sprites: Sprite[] = [];
        const walk = (node: Node) => {
            const sprite = node.getComponent(Sprite);
            if (sprite?.spriteFrame) sprites.push(sprite);
            for (let i = 0; i < node.children.length; i++) walk(node.children[i]);
        };
        walk(hudNode);
        const namedCoin = sprites.find(sprite => {
            const name = sprite.node.name.toLowerCase();
            return name.includes('jinbi') || name.includes('coin');
        });
        if (namedCoin) return namedCoin;
        return sprites.find(sprite => sprite.node !== hudNode) || sprites[0] || null;
    }

    private getHudCoinVisualSize(sprite: Sprite | null): { width: number; height: number } {
        if (!sprite) return { width: 41, height: 36 };
        const transform = sprite.node.getComponent(CcUITransform);
        const width = transform?.contentSize.width || sprite.spriteFrame?.rect.width || 51;
        const height = transform?.contentSize.height || sprite.spriteFrame?.rect.height || 45;
        return {
            width: width * Math.abs(sprite.node.scale.x || 1),
            height: height * Math.abs(sprite.node.scale.y || 1),
        };
    }

    private loadCoinSpriteFrame(onLoaded: (frame: SpriteFrame | null) => void): void {
        AssetService.loadSpriteFrame('images/hud_coin', onLoaded, 'smooth');
    }

    private playFiveBonusClaim(rewardCoins: number, rewardGroup: Node, rewardCoinNode: Node | null, bonusNode: Node, version: number): void {
        if (version !== this.celebrationVersion) return;
        bonusNode.active = false;

        const bonusReward = rewardCoins * 5;
        GameApp.user.coin += bonusReward;
        GameApp.user.save();
        this.refreshCoinHudLabel();
        this.scheduleOnce(() => {
            if (version !== this.celebrationVersion || !this.node?.isValid) return;
            SfxManager.instance.playCoinGain();
        }, 0.16);

        if (this.celebrationCoinLabel) {
            this.celebrationCoinLabel.string = `+${bonusReward}`;
        }
        rewardGroup.active = true;
        tween(rewardGroup).stop();
        rewardGroup.setScale(v3(1, 1, 1));
        tween(rewardGroup)
            .to(0.12, { scale: v3(1.22, 1.22, 1) }, { easing: 'backOut' })
            .to(0.1, { scale: v3(0.96, 0.96, 1) }, { easing: 'quadIn' })
            .to(0.12, { scale: v3(1, 1, 1) }, { easing: 'quadOut' })
            .start();

        const flyStarted = this.playRewardFlyAnimation(
            rewardCoinNode,
            version,
            this.REWARD_FLY_COIN_COUNT,
            this.REWARD_FLY_START_DELAY,
            this.REWARD_FLY_INTERVAL,
            this.REWARD_FLY_DURATION,
            false
        );
        if (!flyStarted) {
            this.playCoinBarBounce(false);
        }
    }

    private setBonusButtonText(buttonNode: Node, text: string): void {
        const label = buttonNode.getChildByName(buttonNode.name + '_Label')?.getComponent(Label);
        if (label) label.string = text;
    }

    private refreshCoinHudLabel(): void {
        this.globalHud?.refreshCoin?.(false);
        const coinLabel = this.drawGrid?.coinLabel;
        if (coinLabel) {
            coinLabel.string = GameApp.user.coin.toString();
        }
    }

    private playRewardFlyAnimation(rewardCoinNode: Node | null, version: number, coinCount = 5, startDelay = 0.56, interval = 0.075, duration = 0.68, playSoundOnComplete = true): boolean {
        if (!this.celebrationRoot || !rewardCoinNode) return false;
        const sourceSprite = rewardCoinNode.getComponent(Sprite);
        const sourceTransform = rewardCoinNode.getComponent(CcUITransform);
        if (!sourceSprite?.spriteFrame || !sourceTransform) return false;

        const globalCoinNode = this.globalHud?.getCoinNode?.() || null;
        const targetWorld = this.getHudCoinSprite()?.node.worldPosition || globalCoinNode?.worldPosition || v3(-312, 566, 0);
        const targetLocal = v3();
        this.celebrationRoot.inverseTransformPoint(targetLocal, targetWorld);
        const baseStart = v3();
        this.celebrationRoot.inverseTransformPoint(baseStart, rewardCoinNode.worldPosition);
        const offsets = [
            v3(-18, 4, 0),
            v3(0, 0, 0),
            v3(18, 6, 0),
            v3(-8, -10, 0),
            v3(10, -6, 0),
            v3(-24, -6, 0),
            v3(24, -4, 0),
            v3(-4, 12, 0),
        ];

        for (let i = 0; i < coinCount; i++) {
            const offset = offsets[i % offsets.length];
            const flyingCoin = this.createCelebrationSprite(
                `VictoryFlyingHudCoin_${i}`,
                sourceSprite.spriteFrame,
                sourceTransform.contentSize.width,
                sourceTransform.contentSize.height
            );
            flyingCoin.parent = this.celebrationRoot;
            flyingCoin.active = false;
            flyingCoin.setSiblingIndex(998);
            const startLocal = v3(baseStart.x, baseStart.y, 0);
            const scatterLocal = v3(
                baseStart.x + offset.x * 2.2 + ((i % 3) - 1) * 18,
                baseStart.y + offset.y * 1.7 + 38 + (i % 4) * 18,
                0
            );
            flyingCoin.setPosition(startLocal);
            flyingCoin.setScale(v3(0.74, 0.74, 1));
            const targetOffset = v3(targetLocal.x + ((i % 5) - 2) * 4, targetLocal.y + (i % 2) * 3, 0);
            const control = v3(
                (scatterLocal.x + targetOffset.x) * 0.5 - 82 - (i % 6) * 10,
                Math.max(scatterLocal.y, targetOffset.y) + 155 + (i % 7) * 18,
                0
            );
            const state = { t: 0 };

            tween(state)
                .delay(startDelay + i * interval)
                .call(() => {
                    if (version !== this.celebrationVersion) return;
                    flyingCoin.active = true;
                })
                .to(duration, { t: 1 }, {
                    easing: 'quadInOut',
                    onUpdate: () => {
                        if (version !== this.celebrationVersion) return;
                        const t = Math.max(0, Math.min(1, state.t));
                        let x = startLocal.x;
                        let y = startLocal.y;
                        if (t < 0.22) {
                            const p = this.easeOutBack(t / 0.22, 0.9);
                            x = startLocal.x + (scatterLocal.x - startLocal.x) * p;
                            y = startLocal.y + (scatterLocal.y - startLocal.y) * p;
                        } else {
                            const p = Math.max(0, Math.min(1, (t - 0.22) / 0.78));
                            const ep = this.easeOutCubic(p);
                            const inv = 1 - ep;
                            x = inv * inv * scatterLocal.x + 2 * inv * ep * control.x + ep * ep * targetOffset.x;
                            y = inv * inv * scatterLocal.y + 2 * inv * ep * control.y + ep * ep * targetOffset.y;
                        }
                        flyingCoin.setPosition(x, y);
                        const scale = 0.82 - 0.18 * t;
                        flyingCoin.setScale(v3(scale, scale, 1));
                    }
                })
                .call(() => {
                    if (version !== this.celebrationVersion) return;
                    flyingCoin.destroy();
                    if (i === coinCount - 1) {
                        this.playCoinBarBounce(playSoundOnComplete);
                    }
                })
                .start();
        }
        return true;
    }

    private playSettlementButtonIntro(node: Node, delay: number, targetX: number, targetY: number): void {
        node.setPosition(targetX, targetY - 34);
        node.setScale(v3(0, 0, 1));
        tween(node)
            .delay(delay)
            .to(0.18, { position: v3(targetX, targetY + 6, 0), scale: v3(1.12, 1.12, 1) }, { easing: 'backOut' })
            .to(0.08, { position: v3(targetX, targetY, 0), scale: v3(1, 1, 1) }, { easing: 'quadOut' })
            .start();
    }

    private playCoinBarBounce(playSound: boolean = true): void {
        if (playSound) {
            SfxManager.instance.playCoinGain();
        }
        const globalHud = this.globalHud;
        if (globalHud?.playCoinBounce) {
            globalHud.playCoinBounce();
            return;
        }

        const coinLabel = this.drawGrid?.coinLabel;
        if (!coinLabel) return;
        const target = coinLabel.node.parent || coinLabel.node;
        tween(target).stop();
        target.setScale(v3(1, 1, 1));
        tween(target)
            .to(0.12, { scale: v3(1.22, 1.22, 1) }, { easing: 'quadOut' })
            .to(0.12, { scale: v3(0.95, 0.95, 1) }, { easing: 'quadIn' })
            .to(0.1, { scale: v3(1, 1, 1) }, { easing: 'quadOut' })
            .start();
    }

    private createCelebrationLabel(text: string, fontSize: number, color: Color): Node {
        const node = new Node(`CelebrationLabel_${text}`);
        this.setUILayer(node);
        node.addComponent(CcUITransform).setContentSize(520, 80);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return node;
    }

    private createCelebrationButton(name: string, text: string, width: number, height: number, color: Color, fontSize = 28, bold = false): Node {
        const node = new Node(name);
        this.setUILayer(node);
        node.addComponent(CcUITransform).setContentSize(width, height + 12);

        const g = node.addComponent(Graphics);
        this.drawCelebrationButtonBlock(g, 0, 0, width, height, color);

        const labelNode = new Node(`${name}_Label`);
        this.setUILayer(labelNode);
        labelNode.parent = node;
        labelNode.addComponent(CcUITransform).setContentSize(width, height);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.isBold = bold;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        labelNode.setPosition(0, 1);
        return node;
    }

    private decorateFiveBonusButton(buttonNode: Node): void {
        const label = buttonNode.getComponentInChildren(Label);
        const iconSize = this.BONUS_BUTTON_COIN_SIZE;
        const labelWidth = 98;
        const gap = 0;
        const contentWidth = iconSize + gap + labelWidth;
        const iconX = -contentWidth / 2 + iconSize / 2;
        const labelX = -contentWidth / 2 + iconSize + gap + labelWidth / 2 - 12;
        if (label) {
            label.string = '5倍领取';
            label.fontSize = 25;
            label.lineHeight = 30;
            label.isBold = true;
            label.color = new Color(255, 255, 255, 255);
            label.node.getComponent(CcUITransform)?.setContentSize(labelWidth, 42);
            label.node.setPosition(labelX, 1);
        }

        this.createBonusTextShadow(buttonNode, '5倍领取', labelX, 1, labelWidth);

        const rewardCoinNode = new Node('VictoryBonusCoinIcon');
        this.setUILayer(rewardCoinNode);
        rewardCoinNode.parent = buttonNode;
        rewardCoinNode.addComponent(CcUITransform).setContentSize(iconSize, iconSize);
        rewardCoinNode.setPosition(iconX, 0);
        const iconSprite = rewardCoinNode.addComponent(Sprite);
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        iconSprite.trim = false;
        const applyCoinFrame = (frame: SpriteFrame | null | undefined): void => {
            if (!frame || !rewardCoinNode.isValid) return;
            iconSprite.spriteFrame = frame;
            rewardCoinNode.getComponent(CcUITransform)?.setContentSize(iconSize, iconSize);
        };
        const hudCoinFrame = this.getHudCoinSprite()?.spriteFrame || this.celebrationCoinSpriteFrame;
        if (hudCoinFrame) {
            applyCoinFrame(hudCoinFrame);
        } else {
            this.drawBonusButtonFallbackCoin(rewardCoinNode.addComponent(Graphics), iconSize);
            this.loadCoinSpriteFrame(frame => {
                if (!frame || !rewardCoinNode.isValid) return;
                const graphics = rewardCoinNode.getComponent(Graphics);
                if (graphics) {
                    graphics.clear();
                    graphics.enabled = false;
                }
                applyCoinFrame(frame);
            });
        }

        if (label) {
            rewardCoinNode.setSiblingIndex(0);
            label.node.setSiblingIndex(buttonNode.children.length - 1);
        }
    }

    private createBonusTextShadow(parent: Node, text: string, x: number, y: number, width = 112): void {
        const offsets = [
            { x: -2, y: 0 },
            { x: 2, y: 0 },
            { x: 0, y: -2 },
            { x: 0, y: 2 },
            { x: 2, y: -2 },
        ];
        for (let i = 0; i < offsets.length; i++) {
            const node = new Node(`VictoryBonusTextStroke_${i}`);
            this.setUILayer(node);
            node.parent = parent;
            node.addComponent(CcUITransform).setContentSize(width, 42);
            node.setPosition(x + offsets[i].x, y + offsets[i].y);
            const label = node.addComponent(Label);
            label.string = text;
            label.fontSize = 25;
            label.lineHeight = 30;
            label.isBold = true;
            label.color = new Color(22, 83, 146, 255);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            node.setSiblingIndex(0);
        }
    }

    private drawBonusButtonFallbackCoin(g: Graphics, size: number): void {
        g.clear();
        const radius = size * 0.45;
        g.fillColor = new Color(129, 82, 10, 90);
        g.circle(size * 0.05, -size * 0.09, radius);
        g.fill();
        g.fillColor = new Color(255, 166, 33, 255);
        g.circle(0, -size * 0.02, radius);
        g.fill();
        g.fillColor = new Color(255, 218, 73, 255);
        g.circle(0, size * 0.03, radius * 0.84);
        g.fill();
        g.fillColor = new Color(255, 242, 132, 255);
        g.circle(-size * 0.1, size * 0.13, radius * 0.54);
        g.fill();
        g.strokeColor = new Color(255, 245, 150, 230);
        g.lineWidth = Math.max(2, size * 0.08);
        g.circle(0, size * 0.03, radius * 0.68);
        g.stroke();
        g.fillColor = new Color(223, 137, 20, 150);
        g.circle(size * 0.13, -size * 0.2, radius * 0.28);
        g.fill();
    }

    private createCelebrationSprite(name: string, spriteFrame: SpriteFrame, width: number, height: number): Node {
        const node = new Node(name);
        this.setUILayer(node);
        node.addComponent(CcUITransform).setContentSize(width, height);
        const sprite = node.addComponent(Sprite);
        sprite.spriteFrame = spriteFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        return node;
    }

    private createFallbackRewardCoinNode(): Node {
        const node = new Node('VictoryRewardCoinFallback');
        this.setUILayer(node);
        node.addComponent(CcUITransform).setContentSize(41, 36);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(255, 166, 33, 255);
        g.circle(0, -1, 20);
        g.fill();
        g.fillColor = new Color(255, 218, 73, 255);
        g.circle(0, 2, 18);
        g.fill();
        g.strokeColor = new Color(255, 245, 150, 230);
        g.lineWidth = 4;
        g.circle(0, 2, 14);
        g.stroke();
        return node;
    }














    private loadEffectSpriteFrame(path: string, onLoaded: (frame: SpriteFrame) => void): void {
        AssetService.loadSpriteFrame(path, frame => {
            if (frame) onLoaded(frame);
        });
    }




    private setUILayer(node: Node): void {
        node.layer = Layers.Enum.UI_2D;
    }

    private blockNodeTouch(node: Node): void {
        node.on(Node.EventType.TOUCH_START, this.stopTouchPropagation, this);
        node.on(Node.EventType.TOUCH_MOVE, this.stopTouchPropagation, this);
        node.on(Node.EventType.TOUCH_END, this.stopTouchPropagation, this);
        node.on(Node.EventType.TOUCH_CANCEL, this.stopTouchPropagation, this);
    }

    private stopTouchPropagation(event: EventTouch): void {
        event.propagationStopped = true;
    }
}


export interface WinPanel {
    [key: string]: any;
}

installWinPanelCelebration(WinPanel);

export default WinPanel;

export function createWinPanel(parent: Node): Component {
    const node = new Node('WinPanel');
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    return node.addComponent(WinPanel);
}
