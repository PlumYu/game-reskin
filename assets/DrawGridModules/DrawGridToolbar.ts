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
import { getAdaptiveLayout, scaleLayout } from '../Utils/LayoutService';
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
type HintKind = 'cow' | 'exclude';

const COW_HINT_COIN_COST = 100;
const EXCLUDE_HINT_COIN_COST = 120;
export function installDrawGridToolbar(target: any): void {
    Object.assign(target.prototype, {
    updateCowMenuDance: function (dt: number): void {
        const frames = this.getCowSequenceFrames(this.cowMenuDanceFrames);
        if (frames.length === 0) {
            return;
        }
        this.cowMenuDanceElapsed += Math.min(Math.max(dt, 0), 0.05);
        if (this.cowMenuDanceElapsed < this.COW_MENU_DANCE_FRAME_INTERVAL) return;

        const step = Math.floor(this.cowMenuDanceElapsed / this.COW_MENU_DANCE_FRAME_INTERVAL);
        this.cowMenuDanceElapsed -= step * this.COW_MENU_DANCE_FRAME_INTERVAL;
        this.cowMenuDanceFrameIndex = (this.cowMenuDanceFrameIndex + step) % frames.length;
        this.applyCowMenuDanceFrameToAll();
    },
    applyCowMenuDanceFrameToAll: function (): void {
        for (let i = 0; i < this.cowNodes.length; i++) {
            if (!this.revealedSquares[i] || !this.cowPositions[i] || !this.cowIdleColorActionActive[i]) continue;
            this.applyCowMenuDanceFrame(i);
        }
    },
    applyCowMenuDanceFrame: function (index: number): void {
        const frames = this.getCowSequenceFrames(this.cowMenuDanceFrames);
        if (frames.length === 0) {
            const visualNode = this.getCowVisualNode(this.getCowNode(index), index);
            this.resetCowVisualExpression(visualNode, this.getCowRestSpriteFrame(index));
            return;
        }
        const visualNode = this.getCowVisualNode(this.getCowNode(index), index);
        const sprite = visualNode.getComponent(Sprite);
        if (!sprite) return;
        tween(visualNode).stop();
        const frameIndex = this.cowMenuDanceFrameIndex % frames.length;
        this.applyCowSequenceFrame(visualNode, sprite, frames[frameIndex], 'idle1', frameIndex);
    },
    ensureGameplaySettingButton: function (splash: Node): void {
        const legacyButton = splash.getChildByName('gameplaySettingBtn');
        if (legacyButton) legacyButton.active = false;
        this.gameplaySettingButton = null;
        this.gameplaySettingSprite = null;
    },
    loadGameplaySettingIcon: function (sprite: Sprite): void {
        const applyFrame = (frame: SpriteFrame | null) => {
            if (!frame || !sprite.node.isValid) return;
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            sprite.node.getComponent(CcUITransform)?.setContentSize(90, 76);
        };

        AssetService.loadSpriteFrame('images/hud_setting', frame => {
            if (frame) {
                applyFrame(frame);
            } else {
                console.warn('[DrawGrid] Gameplay setting icon load failed');
            }
        }, 'smooth');
    },
    onGameplaySettingClick: function (): void {
        // Settings are handled by GlobalHud. Keep this no-op for stale scene nodes.
    },
    getLeftHudLayout: function (w: number, h: number): {
        settingX: number;
        settingY: number;
        coinX: number;
        coinY: number;
    } {
        const layout = getAdaptiveLayout({ topRowDrop: 60 });
        const left = layout.contentLeft + scaleLayout(this.hudLeftMargin, layout);
        const settingY = layout.topRowY;
        return {
            settingX: left + scaleLayout(32, layout),
            settingY,
            coinX: left + scaleLayout(60, layout),
            coinY: layout.secondTopRowY,
        };
    },
    getLevelModeTopHudRows: function (_w: number, _h: number): { firstRowY: number; secondRowY: number } {
        const layout = getAdaptiveLayout({
            topRowDrop: 60,
            topRowGap: 56,
        });
        const firstRowY = layout.topRowY;
        return {
            firstRowY,
            secondRowY: layout.secondTopRowY,
        };
    },
    shouldUseLevelTopHudRows: function (): boolean {
        return GameApp.gameMode !== GameMode.survival && GameApp.gameMode !== GameMode.daily_challenge;
    },
    isGlobalHudNode: function (node: Node): boolean {
        const coinLabelNode = this.coinLabel?.node || null;
        const coinNode = coinLabelNode && coinLabelNode.isValid
            ? ((coinLabelNode.parent && coinLabelNode.parent.isValid) ? coinLabelNode.parent : coinLabelNode)
            : null;
        return node === coinNode || node.name === 'gameplaySettingBtn';
    },
    configureStaticGameplayBackground: function (splash: Node): void {
        const canvas = splash.parent;
        if (!canvas) return;

        const canvasTransform = canvas.getComponent(CcUITransform);
        const width = canvasTransform?.contentSize.width || 750;
        const height = canvasTransform?.contentSize.height || 1334;
        const sourceSprite = splash.getComponent(Sprite);

        if (!this.staticGameplayBackgroundNode || !this.staticGameplayBackgroundNode.isValid) {
            const bgNode = new Node('GameplayStaticBackground');
            this.setUILayer(bgNode);
            canvas.addChild(bgNode);
            bgNode.addComponent(CcUITransform);
            bgNode.addComponent(Sprite);
            bgNode.addComponent(Widget);
            this.staticGameplayBackgroundNode = bgNode;
        }

        const bgNode = this.staticGameplayBackgroundNode;
        bgNode.active = true;
        bgNode.setPosition(v3(0, 0, 0));
        bgNode.setSiblingIndex(1);
        const bgTransform = bgNode.getComponent(CcUITransform) || bgNode.addComponent(CcUITransform);
        bgTransform.setContentSize(width, height);
        const bgSprite = bgNode.getComponent(Sprite) || bgNode.addComponent(Sprite);
        const bgGraphics = bgNode.getComponent(Graphics) || bgNode.addComponent(Graphics);
        bgGraphics.clear();
        const isTutorialBackground = GameApp.gameMode === GameMode.level
            && (this._isGuideMode || this._isSwipeGuideMode);
        if (isTutorialBackground) {
            bgSprite.enabled = false;
            bgGraphics.fillColor = new Color(255, 255, 255, 255);
            bgGraphics.rect(-width / 2, -height / 2, width, height);
            bgGraphics.fill();
        } else {
            const applyBackgroundFrame = (frame: SpriteFrame | null | undefined): void => {
                if (!frame || !bgNode.isValid) return;
                bgGraphics.clear();
                bgSprite.spriteFrame = frame;
                bgSprite.color = new Color(255, 255, 255, 255);
                bgSprite.enabled = true;
            };
            const staticFrame = sourceSprite?.spriteFrame || bgSprite.spriteFrame;
            bgSprite.enabled = false;
            bgGraphics.fillColor = new Color(221, 243, 255, 255);
            bgGraphics.rect(-width / 2, -height / 2, width, height);
            bgGraphics.fill();
            AssetService.loadSpriteFrame('images/背景图', frame => {
                if (this._isGuideMode || this._isSwipeGuideMode) return;
                if (frame) {
                    applyBackgroundFrame(frame);
                    return;
                }
                applyBackgroundFrame(staticFrame);
            }, 'smooth');
        }
        bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSprite.trim = false;

        const bgWidget = bgNode.getComponent(Widget) || bgNode.addComponent(Widget);
        bgWidget.isAlignLeft = true;
        bgWidget.isAlignRight = true;
        bgWidget.isAlignTop = true;
        bgWidget.isAlignBottom = true;
        bgWidget.left = 0;
        bgWidget.right = 0;
        bgWidget.top = 0;
        bgWidget.bottom = 0;
        bgWidget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
        bgWidget.updateAlignment();

        const transform = splash.getComponent(CcUITransform) || splash.addComponent(CcUITransform);
        transform.setContentSize(width, height);
        splash.setPosition(v3(0, 0, 0));
        const widget = splash.getComponent(Widget) || splash.addComponent(Widget);
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.left = 0;
        widget.right = 0;
        widget.top = 0;
        widget.bottom = 0;
        widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
        widget.updateAlignment();

        if (sourceSprite) {
            sourceSprite.enabled = false;
        }
        const drawGridNode = canvas.getChildByName('DrawGrid');
        if (drawGridNode) {
            splash.setSiblingIndex(drawGridNode.getSiblingIndex() + 1);
        }
    },
    buildToolbar: function (): void {
        if (this.toolbarContainer) return;

        const layout = getAdaptiveLayout();
        const screenW = layout.width;
        const toolbarH = 108;
        const toolbarY = this.getGameplayToolbarY?.() ?? (layout.bottomY + toolbarH / 2 + scaleLayout(28, layout));
        const cardSize = 68;
        const largeCardSize = 108;
        const iconSize = 32;
        const largeIconSize = 50;

        const container = new Node('Toolbar');
        this.setUILayer(container);
        container.parent = this.node;
        container.setPosition(0, toolbarY, 0);
        container.addComponent(CcUITransform).setContentSize(screenW, toolbarH);
        this.toolbarContainer = container;

        const tools: { name: string; cost: number; size: number; iconSize: number; handler: () => void; drawIcon: (g: Graphics) => void }[] = [
            { name: '清除', cost: 0, size: largeCardSize, iconSize: largeIconSize, handler: this.onToolClear.bind(this), drawIcon: this.drawToolEraserIcon },
            { name: '找猫', cost: COW_HINT_COIN_COST, size: cardSize, iconSize, handler: this.onToolReveal.bind(this), drawIcon: this.drawToolCowIcon },
            { name: '提示', cost: EXCLUDE_HINT_COIN_COST, size: cardSize, iconSize, handler: this.onToolHint.bind(this), drawIcon: this.drawToolBulbIcon },
            { name: '坐标', cost: 0, size: largeCardSize, iconSize: largeIconSize, handler: this.onToolCoordinate.bind(this), drawIcon: this.drawToolGridIcon },
        ];

        const gap = 16;
        const totalW = tools.reduce((sum, tool) => sum + tool.size, 0) + (tools.length - 1) * gap;
        let cursorX = -totalW / 2;

        tools.forEach((tool) => {
            const card = createRoundedCard(`Tool_${tool.name}`, container, tool.size, tool.size, COLOR_TOOLBAR_BG, RADIUS_MD);
            card.setPosition(cursorX + tool.size / 2, 0, 0);
            cursorX += tool.size + gap;

            const iconNode = new Node('icon');
            this.setUILayer(iconNode);
            iconNode.parent = card;
            iconNode.addComponent(CcUITransform).setContentSize(tool.iconSize, tool.iconSize);
            iconNode.setPosition(0, tool.cost > 0 ? 10 : 4, 0);
            if (tool.iconSize > iconSize) {
                iconNode.setScale(tool.iconSize / iconSize, tool.iconSize / iconSize, 1);
            }

            const g = iconNode.addComponent(Graphics);
            tool.drawIcon(g);

            const lbl = createLabel(`label_${tool.name}`, card, tool.name, tool.size > cardSize ? 18 : 12, new Color(80, 80, 100, 255));
            lbl.node.setPosition(0, tool.cost > 0 ? -14 : (tool.size > cardSize ? -34 : -20), 0);

            if (tool.cost > 0) {
                const costLbl = createLabel(`cost_${tool.name}`, card, `${tool.cost}`, 11, COLOR_GOLD, true);
                costLbl.node.setPosition(0, -26, 0);
            }

            addButtonFeedback(card);
            card.on(Node.EventType.TOUCH_END, tool.handler, this);
        });
    },
    getGameplayToolbarY: function (): number {
        const layout = getAdaptiveLayout();
        const gridLayout = typeof this.getGridLayoutMetrics === 'function' ? this.getGridLayoutMetrics() : null;
        const gridSize = Math.max(0, Math.floor(this.gridSize || 0));
        const boardSize = gridLayout?.boardSize || (typeof this.getBoardSize === 'function' ? this.getBoardSize(gridSize) : this.BG_SIZE);
        const toolbarH = 108;
        const boardBottomY = -boardSize / 2;
        const preferredY = boardBottomY - scaleLayout(205, layout);
        const nodeY = this.node?.position?.y ?? 0;
        const minSafeY = layout.bottomY - nodeY + toolbarH / 2 + scaleLayout(28, layout);
        return Math.max(preferredY, minSafeY);
    },
    drawToolEraserIcon: function (g: Graphics): void {
        g.fillColor = new Color(120, 130, 160, 255);
        g.roundRect(-12, -4, 24, 14, 3);
        g.fill();
        g.fillColor = new Color(90, 100, 130, 255);
        g.roundRect(-12, -4, 24, 6, 3);
        g.fill();
        g.strokeColor = new Color(200, 80, 80, 255);
        g.lineWidth = 2;
        g.moveTo(-8, 2);
        g.lineTo(8, 2);
        g.stroke();
    },
    drawToolCowIcon: function (g: Graphics): void {
        g.strokeColor = new Color(255, 180, 60, 255);
        g.lineWidth = 4;
        g.lineCap = Graphics.LineCap.ROUND;
        g.circle(-3, 3, 11);
        g.stroke();
        g.moveTo(6, -6);
        g.lineTo(17, -17);
        g.stroke();
        g.fillColor = new Color(255, 220, 96, 255);
        g.circle(-3, 3, 4);
        g.fill();
    },
    drawToolBulbIcon: function (g: Graphics): void {
        g.fillColor = new Color(255, 220, 60, 200);
        g.circle(0, 4, 12);
        g.fill();
        g.strokeColor = new Color(255, 200, 30, 255);
        g.lineWidth = 2;
        g.circle(0, 4, 12);
        g.stroke();
        g.fillColor = new Color(180, 160, 60, 255);
        g.roundRect(-5, -12, 10, 6, 2);
        g.fill();
        g.strokeColor = new Color(255, 220, 60, 255);
        g.lineWidth = 1.5;
        g.moveTo(-3, -6);
        g.lineTo(3, -6);
        g.stroke();
    },
    drawToolGridIcon: function (g: Graphics): void {
        g.strokeColor = new Color(80, 140, 220, 255);
        g.lineWidth = 2.5;
        g.roundRect(-12, -12, 24, 24, 3);
        g.stroke();
        g.moveTo(0, -12); g.lineTo(0, 12); g.stroke();
        g.moveTo(-12, 0); g.lineTo(12, 0); g.stroke();
        g.fillColor = new Color(80, 140, 220, 60);
        g.rect(-12, 0, 12, 12);
        g.fill();
        g.rect(0, -12, 12, 12);
        g.fill();
    },
    onToolClear: function (): void {
        if (this.isGameOver) return;
        this.clickedSquares = this.clickedSquares.map(() => false);
        this.xAnimationProgress = this.xAnimationProgress.map(() => 0);
        this.squareScales = this.squareScales.map(() => 1);
        this.markAnimationTokens = this.markAnimationTokens.map((token: number) => (token || 0) + 1);
        this.renderGrid();
        SfxManager.instance.playUiClick();
        this.showWorkplaceToast('撤回排查记录', v3(0, 330, 0), new Color(255, 238, 92, 255));
    },
    onToolReveal: function (): void {
        if (this.isGameOver) return;
        this.useHint();
    },
    getHintCoinCost: function (kind: HintKind = 'exclude'): number {
        return kind === 'cow' ? COW_HINT_COIN_COST : EXCLUDE_HINT_COIN_COST;
    },
    getAvailableHintCount: function (kind: HintKind = 'exclude'): number {
        const raw = kind === 'cow' ? GameApp.user.cowHintCount : GameApp.user.excludeHintCount;
        return Math.max(0, Math.floor(raw || 0));
    },
    setAvailableHintCount: function (kind: HintKind, value: number): void {
        if (kind === 'cow') {
            GameApp.user.cowHintCount = value;
        } else {
            GameApp.user.excludeHintCount = value;
        }
        GameApp.user.save();
        this.refreshSceneHintCountBadges?.();
        this.refreshHintPurchasePanel?.();
    },
    consumeHintCount: function (kind: HintKind): boolean {
        const count = this.getAvailableHintCount(kind);
        if (count <= 0) {
            this.openHintPurchasePanel?.(kind);
            this.refreshSceneHintCountBadges?.();
            return false;
        }
        this.setAvailableHintCount(kind, count - 1);
        return true;
    },
    buyHintCount: function (kind: HintKind): boolean {
        const cost = this.getHintCoinCost(kind);
        if (GameApp.user.coin < cost) {
            this.showWorkplaceToast('金币不足', v3(0, 330, 0), new Color(255, 95, 95, 255));
            this.refreshHintPurchasePanel?.();
            return false;
        }

        GameApp.user.coin -= cost;
        this.setAvailableHintCount(kind, this.getAvailableHintCount(kind) + 1);
        this.syncProgressLabels();
        this.refreshSceneHintCountBadges?.();
        return true;
    },
    onToolHint: function (): void {
        if (this.isGameOver) return;
        this.showHint();
    },
    onToolCoordinate: function (): void {
        this.showCoordinates = !this.showCoordinates;
        this.renderGrid();
        SfxManager.instance.playUiClick();
    },
    useHint: function () {
        if (this.isGameOver) return;
        this.hideSceneHintGuidePrompt?.();
        const hiddenCowIndices: number[] = [];
        for (let i = 0; i < this.cowPositions.length; i++) {
            if (this.cowPositions[i] && !this.revealedSquares[i]) {
                hiddenCowIndices.push(i);
            }
        }

        if (hiddenCowIndices.length <= 0) {
            console.log("所有目标都已经找齐或翻开了！");
            this.showWorkplaceToast('所有猫猫都已经找齐了', v3(0, 330, 0), new Color(180, 190, 205, 255));
            return;
        }

        SfxManager.instance.playUiClick(); // UI点击音效
        if (!this.consumeHintCount('cow')) return;

        this.hintUsedThisLevel = true;
        this.showWorkplaceToast('猫猫雷达，直接锁一格', v3(0, 330, 0), new Color(255, 238, 92, 255));

        const randomIndex = hiddenCowIndices[Math.floor(Math.random() * hiddenCowIndices.length)];
        this.revealSquare(randomIndex);
    },
    });
}
