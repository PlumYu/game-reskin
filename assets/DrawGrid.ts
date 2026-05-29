import { _decorator, Component, Graphics, Color, Vec3, v3, input, Input, EventTouch, tween, SpriteFrame, Node, Sprite, UITransform as CcUITransform, Label, EditBox, director, Layers, Texture2D, UIOpacity, view, Button, Widget } from 'cc';
import GameApp from './Core/GameApp';
import { GameMode, UIID } from './Core/Enum';
import UIManager from './Core/UIManager';
import CountdownController from './Core/CountdownController';
import SfxManager from './Core/SfxManager';
import TiliManager from './Core/TiliManager';
import IdleInterstitialService from './Core/IdleInterstitialService';
import AssetService from './Core/AssetService';
import { createLabel, createNode, createFullScreenOverlay, createCircle, addButtonFeedback, createRoundedCard, COLOR_GOLD, COLOR_WHITE, COLOR_TOOLBAR_BG, RADIUS_MD, getScreenSize } from './Utils/UIBuilder';
import { BALLOON_COLOR_DEFS as BALLOON_COLORS, DEFAULT_PALETTE, DEFAULT_PALETTE_NAMES } from './Game/Palette';
import { generateRandomLevel } from './Game/LevelGenerator';
import { generateDailyChallengeLevel } from './Game/DailyChallengeLevelGenerator';
import { applyLevelConfigData, isValidLevelConfig, type LevelConfigData } from './Game/LevelConfig';
import { DAILY_CHALLENGE_LEVEL_COUNT, MAIN_LEVEL_COUNT, SURVIVAL_LEVEL_COUNT } from './Game/SurvivalConfig';
import { installDrawGridAssets } from './DrawGridModules/DrawGridAssets';
import { installDrawGridHintOverlay } from './DrawGridModules/DrawGridHintOverlay';
import { installDrawGridFeedback } from './DrawGridModules/DrawGridFeedback';
import { installDrawGridHud } from './DrawGridModules/DrawGridHud';
import { installDrawGridToolbar } from './DrawGridModules/DrawGridToolbar';
import { installDrawGridHints } from './DrawGridModules/DrawGridHints';
import { installDrawGridInputFlow } from './DrawGridModules/DrawGridInputFlow';
import { installDrawGridRenderer } from './DrawGridModules/DrawGridRenderer';
import { installDrawGridGuide } from './DrawGridModules/DrawGridGuide';
import { installDrawGridModes } from './DrawGridModules/DrawGridModes';
import { ENABLE_DEBUG_TOOLS } from './Utils/BuildFlags';
import PerfDebug from './Utils/PerfDebug';
const { ccclass, property } = _decorator;

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

@ccclass('DrawGrid')
export class DrawGrid extends Component {
    @property(Graphics)
    public graphics: Graphics = null!;
    private rootGraphics: Graphics | null = null;
    private staticBoardGraphics: Graphics | null = null;
    private dynamicBoardGraphics: Graphics | null = null;
    private staticBoardSignature: string = '';
    private staticBoardDirty: boolean = true;

    @property({ type: SpriteFrame, tooltip: '占座目标的图片' })
    public cowSpriteFrame: SpriteFrame = null!;

    @property({ type: [SpriteFrame], tooltip: 'Current board niuma idle sequence frames' })
    public cowIdle1Frames: SpriteFrame[] = [];

    @property({ type: [SpriteFrame], tooltip: 'Current board niuma idle sequence frames 2' })
    public cowIdle2Frames: SpriteFrame[] = [];

    @property({ type: [SpriteFrame], tooltip: 'Current board niuma found sequence frames' })
    public cowFoundFrames: SpriteFrame[] = [];

