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
type BalloonFloatState = {
    x: number;
    y: number;
    angle: number;
    scale: number;
};

type GuideActionMode = 'reveal' | 'mark' | 'confirm' | 'free';

export function installDrawGridGuide(target: any): void {
    Object.assign(target.prototype, {
    showGuide: function (step: number): void {
        this.guideStep = step;
        this.checkGuideIndex = [];
        this.clearGuideBacklights();
        this.buildGuideOverlay();
        this.setGuideGameplayChromeVisible?.(false);
        this.setGuideConfirmVisible(false);

        if (step === 0) {
            this.guideIndex = [1];
            this.updateGuideTip(this.GUIDE_TIPS[0], v3(0, 420, 0));
            this.showGuideFingerAt(1);
            this.addGuideBacklights(this.guideIndex);
        } else if (step === 1) {
            this.guideIndex = [];
            this.hideGuideFinger();
            this.updateGuideTip(this.GUIDE_TIPS[1], v3(0, 420, 0));
            this.addGuideBacklights(this.getSameColorCells(1));
            this.setGuideConfirmVisible(true);
        } else if (step === 2) {
            this.guideIndex = [0, 4, 5, 6, 2];
            this.updateGuideTip(this.GUIDE_TIPS[2], v3(0, 420, 0));
            this.showGuideFingerAt(this.getFirstIncompleteGuideCell());
            this.addGuideBacklights(this.guideIndex);
        } else if (step === 3) {
            this.guideIndex = [3, 9, 13];
            this.updateGuideTip(this.GUIDE_TIPS[3], v3(0, 420, 0));
            this.showGuideFingerAt(this.getFirstIncompleteGuideCell());
            this.addGuideBacklights(this.guideIndex);
        } else if (step === 4) {
            this.guideIndex = [14];
            this.updateGuideTip(this.GUIDE_TIPS[4], v3(0, 420, 0));
            this.showGuideFingerAt(14);
            this.addGuideBacklights(this.guideIndex);
        } else if (step === 5) {
            this.guideIndex = [];
            this.hideGuideFinger();
            this.updateGuideTip(this.GUIDE_TIPS[5], v3(0, 420, 0));
            this.showGuideHintEntry();
            this.releaseGuideToPlayer(true);
        }
    },
    getGuideActionMode: function (): GuideActionMode {
        if (!this._isGuideMode) return 'free';
        if (this.guideStep === 0 || this.guideStep === 4) return 'reveal';
        if (this.guideStep === 2 || this.guideStep === 3) return 'mark';
        if (this.guideStep === 1) return 'confirm';
        return 'free';
    },
    isGuideCellAllowed: function (index: number): boolean {
        const mode = this.getGuideActionMode();
        if (mode === 'free') return true;
        if (mode === 'confirm') return false;
        return this.guideIndex.indexOf(index) !== -1;
    },
    onGuideReveal: function (index: number): void {
        if (!this._isGuideMode || this.getGuideActionMode() !== 'reveal') return;
        if (this.guideIndex.indexOf(index) === -1) return;
        this.scheduleOnce(() => {
            this.showGuide(this.guideStep + 1);
        }, 0.18);
    },
    onGuideMark: function (index: number): void {
        if (!this._isGuideMode || this.getGuideActionMode() !== 'mark') return;
        if (this.guideIndex.indexOf(index) === -1 || !this.clickedSquares[index]) return;
        if (this.checkGuideIndex.indexOf(index) === -1) {
            this.checkGuideIndex.push(index);
        }
        const requiredCount = this.getGuideRequiredMarkCount();
        if (this.checkGuideIndex.length >= requiredCount) {
            this.showWorkplaceToast('不错！', v3(0, 260, 0), new Color(255, 238, 92, 255));
            this.scheduleOnce(() => this.showGuide(this.guideStep + 1), 0.18);
        } else {
            const remaining = this.getIncompleteGuideCells();
            this.showGuideFingerAt(remaining[0]);
        }
    },
    getGuideRequiredMarkCount: function (): number {
        return Math.max(1, this.guideIndex.length);
    },
    resetGuideRuntimeState: function (keepWhiteBackground: boolean = false): void {
        this._isGuideMode = false;
        this._isSwipeGuideMode = false;
        this.guideStep = 0;
        this.guideIndex = [];
        this.checkGuideIndex = [];
        this.clearGuideOverlay?.(keepWhiteBackground);
        this.setHintPanelShown?.(false);
        this.clearHintVisuals?.();
        this.resetHintActionState?.();
        this.closeHintPurchasePanel?.();
        if (typeof this.resetSwipeTracking === 'function') {
            this.resetSwipeTracking();
        } else {
            this.isSwiping = false;
            this.swipeTargetState = false;
            this.processedInCurrentSwipe?.clear?.();
        }
        this.lastTapTime = 0;
        this.lastTapIndex = -1;
        this.pendingSingleTapIndex = -1;
        if (this.pendingSingleTapTimeout) {
            clearTimeout(this.pendingSingleTapTimeout);
            this.pendingSingleTapTimeout = 0;
        }
    },
    setGuideGameplayChromeVisible: function (visible: boolean): void {
        const setNodeActive = (node: Node | null | undefined, active: boolean): void => {
            if (node && node.isValid) node.active = active;
        };
        const setLabelActive = (label: Label | null | undefined, active: boolean): void => {
            setNodeActive(label?.node || null, active);
        };
        const canvas = director.getScene()?.getChildByName('Canvas');
        const globalHud = GameApp.globalHud as { node?: Node } | null;
        const coinLabelNode = this.coinLabel?.node || null;
        const coinNode = (coinLabelNode?.parent && coinLabelNode.parent.isValid) ? coinLabelNode.parent : coinLabelNode;

        setLabelActive(this.levelLabel, visible);
        setNodeActive(this.heartContainer, visible);
        const remainingNode = this.remainingCowsLabel?.node || null;
        setNodeActive((remainingNode?.parent && remainingNode.parent.isValid) ? remainingNode.parent : remainingNode, visible);
        setNodeActive(coinNode, visible);
        setNodeActive(this.ruleBoxNode, visible);
        setNodeActive(this.toolbarContainer, visible);
        setNodeActive(this.hintPanelNode, false);
        setNodeActive(this.debugPanelNode, false);
        setNodeActive(this.gameplaySettingButton, visible);
        if (!visible) {
            setNodeActive(this.staticGameplayBackgroundNode, false);
        }
        setNodeActive(globalHud?.node, visible);
        const splash = canvas?.getChildByName('SpriteSplash') || null;
        if (splash && splash.isValid) {
            if (visible) {
                splash.active = true;
            } else {
                let guidePathChild: Node | null = null;
                let cursor: Node | null = this.node;
                while (cursor && cursor.parent) {
                    if (cursor.parent === splash) {
                        guidePathChild = cursor;
                        break;
                    }
                    cursor = cursor.parent;
                }
                if (guidePathChild) {
                    splash.active = true;
                    for (const child of splash.children) {
                        child.active = child === guidePathChild || child === this.guideWhiteBackgroundNode;
                    }
                } else {
                    splash.active = false;
                }
            }
        }
        for (let i = 0; i < this.coordinateNodes.length; i++) {
            setNodeActive(this.coordinateNodes[i], visible && this.showCoordinates);
        }
    },
    getIncompleteGuideCells: function (): number[] {
        return this.guideIndex.filter((index: number) => !this.clickedSquares[index] && !this.revealedSquares[index]);
    },
    getFirstIncompleteGuideCell: function (): number {
        const remaining = this.getIncompleteGuideCells();
        return remaining.length > 0 ? remaining[0] : this.guideIndex[0];
    },
    releaseGuideToPlayer: function (keepGuideScene: boolean = false): void {
        this._isGuideMode = false;
        this.guideStep = 5;
        this.guideIndex = [];
        this.checkGuideIndex = [];
        GameApp.isGuideSettlement = keepGuideScene === true;
        GameApp.user.level = keepGuideScene ? 1 : Math.max(1, GameApp.user.level || 1);
        GameApp.user.firstGame = 2;
        GameApp.user.save();
        this.saveGameData();
        if (keepGuideScene) {
            this.setGuideGameplayChromeVisible?.(false);
            return;
        }
        this.setGameUIVisible(true);
        this.setGuideGameplayChromeVisible?.(true);
        this.clearGuideOverlay();
    },
    finishGuideMode: function (): void {
        this.releaseGuideToPlayer();
    },
    showSwipeGuide: function (): void {
        if (GameApp.gameMode !== GameMode.level || GameApp.user.firstGame !== 1) return;
        const cowIndex = this.revealedSquares.findIndex((revealed: boolean, index: number) => revealed && this.cowPositions[index]);
        if (cowIndex < 0) return;
        this._isSwipeGuideMode = true;
        this.guideStep = 20;
        this.guideIndex = this.getCardinalNeighborCells(cowIndex).filter((index: number) => !this.revealedSquares[index]);
        this.checkGuideIndex = this.guideIndex.filter((index: number) => this.clickedSquares[index]);
        this.buildGuideOverlay();
        this.setGuideConfirmVisible(false);
        this.updateGuideTip('占座目标周围不能再有目标。\n按住格子滑动，批量排除周围位置', v3(0, 335, 0));
        this.addGuideBacklights(this.guideIndex);
        this.showGuideFingerAt(this.getFirstIncompleteGuideCell());
    },
    onSwipeGuideMark: function (index: number): void {
        if (!this._isSwipeGuideMode || this.guideIndex.indexOf(index) === -1 || !this.clickedSquares[index]) return;
        if (this.checkGuideIndex.indexOf(index) === -1) {
            this.checkGuideIndex.push(index);
        }
        const remaining = this.getIncompleteGuideCells();
        if (remaining.length === 0) {
            this._isSwipeGuideMode = false;
            GameApp.user.firstGame = 2;
            GameApp.user.save();
            this.showWorkplaceToast('滑动排除已学会', v3(0, 260, 0), new Color(255, 238, 92, 255));
            this.scheduleOnce(() => this.clearGuideOverlay(), 0.8);
        } else {
            this.showGuideFingerAt(remaining[0]);
        }
    },
    getSameColorCells: function (index: number): number[] {
        const color = this.gridColors[index];
        return this.gridColors
            .map((value: string, cellIndex: number) => value === color ? cellIndex : -1)
            .filter((cellIndex: number) => cellIndex >= 0);
    },
    getCardinalNeighborCells: function (index: number): number[] {
        const row = Math.floor(index / this.gridSize);
        const col = index % this.gridSize;
        const cells: number[] = [];
        const offsets = [
            { r: -1, c: 0 },
            { r: 1, c: 0 },
            { r: 0, c: -1 },
            { r: 0, c: 1 },
        ];
        offsets.forEach(offset => {
            const r = row + offset.r;
            const c = col + offset.c;
            if (r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize) {
                cells.push(r * this.gridSize + c);
            }
        });
        return cells;
    },
    checkArrayEqual: function (a: number[], b: number[]): boolean {
        if (a.length !== b.length) return false;
        const setA = new Set(a);
        const setB = new Set(b);
        if (setA.size !== setB.size) return false;
        for (const v of setA) {
            if (!setB.has(v)) return false;
        }
        return true;
    },
    buildGuideOverlay: function (): void {
        if (this.guideOverlayNode && this.guideOverlayNode.isValid) return;

        const canvas = director.getScene()?.getChildByName('Canvas');
        if (!canvas) return;
        this.buildGuideWhiteBackground();

        const overlay = createNode('GuideOverlay', canvas);
        overlay.layer = Layers.Enum.UI_2D;
        overlay.setSiblingIndex(999);

        const bgNode = createNode('GuideSoftMask', overlay);
        bgNode.addComponent(CcUITransform).setContentSize(1, 1);

        const tipCard = createNode('GuideTipCard', overlay);
        tipCard.layer = Layers.Enum.UI_2D;
        tipCard.addComponent(CcUITransform).setContentSize(560, 118);
        tipCard.addComponent(Graphics);
        this.guideTipCardNode = tipCard;

        const tipLabelNode = createNode('guideTip', tipCard);
        tipLabelNode.layer = Layers.Enum.UI_2D;
        tipLabelNode.setPosition(0, 0, 0);
        tipLabelNode.getComponent(CcUITransform)?.setContentSize(500, 90);
        const tipLabel = tipLabelNode.addComponent(Label);
        tipLabel.fontSize = 30;
        tipLabel.lineHeight = 40;
        tipLabel.string = '';
        tipLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        tipLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this.guideTipLabel = tipLabel;
        this.guideTipTextRootNode = tipLabelNode;
        this.guideTipSegmentNodes = [];

        const confirm = createNode('GuideConfirmButton', overlay);
        confirm.layer = Layers.Enum.UI_2D;
        confirm.addComponent(CcUITransform).setContentSize(210, 78);
        confirm.addComponent(Graphics);
        const confirmLabel = createLabel('GuideConfirmLabel', confirm, '明白了', 30, COLOR_WHITE, true);
        confirmLabel.node.getComponent(CcUITransform)?.setContentSize(190, 58);
        confirm.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
            SfxManager.instance.playUiClick();
            this.showGuide(2);
        }, this);
        this.guideConfirmButtonNode = confirm;

        const finger = createNode('guideFinger', overlay);
        finger.layer = Layers.Enum.UI_2D;
        finger.active = false;
        (finger.getComponent(CcUITransform) || finger.addComponent(CcUITransform)).setContentSize(150, 150);
        const fingerSprite = finger.addComponent(Sprite);
        fingerSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        fingerSprite.trim = false;
        const placeholder = createNode('guideFingerPlaceholder', finger);
        placeholder.layer = Layers.Enum.UI_2D;
        placeholder.active = false;
        const fingerG = placeholder.addComponent(Graphics);
        this.drawFingerIcon(fingerG);
        AssetService.loadSpriteFrame('guide/guide_finger', (frame: SpriteFrame | null) => {
            if (!finger.isValid) return;
            if (!frame) {
                console.error('[DrawGridGuide] required guide finger sprite missing: guide/guide_finger');
                return;
            }
            fingerSprite.spriteFrame = frame;
            placeholder.active = false;
            finger.setSiblingIndex(finger.parent ? Math.max(0, finger.parent.children.length - 1) : 0);
        }, 'smooth');
        this.guideFingerNode = finger;

        this.guideOverlayNode = overlay;
        this.drawGuideTipCard();
        this.drawGuideConfirmButton();
        this.setGuideConfirmVisible(false);
    },
    buildGuideWhiteBackground: function (): void {
        const canvas = director.getScene()?.getChildByName('Canvas');
        if (!canvas) return;

        const screenSize = getScreenSize();
        let guideRoot: Node = this.node;
        while (guideRoot.parent && guideRoot.parent !== canvas) {
            guideRoot = guideRoot.parent;
        }
        const parent = guideRoot.parent && guideRoot.parent.isValid ? guideRoot.parent : canvas;
        let bgNode = this.guideWhiteBackgroundNode as Node | null;
        if (!bgNode || !bgNode.isValid || bgNode.parent !== parent) {
            if (bgNode && bgNode.isValid) {
                bgNode.destroy();
            }
            bgNode = createNode('GuideWhiteBackground', parent);
            bgNode.layer = Layers.Enum.UI_2D;
            bgNode.addComponent(CcUITransform);
            bgNode.addComponent(Graphics);
            this.guideWhiteBackgroundNode = bgNode;
        }

        bgNode.active = true;
        bgNode.setPosition(v3(0, 0, 0));
        bgNode.setSiblingIndex(Math.max(0, guideRoot.getSiblingIndex()));
        if (bgNode.parent === guideRoot.parent && bgNode.getSiblingIndex() >= guideRoot.getSiblingIndex()) {
            guideRoot.setSiblingIndex(bgNode.getSiblingIndex() + 1);
        }
        const transform = bgNode.getComponent(CcUITransform) || bgNode.addComponent(CcUITransform);
        transform.setContentSize(screenSize.width, screenSize.height);
        const g = bgNode.getComponent(Graphics) || bgNode.addComponent(Graphics);
        g.clear();
        g.fillColor = new Color(255, 255, 255, 255);
        g.rect(-screenSize.width / 2, -screenSize.height / 2, screenSize.width, screenSize.height);
        g.fill();
    },
    clearGuideWhiteBackground: function (): void {
        const bgNode = this.guideWhiteBackgroundNode as Node | null;
        if (bgNode && bgNode.isValid) {
            bgNode.destroy();
        }
        this.guideWhiteBackgroundNode = null;
    },
    getGuideTipLineWeight: function (text: string): number {
        let weight = 0;
        for (const char of text) {
            weight += /[ -~]/.test(char) ? 0.55 : 1;
        }
        return weight;
    },
    wrapGuideTipText: function (text: string): string[] {
        const maxWeight = 15;
        const output: string[] = [];
        const sourceLines = `${text || ''}`.split('\n');
        sourceLines.forEach((sourceLine: string) => {
            let line = '';
            let weight = 0;
            for (const char of sourceLine) {
                const charWeight = /[ -~]/.test(char) ? 0.55 : 1;
                if (line && weight + charWeight > maxWeight) {
                    output.push(line);
                    line = '';
                    weight = 0;
                }
                line += char;
                weight += charWeight;
            }
            output.push(line);
        });
        return output.length > 0 ? output : [''];
    },
    clearGuideTipSegments: function (): void {
        const nodes = (this.guideTipSegmentNodes || []) as Node[];
        nodes.forEach((node: Node) => {
            if (node && node.isValid) node.destroy();
        });
        this.guideTipSegmentNodes = [];
    },
    getGuideTipSegmentWidth: function (text: string, fontSize: number): number {
        return Math.max(8, Math.ceil(this.getGuideTipLineWeight(text) * fontSize + 8));
    },
    splitGuideTipLineSegments: function (line: string): Array<{ text: string; color: Color }> {
        const segments: Array<{ text: string; color: Color }> = [];
        const normalColor = new Color(36, 45, 64, 255);
        const highlightColor = new Color(229, 72, 72, 255);
        const keywords = ['连点', '单击'];
        let rest = `${line || ''}`;
        while (rest.length > 0) {
            let matchIndex = -1;
            let matchKeyword = '';
            keywords.forEach((keyword: string) => {
                const index = rest.indexOf(keyword);
                if (index >= 0 && (matchIndex < 0 || index < matchIndex)) {
                    matchIndex = index;
                    matchKeyword = keyword;
                }
            });
            if (matchIndex < 0) {
                segments.push({ text: rest, color: normalColor });
                break;
            }
            if (matchIndex > 0) {
                segments.push({ text: rest.slice(0, matchIndex), color: normalColor });
            }
            segments.push({ text: matchKeyword, color: highlightColor });
            rest = rest.slice(matchIndex + matchKeyword.length);
        }
        return segments.length > 0 ? segments : [{ text: '', color: normalColor }];
    },
    renderGuideTipSegments: function (lines: string[], contentWidth: number, fontSize: number, lineHeight: number): void {
        const root = this.guideTipTextRootNode as Node | null;
        if (!root || !root.isValid) return;
        this.clearGuideTipSegments?.();
        if (this.guideTipLabel) {
            this.guideTipLabel.string = '';
            this.guideTipLabel.fontSize = fontSize;
            this.guideTipLabel.lineHeight = lineHeight;
        }

        const startY = (lines.length - 1) * lineHeight / 2;
        lines.forEach((line: string, lineIndex: number) => {
            const segments = this.splitGuideTipLineSegments(line);
            const widths = segments.map((segment: { text: string; color: Color }) => this.getGuideTipSegmentWidth(segment.text, fontSize));
            const lineWidth = Math.min(contentWidth, widths.reduce((sum: number, width: number) => sum + width, 0));
            let cursorX = -lineWidth / 2;
            const y = startY - lineIndex * lineHeight;
            segments.forEach((segment: { text: string; color: Color }, segmentIndex: number) => {
                const width = widths[segmentIndex];
                const node = createNode(`GuideTipSegment_${lineIndex}_${segmentIndex}`, root);
                node.layer = Layers.Enum.UI_2D;
                node.getComponent(CcUITransform)?.setContentSize(width, lineHeight);
                node.setPosition(cursorX + width / 2, y, 0);
                const label = node.addComponent(Label);
                label.string = segment.text;
                label.fontSize = fontSize;
                label.lineHeight = lineHeight;
                label.isBold = true;
                label.color = segment.color;
                label.horizontalAlign = Label.HorizontalAlign.CENTER;
                label.verticalAlign = Label.VerticalAlign.CENTER;
                this.guideTipSegmentNodes.push(node);
                cursorX += width;
            });
        });
    },
    updateGuideTipLayout: function (lines: string[]): void {
        if (!this.guideTipCardNode || !this.guideTipCardNode.isValid || !this.guideTipTextRootNode) return;
        const fontSize = 30;
        const lineHeight = 40;
        const longestWeight = Math.max(...lines.map((line: string) => this.getGuideTipLineWeight(line)), 6);
        const width = Math.max(360, Math.min(660, Math.ceil(longestWeight * 34 + 82)));
        const height = Math.max(112, Math.ceil(lines.length * lineHeight + 52));
        const cardTransform = this.guideTipCardNode.getComponent(CcUITransform) || this.guideTipCardNode.addComponent(CcUITransform);
        cardTransform.setContentSize(width, height);

        const contentWidth = width - 64;
        const labelNode = this.guideTipTextRootNode as Node;
        labelNode.setPosition(0, 0, 0);
        labelNode.getComponent(CcUITransform)?.setContentSize(contentWidth, height - 30);
        this.renderGuideTipSegments(lines, contentWidth, fontSize, lineHeight);
    },
    drawGuideTipCard: function (): void {
        const node = this.guideTipCardNode;
        if (!node || !node.isValid) return;
        const transform = node.getComponent(CcUITransform);
        const g = node.getComponent(Graphics);
        if (!transform || !g) return;
        const width = transform.contentSize.width;
        const height = transform.contentSize.height;
        g.clear();
        g.fillColor = new Color(0, 0, 0, 28);
        g.roundRect(-width / 2 + 5, -height / 2 - 7, width, height, 24);
        g.fill();
        g.fillColor = new Color(255, 255, 255, 248);
        g.roundRect(-width / 2, -height / 2, width, height, 24);
        g.fill();
        g.strokeColor = new Color(220, 226, 235, 255);
        g.lineWidth = 4;
        g.roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 22);
        g.stroke();
    },
    drawGuideConfirmButton: function (): void {
        const node = this.guideConfirmButtonNode;
        if (!node || !node.isValid) return;
        const g = node.getComponent(Graphics);
        if (!g) return;
        g.clear();
        g.fillColor = new Color(0, 76, 160, 45);
        g.roundRect(-104, -42, 210, 74, 29);
        g.fill();
        g.fillColor = new Color(55, 144, 236, 255);
        g.roundRect(-105, -34, 210, 68, 28);
        g.fill();
        g.fillColor = new Color(92, 184, 255, 92);
        g.roundRect(-91, 3, 182, 18, 9);
        g.fill();
    },
    showGuideHintEntry: function (): void {
        if (!this.guideOverlayNode || !this.guideOverlayNode.isValid) return;
        const text = '如需提示，请点击此处。';
        const fontSize = 30;
        const width = 590;
        const height = 118;
        const labelWidth = 410;

        if (this.guideHintEntryNode && this.guideHintEntryNode.isValid) {
            this.guideHintEntryNode.active = true;
            this.guideHintEntryNode.getComponent(CcUITransform)?.setContentSize(width, height);
            const label = this.guideHintEntryNode.getChildByName('GuideHintEntryLabel')?.getComponent(Label);
            if (label) {
                label.string = text;
                label.fontSize = fontSize;
                label.lineHeight = 40;
                label.node.setPosition(-80, 0, 0);
                label.node.getComponent(CcUITransform)?.setContentSize(labelWidth, 68);
            }
            const icon = this.guideHintEntryNode.getChildByName('GuideHintEntryIcon');
            if (icon) icon.setPosition(v3(208, 2, 0));
            this.drawGuideHintEntryCard();
            return;
        }

        const node = createNode('GuideHintEntry', this.guideOverlayNode);
        node.layer = Layers.Enum.UI_2D;
        node.setPosition(v3(0, -545, 0));
        (node.getComponent(CcUITransform) || node.addComponent(CcUITransform)).setContentSize(width, height);
        node.addComponent(Graphics);
        node.on(Node.EventType.TOUCH_START, (event: EventTouch) => { event.propagationStopped = true; }, this);
        node.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => { event.propagationStopped = true; }, this);
        node.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => { event.propagationStopped = true; }, this);
        node.on(Node.EventType.TOUCH_END, this.onGuideHintEntryClick, this);
        this.guideHintEntryNode = node;

        const label = createLabel('GuideHintEntryLabel', node, text, fontSize, new Color(72, 78, 88, 255), true);
        label.lineHeight = 40;
        label.node.setPosition(-80, 0, 0);
        label.node.getComponent(CcUITransform)?.setContentSize(labelWidth, 68);

        const icon = createNode('GuideHintEntryIcon', node);
        icon.layer = Layers.Enum.UI_2D;
        icon.setPosition(v3(208, 2, 0));
        const iconG = icon.addComponent(Graphics);
        this.drawGuideHintEntryIcon(iconG);
        this.drawGuideHintEntryCard();
    },
    onGuideHintEntryClick: function (event: EventTouch): void {
        event.propagationStopped = true;
        SfxManager.instance.playUiClick();
        if (this.showGuideFinalCowHint?.()) return;
        this.showWorkplaceToast('这一步先自己想想', v3(0, 300, 0), new Color(180, 190, 205, 255));
    },
    showGuideFinalCowHint: function (): boolean {
        if (this.isGameOver) return false;
        this.clearHintVisuals?.();
        this.resetHintActionState?.();

        const hiddenCows = this.cowPositions
            .map((hasCow: boolean, index: number) => hasCow && !this.revealedSquares[index] ? index : -1)
            .filter((index: number) => index >= 0);
        if (hiddenCows.length === 0) return false;

        const unmarkedHiddenCows = hiddenCows.filter((index: number) => !this.clickedSquares[index]);
        const targetIndex = unmarkedHiddenCows.length > 0 ? unmarkedHiddenCows[0] : hiddenCows[0];
        if (this.clickedSquares[targetIndex]) {
            this.updateSquare(targetIndex, false, false, true, true);
        }

        this.hintTargetIndex = targetIndex;
        this.highlightIndex = targetIndex;
        this.highlightIndices = [];
        this.showHintVisuals([targetIndex], []);

        const label = this.hintPanelNode?.getComponentInChildren(Label);
        if (label) {
            const cellName = typeof this.getHintColorCellNameByIndex === 'function'
                ? this.getHintColorCellNameByIndex(targetIndex)
                : '高亮座位';
            label.string = `${cellName || '高亮座位'}可能是占座目标；点一键应用，或连点高亮座位把它找出来。`;
        }
        this.setHintPanelShown?.(true);
        if (this.guideTipCardNode && this.guideTipCardNode.isValid) {
            this.guideTipCardNode.setSiblingIndex(0);
        }
        if (this.guideHintEntryNode && this.guideHintEntryNode.isValid) {
            this.guideHintEntryNode.setSiblingIndex(1);
        }
        if (this.hintPanelNode?.parent && this.guideOverlayNode?.parent === this.hintPanelNode.parent) {
            this.guideOverlayNode.setSiblingIndex(Math.max(0, this.hintPanelNode.getSiblingIndex() - 1));
            this.hintPanelNode.setSiblingIndex(this.guideOverlayNode.getSiblingIndex() + 1);
        }
        this.showWorkplaceToast('连点这里找出占座目标', v3(0, 300, 0), new Color(255, 238, 92, 255));
        this.renderGrid();
        return true;
    },
    showGuideExcludeHint: function (): boolean {
        if (this.isGameOver) return false;
        this.clearHintVisuals?.();
        this.resetHintActionState?.();

        const n = this.gridSize;
        const total = n * n;
        const isActionable = (index: number): boolean => {
            return index >= 0 && index < total && !this.revealedSquares[index] && !this.clickedSquares[index];
        };
        const unique = (indices: number[]): number[] => {
            const seen = new Set<number>();
            const result: number[] = [];
            indices.forEach(index => {
                if (!isActionable(index) || seen.has(index)) return;
                seen.add(index);
                result.push(index);
            });
            return result;
        };
        const knownCows = this.revealedSquares
            .map((revealed: boolean, index: number) => revealed && this.cowPositions[index] ? index : -1)
            .filter((index: number) => index >= 0);

        const show = (cowIndex: number, indices: number[], neighborMode: boolean): boolean => {
            const actionIndices = unique(indices);
            if (actionIndices.length === 0) return false;
            this.hintTargetIndex = -1;
            this.highlightIndex = -1;
            this.hintExcludeCowIndex = neighborMode ? -1 : cowIndex;
            this.hintExcludeNeighborCowIndex = neighborMode ? cowIndex : -1;
            this.highlightIndices = actionIndices;
            this.showHintVisuals([cowIndex], actionIndices);
            this.setHintPanelShown?.(true);
            if (this.guideTipCardNode && this.guideTipCardNode.isValid) {
                this.guideTipCardNode.setSiblingIndex(0);
            }
            if (this.guideHintEntryNode && this.guideHintEntryNode.isValid) {
                this.guideHintEntryNode.setSiblingIndex(1);
            }
            if (this.hintPanelNode?.parent && this.guideOverlayNode?.parent === this.hintPanelNode.parent) {
                this.guideOverlayNode.setSiblingIndex(Math.max(0, this.hintPanelNode.getSiblingIndex() - 1));
                this.hintPanelNode.setSiblingIndex(this.guideOverlayNode.getSiblingIndex() + 1);
            }
            this.showWorkplaceToast('这些格子可以先排除', v3(0, 300, 0), new Color(255, 238, 92, 255));
            this.renderGrid();
            return true;
        };

        for (const cowIndex of knownCows) {
            const row = Math.floor(cowIndex / n);
            const col = cowIndex % n;
            const lineIndices: number[] = [];
            for (let c = 0; c < n; c++) lineIndices.push(row * n + c);
            for (let r = 0; r < n; r++) lineIndices.push(r * n + col);
            if (show(cowIndex, lineIndices.filter(index => index !== cowIndex), false)) return true;
        }

        for (const cowIndex of knownCows) {
            const row = Math.floor(cowIndex / n);
            const col = cowIndex % n;
            const neighbors: number[] = [];
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const r = row + dr;
                    const c = col + dc;
                    if (r >= 0 && r < n && c >= 0 && c < n) neighbors.push(r * n + c);
                }
            }
            if (show(cowIndex, neighbors, true)) return true;
        }

        const hiddenCows = this.cowPositions
            .map((hasCow: boolean, index: number) => hasCow && !this.revealedSquares[index] ? index : -1)
            .filter((index: number) => index >= 0);
        if (hiddenCows.length > 0) {
            const clickedHiddenCows = hiddenCows.filter((index: number) => this.clickedSquares[index]);
            const focusIndices = clickedHiddenCows.length > 0 ? clickedHiddenCows : hiddenCows;
            focusIndices.forEach((index: number) => {
                if (this.clickedSquares[index]) {
                    this.updateSquare(index, false, false, true, true);
                }
            });
            const targetIndex = focusIndices[0];
            this.hintTargetIndex = targetIndex;
            this.highlightIndex = targetIndex;
            this.hintExcludeCowIndex = -1;
            this.hintExcludeNeighborCowIndex = -1;
            this.highlightIndices = [];
            this.showHintVisuals(focusIndices, []);
            this.setHintPanelShown?.(true);
            if (this.guideTipCardNode && this.guideTipCardNode.isValid) {
                this.guideTipCardNode.setSiblingIndex(0);
            }
            if (this.guideHintEntryNode && this.guideHintEntryNode.isValid) {
                this.guideHintEntryNode.setSiblingIndex(1);
            }
            if (this.hintPanelNode?.parent && this.guideOverlayNode?.parent === this.hintPanelNode.parent) {
                this.guideOverlayNode.setSiblingIndex(Math.max(0, this.hintPanelNode.getSiblingIndex() - 1));
                this.hintPanelNode.setSiblingIndex(this.guideOverlayNode.getSiblingIndex() + 1);
            }
            this.showWorkplaceToast('这些座位可能是目标，连点找出来', v3(0, 300, 0), new Color(255, 238, 92, 255));
            this.renderGrid();
            return true;
        }

        return false;
    },
    hideGuideHintEntry: function (): void {
        if (this.guideHintEntryNode && this.guideHintEntryNode.isValid) {
            this.guideHintEntryNode.active = false;
        }
    },
    drawGuideHintEntryCard: function (): void {
        const node = this.guideHintEntryNode as Node | null;
        if (!node || !node.isValid) return;
        const transform = node.getComponent(CcUITransform);
        const g = node.getComponent(Graphics);
        if (!transform || !g) return;
        const width = transform.contentSize.width;
        const height = transform.contentSize.height;
        g.clear();
        g.fillColor = new Color(0, 0, 0, 42);
        g.roundRect(-width / 2 + 6, -height / 2 - 9, width, height, 32);
        g.fill();
        g.fillColor = new Color(255, 255, 255, 255);
        g.roundRect(-width / 2, -height / 2, width, height, 32);
        g.fill();
        g.strokeColor = new Color(222, 228, 238, 255);
        g.lineWidth = 4;
        g.roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 30);
        g.stroke();
    },
    drawGuideHintEntryIcon: function (g: Graphics): void {
        g.clear();
        g.fillColor = new Color(255, 225, 44, 255);
        g.circle(0, 10, 23);
        g.fill();
        g.fillColor = new Color(255, 247, 134, 190);
        g.circle(-8, 18, 8);
        g.fill();
        g.strokeColor = new Color(255, 217, 30, 255);
        g.lineWidth = 4;
        g.moveTo(-24, 34);
        g.lineTo(-34, 46);
        g.moveTo(0, 40);
        g.lineTo(0, 55);
        g.moveTo(24, 34);
        g.lineTo(34, 46);
        g.stroke();
        g.fillColor = new Color(168, 181, 196, 255);
        g.roundRect(-14, -20, 28, 20, 7);
        g.fill();
        g.fillColor = new Color(123, 138, 156, 255);
        g.roundRect(-10, -31, 20, 12, 5);
        g.fill();
    },
    setGuideConfirmVisible: function (visible: boolean): void {
        if (this.guideConfirmButtonNode && this.guideConfirmButtonNode.isValid) {
            this.guideConfirmButtonNode.active = visible;
            if (visible && this.guideTipCardNode && this.guideTipCardNode.isValid) {
                const cardHeight = this.guideTipCardNode.getComponent(CcUITransform)?.contentSize.height || 92;
                this.guideConfirmButtonNode.setPosition(this.guideTipCardNode.position.x, this.guideTipCardNode.position.y - cardHeight / 2 - 62, 0);
            }
        }
    },
    drawFingerIcon: function (g: Graphics): void {
        g.clear();
        g.fillColor = new Color(40, 132, 255, 48);
        g.circle(0, 0, 32);
        g.fill();
        g.strokeColor = new Color(40, 132, 255, 230);
        g.lineWidth = 5;
        g.circle(0, 0, 24);
        g.stroke();
        g.strokeColor = new Color(255, 255, 255, 235);
        g.lineWidth = 4;
        g.circle(0, 0, 15);
        g.stroke();
        g.fillColor = new Color(255, 255, 255, 255);
        g.circle(0, 0, 8);
        g.fill();
    },
    showGuideFingerAt: function (cellIndex: number): void {
        if (!this.guideFingerNode || cellIndex < 0) return;
        const localPos = this.getGuideCellCanvasPosition(cellIndex);
        if (!localPos) return;
        this.guideFingerNode.active = true;
        tween(this.guideFingerNode).stop();
        const base = v3(localPos.x + 34, localPos.y - 46, 0);
        this.guideFingerNode.setPosition(base);
        this.guideFingerNode.setSiblingIndex(this.guideFingerNode.parent ? Math.max(0, this.guideFingerNode.parent.children.length - 1) : 0);
        tween(this.guideFingerNode)
            .repeatForever(
                tween(this.guideFingerNode)
                    .to(0.55, { position: v3(base.x + 8, base.y + 10, 0) }, { easing: 'sineInOut' })
                    .to(0.55, { position: base }, { easing: 'sineInOut' })
            )
            .start();
    },
    hideGuideFinger: function (): void {
        if (!this.guideFingerNode) return;
        tween(this.guideFingerNode).stop();
        this.guideFingerNode.active = false;
    },
    updateGuideTip: function (text: string, position?: Vec3): void {
        if (this.guideTipCardNode && this.guideTipCardNode.isValid && position) {
            this.guideTipCardNode.setPosition(position);
            if (this.guideConfirmButtonNode?.active) {
                const cardHeight = this.guideTipCardNode.getComponent(CcUITransform)?.contentSize.height || 92;
                this.guideConfirmButtonNode.setPosition(position.x, position.y - cardHeight / 2 - 62, 0);
            }
        }
        this.updateGuideTipLayout(this.wrapGuideTipText(text));
        this.drawGuideTipCard();
        this.setGuideConfirmVisible(this.guideConfirmButtonNode?.active === true);
    },
    getGuideCellCanvasPosition: function (cellIndex: number): Vec3 | null {
        const layout = this.getGridLayoutMetrics();
        const row = Math.floor(cellIndex / layout.gridSize);
        const col = cellIndex % layout.gridSize;
        const cellCenterX = layout.startX + col * layout.pitch + layout.squareSize / 2;
        const cellCenterY = layout.startY + row * layout.pitch + layout.squareSize / 2;
        const drawGridNode = this.node;
        const gridTransform = drawGridNode.getComponent(CcUITransform);
        const canvas = director.getScene()?.getChildByName('Canvas');
        const canvasUT = canvas?.getComponent(CcUITransform);
        if (!gridTransform || !canvasUT) return null;
        const worldPos = gridTransform.convertToWorldSpaceAR(v3(cellCenterX, cellCenterY, 0));
        return canvasUT.convertToNodeSpaceAR(worldPos);
    },
    addGuideBacklights: function (indices?: number[]): void {
        this.clearGuideBacklights();
        this.hideGuideHintEntry();
        if (!this.guideOverlayNode) return;

        const targets = indices || this.guideIndex;
        const layout = this.getGridLayoutMetrics();
        const size = layout.squareSize + Math.max(6, layout.gridGap);

        for (const cellIndex of targets) {
            const localPos = this.getGuideCellCanvasPosition(cellIndex);
            if (!localPos) continue;

            const glow = createNode('guideGlow_' + cellIndex, this.guideOverlayNode);
            glow.layer = Layers.Enum.UI_2D;
            glow.setPosition(localPos.x, localPos.y, 0);
            glow.setSiblingIndex(1);
            const glowG = glow.addComponent(Graphics);
            this.drawGuideCellGlow(glowG, size);
            tween(glow)
                .repeatForever(
                    tween(glow)
                        .to(0.72, { scale: v3(1.07, 1.07, 1) }, { easing: 'sineInOut' })
                        .to(0.72, { scale: v3(1, 1, 1) }, { easing: 'sineInOut' })
                )
                .start();
            this.guideBacklightNodes.push(glow);
        }
    },
    drawGuideCellGlow: function (g: Graphics, size: number): void {
        const radius = Math.max(8, size * 0.14);
        g.clear();
        g.fillColor = new Color(48, 138, 255, 42);
        g.roundRect(-size / 2 - 6, -size / 2 - 6, size + 12, size + 12, radius + 5);
        g.fill();
        g.strokeColor = new Color(34, 104, 255, 225);
        g.lineWidth = 5;
        g.roundRect(-size / 2, -size / 2, size, size, radius);
        g.stroke();
        g.strokeColor = new Color(142, 225, 255, 210);
        g.lineWidth = 2;
        g.roundRect(-size / 2 + 5, -size / 2 + 5, size - 10, size - 10, Math.max(5, radius - 4));
        g.stroke();
    },
    clearGuideBacklights: function (): void {
        for (const node of this.guideBacklightNodes) {
            if (node && node.isValid) {
                tween(node).stop();
                node.destroy();
            }
        }
        this.guideBacklightNodes = [];
    },
    clearGuideOverlay: function (keepWhiteBackground: boolean = false): void {
        this.hideGuideFinger();
        this.clearGuideBacklights();
        if (this.guideOverlayNode && this.guideOverlayNode.isValid) {
            this.guideOverlayNode.destroy();
        }
        if (!keepWhiteBackground) {
            this.clearGuideWhiteBackground();
        }
        this.guideOverlayNode = null;
        this.guideFingerNode = null;
        this.guideTipLabel = null;
        this.guideTipCardNode = null;
        this.guideTipTextRootNode = null;
        this.guideTipSegmentNodes = [];
        this.guideConfirmButtonNode = null;
        this.guideHintEntryNode = null;
    },
    });
}
