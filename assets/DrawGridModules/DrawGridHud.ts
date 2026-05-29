import { Graphics, Color, Vec3, v3, input, Input, EventTouch, tween, SpriteFrame, Node, Sprite, UITransform as CcUITransform, Label, EditBox, director, Layers, Texture2D, UIOpacity, view, Button, Widget, instantiate } from 'cc';
import GameApp from '../Core/GameApp';
import { GameMode, UIID } from '../Core/Enum';
import UIManager from '../Core/UIManager';
import CountdownController from '../Core/CountdownController';
import SfxManager from '../Core/SfxManager';
import TiliManager from '../Core/TiliManager';
import AssetService from '../Core/AssetService';
import RewardService from '../Core/RewardService';
import { createLabel, createNode, createFullScreenOverlay, createCircle, addButtonFeedback, createRoundedCard, COLOR_GOLD, COLOR_WHITE, COLOR_TOOLBAR_BG, RADIUS_MD, getScreenSize } from '../Utils/UIBuilder';
import { generateRandomLevel } from '../Game/LevelGenerator';
import { generateDailyChallengeLevel } from '../Game/DailyChallengeLevelGenerator';
import { applyLevelConfigData, isValidLevelConfig, type LevelConfigData } from '../Game/LevelConfig';
import { pickSurvivalLevel } from '../Game/SurvivalConfig';
import { ENABLE_DEBUG_TOOLS } from '../Utils/BuildFlags';
import { GlobalHudMode } from '../GlobalHud';
import { getAdaptiveLayout, scaleLayout } from '../Utils/LayoutService';

const SHOW_DEBUG_JUMP_PANEL = true;

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
type RuleViolationKind = 'color' | 'line' | 'adjacent' | 'general';
const GAMEPLAY_TOP_HUD_SHIFT_Y = 24;
const GAMEPLAY_LEVEL_TOP_DOWN_Y = 22;
const GAMEPLAY_LEVEL_HEART_GROUP_OFFSET_Y = 12;
const GAMEPLAY_LEVEL_TITLE_COLOR = new Color(24, 28, 36, 255);
const GAMEPLAY_HEART_CONTAINER_SCALE = 1.16;
const GAMEPLAY_RULE_BOX_SHIFT_Y = 18;
const RULE_BOX_WIDTH = 716;
const RULE_BOX_HEIGHT = 128;
const RULE_SIDE_COLUMN_WIDTH = 218;
const RULE_MIDDLE_COLUMN_WIDTH = 280;
const RULE_VIOLATION_FLASH_HEIGHT = 108;

