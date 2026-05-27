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
import { getEarlyMainLevelConfig } from '../Game/EarlyLevelConfigs';
import { getMainLevelPath } from '../Game/SurvivalConfig';
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
export function installDrawGridAssets(target: any): void {
    Object.assign(target.prototype, {
    loadRemainingCowIconAsset: function () {
        PerfDebug.begin('DrawGrid.remainingCowIcon');
        const applyFrame = (frame: SpriteFrame | null) => {
            this.remainingCowIconFrame = frame ? this.configureSmoothSpriteFrame(frame) : null;
            this.refreshRemainingCowIcon();
            PerfDebug.end('DrawGrid.remainingCowIcon', { ok: !!frame });
        };

        AssetService.loadSpriteFrame('characters/menu_idle_static', frame => {
            if (frame) {
                applyFrame(frame);
                return;
            }
            this.loadSpriteFrameAsset('ui/remaining-niuma', fallbackFrame => {
                applyFrame(fallbackFrame);
            });
        }, 'smooth');
    },
    loadBalloonAssets: function (onLoaded?: () => void) {
        if (onLoaded) {
            if (!this.balloonAssetCallbacks) this.balloonAssetCallbacks = [];
            this.balloonAssetCallbacks.push(onLoaded);
        }

        const flushCallbacks = () => {
            const callbacks = this.balloonAssetCallbacks || [];
            this.balloonAssetCallbacks = [];
            callbacks.forEach((callback: () => void) => callback());
        };

        if (this.balloonSpriteFrames?.length > 0) {
            PerfDebug.mark('DrawGrid.balloonAssets cache hit', { count: this.balloonSpriteFrames.length });
            flushCallbacks();
            return;
        }
        if (this.balloonAssetsLoading) {
            PerfDebug.mark('DrawGrid.balloonAssets loading join');
            return;
        }
        this.balloonAssetsLoading = true;
        PerfDebug.begin('DrawGrid.balloonAssets');
        AssetService.loadSpriteFrameDir('balloon_atlas', frames => {
            this.balloonAssetsLoading = false;
            this.balloonSpriteFrames = frames;
            if (frames.length < 12) {
                console.warn(`[DrawGrid] Balloon atlas frames loaded: ${frames.length}/12`);
            }
            if (this.gridColors.length > 0) this.renderGrid();
            PerfDebug.end('DrawGrid.balloonAssets', { count: frames.length });
            flushCallbacks();
        }, 'smooth');
    },
    configureCowStaticSpriteFrames: function () {
        this.configurePixelPerfectSpriteFrame(this.cowSpriteFrame);
        this.configurePixelPerfectSpriteFrame(this.celebrationCowSpriteFrame);
    },
    configurePixelPerfectTexture: function (texture: Texture2D | null | undefined) {
        if (!texture) return;
        texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
        texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
        texture.setMipFilter(Texture2D.Filter.NONE);
        texture.setAnisotropy(0);
        if (texture.isCompressed) {
            console.warn(`[DrawGrid] Pixel sequence texture is compressed: ${texture.name}`);
        }
    },
    createPixelPerfectSpriteFrame: function (texture: Texture2D, name: string): SpriteFrame {
        this.configurePixelPerfectTexture(texture);
        const frame = new SpriteFrame();
        frame.texture = texture;
        frame.name = name;
        return frame;
    },
    createSmoothSpriteFrame: function (texture: Texture2D, name: string): SpriteFrame {
        texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
        texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
        texture.setMipFilter(Texture2D.Filter.NONE);
        texture.setAnisotropy(0);
        const frame = new SpriteFrame();
        frame.texture = texture;
        frame.name = name;
        return frame;
    },
    snapPixelValue: function (value: number): number {
        return Math.max(1, Math.round(value));
    },
    snapPixelPosition: function (value: number): number {
        return Math.round(value);
    },
    getPixelPerfectFitSize: function (frame: SpriteFrame | null | undefined, maxWidth: number, maxHeight: number): { width: number; height: number } {
        const snappedMaxWidth = this.snapPixelValue(maxWidth);
        const snappedMaxHeight = this.snapPixelValue(maxHeight);
        const rect = frame?.rect;
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            return { width: snappedMaxWidth, height: snappedMaxHeight };
        }

        const rawWidth = Math.max(1, Math.round(rect.width));
        const rawHeight = Math.max(1, Math.round(rect.height));
        const fitScale = Math.min(snappedMaxWidth / rawWidth, snappedMaxHeight / rawHeight);
        if (fitScale >= 1) {
            const integerMultiple = Math.max(1, Math.floor(fitScale));
            return {
                width: rawWidth * integerMultiple,
                height: rawHeight * integerMultiple,
            };
        }

        const width = Math.max(1, Math.floor(rawWidth * fitScale));
        const height = Math.max(1, Math.floor(rawHeight * fitScale));
        return { width, height };
    },
    getRawSpriteFrameFitSize: function (frame: SpriteFrame | null | undefined, maxWidth: number, maxHeight: number): { width: number; height: number } {
        const snappedMaxWidth = this.snapPixelValue(maxWidth);
        const snappedMaxHeight = this.snapPixelValue(maxHeight);
        const anyFrame = frame as any;
        let originalSize = anyFrame?.originalSize || anyFrame?._originalSize || null;
        if (!originalSize && typeof anyFrame?.getOriginalSize === 'function') {
            originalSize = anyFrame.getOriginalSize();
        }

        const rect = frame?.rect;
        const fallbackSize = Math.max(
            1,
            Math.round(Math.max(rect?.width || 0, rect?.height || 0, snappedMaxWidth, snappedMaxHeight))
        );
        const rawWidth = Math.max(1, Math.round(originalSize?.width || fallbackSize));
        const rawHeight = Math.max(1, Math.round(originalSize?.height || fallbackSize));
        const fitScale = Math.min(snappedMaxWidth / rawWidth, snappedMaxHeight / rawHeight);
        return {
            width: Math.max(1, Math.floor(rawWidth * fitScale)),
            height: Math.max(1, Math.floor(rawHeight * fitScale)),
        };
    },
    loadCowAnimationFrames: function () {
        if (this.cowMenuDanceFrames?.length > 0) {
            PerfDebug.mark('DrawGrid.cowAnimation cache hit', { count: this.cowMenuDanceFrames.length });
            return;
        }
        if (this.cowMenuDanceLoading) {
            PerfDebug.mark('DrawGrid.cowAnimation loading join');
            return;
        }
        PerfDebug.mark('DrawGrid.cowAnimation init');
        this.cowIdle1Frames = [];
        this.cowIdle2Frames = [];
        this.cowFoundFrames = [];
        this.cowMenuDanceFrames = [];
        this.cowMenuDanceFrameIndex = 0;
        this.cowMenuDanceElapsed = 0;
        this.loadMenuDanceFrames();
    },
    loadMenuDanceFrames: function (): void {
        const path = 'characters/menu_idle';
        this.cowMenuDanceLoading = true;
        PerfDebug.begin('DrawGrid.menuDanceFrames', { path });
        AssetService.loadSpriteFrameDir(path, frames => {
            this.cowMenuDanceLoading = false;
            if (frames.length === 0) {
                console.warn('[DrawGrid] Menu dance frames not loaded: ' + path);
            }
            this.cowMenuDanceFrames = frames;
            this.applyCowMenuDanceFrameToAll();
            PerfDebug.end('DrawGrid.menuDanceFrames', { count: frames.length });
        }, 'smooth');
    },
    loadSpriteFrameDir: function (path: string, onLoaded: (frames: SpriteFrame[]) => void) {
        AssetService.loadSpriteFrameDir(path, onLoaded);
    },
    loadSpriteFrameAsset: function (path: string, onLoaded: (frame: SpriteFrame | null) => void) {
        AssetService.loadSpriteFrame(path, onLoaded);
    },
    sortSpriteFrames: function (frames: SpriteFrame[]): SpriteFrame[] {
        return [...frames].sort((a, b) => {
            const aMatch = a.name.match(/(\d+)(?!.*\d)/);
            const bMatch = b.name.match(/(\d+)(?!.*\d)/);
            const aNum = aMatch ? parseInt(aMatch[1], 10) : Number.MAX_SAFE_INTEGER;
            const bNum = bMatch ? parseInt(bMatch[1], 10) : Number.MAX_SAFE_INTEGER;
            if (aNum !== bNum) return aNum - bNum;
            return a.name.localeCompare(b.name);
        });
    },
    getCellColorIndex: function (index: number): number {
        const color = (this.gridColors[index] || '').toLowerCase();
        const paletteIndex = this.palette.findIndex(item => item.toLowerCase() === color);
        return paletteIndex >= 0 ? paletteIndex : 0;
    },
    hasVisibleBalloonCell: function (index: number): boolean {
        return !!this.gridColors[index] && !!this.getBalloonSpriteFrame(index);
    },
    hasBalloonCowFrame: function (index: number): boolean {
        return false;
    },
    hasBalloonNormalFrame: function (index: number): boolean {
        return !!this.gridColors[index];
    },
    getBalloonColor: function (index: number): Color {
        const colorIndex = this.getCellColorIndex(index);
        const def = this.BALLOON_COLOR_DEFS[colorIndex] || this.BALLOON_COLOR_DEFS[0];
        return new Color(def.rgb[0], def.rgb[1], def.rgb[2], 255);
    },
    getBalloonSpriteFrame: function (index: number): SpriteFrame | null {
        const colorIndex = this.getCellColorIndex(index);
        return this.balloonSpriteFrames[colorIndex] || null;
    },
    getFoundColorDir: function (colorIndex: number): string {
        const def = this.BALLOON_COLOR_DEFS[colorIndex] || this.BALLOON_COLOR_DEFS[0];
        const prefix = def.index < 10 ? `0${def.index}` : `${def.index}`;
        return `${prefix}_${def.key}`;
    },
    loadCowFoundFramesForCell: function (index: number, onLoaded: (frames: SpriteFrame[]) => void): void {
        const colorIndex = this.getCellColorIndex(index);
        const cachedFrames = this.cowFoundFramesByColor[colorIndex];
        if (cachedFrames) {
            onLoaded(cachedFrames);
            return;
        }

        if (this.cowFoundFramesLoading[colorIndex]) {
            if (!this.cowFoundFrameCallbacks[colorIndex]) this.cowFoundFrameCallbacks[colorIndex] = [];
            this.cowFoundFrameCallbacks[colorIndex].push(onLoaded);
            return;
        }

        this.cowFoundFramesLoading[colorIndex] = true;
        this.cowFoundFrameCallbacks[colorIndex] = [onLoaded];
        const dir = this.getFoundColorDir(colorIndex);
        this.loadSpriteFrameDir(`characters/niuma/found_colors/${dir}`, frames => {
            this.cowFoundFramesByColor[colorIndex] = frames;
            this.cowFoundFramesLoading[colorIndex] = false;
            if (frames.length === 0) {
                console.warn(`[DrawGrid] Colored found frames not loaded: characters/niuma/found_colors/${dir}`);
            }
            const callbacks = this.cowFoundFrameCallbacks[colorIndex] || [];
            this.cowFoundFrameCallbacks[colorIndex] = [];
            callbacks.forEach(callback => callback(frames));
        });
    },
    loadCowIdleFramesForCell: function (index: number, onLoaded: (frames: SpriteFrame[]) => void): void {
        const colorIndex = this.getCellColorIndex(index);
        const cachedFrames = this.cowIdleFramesByColor[colorIndex];
        if (cachedFrames) {
            onLoaded(cachedFrames);
            return;
        }

        if (this.cowIdleFramesLoading[colorIndex]) {
            if (!this.cowIdleFrameCallbacks[colorIndex]) this.cowIdleFrameCallbacks[colorIndex] = [];
            this.cowIdleFrameCallbacks[colorIndex].push(onLoaded);
            return;
        }

        this.cowIdleFramesLoading[colorIndex] = true;
        this.cowIdleFrameCallbacks[colorIndex] = [onLoaded];
        const dir = this.getFoundColorDir(colorIndex);
        this.loadSpriteFrameDir(`characters/niuma/idle_colors/${dir}`, frames => {
            this.cowIdleFramesByColor[colorIndex] = frames;
            this.cowIdleFramesLoading[colorIndex] = false;
            if (frames.length === 0) {
                console.warn(`[DrawGrid] Colored idle frames not loaded: characters/niuma/idle_colors/${dir}`);
            }
            const callbacks = this.cowIdleFrameCallbacks[colorIndex] || [];
            this.cowIdleFrameCallbacks[colorIndex] = [];
            callbacks.forEach(callback => callback(frames));
        });
    },
    preloadCowFoundFramesForCurrentCows: function (): void {
        const colorIndices = new Set<number>();
        this.cowPositions.forEach((isCow, index) => {
            if (isCow) colorIndices.add(this.getCellColorIndex(index));
        });
        colorIndices.forEach(colorIndex => {
            const sampleIndex = this.gridColors.findIndex((_, index) => this.getCellColorIndex(index) === colorIndex);
            if (sampleIndex >= 0) this.loadCowFoundFramesForCell(sampleIndex, () => {});
        });
    },
    preloadCowIdleFramesForCurrentCows: function (): void {
        const colorIndices = new Set<number>();
        this.cowPositions.forEach((isCow, index) => {
            if (isCow) colorIndices.add(this.getCellColorIndex(index));
        });
        colorIndices.forEach(colorIndex => {
            const sampleIndex = this.gridColors.findIndex((_, index) => this.getCellColorIndex(index) === colorIndex);
            if (sampleIndex >= 0) this.loadCowIdleFramesForCell(sampleIndex, () => {});
        });
    },
    applyLevelConfig: function (data: LevelConfigData) {
        const state = applyLevelConfigData(data, this.palette);
        this.gridSize = state.gridSize;
        this.gridColors = state.gridColors;
        this.cowPositions = state.cowPositions;
        this.totalCows = state.totalCows;
    },
    initGrid: function (onDone?: () => void) {
        const loadSessionId = ++this.levelLoadSessionId;
        PerfDebug.begin('DrawGrid.initGrid', { mode: GameApp.gameMode, level: this.currentLevel });
        if (GameApp.gameMode === GameMode.level && GameApp.user.firstGame === 1) {
            GameApp.user.firstGame = 2;
            GameApp.user.save();
        }
        const shouldEnterGuide = GameApp.gameMode === GameMode.level && GameApp.user.firstGame === 0 && GameApp.user.level <= 1;
        if (!shouldEnterGuide) {
            GameApp.isGuideSettlement = false;
        }
        const keepGuideWhiteDuringReload = !!(this.guideWhiteBackgroundNode && this.guideWhiteBackgroundNode.isValid) && !shouldEnterGuide;
        const finishReload = (): void => {
            onDone?.();
            if (keepGuideWhiteDuringReload) {
                this.scheduleOnce(() => this.clearGuideWhiteBackground?.(), 0);
            }
        };
        const requestedLevel = shouldEnterGuide ? 1 : this.currentLevel;
        this.cowsFound = 0;
        this.mistakeCount = 0;
        this.isGameOver = false;
        this.cowCompletionCelebrationActive = false;
        this.gridIntroVersion++;
        this.cowIdleVersion++;
        PerfDebug.mark('DrawGrid.initGrid cleanup', {
            cowNodes: this.cowNodes.length,
            balloonPopNodes: this.balloonPopNodes.length,
            children: this.node?.children?.length || 0,
        });
        this.cowNodes.forEach(node => { if (node) node.destroy(); });
        this.balloonPopNodes.forEach(node => { if (node && node.isValid) node.destroy(); });
        this.cowNodes = [];
        this.balloonPopNodes = [];
        this.foundBalloonBackdropScales = [];
        this.cowIdleTokens = [];
        this.cowRevealTokens = [];
        this.cowRevealVisualScales = [];
        this.cowRevealVisualOffsets = [];
        this.cowExpressionLocks = [];
        this.cowIdleActionSteps = [];

        if (shouldEnterGuide) {
            this._isGuideMode = true;
            this._isSwipeGuideMode = false;
            this.guideStep = 0;
            this.guideIndex = [];
            this.checkGuideIndex = [];
            this.clearGuideOverlay?.(false);
        } else {
            this.resetGuideRuntimeState?.(keepGuideWhiteDuringReload);
        }

        if (shouldEnterGuide) {
            this.applyLevelConfig({
                n: 4,
                c: [
                    5, 2, 7, 7,
                    5, 7, 7, 7,
                    5, 6, 7, 7,
                    5, 6, 6, 7,
                ],
                cows: [1, 7, 8, 14],
            });
            this.finishInitGrid();
            onDone?.();
            PerfDebug.end('DrawGrid.initGrid', { source: 'guide', gridSize: this.gridSize, totalCows: this.totalCows });
            return;
        }

        const earlyConfig = GameApp.gameMode === GameMode.level ? getEarlyMainLevelConfig(requestedLevel) : null;
        if (earlyConfig) {
            this.setDebugLevelLoadStatus(`内置关卡 ${requestedLevel}`);
            this.applyLevelConfig(earlyConfig);
            this.finishInitGrid();
            if (this.currentLevel === 1) {
                const cowIndices = this.cowPositions.map((b, i) => b ? i : -1).filter(i => i >= 0);
                if (cowIndices.length >= 2) {
                    this.revealedSquares[cowIndices[1]] = true;
                    this.cowsFound = 1;
                }
            }
            if (this.cowsFound > 0) {
                this.updateRemainingLabel();
            }
            finishReload();
            PerfDebug.end('DrawGrid.initGrid', { source: 'early', level: requestedLevel, gridSize: this.gridSize, totalCows: this.totalCows });
            return;
        }

        const path = getMainLevelPath(requestedLevel);
        this.setDebugLevelLoadStatus(`读取 ${path} 中...`);
        AssetService.loadJson(path, asset => {
            if (this.levelLoadSessionId !== loadSessionId || GameApp.gameMode !== GameMode.level || this.currentLevel !== requestedLevel) {
                return;
            }
            if (asset && asset.json) {
                const data = asset.json as { n?: number; c?: number[]; cows?: number[] };
                if (isValidLevelConfig(data)) {
                    console.log('[LevelConfig] loaded', path, {
                        n: data.n,
                        firstRow: data.c.slice(0, data.n),
                        cows: data.cows,
                    });
                    this.setDebugLevelLoadStatus(`已加载 ${path} / n=${data.n}`);
                    this.applyLevelConfig(data);
                    this.finishInitGrid();
                    // 第一关：默认显示一只牛（揭示第二只）
                    if (this.currentLevel === 1) {
                        const cowIndices = this.cowPositions.map((b, i) => b ? i : -1).filter(i => i >= 0);
                        if (cowIndices.length >= 2) {
                            this.revealedSquares[cowIndices[1]] = true;
                            this.cowsFound = 1;
                        }
                    }
                    if (this.cowsFound > 0) {
                        this.updateRemainingLabel();
                    }
                    finishReload();
                    PerfDebug.end('DrawGrid.initGrid', { source: 'json', path, gridSize: this.gridSize, totalCows: this.totalCows });
                    return;
                }
            }
            const message = `[LevelConfig] load failed: ${path}`;
            console.error(message);
            this.setDebugLevelLoadStatus(`读取失败 ${path}`);
            PerfDebug.end('DrawGrid.initGrid', { source: 'error', path });
            throw new Error(message);
        });
    },
    finishInitGrid: function () {
        PerfDebug.mark('DrawGrid.finishInitGrid begin', { gridSize: this.gridSize, totalCows: this.totalCows });
        this.invalidateStaticBoard?.();
        const total = this.gridSize * this.gridSize;
        this.clickedSquares = new Array(total).fill(false);
        this.revealedSquares = new Array(total).fill(false);
        this.hintTargetIndex = -1;
        this.highlightIndex = -1;
        this.hintExcludeCowIndex = -1;
        this.hintExcludeNeighborCowIndex = -1;
        this.hintColorOccupiedRowOrCol = -1;
        this.hintColorOccupiedColor = '';
        this.hintRuleERowOrCol = -1;
        this.hintRuleEColor = '';
        this.hintOccupiedLineIndices = [];
        this.hintOccupiedColors = [];
        this.hintNeighborColorOnlyIndex = -1;
        this.highlightIndices = [];
        this.resetSceneHintGuidePrompt?.();
        this.clearHintVisuals();
        this.setHintPanelShown(false);
        this.xAnimationProgress = new Array(total).fill(0);
        this.squareScales = new Array(total).fill(1.0);
        this.markAnimationTokens = new Array(total).fill(0);
        this.introScales = new Array(total).fill(0);
        this.squareShakeOffsets = new Array(total).fill(0);
        this.cowHaloProgress = new Array(total).fill(0);
        this.cowIdleTweensStarted = new Array(total).fill(false);
        this.cowSpawnedOnce = new Array(total).fill(false);
        this.cowIdleTokens = new Array(total).fill(0);
        this.cowRevealTokens = new Array(total).fill(0);
        this.cowRevealVisualScales = new Array(total).fill(1);
        this.cowRevealVisualOffsets = new Array(total).fill(0);
        this.cowFoundActionActive = new Array(total).fill(false);
        this.cowIdleColorActionActive = new Array(total).fill(false);
        this.cowExpressionLocks = new Array(total).fill(0);
        this.cowIdleActionSteps = new Array(total).fill(0);
        this.cowMenuDanceFrameIndex = 0;
        this.cowMenuDanceElapsed = 0;
        this.balloonCellBasePositions = new Array(total).fill(null);
        this.balloonCellBaseSizes = new Array(total).fill(0);
        this.foundBalloonBackdropScales = new Array(total).fill(1);
        this.balloonCowBasePositions = new Array(total).fill(null);
        this.balloonCowBaseSizes = new Array(total).fill(0);
        this.jellyMotionTokens = new Array(total).fill(0);
        this.jellyInteractionActive = new Array(total).fill(false);
        this.jellyScaleX = new Array(total).fill(1);
        this.jellyScaleY = new Array(total).fill(1);
        this.jellyOffsetY = new Array(total).fill(0);
        this.jellyAngle = new Array(total).fill(0);
        this.jellyRippleProgress = new Array(total).fill(0);
        this.jellyRippleAlpha = new Array(total).fill(0);
        this.jellyErrorFlash = new Array(total).fill(0);
        this.syncProgressLabels();
        this.updateRemainingLabel();
        this.resetHearts();
        this.prepareLevelWorkplaceTheme();
        this.playRuleBoxIntro();
        this.playGridIntroAnimation();
        // Found cows now use the unified main-menu dance sprite, so color-specific
        // found/idle sequences stay available but are not preloaded or played.

        // Guide mode keeps the normal gameplay scene visible, then layers hints on top.
        if (this._isGuideMode) {
            this.buildGuideWhiteBackground?.();
            this.setGameUIVisible(true);
            this.setGuideGameplayChromeVisible?.(false);
            this.buildGuideWhiteBackground?.();
            if (this.debugPanelNode) {
                this.debugPanelNode.active = false;
            }
            this.scheduleOnce(() => {
                this.showGuide(this.guideStep);
            }, 0.9);
        }
        if (!this._isGuideMode) {
            this.scheduleSceneHintGuidePrompt?.(8);
        }
        PerfDebug.mark('DrawGrid.finishInitGrid end', { totalCells: total });
    },
    resetHearts: function () {
        if (GameApp.gameMode === GameMode.survival) {
            if (this.heartContainer) this.heartContainer.active = false;
            return;
        }
        if (this.heartContainer) {
            this.heartContainer.active = true;
            const hearts = this.heartContainer.children;
            for (let i = 0; i < hearts.length; i++) {
                hearts[i].active = true;
                hearts[i].setScale(v3(1, 1, 1));
                this.ensureHeartVisual?.(hearts[i]);
            }
        }
    },
    ensureHeartVisual: function (heartNode: Node): void {
        const sprite = heartNode.getComponent(Sprite);
        if (!sprite || !sprite.spriteFrame) {
            throw new Error(`[DrawGrid] heart sprite missing: ${heartNode.name}`);
        }
        sprite.enabled = true;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        heartNode.getComponent(CcUITransform)?.setContentSize(42, 39);
        heartNode.getComponent(Graphics)?.clear();
    },
    });
}
