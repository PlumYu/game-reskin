import { Graphics, Color, Vec3, v3, input, Input, EventTouch, tween, SpriteFrame, Node, Sprite, UITransform as CcUITransform, Label, EditBox, director, Layers, Texture2D, UIOpacity, view, Button, Widget } from 'cc';
import GameApp from '../Core/GameApp';
import { GameMode, UIID } from '../Core/Enum';
import UIManager from '../Core/UIManager';
import CountdownController from '../Core/CountdownController';
import SfxManager from '../Core/SfxManager';
import TiliManager from '../Core/TiliManager';
import AssetService from '../Core/AssetService';
import { createLabel, createNode, createFullScreenOverlay, createCircle, addButtonFeedback, createRoundedCard, COLOR_GOLD, COLOR_WHITE, COLOR_TOOLBAR_BG, RADIUS_MD, getScreenSize } from '../Utils/UIBuilder';
import { drawBalloonVisual, getBalloonVisualSize } from '../Visual/BalloonVisual';
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
export function installDrawGridFeedback(target: any): void {
    Object.assign(target.prototype, {
    prepareLevelWorkplaceTheme: function () {
        const version = ++this.workplaceThemeVersion;
        this.levelStartTime = Date.now();
        this.hintUsedThisLevel = false;
        const challenge = this.getHiddenChallenge(this.currentLevel);
        this.currentHiddenChallengeKey = challenge.key;
        this.currentHiddenChallengeText = challenge.text;

        if (GameApp.gameMode !== GameMode.survival && GameApp.isStartGame) {
            this.scheduleOnce(() => {
                if (version === this.workplaceThemeVersion && GameApp.isStartGame && !this.isGameOver) {
                    this.showWorkplaceToast(
                        `这关提醒：${this.currentHiddenChallengeText}`,
                        v3(0, 365, 0),
                        new Color(255, 238, 92, 255),
                        0
                    );
                }
            }, 0.55);
        }
    },
    getOfficeEventTitle: function (level: number): string {
        const index = Math.max(0, level - 1) % this.officeEventTitles.length;
        return this.officeEventTitles[index];
    },
    getHiddenChallenge: function (level: number): HiddenChallengeConfig {
        const index = Math.max(0, level - 1) % this.hiddenChallenges.length;
        return this.hiddenChallenges[index];
    },
    getHiddenChallengeResultText: function (): string {
        const elapsedSeconds = (Date.now() - this.levelStartTime) / 1000;
        const markedCount = this.clickedSquares.filter(Boolean).length;
        let completed = false;

        switch (this.currentHiddenChallengeKey) {
            case 'noMistake':
            case 'firstTry':
                completed = this.mistakeCount === 0;
                break;
            case 'noHint':
                completed = !this.hintUsedThisLevel;
                break;
            case 'fastClear':
                completed = elapsedSeconds <= 30;
                break;
            case 'markFive':
                completed = markedCount >= 5;
                break;
            case 'steadyFinish':
                completed = this.mistakeCount === 0 || elapsedSeconds <= 45;
                break;
            default:
                completed = false;
        }

        return completed ? `这关打得很顺：${this.currentHiddenChallengeText}` : '';
    },
    getLevelDisplayText: function (): string {
        if (GameApp.gameMode === GameMode.daily_challenge) {
            const today = GameApp.user.getTodayDateString();
            const month = parseInt(today.substring(4, 6), 10) || (new Date().getMonth() + 1);
            const day = parseInt(today.substring(6, 8), 10) || new Date().getDate();
            return `每日挑战·${month}月${day}号`;
        }
        if (GameApp.gameMode === GameMode.survival) return '生存模式';
        return `第 ${this.currentLevel} 关`;
    },
    getGridCellCenter: function (index: number): Vec3 {
        const layout = this.getGridLayoutMetrics();
        const gridSize = layout.gridSize;
        const squareSize = layout.squareSize;
        const gridGap = layout.gridGap;
        const startX = layout.startX;
        const startY = layout.startY;
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        return v3(
            startX + col * (squareSize + gridGap) + squareSize / 2,
            startY + row * (squareSize + gridGap) + squareSize / 2,
            0
        );
    },
    showCellWorkplaceFeedback: function (text: string, index: number, color: Color, force: boolean = false) {
        return;
    },
    showWorkplaceToast: function (text: string, position: Vec3, textColor: Color, delay: number = 0) {
        return;
        if (!this.node || !this.node.isValid) return;

        const toast = new Node('WorkplaceToast');
        this.setUILayer(toast);
        toast.parent = this.node;
        toast.setPosition(position);
        toast.setScale(v3(0.9, 0.9, 1));
        toast.setSiblingIndex(440);

        const width = Math.min(620, Math.max(190, Array.from(text).length * 28 + 44));
        const height = 54;
        toast.addComponent(CcUITransform).setContentSize(width, height);

        const opacity = toast.addComponent(UIOpacity);
        opacity.opacity = 0;

        const bg = toast.addComponent(Graphics);
        bg.fillColor = new Color(18, 24, 38, 218);
        bg.roundRect(-width / 2, -height / 2, width, height, 20);
        bg.fill();
        bg.strokeColor = new Color(255, 255, 255, 42);
        bg.lineWidth = 2;
        bg.roundRect(-width / 2, -height / 2, width, height, 20);
        bg.stroke();

        const labelNode = new Node('WorkplaceToastLabel');
        this.setUILayer(labelNode);
        labelNode.parent = toast;
        labelNode.addComponent(CcUITransform).setContentSize(width - 24, height);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 26;
        label.lineHeight = 32;
        label.isBold = true;
        label.color = textColor;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        tween(toast)
            .delay(delay)
            .to(0.12, { scale: v3(1.06, 1.06, 1) }, { easing: 'backOut' })
            .to(0.08, { scale: v3(1, 1, 1) }, { easing: 'quadOut' })
            .delay(0.62)
            .to(0.22, { position: v3(position.x, position.y + 36, position.z) }, { easing: 'quadIn' })
            .start();

        tween(opacity)
            .delay(delay)
            .to(0.1, { opacity: 255 }, { easing: 'quadOut' })
            .delay(0.72)
            .to(0.22, { opacity: 0 }, { easing: 'quadIn' })
            .call(() => toast.destroy())
            .start();
    },
    playGridIntroAnimation: function () {
        const n = this.gridSize;
        const total = n * n;
        const version = ++this.gridIntroVersion;
        PerfDebug.mark('animation grid intro start', { gridSize: n, cells: total });
        for (let i = 0; i < total; i++) {
            this.introScales[i] = 1;
        }

        const gridNode = this.node as Node & { __gridIntroBasePosition?: Vec3 };
        if (!gridNode || !gridNode.isValid) return;

        tween(gridNode).stop();
        const opacity = gridNode.getComponent(UIOpacity) || gridNode.addComponent(UIOpacity);
        tween(opacity).stop();

        const currentPosition = gridNode.position.clone();
        const activeBasePosition = gridNode.__gridIntroBasePosition;
        const basePosition = activeBasePosition ? activeBasePosition.clone() : currentPosition;
        gridNode.__gridIntroBasePosition = basePosition.clone();

        gridNode.setPosition(basePosition.x, basePosition.y - 18, basePosition.z);
        gridNode.setScale(v3(0.94, 0.94, 1));
        opacity.opacity = 0;
        this.renderGrid();

        tween(gridNode)
            .to(0.22, {
                position: v3(basePosition.x, basePosition.y, basePosition.z),
                scale: v3(1.035, 1.035, 1)
            }, { easing: 'quadOut' })
            .to(0.12, {
                scale: v3(0.99, 0.99, 1)
            }, { easing: 'quadInOut' })
            .to(0.1, {
                scale: v3(1, 1, 1)
            }, { easing: 'quadOut' })
            .call(() => {
                if (version !== this.gridIntroVersion) return;
                gridNode.setPosition(basePosition.x, basePosition.y, basePosition.z);
                gridNode.setScale(v3(1, 1, 1));
                gridNode.__gridIntroBasePosition = undefined;
                for (let i = 0; i < total; i++) {
                    this.introScales[i] = 1;
                }
                opacity.opacity = 255;
                PerfDebug.mark('animation grid intro end', { gridSize: n, cells: total });
                this.requestRender();
            })
            .start();

        tween(opacity)
            .to(0.2, { opacity: 255 }, { easing: 'quadOut' })
            .start();
    },
    easeOutCubic: function (t: number): number {
        const p = 1 - Math.max(0, Math.min(1, t));
        return 1 - p * p * p;
    },
    easeOutBack: function (t: number, overshoot = 1.70158): number {
        const p = Math.max(0, Math.min(1, t)) - 1;
        return 1 + (overshoot + 1) * p * p * p + overshoot * p * p;
    },
    ensureJellyMotionState: function (index: number): void {
        const total = Math.max(this.gridSize * this.gridSize, index + 1);
        const ensureNumberArray = (key: string, fill: number) => {
            if (!Array.isArray(this[key])) this[key] = [];
            while (this[key].length < total) this[key].push(fill);
        };
        const ensureBoolArray = (key: string, fill: boolean) => {
            if (!Array.isArray(this[key])) this[key] = [];
            while (this[key].length < total) this[key].push(fill);
        };
        ensureNumberArray('jellyMotionTokens', 0);
        ensureBoolArray('jellyInteractionActive', false);
        ensureNumberArray('jellyScaleX', 1);
        ensureNumberArray('jellyScaleY', 1);
        ensureNumberArray('jellyOffsetY', 0);
        ensureNumberArray('jellyAngle', 0);
        ensureNumberArray('jellyRippleProgress', 0);
        ensureNumberArray('jellyRippleAlpha', 0);
        ensureNumberArray('jellyErrorFlash', 0);
    },
    bumpJellyMotionToken: function (index: number): number {
        this.ensureJellyMotionState(index);
        const token = (this.jellyMotionTokens[index] || 0) + 1;
        this.jellyMotionTokens[index] = token;
        return token;
    },
    isCurrentJellyMotion: function (index: number, token: number): boolean {
        return !!this.jellyMotionTokens && this.jellyMotionTokens[index] === token;
    },
    resetJellyMotionState: function (index: number, token: number): void {
        if (!this.isCurrentJellyMotion(index, token)) return;
        this.jellyInteractionActive[index] = false;
        this.jellyScaleX[index] = 1;
        this.jellyScaleY[index] = 1;
        this.jellyOffsetY[index] = 0;
        this.jellyAngle[index] = 0;
        this.jellyRippleProgress[index] = 0;
        this.jellyRippleAlpha[index] = 0;
        this.jellyErrorFlash[index] = 0;
        if (this.applyJellyMotionToBalloonIndex?.(index) !== true) {
            this.requestRender();
        }
    },
    playJellyPressFeedback: function (index: number, kind: string = 'press'): void {
        if (!this.ENABLE_JELLY_MOTION || !this.hasBalloonNormalFrame(index)) return;
        const jellyStartedAt = PerfDebug.now();
        PerfDebug.mark('animation jelly press start', {
            index,
            kind,
            gridSize: this.gridSize,
        });
        this.ensureJellyMotionState(index);

        const token = this.bumpJellyMotionToken(index);
        const state = {
            sx: this.jellyScaleX[index] || 1,
            sy: this.jellyScaleY[index] || 1,
            y: this.jellyOffsetY[index] || 0,
            angle: 0,
            ripple: 0,
            rippleAlpha: 0,
            error: 0,
        };
        this.jellyInteractionActive[index] = true;

        const apply = () => {
            if (!this.isCurrentJellyMotion(index, token)) return false;
            this.jellyInteractionActive[index] = true;
            this.jellyScaleX[index] = state.sx;
            this.jellyScaleY[index] = state.sy;
            this.jellyOffsetY[index] = state.y;
            this.jellyAngle[index] = state.angle;
            this.jellyRippleProgress[index] = state.ripple;
            this.jellyRippleAlpha[index] = state.rippleAlpha;
            this.jellyErrorFlash[index] = state.error;
            if (this.applyJellyMotionToBalloonIndex?.(index) !== true) {
                this.requestRender();
            }
            return true;
        };
        const finish = () => {
            this.resetJellyMotionState(index, token);
            PerfDebug.mark('animation jelly press end', {
                index,
                kind,
                costMs: PerfDebug.now() - jellyStartedAt,
            });
        };

        if (kind === 'mark') {
            tween(state)
                .to(0.07, { sx: 1.07, sy: 0.89, y: -2, ripple: 0.22, rippleAlpha: 0.55 }, { easing: 'quadOut', onUpdate: apply })
                .to(0.1, { sx: 0.965, sy: 1.06, y: 1, ripple: 0.72, rippleAlpha: 0.34 }, { easing: 'backOut', onUpdate: apply })
                .to(0.08, { sx: 1, sy: 1, y: 0, ripple: 1, rippleAlpha: 0 }, { easing: 'quadOut', onUpdate: apply })
                .call(finish)
                .start();
            return;
        }

        if (kind === 'unmark') {
            tween(state)
                .to(0.07, { sx: 0.94, sy: 1.08, y: 1.5, ripple: 0.16, rippleAlpha: 0.48 }, { easing: 'quadOut', onUpdate: apply })
                .to(0.11, { sx: 1.045, sy: 0.975, y: -1, ripple: 0.78, rippleAlpha: 0.2 }, { easing: 'backOut', onUpdate: apply })
                .to(0.09, { sx: 1, sy: 1, y: 0, ripple: 1, rippleAlpha: 0 }, { easing: 'quadOut', onUpdate: apply })
                .call(finish)
                .start();
            return;
        }

        if (kind === 'success') {
            tween(state)
                .to(0.08, { sx: 1.08, sy: 0.88, y: -2, ripple: 0.18, rippleAlpha: 0.72 }, { easing: 'quadOut', onUpdate: apply })
                .to(0.14, { sx: 0.92, sy: 1.13, y: 2, ripple: 0.82, rippleAlpha: 0.32 }, { easing: 'backOut', onUpdate: apply })
                .to(0.12, { sx: 1, sy: 1, y: 0, ripple: 1, rippleAlpha: 0 }, { easing: 'quadOut', onUpdate: apply })
                .call(finish)
                .start();
            return;
        }

        if (kind === 'mistake') {
            tween(state)
                .to(0.04, { sx: 1.035, sy: 0.93, y: -1, angle: -3, error: 0.75 }, { easing: 'quadOut', onUpdate: apply })
                .to(0.05, { sx: 0.98, sy: 1.025, y: 0.5, angle: 3.2, error: 1 }, { easing: 'quadInOut', onUpdate: apply })
                .to(0.05, { sx: 1.018, sy: 0.985, y: 0, angle: -2, error: 0.62 }, { easing: 'quadInOut', onUpdate: apply })
                .to(0.07, { sx: 1, sy: 1, y: 0, angle: 0, error: 0 }, { easing: 'quadOut', onUpdate: apply })
                .call(finish)
                .start();
            return;
        }

        tween(state)
            .to(0.055, { sx: 1.045, sy: 0.93, y: -1.5, ripple: 0.12, rippleAlpha: 0.18 }, { easing: 'quadOut', onUpdate: apply })
            .to(0.11, { sx: 0.972, sy: 1.055, y: 1.2, ripple: 0.46, rippleAlpha: 0.12 }, { easing: 'backOut', onUpdate: apply })
            .to(0.1, { sx: 1, sy: 1, y: 0, ripple: 0.86, rippleAlpha: 0 }, { easing: 'quadOut', onUpdate: apply })
            .call(finish)
            .start();
    },
    playMistakeFeedback: function (index: number) {
        PerfDebug.mark('animation mistake shake start', { index, gridSize: this.gridSize });
        const shakeState = { offset: 0 };
        tween(shakeState)
            .to(0.04, { offset: -9 }, {
                onUpdate: () => {
                    this.squareShakeOffsets[index] = shakeState.offset;
                    this.requestRender();
                }
            })
            .to(0.04, { offset: 8 }, {
                onUpdate: () => {
                    this.squareShakeOffsets[index] = shakeState.offset;
                    this.requestRender();
                }
            })
            .to(0.04, { offset: -5 }, {
                onUpdate: () => {
                    this.squareShakeOffsets[index] = shakeState.offset;
                    this.requestRender();
                }
            })
            .to(0.05, { offset: 0 }, {
                onUpdate: () => {
                    this.squareShakeOffsets[index] = shakeState.offset;
                    this.requestRender();
                }
            })
            .start();
    },
    playBalloonPopBurst: function (index: number) {
        if (!this.hasBalloonNormalFrame(index)) return;
        const shardCount = 6;
        const confettiCount = 8;
        PerfDebug.mark('animation balloon pop start', { index, gridSize: this.gridSize, effectNodes: shardCount + confettiCount + 3 });

        const oldNode = this.balloonPopNodes[index];
        if (oldNode && oldNode.isValid) {
            oldNode.destroy();
        }

        const squareSize = this.getGridLayoutMetrics().squareSize;
        const existingBalloon = this.balloonCellNodes[index];
        const center = existingBalloon && existingBalloon.isValid && existingBalloon.active
            ? v3(existingBalloon.position.x, existingBalloon.position.y, existingBalloon.position.z)
            : this.getGridCellCenter(index);
        const baseSize = this.balloonCellBaseSizes[index] || squareSize;
        const color = this.getBalloonColor(index);

        const root = new Node(`BalloonPop_${index}`);
        this.setUILayer(root);
        root.parent = this.node;
        root.setPosition(center);
        root.setSiblingIndex(30);
        root.addComponent(CcUITransform).setContentSize(squareSize * 1.7, squareSize * 1.7);
        const rootOpacity = root.addComponent(UIOpacity);
        rootOpacity.opacity = 255;
        this.balloonPopNodes[index] = root;

        this.playBalloonPopFlash(root, baseSize);
        this.playBalloonPopConfetti(root, baseSize, color);

        const balloonNode = new Node('BalloonPopSprite');
        this.setUILayer(balloonNode);
        balloonNode.parent = root;
        const balloonTransform = balloonNode.addComponent(CcUITransform);
        const balloonGraphics = balloonNode.addComponent(Graphics);
        const visualSize = baseSize * this.getBalloonCellVisualScale(this.gridSize);
        const fitted = getBalloonVisualSize(visualSize, visualSize);
        balloonTransform.setContentSize(fitted.width, fitted.height);
        drawBalloonVisual(balloonGraphics, fitted.width, fitted.height, color, 'pop');

        tween(balloonNode)
            .to(0.055, { scale: v3(1.16, 1.16, 1) }, { easing: 'quadOut' })
            .to(0.09, { scale: v3(0.12, 0.12, 1), angle: 10 }, { easing: 'quadIn' })
            .start();

        tween(rootOpacity)
            .delay(0.055)
            .to(0.16, { opacity: 0 }, { easing: 'quadOut' })
            .call(() => {
                if (this.balloonPopNodes[index] === root) {
                    this.balloonPopNodes[index] = null;
                }
                if (root.isValid) root.destroy();
            })
            .start();

        for (let i = 0; i < shardCount; i++) {
            const shard = new Node(`BalloonShard_${i}`);
            this.setUILayer(shard);
            shard.parent = root;
            shard.addComponent(CcUITransform).setContentSize(baseSize * 0.28, baseSize * 0.28);
            const opacity = shard.addComponent(UIOpacity);
            opacity.opacity = 230;
            const g = shard.addComponent(Graphics);
            const shardSize = baseSize * (0.08 + (i % 3) * 0.018);
            this.drawBalloonShard(g, shardSize, color, i);

            const angle = -Math.PI * 0.15 + (Math.PI * 1.3 * i) / Math.max(1, shardCount - 1);
            const speed = baseSize * (0.42 + (i % 4) * 0.055);
            const dx = Math.cos(angle) * speed;
            const dy = Math.sin(angle) * speed + baseSize * (0.08 + (i % 2) * 0.06);
            shard.setPosition(0, 0, 0);
            shard.angle = i * 23;
            shard.setScale(v3(0.6, 0.6, 1));

            tween(shard)
                .delay(0.02 + (i % 4) * 0.006)
                .to(0.18, { position: v3(dx, dy, 0), angle: shard.angle + 100 + i * 9, scale: v3(1, 1, 1) }, { easing: 'quadOut' })
                .to(0.12, { position: v3(dx * 1.12, dy - baseSize * 0.18, 0), scale: v3(0.45, 0.45, 1) }, { easing: 'quadIn' })
                .start();
            tween(opacity)
                .delay(0.13)
                .to(0.14, { opacity: 0 }, { easing: 'quadIn' })
                .start();
        }
    },
    playBalloonPopFlash: function (root: Node, baseSize: number): void {
        const flash = new Node('BalloonPopFlash');
        this.setUILayer(flash);
        flash.parent = root;
        flash.addComponent(CcUITransform).setContentSize(baseSize * 2.2, baseSize * 2.2);
        const opacity = flash.addComponent(UIOpacity);
        opacity.opacity = 245;
        const g = flash.addComponent(Graphics);

        g.fillColor = new Color(255, 255, 255, 120);
        g.circle(0, 0, baseSize * 0.42);
        g.fill();
        g.strokeColor = new Color(255, 236, 120, 230);
        g.lineWidth = Math.max(3, baseSize * 0.035);
        g.circle(0, 0, baseSize * 0.46);
        g.stroke();

        const rayCount = 8;
        for (let i = 0; i < rayCount; i++) {
            const angle = (Math.PI * 2 * i) / rayCount;
            const inner = baseSize * 0.18;
            const outer = baseSize * (0.58 + (i % 2) * 0.12);
            g.strokeColor = i % 2 === 0 ? new Color(255, 255, 255, 230) : new Color(255, 214, 84, 230);
            g.lineWidth = Math.max(2, baseSize * 0.018);
            g.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
            g.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
            g.stroke();
        }

        tween(flash)
            .to(0.12, { scale: v3(1.45, 1.45, 1) }, { easing: 'quadOut' })
            .to(0.16, { scale: v3(1.7, 1.7, 1) }, { easing: 'quadIn' })
            .start();
        tween(opacity)
            .to(0.08, { opacity: 255 }, { easing: 'quadOut' })
            .to(0.2, { opacity: 0 }, { easing: 'quadIn' })
            .start();
    },
    playBalloonPopConfetti: function (root: Node, baseSize: number, baseColor: Color): void {
        const colors = [
            new Color(255, 238, 92, 245),
            new Color(255, 132, 92, 245),
            new Color(88, 176, 255, 245),
            new Color(112, 220, 160, 245),
            new Color(255, 255, 255, 245),
            new Color(baseColor.r, baseColor.g, baseColor.b, 245),
        ];

        const confettiCount = 8;
        for (let i = 0; i < confettiCount; i++) {
            const piece = new Node(`PopConfetti_${i}`);
            this.setUILayer(piece);
            piece.parent = root;
            piece.addComponent(CcUITransform).setContentSize(baseSize * 0.2, baseSize * 0.2);
            const opacity = piece.addComponent(UIOpacity);
            opacity.opacity = 255;
            const g = piece.addComponent(Graphics);
            const color = colors[i % colors.length];
            const w = baseSize * (0.07 + (i % 3) * 0.018);
            const h = baseSize * (0.18 + (i % 2) * 0.04);
            g.fillColor = color;
            if (i % 4 === 0) {
                this.drawSparkStar(g, Math.max(5, baseSize * 0.11), color);
            } else {
                g.roundRect(-w / 2, -h / 2, w, h, Math.max(2, w * 0.35));
                g.fill();
                g.fillColor = new Color(255, 255, 255, 82);
                g.roundRect(-w / 2, h * 0.05, w, h * 0.24, Math.max(1, w * 0.25));
                g.fill();
            }

            const angle = -Math.PI * 0.2 + (Math.PI * 1.4 * i) / Math.max(1, confettiCount - 1);
            const distance = baseSize * (0.56 + (i % 5) * 0.09);
            const dx = Math.cos(angle) * distance;
            const dy = Math.sin(angle) * distance + baseSize * (0.12 + (i % 3) * 0.04);
            piece.angle = i * 31;
            piece.setScale(v3(0.3, 0.3, 1));

            tween(piece)
                .delay((i % 5) * 0.01)
                .to(0.16, { position: v3(dx, dy, 0), scale: v3(1.15, 1.15, 1), angle: piece.angle + 120 }, { easing: 'quadOut' })
                .to(0.18, { position: v3(dx * 1.08, dy - baseSize * 0.2, 0), scale: v3(0.62, 0.62, 1), angle: piece.angle + 230 }, { easing: 'quadIn' })
                .start();
            tween(opacity)
                .delay(0.18)
                .to(0.16, { opacity: 0 }, { easing: 'quadIn' })
                .start();
        }
    },
    drawSparkStar: function (g: Graphics, size: number, color: Color): void {
        g.fillColor = color;
        const points = 10;
        for (let i = 0; i < points; i++) {
            const angle = -Math.PI / 2 + (Math.PI * 2 * i) / points;
            const radius = i % 2 === 0 ? size : size * 0.42;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            if (i === 0) {
                g.moveTo(x, y);
            } else {
                g.lineTo(x, y);
            }
        }
        g.close();
        g.fill();
    },
    drawBalloonShard: function (g: Graphics, size: number, color: Color, variant: number) {
        g.clear();
        const alpha = 218;
        const shardColor = new Color(color.r, color.g, color.b, alpha);
        g.fillColor = shardColor;
        if (variant % 3 === 0) {
            g.moveTo(-size * 0.7, -size * 0.35);
            g.lineTo(size * 0.62, -size * 0.48);
            g.lineTo(size * 0.28, size * 0.66);
        } else if (variant % 3 === 1) {
            g.roundRect(-size * 0.62, -size * 0.36, size * 1.24, size * 0.72, size * 0.22);
        } else {
            g.moveTo(0, size * 0.68);
            g.lineTo(size * 0.62, 0);
            g.lineTo(0, -size * 0.68);
            g.lineTo(-size * 0.62, 0);
        }
        g.close();
        g.fill();

        g.fillColor = new Color(255, 255, 255, 122);
        g.circle(-size * 0.22, size * 0.14, Math.max(1, size * 0.16));
        g.fill();
    },
    playCowRevealAnimation: function (index: number, onDone: () => void) {
        const cowNode = this.getCowNode(index);
        const visualNode = this.getCowVisualNode(cowNode, index);
        const hasColorBalloon = this.hasBalloonNormalFrame(index);
        const revealDelay = 0;
        PerfDebug.mark('animation cow reveal start', { index, hasColorBalloon, gridSize: this.gridSize });
        if (hasColorBalloon) {
            this.foundBalloonBackdropScales[index] = 0;
        }
        this.cowSpawnedOnce[index] = true;
        this.cowIdleTweensStarted[index] = false;
        this.cowRevealTokens[index] = this.cowIdleVersion * 100000 + ((this.cowRevealTokens[index] || 0) % 100000) + 1;
        const revealToken = this.cowRevealTokens[index];
        this.cowFoundActionActive[index] = true;
        this.cowRevealVisualScales[index] = 0.08;
        this.cowRevealVisualOffsets[index] = hasColorBalloon ? -28 : 0;

        cowNode.active = true;
        tween(visualNode).stop();
        visualNode.angle = 0;
        visualNode.setPosition(v3(0, 0, 0));
        visualNode.setScale(v3(1, 1, 1));
        const visualSprite = visualNode.getComponent(Sprite);
        if (visualSprite) {
            visualSprite.trim = false;
            visualSprite.spriteFrame = this.getCowRestSpriteFrame(index);
        }

        const popState = { scale: 1.22 };
        tween(popState)
            .to(0.14, { scale: 1.08 }, {
                easing: 'quadOut',
                onUpdate: () => {
                    this.squareScales[index] = popState.scale;
                    this.requestRender();
                }
            })
            .to(0.14, { scale: 1 }, {
                easing: 'quadIn',
                onUpdate: () => {
                    this.squareScales[index] = popState.scale;
                    this.requestRender();
                }
            })
            .start();

        const effectState = { progress: 0 };
        tween(effectState)
            .delay(revealDelay)
            .to(0.42, { progress: 1 }, {
                easing: 'quadOut',
                onUpdate: () => {
                    this.cowHaloProgress[index] = effectState.progress;
                    this.requestRender();
                }
            })
            .call(() => {
                this.cowHaloProgress[index] = 0;
                this.requestRender();
            })
            .start();

        const visualScaleState = {
            scale: 0.08,
            y: hasColorBalloon ? -28 : 0,
        };
        if (hasColorBalloon) {
            this.scheduleOnce(() => {
                if (!this.isCowRevealTokenValid(index, revealToken)) return;
                SfxManager.instance.playRevealCow();
                // SfxManager.instance.vibrateShort(15);
                this.playCowEntranceSpark(index);
            }, revealDelay);
        }
        tween(visualScaleState)
            .delay(revealDelay)
            .to(0.12, { scale: 1.5, y: 28 }, {
                easing: 'backOut',
                onUpdate: () => {
                    if (!this.isCowRevealTokenValid(index, revealToken)) return;
                    this.cowRevealVisualScales[index] = visualScaleState.scale;
                    this.cowRevealVisualOffsets[index] = visualScaleState.y;
                    this.requestRender();
                }
            })
            .to(0.48, { scale: 1.5, y: 28 }, {
                easing: 'linear',
                onUpdate: () => {
                    if (!this.isCowRevealTokenValid(index, revealToken)) return;
                    this.cowRevealVisualScales[index] = visualScaleState.scale;
                    this.cowRevealVisualOffsets[index] = visualScaleState.y;
                    this.requestRender();
                }
            })
            .to(0.2, { scale: 1, y: 0 }, {
                easing: 'quadOut',
                onUpdate: () => {
                    if (!this.isCowRevealTokenValid(index, revealToken)) return;
                    this.cowRevealVisualScales[index] = visualScaleState.scale;
                    this.cowRevealVisualOffsets[index] = visualScaleState.y;
                    this.requestRender();
                }
            })
            .start();

        if (hasColorBalloon) {
            const balloonState = { scale: 0.06 };
            tween(balloonState)
                .delay(revealDelay + 0.14)
                .to(0.12, { scale: 1.12 }, {
                    easing: 'quadOut',
                    onUpdate: () => {
                        if (!this.isCowRevealTokenValid(index, revealToken)) return;
                        this.foundBalloonBackdropScales[index] = balloonState.scale;
                        this.requestRender();
                    }
                })
                .to(0.08, { scale: 1 }, {
                    easing: 'quadInOut',
                    onUpdate: () => {
                        if (!this.isCowRevealTokenValid(index, revealToken)) return;
                        this.foundBalloonBackdropScales[index] = balloonState.scale;
                        this.requestRender();
                    }
                })
                .start();
        }

        this.startCowIdleAnimation(index, false);
        this.scheduleOnce(() => {
            if (!this.isCowRevealTokenValid(index, revealToken)) return;
            this.cowFoundActionActive[index] = false;
            this.cowRevealVisualScales[index] = 1;
            this.cowRevealVisualOffsets[index] = 0;
            visualNode.angle = 0;
            visualNode.setPosition(v3(0, 0, 0));
            this.foundBalloonBackdropScales[index] = 1;
            PerfDebug.mark('animation cow reveal end', { index, hasColorBalloon });
            this.requestRender();
            onDone();
        }, revealDelay + this.COW_FOUND_ACTION_DURATION);
    },
    playCowCompletionCelebration: function (indices: number[], justRevealedIndex: number, onDone: () => void): void {
        const validIndices = (Array.isArray(indices) ? indices : [])
            .filter((index: number, order: number, list: number[]) =>
                index >= 0 &&
                list.indexOf(index) === order &&
                this.cowPositions[index] &&
                this.revealedSquares[index]
            );
        if (validIndices.length === 0) {
            onDone();
            return;
        }

        const justRevealedHasBalloon = justRevealedIndex >= 0 && this.hasBalloonNormalFrame(justRevealedIndex);
        const revealDelay = 0;
        const revealTokens: { [index: number]: number } = {};

        if (justRevealedHasBalloon) {
            this.foundBalloonBackdropScales[justRevealedIndex] = 0;
        }

        validIndices.forEach((index: number) => {
            const cowNode = this.getCowNode(index);
            const visualNode = this.getCowVisualNode(cowNode, index);
            const isJustRevealed = index === justRevealedIndex;
            const startScale = isJustRevealed ? 0.08 : 1;
            const startY = isJustRevealed && justRevealedHasBalloon ? -28 : 0;

            this.cowSpawnedOnce[index] = true;
            this.cowIdleTweensStarted[index] = false;
            this.cowRevealTokens[index] = this.cowIdleVersion * 100000 + ((this.cowRevealTokens[index] || 0) % 100000) + 1;
            const revealToken = this.cowRevealTokens[index];
            revealTokens[index] = revealToken;
            this.cowFoundActionActive[index] = true;
            this.cowRevealVisualScales[index] = startScale;
            this.cowRevealVisualOffsets[index] = startY;

            cowNode.active = true;
            tween(visualNode).stop();
            visualNode.angle = 0;
            visualNode.setPosition(v3(0, 0, 0));
            visualNode.setScale(v3(1, 1, 1));
            const visualSprite = visualNode.getComponent(Sprite);
            if (visualSprite) {
                visualSprite.trim = false;
                visualSprite.spriteFrame = this.getCowRestSpriteFrame(index);
            }

            const haloState = { progress: 0 };
            tween(haloState)
                .delay(revealDelay)
                .to(0.38, { progress: 1 }, {
                    easing: 'quadOut',
                    onUpdate: () => {
                        if (!this.isCowRevealTokenValid(index, revealToken)) return;
                        this.cowHaloProgress[index] = haloState.progress;
                        this.requestRender();
                    }
                })
                .call(() => {
                    if (!this.isCowRevealTokenValid(index, revealToken)) return;
                    this.cowHaloProgress[index] = 0;
                    this.requestRender();
                })
                .start();

            const visualScaleState = { scale: startScale, y: startY };
            tween(visualScaleState)
                .delay(revealDelay)
                .to(0.12, { scale: 1.5, y: 28 }, {
                    easing: 'backOut',
                    onUpdate: () => {
                        if (!this.isCowRevealTokenValid(index, revealToken)) return;
                        this.cowRevealVisualScales[index] = visualScaleState.scale;
                        this.cowRevealVisualOffsets[index] = visualScaleState.y;
                        this.requestRender();
                    }
                })
                .to(0.48, { scale: 1.5, y: 28 }, {
                    easing: 'linear',
                    onUpdate: () => {
                        if (!this.isCowRevealTokenValid(index, revealToken)) return;
                        this.cowRevealVisualScales[index] = visualScaleState.scale;
                        this.cowRevealVisualOffsets[index] = visualScaleState.y;
                        this.requestRender();
                    }
                })
                .to(0.2, { scale: 1, y: 0 }, {
                    easing: 'quadOut',
                    onUpdate: () => {
                        if (!this.isCowRevealTokenValid(index, revealToken)) return;
                        this.cowRevealVisualScales[index] = visualScaleState.scale;
                        this.cowRevealVisualOffsets[index] = visualScaleState.y;
                        this.requestRender();
                    }
                })
                .start();

            this.startCowIdleAnimation(index, false);
        });

        if (justRevealedHasBalloon) {
            this.scheduleOnce(() => {
                if (!this.isCowRevealTokenValid(justRevealedIndex, revealTokens[justRevealedIndex])) return;
                SfxManager.instance.playRevealCow();
                this.playCowEntranceSpark(justRevealedIndex);
            }, revealDelay);

            const balloonState = { scale: 0.06 };
            tween(balloonState)
                .delay(revealDelay + 0.14)
                .to(0.12, { scale: 1.12 }, {
                    easing: 'quadOut',
                    onUpdate: () => {
                        if (!this.isCowRevealTokenValid(justRevealedIndex, revealTokens[justRevealedIndex])) return;
                        this.foundBalloonBackdropScales[justRevealedIndex] = balloonState.scale;
                        this.requestRender();
                    }
                })
                .to(0.08, { scale: 1 }, {
                    easing: 'quadInOut',
                    onUpdate: () => {
                        if (!this.isCowRevealTokenValid(justRevealedIndex, revealTokens[justRevealedIndex])) return;
                        this.foundBalloonBackdropScales[justRevealedIndex] = balloonState.scale;
                        this.requestRender();
                    }
                })
                .start();
        }

        this.requestRender();
        this.scheduleOnce(() => {
            validIndices.forEach((index: number) => {
                if (!this.isCowRevealTokenValid(index, revealTokens[index])) return;
                this.cowFoundActionActive[index] = false;
                this.cowRevealVisualScales[index] = 1;
                this.cowRevealVisualOffsets[index] = 0;
                this.cowHaloProgress[index] = 0;
                const cowNode = this.cowNodes[index];
                if (cowNode && cowNode.isValid) {
                    const visualNode = this.getCowVisualNode(cowNode, index);
                    visualNode.angle = 0;
                    visualNode.setPosition(v3(0, 0, 0));
                }
                this.foundBalloonBackdropScales[index] = 1;
            });
            this.requestRender();
            onDone();
        }, revealDelay + this.COW_FOUND_ACTION_DURATION);
    },
    playCowEntranceSpark: function (index: number): void {
        const cowNode = this.cowNodes[index];
        if (!cowNode || !cowNode.isValid) return;

        const root = new Node(`CowEntranceSpark_${index}`);
        this.setUILayer(root);
        root.parent = cowNode;
        root.setSiblingIndex(40);
        const baseSize = this.balloonCowBaseSizes[index] || this.balloonCellBaseSizes[index] || 90;
        root.addComponent(CcUITransform).setContentSize(baseSize * 1.8, baseSize * 1.8);
        const opacity = root.addComponent(UIOpacity);
        opacity.opacity = 245;
        const g = root.addComponent(Graphics);

        g.strokeColor = new Color(255, 248, 180, 230);
        g.lineWidth = Math.max(3, baseSize * 0.035);
        g.circle(0, 0, baseSize * 0.34);
        g.stroke();
        g.fillColor = new Color(255, 255, 255, 70);
        g.circle(0, 0, baseSize * 0.2);
        g.fill();

        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            const size = baseSize * (0.06 + (i % 2) * 0.018);
            const cx = Math.cos(angle) * baseSize * 0.42;
            const cy = Math.sin(angle) * baseSize * 0.42;
            g.fillColor = i % 2 === 0 ? new Color(255, 245, 120, 245) : new Color(255, 255, 255, 245);
            g.moveTo(cx, cy + size);
            g.lineTo(cx + size * 0.45, cy + size * 0.25);
            g.lineTo(cx + size, cy);
            g.lineTo(cx + size * 0.45, cy - size * 0.25);
            g.lineTo(cx, cy - size);
            g.lineTo(cx - size * 0.45, cy - size * 0.25);
            g.lineTo(cx - size, cy);
            g.lineTo(cx - size * 0.45, cy + size * 0.25);
            g.close();
            g.fill();
        }

        root.setScale(v3(0.6, 0.6, 1));
        tween(root)
            .to(0.14, { scale: v3(1.25, 1.25, 1), angle: 16 }, { easing: 'quadOut' })
            .to(0.16, { scale: v3(1.45, 1.45, 1), angle: 28 }, { easing: 'quadIn' })
            .start();
        tween(opacity)
            .to(0.1, { opacity: 255 }, { easing: 'quadOut' })
            .to(0.2, { opacity: 0 }, { easing: 'quadIn' })
            .call(() => {
                if (root.isValid) root.destroy();
            })
            .start();
    },
    startCowIdleAnimation: function (index: number, _playOpeningAction: boolean = false, openingDone?: () => void) {
        if (this.cowIdleTweensStarted[index]) {
            openingDone?.();
            return;
        }
        this.cowIdleTweensStarted[index] = true;
        this.cowIdleTokens[index] = this.cowIdleVersion * 100000 + ((this.cowIdleTokens[index] || 0) % 100000) + 1;
        this.cowIdleColorActionActive[index] = true;
        this.applyCowMenuDanceFrame(index);
        openingDone?.();
    },
    scheduleCowExpressionLoop: function (_index: number, _token: number, _delay: number) {
        // Legacy color/idle expressions are intentionally disabled for the unified menu-idle reveal.
    },
    playNextCowIdleExpression: function (_index: number, _token: number): number {
        return 0;
    },
    playCowColorIdleExpression: function (_index: number, _token: number): number {
        return 0;
    },
    playCowColorIdleFrameSequence: function (index: number, token: number, frames: SpriteFrame[]): void {
        if (frames.length === 0 || !this.isCowIdleTokenValid(index, token)) return;
        const visualNode = this.getCowVisualNode(this.getCowNode(index), index);
        const sprite = visualNode.getComponent(Sprite);
        if (!sprite) return;

        this.cowIdleColorActionActive[index] = true;
        tween(visualNode).stop();
        const frameTime = this.COW_IDLE_ACTION_DURATION / frames.length;
        this.applyCowSequenceFrame(visualNode, sprite, frames[0], 'idle1', 0);
        frames.forEach((frame, frameIndex) => {
            this.scheduleOnce(() => {
                if (!this.isCowIdleTokenValid(index, token)) return;
                this.applyCowSequenceFrame(visualNode, sprite, frame, 'idle1', frameIndex);
            }, frameIndex * frameTime);
        });
        this.scheduleOnce(() => {
            this.cowIdleColorActionActive[index] = false;
            if (!this.isCowIdleTokenValid(index, token)) return;
            this.resetCowVisualExpression(visualNode, this.getCowRestSpriteFrame(index));
        }, this.COW_IDLE_ACTION_DURATION);
    },
    playCowIdle1Expression: function (index: number, token: number, force: boolean = false): number {
        const frames = this.getCowSequenceFrames(this.cowIdle1Frames);
        return this.playCowSequenceExpression(index, token, frames, force, 'idle1') ? this.COW_IDLE_ACTION_DURATION : 0;
    },
    playCowIdle2Expression: function (index: number, token: number, force: boolean = false): number {
        const frames = this.getCowSequenceFrames(this.cowIdle2Frames);
        return this.playCowSequenceExpression(index, token, frames, force, 'idle2') ? this.COW_IDLE_ACTION_DURATION : 0;
    },
    playCowFoundExpression: function (_index: number, _token: number, onDone: () => void) {
        onDone();
    },
    playCowFoundFrameSequence: function (_index: number, _token: number, _frames: SpriteFrame[], onDone: () => void) {
        onDone();
    },
    playCowSequenceExpression: function (index: number, token: number, frames: SpriteFrame[], force: boolean = false, kind: CowIdleActionKind = 'idle1'): boolean {
        if (!force && this.isGameOver) return false;
        if (this.hasBalloonCowFrame(index)) return false;
        if (frames.length === 0 || !this.isCowIdleTokenValid(index, token)) return false;
        const visualNode = this.getCowVisualNode(this.getCowNode(index), index);
        const sprite = visualNode.getComponent(Sprite);
        if (!sprite) return false;
        tween(visualNode).stop();
        this.applyCowSequenceFrame(visualNode, sprite, frames[0], kind, 0);
        const frameTime = this.COW_IDLE_ACTION_DURATION / frames.length;
        this.cowExpressionLocks[index] = Date.now() + Math.floor(this.COW_IDLE_ACTION_DURATION * 1000) + this.COW_IDLE_ACTION_LOCK_PAD_MS;

        frames.forEach((frame, frameIndex) => {
            this.scheduleOnce(() => {
                if (!this.isCowIdleTokenValid(index, token)) return;
                this.applyCowSequenceFrame(visualNode, sprite, frame, kind, frameIndex);
            }, frameIndex * frameTime);
        });
        this.scheduleOnce(() => {
            if (!this.isCowIdleTokenValid(index, token)) return;
            this.resetCowVisualExpression(visualNode, frames[0]);
        }, this.COW_IDLE_ACTION_DURATION);

        return true;
    },
    applyCowSequenceFrame: function (visualNode: Node, sprite: Sprite, frame: SpriteFrame, kind: CowIdleActionKind, frameIndex: number) {
        const layout = this.getCowFrameLayout(kind, frameIndex);
        const transform = visualNode.getComponent(CcUITransform);
        const width = transform?.width || 0;
        const height = transform?.height || width;
        const offsetX = width > 0 ? layout.x * width * layout.scale : 0;
        const offsetY = height > 0 ? layout.y * height * layout.scale : 0;

        sprite.trim = false;
        sprite.spriteFrame = frame;
        visualNode.angle = 0;
        visualNode.setScale(v3(layout.scale, layout.scale, 1));
        visualNode.setPosition(v3(this.snapPixelPosition(offsetX), this.snapPixelPosition(offsetY), 0));
    },
    getCowFrameLayout: function (_kind: CowIdleActionKind, _frameIndex: number): CowFrameLayout {
        return { scale: 1, x: 0, y: 0 };
    },
    getCowSequenceFrames: function (frames: SpriteFrame[]): SpriteFrame[] {
        return (frames || []).filter(frame => !!frame);
    },
    isCowIdleTokenValid: function (index: number, token: number): boolean {
        const cowNode = this.cowNodes[index];
        return !!cowNode && cowNode.isValid && cowNode.active && (this.cowIdleTokens[index] || 0) === token;
    },
    isCowRevealTokenValid: function (index: number, token: number): boolean {
        const cowNode = this.cowNodes[index];
        return !!cowNode && cowNode.isValid && cowNode.active && (this.cowRevealTokens[index] || 0) === token;
    },
    resetCowVisualExpression: function (visualNode: Node, frame?: SpriteFrame | null) {
        tween(visualNode).stop();
        visualNode.setPosition(v3(0, 0, 0));
        visualNode.setScale(v3(1, 1, 1));
        visualNode.angle = 0;
        const sprite = visualNode.getComponent(Sprite);
        if (sprite) {
            sprite.trim = false;
            sprite.spriteFrame = frame || this.getCowRestSpriteFrame();
        }
    },
    getCowRestSpriteFrame: function (_index: number = -1): SpriteFrame | null {
        return this.cowMenuDanceFrames[0] || null;
    },
    updateRemainingLabel: function () {
        if (this.remainingCowsLabel) {
            const count = this.totalCows - this.cowsFound;
            const nextValue = Math.max(0, count).toString();
            const changed = this.remainingCowsLabel.string !== nextValue;
            this.remainingCowsLabel.string = nextValue;
            this.updateRemainingCowCaption?.();
            this.updateSurvivalFoundCowsLabel?.();
            this.refreshRemainingCowIcon();
            this.syncRemainingCowsPosition?.();

            // 剩余数量变化时，父节点执行放大回弹动画
            const parent = this.remainingCowsLabel.node.parent;
            if (parent && changed) {
                // 先停止之前的动画防止冲突
                tween(parent).stop();
                parent.setScale(v3(1, 1, 1));
                tween(parent)
                    .to(0.1, { scale: v3(1.2, 1.2, 1) }, { easing: 'quadOut' })
                    .to(0.1, { scale: v3(1, 1, 1) }, { easing: 'quadIn' })
                    .start();
            }
        }
    },
    updateSurvivalFoundCowsLabel: function () {
        const label = this.survivalFoundCowsLabel as Label | null;
        if (GameApp.gameMode !== GameMode.survival) {
            if (this.survivalFoundCowsRoot?.isValid) this.survivalFoundCowsRoot.active = false;
            return;
        }
        if (!label || !label.node || !label.node.isValid) return;

        const nextValue = Math.max(0, (GameApp.foundCowNum || 0) + this.cowsFound).toString();
        const changed = label.string !== nextValue;
        label.string = nextValue;

        const root = this.survivalFoundCowsRoot as Node | null;
        if (root?.isValid) root.active = true;
        const parent = label.node.parent;
        if (parent && changed) {
            tween(parent).stop();
            parent.setScale(v3(1, 1, 1));
            tween(parent)
                .to(0.1, { scale: v3(1.2, 1.2, 1) }, { easing: 'quadOut' })
                .to(0.1, { scale: v3(1, 1, 1) }, { easing: 'quadIn' })
                .start();
        }
    },
    updateRemainingCowCaption: function () {
        if (!this.remainingCowsLabel) return;
        const container = this.remainingCowsLabel.node.parent;
        if (!container || !container.isValid) return;
        const caption = '未点到:';
        const labels: Label[] = [];
        const collect = (node: Node) => {
            const label = node.getComponent(Label);
            if (label) labels.push(label);
            for (const child of node.children) collect(child);
        };
        collect(container);
        for (const label of labels) {
            if (label === this.remainingCowsLabel) continue;
            if (/^\s*\d+\s*$/.test(label.string)) continue;
            label.string = caption;
        }
    },
    refreshRemainingCowIcon: function () {
        if (!this.remainingCowsLabel) return;
        const labelNode = this.remainingCowsLabel.node;
        const container = labelNode.parent || this.node;
        if (!container) return;

        const sceneCowNode = container.getChildByName('cow');
        const frame = this.remainingCowIconFrame;
        if (!frame) {
            if (sceneCowNode) sceneCowNode.active = false;
            if (this.remainingCowIconNode?.isValid) this.remainingCowIconNode.active = false;
            return;
        }

        const customNode = container.getChildByName('RemainingCowStaticIcon');
        if (customNode && customNode !== sceneCowNode) {
            customNode.active = false;
        }

        let iconNode = sceneCowNode || this.remainingCowIconNode;
        if (!iconNode || !iconNode.isValid || iconNode.parent !== container) {
            iconNode = new Node('RemainingCowStaticIcon');
            this.setUILayer(iconNode);
            iconNode.parent = container;
        }
        iconNode.getComponent(CcUITransform) || iconNode.addComponent(CcUITransform);
        const sprite = iconNode.getComponent(Sprite) || iconNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        this.remainingCowIconNode = iconNode;

        const iconTransform = iconNode.getComponent(CcUITransform)!;
        const iconSprite = iconNode.getComponent(Sprite)!;
        const fitted = this.getPixelPerfectFitSize(frame, 38, 38);
        const labelTransform = labelNode.getComponent(CcUITransform);
        const labelWidth = Math.max(14, this.snapPixelValue(labelTransform?.width || 14));
        const labelPos = labelNode.position.clone();
        const iconX = this.snapPixelPosition(labelPos.x - labelWidth * 0.5 - fitted.width * 0.5 - 3);
        const iconY = this.snapPixelPosition(labelPos.y + 1);

        iconSprite.spriteFrame = frame;
        iconTransform.setContentSize(fitted.width, fitted.height);
        iconNode.setScale(v3(1, 1, 1));
        iconNode.setPosition(iconX, iconY);
        iconNode.active = labelNode.active;
        iconNode.setSiblingIndex(Math.max(0, labelNode.getSiblingIndex() - 1));
    },
    syncProgressLabels: function () {
        if (GameApp.gameMode === GameMode.survival) {
            if (this.levelLabel?.node && this.levelLabel.node.isValid) this.levelLabel.node.active = false;
            if (this.coinLabel?.node && this.coinLabel.node.isValid) {
                const coinNode = this.coinLabel.node.parent && this.coinLabel.node.parent.isValid ? this.coinLabel.node.parent : this.coinLabel.node;
                coinNode.active = false;
                this.coinLabel.string = this.totalCoins.toString();
            }
            this.refreshGlobalHudCoin(false);
            this.refreshSceneHintCountBadges?.();
            return;
        }
        if (this.levelLabel?.node && this.levelLabel.node.isValid) {
            this.levelLabel.node.active = true;
            this.levelLabel.string = this.getLevelDisplayText();
        }
        if (this.coinLabel?.node && this.coinLabel.node.isValid) {
            const coinNode = this.coinLabel.node.parent && this.coinLabel.node.parent.isValid ? this.coinLabel.node.parent : this.coinLabel.node;
            coinNode.active = false;
            this.coinLabel.string = this.totalCoins.toString();
        }
        this.refreshGlobalHudCoin(false);
        this.refreshSceneHintCountBadges?.();
        this.syncDebugJumpPanel();
    },
    saveGameData: function () {
        GameApp.user.save();
    },
    loadGameData: function () {
        try {
            GameApp.init();
            GameApp.drawGrid = this;
            const clampedLevel = this.clampLevel(GameApp.user.level);
            if (GameApp.user.level !== clampedLevel) {
                this.currentLevel = clampedLevel;
                this.saveGameData();
            }
            this.syncProgressLabels();
        } catch (error) {
            console.error('加载存档失败', error);
        }
    },
    clampLevel: function (level: number): number {
        return Math.min(this.MAX_CONFIG_LEVEL, Math.max(1, Math.floor(level || 1)));
    },
    });
}