export function installDrawGridHud(target: any): void {
    Object.assign(target.prototype, {
    setupDebugJumpPanel: function () {
        if (!ENABLE_DEBUG_TOOLS) {
            return;
        }
        if (this.debugPanelNode) {
            this.syncDebugJumpPanel();
            if (!SHOW_DEBUG_JUMP_PANEL) {
                this.debugPanelNode.active = false;
            }
            return;
        }

        const canvas = director.getScene()?.getChildByName('Canvas');
        if (!canvas) {
            return;
        }

        const panel = new Node('DebugJumpPanel');
        this.setUILayer(panel);
        canvas.addChild(panel);
        panel.setSiblingIndex(500);
        const panelTransform = panel.addComponent(CcUITransform);
        const panelWidth = 230;
        const panelHeight = 176;
        panelTransform.setContentSize(panelWidth, panelHeight);
        const canvasTransform = canvas.getComponent(CcUITransform);
        const canvasWidth = canvasTransform?.contentSize.width ?? 750;
        const canvasHeight = canvasTransform?.contentSize.height ?? 1334;
        const marginRight = 24;
        const marginTop = 32;
        panel.setPosition(
            v3(
                canvasWidth / 2 - panelWidth / 2 - marginRight,
                canvasHeight / 2 - panelHeight / 2 - marginTop,
                0
            )
        );
        this.drawRoundedRect(panel, panelWidth, panelHeight, new Color(245, 248, 255, 245), new Color(186, 196, 214, 255), 16, 2);
        this.blockNodeTouch(panel);

        this.createDebugLabel(panel, 'DebugTitle', '调试跳关', 20, new Color(52, 62, 80, 255), v3(0, 62, 0));

        const inputNode = new Node('LevelInput');
        this.setUILayer(inputNode);
        panel.addChild(inputNode);
        inputNode.setPosition(v3(-34, 28, 0));
        inputNode.addComponent(CcUITransform).setContentSize(108, 38);
        const inputBg = new Node('LevelInputBg');
        this.setUILayer(inputBg);
        inputNode.addChild(inputBg);
        inputBg.setPosition(v3(0, 0, 0));
        inputBg.addComponent(CcUITransform).setContentSize(108, 38);
        this.drawRoundedRect(inputBg, 108, 38, new Color(255, 255, 255, 255), new Color(172, 183, 201, 255), 10, 2);
        this.blockNodeTouch(inputNode);

        const editBox = inputNode.addComponent(EditBox);
        editBox.inputMode = EditBox.InputMode.NUMERIC;
        editBox.maxLength = 4;
        editBox.string = `${this.currentLevel}`;
        editBox.placeholder = '关卡';

        const textNode = new Node('Text');
        this.setUILayer(textNode);
        inputNode.addChild(textNode);
        textNode.setPosition(v3(0, 0, 0));
        textNode.addComponent(CcUITransform).setContentSize(88, 30);
        const textLabel = textNode.addComponent(Label);
        textLabel.fontSize = 20;
        textLabel.lineHeight = 24;
        textLabel.color = new Color(45, 54, 68, 255);
        textLabel.isBold = true;
        editBox.textLabel = textLabel;

        const placeholderNode = new Node('Placeholder');
        this.setUILayer(placeholderNode);
        inputNode.addChild(placeholderNode);
        placeholderNode.setPosition(v3(0, 0, 0));
        placeholderNode.addComponent(CcUITransform).setContentSize(88, 30);
        const placeholderLabel = placeholderNode.addComponent(Label);
        placeholderLabel.fontSize = 18;
        placeholderLabel.lineHeight = 24;
        placeholderLabel.color = new Color(160, 168, 180, 255);
        placeholderLabel.string = '关卡';
        editBox.placeholderLabel = placeholderLabel;

        const goNode = new Node('JumpButton');
        this.setUILayer(goNode);
        panel.addChild(goNode);
        goNode.setPosition(v3(55, 28, 0));
        goNode.addComponent(CcUITransform).setContentSize(72, 38);
        this.drawRoundedRect(goNode, 72, 38, new Color(102, 168, 255, 255), new Color(77, 136, 226, 255), 10, 2);
        this.blockNodeTouch(goNode);
        this.createDebugLabel(goNode, 'JumpLabel', 'GO', 20, new Color(255, 255, 255, 255), v3(0, 0, 0), true);
        goNode.on(Node.EventType.TOUCH_END, this.onDebugJumpButtonClick, this);

        const tutorialNode = new Node('TutorialTestButton');
        this.setUILayer(tutorialNode);
        panel.addChild(tutorialNode);
        tutorialNode.setPosition(v3(0, -18, 0));
        tutorialNode.addComponent(CcUITransform).setContentSize(170, 36);
        this.drawRoundedRect(tutorialNode, 170, 36, new Color(58, 190, 130, 255), new Color(40, 158, 104, 255), 10, 2);
        this.blockNodeTouch(tutorialNode);
        this.createDebugLabel(tutorialNode, 'TutorialTestLabel', '新手测试', 18, new Color(255, 255, 255, 255), v3(0, 0, 0), true);
        tutorialNode.on(Node.EventType.TOUCH_END, this.onDebugTutorialButtonClick, this);

        const status = this.createDebugLabel(panel, 'DebugStatus', '', 15, new Color(92, 101, 116, 255), v3(0, -64, 0));

        this.debugPanelNode = panel;
        this.debugLevelEditBox = editBox;
        this.debugStatusLabel = status;
        panel.active = SHOW_DEBUG_JUMP_PANEL;
        this.syncDebugJumpPanel();
    },
    drawRoundedRect: function (node: Node, width: number, height: number, fillColor: Color, strokeColor: Color, radius: number, lineWidth: number) {
        const graphics = node.getComponent(Graphics) || node.addComponent(Graphics);
        graphics.clear();
        graphics.fillColor = fillColor;
        graphics.roundRect(-width / 2, -height / 2, width, height, radius);
        graphics.fill();
        graphics.lineWidth = lineWidth;
        graphics.strokeColor = strokeColor;
        graphics.roundRect(-width / 2, -height / 2, width, height, radius);
        graphics.stroke();
    },
    createDebugLabel: function (parent: Node, name: string, text: string, fontSize: number, color: Color, position: ReturnType<typeof v3>, bold = false): Label {
        const labelNode = new Node(name);
        this.setUILayer(labelNode);
        parent.addChild(labelNode);
        labelNode.setPosition(position);
        labelNode.addComponent(CcUITransform).setContentSize(160, fontSize + 10);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 4;
        label.color = color;
        label.isBold = bold;
        return label;
    },
    setUILayer: function (node: Node) {
        node.layer = Layers.Enum.UI_2D;
    },
    ensureUIManager: function (): UIManager | null {
        if (GameApp.uiManager && GameApp.uiManager.isValid) {
            return GameApp.uiManager;
        }

        const parent = this.node.parent || this.node;
        let uiRoot = parent.getChildByName('UIRoot');
        if (!uiRoot) {
            uiRoot = new Node('UIRoot');
            parent.addChild(uiRoot);
        }
        this.setUILayer(uiRoot);
        uiRoot.setSiblingIndex(9999);

        const transform = uiRoot.getComponent(CcUITransform) || uiRoot.addComponent(CcUITransform);
        transform.setContentSize(this.CELEBRATION_WIDTH, this.CELEBRATION_HEIGHT);

        const uiManager = uiRoot.getComponent(UIManager) || uiRoot.addComponent(UIManager);
        GameApp.uiManager = uiManager;
        return uiManager;
    },
    setGameUIVisible: function (visible: boolean) {
        const getValidNode = (node: Node | null | undefined): Node | null => {
            return node && node.isValid ? node : null;
        };
        const getLabelNode = (label: Label | null | undefined): Node | null => {
            return getValidNode(label?.node || null);
        };
        const setNodeActive = (node: Node | null | undefined, active: boolean): void => {
            const validNode = getValidNode(node);
            if (validNode) validNode.active = active;
        };
        const setLabelActive = (label: Label | null | undefined, active: boolean): void => {
            setNodeActive(getLabelNode(label), active);
        };
        const setBoardGraphicsVisible = (graphics: Graphics | null | undefined, active: boolean): void => {
            if (!graphics || !graphics.node || !graphics.node.isValid) return;
            graphics.enabled = active;
            if (!active) {
                graphics.clear();
            }
            if (graphics.node !== this.node) {
                graphics.node.active = active;
            }
        };
        const isTimedChallengeMode = GameApp.gameMode === GameMode.survival || GameApp.gameMode === GameMode.daily_challenge;

        if (visible) {
            const globalHud = GameApp.globalHud as { node?: Node; setMode?: (mode: GlobalHudMode) => void; syncLayout?: () => void } | null;
            const globalHudMode = GameApp.gameMode === GameMode.survival ? GlobalHudMode.SurvivalGameplay : GlobalHudMode.Gameplay;
            setNodeActive(globalHud?.node, true);
            globalHud?.setMode?.(globalHudMode);
            globalHud?.syncLayout?.();
        }

        if (this.graphics) {
            this.graphics.enabled = visible;
            if (!visible) {
                this.graphics.clear();
            }
        }
        setBoardGraphicsVisible(this.staticBoardGraphics, visible);
        setBoardGraphicsVisible(this.dynamicBoardGraphics, visible);
        if (!visible) {
            this.rootGraphics?.clear();
            this.staticBoardSignature = '';
            this.staticBoardDirty = true;
        }
        setLabelActive(this.levelLabel, visible);
        const coinLabelNode = getLabelNode(this.coinLabel);
        setNodeActive(getValidNode(coinLabelNode?.parent) || coinLabelNode, false);
        const remainingLabelNode = getLabelNode(this.remainingCowsLabel);
        setNodeActive(getValidNode(remainingLabelNode?.parent) || remainingLabelNode, visible);
        if (visible) {
            this.syncRemainingCowsPosition?.();
        }
        setNodeActive(this.heartContainer, visible);
        setNodeActive(this.debugPanelNode, SHOW_DEBUG_JUMP_PANEL && GameApp.gameMode === GameMode.level && (visible || !GameApp.isStartGame));
        if (!visible && typeof this.destroyMilestoneBar === 'function') {
            this.destroyMilestoneBar();
        }
        if (!visible && typeof this.destroySurvivalFoundCowsPanel === 'function') {
            this.destroySurvivalFoundCowsPanel();
        }
        if (!visible && typeof this.stopCountdownRuntime === 'function') {
            this.stopCountdownRuntime();
        }
        setNodeActive(this.hintPanelNode, visible);
        setLabelActive(this.countdownLabel, visible && isTimedChallengeMode);
        if (visible && !isTimedChallengeMode) {
            this.setSurvivalSplashUI(false);
        }
        setNodeActive(this.ruleBoxNode, visible);
        if (!visible) {
            this.hideSceneHintGuidePrompt?.();
            this.ruleRevealVersion++;
            this.workplaceThemeVersion++;
            this.setHintPanelShown(false);
            this.closeHintPurchasePanel?.();
            this.closeHintUnlockGuidePanel?.(false);
        } else {
            setNodeActive(this.hintPanelNode, false);
        }
        for (let i = 0; i < this.cowNodes.length; i++) {
            const node = getValidNode(this.cowNodes[i]);
            if (node) {
                node.active = visible;
            } else {
                this.cowNodes[i] = null;
            }
        }
        for (let i = 0; i < this.balloonCellNodes.length; i++) {
            const node = getValidNode(this.balloonCellNodes[i]);
            if (node) {
                node.active = visible;
            } else {
                this.balloonCellNodes[i] = null;
            }
        }
        for (let i = 0; i < this.balloonPopNodes.length; i++) {
            const node = getValidNode(this.balloonPopNodes[i]);
            if (node) {
                node.active = visible;
            } else {
                this.balloonPopNodes[i] = null;
            }
        }
        if (!visible) {
            this.balloonCellBasePositions.fill(null);
            this.balloonCowBasePositions.fill(null);
        }
        for (let i = 0; i < this.coordinateNodes.length; i++) {
            const node = getValidNode(this.coordinateNodes[i]);
            if (node) {
                node.active = visible && this.showCoordinates;
            } else {
                this.coordinateNodes[i] = null;
            }
        }
        // 工具栏：可见时懒建，否则隐藏
        setNodeActive(this.toolbarContainer, false);
        // SpriteSplash visibility
        const canvas = director.getScene()?.getChildByName('Canvas');
        if (canvas) {
            if (!visible) {
                setNodeActive(this.staticGameplayBackgroundNode, false);
                setNodeActive(this.gameplaySettingButton, false);
            }
            const splash = getValidNode(canvas.getChildByName('SpriteSplash'));
            if (splash) {
                splash.active = visible;
                if (visible) {
                    this.configureStaticGameplayBackground(splash);
                    this.configureGlobalGameplayHud(splash);
                }
                for (const child of splash.children) {
                    if (child && child.isValid) {
                        child.active = visible && !this.isGlobalHudNode(child);
                    }
                }
                if (visible) {
                    this.bindSceneToolButtons(splash);
                }
            }
        }
        // Countdown label (survival / daily_challenge mode only)
        setLabelActive(this.countdownLabel, visible && isTimedChallengeMode);
        // Non-survival/daily_challenge mode: hide survival splash UI
        if (visible && !isTimedChallengeMode) {
            this.setSurvivalSplashUI(false);
        }
    },
    findCounterValueLabel: function (root: Node): Label | null {
        const labels: Label[] = [];
        const collect = (node: Node): void => {
            const label = node.getComponent(Label);
            if (label) labels.push(label);
            for (const child of node.children) collect(child);
        };
        collect(root);
        return labels.find(label => /^\s*\d+\s*$/.test(label.string)) || labels[labels.length - 1] || null;
    },
    setCounterPanelCaption: function (root: Node, caption: string, valueLabel: Label | null): void {
        const labels: Label[] = [];
        const collect = (node: Node): void => {
            const label = node.getComponent(Label);
            if (label) labels.push(label);
            for (const child of node.children) collect(child);
        };
        collect(root);
        for (const label of labels) {
            if (label === valueLabel) continue;
            if (/^\s*\d+\s*$/.test(label.string)) continue;
            label.string = caption;
        }
    },
    ensureSurvivalFoundCowsPanel: function (): Node | null {
        const sourceLabel = this.remainingCowsLabel as Label | null;
        const sourceContainer = sourceLabel?.node?.parent || null;
        const parent = sourceContainer?.parent || null;
        if (!sourceContainer?.isValid || !parent?.isValid) return null;

        let root = this.survivalFoundCowsRoot as Node | null;
        if (!root || !root.isValid || root.parent !== parent) {
            if (root?.isValid) root.destroy();
            root = instantiate(sourceContainer);
            root.name = 'SurvivalFoundCowsPanel';
            parent.addChild(root);
            root.setSiblingIndex(Math.min(parent.children.length - 1, sourceContainer.getSiblingIndex() + 1));
            this.survivalFoundCowsRoot = root;
            this.survivalFoundCowsLabel = this.findCounterValueLabel(root);
        }

        const valueLabel = this.survivalFoundCowsLabel as Label | null;
        this.setCounterPanelCaption(root, '找到猫猫:', valueLabel);
        root.active = GameApp.gameMode === GameMode.survival;
        this.updateSurvivalFoundCowsLabel?.();
        return root;
    },
    destroySurvivalFoundCowsPanel: function (): void {
        const root = this.survivalFoundCowsRoot as Node | null;
        if (root?.isValid) root.destroy();
        this.survivalFoundCowsRoot = null;
        this.survivalFoundCowsLabel = null;
    },
    refreshTimedChallengeHud: function (): void {
        const isSurvival = GameApp.gameMode === GameMode.survival;
        const isDailyChallenge = GameApp.gameMode === GameMode.daily_challenge;
        if (!isSurvival && !isDailyChallenge) return;

        const getValidNode = (node: Node | null | undefined): Node | null => {
            return node && node.isValid ? node : null;
        };
        const setNodeActive = (node: Node | null | undefined, active: boolean): void => {
            const validNode = getValidNode(node);
            if (validNode) validNode.active = active;
        };
        const getSplashDirectChild = (splash: Node, node: Node | null | undefined): Node | null => {
            let cursor = getValidNode(node);
            while (cursor && cursor.parent && cursor.parent !== splash) {
                cursor = getValidNode(cursor.parent);
            }
            return cursor && cursor.parent === splash ? cursor : null;
        };
        const getCountdownRoot = (): Node | null => {
            const labelNode = getValidNode(this.countdownLabel?.node || null);
            if (!labelNode) return null;
            if (labelNode.parent?.name === 'CountdownLabel') return labelNode.parent;
            if (labelNode.parent?.parent?.name === 'CountdownLabel') return labelNode.parent.parent;
            return labelNode;
        };

        const canvas = director.getScene()?.getChildByName('Canvas');
        const splash = getValidNode(canvas?.getChildByName('SpriteSplash'));
        if (!splash) return;

        const globalHud = GameApp.globalHud as {
            node?: Node;
            setMode?: (mode: GlobalHudMode) => void;
            syncLayout?: () => void;
        } | null;
        const globalHudMode = isSurvival ? GlobalHudMode.SurvivalGameplay : GlobalHudMode.Gameplay;
        setNodeActive(globalHud?.node, true);
        globalHud?.setMode?.(globalHudMode);
        globalHud?.syncLayout?.();

        splash.active = true;
        this.configureStaticGameplayBackground?.(splash);
        this.setupRuleBoxNodes?.();
        const survivalFoundContainer = isSurvival ? this.ensureSurvivalFoundCowsPanel?.() : null;
        if (!isSurvival) this.destroySurvivalFoundCowsPanel?.();

        const persistentNames = new Set(['Label', 'tips1', 'tips2', 'clear', 'point']);
        const remainingLabelNode = getValidNode(this.remainingCowsLabel?.node || null);
        const remainingContainer = getValidNode(remainingLabelNode?.parent || remainingLabelNode);
        const remainingRoot = getSplashDirectChild(splash, remainingContainer);
        const ruleRoot = getSplashDirectChild(splash, this.ruleBoxNode);
        const countdownRoot = getSplashDirectChild(splash, getCountdownRoot());
        const milestoneRoot = isSurvival ? getSplashDirectChild(splash, this.milestoneBarNode) : null;
        const survivalFoundRoot = isSurvival ? getSplashDirectChild(splash, survivalFoundContainer) : null;
        const heartRoot = getSplashDirectChild(splash, this.heartContainer);

        for (const child of splash.children) {
            if (!child || !child.isValid) continue;
            if (this.isGlobalHudNode?.(child)) {
                child.active = false;
                continue;
            }
            const shouldShow =
                persistentNames.has(child.name)
                || child === remainingRoot
                || child === ruleRoot
                || child === countdownRoot
                || child === milestoneRoot
                || child === survivalFoundRoot
                || (isDailyChallenge && child === heartRoot);
            child.active = shouldShow;
        }

        for (const name of persistentNames) {
            setNodeActive(splash.getChildByName(name), true);
        }

        setNodeActive(ruleRoot, true);
        setNodeActive(this.ruleBoxNode, true);
        setNodeActive(remainingRoot, true);
        setNodeActive(remainingContainer, true);
        setNodeActive(remainingLabelNode, true);
        setNodeActive(countdownRoot, true);
        setNodeActive(this.countdownLabel?.node || null, true);
        setNodeActive(milestoneRoot, isSurvival);
        setNodeActive(survivalFoundRoot, isSurvival);
        setNodeActive(survivalFoundContainer, isSurvival);

        if (isSurvival) {
            setNodeActive(this.heartContainer, false);
            if (heartRoot === this.heartContainer) setNodeActive(heartRoot, false);
        } else {
            setNodeActive(heartRoot, true);
            setNodeActive(this.heartContainer, true);
        }

        this.configureGlobalGameplayHud?.(splash);
        this.bindSceneToolButtons?.(splash);
        this.syncProgressLabels?.();
        this.updateRemainingCowCaption?.();
        this.updateSurvivalFoundCowsLabel?.();
        this.refreshRemainingCowIcon?.();
        this.syncRemainingCowsPosition?.();
    },
    syncRemainingCowsPosition: function (): void {
        if (!this.remainingCowsLabel?.node?.isValid) return;
        const labelNode = this.remainingCowsLabel.node;
        const container = labelNode.parent && labelNode.parent.isValid ? labelNode.parent : labelNode;
        if (!container || !container.isValid) return;

        const state = container as Node & { __remainingCowsBasePos?: Vec3 };
        if (!state.__remainingCowsBasePos) {
            state.__remainingCowsBasePos = container.position.clone();
        }

        const gridSize = Math.max(0, Math.floor(this.gridSize || 0));
        const base = state.__remainingCowsBasePos;
        let targetY = base.y;

        this.setupRuleBoxNodes?.();
        const parentTransform = container.parent?.getComponent(CcUITransform);
        const ruleTransform = this.ruleBoxNode?.getComponent(CcUITransform);
        const gridTransform = this.node?.getComponent(CcUITransform);
        if (parentTransform && ruleTransform && gridTransform && this.ruleBoxNode?.isValid) {
            const layout = typeof this.getGridLayoutMetrics === 'function' ? this.getGridLayoutMetrics() : null;
            const boardSize = layout?.boardSize || (typeof this.getBoardSize === 'function' ? this.getBoardSize(gridSize) : this.BG_SIZE);
            const ruleAnchorY = ruleTransform.anchorPoint?.y ?? 0.5;
            const ruleBottomLocalY = -ruleTransform.contentSize.height * ruleAnchorY;
            const ruleBottomWorld = ruleTransform.convertToWorldSpaceAR(v3(0, ruleBottomLocalY, 0));
            const boardTopWorld = gridTransform.convertToWorldSpaceAR(v3(0, boardSize / 2, 0));
            const ruleBottomY = parentTransform.convertToNodeSpaceAR(ruleBottomWorld).y;
            const boardTopY = parentTransform.convertToNodeSpaceAR(boardTopWorld).y;
            const gap = ruleBottomY - boardTopY;

            if (Number.isFinite(gap) && gap > 0) {
                const containerTransform = container.getComponent(CcUITransform);
                const containerHeight = containerTransform?.contentSize.height || 44;
                const margin = gridSize >= 11 ? 1.5 : 4;
                const minY = boardTopY + containerHeight * 0.5 + margin;
                const maxY = ruleBottomY - containerHeight * 0.5 - margin;
                const preferredY = ruleBottomY - containerHeight * 0.5 - 14;
                targetY = minY <= maxY
                    ? Math.max(minY, Math.min(maxY, preferredY))
                    : (ruleBottomY + boardTopY) * 0.5;
            }
        }

        if (GameApp.gameMode === GameMode.daily_challenge || GameApp.gameMode === GameMode.survival) {
            const layout = getAdaptiveLayout();
            const positionCountdown = (x: number): void => {
                const countdownRoot = this.countdownLabel?.node?.parent?.parent && this.countdownLabel.node.parent.parent.name === 'CountdownLabel'
                    ? this.countdownLabel.node.parent.parent
                    : (this.countdownLabel?.node?.parent && this.countdownLabel.node.parent.name === 'CountdownLabel'
                        ? this.countdownLabel.node.parent
                        : null);
                if (!countdownRoot?.isValid) return;

                const sourceParentTransform = container.parent?.getComponent(CcUITransform);
                const targetParentTransform = countdownRoot.parent?.getComponent(CcUITransform);
                if (sourceParentTransform && targetParentTransform) {
                    const targetWorld = sourceParentTransform.convertToWorldSpaceAR(v3(x, targetY, 0));
                    const targetLocal = targetParentTransform.convertToNodeSpaceAR(targetWorld);
                    countdownRoot.setPosition(targetLocal.x, targetLocal.y, countdownRoot.position.z);
                } else {
                    countdownRoot.setPosition(x, targetY, countdownRoot.position.z);
                }
                countdownRoot.active = true;
            };

            if (GameApp.gameMode === GameMode.survival) {
                const rowGap = Math.max(178, scaleLayout(178, layout));
                const foundContainer = this.ensureSurvivalFoundCowsPanel?.();
                container.setPosition(base.x - rowGap, targetY, base.z);
                positionCountdown(base.x);
                if (foundContainer?.isValid) {
                    foundContainer.setPosition(base.x + rowGap, targetY, foundContainer.position.z);
                    foundContainer.active = true;
                }
                this.updateSurvivalFoundCowsLabel?.();
                return;
            }

            this.destroySurvivalFoundCowsPanel?.();
            const rowGap = scaleLayout(112, layout);
            container.setPosition(base.x - rowGap, targetY, base.z);
            positionCountdown(base.x + rowGap);
            return;
        }

        container.setPosition(0, targetY, base.z);
    },
    setupRuleBoxNodes: function () {
        if (this.ruleBoxNode && this.ruleLeftLabel && this.ruleMiddleLabel && this.ruleRightLabel) {
            this.configureRuleBoxLayout();
            return;
        }

        const root = director.getScene()?.getChildByName('Canvas') || this.node.parent || this.node;
        const labels: Label[] = [];
        this.collectLabels(root, labels);

        const leftLabel = labels.find(label => label.string.indexOf('每个部门') >= 0 || label.string.indexOf('每种颜色') >= 0 || label.string.indexOf('每种气球') >= 0 || label.string.indexOf('每种样式') >= 0);
        const middleLabel = labels.find(label => label.string.indexOf('每行') >= 0 && label.string.indexOf('每列') >= 0);
        const rightLabel = labels.find(label => label.string.indexOf('不能相邻') >= 0 || label.string.indexOf('不能挨着') >= 0);
        if (!leftLabel || !middleLabel || !rightLabel) {
            return;
        }

        const parent = leftLabel.node.parent;
        if (!parent || middleLabel.node.parent !== parent || rightLabel.node.parent !== parent) {
            return;
        }

        const dividers = parent.children
            .filter(child => {
                const transform = child.getComponent(CcUITransform);
                const width = transform?.contentSize.width ?? 0;
                const height = transform?.contentSize.height ?? 0;
                return width <= 8 && height >= 50;
            })
            .sort((a, b) => a.position.x - b.position.x);
        dividers.forEach(divider => divider.active = false);

        this.ruleBoxNode = parent;
        this.ruleLeftLabel = leftLabel;
        this.ruleMiddleLabel = middleLabel;
        this.ruleRightLabel = rightLabel;
        this.ruleLeftDivider = null;
        this.ruleRightDivider = null;
        this.ruleLeftText = this.ruleCardTexts.left;
        this.ruleMiddleText = this.ruleCardTexts.middle;
        this.ruleRightText = this.ruleCardTexts.right;
        this.ruleLeftLabel.string = this.ruleLeftText;
        this.ruleMiddleLabel.string = this.ruleMiddleText;
        this.ruleRightLabel.string = this.ruleRightText;
        this.configureRuleBoxLayout();
        this.setupRuleBoxGlow(parent);
    },
    configureRuleBoxLayout: function (): void {
        if (!this.ruleBoxNode || !this.ruleLeftLabel || !this.ruleMiddleLabel || !this.ruleRightLabel) return;

        const boxWidth = RULE_BOX_WIDTH;
        const boxHeight = RULE_BOX_HEIGHT;
        const sideColumnWidth = RULE_SIDE_COLUMN_WIDTH;
        const middleColumnWidth = RULE_MIDDLE_COLUMN_WIDTH;
        const dividerHalfHeight = 48;
        const textColor = new Color(56, 62, 74, 238);
        const parent = this.ruleBoxNode;
        const ruleBoxState = parent as Node & { __ruleBoxBasePos?: Vec3 };
        if (!ruleBoxState.__ruleBoxBasePos) {
            ruleBoxState.__ruleBoxBasePos = parent.position.clone();
        }
        const basePos = ruleBoxState.__ruleBoxBasePos;
        parent.setPosition(basePos.x, basePos.y + GAMEPLAY_RULE_BOX_SHIFT_Y, basePos.z);
        const transform = parent.getComponent(CcUITransform) || parent.addComponent(CcUITransform);
        transform.setContentSize(boxWidth, boxHeight);

        const sprite = parent.getComponent(Sprite);
        if (sprite) {
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            sprite.color = new Color(255, 255, 255, 255);
        }

        let bg = parent.getChildByName('RuleBoxCleanBg');
        if (!bg) {
            bg = new Node('RuleBoxCleanBg');
            this.setUILayer(bg);
            parent.addChild(bg);
            bg.addComponent(CcUITransform);
            bg.addComponent(Graphics);
        }
        bg.setSiblingIndex(0);
        bg.getComponent(CcUITransform)?.setContentSize(boxWidth, boxHeight);
        bg.setPosition(0, 0, 0);
        const bgGraphics = bg.getComponent(Graphics) || bg.addComponent(Graphics);
        bgGraphics.clear();
        bgGraphics.fillColor = new Color(255, 255, 255, 252);
        bgGraphics.roundRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 48);
        bgGraphics.fill();
        bgGraphics.strokeColor = new Color(220, 226, 236, 210);
        bgGraphics.lineWidth = 2;
        bgGraphics.roundRect(-boxWidth / 2 + 1, -boxHeight / 2 + 1, boxWidth - 2, boxHeight - 2, 47);
        bgGraphics.stroke();

        const leftX = -(middleColumnWidth + sideColumnWidth) * 0.5;
        const rightX = (middleColumnWidth + sideColumnWidth) * 0.5;
        const dividerX = middleColumnWidth * 0.5;
        const labelConfigs = [
            { label: this.ruleLeftLabel, x: leftX, width: sideColumnWidth },
            { label: this.ruleMiddleLabel, x: 0, width: middleColumnWidth },
            { label: this.ruleRightLabel, x: rightX, width: sideColumnWidth },
        ];
        labelConfigs.forEach(({ label, x, width }) => {
            const labelNode = label.node;
            labelNode.setSiblingIndex(parent.children.length - 1);
            labelNode.setPosition(x, 0, labelNode.position.z);
            labelNode.getComponent(CcUITransform)?.setContentSize(width - 16, 96);
            label.fontSize = 28;
            label.lineHeight = 36;
            label.color = textColor;
            label.isBold = false;
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
        });

        const makeDivider = (name: string, x: number): Node => {
            let divider = parent.getChildByName(name);
            if (!divider) {
                divider = new Node(name);
                this.setUILayer(divider);
                parent.addChild(divider);
                divider.addComponent(CcUITransform);
                divider.addComponent(Graphics);
            }
            divider.active = true;
            divider.setPosition(x, 0, 0);
            divider.getComponent(CcUITransform)?.setContentSize(4, dividerHalfHeight * 2);
            const g = divider.getComponent(Graphics) || divider.addComponent(Graphics);
            g.clear();
            g.fillColor = new Color(190, 196, 206, 185);
            g.roundRect(-1.5, -dividerHalfHeight, 3, dividerHalfHeight * 2, 1.5);
            g.fill();
            return divider;
        };
        this.ruleLeftDivider = makeDivider('RuleBoxLeftDivider', -dividerX);
        this.ruleRightDivider = makeDivider('RuleBoxRightDivider', dividerX);
    },
    setupRuleBoxGlow: function (parent: Node) {
        if (this.ruleGlowNode && this.ruleGlowGraphics) {
            return;
        }

        const transform = parent.getComponent(CcUITransform);
        const width = transform?.contentSize.width ?? 533;
        const height = transform?.contentSize.height ?? 128;
        const glowNode = new Node('RuleBoxGlow');
        this.setUILayer(glowNode);
        glowNode.parent = parent;
        glowNode.addComponent(CcUITransform).setContentSize(width + 180, height + 140);
        glowNode.setPosition(0, 0, 0);
        glowNode.setSiblingIndex(0);
        glowNode.active = false;
        this.ruleGlowNode = glowNode;
        this.ruleGlowGraphics = glowNode.addComponent(Graphics);
        this.drawRuleBoxGlow(0, 0);
    },
    collectLabels: function (node: Node, labels: Label[]) {
        const label = node.getComponent(Label);
        if (label) {
            labels.push(label);
        }
        for (let i = 0; i < node.children.length; i++) {
            this.collectLabels(node.children[i], labels);
        }
    },
    findChildByNameDeep: function (node: Node, name: string): Node | null {
        if (node.name === name) return node;
        for (let i = 0; i < node.children.length; i++) {
            const found = this.findChildByNameDeep(node.children[i], name);
            if (found) return found;
        }
        return null;
    },
    playRuleBoxIntro: function () {
        this.setupRuleBoxNodes();
        if (!this.ruleBoxNode || !this.ruleLeftLabel || !this.ruleMiddleLabel || !this.ruleRightLabel) {
            return;
        }

        const version = ++this.ruleRevealVersion;
        this.ruleBoxNode.active = true;
        this.ruleLeftLabel.string = '';
        this.ruleMiddleLabel.string = '';
        this.ruleRightLabel.string = '';
        if (this.ruleLeftDivider) this.ruleLeftDivider.active = false;
        if (this.ruleRightDivider) this.ruleRightDivider.active = false;
        if (!this._isGuideMode) {
            SfxManager.instance.playRuleIntro();
        }
        if (this.ruleGlowNode) {
            this.ruleGlowNode.active = false;
        }
        this.ruleBoxNode.setScale(v3(1, 1, 1));

        const state = { t: 0 };
        const leftDuration = 0.46;
        const lineGap = 0.1;
        const middleDuration = 0.68;
        const rightDuration = 0.42;
        const totalDuration = leftDuration + lineGap + middleDuration + lineGap + rightDuration;

        tween(state)
            .delay(0.05)
            .to(totalDuration, { t: totalDuration }, {
                easing: 'linear',
                onUpdate: () => {
                    if (version !== this.ruleRevealVersion) return;
                    this.updateRuleBoxReveal(state.t, leftDuration, lineGap, middleDuration, rightDuration);
                }
            })
            .call(() => {
                if (version !== this.ruleRevealVersion) return;
                this.ruleLeftLabel!.string = this.ruleLeftText;
                this.ruleMiddleLabel!.string = this.ruleMiddleText;
                this.ruleRightLabel!.string = this.ruleRightText;
                if (this.ruleLeftDivider) this.ruleLeftDivider.active = true;
                if (this.ruleRightDivider) this.ruleRightDivider.active = true;
                this.playRuleBoxPulse(version);
            })
            .start();
    },
    clearHeartBreakEffects: function () {
        if (!this.heartContainer) return;
        const parent = this.heartContainer;
        const effects = parent.children.filter(child => child.name.indexOf('HeartBreakBurst') === 0);
        for (const effect of effects) {
            effect.destroy();
        }
    },
    playHeartBreakEffect: function (heartNode: Node) {
        const parent = heartNode.parent;
        if (!parent) return;

        const burstRoot = new Node('HeartBreakBurst');
        this.setUILayer(burstRoot);
        parent.addChild(burstRoot);
        burstRoot.setPosition(heartNode.position.x, heartNode.position.y, heartNode.position.z);
        burstRoot.setSiblingIndex(heartNode.getSiblingIndex() + 1);

        const pieces = [
            { x: -28, y: 22, r: -42, s: 15, c: new Color(255, 71, 92, 255), d: 0 },
            { x: -20, y: -24, r: -95, s: 12, c: new Color(218, 34, 62, 255), d: 0.02 },
            { x: 0, y: 30, r: 28, s: 10, c: new Color(255, 126, 145, 255), d: 0.01 },
            { x: 22, y: 20, r: 64, s: 14, c: new Color(255, 72, 96, 255), d: 0.03 },
            { x: 28, y: -18, r: 116, s: 11, c: new Color(190, 28, 56, 255), d: 0.04 },
            { x: -7, y: -32, r: 176, s: 13, c: new Color(255, 92, 112, 255), d: 0.02 },
            { x: -36, y: 0, r: -135, s: 8, c: new Color(255, 184, 190, 255), d: 0.05 },
            { x: 36, y: 2, r: 142, s: 8, c: new Color(255, 184, 190, 255), d: 0.05 }
        ];

        for (let i = 0; i < pieces.length; i++) {
            const p = pieces[i];
            const pieceNode = new Node(`HeartShard_${i}`);
            this.setUILayer(pieceNode);
            pieceNode.parent = burstRoot;
            pieceNode.addComponent(CcUITransform).setContentSize(p.s * 2, p.s * 2);
            pieceNode.setScale(v3(0.72, 0.72, 1));
            pieceNode.angle = p.r * 0.25;
            const opacity = pieceNode.addComponent(UIOpacity);
            opacity.opacity = 255;
            const g = pieceNode.addComponent(Graphics);
            this.drawHeartShard(g, p.s, p.c, i);

            tween(pieceNode)
                .delay(p.d)
                .to(0.12, { scale: v3(1.1, 1.1, 1), position: v3(p.x * 0.55, p.y * 0.55, 0), angle: p.r * 0.55 }, { easing: 'quadOut' })
                .to(0.32, { scale: v3(0.86, 0.86, 1), position: v3(p.x, p.y - 16, 0), angle: p.r }, { easing: 'quadIn' })
                .start();

            tween(opacity)
                .delay(0.14 + p.d)
                .to(0.3, { opacity: 0 }, { easing: 'quadIn' })
                .start();
        }

        tween(burstRoot)
            .delay(0.52)
            .call(() => burstRoot.destroy())
            .start();
    },
    drawHeartShard: function (g: Graphics, size: number, color: Color, variant: number) {
        g.fillColor = color;
        const s = size;
        if (variant % 3 === 0) {
            g.moveTo(-s * 0.8, -s * 0.35);
            g.lineTo(s * 0.75, -s * 0.15);
            g.lineTo(s * 0.08, s * 0.85);
        } else if (variant % 3 === 1) {
            g.moveTo(-s * 0.62, s * 0.58);
            g.lineTo(-s * 0.35, -s * 0.65);
            g.lineTo(s * 0.78, -s * 0.42);
            g.lineTo(s * 0.38, s * 0.42);
        } else {
            g.moveTo(-s * 0.35, -s * 0.7);
            g.lineTo(s * 0.7, -s * 0.18);
            g.lineTo(s * 0.2, s * 0.76);
            g.lineTo(-s * 0.75, s * 0.18);
        }
        g.close();
        g.fill();

        g.fillColor = new Color(255, 255, 255, 76);
        g.circle(-s * 0.24, s * 0.18, Math.max(1.4, s * 0.18));
        g.fill();
    },
    playRuleBoxPulse: function (version: number) {
        if (!this.ruleBoxNode || !this.ruleGlowNode || !this.ruleGlowGraphics) {
            return;
        }

        const state = { alpha: 0, scale: 1 };
        this.ruleGlowNode.active = false;
        this.ruleGlowNode.setScale(v3(1, 1, 1));
        this.ruleBoxNode.setScale(v3(1, 1, 1));
        tween(state).stop();
        tween(state)
            .to(0.34, { alpha: 1, scale: 1.035 }, {
                easing: 'quadOut',
                onUpdate: () => {
                    if (version !== this.ruleRevealVersion) return;
                    this.ruleBoxNode!.setScale(v3(state.scale, state.scale, 1));
                }
            })
            .to(0.42, { alpha: 0.12, scale: 1.055 }, {
                easing: 'quadInOut',
                onUpdate: () => {
                    if (version !== this.ruleRevealVersion) return;
                    this.ruleBoxNode!.setScale(v3(state.scale, state.scale, 1));
                }
            })
            .to(0.34, { alpha: 0.92, scale: 1.035 }, {
                easing: 'quadOut',
                onUpdate: () => {
                    if (version !== this.ruleRevealVersion) return;
                    this.ruleBoxNode!.setScale(v3(state.scale, state.scale, 1));
                }
            })
            .to(0.42, { alpha: 0, scale: 1.055 }, {
                easing: 'quadInOut',
                onUpdate: () => {
                    if (version !== this.ruleRevealVersion) return;
                    this.ruleBoxNode!.setScale(v3(state.scale, state.scale, 1));
                }
            })
            .call(() => {
                if (version !== this.ruleRevealVersion || !this.ruleGlowNode) return;
                this.ruleBoxNode!.setScale(v3(1, 1, 1));
                this.drawRuleBoxGlow(0, 0);
                this.ruleGlowNode.active = false;
            })
            .start();
    },
    drawRuleBoxGlow: function (alphaRatio: number, scale: number) {
        const g = this.ruleGlowGraphics;
        const node = this.ruleGlowNode;
        if (!g || !node) return;

        const transform = this.ruleBoxNode?.getComponent(CcUITransform);
        const width = (transform?.contentSize.width ?? 533) * scale;
        const height = (transform?.contentSize.height ?? 128) * scale;
        const baseAlpha = Math.floor(220 * Math.max(0, Math.min(1, alphaRatio)));
        g.clear();
        if (baseAlpha <= 0) return;
    },
    playRuleViolationFeedback: function (index: number): void {
        this.setupRuleBoxNodes?.();
        const parent = this.ruleBoxNode as Node | null;
        if (!parent || !parent.isValid) return;

        const kinds = this.getRuleViolationKindsForWrongReveal?.(index) || ['general'];
        const rects = this.getRuleViolationRects?.(kinds) || this.getRuleViolationRects?.(['general']);
        if (!rects || rects.length <= 0) return;

        for (let i = parent.children.length - 1; i >= 0; i--) {
            const child = parent.children[i];
            if (child?.name === 'RuleBoxViolationFlash') {
                child.destroy();
            }
        }
        SfxManager.instance.playRuleViolation();

        const flashNode = new Node('RuleBoxViolationFlash');
        this.setUILayer(flashNode);
        parent.addChild(flashNode);
        flashNode.setPosition(0, 0, 0);
        flashNode.addComponent(CcUITransform).setContentSize(RULE_BOX_WIDTH, RULE_BOX_HEIGHT);
        const g = flashNode.addComponent(Graphics);
        const state = { alpha: 0, scale: 0.98 };
        const render = (): void => {
            if (!flashNode.isValid) return;
            this.drawRuleViolationFlash?.(g, rects, state.alpha, state.scale);
        };

        tween(state)
            .to(0.07, { alpha: 1, scale: 1 }, {
                easing: 'quadOut',
                onUpdate: render
            })
            .to(0.18, { alpha: 0.2, scale: 1.018 }, {
                easing: 'quadInOut',
                onUpdate: render
            })
            .to(0.35, { alpha: 0.16, scale: 1.02 }, {
                easing: 'linear',
                onUpdate: render
            })
            .to(0.08, { alpha: 1, scale: 1.006 }, {
                easing: 'quadOut',
                onUpdate: render
            })
            .to(0.42, { alpha: 0.82, scale: 1.018 }, {
                easing: 'quadInOut',
                onUpdate: render
            })
            .to(0.2, { alpha: 0, scale: 1.04 }, {
                easing: 'quadIn',
                onUpdate: render
            })
            .call(() => {
                if (flashNode.isValid) {
                    flashNode.destroy();
                }
            })
            .start();
    },
    getRuleViolationKindsForWrongReveal: function (index: number): RuleViolationKind[] {
        const size = Math.max(1, Math.floor(this.gridSize || 1));
        const targetColor = this.gridColors?.[index] || '';
        const row = Math.floor(index / size);
        const col = index % size;

        const collectKinds = (revealedOnly: boolean): RuleViolationKind[] => {
            let violatesColor = false;
            let violatesLine = false;
            let violatesAdjacent = false;

            for (let cowIndex = 0; cowIndex < (this.cowPositions?.length || 0); cowIndex++) {
                if (!this.cowPositions[cowIndex] || cowIndex === index) continue;
                if (revealedOnly && !this.revealedSquares?.[cowIndex]) continue;
                const cowRow = Math.floor(cowIndex / size);
                const cowCol = cowIndex % size;
                if (targetColor && this.gridColors?.[cowIndex] === targetColor) {
                    violatesColor = true;
                }
                if (cowRow === row || cowCol === col) {
                    violatesLine = true;
                }
                if (Math.abs(cowRow - row) <= 1 && Math.abs(cowCol - col) <= 1) {
                    violatesAdjacent = true;
                }
            }

            const result: RuleViolationKind[] = [];
            if (violatesColor) result.push('color');
            if (violatesLine) result.push('line');
            if (violatesAdjacent) result.push('adjacent');
            return result;
        };

        const visibleKinds = collectKinds(true);
        if (visibleKinds.length > 0) {
            return visibleKinds;
        }

        const actualKinds = collectKinds(false);
        if (actualKinds.indexOf('adjacent') >= 0) return ['adjacent'];
        if (actualKinds.indexOf('line') >= 0) return ['line'];
        if (actualKinds.indexOf('color') >= 0) return ['color'];
        return ['general'];
    },
    getRuleViolationRects: function (kinds: RuleViolationKind[]): Array<{ x: number; width: number }> {
        let hasGeneral = false;
        let hasColor = false;
        let hasLine = false;
        let hasAdjacent = false;
        for (let i = 0; i < kinds.length; i++) {
            const kind = kinds[i];
            if (kind === 'general') hasGeneral = true;
            if (kind === 'color') hasColor = true;
            if (kind === 'line') hasLine = true;
            if (kind === 'adjacent') hasAdjacent = true;
        }
        if (hasGeneral) {
            return [{ x: 0, width: RULE_BOX_WIDTH - 18 }];
        }

        const leftX = -(RULE_MIDDLE_COLUMN_WIDTH + RULE_SIDE_COLUMN_WIDTH) * 0.5;
        const rightX = (RULE_MIDDLE_COLUMN_WIDTH + RULE_SIDE_COLUMN_WIDTH) * 0.5;
        const rects: Array<{ x: number; width: number }> = [];
        if (hasColor) {
            rects.push({ x: leftX, width: RULE_SIDE_COLUMN_WIDTH - 16 });
        }
        if (hasLine) {
            rects.push({ x: 0, width: RULE_MIDDLE_COLUMN_WIDTH - 18 });
        }
        if (hasAdjacent) {
            rects.push({ x: rightX, width: RULE_SIDE_COLUMN_WIDTH - 16 });
        }
        return rects;
    },
    drawRuleViolationFlash: function (g: Graphics, rects: Array<{ x: number; width: number }>, alphaRatio: number, scale: number): void {
        const alpha = Math.max(0, Math.min(1, alphaRatio));
        g.clear();
        if (alpha <= 0) return;

        for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            const width = rect.width * scale;
            const height = RULE_VIOLATION_FLASH_HEIGHT * scale;
            const x = rect.x - width * 0.5;
            const y = -height * 0.5;
            const radius = Math.min(36, height * 0.42);

            g.fillColor = new Color(255, 43, 70, Math.floor(34 * alpha));
            g.roundRect(x, y, width, height, radius);
            g.fill();

            g.lineWidth = 2;
            g.strokeColor = new Color(255, 178, 188, Math.floor(170 * alpha));
            g.roundRect(x + 5, y + 5, width - 10, height - 10, Math.max(8, radius - 5));
            g.stroke();
        }
    },
    updateRuleBoxReveal: function (time: number, leftDuration: number, lineGap: number, middleDuration: number, rightDuration: number) {
        if (!this.ruleLeftLabel || !this.ruleMiddleLabel || !this.ruleRightLabel) return;

        this.ruleLeftLabel.string = this.sliceRuleText(this.ruleLeftText, Math.min(1, time / leftDuration));
        if (time >= leftDuration && this.ruleLeftDivider) {
            this.ruleLeftDivider.active = true;
        }

        const middleStart = leftDuration + lineGap;
        const middleTime = time - middleStart;
        this.ruleMiddleLabel.string = this.sliceRuleText(this.ruleMiddleText, Math.min(1, Math.max(0, middleTime / middleDuration)));
        if (time >= middleStart + middleDuration && this.ruleRightDivider) {
            this.ruleRightDivider.active = true;
        }

        const rightStart = middleStart + middleDuration + lineGap;
        const rightTime = time - rightStart;
        this.ruleRightLabel.string = this.sliceRuleText(this.ruleRightText, Math.min(1, Math.max(0, rightTime / rightDuration)));
    },
    sliceRuleText: function (text: string, ratio: number): string {
        if (ratio <= 0) return '';
        if (ratio >= 1) return text;
        const chars = Array.from(text);
        const count = Math.max(1, Math.ceil(chars.length * ratio));
        return chars.slice(0, count).join('');
    },
    blockNodeTouch: function (node: Node) {
        node.on(Node.EventType.TOUCH_START, this.stopTouchPropagation, this);
        node.on(Node.EventType.TOUCH_MOVE, this.stopTouchPropagation, this);
        node.on(Node.EventType.TOUCH_END, this.stopTouchPropagation, this);
        node.on(Node.EventType.TOUCH_CANCEL, this.stopTouchPropagation, this);
    },
    stopTouchPropagation: function (event: EventTouch) {
        event.propagationStopped = true;
    },
    syncDebugJumpPanel: function () {
        if (!ENABLE_DEBUG_TOOLS) {
            return;
        }
        if (!this.debugLevelEditBox || !this.debugStatusLabel) {
            return;
        }

        this.debugLevelEditBox.string = `${this.currentLevel}`;
        const suffix = this.debugLevelLoadStatus ? `\n${this.debugLevelLoadStatus}` : '';
        this.debugStatusLabel.string = `当前第 ${this.currentLevel} 关 / 最大 ${this.MAX_CONFIG_LEVEL}${suffix}`;
    },
    setDebugLevelLoadStatus: function (text: string) {
        if (!ENABLE_DEBUG_TOOLS) {
            return;
        }
        this.debugLevelLoadStatus = text;
        this.syncDebugJumpPanel();
    },
    onDebugJumpButtonClick: function (event: EventTouch) {
        if (!ENABLE_DEBUG_TOOLS) {
            return;
        }
        SfxManager.instance.playUiClick(); // UI点击音效
        event.propagationStopped = true;
        const input = this.debugLevelEditBox?.string.trim() || '';
        const targetLevel = Math.floor(Number(input));

        if (!Number.isFinite(targetLevel) || targetLevel < 1) {
            if (this.debugStatusLabel) {
                this.debugStatusLabel.string = '请输入大于等于 1 的关卡';
            }
            return;
        }

        this.jumpToLevel(targetLevel);
    },
    onDebugTutorialButtonClick: function (event: EventTouch) {
        SfxManager.instance.playUiClick();
        event.propagationStopped = true;

        GameApp.user.firstGame = 0;
        GameApp.user.level = 1;
        GameApp.user.save();
        GameApp.passLevel = 0;
        GameApp.gameMode = GameMode.level;
        GameApp.isStartGame = true;
        GameApp.uiManager?.close(UIID.MainPanel);
        this.isGameOver = false;
        this.clearGuideOverlay?.();
        if (this.resultNode) {
            this.resultNode.active = false;
        }
        this.setGameUIVisible(true);
        this.reStartGame();

        if (this.debugStatusLabel) {
            this.debugStatusLabel.string = '已重置并进入新手教程';
        }
    },
    jumpToLevel: function (level: number) {
        const requestedLevel = Math.max(1, Math.floor(level));
        const targetLevel = this.clampLevel(requestedLevel);
        this.currentLevel = targetLevel;
        GameApp.passLevel = Math.max(0, targetLevel - 1);
        GameApp.gameMode = GameMode.level;
        GameApp.isStartGame = true;
        GameApp.uiManager?.close(UIID.MainPanel);
        this.isGameOver = false;

        if (this.resultNode) {
            this.resultNode.active = false;
        }

        this.saveGameData();
        this.syncProgressLabels();
        this.setGameUIVisible(true);
        this.initGrid(() => this.renderGrid());

        if (this.debugStatusLabel) {
            this.debugStatusLabel.string = requestedLevel > this.MAX_CONFIG_LEVEL
                ? `超过最大关，已跳到第 ${targetLevel} 关`
                : `已跳到第 ${targetLevel} 关`;
        }
    },
    clearMarkers: function () {
        if (this.isGameOver) return;
        SfxManager.instance.playUiClick(); // UI点击音效
        this.showWorkplaceToast('撤回排查记录', v3(0, 330, 0), new Color(255, 238, 92, 255));

        for (let i = 0; i < this.clickedSquares.length; i++) {
            this.clickedSquares[i] = false;
            // 只有未翻开的格子才重置其动画进度，已翻开（红X）的进度需保留
            if (!this.revealedSquares[i]) {
                this.xAnimationProgress[i] = 0;
            }
        }
        this.renderGrid();
    },
    toggleCoordinates: function () {
        SfxManager.instance.playUiClick(); // UI点击音效
        this.showCoordinates = !this.showCoordinates;
        this.showWorkplaceToast(
            this.showCoordinates ? '工位编号已开启' : '工位编号已关闭',
            v3(0, 330, 0),
            new Color(120, 220, 255, 255)
        );
        this.renderGrid();
    },
    bindSceneToolButtons: function (splash: Node): void {
        this.applySceneHintButtonSprites(splash);
        this.refreshSceneHintCountBadges(splash);
        this.syncSceneSideButtonLayout(splash);

        if (this.sceneToolButtonsBound) return;

        const bindings: { name: string; action: () => void }[] = [
            { name: 'tips1', action: this.useHint.bind(this) },
            { name: 'tips2', action: this.showHint.bind(this) },
            { name: 'clear', action: this.clearMarkers.bind(this) },
        ];
        if (ENABLE_DEBUG_TOOLS) {
            bindings.push({ name: 'point', action: this.toggleCoordinates.bind(this) });
        }

        for (const binding of bindings) {
            const node = splash.getChildByName(binding.name);
            if (!node) continue;

            const button = node.getComponent(Button);
            if (button) {
                button.clickEvents = [];
            }
            node.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                event.propagationStopped = true;
                if (binding.name === 'tips1' || binding.name === 'tips2') {
                    this.hideSceneHintGuidePrompt?.();
                    binding.action();
                    this.playSceneHintButtonClickFeedback?.(node);
                } else {
                    this.handleSceneHintGuideInteraction?.(8);
                    binding.action();
                }
            }, this);
        }

        this.sceneToolButtonsBound = true;
        this.refreshSceneHintCountBadges(splash);
        this.syncSceneSideButtonLayout(splash);
    },
    resetSceneHintGuidePrompt: function (): void {
        this.sceneHintGuideShownCount = 0;
        this.hideSceneHintGuidePrompt?.();
    },
    scheduleSceneHintGuidePrompt: function (delaySeconds: number = 8): void {
        this.sceneHintGuideSessionId = (this.sceneHintGuideSessionId || 0) + 1;
        if (!GameApp.isStartGame || this.isGameOver || this._isGuideMode) return;
        if (this.hintUsedThisLevel) return;
        if ((this.sceneHintGuideShownCount || 0) >= 2) return;

        const sessionId = this.sceneHintGuideSessionId;
        this.scheduleOnce(() => {
            if (sessionId !== this.sceneHintGuideSessionId) return;
            this.showSceneHintGuidePrompt?.(sessionId);
        }, Math.max(0.1, delaySeconds));
    },
    handleSceneHintGuideInteraction: function (delaySeconds: number = 8): void {
        this.hideSceneHintGuidePrompt?.();
        this.scheduleSceneHintGuidePrompt?.(delaySeconds);
    },
    hideSceneHintGuidePrompt: function (): void {
        this.sceneHintGuideSessionId = (this.sceneHintGuideSessionId || 0) + 1;
        const finger = this.sceneHintGuideFingerNode as Node | null;
        if (finger && finger.isValid) {
            tween(finger).stop();
            finger.active = false;
        }

        const target = this.sceneHintGuideTargetNode as Node | null;
        if (target && target.isValid) {
            tween(target).stop();
            const state = this.ensureSceneHintButtonLayoutState?.(target);
            if (state) {
                target.setScale(state.baseScale);
                target.setPosition(state.basePos.x, state.basePos.y, state.basePos.z);
            }
        }
        this.sceneHintGuideTargetNode = null;
        this.sceneHintGuideTargetKind = null;
    },
    playSceneHintButtonClickFeedback: function (node: Node): void {
        this.hideSceneHintGuidePrompt?.();
        if (!node || !node.isValid) return;
        const state = this.ensureSceneHintButtonLayoutState?.(node);
        const baseScale = state ? state.baseScale.clone() : node.scale.clone();
        tween(node).stop();
        node.setScale(baseScale);
        tween(node)
            .to(0.06, { scale: v3(baseScale.x * 0.94, baseScale.y * 0.94, baseScale.z) }, { easing: 'quadOut' })
            .to(0.1, { scale: v3(baseScale.x * 1.08, baseScale.y * 1.08, baseScale.z) }, { easing: 'backOut' })
            .to(0.1, { scale: baseScale }, { easing: 'quadInOut' })
            .start();
    },
    getSceneHintGuideTarget: function (): { node: Node; kind: HintKind } | null {
        const splash = director.getScene()?.getChildByName('Canvas')?.getChildByName('SpriteSplash');
        if (!splash || !splash.isValid || !splash.active) return null;

        const hiddenCowCount = this.cowPositions.reduce((count: number, isCow: boolean, index: number) => {
            return count + (isCow && !this.revealedSquares[index] ? 1 : 0);
        }, 0);
        const canUseHintKind = (kind: HintKind): boolean => {
            const count = typeof this.getAvailableHintCount === 'function' ? this.getAvailableHintCount(kind) : 0;
            const cost = typeof this.getHintCoinCost === 'function' ? this.getHintCoinCost(kind) : 0;
            return count > 0 || GameApp.user.coin >= cost;
        };
        const tips1 = splash.getChildByName('tips1');
        const tips2 = splash.getChildByName('tips2');
        if (tips1 && tips1.isValid && tips1.active && hiddenCowCount > 0 && canUseHintKind('cow')) {
            return { node: tips1, kind: 'cow' };
        }
        if (tips2 && tips2.isValid && tips2.active && canUseHintKind('exclude')) {
            return { node: tips2, kind: 'exclude' };
        }
        return null;
    },
    ensureSceneHintGuideFinger: function (splash: Node): Node {
        if (this.sceneHintGuideFingerNode && this.sceneHintGuideFingerNode.isValid) {
            this.sceneHintGuideFingerNode.parent = splash;
            return this.sceneHintGuideFingerNode;
        }

        const finger = createNode('SceneHintGuideFinger', splash);
        this.setUILayer(finger);
        finger.active = false;
        finger.setSiblingIndex(9999);
        finger.addComponent(CcUITransform).setContentSize(116, 116);
        const opacity = finger.addComponent(UIOpacity);
        opacity.opacity = 255;

        const sprite = finger.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;

        const fallback = createNode('SceneHintGuideFingerFallback', finger);
        this.setUILayer(fallback);
        const fallbackG = fallback.addComponent(Graphics);
        if (typeof this.drawFingerIcon === 'function') {
            this.drawFingerIcon(fallbackG);
        }

        AssetService.loadSpriteFrame('guide/guide_finger', (frame: SpriteFrame | null) => {
            if (!finger.isValid) return;
            if (!frame) {
                fallback.active = true;
                return;
            }
            sprite.spriteFrame = frame;
            fallback.active = false;
        }, 'smooth');

        this.sceneHintGuideFingerNode = finger;
        return finger;
    },
    showSceneHintGuidePrompt: function (sessionId: number): void {
        if (sessionId !== this.sceneHintGuideSessionId) return;
        if (!GameApp.isStartGame || this.isGameOver || this._isGuideMode) return;
        if (this.hintUsedThisLevel) return;
        if ((this.sceneHintGuideShownCount || 0) >= 2) return;
        if (this.hintPanelNode?.active) return;
        if (this.hintPurchasePanelNode?.isValid || this.hintUnlockGuidePanelNode?.isValid) return;

        const target = this.getSceneHintGuideTarget?.();
        if (!target) return;

        const splash = director.getScene()?.getChildByName('Canvas')?.getChildByName('SpriteSplash');
        if (!splash || !splash.isValid) return;

        const finger = this.ensureSceneHintGuideFinger(splash);
        const targetTransform = target.node.getComponent(CcUITransform);
        const splashTransform = splash.getComponent(CcUITransform);
        let base = v3(target.node.position.x + 38, target.node.position.y - 48, 0);
        if (targetTransform && splashTransform) {
            const width = targetTransform.contentSize.width || 120;
            const height = targetTransform.contentSize.height || 120;
            const world = targetTransform.convertToWorldSpaceAR(v3(width * 0.22, -height * 0.26, 0));
            base = splashTransform.convertToNodeSpaceAR(world);
        }

        const state = this.ensureSceneHintButtonLayoutState?.(target.node);
        const baseScale = state ? state.baseScale.clone() : target.node.scale.clone();
        const pulseScale = v3(baseScale.x * 1.12, baseScale.y * 1.12, baseScale.z);

        this.sceneHintGuideTargetNode = target.node;
        this.sceneHintGuideTargetKind = target.kind;
        this.sceneHintGuideShownCount = (this.sceneHintGuideShownCount || 0) + 1;

        tween(target.node).stop();
        target.node.setScale(baseScale);
        tween(target.node)
            .repeat(5,
                tween(target.node)
                    .to(0.26, { scale: pulseScale }, { easing: 'sineOut' })
                    .to(0.26, { scale: baseScale }, { easing: 'sineInOut' })
            )
            .start();

        tween(finger).stop();
        finger.active = true;
        finger.setSiblingIndex(9999);
        finger.setPosition(base);
        finger.setScale(v3(0.96, 0.96, 1));
        tween(finger)
            .repeat(4,
                tween(finger)
                    .to(0.22, { position: v3(base.x + 10, base.y - 10, 0), scale: v3(0.84, 0.84, 1) }, { easing: 'quadIn' })
                    .to(0.34, { position: base, scale: v3(1, 1, 1) }, { easing: 'quadOut' })
            )
            .call(() => {
                if (sessionId !== this.sceneHintGuideSessionId) return;
                this.hideSceneHintGuidePrompt?.();
            })
            .start();
    },
    applySceneHintButtonSprites: function (splash: Node): void {
        const tips1 = splash.getChildByName('tips1');
        const tips2 = splash.getChildByName('tips2');
        this.applySceneButtonSprite(tips1, 'images/提示-找牛');
        this.applySceneButtonSprite(tips2, 'images/提示-排除');
        this.syncSceneHintButtonSize(tips1);
        this.syncSceneHintButtonSize(tips2);
    },
    applySceneButtonSprite: function (node: Node | null, resourcePath: string): void {
        if (!node) return;
        const sprite = node.getComponent(Sprite);
        if (!sprite) return;
        const hintLayout = this.ensureSceneHintButtonLayoutState(node);
        const staticTransform = node.getComponent(CcUITransform);
        const staticWidth = hintLayout?.baseWidth ?? staticTransform?.contentSize.width ?? 0;
        const staticHeight = hintLayout?.baseHeight ?? staticTransform?.contentSize.height ?? 0;
        const staticScale = hintLayout?.baseScale?.clone() ?? node.scale.clone();
        AssetService.loadSpriteFrame(resourcePath, frame => {
            if (!frame) {
                console.error(`[DrawGrid] required hint button sprite missing: ${resourcePath}`);
                return;
            }
            if (!node.isValid) return;
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            this.restoreSceneStaticButtonSize(node, staticWidth, staticHeight, staticScale);
            this.syncSceneHintButtonSize(node);
            this.refreshSceneHintCountBadges?.();
        }, 'smooth');
    },
    ensureSceneHintButtonLayoutState: function (node: Node | null): { basePos: Vec3; baseWidth: number; baseHeight: number; baseScale: Vec3 } | null {
        if (!node || !node.isValid || (node.name !== 'tips1' && node.name !== 'tips2')) return null;
        const stateNode = node as Node & { __hintButtonLayoutState?: { basePos: Vec3; baseWidth: number; baseHeight: number; baseScale: Vec3 } };
        if (!stateNode.__hintButtonLayoutState) {
            const transform = node.getComponent(CcUITransform);
            stateNode.__hintButtonLayoutState = {
                basePos: node.position.clone(),
                baseWidth: transform?.contentSize.width || 160,
                baseHeight: transform?.contentSize.height || 160,
                baseScale: node.scale.clone(),
            };
        }
        return stateNode.__hintButtonLayoutState;
    },
    syncSceneHintButtonSize: function (node: Node | null): void {
        const state = this.ensureSceneHintButtonLayoutState(node);
        if (!node || !node.isValid || !state) return;

        const scale = 1.1;
        const width = state.baseWidth * scale;
        const height = state.baseHeight * scale;
        const transform = node.getComponent(CcUITransform) || node.addComponent(CcUITransform);
        transform.setContentSize(width, height);
        node.setScale(state.baseScale);
        node.setPosition(state.basePos.x, state.basePos.y, state.basePos.z);
        const sprite = node.getComponent(Sprite);
        if (sprite) {
            sprite.color = new Color(250, 252, 255, 255);
        }
    },
    syncSceneSideButtonLayout: function (splash: Node): void {
        const hintButtons = [splash.getChildByName('tips1'), splash.getChildByName('tips2')]
            .filter((node: Node | null): node is Node => !!node && node.isValid);
        const sceneSideButtonTargetY = hintButtons.length > 0
            ? hintButtons.reduce((sum, node) => sum + node.position.y, 0) / hintButtons.length
            : null;
        const sideButtons = [
            { node: splash.getChildByName('clear'), width: 116, height: 110, opacity: 182 },
            { node: splash.getChildByName('point'), width: 112, height: 110, opacity: 176 },
        ];
        sideButtons.forEach(({ node, width, height, opacity }) => {
            if (!node || !node.isValid) return;
            const transform = node.getComponent(CcUITransform) || node.addComponent(CcUITransform);
            transform.setContentSize(width, height);
            node.setScale(1, 1, 1);
            if (sceneSideButtonTargetY !== null) {
                node.setPosition(node.position.x, sceneSideButtonTargetY, node.position.z);
            }
            const uiOpacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
            uiOpacity.opacity = opacity;
            const sprite = node.getComponent(Sprite);
            if (sprite) {
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.trim = false;
            }
            const stateNode = node as Node & { __sideOpacityBound?: boolean };
            if (!stateNode.__sideOpacityBound) {
                node.on(Node.EventType.TOUCH_START, () => {
                    const currentOpacity = node.getComponent(UIOpacity);
                    if (currentOpacity) currentOpacity.opacity = 224;
                }, this);
                const restore = () => {
                    const currentOpacity = node.getComponent(UIOpacity);
                    if (currentOpacity) currentOpacity.opacity = opacity;
                };
                node.on(Node.EventType.TOUCH_END, restore, this);
                node.on(Node.EventType.TOUCH_CANCEL, restore, this);
                stateNode.__sideOpacityBound = true;
            }
        });
    },
    restoreSceneStaticButtonSize: function (node: Node, width: number, height: number, scale: Vec3): void {
        const transform = node.getComponent(CcUITransform) || node.addComponent(CcUITransform);
        if (width > 0 && height > 0) {
            transform.setContentSize(width, height);
        }
        node.setScale(scale);
    },
    refreshSceneHintCountBadges: function (splash?: Node): void {
        const root = splash || director.getScene()?.getChildByName('Canvas')?.getChildByName('SpriteSplash');
        if (!root || !root.isValid) return;

        const cowCount = typeof this.getAvailableHintCount === 'function' ? this.getAvailableHintCount('cow') : 0;
        const excludeCount = typeof this.getAvailableHintCount === 'function' ? this.getAvailableHintCount('exclude') : 0;
        this.lastHintBadgeCowCount = cowCount;
        this.lastHintBadgeExcludeCount = excludeCount;

        this.upsertSceneHintCountBadge(root.getChildByName('tips1'), this.formatHintBadgeText(cowCount));
        this.upsertSceneHintCountBadge(root.getChildByName('tips2'), this.formatHintBadgeText(excludeCount));
    },
    syncSceneHintCountBadgesIfChanged: function (): void {
        const cowCount = typeof this.getAvailableHintCount === 'function' ? this.getAvailableHintCount('cow') : 0;
        const excludeCount = typeof this.getAvailableHintCount === 'function' ? this.getAvailableHintCount('exclude') : 0;
        if (cowCount === this.lastHintBadgeCowCount && excludeCount === this.lastHintBadgeExcludeCount) {
            return;
        }
        const root = director.getScene()?.getChildByName('Canvas')?.getChildByName('SpriteSplash');
        if (!root || !root.isValid) {
            this.lastHintBadgeCowCount = cowCount;
            this.lastHintBadgeExcludeCount = excludeCount;
            return;
        }
        this.refreshSceneHintCountBadges?.(root);
    },
    formatHintBadgeText: function (count: number): string {
        const safeCount = Math.max(0, Math.floor(count || 0));
        return safeCount <= 0 ? '+' : (safeCount > 999 ? '999+' : safeCount.toString());
    },
    upsertSceneHintCountBadge: function (button: Node | null, text: string): void {
        if (!button || !button.isValid) return;

        let badge = button.getChildByName('HintCountBadge');
        if (!badge) {
            badge = new Node('HintCountBadge');
            this.setUILayer(badge);
            button.addChild(badge);
            badge.addComponent(CcUITransform);
            badge.addComponent(Graphics);

            const labelNode = new Node('HintCountLabel');
            this.setUILayer(labelNode);
            badge.addChild(labelNode);
            labelNode.addComponent(CcUITransform).setContentSize(82, 30);
            const label = labelNode.addComponent(Label);
            label.fontSize = 24;
            label.lineHeight = 28;
            label.isBold = true;
            label.color = COLOR_WHITE;
            label.string = text;
        }

        const buttonTransform = button.getComponent(CcUITransform);
        const buttonHeight = buttonTransform?.contentSize.height || 160;
        const badgeDiameter = text.length >= 3 ? 40 : 34;

        badge.active = button.active;
        badge.setPosition(0, -buttonHeight * 0.38, 0);
        badge.setSiblingIndex(button.children.length - 1);
        badge.getComponent(CcUITransform)?.setContentSize(badgeDiameter, badgeDiameter);

        const g = badge.getComponent(Graphics) || badge.addComponent(Graphics);
        g.clear();
        g.fillColor = new Color(42, 166, 236, 255);
        g.circle(0, 0, badgeDiameter * 0.5);
        g.fill();
        g.strokeColor = new Color(135, 220, 255, 170);
        g.lineWidth = 1.4;
        g.circle(0, 0, badgeDiameter * 0.5 - 1);
        g.stroke();

        const label = badge.getChildByName('HintCountLabel')?.getComponent(Label);
        if (label) {
            label.node.getComponent(CcUITransform)?.setContentSize(badgeDiameter, badgeDiameter);
            label.string = text;
            label.lineHeight = badgeDiameter;
            label.fontSize = text === '+' ? 28 : (text.length >= 3 ? 17 : 22);
        }
    },
    getHintKindTitle: function (kind: HintKind): string {
        return kind === 'cow' ? '猫猫雷达' : '提示';
    },
    getHintKindDescription: function (kind: HintKind): string {
        return kind === 'cow'
            ? '使用猫猫雷达，可以直接显示\n一只猫猫。'
            : '卡住了？立刻显示\n您的下一步。';
    },
    applyHintPurchaseIcon: function (card: Node, kind: HintKind): void {
        const iconNode = card.getChildByName('HintPurchaseVisualPanel')?.getChildByName('HintPurchaseIcon');
        if (!iconNode) return;
        const iconSprite = iconNode.getComponent(Sprite) || iconNode.addComponent(Sprite);
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        iconSprite.trim = false;
        iconSprite.color = COLOR_WHITE;
        const path = kind === 'cow' ? 'images/提示-找牛' : 'images/提示-排除';
        AssetService.loadSpriteFrame(path, frame => {
            if (!frame) {
                console.error(`[DrawGrid] required hint purchase icon missing: ${path}`);
                return;
            }
            if (!iconNode.isValid) return;
            iconSprite.spriteFrame = frame;
            iconNode.getComponent(CcUITransform)?.setContentSize(136, 136);
        }, 'smooth');
    },
    showHintPurchaseToast: function (text: string): void {
        const root = this.hintPurchasePanelNode as Node | null;
        if (!root || !root.isValid) return;
        const existing = root.getChildByName('HintPurchaseToast');
        if (existing?.isValid) existing.destroy();

        const toast = createNode('HintPurchaseToast', root);
        toast.getComponent(CcUITransform)?.setContentSize(510, 142);
        toast.setPosition(0, 8, 0);
        toast.setSiblingIndex(10000);
        const opacity = toast.addComponent(UIOpacity);
        opacity.opacity = 0;

        const bg = toast.addComponent(Graphics);
        bg.fillColor = new Color(14, 20, 38, 205);
        bg.rect(-255, -71, 510, 142);
        bg.fill();

        const label = createLabel('HintPurchaseToastLabel', toast, text, 46, COLOR_WHITE, true);
        label.node.getComponent(CcUITransform)?.setContentSize(460, 72);
        label.node.setPosition(0, 0, 0);
        label.lineHeight = 58;

        toast.setScale(v3(0.98, 0.98, 1));
        tween(opacity).to(0.08, { opacity: 255 }).delay(0.85).to(0.16, { opacity: 0 }).start();
        tween(toast).to(0.08, { scale: v3(1, 1, 1) }).delay(0.9).call(() => {
            if (toast.isValid) toast.destroy();
        }).start();
    },
    openHintPurchasePanel: function (kind: HintKind): void {
        const canvas = director.getScene()?.getChildByName('Canvas') || this.node.parent || this.node;
        if (!canvas) return;

        this.closeHintPurchasePanel?.();
        this.hintPurchaseKind = kind;

        const screenSize = getScreenSize();
        const root = createNode('HintPurchasePanel', canvas);
        root.getComponent(CcUITransform)?.setContentSize(screenSize.width, screenSize.height);
        root.setPosition(0, 0, 0);
        root.setSiblingIndex(9999);
        this.hintPurchasePanelNode = root;

        const overlay = createFullScreenOverlay('HintPurchaseOverlay', root, new Color(0, 0, 0, 255), 150);
        overlay.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
            SfxManager.instance.playUiClick();
            this.closeHintPurchasePanel();
        }, this);

        const card = createRoundedCard('HintPurchaseCard', root, 510, 540, new Color(255, 255, 255, 252), 28, 5, 38);
        card.setPosition(0, 0, 0);
        this.blockNodeTouch(card);

        const title = createLabel('HintPurchaseTitle', card, '', 34, new Color(42, 62, 100, 255), true);
        title.node.getComponent(CcUITransform)?.setContentSize(430, 50);
        title.node.setPosition(0, 224, 0);

        const desc = createLabel('HintPurchaseDesc', card, '', 25, new Color(112, 130, 145, 255));
        desc.node.getComponent(CcUITransform)?.setContentSize(450, 72);
        desc.node.setPosition(0, 154, 0);
        desc.lineHeight = 32;
        desc.overflow = Label.Overflow.SHRINK;

        const visualPanel = createNode('HintPurchaseVisualPanel', card);
        visualPanel.getComponent(CcUITransform)?.setContentSize(438, 220);
        visualPanel.setPosition(0, -32, 0);
        const visualG = visualPanel.addComponent(Graphics);
        visualG.fillColor = new Color(102, 113, 164, 255);
        visualG.roundRect(-219, -110, 438, 220, 28);
        visualG.fill();

        const iconNode = createNode('HintPurchaseIcon', visualPanel);
        iconNode.getComponent(CcUITransform)?.setContentSize(136, 136);
        iconNode.setPosition(0, 0, 0);
        iconNode.addComponent(Sprite);

        const buyBtn = createNode('HintPurchaseBuyBtn', card);
        buyBtn.getComponent(CcUITransform)?.setContentSize(190, 64);
        buyBtn.setPosition(-112, -188, 0);
        const buyG = buyBtn.addComponent(Graphics);
        buyG.fillColor = new Color(54, 139, 232, 255);
        buyG.roundRect(-95, -32, 190, 64, 32);
        buyG.fill();
        buyG.strokeColor = new Color(158, 220, 255, 230);
        buyG.lineWidth = 3;
        buyG.roundRect(-92, -29, 184, 58, 29);
        buyG.stroke();
        const coinIcon = createNode('HintPurchaseCoinIcon', buyBtn);
        coinIcon.getComponent(CcUITransform)?.setContentSize(34, 34);
        coinIcon.setPosition(-44, 0, 0);
        const coinG = coinIcon.addComponent(Graphics);
        coinG.fillColor = new Color(255, 205, 36, 255);
        coinG.circle(0, 0, 17);
        coinG.fill();
        coinG.fillColor = new Color(235, 168, 24, 255);
        coinG.roundRect(-3, -10, 6, 20, 3);
        coinG.fill();
        createLabel('HintPurchaseBuyLabel', buyBtn, '', 30, COLOR_WHITE, true)
            .node.getComponent(CcUITransform)?.setContentSize(112, 48);
        buyBtn.getChildByName('HintPurchaseBuyLabel')?.setPosition(24, 0, 0);
        addButtonFeedback(buyBtn);
        buyBtn.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
            this.onHintPurchaseBuyClick(kind);
        }, this);

        const adBtn = createNode('HintPurchaseAdBtn', card);
        adBtn.getComponent(CcUITransform)?.setContentSize(190, 64);
        adBtn.setPosition(112, -188, 0);
        const adG = adBtn.addComponent(Graphics);
        adG.fillColor = new Color(255, 171, 22, 255);
        adG.roundRect(-95, -32, 190, 64, 32);
        adG.fill();
        adG.strokeColor = new Color(255, 220, 124, 230);
        adG.lineWidth = 3;
        adG.roundRect(-92, -29, 184, 58, 29);
        adG.stroke();
        const playIcon = createNode('HintPurchasePlayIcon', adBtn);
        playIcon.getComponent(CcUITransform)?.setContentSize(42, 32);
        playIcon.setPosition(-42, 0, 0);
        const playG = playIcon.addComponent(Graphics);
        playG.fillColor = COLOR_WHITE;
        playG.roundRect(-21, -16, 42, 32, 6);
        playG.fill();
        playG.fillColor = new Color(255, 171, 22, 255);
        playG.moveTo(-5, -9);
        playG.lineTo(10, 0);
        playG.lineTo(-5, 9);
        playG.close();
        playG.fill();
        createLabel('HintPurchaseAdLabel', adBtn, '看广告', 27, COLOR_WHITE, true)
            .node.getComponent(CcUITransform)?.setContentSize(112, 46);
        adBtn.getChildByName('HintPurchaseAdLabel')?.setPosition(30, 0, 0);
        addButtonFeedback(adBtn);
        adBtn.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
            this.onHintPurchaseAdClick(kind);
        }, this);

        const closeBtn = createNode('HintPurchaseCloseBtn', card);
        closeBtn.getComponent(CcUITransform)?.setContentSize(58, 58);
        closeBtn.setPosition(218, 224, 0);
        const closeG = closeBtn.addComponent(Graphics);
        closeG.fillColor = new Color(236, 242, 252, 255);
        closeG.circle(0, 0, 29);
        closeG.fill();
        closeG.strokeColor = new Color(196, 210, 232, 255);
        closeG.lineWidth = 2;
        closeG.circle(0, 0, 27);
        closeG.stroke();
        createLabel('HintPurchaseCloseLabel', closeBtn, '×', 32, new Color(90, 106, 132, 255), true)
            .node.getComponent(CcUITransform)?.setContentSize(52, 52);
        addButtonFeedback(closeBtn);
        closeBtn.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
            SfxManager.instance.playUiClick();
            this.closeHintPurchasePanel();
        }, this);

        this.applyHintPurchaseIcon(card, kind);
        this.refreshHintPurchasePanel();
    },
    refreshHintPurchasePanel: function (): void {
        const root = this.hintPurchasePanelNode as Node | null;
        if (!root || !root.isValid) return;
        const kind = (this.hintPurchaseKind || 'exclude') as HintKind;
        const card = root.getChildByName('HintPurchaseCard');
        if (!card) return;

        const cost = typeof this.getHintCoinCost === 'function' ? this.getHintCoinCost(kind) : 1;
        const title = card.getChildByName('HintPurchaseTitle')?.getComponent(Label);
        const desc = card.getChildByName('HintPurchaseDesc')?.getComponent(Label);
        const buyLabel = card.getChildByName('HintPurchaseBuyBtn')?.getChildByName('HintPurchaseBuyLabel')?.getComponent(Label);
        const adBtn = card.getChildByName('HintPurchaseAdBtn');

        if (title) title.string = this.getHintKindTitle(kind);
        if (desc) desc.string = this.getHintKindDescription(kind);
        if (buyLabel) buyLabel.string = `${cost}`;
        if (adBtn) adBtn.active = RewardService.isRewardAdAvailable();
    },
    onHintPurchaseBuyClick: function (kind: HintKind): void {
        SfxManager.instance.playUiClick();
        const cost = typeof this.getHintCoinCost === 'function' ? this.getHintCoinCost(kind) : 1;

        if (GameApp.user.coin < cost) {
            this.showHintPurchaseToast?.('金币不足');
            return;
        }

        if (typeof this.buyHintCount === 'function' && this.buyHintCount(kind)) {
            this.refreshHintPurchasePanel();
            this.closeHintPurchasePanel();
        }
    },
    onHintPurchaseAdClick: function (kind: HintKind): void {
        SfxManager.instance.playUiClick();
        const root = this.hintPurchasePanelNode as Node | null;

        if (!RewardService.isRewardAdAvailable()) {
            this.showHintPurchaseToast?.('暂无可用广告');
            return;
        }
        this.showHintPurchaseToast?.('广告播放中');

        RewardService.requestReward((rewarded) => {
            if (!root?.isValid) return;
            if (!rewarded) {
                this.showHintPurchaseToast?.('完整观看后领取');
                return;
            }
            const currentCount = typeof this.getAvailableHintCount === 'function'
                ? this.getAvailableHintCount(kind)
                : 0;
            if (typeof this.setAvailableHintCount === 'function') {
                this.setAvailableHintCount(kind, currentCount + 1);
            } else {
                if (kind === 'cow') {
                    GameApp.user.cowHintCount = currentCount + 1;
                } else {
                    GameApp.user.excludeHintCount = currentCount + 1;
                }
                GameApp.user.save();
                this.refreshSceneHintCountBadges?.();
            }
            const hintName = typeof this.getHintKindTitle === 'function' ? this.getHintKindTitle(kind) : '提示';
            this.closeHintPurchasePanel?.();
            this.showWorkplaceToast?.(`${hintName} +1`, v3(0, 330, 0), new Color(255, 238, 92, 255));
        });
    },
    closeHintPurchasePanel: function (): void {
        const root = this.hintPurchasePanelNode as Node | null;
        if (root?.isValid) {
            root.destroy();
        }
        this.hintPurchasePanelNode = null;
        this.hintPurchaseKind = null;
    },
    scheduleHintUnlockGuideIfNeeded: function (): void {
        if (GameApp.gameMode !== GameMode.level || !GameApp.isStartGame || this._isGuideMode || GameApp.isGuideSettlement) return;
        const level = Math.max(1, Math.floor(GameApp.user.level || 1));
        const kind: HintKind | null = level === 2 && !GameApp.user.excludeHintUnlockShown
            ? 'exclude'
            : level === 4 && !GameApp.user.cowHintUnlockShown
                ? 'cow'
                : null;
        if (!kind) return;
        if (this.hintUnlockGuidePanelNode?.isValid || this.hintUnlockGuideClosing) return;
        const scheduleKey = `${level}:${kind}`;
        if (this.hintUnlockGuideScheduleKey === scheduleKey) return;
        this.hintUnlockGuideScheduleKey = scheduleKey;
        this.scheduleOnce(() => {
            if (this.hintUnlockGuideScheduleKey !== scheduleKey) return;
            this.showHintUnlockGuideIfNeeded?.(kind);
        }, 0.35);
    },
    showHintUnlockGuideIfNeeded: function (kind: HintKind): void {
        this.hintUnlockGuideScheduleKey = '';
        if (GameApp.gameMode !== GameMode.level || this._isGuideMode || GameApp.isGuideSettlement || this.isGameOver) return;
        if (kind === 'exclude' && GameApp.user.excludeHintUnlockShown) return;
        if (kind === 'cow' && GameApp.user.cowHintUnlockShown) return;

        const canvas = director.getScene()?.getChildByName('Canvas');
        if (!canvas) return;
        this.closeHintUnlockGuidePanel?.(false);

        const screenSize = getScreenSize();
        const root = createNode('HintUnlockGuidePanel', canvas);
        root.getComponent(CcUITransform)?.setContentSize(screenSize.width, screenSize.height);
        root.setPosition(0, 0, 0);
        root.setSiblingIndex(10000);
        root.active = false;
        this.hintUnlockGuidePanelNode = root;
        this.hintUnlockGuideKind = kind;
        this.hintUnlockGuideClosing = false;

        const overlay = createFullScreenOverlay('HintUnlockGuideOverlay', root, new Color(0, 0, 0, 255), 132);
        overlay.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
            this.closeHintUnlockGuidePanel?.(true);
        }, this);

        const imageWidth = 375;
        const imageHeight = 666;
        let cardWidth = Math.min(screenSize.width * 0.78, 560);
        let cardHeight = cardWidth * imageHeight / imageWidth;
        const maxHeight = screenSize.height * 0.86;
        if (cardHeight > maxHeight) {
            cardHeight = maxHeight;
            cardWidth = cardHeight * imageWidth / imageHeight;
        }

        const card = createNode('HintUnlockGuideCard', root);
        card.getComponent(CcUITransform)?.setContentSize(cardWidth, cardHeight);
        card.setPosition(0, 0, 0);
        card.setScale(v3(0.92, 0.92, 1));
        card.on(Node.EventType.TOUCH_START, (event: EventTouch) => { event.propagationStopped = true; }, this);
        card.on(Node.EventType.TOUCH_END, (event: EventTouch) => { event.propagationStopped = true; }, this);

        const sprite = card.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        const assetPath = kind === 'cow' ? 'guide/fourth_hint_unlock' : 'guide/second_hint_unlock';
        AssetService.loadSpriteFrame(assetPath, (frame: SpriteFrame | null) => {
            if (!frame) {
                console.error(`[DrawGrid] required hint unlock guide sprite missing: ${assetPath}`);
                this.closeHintUnlockGuidePanel?.(false);
                return;
            }
            if (!card.isValid || !root.isValid) return;
            if (GameApp.gameMode !== GameMode.level || this._isGuideMode || GameApp.isGuideSettlement || this.isGameOver) {
                this.closeHintUnlockGuidePanel?.(false);
                return;
            }
            if (kind === 'exclude' && GameApp.user.excludeHintUnlockShown) {
                this.closeHintUnlockGuidePanel?.(false);
                return;
            }
            if (kind === 'cow' && GameApp.user.cowHintUnlockShown) {
                this.closeHintUnlockGuidePanel?.(false);
                return;
            }
            sprite.spriteFrame = frame;
            root.active = true;
            tween(card)
                .to(0.16, { scale: v3(1.02, 1.02, 1) }, { easing: 'backOut' })
                .to(0.08, { scale: v3(1, 1, 1) }, { easing: 'quadOut' })
                .start();
            this.scheduleOnce(() => this.closeHintUnlockGuidePanel?.(true), 6);
        }, 'smooth');

        const closeHotspot = createNode('HintUnlockGuideCloseHotspot', card);
        closeHotspot.getComponent(CcUITransform)?.setContentSize(92, 92);
        closeHotspot.setPosition(cardWidth * 0.39, cardHeight * 0.37, 0);
        closeHotspot.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
            SfxManager.instance.playUiClick();
            this.closeHintUnlockGuidePanel?.(true);
        }, this);

        const guideInfoPanel = createNode('HintUnlockGuideInfoPanel', card);
        guideInfoPanel.getComponent(CcUITransform)?.setContentSize(cardWidth - 52, 132);
        guideInfoPanel.setPosition(0, -cardHeight * 0.33, 0);
        const guideInfoG = guideInfoPanel.addComponent(Graphics);
        guideInfoG.fillColor = new Color(255, 249, 236, 236);
        guideInfoG.roundRect(-(cardWidth - 52) / 2, -66, cardWidth - 52, 132, 24);
        guideInfoG.fill();
        guideInfoG.strokeColor = new Color(237, 171, 82, 220);
        guideInfoG.lineWidth = 2;
        guideInfoG.roundRect(-(cardWidth - 56) / 2, -62, cardWidth - 56, 124, 22);
        guideInfoG.stroke();

        const guideTitle = createLabel(
            'HintUnlockGuideTitle',
            guideInfoPanel,
            kind === 'cow' ? '猫猫雷达已解锁' : '排除提示已解锁',
            24,
            new Color(133, 80, 35, 255),
            true
        );
        guideTitle.node.getComponent(CcUITransform)?.setContentSize(cardWidth - 92, 34);
        guideTitle.node.setPosition(0, 28, 0);

        const guideDesc = createLabel(
            'HintUnlockGuideDesc',
            guideInfoPanel,
            kind === 'cow'
                ? '卡关时直接锁定一只猫猫，少走弯路。'
                : '帮你高亮一批可排除格子，点一键应用更省事。',
            19,
            new Color(121, 117, 109, 255)
        );
        guideDesc.node.getComponent(CcUITransform)?.setContentSize(cardWidth - 104, 46);
        guideDesc.node.setPosition(0, -6, 0);
        guideDesc.lineHeight = 25;
        guideDesc.overflow = Label.Overflow.SHRINK;

        const guideHint = createLabel(
            'HintUnlockGuideTapHint',
            guideInfoPanel,
            '点击任意位置继续',
            17,
            new Color(198, 140, 73, 255),
            true
        );
        guideHint.node.getComponent(CcUITransform)?.setContentSize(cardWidth - 120, 28);
        guideHint.node.setPosition(0, -42, 0);

    },
    closeHintUnlockGuidePanel: function (animate: boolean = true): void {
        const root = this.hintUnlockGuidePanelNode as Node | null;
        if (!root?.isValid) {
            this.hintUnlockGuidePanelNode = null;
            this.hintUnlockGuideClosing = false;
            return;
        }
        const kind = (this.hintUnlockGuideKind || 'exclude') as HintKind;
        const card = root.getChildByName('HintUnlockGuideCard');
        if (!card?.isValid || !animate) {
            root.destroy();
            this.hintUnlockGuidePanelNode = null;
            this.hintUnlockGuideKind = null;
            this.hintUnlockGuideClosing = false;
            return;
        }
        if (this.hintUnlockGuideClosing) return;
        this.hintUnlockGuideClosing = true;
        const targetPos = this.getHintUnlockTargetPosition?.(kind) || v3(card.position.x, card.position.y + 220, 0);
        const rootOpacity = root.getComponent(UIOpacity) || root.addComponent(UIOpacity);
        tween(rootOpacity).to(0.28, { opacity: 0 }, { easing: 'quadOut' }).start();
        tween(card)
            .to(0.46, { position: targetPos, scale: v3(0.16, 0.16, 1) }, { easing: 'quadInOut' })
            .call(() => {
                this.grantHintUnlockReward?.(kind);
                if (root.isValid) root.destroy();
                this.hintUnlockGuidePanelNode = null;
                this.hintUnlockGuideKind = null;
                this.hintUnlockGuideClosing = false;
            })
            .start();
    },
    getHintUnlockTargetPosition: function (kind: HintKind): Vec3 | null {
        const canvas = director.getScene()?.getChildByName('Canvas');
        const splash = canvas?.getChildByName('SpriteSplash');
        const target = splash?.getChildByName(kind === 'cow' ? 'tips1' : 'tips2') || null;
        const canvasTransform = canvas?.getComponent(CcUITransform);
        const targetTransform = target?.getComponent(CcUITransform);
        if (!canvasTransform || !targetTransform || !target?.isValid) return null;
        const world = targetTransform.convertToWorldSpaceAR(v3(0, 0, 0));
        return canvasTransform.convertToNodeSpaceAR(world);
    },
    grantHintUnlockReward: function (kind: HintKind): void {
        if (kind === 'cow') {
            if (GameApp.user.cowHintUnlockShown) return;
            GameApp.user.cowHintUnlockShown = true;
        } else {
            if (GameApp.user.excludeHintUnlockShown) return;
            GameApp.user.excludeHintUnlockShown = true;
        }
        const currentCount = typeof this.getAvailableHintCount === 'function'
            ? this.getAvailableHintCount(kind)
            : (kind === 'cow' ? GameApp.user.cowHintCount : GameApp.user.excludeHintCount);
        if (typeof this.setAvailableHintCount === 'function') {
            this.setAvailableHintCount(kind, currentCount + 1);
        } else if (kind === 'cow') {
            GameApp.user.cowHintCount = currentCount + 1;
            GameApp.user.save();
        } else {
            GameApp.user.excludeHintCount = currentCount + 1;
            GameApp.user.save();
        }
        this.refreshSceneHintCountBadges?.();
        this.showWorkplaceToast?.(`${this.getHintKindTitle(kind)} +1`, v3(0, 330, 0), new Color(255, 238, 92, 255));
    },
    configureGlobalGameplayHud: function (splash: Node): void {
        const canvas = splash.parent;
        if (!canvas) return;

        const canvasTransform = canvas.getComponent(CcUITransform);
        const width = canvasTransform?.contentSize.width || view.getVisibleSize().width || 750;
        const height = canvasTransform?.contentSize.height || view.getVisibleSize().height || 1334;
        const layout = this.getLeftHudLayout(width, height);
        this.setupRuleBoxNodes?.();
        const topRows = this.shouldUseLevelTopHudRows() ? this.getLevelModeTopHudRows(width, height) : null;
        const isDailyMode = GameApp.gameMode === GameMode.daily_challenge;
        const getRowsAboveRuleBox = (targetNode: Node, firstOffset = 118, secondOffset = 62): { firstRowY: number; secondRowY: number } => {
            const fallback = topRows || this.getLevelModeTopHudRows(width, height);
            const ruleNode = this.ruleBoxNode as Node | null;
            const ruleTransform = ruleNode?.getComponent(CcUITransform);
            const targetParentTransform = targetNode.parent?.getComponent(CcUITransform);
            if (!ruleNode?.isValid || !ruleTransform || !targetParentTransform) {
                return fallback;
            }

            const anchorY = ruleTransform.anchorPoint?.y ?? 0.5;
            const ruleTopLocalY = ruleTransform.contentSize.height * (1 - anchorY);
            const ruleTopWorld = ruleTransform.convertToWorldSpaceAR(v3(0, ruleTopLocalY, 0));
            const ruleTopY = targetParentTransform.convertToNodeSpaceAR(ruleTopWorld).y;
            const ruleBased = {
                firstRowY: ruleTopY + firstOffset + GAMEPLAY_TOP_HUD_SHIFT_Y - GAMEPLAY_RULE_BOX_SHIFT_Y,
                secondRowY: ruleTopY + secondOffset + GAMEPLAY_TOP_HUD_SHIFT_Y - GAMEPLAY_RULE_BOX_SHIFT_Y,
            };
            return {
                firstRowY: Math.max(fallback.firstRowY, ruleBased.firstRowY),
                secondRowY: Math.max(fallback.secondRowY, ruleBased.secondRowY),
            };
        };

        if (topRows || isDailyMode) {
            const levelTopDownY = isDailyMode ? 0 : GAMEPLAY_LEVEL_TOP_DOWN_Y;
            if (this.levelLabel?.node && this.levelLabel.node.isValid) {
                const levelLabel = this.levelLabel as Label;
                levelLabel.fontSize = 34;
                levelLabel.lineHeight = 38;
                levelLabel.color = GAMEPLAY_LEVEL_TITLE_COLOR;
                const levelNode = this.levelLabel.node;
                const rows = getRowsAboveRuleBox(levelNode, isDailyMode ? 132 : 118, isDailyMode ? 76 : 62);
                levelNode.setPosition(0, rows.firstRowY - levelTopDownY + GAMEPLAY_LEVEL_HEART_GROUP_OFFSET_Y, levelNode.position.z);
            }
            if (this.heartContainer && this.heartContainer.isValid) {
                const rows = getRowsAboveRuleBox(this.heartContainer, isDailyMode ? 132 : 118, isDailyMode ? 76 : 62);
                this.heartContainer.setPosition(0, rows.secondRowY - levelTopDownY + GAMEPLAY_LEVEL_HEART_GROUP_OFFSET_Y, this.heartContainer.position.z);
                this.heartContainer.setScale(v3(GAMEPLAY_HEART_CONTAINER_SCALE, GAMEPLAY_HEART_CONTAINER_SCALE, 1));
                this.resetHearts?.();
            }
        }

        if (this.coinLabel?.node && this.coinLabel.node.isValid) {
            const coinLabelNode = this.coinLabel.node;
            const coinNode = (coinLabelNode.parent && coinLabelNode.parent.isValid) ? coinLabelNode.parent : coinLabelNode;
            const rows = topRows ? getRowsAboveRuleBox(coinNode) : null;
            coinNode.active = false;
            coinNode.setPosition(topRows ? coinNode.position.x : layout.coinX, rows?.secondRowY ?? layout.coinY, 0);
            coinNode.setSiblingIndex(50);
        }

        if (this.gameplaySettingButton && this.gameplaySettingButton.isValid) {
            this.gameplaySettingButton.active = false;
        }
        const globalHud = GameApp.globalHud as { syncLayout?: () => void } | null;
        globalHud?.syncLayout?.();
        this.refreshGlobalHudCoin(false);
    },
    refreshGlobalHudCoin: function (animated: boolean): void {
        const globalHud = GameApp.globalHud as { refreshCoin?: (animated?: boolean) => void } | null;
        globalHud?.refreshCoin?.(animated);
    },
    });
}