    @property({ type: SpriteFrame, tooltip: '胜利过渡大图，不填则复用目标图片' })
    public celebrationCowSpriteFrame: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: '胜利图片' })
    public winSpriteFrame: SpriteFrame = null!;

    @property({ type: SpriteFrame, tooltip: '失败图片' })
    public loseSpriteFrame: SpriteFrame = null!;

    @property({ type: Label, tooltip: '第几关' })
    public levelLabel: Label = null!;

    @property({ type: Node, tooltip: '存放3个爱心的底框节点' })
    public heartContainer: Node = null!;

    @property({ type: Label, tooltip: '金币数量标签' })
    public coinLabel: Label = null!;

    @property({ type: Label, tooltip: '剩余目标数量标签' })
    public remainingCowsLabel: Label = null!;

    @property({ type: Node, tooltip: '提示面板节点（其下需有 Label 与「一键应用」按钮）' })
    public hintPanelNode: Node | null = null;

    public gridSize: number = 4;

    private readonly BALLOON_COLOR_DEFS = BALLOON_COLORS;

    private palette: string[] = DEFAULT_PALETTE.slice();
    /** 色盘颜色名称，与 palette 一一对应，备用（提示、无障碍等） */
    private paletteNames: string[] = DEFAULT_PALETTE_NAMES.slice();

    private readonly BG_SIZE: number = 650;
    private readonly GRID_GAP: number = 6;
    private readonly GRID_PADDING: number = 14;
    private readonly MAX_CONFIG_LEVEL: number = MAIN_LEVEL_COUNT;
    private readonly WRONG_REVEAL_X_COLOR: Color = new Color(245, 117, 50, 255);
    public launchStageOverride: number = 0;
    private readonly COW_IDLE_ACTION_DURATION: number = 1.12;
    private readonly COW_FOUND_ACTION_DURATION: number = 0.8;
    private readonly COW_IDLE_REST_DELAY: number = 0.34;
    private readonly COW_IDLE_ACTION_LOCK_PAD_MS: number = 150;
    private readonly officeEventTitles: string[] = [
        '周五茶水间',
        '老板刚离场',
        '会议室走神',
        '周报截止夜',
        '下班前十分钟',
        '午休后失联',
        '工位异常安静',
        '全员假装忙',
        '需求评审前',
        '日报提交前',
        '茶水间排队',
        '老板突然折返',
        '群消息已读',
        '班味拉满',
        '键盘声很大',
        'Excel 冥想',
        '厕所战神局',
        '工位空城计',
        '假装看数据',
        '老板在路上'
    ];
    private readonly hiddenChallenges: HiddenChallengeConfig[] = [
        { key: 'noMistake', text: '这关别点错' },
        { key: 'noHint', text: '这关能省提示' },
        { key: 'fastClear', text: '30秒内过关' },
        { key: 'firstTry', text: '一把过' },
        { key: 'markFive', text: '先排5格' },
        { key: 'steadyFinish', text: '最后一步别急' }
    ];
    private readonly ruleCardTexts = {
        left: '每种座位\n仅有1处占座',
        middle: '每行每列\n仅有1处占座',
        right: '占座目标\n不能相邻'
    };

    private countdownLabel: Label | null = null;
    private countdownSessionId: number = 0;
    private levelLoadSessionId: number = 0;
    private milestoneBarNode: Node | null = null;
    private milestoneNodes: Node[] = [];
    private milestoneFillNode: Node | null = null;
    private milestoneInfinityNode: Node | null = null;

    private clickedSquares: boolean[] = [];
    private gridColors: string[] = [];
    private cowPositions: boolean[] = [];
    private revealedSquares: boolean[] = []; // 是否已双击翻开

    private balloonCellNodes: Node[] = [];
    private balloonSpriteFrames: SpriteFrame[] = [];
    private balloonAssetCallbacks: Array<() => void> = [];
    private balloonPopNodes: (Node | null)[] = [];
    private foundBalloonBackdropScales: number[] = [];
    private balloonCellBasePositions: (Vec3 | null)[] = [];
    private balloonCellBaseSizes: number[] = [];
    private balloonCowBasePositions: (Vec3 | null)[] = [];
    private balloonCowBaseSizes: number[] = [];
    private balloonFloatTime: number = 0;
    private balloonFloatUpdateElapsed: number = 0;
    private readonly ENABLE_BALLOON_FLOAT: boolean = false;
    private readonly BALLOON_FLOAT_UPDATE_INTERVAL: number = 0.05;
    private readonly ENABLE_JELLY_MOTION: boolean = true;
    private readonly JELLY_MOTION_UPDATE_INTERVAL: number = 0.05;
    private jellyMotionTime: number = 0;
    private jellyMotionUpdateElapsed: number = 0;
    private jellyMotionTokens: number[] = [];
    private jellyInteractionActive: boolean[] = [];
    private jellyScaleX: number[] = [];
    private jellyScaleY: number[] = [];
    private jellyOffsetY: number[] = [];
    private jellyAngle: number[] = [];
    private jellyRippleProgress: number[] = [];
    private jellyRippleAlpha: number[] = [];
    private jellyErrorFlash: number[] = [];
    private readonly BALLOON_CELL_VISUAL_SCALE: number = 1.14;
    private readonly FOUND_COW_DANCE_VISUAL_SCALE: number = 0.68;

    private readonly COW_HINT_VISUAL_SCALE: number = 0.68;

    private xAnimationProgress: number[] = [];
    private squareScales: number[] = [];
    private markAnimationTokens: number[] = [];
    private introScales: number[] = [];
    private squareShakeOffsets: number[] = [];
    private cowHaloProgress: number[] = [];
    private cowIdleTweensStarted: boolean[] = [];
    private cowSpawnedOnce: boolean[] = [];
    private gridIntroVersion: number = 0;

    // 双击判定相关
    private lastTapTime: number = 0;
    private lastTapIndex: number = -1;
    private readonly DOUBLE_TAP_THRESHOLD: number = 350; // 毫秒（双击判定窗口）
    private readonly GUIDE_DOUBLE_TAP_THRESHOLD: number = 1200; // 新手引导给玩家更宽松的连点窗口
    private readonly SINGLE_TAP_SOUND_DELAY: number = 150; // 毫秒（单击音效延迟，比双击窗口短）
    private pendingSingleTapIndex: number = -1; // 待确认的单击格索引
    private pendingSingleTapTimeout: number = 0; // 延迟播放单击音效的 timeout ID

    // 图片节点池
    private cowNodes: Node[] = [];
    private cowIdleTokens: number[] = [];
    private cowRevealTokens: number[] = [];
    private cowRevealVisualScales: number[] = [];
    private cowRevealVisualOffsets: number[] = [];
    private cowFoundActionActive: boolean[] = [];
    private cowCompletionCelebrationActive: boolean = false;
    private cowIdleColorActionActive: boolean[] = [];
    private cowExpressionLocks: number[] = [];
    private cowIdleActionSteps: number[] = [];
    private cowIdleVersion: number = 0;
    private cowFoundFramesByColor: SpriteFrame[][] = [];
    private cowFoundFramesLoading: boolean[] = [];
    private cowFoundFrameCallbacks: Array<Array<(frames: SpriteFrame[]) => void>> = [];
    private cowIdleFramesByColor: SpriteFrame[][] = [];
    private cowIdleFramesLoading: boolean[] = [];
    private cowIdleFrameCallbacks: Array<Array<(frames: SpriteFrame[]) => void>> = [];
    private cowMenuDanceFrames: SpriteFrame[] = [];
    private cowMenuDanceFrameIndex: number = 0;
    private cowMenuDanceElapsed: number = 0;
    private readonly COW_MENU_DANCE_FRAME_INTERVAL: number = 0.16;

    // 游戏状态
    private cowsFound: number = 0;
    /** 本关目标总数（配置按 cows 数量，随机生成时 = gridSize） */
    private totalCows: number = 4;
    private mistakeCount: number = 0;
    private isGameOver: boolean = false;
    private resultNode: Node | null = null;
    private remainingCowIconFrame: SpriteFrame | null = null;
    private remainingCowIconNode: Node | null = null;
    private survivalFoundCowsRoot: Node | null = null;
    private survivalFoundCowsLabel: Label | null = null;
    private readonly CELEBRATION_WIDTH: number = 750;
    private readonly CELEBRATION_HEIGHT: number = 1334;

    // 生存结束动画状态
    private survivalOverRoot: Node | null = null;
    private survivalOverVersion: number = 0;
    private survivalOverGraphics: Graphics | null = null;
    private survivalOverParticles: { x: number; y: number; vx: number; vy: number; size: number; rot: number; rotSpeed: number; color: Color; alpha: number }[] = [];

    private showCoordinates: boolean = false;
    private coordinateNodes: Node[] = [];
    private toolbarContainer: Node | null = null;
    private sceneToolButtonsBound: boolean = false;
    private staticGameplayBackgroundNode: Node | null = null;
    private gameplaySettingButton: Node | null = null;
    private gameplaySettingSprite: Sprite | null = null;
    private readonly hudLeftMargin: number = 28;
    private readonly hudTopMargin: number = 24;
    /** 当前提示目标格下标，-1 表示无（提示1：可确定目标） */
    private hintTargetIndex: number = -1;
    /** 高亮显示的格下标，-1 表示不高亮 */
    private highlightIndex: number = -1;
    /** 提示2：已翻开的目标下标，其行列未标×的格将高亮并一键标× */
    private hintExcludeCowIndex: number = -1;
    /** 提示3：已翻开的目标下标，其8邻未标×的格将高亮并一键标× */
    private hintExcludeNeighborCowIndex: number = -1;
    /** 提示4（规则F 行列内异色）：某色未知格全在同一行/列时，-1 表示无；否则为行号或列号 */
    private hintColorOccupiedRowOrCol: number = -1;
    private hintColorOccupiedIsCol: boolean = false;
    private hintColorOccupiedColor: string = '';
    /** 提示5（规则E 整排同色）：某色占领一整排时，-1 表示无；否则为行号或列号，该排外同色格高亮并一键排除 */
    private hintRuleERowOrCol: number = -1;
    private hintRuleEIsCol: boolean = false;
    private hintRuleEColor: string = '';
    /** 提示6（多色占多排）：若干排被若干颜色占据时，这些排的索引、是否列、占据色集合 */
    private hintOccupiedLineIndices: number[] = [];
    private hintOccupiedIsCol: boolean = false;
    private hintOccupiedColors: string[] = [];
    /** 提示7（邻居色仅在此邻域）：当前格子的邻居颜色仅存在于该邻居集合时，当前格不可能为目标，可标× */
    private hintNeighborColorOnlyIndex: number = -1;
    /** 多格高亮（提示2/3/4/5/6 用） */
    private highlightIndices: number[] = [];
    private hintFocusIndices: number[] = [];
    private hintActionIndices: number[] = [];
    private hintPulseProgress: number = 0;
    private hintPulseState: { progress: number } | null = null;
    private hintOverlayNode: Node | null = null;
    private hintOverlayGraphics: Graphics | null = null;
    private hintCowLayerNode: Node | null = null;
    private hintCowSpriteNodes: Node[] = [];
    private hintBalloonSpriteNodes: Node[] = [];
    private hintLegacyOverlayNode: Node | null = null;
    private hintPanelOriginalSiblingIndex: number = -1;
    private debugPanelNode: Node | null = null;
    private debugLevelEditBox: EditBox | null = null;
    private debugStatusLabel: Label | null = null;
    private debugLevelLoadStatus: string = '';
    private ruleBoxNode: Node | null = null;
    private ruleLeftLabel: Label | null = null;
    private ruleMiddleLabel: Label | null = null;
    private ruleRightLabel: Label | null = null;
    private ruleLeftDivider: Node | null = null;
    private ruleRightDivider: Node | null = null;
    private ruleGlowNode: Node | null = null;
    private ruleGlowGraphics: Graphics | null = null;
    private ruleLeftText: string = '';
    private ruleMiddleText: string = '';
    private ruleRightText: string = '';
    private ruleRevealVersion: number = 0;
    private currentHiddenChallengeKey: HiddenChallengeConfig['key'] = 'noMistake';
    private currentHiddenChallengeText: string = '';
    private levelStartTime: number = 0;
    private hintUsedThisLevel: boolean = false;
    private lastHintBadgeCowCount: number = -1;
    private lastHintBadgeExcludeCount: number = -1;
    private workplaceFeedbackLastTime: number = 0;
    private workplaceThemeVersion: number = 0;

    // --- guide state ---
    private _isGuideMode: boolean = false;
    private guideStep: number = 0;
    private guideIndex: number[] = [];
    private checkGuideIndex: number[] = [];
    private guideOverlayNode: Node | null = null;
    private guideFingerNode: Node | null = null;
    private sceneHintGuideFingerNode: Node | null = null;
    private sceneHintGuideTargetNode: Node | null = null;
    private sceneHintGuideSessionId: number = 0;
    private sceneHintGuideShownCount: number = 0;
    private sceneHintGuideTargetKind: 'cow' | 'exclude' | null = null;
    private guideTipLabel: Label | null = null;
    private guideTipTextRootNode: Node | null = null;
    private guideTipSegmentNodes: Node[] = [];
    private guideBacklightNodes: Node[] = [];


    // 滑动批量操作相关的状态
    private isSwiping: boolean = false;
    private swipeTargetState: boolean = false;
    private swipeStartIndex: number = -1;
    private processedInCurrentSwipe: Set<number> = new Set();
    private renderDirty: boolean = false;
    private lastMarkOperationTime: number = 0;
    private lastMarkFeedbackTime: number = 0;
    private activeMarkAnimations: number = 0;
    private readonly FAST_MARK_OPERATION_MS: number = 120;
    private readonly MARK_FEEDBACK_THROTTLE_MS: number = 100;

    private get currentLevel(): number {
        return this.clampLevel(GameApp.user.level);
    }

    private set currentLevel(value: number) {
        GameApp.user.level = this.clampLevel(value);
    }

    private get totalCoins(): number {
        return GameApp.user.coin;
    }

    private set totalCoins(value: number) {
        GameApp.user.coin = value;
    }

    onEnable() {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        // this.initGrid();
        // this.renderGrid();
    }

    onDisable() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    start() {
        PerfDebug.begin('DrawGrid.start');
        if (!GameApp.uiManager) {
            const canvas = director.getScene()!.getChildByName('Canvas')!;
            const uiRoot = new Node('UIManager');
            uiRoot.layer = Layers.Enum.UI_2D;
            canvas.addChild(uiRoot);
            GameApp.uiManager = uiRoot.addComponent(UIManager);
        }

        if (!this.graphics) {
            this.graphics = this.getComponent(Graphics) || this.getComponentInChildren(Graphics)!;
        }
        this.ensureBoardGraphicsLayers?.();
        GameApp.drawGrid = this;
        PerfDebug.mark('DrawGrid.start services ready');
        AssetService.preloadBundle('remote', 'game startup');
        this.configureCowStaticSpriteFrames();
        this.loadGameData();
        SfxManager.instance.preload();
        IdleInterstitialService.start();
        this.loadRemainingCowIconAsset();
        this.setupHintPanel();
        if (ENABLE_DEBUG_TOOLS) {
            this.setupDebugJumpPanel();
        }

        if (!GameApp.tiliManager) {
            const canvas = director.getScene()!.getChildByName('Canvas')!;
            const tiliNode = new Node('TiliManager');
            tiliNode.layer = Layers.Enum.UI_2D;
            canvas.addChild(tiliNode);
            tiliNode.addComponent(TiliManager);
        }

        if (!this.applyBrowserLaunchParams()) {
            if (GameApp.user.firstGame === 0 && GameApp.user.level <= 1) {
                PerfDebug.mark('DrawGrid.start auto guide');
                GameApp.gameMode = GameMode.level;
                GameApp.isStartGame = true;
                GameApp.passLevel = 0;
                this.setGameUIVisible(true);
                this.reStartGame();
                PerfDebug.end('DrawGrid.start', { route: 'autoGuide' });
                return;
            }

            GameApp.isStartGame = false;
            this.setGameUIVisible(false);
            GameApp.uiManager!.open(UIID.MainPanel);
            PerfDebug.end('DrawGrid.start', { route: 'mainPanel' });
            return;
        }
        PerfDebug.end('DrawGrid.start', { route: 'launchParams' });
    }

    private applyBrowserLaunchParams(): boolean {
        const params = this.getBrowserLaunchParams();
        if (!params) return false;

        PerfDebug.mark('DrawGrid.launchParams', params);
        const mode = params.mode;
        const stage = params.stage;
        this.launchStageOverride = 0;
        GameApp.useTime = 0;
        GameApp.foundCowNum = 0;
        GameApp.isStartGame = true;
        this.setGameUIVisible(true);

        if (params.gold !== undefined) {
            GameApp.user.coin = params.gold;
            GameApp.user.save();
            console.log('[DrawGrid] debug gold set to', params.gold);
        }

        if (mode === 'survival') {
            GameApp.gameMode = GameMode.survival;
            GameApp.passLevel = 0;
            GameApp.survivalReviveTime = 1;
            GameApp.survivalIsWin = false;
            this.launchStageOverride = stage;
            this.startSurvivalMode();
            return true;
        }

        if (mode === 'daily_challenge') {
            GameApp.gameMode = GameMode.daily_challenge;
            GameApp.passLevel = 0;
            GameApp.dailyChallengeReviveTime = 1;
            GameApp.dailyChallengeIsWin = false;
            this.launchStageOverride = stage;
            this.startDailyChallengeMode();
            return true;
        }

        GameApp.gameMode = GameMode.level;
        this.currentLevel = stage;
        GameApp.passLevel = stage - 1;
        this.reStartGame();
        return true;
    }

    private getBrowserLaunchParams(): { mode: 'main' | 'survival' | 'daily_challenge'; stage: number; gold?: number } | null {
        const search = (globalThis as any)?.location?.search;
        if (typeof search !== 'string' || search.length <= 1) return null;

        const SearchParams = (globalThis as any).URLSearchParams;
        if (typeof SearchParams !== 'function') return null;

        const params = new SearchParams(search);
        const rawMode = (params.get('mode') || 'main').trim().toLowerCase();
        const mode = rawMode === 'level' ? 'main' : rawMode;
        if (mode !== 'main' && mode !== 'survival' && mode !== 'daily_challenge') return null;

        const rawStage = params.get('stage');
        if (!rawStage) return null;
        const parsedStage = Math.floor(Number(rawStage));
        if (!Number.isFinite(parsedStage) || parsedStage < 1) return null;

        const maxStage = mode === 'survival'
            ? SURVIVAL_LEVEL_COUNT
            : mode === 'daily_challenge' ? DAILY_CHALLENGE_LEVEL_COUNT : MAIN_LEVEL_COUNT;
        const stage = Math.min(maxStage, Math.max(1, parsedStage));

        const result: { mode: 'main' | 'survival' | 'daily_challenge'; stage: number; gold?: number } = { mode, stage };
        const rawGold = params.get('gold');
        if (rawGold) {
            const parsedGold = Math.floor(Number(rawGold));
            if (Number.isFinite(parsedGold) && parsedGold >= 0) {
                result.gold = parsedGold;
            }
        }
        return result;
    }

    public requestRender(): void {
        PerfDebug.count(this.renderDirty ? 'renderRequest.coalesced' : 'renderRequest.setDirty');
        this.renderDirty = true;
    }

    update(dt: number) {
        PerfDebug.frame(dt);
        if (PerfDebug.enabled && dt > 0.12) {
            PerfDebug.mark('frame stall', {
                dtMs: Math.round(dt * 1000),
                renderDirty: this.renderDirty,
                isStartGame: GameApp.isStartGame,
                isGameOver: this.isGameOver,
                cowCompletionCelebrationActive: this.cowCompletionCelebrationActive,
                activeMarkAnimations: this.activeMarkAnimations || 0,
            });
        }
        const clampedDt = Math.min(Math.max(dt, 0), 0.05);
        this.balloonFloatTime += clampedDt;
        this.jellyMotionTime += clampedDt;
        this.updateCowMenuDance(dt);
        if (this.ENABLE_JELLY_MOTION) {
            this.jellyMotionUpdateElapsed += clampedDt;
            if (this.jellyMotionUpdateElapsed >= this.JELLY_MOTION_UPDATE_INTERVAL) {
                this.jellyMotionUpdateElapsed = 0;
                this.updateJellyMotionVisuals();
            }
        }
        if (this.ENABLE_BALLOON_FLOAT) {
            this.balloonFloatUpdateElapsed += clampedDt;
            if (this.balloonFloatUpdateElapsed >= this.BALLOON_FLOAT_UPDATE_INTERVAL) {
                this.balloonFloatUpdateElapsed = 0;
                PerfDebug.count('balloonFloat.update');
                this.updateBalloonFloatVisuals();
            } else {
                PerfDebug.count('balloonFloat.skip');
            }
        } else {
            this.balloonFloatUpdateElapsed = 0;
            PerfDebug.count('balloonFloat.disabled');
        }
        this.syncSceneHintCountBadgesIfChanged?.();
        if (this.renderDirty) {
            this.renderDirty = false;
            PerfDebug.count('renderFrame.dirty');
            this.renderGrid();
        }
    }

    private configurePixelPerfectSpriteFrame<T extends SpriteFrame | null | undefined>(frame: T): T {
        if (!frame) return frame;
        this.configurePixelPerfectTexture(frame.texture as Texture2D | null);
        return frame;
    }

    private configureSmoothSpriteFrame<T extends SpriteFrame | null | undefined>(frame: T): T {
        if (!frame) return frame;
        const texture = frame.texture as Texture2D | null;
        if (texture) {
            texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
            texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
            texture.setMipFilter(Texture2D.Filter.NONE);
            texture.setAnisotropy(0);
        }
        return frame;
    }
    private readonly GUIDE_TIPS: string[] = [
        '连点两下，把占座目标找出来',
        '每种颜色的座位只能有一处占座',
        '占座目标之间不能相邻，单击排除周围座位',
        '每行每列只能有一处占座，继续排除这些座位',
        '只剩最后的黄色座位了，连点两下找出占座目标吧',
        '最后两个占座目标藏在哪儿，你找到了吗？'
    ];
}


export interface DrawGrid {
    [key: string]: any;
}

installDrawGridAssets(DrawGrid);
installDrawGridHintOverlay(DrawGrid);
installDrawGridFeedback(DrawGrid);
installDrawGridHud(DrawGrid);
installDrawGridToolbar(DrawGrid);
installDrawGridHints(DrawGrid);
installDrawGridInputFlow(DrawGrid);
installDrawGridRenderer(DrawGrid);
installDrawGridGuide(DrawGrid);
installDrawGridModes(DrawGrid);
