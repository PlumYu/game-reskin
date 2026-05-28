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
import { pickSurvivalLevel } from '../Game/SurvivalConfig';
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
export function installDrawGridInputFlow(target: any): void {
    Object.assign(target.prototype, {
    resetSwipeTracking: function (): void {
        this.isSwiping = false;
        this.swipeTargetState = false;
        this.swipeStartIndex = -1;
        this.processedInCurrentSwipe?.clear?.();
    },
    getSquareIndexAt: function (touchPos: { x: number, y: number }, allowNearest: boolean = false): number {
        const uiTransform = this.getComponent(CcUITransform);
        if (!uiTransform) return -1;

        const localPos = uiTransform.convertToNodeSpaceAR(v3(touchPos.x, touchPos.y, 0));

        const layout = this.getGridLayoutMetrics();
        const gridSize = layout.gridSize;
        const totalContentSize = layout.totalContentSize;
        const startX = layout.startX;
        const startY = layout.startY;
        const pitch = layout.pitch;
        const halfGap = layout.gridGap * 0.5;
        const visualScale = typeof this.getBalloonCellVisualScale === 'function'
            ? this.getBalloonCellVisualScale(gridSize)
            : 1;
        const visualOverflow = Math.max(0, (layout.squareSize * visualScale - layout.squareSize) * 0.5);
        const baseHitMargin = Math.max(halfGap, visualOverflow + 8);
        const hitMargin = allowNearest
            ? Math.max(baseHitMargin, layout.squareSize * 0.72)
            : baseHitMargin;
        const hitMinX = startX - hitMargin;
        const hitMinY = startY - hitMargin;
        const hitMaxX = startX + totalContentSize + hitMargin;
        const hitMaxY = startY + totalContentSize + hitMargin;

        if (localPos.x < hitMinX || localPos.x > hitMaxX || localPos.y < hitMinY || localPos.y > hitMaxY) {
            return -1;
        }

        const col = Math.min(gridSize - 1, Math.max(0, Math.round((localPos.x - (startX + layout.squareSize * 0.5)) / pitch)));
        const row = Math.min(gridSize - 1, Math.max(0, Math.round((localPos.y - (startY + layout.squareSize * 0.5)) / pitch)));
        return row * gridSize + col;
    },
    onTouchStart: function (event: EventTouch) {
        const touchStartedAt = PerfDebug.now();
        const uiLocation = event.getUILocation();
        const finishTouchDiag = (outcome: string, data?: Record<string, unknown>): void => {
            PerfDebug.mark('input touchStart end', {
                outcome,
                costMs: PerfDebug.now() - touchStartedAt,
                isStartGame: GameApp.isStartGame,
                isGameOver: this.isGameOver,
                cowCompletionCelebrationActive: this.cowCompletionCelebrationActive,
                isSwiping: this.isSwiping,
                guideMode: this._isGuideMode,
                swipeGuideMode: this._isSwipeGuideMode,
                guideStep: this.guideStep,
                ...(data || {}),
            });
        };
        PerfDebug.mark('input touchStart begin', {
            x: Math.round(uiLocation.x),
            y: Math.round(uiLocation.y),
            isStartGame: GameApp.isStartGame,
            isGameOver: this.isGameOver,
            cowCompletionCelebrationActive: this.cowCompletionCelebrationActive,
            guideMode: this._isGuideMode,
            swipeGuideMode: this._isSwipeGuideMode,
            guideStep: this.guideStep,
        });
        // Unlock audio on first user touch in mini-game runtimes.
        const unlockStartedAt = PerfDebug.now();
        SfxManager.instance.unlock();
        PerfDebug.slow('input Sfx.unlock', unlockStartedAt, 16);

        if (!GameApp.isStartGame || this.isGameOver || this.cowCompletionCelebrationActive) {
            this.resetSwipeTracking();
            finishTouchDiag('blocked-state');
            return;
        }
        this.handleSceneHintGuideInteraction?.(8);
        const hitStartedAt = PerfDebug.now();
        const index = this.getSquareIndexAt(uiLocation);
        PerfDebug.slow('input hitTest', hitStartedAt, 8, { index });
        if (index === -1) {
            this.resetSwipeTracking();
            finishTouchDiag('miss-hit', {
                x: Math.round(uiLocation.x),
                y: Math.round(uiLocation.y),
            });
            return;
        }
        if (index !== -1) {
            const guideAction = this._isGuideMode && typeof this.getGuideActionMode === 'function' ? this.getGuideActionMode() : 'free';
            if (this._isGuideMode && typeof this.isGuideCellAllowed === 'function' && !this.isGuideCellAllowed(index)) {
                this.resetSwipeTracking();
                finishTouchDiag('blocked-guide-cell', { index, guideAction });
                return;
            }
            if (this._isSwipeGuideMode && this.guideIndex.indexOf(index) === -1) {
                this.resetSwipeTracking();
                finishTouchDiag('blocked-swipe-guide-cell', { index });
                return;
            }
            const now = Date.now();
            const isGuideRevealTap = this._isGuideMode && guideAction === 'reveal';
            const isGuideSettlement = GameApp.isGuideSettlement === true;
            const doubleTapThreshold = (isGuideRevealTap || isGuideSettlement)
                ? (this.GUIDE_DOUBLE_TAP_THRESHOLD || this.DOUBLE_TAP_THRESHOLD)
                : this.DOUBLE_TAP_THRESHOLD;

            // 检查是否是双击（同一格子，在当前场景允许的连点窗口内）
            if (index === this.lastTapIndex && (now - this.lastTapTime) < doubleTapThreshold) {
                if ((this._isGuideMode && guideAction === 'mark') || this._isSwipeGuideMode) {
                    finishTouchDiag('blocked-double-tap-mark-mode', { index, guideAction });
                    return;
                }
                // 双击翻开 - 取消待确认的单击音效
                if (this.pendingSingleTapTimeout) {
                    clearTimeout(this.pendingSingleTapTimeout);
                    this.pendingSingleTapTimeout = 0;
                    this.pendingSingleTapIndex = -1;
                }
                this.revealSquare(index);
                if (this._isGuideMode && typeof this.onGuideReveal === 'function') {
                    this.onGuideReveal(index);
                }
                this.resetSwipeTracking();
                finishTouchDiag('double-tap-reveal', { index, guideAction });
            } else {
                if (isGuideRevealTap) {
                    const pressStartedAt = PerfDebug.now();
                    this.playJellyPressFeedback(index, 'press');
                    PerfDebug.slow('input jelly press trigger', pressStartedAt, 16, { index, reason: 'guide-reveal-first-tap' });
                    this.lastTapTime = now;
                    this.lastTapIndex = index;
                    this.resetSwipeTracking();
                    finishTouchDiag('guide-reveal-first-tap', { index, guideAction });
                    return;
                }
                // 单击 - 延迟确认，不立即播放音效
                this.isSwiping = true;
                this.processedInCurrentSwipe.clear();
                this.swipeStartIndex = index;
                this.swipeTargetState = !this.clickedSquares[index];
                const fastOperation = this.noteMarkOperation();
                const updateStartedAt = PerfDebug.now();
                const changed = this.updateSquare(index, this.swipeTargetState, fastOperation, fastOperation) !== false;
                PerfDebug.slow('input updateSquare call', updateStartedAt, 16, { index, changed, fastOperation });

                // 设置延迟任务，播放单击音效（如果没有双击）
                if (this.pendingSingleTapTimeout) {
                    clearTimeout(this.pendingSingleTapTimeout);
                    this.pendingSingleTapTimeout = 0;
                    this.pendingSingleTapIndex = -1;
                }
                this.pendingSingleTapIndex = index;
                if (!fastOperation && changed) {
                    this.pendingSingleTapTimeout = setTimeout(() => {
                        if (this.pendingSingleTapIndex === index) {
                            // 延迟确认，播放单击音效+震动
                            this.playMarkFeedback(index, this.clickedSquares[index], true);
                        }
                        this.pendingSingleTapIndex = -1;
                        this.pendingSingleTapTimeout = 0;
                    }, this.SINGLE_TAP_SOUND_DELAY);
                } else {
                    this.pendingSingleTapIndex = -1;
                }

                this.processedInCurrentSwipe.add(index);
                if (this._isGuideMode && typeof this.onGuideMark === 'function') {
                    this.onGuideMark(index);
                }
                if (this._isSwipeGuideMode && typeof this.onSwipeGuideMark === 'function') {
                    this.onSwipeGuideMark(index);
                }
                finishTouchDiag('single-tap-mark', {
                    index,
                    changed,
                    fastOperation,
                    swipeTargetState: this.swipeTargetState,
                });
            }
            this.lastTapTime = now;
            this.lastTapIndex = index;
        }
    },
    onTouchMove: function (event: EventTouch) {
        if (!GameApp.isStartGame || !this.isSwiping) {
            PerfDebug.mark('input touchMove ignored', {
                isStartGame: GameApp.isStartGame,
                isSwiping: this.isSwiping,
            });
            return;
        }
        if (this._isGuideMode && typeof this.getGuideActionMode === 'function' && this.getGuideActionMode() !== 'mark') {
            PerfDebug.mark('input touchMove ignored', {
                reason: 'guide-not-mark',
                guideStep: this.guideStep,
                guideAction: this.getGuideActionMode(),
            });
            return;
        }
        const moveStartedAt = PerfDebug.now();
        const location = event.getUILocation();
        const index = this.getSquareIndexAt(location, true);
        if (index !== -1 && !this.processedInCurrentSwipe.has(index)) {
            if (this._isGuideMode && typeof this.isGuideCellAllowed === 'function' && !this.isGuideCellAllowed(index)) {
                PerfDebug.mark('input touchMove blocked', { reason: 'guide-cell', index, guideStep: this.guideStep });
                return;
            }
            if (this._isSwipeGuideMode && this.guideIndex.indexOf(index) === -1) {
                PerfDebug.mark('input touchMove blocked', { reason: 'swipe-guide-cell', index, guideStep: this.guideStep });
                return;
            }
            this.noteMarkOperation();
            this.updateSquare(index, this.swipeTargetState, true, true, true);
            this.processedInCurrentSwipe.add(index);
            if (this._isGuideMode && typeof this.onGuideMark === 'function') {
                this.onGuideMark(index);
            }
            if (this._isSwipeGuideMode && typeof this.onSwipeGuideMark === 'function') {
                this.onSwipeGuideMark(index);
            }
            PerfDebug.mark('input touchMove processed', {
                index,
                costMs: PerfDebug.now() - moveStartedAt,
                swipeTargetState: this.swipeTargetState,
            });
        } else if (index === -1) {
            PerfDebug.mark('input touchMove miss-hit', {
                x: Math.round(location.x),
                y: Math.round(location.y),
            });
        }
    },
    onTouchEnd: function () {
        this.resetSwipeTracking();
    },
    bumpMarkAnimationToken: function (index: number): number {
        if (!this.markAnimationTokens) {
            this.markAnimationTokens = [];
        }
        const nextToken = (this.markAnimationTokens[index] || 0) + 1;
        this.markAnimationTokens[index] = nextToken;
        return nextToken;
    },
    isCurrentMarkAnimation: function (index: number, token: number): boolean {
        return !!this.markAnimationTokens && this.markAnimationTokens[index] === token;
    },
    syncMarkVisualState: function (index: number): void {
        this.squareScales[index] = 1;
        if (!this.revealedSquares[index]) {
            this.xAnimationProgress[index] = this.clickedSquares[index] ? 1 : 0;
        } else if (this.cowPositions[index]) {
            this.xAnimationProgress[index] = 0;
        }
        this.refreshMarkVisualAt(index);
    },
    refreshMarkVisualAt: function (index: number): void {
        if (this.updateBalloonMarkVisualIndex?.(index) === true) return;
        this.requestRender();
    },
    noteMarkOperation: function (): boolean {
        const now = Date.now();
        const fast = now - (this.lastMarkOperationTime || 0) < this.FAST_MARK_OPERATION_MS || this.activeMarkAnimations > 0;
        this.lastMarkOperationTime = now;
        return fast;
    },
    playMarkFeedback: function (index: number, state: boolean, forceToast: boolean = false, bypassThrottle: boolean = false, lightVibrate: boolean = false): void {
        const now = Date.now();
        const canPlayFeedback = bypassThrottle || now - (this.lastMarkFeedbackTime || 0) >= this.MARK_FEEDBACK_THROTTLE_MS;
        if (canPlayFeedback) {
            if (state) {
                SfxManager.instance.playMark();
                SfxManager.instance.vibrateShort(40);
            } else {
                SfxManager.instance.playUnmark();
                SfxManager.instance.vibrateShort(15);
            }
            this.lastMarkFeedbackTime = now;
        }
        if (forceToast) {
            this.showCellWorkplaceFeedback(
                state ? '先排除' : '再看看',
                index,
                state ? new Color(120, 220, 255, 255) : new Color(255, 238, 92, 255),
                true
            );
        }
    },
    updateSquare: function (index: number, state: boolean, playSound: boolean = true, fastOperation: boolean = false, immediateFeedback: boolean = false) {
        const updateStartedAt = PerfDebug.now();
        PerfDebug.mark('input updateSquare begin', {
            index,
            state,
            playSound,
            fastOperation,
            immediateFeedback,
            revealed: this.revealedSquares[index],
            currentState: this.clickedSquares[index],
        });
        const isRevealed = this.revealedSquares[index];
        const stateChanged = this.clickedSquares[index] !== state;

        // 如果状态没变且不是永久格子，则返回（避免滑动过程中同个格子的重复动画）
        if (!isRevealed && !stateChanged) {
            const expectedProgress = state ? 1 : 0;
            const progress = Number(this.xAnimationProgress[index]) || 0;
            const scale = Number(this.squareScales[index]) || 1;
            if (Math.abs(progress - expectedProgress) > 0.01 || Math.abs(scale - 1) > 0.01) {
                this.bumpMarkAnimationToken(index);
                this.syncMarkVisualState(index);
                PerfDebug.mark('input updateSquare end', { index, result: 'sync-only', costMs: PerfDebug.now() - updateStartedAt });
                return true;
            }
            PerfDebug.mark('input updateSquare end', { index, result: 'unchanged', costMs: PerfDebug.now() - updateStartedAt });
            return false;
        }

        const animationToken = this.bumpMarkAnimationToken(index);

        if (!isRevealed) {
            this.clickedSquares[index] = state;
            // Play sound effect and vibrate when state changes
            if (stateChanged && playSound) {
                this.playMarkFeedback(index, state, !fastOperation, immediateFeedback, immediateFeedback);
            }
        }

        if (stateChanged) {
            this.playJellyPressFeedback(index, state ? 'mark' : 'unmark');
        }
        this.playMarkXTransition(index, state, animationToken, fastOperation);
        PerfDebug.mark('input updateSquare end', {
            index,
            result: 'changed',
            stateChanged,
            costMs: PerfDebug.now() - updateStartedAt,
        });
        return true;
    },
    playMarkXTransition: function (index: number, state: boolean, animationToken: number, fastOperation: boolean = false): void {
        if (this.revealedSquares[index]) {
            this.syncMarkVisualState(index);
            return;
        }
        PerfDebug.count(state ? 'markTransition.add' : 'markTransition.remove');
        if (fastOperation) {
            PerfDebug.count('markTransition.fastStart');
        } else {
            PerfDebug.mark('animation mark transition start', {
                index,
                state,
                fastOperation,
                activeMarkAnimations: this.activeMarkAnimations || 0,
            });
        }

        const current = Number(this.xAnimationProgress[index]);
        const startProgress = Number.isFinite(current)
            ? Math.max(0, Math.min(1.08, current))
            : (state ? 0 : 1);
        const animState = { progress: startProgress };

        this.squareScales[index] = 1;
        if (fastOperation) {
            this.xAnimationProgress[index] = state ? 1 : 0;
            PerfDebug.count('markTransition.snapFast');
            this.refreshMarkVisualAt(index);
            PerfDebug.mark('animation mark transition fast', { index, state });
            return;
        }
        this.activeMarkAnimations++;

        const applyProgress = () => {
            if (!this.isCurrentMarkAnimation(index, animationToken)) return false;
            this.squareScales[index] = 1;
            this.xAnimationProgress[index] = Math.max(0, Math.min(1.08, animState.progress));
            this.refreshMarkVisualAt(index);
            return true;
        };

        const settle = () => {
            this.activeMarkAnimations = Math.max(0, (this.activeMarkAnimations || 1) - 1);
            if (!this.isCurrentMarkAnimation(index, animationToken)) return;
            this.squareScales[index] = 1;
            this.xAnimationProgress[index] = state ? 1 : 0;
            this.refreshMarkVisualAt(index);
            PerfDebug.mark('animation mark transition end', {
                index,
                state,
                activeMarkAnimations: this.activeMarkAnimations || 0,
            });
        };

        if (state) {
            tween(animState)
                .to(fastOperation ? 0.08 : 0.1, { progress: 1.08 }, {
                    easing: 'quadOut',
                    onUpdate: applyProgress
                })
                .to(fastOperation ? 0.03 : 0.04, { progress: 1 }, {
                    easing: 'quadInOut',
                    onUpdate: applyProgress
                })
                .call(settle)
                .start();
        } else {
            tween(animState)
                .to(fastOperation ? 0.07 : 0.09, { progress: 0 }, {
                    easing: 'quadIn',
                    onUpdate: applyProgress
                })
                .call(settle)
                .start();
        }
    },
    revealSquare: function (index: number) {
        const revealStartedAt = PerfDebug.now();
        PerfDebug.mark('input revealSquare begin', {
            index,
            revealed: this.revealedSquares[index],
            isGameOver: this.isGameOver,
            cowCompletionCelebrationActive: this.cowCompletionCelebrationActive,
            isCow: this.cowPositions[index],
        });
        if (this.revealedSquares[index] || this.isGameOver || this.cowCompletionCelebrationActive) {
            PerfDebug.mark('input revealSquare end', {
                index,
                result: 'blocked',
                costMs: PerfDebug.now() - revealStartedAt,
            });
            return;
        }
        if (GameApp.isGuideSettlement === true && !this.cowPositions[index]) {
            this.updateSquare(index, true, true, false, true);
            PerfDebug.mark('input revealSquare end', {
                index,
                result: 'guide-settlement-mark',
                costMs: PerfDebug.now() - revealStartedAt,
            });
            return;
        }
        const revealToken = this.bumpMarkAnimationToken(index);
        this.revealedSquares[index] = true;

        // 如果该格点有白色标记 X，则清除
        this.clickedSquares[index] = false;
        this.xAnimationProgress[index] = 0;

        if (this.cowPositions[index]) {
            // 缺席目标出现动画
            this.cowsFound++;
            const remainingAfterReveal = Math.max(0, this.totalCows - this.cowsFound);
            this.updateRemainingLabel();
            if (!this.hasBalloonNormalFrame(index)) {
                SfxManager.instance.playRevealCow();
            }
            SfxManager.instance.vibrateRevealCell();
            this.playJellyPressFeedback(index, 'success');
            const successText = remainingAfterReveal === 0
                ? '最后一个也点到了'
                : remainingAfterReveal === 1
                    ? '就差最后一格'
                    : '锁定一个';
            this.showCellWorkplaceFeedback(successText, index, new Color(255, 238, 92, 255), true);

            // 生存模式时间奖励要立即生效，避免等目标出现动画结束才跳时间。
            if (GameApp.gameMode === GameMode.survival) {
                const cdc = GameApp.countDownControl as CountdownController | null;
                if (cdc) {
                    const rewardSeconds = this.cowsFound >= this.totalCows ? 15 : 5;
                    cdc.addTime(rewardSeconds);
                    this.showTimeToast(`+${rewardSeconds}秒`, true, true);
                }
            }

            if (remainingAfterReveal === 0) {
                const foundCowIndices = this.cowPositions
                    .map((isCow: boolean, cowIndex: number) => isCow && this.revealedSquares[cowIndex] ? cowIndex : -1)
                    .filter((cowIndex: number) => cowIndex >= 0);
                this.cowCompletionCelebrationActive = true;
                this.playCowCompletionCelebration(foundCowIndices, index, () => {
                    this.cowCompletionCelebrationActive = false;
                    this.checkGameStatus();
                });
            } else {
                this.playCowRevealAnimation(index, () => {
                    this.checkGameStatus();
                });
            }
        } else {
            // guide mode: no penalty on wrong reveal (defensive)
            if (this._isGuideMode) {
                this.requestRender();
                PerfDebug.mark('input revealSquare end', {
                    index,
                    result: 'guide-wrong-reveal-ignored',
                    costMs: PerfDebug.now() - revealStartedAt,
                });
                return;
            }

            // 非目标显示红 X
            SfxManager.instance.playRevealFail();
            SfxManager.instance.vibrateRevealCell();
            this.playJellyPressFeedback(index, 'mistake');
            this.playMistakeFeedback(index);
            this.playRuleViolationFeedback?.(index);
            let mistakeText = '这步点错了';

            if (GameApp.gameMode === GameMode.survival) {
                // 生存模式：时间惩罚，不扣爱心
                const cdc = GameApp.countDownControl as CountdownController | null;
                if (cdc) {
                    cdc.subtractTime(10);
                    this.showTimeToast('-10秒', false, true);
                }
                mistakeText = '这步点错了，时间 -10 秒';
            } else {
                // 闯关模式：扣除爱心
                this.mistakeCount++;
                const patienceLeft = Math.max(0, 3 - this.mistakeCount);
                mistakeText = patienceLeft <= 0
                    ? '这关没过'
                    : patienceLeft === 1
                        ? '这步点错了，只剩1次'
                        : '这步点错了，还能再试';
                if (this.heartContainer) {
                    const hearts = this.heartContainer.children;
                    const heartIdx = 3 - this.mistakeCount;
                    if (hearts[heartIdx]) {
                        this.playHeartBreakEffect(hearts[heartIdx]);
                        tween(hearts[heartIdx])
                            .to(0.12, { scale: v3(1.25, 1.25, 1) }, { easing: 'quadOut' })
                            .to(0.16, { scale: v3(0, 0, 1) }, { easing: 'backIn' })
                            .call(() => {
                                hearts[heartIdx].active = false;
                            })
                            .start();
                    }
                }
            }
            this.showCellWorkplaceFeedback(mistakeText, index, new Color(255, 95, 95, 255), true);
            this.scheduleSceneHintGuidePrompt?.(2);

            const animState = { progress: 0 };
            tween(animState)
                .to(0.2, { progress: 1 }, {
                    onUpdate: (target, ratio) => {
                        if (!this.isCurrentMarkAnimation(index, revealToken)) return;
                        this.xAnimationProgress[index] = ratio!;
                        this.requestRender();
                    }
                })
                .call(() => {
                    if (!this.isCurrentMarkAnimation(index, revealToken)) return;
                    this.checkGameStatus();
                })
                .start();
        }
        this.requestRender();
        PerfDebug.mark('input revealSquare end', {
            index,
            result: this.cowPositions[index] ? 'cow' : 'mistake',
            remainingCows: Math.max(0, this.totalCows - this.cowsFound),
            costMs: PerfDebug.now() - revealStartedAt,
        });
    },
    checkGameStatus: function () {
        if (this.isGameOver) return;
        // guide mode: skip win/lose check
        if (this._isGuideMode) return;

        if (GameApp.gameMode === GameMode.survival) {
            // 生存模式：全部找到 → 进入下一关
            if (this.cowsFound >= this.totalCows) {
                GameApp.passLevel++;
                GameApp.foundCowNum += this.cowsFound;
                this.updateMilestoneBar();

                this.loadSurvivalLevel(() => this.renderGrid());
            }
            // 生存模式：3次错误不触发失败，只有时间惩罚
            return;
        }

        if (GameApp.gameMode === GameMode.daily_challenge) {
            if (this.cowsFound >= this.totalCows) {
                // daily_challenge win
                this.isGameOver = true;
                GameApp.dailyChallengeIsWin = true;
                GameApp.foundCowNum = this.cowsFound;
                SfxManager.instance.playLevelWin();
                this.dailyChallengeOver();
            } else if (this.mistakeCount >= 3) {
                // daily_challenge fail by hearts
                this.isGameOver = true;
                GameApp.dailyChallengeIsWin = false;
                GameApp.foundCowNum = this.cowsFound;
                SfxManager.instance.playLevelFail();
                this.dailyChallengeOver();
            }
            return;
        }

        // 闯关模式
        if (this.cowsFound >= this.totalCows) {
            this.isGameOver = true;
            SfxManager.instance.playLevelWin();
            const isGuideSettlement = GameApp.isGuideSettlement === true;
            const rewardCoins = isGuideSettlement ? 0 : 4;

            if (isGuideSettlement) {
                this.setHintPanelShown?.(false);
                this.clearHintVisuals?.();
                this.clearGuideOverlay?.(true);
                GameApp.user.level = 1;
                GameApp.passLevel = 0;
                GameApp.user.save();
            } else {
                const hiddenChallengeResult = this.getHiddenChallengeResultText();
                this.totalCoins += rewardCoins;
                this.currentLevel++;
                GameApp.passLevel = this.currentLevel - 1;
                this.saveGameData();
                this.syncProgressLabels();
                if (hiddenChallengeResult) {
                    this.showWorkplaceToast(hiddenChallengeResult, v3(0, 190, 0), new Color(255, 238, 92, 255));
                }
            }

            GameApp.winRewardCoins = rewardCoins;
            GameApp.uiManager?.open(UIID.WinPanel);
        }
        else if (this.mistakeCount >= 3) {
            this.isGameOver = true;
            SfxManager.instance.playLevelFail(); // 失败音效
            GameApp.foundCowNum = this.cowsFound;
            GameApp.uiManager?.open(UIID.FailPanel);
        }
    },
    createCelebrationLabel: function (text: string, fontSize: number, color: Color): Node {
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
    },
    createCelebrationButton: function (name: string, text: string, width: number, height: number, color: Color, fontSize = 28, bold = false): Node {
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
    },
    drawCelebrationButtonBlock: function (g: Graphics, x: number, y: number, width: number, height: number, color: Color) {
        const radius = height * 0.42;
        g.fillColor = new Color(0, 0, 0, 56);
        g.roundRect(x - width / 2, y - height / 2 - 6, width, height, radius);
        g.fill();

        g.fillColor = color;
        g.roundRect(x - width / 2, y - height / 2, width, height, radius);
        g.fill();

        g.strokeColor = new Color(255, 255, 255, 92);
        g.lineWidth = 3;
        g.roundRect(x - width / 2 + 5, y - height / 2 + 5, width - 10, height - 13, Math.max(8, radius - 5));
        g.stroke();

        g.fillColor = new Color(255, 255, 255, 34);
        g.roundRect(x - width / 2 + 12, y + height * 0.1, width - 24, height * 0.18, height * 0.09);
        g.fill();
    },
    showResult: function (sf: SpriteFrame, callback: Function) {
        if (!sf) {
            console.error('Result sprite is not configured.');
            callback();
            return;
        }

        if (!this.resultNode) {
            this.resultNode = new Node('ResultUI');
            this.resultNode.addComponent(CcUITransform);
            this.resultNode.addComponent(Sprite);
            this.resultNode.on(Input.EventType.TOUCH_START, (event: any) => {
                event.propagationStopped = true;
                this.resultNode!.active = false;
                callback();
            }, this);
        }

        this.node.addChild(this.resultNode);
        this.resultNode.setSiblingIndex(100);

        const sprite = this.resultNode.getComponent(Sprite)!;
        sprite.spriteFrame = sf;
        sprite.sizeMode = Sprite.SizeMode.RAW;
        sprite.trim = false;

        this.resultNode.active = true;
        this.resultNode.setPosition(0, 0);
        this.resultNode.setScale(v3(0, 0, 1));

        tween(this.resultNode)
            .to(0.5, { scale: v3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    },
    });
}
