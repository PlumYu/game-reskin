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

const ENABLE_EXCLUDE_HINT_PREVIEW_EFFECT = false;

export function installDrawGridHintOverlay(target: any): void {
    Object.assign(target.prototype, {
    setupHintPanel: function () {
        if (!this.hintPanelNode) return;
        this.setupHintOverlayLayer();
        this.setupHintPanelIcon();
        this.setupHintApplyButton();
        this.hintPanelNode.active = false;
    },
    setupHintPanelIcon: function () {
        if (!this.hintPanelNode) return;
        const cardNode = this.hintPanelNode.getChildByName('dikuang');
        const iconNode = cardNode?.getChildByName('tips2') || null;
        if (!iconNode) return;

        const transform = iconNode.getComponent(CcUITransform) || iconNode.addComponent(CcUITransform);
        transform.setContentSize(96, 96);

        const sprite = iconNode.getComponent(Sprite) || iconNode.addComponent(Sprite);
        iconNode.active = true;
        AssetService.loadSpriteFrame('guide/guide_finger', frame => {
            if (!frame || !iconNode.isValid) {
                console.warn('[DrawGrid] Hint panel icon sprite load failed: guide/guide_finger');
                return;
            }
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
        }, 'smooth');
    },
    setupHintApplyButton: function () {
        if (!this.hintPanelNode) return;
        const applyButton = this.findChildByNameDeep(this.hintPanelNode, 'yingyong');
        if (!applyButton) return;
        applyButton.setPosition(applyButton.position.x, -414, applyButton.position.z);
        applyButton.setScale(v3(1.15, 1.15, 1));
    },
    getHintPanelApplyButton: function (): Node | null {
        if (!this.hintPanelNode) return null;
        return this.findChildByNameDeep(this.hintPanelNode, 'yingyong');
    },
    getHintEntranceBaseScale: function (node: Node): Vec3 {
        const stateNode = node as Node & { __hintEntranceBaseScale?: Vec3 };
        if (!stateNode.__hintEntranceBaseScale) {
            stateNode.__hintEntranceBaseScale = node.scale.clone();
        }
        return stateNode.__hintEntranceBaseScale;
    },
    setHintEntranceScale: function (node: Node, baseScale: Vec3, multiplier: number): void {
        node.setScale(v3(baseScale.x * multiplier, baseScale.y * multiplier, baseScale.z));
    },
    stopHintPanelEntranceTweens: function (): void {
        const nodes = [
            this.hintPanelNode?.getChildByName('dikuang') || null,
            this.getHintPanelApplyButton?.() || null,
            this.hintOverlayNode || null,
            this.hintCowLayerNode || null,
        ];
        for (const node of nodes) {
            if (!node || !node.isValid) continue;
            tween(node).stop();
            const opacity = node.getComponent(UIOpacity);
            if (opacity) {
                tween(opacity).stop();
            }
        }
    },
    prepareHintPanelEntrance: function (): void {
        this.stopHintPanelEntranceTweens?.();
        const overlayOpacity = this.hintOverlayNode?.getComponent(UIOpacity) || this.hintOverlayNode?.addComponent(UIOpacity);
        const cowLayerOpacity = this.hintCowLayerNode?.getComponent(UIOpacity) || this.hintCowLayerNode?.addComponent(UIOpacity);
        if (overlayOpacity) overlayOpacity.opacity = 0;
        if (cowLayerOpacity) cowLayerOpacity.opacity = 0;

        const card = this.hintPanelNode?.getChildByName('dikuang') || null;
        if (card?.isValid) {
            const baseScale = this.getHintEntranceBaseScale(card);
            this.setHintEntranceScale(card, baseScale, 0.9);
            const opacity = card.getComponent(UIOpacity) || card.addComponent(UIOpacity);
            opacity.opacity = 0;
        }

        const applyButton = this.getHintPanelApplyButton?.() || null;
        if (applyButton?.isValid) {
            const baseScale = this.getHintEntranceBaseScale(applyButton);
            this.setHintEntranceScale(applyButton, baseScale, 0.84);
            const opacity = applyButton.getComponent(UIOpacity) || applyButton.addComponent(UIOpacity);
            opacity.opacity = 0;
        }
    },
    playHintPanelEntrance: function (): void {
        const overlayOpacity = this.hintOverlayNode?.getComponent(UIOpacity) || null;
        const cowLayerOpacity = this.hintCowLayerNode?.getComponent(UIOpacity) || null;
        if (overlayOpacity) {
            tween(overlayOpacity)
                .to(0.12, { opacity: 255 }, { easing: 'quadOut' })
                .start();
        }
        if (cowLayerOpacity) {
            tween(cowLayerOpacity)
                .to(0.14, { opacity: 255 }, { easing: 'quadOut' })
                .start();
        }

        const card = this.hintPanelNode?.getChildByName('dikuang') || null;
        if (card?.isValid) {
            const baseScale = this.getHintEntranceBaseScale(card);
            const opacity = card.getComponent(UIOpacity) || card.addComponent(UIOpacity);
            tween(opacity)
                .to(0.14, { opacity: 255 }, { easing: 'quadOut' })
                .start();
            tween(card)
                .to(0.14, { scale: v3(baseScale.x * 1.04, baseScale.y * 1.04, baseScale.z) }, { easing: 'backOut' })
                .to(0.08, { scale: v3(baseScale.x, baseScale.y, baseScale.z) }, { easing: 'quadInOut' })
                .start();
        }

        const applyButton = this.getHintPanelApplyButton?.() || null;
        if (applyButton?.isValid) {
            const baseScale = this.getHintEntranceBaseScale(applyButton);
            const opacity = applyButton.getComponent(UIOpacity) || applyButton.addComponent(UIOpacity);
            tween(opacity)
                .delay(0.06)
                .to(0.12, { opacity: 255 }, { easing: 'quadOut' })
                .start();
            tween(applyButton)
                .delay(0.06)
                .to(0.12, { scale: v3(baseScale.x * 1.05, baseScale.y * 1.05, baseScale.z) }, { easing: 'backOut' })
                .to(0.08, { scale: v3(baseScale.x, baseScale.y, baseScale.z) }, { easing: 'quadInOut' })
                .start();
        }
    },
    restoreHintPanelEntranceState: function (): void {
        const overlayOpacity = this.hintOverlayNode?.getComponent(UIOpacity) || null;
        const cowLayerOpacity = this.hintCowLayerNode?.getComponent(UIOpacity) || null;
        if (overlayOpacity) overlayOpacity.opacity = 255;
        if (cowLayerOpacity) cowLayerOpacity.opacity = 255;

        const nodes = [
            this.hintPanelNode?.getChildByName('dikuang') || null,
            this.getHintPanelApplyButton?.() || null,
        ];
        for (const node of nodes) {
            if (!node || !node.isValid) continue;
            const baseScale = this.getHintEntranceBaseScale(node);
            node.setScale(v3(baseScale.x, baseScale.y, baseScale.z));
            const opacity = node.getComponent(UIOpacity);
            if (opacity) opacity.opacity = 255;
        }
    },
    syncHintOverlayLayerSize: function () {
        const screenSize = getScreenSize();
        if (!screenSize) return screenSize;
        if (this.hintOverlayNode && this.hintOverlayNode.isValid) {
            this.hintOverlayNode.getComponent(CcUITransform)?.setContentSize(screenSize.width, screenSize.height);
        }
        if (this.hintCowLayerNode && this.hintCowLayerNode.isValid) {
            this.hintCowLayerNode.getComponent(CcUITransform)?.setContentSize(screenSize.width, screenSize.height);
        }
        return screenSize;
    },
    setHintPanelShown: function (shown: boolean) {
        if (!this.hintPanelNode || !this.hintPanelNode.isValid) {
            this.hintPanelNode = null;
            return;
        }
        if (shown) {
            if (this.hintPanelNode.parent && this.hintPanelOriginalSiblingIndex < 0) {
                this.hintPanelOriginalSiblingIndex = this.hintPanelNode.getSiblingIndex();
            }
            this.hintPanelNode.setSiblingIndex(100);
            this.hintPanelNode.active = true;
            this.setupHintOverlayLayer();
            this.prepareHintPanelEntrance?.();
            this.renderHintOverlay();
            this.playHintPanelEntrance?.();
        } else {
            this.stopHintPanelEntranceTweens?.();
            this.restoreHintPanelEntranceState?.();
            this.clearHintVisuals();
            if (this.hintOverlayGraphics) {
                this.hintOverlayGraphics.clear();
            }
            this.hintPanelNode.active = false;
            if (this.hintPanelNode.parent && this.hintPanelOriginalSiblingIndex >= 0) {
                this.hintPanelNode.setSiblingIndex(this.hintPanelOriginalSiblingIndex);
                this.hintPanelOriginalSiblingIndex = -1;
            }
        }
    },
    showHintVisuals: function (focusIndices: number[], actionIndices: number[]) {
        this.setupHintOverlayLayer();
        this.hintFocusIndices = this.uniqueValidIndices(focusIndices);
        this.hintActionIndices = this.uniqueValidIndices(actionIndices);
        this.startHintPulse();
        this.renderHintOverlay();
    },
    clearHintVisuals: function () {
        this.hintFocusIndices = [];
        this.hintActionIndices = [];
        this.hintPulseProgress = 0;
        if (this.hintOverlayGraphics) {
            this.hintOverlayGraphics.clear();
        }
        this.clearHintCowSprites();
        if (this.hintPulseState) {
            tween(this.hintPulseState).stop();
            this.hintPulseState = null;
        }
    },
    uniqueValidIndices: function (indices: number[]): number[] {
        const total = this.gridSize * this.gridSize;
        const seen = new Set<number>();
        const result: number[] = [];
        for (const raw of indices) {
            const index = Math.floor(raw);
            if (index < 0 || index >= total || seen.has(index)) continue;
            seen.add(index);
            result.push(index);
        }
        return result;
    },
    hasConfirmedHintTarget: function (): boolean {
        return this.hintTargetIndex >= 0 && this.hintFocusIndices.indexOf(this.hintTargetIndex) >= 0;
    },
    startHintPulse: function () {
        if (this.hintPulseState) {
            tween(this.hintPulseState).stop();
            this.hintPulseState = null;
        }
        if (this.hintActionIndices.length === 0 && !this.hasConfirmedHintTarget()) {
            this.hintPulseProgress = 0;
            return;
        }

        const state = { progress: 0 };
        const hasExcludePreview = ENABLE_EXCLUDE_HINT_PREVIEW_EFFECT && this.hasHintExcludePreviewTargets?.() === true;
        const pulseDuration = hasExcludePreview ? 0.42 : 0.9;
        this.hintPulseState = state;
        tween(state)
            .repeatForever(
                tween(state)
                    .to(pulseDuration, { progress: 1 }, {
                        easing: 'quadInOut',
                        onUpdate: () => {
                            this.hintPulseProgress = state.progress;
                            this.renderHintOverlay();
                        }
                    })
                    .to(pulseDuration, { progress: 0 }, {
                        easing: 'quadInOut',
                        onUpdate: () => {
                            this.hintPulseProgress = state.progress;
                            this.renderHintOverlay();
                        }
                    })
            )
            .start();
    },
    setupHintOverlayLayer: function () {
        if (!this.hintPanelNode) return;
        const screenSize = this.syncHintOverlayLayerSize();

        if (!this.hintLegacyOverlayNode) {
            const legacy = this.hintPanelNode.children.find(child => {
                const transform = child.getComponent(CcUITransform);
                const size = transform?.contentSize;
                return !!size && size.width >= this.CELEBRATION_WIDTH - 4 && size.height >= this.CELEBRATION_HEIGHT - 4;
            });
            this.hintLegacyOverlayNode = legacy || null;
        }
        if (this.hintLegacyOverlayNode) {
            this.hintLegacyOverlayNode.active = false;
        }

        if (!this.hintOverlayNode) {
            const node = new Node('HintOverlayGraphics');
            this.setUILayer(node);
            node.parent = this.hintPanelNode;
            node.addComponent(CcUITransform).setContentSize(screenSize.width, screenSize.height);
            node.setPosition(0, 0, 0);
            node.setSiblingIndex(0);
            this.hintOverlayNode = node;
            this.hintOverlayGraphics = node.addComponent(Graphics);
        }

        if (!this.hintCowLayerNode) {
            const cowLayer = new Node('HintCowLayer');
            this.setUILayer(cowLayer);
            cowLayer.parent = this.hintPanelNode;
            cowLayer.addComponent(CcUITransform).setContentSize(screenSize.width, screenSize.height);
            cowLayer.setPosition(0, 0, 0);
            cowLayer.setSiblingIndex(1);
            this.hintCowLayerNode = cowLayer;
        }
    },
    renderHintOverlay: function () {
        if (!this.hintPanelNode) return;
        this.setupHintOverlayLayer();
        const g = this.hintOverlayGraphics;
        if (!g) return;
        g.clear();
        this.hideHintCowSprites();
        const screenSize = this.syncHintOverlayLayerSize();

        if (this.hintFocusIndices.length === 0 && this.hintActionIndices.length === 0) {
            return;
        }

        const layout = this.getGridLayoutMetrics();
        const squareSize = layout.squareSize;
        const startX = layout.startX;
        const startY = layout.startY;

        g.fillColor = new Color(0, 0, 0, 142);
        g.rect(-screenSize.width / 2, -screenSize.height / 2, screenSize.width, screenSize.height);
        g.fill();

        const focusSet = new Set<number>(this.hintFocusIndices);
        const actionSet = new Set<number>(this.hintActionIndices);
        const allIndices = this.uniqueValidIndices([...this.hintFocusIndices, ...this.hintActionIndices]);
        for (const index of allIndices) {
            this.drawHintLiftedCell(g, index, startX, startY, squareSize, actionSet.has(index), focusSet.has(index));
        }
    },
    drawHintLiftedCell: function (g: Graphics, index: number, startX: number, startY: number, squareSize: number, isAction: boolean, isFocus: boolean) {
        const rect = this.getGridCellVisualRect(index, startX, startY, squareSize);
        const radius = this.getGridCellVisualRadius(index);
        const hasBalloon = this.hasVisibleBalloonCell(index);
        const isExcludePreview = ENABLE_EXCLUDE_HINT_PREVIEW_EFFECT && isAction && this.shouldDrawHintExcludePreview?.(index) === true;
        if (!hasBalloon) {
            this.drawCellBlock(g, rect.x, rect.y, rect.size, radius, this.gridColors[index]);
        }
        if (isExcludePreview) {
            this.drawHintExcludeTargetFill?.(g, rect.x, rect.y, rect.size, radius);
        }

        const centerX = rect.x + rect.size / 2;
        const centerY = rect.y + rect.size / 2;
        if (this.cowPositions[index] && this.revealedSquares[index]) {
            if (hasBalloon) {
                this.showHintBalloonVisual(index, centerX, centerY, rect.size);
            }
            this.showHintCowSprite(index, centerX, centerY, rect.size);
        } else if (hasBalloon) {
            this.showHintBalloonVisual(index, centerX, centerY, rect.size);
        } else if (this.revealedSquares[index]) {
            if (!this.cowPositions[index]) {
                this.drawHintOverlayX(g, rect.x, rect.y, rect.size, Color.RED);
            }
        } else if (this.clickedSquares[index]) {
            this.drawHintOverlayX(g, rect.x, rect.y, rect.size, Color.WHITE);
        }

        if (isAction) {
            this.drawHintActionPulse(g, rect.x, rect.y, rect.size, radius, isExcludePreview);
            if (isExcludePreview && !hasBalloon) {
                this.drawHintExcludePreviewX?.(g, rect.x, rect.y, rect.size);
            }
        } else if (isFocus && index === this.hintTargetIndex) {
            this.drawHintCowInnerPulse(g, rect.x, rect.y, rect.size, radius);
        } else if (isFocus) {
            g.strokeColor = new Color(255, 255, 255, 132);
            g.lineWidth = 3;
            g.roundRect(rect.x - 2, rect.y - 2, rect.size + 4, rect.size + 4, radius + 2);
            g.stroke();
        }
    },
    hasHintExcludePreviewTargets: function (): boolean {
        for (let i = 0; i < this.hintActionIndices.length; i++) {
            if (this.shouldDrawHintExcludePreview?.(this.hintActionIndices[i]) === true) {
                return true;
            }
        }
        return false;
    },
    shouldDrawHintExcludePreview: function (index: number): boolean {
        return this.hintActionIndices.indexOf(index) >= 0 && this.hintTargetIndex !== index;
    },
    drawHintExcludeTargetFill: function (g: Graphics, x: number, y: number, size: number, radius: number): void {
        const pulse = 0.35 + this.hintPulseProgress * 0.65;
        const inset = Math.max(3, size * 0.035);
        const alpha = Math.floor(42 + 34 * pulse);
        g.fillColor = new Color(255, 122, 44, alpha);
        g.roundRect(x + inset, y + inset, size - inset * 2, size - inset * 2, Math.max(4, radius - inset));
        g.fill();
    },
    drawHintExcludePreviewX: function (g: Graphics, x: number, y: number, size: number): void {
        const pulse = 0.35 + this.hintPulseProgress * 0.65;
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const halfLength = size * (0.2 + 0.025 * pulse);
        const thickness = Math.max(7, size * 0.09);

        g.lineCap = Graphics.LineCap.ROUND;
        g.lineJoin = Graphics.LineJoin.ROUND;
        g.lineWidth = thickness * 1.22;
        g.strokeColor = new Color(138, 78, 25, Math.floor(86 + 42 * pulse));
        g.moveTo(centerX - halfLength, centerY + halfLength);
        g.lineTo(centerX + halfLength, centerY - halfLength);
        g.moveTo(centerX - halfLength, centerY - halfLength);
        g.lineTo(centerX + halfLength, centerY + halfLength);
        g.stroke();

        g.lineWidth = thickness;
        g.strokeColor = new Color(255, 248, 220, Math.floor(176 + 58 * pulse));
        g.moveTo(centerX - halfLength, centerY + halfLength);
        g.lineTo(centerX + halfLength, centerY - halfLength);
        g.moveTo(centerX - halfLength, centerY - halfLength);
        g.lineTo(centerX + halfLength, centerY + halfLength);
        g.stroke();
    },
    hideHintCowSprites: function () {
        for (const node of this.hintCowSpriteNodes) {
            if (node && node.isValid) {
                node.active = false;
            }
        }
        for (const node of this.hintBalloonSpriteNodes) {
            if (node && node.isValid) {
                node.active = false;
            }
        }
    },
    clearHintCowSprites: function () {
        for (const node of this.hintCowSpriteNodes) {
            if (node && node.isValid) {
                node.destroy();
            }
        }
        for (const node of this.hintBalloonSpriteNodes) {
            if (node && node.isValid) {
                node.destroy();
            }
        }
        this.hintCowSpriteNodes = [];
        this.hintBalloonSpriteNodes = [];
    },
    showHintBalloonVisual: function (index: number, centerX: number, centerY: number, cellSize: number) {
        if (!this.hintCowLayerNode) return;
        const node = this.getHintBalloonSpriteNode(index);
        const transform = node.getComponent(CcUITransform);
        const graphics = node.getComponent(Graphics);
        const sprite = node.getComponent(Sprite);
        if (!transform || !graphics || !sprite) return;

        node.active = true;
        node.setPosition(this.snapPixelPosition(centerX), this.snapPixelPosition(centerY), 0);

        const visualSize = cellSize * this.getBalloonCellVisualScale(this.gridSize);
        const frame = this.getBalloonSpriteFrame(index);
        if (!frame) {
            graphics.clear();
            sprite.spriteFrame = null;
            node.active = false;
            return;
        }

        const fitted = this.getRawSpriteFrameFitSize(frame, visualSize, visualSize);
        transform.setContentSize(fitted.width, fitted.height);
        node.setScale(1, 1, 1);
        node.angle = 0;
        graphics.clear();
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        sprite.spriteFrame = frame;
        this.updateBalloonXOverlay(node, index, fitted.width, fitted.height);
        if (ENABLE_EXCLUDE_HINT_PREVIEW_EFFECT) {
            this.updateHintBalloonPreviewXOverlay?.(node, index, fitted.width, fitted.height);
        }
    },
    updateHintBalloonPreviewXOverlay: function (balloonNode: Node, index: number, width: number, height: number): void {
        if (this.shouldDrawHintExcludePreview?.(index) !== true) return;
        const xNode = this.getBalloonXOverlayNode?.(balloonNode) as Node | null;
        if (!xNode || !xNode.isValid) return;

        const pulse = 0.35 + this.hintPulseProgress * 0.65;
        const progress = 0.9 + pulse * 0.14;
        const color = new Color(255, 248, 220, Math.floor(174 + 60 * pulse));
        xNode.active = true;
        xNode.setSiblingIndex(20);
        xNode.getComponent(CcUITransform)?.setContentSize(width, height);
        const g = xNode.getComponent(Graphics);
        if (!g) return;
        this.drawBalloonXOnGraphics?.(g, width, height, progress, color, false);
    },
    getHintBalloonSpriteNode: function (index: number): Node {
        if (!this.hintBalloonSpriteNodes[index] || !this.hintBalloonSpriteNodes[index].isValid) {
            const node = new Node(`HintBalloon_${index}`);
            this.setUILayer(node);
            node.parent = this.hintCowLayerNode!;
            node.addComponent(CcUITransform);
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            node.addComponent(Graphics);
            this.hintBalloonSpriteNodes[index] = node;
        }
        return this.hintBalloonSpriteNodes[index];
    },
    showHintCowSprite: function (index: number, centerX: number, centerY: number, cellSize: number) {
        const frame = this.getCowRestSpriteFrame(index);
        if (!this.hintCowLayerNode || !frame) return;
        const node = this.getHintCowSpriteNode(index);
        const visualNode = node.getChildByName('CowVisual') || node;
        const visualTransform = visualNode.getComponent(CcUITransform);
        const sprite = visualNode.getComponent(Sprite);
        if (sprite) {
            sprite.trim = false;
            sprite.spriteFrame = frame;
        }

        node.active = true;
        node.setPosition(this.snapPixelPosition(centerX), this.snapPixelPosition(centerY), 0);
        node.getComponent(CcUITransform)?.setContentSize(this.snapPixelValue(cellSize), this.snapPixelValue(cellSize));

        const visualSize = cellSize * this.COW_HINT_VISUAL_SCALE;
        const fitted = this.getPixelPerfectFitSize(frame, visualSize, visualSize);
        visualTransform?.setContentSize(fitted.width, fitted.height);
        visualNode.setPosition(0, 0, 0);
        visualNode.setScale(1, 1, 1);
    },
    getHintCowSpriteNode: function (index: number): Node {
        if (!this.hintCowSpriteNodes[index] || !this.hintCowSpriteNodes[index].isValid) {
            const node = new Node(`HintCow_${index}`);
            this.setUILayer(node);
            node.parent = this.hintCowLayerNode!;
            node.addComponent(CcUITransform);

            const visualNode = new Node('CowVisual');
            this.setUILayer(visualNode);
            node.addChild(visualNode);
            visualNode.addComponent(CcUITransform);
            const sprite = visualNode.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            sprite.spriteFrame = this.getCowRestSpriteFrame(index);
            this.hintCowSpriteNodes[index] = node;
        }
        return this.hintCowSpriteNodes[index];
    },
    drawHintOverlayX: function (g: Graphics, x: number, y: number, size: number, color: Color) {
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        const halfLength = size * 0.18;
        const isErrorColor = !(color.r === 255 && color.g === 255 && color.b === 255);

        g.strokeColor = color;
        g.lineWidth = (isErrorColor ? 18 : 16) * (size / 140);
        g.lineCap = Graphics.LineCap.ROUND;
        g.lineJoin = Graphics.LineJoin.ROUND;
        g.moveTo(centerX - halfLength, centerY + halfLength);
        g.lineTo(centerX + halfLength, centerY - halfLength);
        g.moveTo(centerX - halfLength, centerY - halfLength);
        g.lineTo(centerX + halfLength, centerY + halfLength);
        g.stroke();
    },
    onHintApplyClick: function () {
        if (this.hintApplySequenceRunning) return;
        SfxManager.instance.playUiClick(); // UI点击音效
        const excludeTargets = this.collectHintApplyExcludeTargets?.() || [];
        if (excludeTargets.length > 0) {
            this.playHintApplyExcludeSequence?.(excludeTargets);
            return;
        }

        if (this.hintTargetIndex >= 0) {
            this.revealSquare(this.hintTargetIndex);
        }
        this.finishHintApplyPanel?.();
    },
    collectHintApplyExcludeTargets: function (): number[] {
        const targets: number[] = [];
        const addTarget = (index: number): void => {
            const total = this.gridSize * this.gridSize;
            if (index < 0 || index >= total) return;
            if (this.revealedSquares[index] || this.clickedSquares[index]) return;
            if (targets.indexOf(index) >= 0) return;
            targets.push(index);
        };

        if (this.hintOccupiedLineIndices.length > 0) {
            const n = this.gridSize;
            const total = n * n;
            const occupyingSet = new Set(this.hintOccupiedColors);
            const lineSet = new Set(this.hintOccupiedLineIndices);
            for (let i = 0; i < total; i++) {
                const inLine = this.hintOccupiedIsCol
                    ? lineSet.has(i % n)
                    : lineSet.has(Math.floor(i / n));
                if (!inLine || this.revealedSquares[i] || this.clickedSquares[i]) continue;
                if (occupyingSet.has(this.gridColors[i])) continue;
                addTarget(i);
            }
        } else if (this.hintRuleERowOrCol >= 0) {
            const n = this.gridSize;
            const total = n * n;
            for (let i = 0; i < total; i++) {
                const inLine = this.hintRuleEIsCol
                    ? (i % n) === this.hintRuleERowOrCol
                    : Math.floor(i / n) === this.hintRuleERowOrCol;
                if (inLine || this.revealedSquares[i] || this.clickedSquares[i]) continue;
                if (this.gridColors[i] !== this.hintRuleEColor) continue;
                addTarget(i);
            }
        } else if (this.hintColorOccupiedRowOrCol >= 0) {
            const n = this.gridSize;
            const total = n * n;
            for (let i = 0; i < total; i++) {
                const inLine = this.hintColorOccupiedIsCol
                    ? (i % n) === this.hintColorOccupiedRowOrCol
                    : Math.floor(i / n) === this.hintColorOccupiedRowOrCol;
                if (!inLine || this.revealedSquares[i] || this.clickedSquares[i]) continue;
                if (this.gridColors[i] === this.hintColorOccupiedColor) continue;
                addTarget(i);
            }
        } else if (this.hintExcludeNeighborCowIndex >= 0) {
            const n = this.gridSize;
            const neighbors = this.getNeighbors8(this.hintExcludeNeighborCowIndex, n);
            for (const i of neighbors) {
                addTarget(i);
            }
        } else if (this.hintExcludeCowIndex >= 0) {
            const n = this.gridSize;
            const row = Math.floor(this.hintExcludeCowIndex / n);
            const col = this.hintExcludeCowIndex % n;
            for (let c = 0; c < n; c++) {
                const i = row * n + c;
                if (i !== this.hintExcludeCowIndex) addTarget(i);
            }
            for (let r = 0; r < n; r++) {
                const i = r * n + col;
                if (i !== this.hintExcludeCowIndex) addTarget(i);
            }
        } else if (this.hintNeighborColorOnlyIndex >= 0) {
            addTarget(this.hintNeighborColorOnlyIndex);
        }

        return targets;
    },
    getHintApplyStepInterval: function (targetCount: number): number {
        if (targetCount <= 1) return 0;
        return 0.045;
    },
    setHintApplyButtonLocked: function (locked: boolean): void {
        const applyButton = this.getHintPanelApplyButton?.() || null;
        const button = applyButton?.getComponent(Button) || null;
        if (button) {
            button.interactable = !locked;
        }
    },
    playHintApplyExcludeSequence: function (targets: number[]): void {
        const validTargets = this.uniqueValidIndices(targets)
            .filter((index: number) => !this.revealedSquares[index] && !this.clickedSquares[index]);
        if (validTargets.length <= 0) {
            this.finishHintApplyPanel?.();
            return;
        }

        const sequenceTargets = validTargets.slice();
        this.finishHintApplyPanel?.();

        const version = (this.hintApplySequenceVersion || 0) + 1;
        this.hintApplySequenceVersion = version;
        this.hintApplySequenceRunning = true;
        this.hintApplyLastFeedbackTime = 0;
        this.setHintApplyButtonLocked?.(true);

        const firstDelay = 0.05;
        const stepInterval = this.getHintApplyStepInterval?.(sequenceTargets.length) ?? 0.045;
        sequenceTargets.forEach((index: number, order: number) => {
            this.scheduleOnce(() => {
                if (version !== this.hintApplySequenceVersion || this.isGameOver) return;
                if (this.revealedSquares[index] || this.clickedSquares[index]) return;
                this.updateSquare(index, true, true, true, true);
            }, firstDelay + order * stepInterval);
        });

        const closeDelay = firstDelay + Math.max(0, sequenceTargets.length - 1) * stepInterval + 0.08;
        this.scheduleOnce(() => {
            if (version !== this.hintApplySequenceVersion) return;
            this.hintApplySequenceRunning = false;
            this.hintApplyLastFeedbackTime = 0;
            this.setHintApplyButtonLocked?.(false);
            this.renderGrid();
        }, closeDelay);
    },
    finishHintApplyPanel: function (): void {
        this.hintApplySequenceVersion = (this.hintApplySequenceVersion || 0) + 1;
        this.hintApplySequenceRunning = false;
        this.hintApplyLastFeedbackTime = 0;
        this.setHintApplyButtonLocked?.(false);
        this.resetHintActionState();
        this.clearHintVisuals();
        this.setHintPanelShown(false);
        this.renderGrid();
    },
    resetHintActionState: function () {
        this.hintTargetIndex = -1;
        this.highlightIndex = -1;
        this.hintExcludeCowIndex = -1;
        this.hintExcludeNeighborCowIndex = -1;
        this.hintColorOccupiedRowOrCol = -1;
        this.hintColorOccupiedIsCol = false;
        this.hintColorOccupiedColor = '';
        this.hintRuleERowOrCol = -1;
        this.hintRuleEIsCol = false;
        this.hintRuleEColor = '';
        this.hintOccupiedLineIndices = [];
        this.hintOccupiedIsCol = false;
        this.hintOccupiedColors = [];
        this.hintNeighborColorOnlyIndex = -1;
        this.highlightIndices = [];
    },
    });
}
