import {
    _decorator,
    Component,
    Node,
    Label,
    Graphics,
    Color,
    Size,
    Sprite,
    SpriteFrame,
    UITransform,
    Widget,
    Layers,
    tween,
    v3,
    view,
} from 'cc';
import GameApp from './Core/GameApp';
import { UIID } from './Core/Enum';
import SfxManager from './Core/SfxManager';
import AssetService from './Core/AssetService';
import { addButtonFeedback, COLOR_GOLD, COLOR_STAMINA } from './Utils/UIBuilder';
import { getAdaptiveLayout } from './Utils/LayoutService';

const { ccclass } = _decorator;
const COLOR_STAMINA_COUNTDOWN = new Color(36, 40, 48, 255);
const HUD_SURFACE = new Color(244, 248, 255, 246);
const HUD_SURFACE_EDGE = new Color(214, 232, 253, 218);
const HUD_SURFACE_INNER_EDGE = new Color(255, 255, 255, 190);
const HUD_SURFACE_BOTTOM_EDGE = new Color(186, 214, 246, 128);
const HUD_SURFACE_HIGHLIGHT = new Color(255, 255, 255, 96);
const HUD_SURFACE_SHADOW = new Color(150, 179, 212, 58);
const HUD_COUNTDOWN_BG = new Color(238, 241, 246, 230);
const HUD_COUNTDOWN_SHADOW = new Color(90, 104, 128, 46);
const HUD_COIN_PILL_WIDTH = 116;
const HUD_COIN_PILL_HEIGHT = 46;
const HUD_STAMINA_PILL_WIDTH = 190;
const HUD_STAMINA_PILL_HEIGHT = 65;
const HUD_STAMINA_LEFT_OFFSET = -16;
const HUD_IMAGE_PILL_PATH = 'images/hud_pill_base';
const HUD_STAMINA_FRAME_PATH = 'images/hud_stamina_frame';
const HUD_SETTING_BUTTON_SIZE = 96;
const HUD_SETTING_ICON_WIDTH = 101;
const HUD_SETTING_ICON_HEIGHT = 84;
const HUD_TEXT = new Color(255, 255, 255, 255);
const HUD_TEXT_SHADOW = new Color(92, 100, 116, 205);
const HUD_NUMBER_TEXT = new Color(70, 86, 118, 255);
const HUD_NUMBER_SHADOW = new Color(255, 255, 255, 105);
const HUD_STAMINA_CURRENT_TEXT = new Color(111, 149, 109, 255);
const HUD_STAMINA_MAX_TEXT = new Color(36, 40, 48, 255);
const HUD_STAMINA_SLASH_TEXT = new Color(138, 160, 143, 235);

export enum GlobalHudMode {
    Home = 'home',
    Gameplay = 'gameplay',
    SurvivalGameplay = 'survivalGameplay',
    LevelFail = 'levelFail',
    LevelWin = 'levelWin',
    ChallengeSettlement = 'challengeSettlement',
    Hidden = 'hidden',
}

@ccclass('GlobalHud')
export default class GlobalHud extends Component {
    private mode: GlobalHudMode = GlobalHudMode.Home;
    private settingButton: Node | null = null;
    private homeButton: Node | null = null;
    private coinNode: Node | null = null;
    private coinLabel: Label | null = null;
    private coinShadowLabel: Label | null = null;
    private coinSprite: Sprite | null = null;
    private staminaNode: Node | null = null;
    private staminaLabel: Label | null = null;
    private staminaShadowLabel: Label | null = null;
    private staminaSlashLabel: Label | null = null;
    private staminaSlashShadowLabel: Label | null = null;
    private staminaMaxLabel: Label | null = null;
    private staminaMaxShadowLabel: Label | null = null;
    private staminaCountdownNode: Node | null = null;
    private staminaCountdownLabel: Label | null = null;
    private readonly designMaxWidth = 750;
    private readonly hudLeftMargin = 38;
    private readonly hudTopMargin = 0;
    private readonly hudFixedDrop = 60;
    private readonly hudVisualScale = 1.05;
    private readonly coinIconX = -36;
    private readonly coinLabelX = 25;
    private readonly coinLabelWidth = 64;

    onLoad(): void {
        GameApp.globalHud = this;
        this.node.layer = Layers.Enum.UI_2D;
        const transform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        transform.setContentSize(view.getVisibleSize());

        const widget = this.node.getComponent(Widget) || this.node.addComponent(Widget);
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.top = 0;
        widget.bottom = 0;
        widget.left = 0;
        widget.right = 0;

        this.buildHud();
        this.refreshCoin(false);
        this.refreshStamina();
        this.schedule(this.refreshStamina, 1);
    }

    onEnable(): void {
        this.layoutHud();
        this.refreshCoin(false);
        this.refreshStamina();
    }

    onDestroy(): void {
        if (GameApp.globalHud === this) {
            GameApp.globalHud = null;
        }
    }

    public refreshCoin(animated = false): void {
        if (!this.coinLabel) return;
        const value = `${GameApp.user?.coin ?? 0}`;
        this.coinLabel.string = value;
        if (this.coinShadowLabel) {
            this.coinShadowLabel.string = value;
        }
        if (animated) {
            this.playCoinBounce();
        }
    }

    public playCoinBounce(): void {
        if (!this.coinNode?.isValid) return;
        const target = this.coinNode;
        tween(target).stop();
        target.setScale(v3(1, 1, 1));
        tween(target)
            .to(0.12, { scale: v3(1.18, 1.18, 1) }, { easing: 'quadOut' })
            .to(0.1, { scale: v3(0.96, 0.96, 1) }, { easing: 'quadIn' })
            .to(0.1, { scale: v3(1, 1, 1) }, { easing: 'quadOut' })
            .start();
    }

    public getCoinNode(): Node | null {
        return this.coinNode?.isValid ? this.coinNode : null;
    }

    public getCoinSprite(): Sprite | null {
        return this.coinSprite?.node?.isValid ? this.coinSprite : null;
    }

    public refreshStamina(): void {
        if (!this.staminaLabel) return;
        const stamina = GameApp.user?.stamina ?? 60;
        const maxS = GameApp.tiliManager?.getMaxStamina() ?? 120;
        const staminaText = `${stamina}`;
        this.staminaLabel.string = staminaText;
        if (this.staminaShadowLabel) {
            this.staminaShadowLabel.string = staminaText;
        }
        if (this.staminaSlashLabel) {
            this.staminaSlashLabel.string = '/';
            if (this.staminaSlashShadowLabel) {
                this.staminaSlashShadowLabel.string = '/';
            }
        }
        if (this.staminaMaxLabel) {
            const maxText = `${maxS}`;
            this.staminaMaxLabel.string = maxText;
            if (this.staminaMaxShadowLabel) {
                this.staminaMaxShadowLabel.string = maxText;
            }
        }
        this.refreshStaminaCountdown(stamina, maxS);
    }

    public setStaminaVisible(visible: boolean): void {
        if (!this.staminaNode?.isValid) return;
        this.staminaNode.active = visible;
        if (visible) {
            this.refreshStamina();
        }
    }

    public setMode(mode: GlobalHudMode): void {
        this.mode = mode;
        this.node.active = mode !== GlobalHudMode.Hidden;
        if (this.node.active) {
            this.refreshCoin(false);
            this.refreshStamina();
            this.layoutHud();
        }
    }

    public syncLayout(): void {
        const transform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        transform.setContentSize(view.getVisibleSize());
        this.layoutHud();
    }

    public layoutGameplayLeftGroup(_settingY: number, _coinY: number): void {
        if (this.mode !== GlobalHudMode.Gameplay) {
            this.setMode(GlobalHudMode.Gameplay);
        }
        this.layoutHud();
    }

    private buildHud(): void {
        this.settingButton = this.createNode('GlobalSettingButton');
        this.settingButton.getComponent(UITransform)!.setContentSize(new Size(this.scaleHud(HUD_SETTING_BUTTON_SIZE), this.scaleHud(HUD_SETTING_BUTTON_SIZE)));
        const settingIcon = this.createNode('GlobalSettingIcon', this.settingButton);
        settingIcon.getComponent(UITransform)!.setContentSize(new Size(this.scaleHud(HUD_SETTING_ICON_WIDTH), this.scaleHud(HUD_SETTING_ICON_HEIGHT)));
        const settingSprite = settingIcon.addComponent(Sprite);
        settingSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        settingSprite.trim = false;
        this.loadSettingIcon(settingSprite);
        addButtonFeedback(this.settingButton);
        this.settingButton.on(Node.EventType.TOUCH_START, this.onSettingTouchStart, this);
        this.settingButton.on(Node.EventType.TOUCH_END, this.onSettingClick, this);

        this.homeButton = this.createNode('GlobalHomeButton');
        this.homeButton.getComponent(UITransform)!.setContentSize(new Size(this.scaleHud(64), this.scaleHud(64)));
        this.drawRoundIconSurface(this.homeButton, new Color(104, 130, 224, 255));
        this.drawHomeIcon(this.homeButton);
        addButtonFeedback(this.homeButton);
        this.homeButton.on(Node.EventType.TOUCH_END, this.onHomeClick, this);

        this.coinNode = this.createNode('GlobalCoinHud');
        const coinPillWidth = this.scaleHud(HUD_COIN_PILL_WIDTH);
        const coinPillHeight = this.scaleHud(HUD_COIN_PILL_HEIGHT);
        this.coinNode.getComponent(UITransform)!.setContentSize(new Size(coinPillWidth, coinPillHeight));
        this.addImagePillSurface(this.coinNode, coinPillWidth, coinPillHeight);

        const coinContent = this.createNode('GlobalCoinContent', this.coinNode);
        coinContent.getComponent(UITransform)!.setContentSize(new Size(this.scaleHud(100), this.scaleHud(46)));
        coinContent.setPosition(0, 0, 0);

        const iconNode = this.createNode('GlobalCoinIcon', coinContent);
        iconNode.getComponent(UITransform)!.setContentSize(new Size(this.scaleHud(46), this.scaleHud(46)));
        iconNode.setPosition(this.scaleHud(this.coinIconX), 0, 0);
        const iconSprite = iconNode.addComponent(Sprite);
        iconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        iconSprite.trim = false;
        this.coinSprite = iconSprite;
        this.loadCoinIcon(iconSprite);

        const labelNode = this.createNode('GlobalCoinValue', coinContent);
        labelNode.getComponent(UITransform)!.setContentSize(new Size(this.scaleHud(this.coinLabelWidth), this.scaleHud(40)));
        labelNode.setPosition(this.scaleHud(this.coinLabelX), 0, 0);
        this.coinShadowLabel = this.addShadowLabel(labelNode, 'GlobalCoinShadow', this.scaleHud(30), HUD_NUMBER_SHADOW, this.scaleHud(1), -this.scaleHud(1));
        const coinLabel = this.addShadowLabel(labelNode, 'GlobalCoinText', this.scaleHud(30), HUD_NUMBER_TEXT, 0, 0);
        this.coinShadowLabel.lineHeight = this.scaleHud(40);
        coinLabel.lineHeight = this.scaleHud(40);
        this.coinShadowLabel.overflow = Label.Overflow.SHRINK;
        coinLabel.overflow = Label.Overflow.SHRINK;
        this.coinShadowLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        coinLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.coinLabel = coinLabel;

        this.staminaNode = this.createNode('GlobalStaminaHud');
        const staminaPillWidth = this.scaleHud(HUD_STAMINA_PILL_WIDTH);
        const staminaPillHeight = this.scaleHud(HUD_STAMINA_PILL_HEIGHT);
        this.staminaNode.getComponent(UITransform)!.setContentSize(new Size(staminaPillWidth, staminaPillHeight));
        this.addImagePillSurface(this.staminaNode, staminaPillWidth, staminaPillHeight, HUD_STAMINA_FRAME_PATH);
        this.staminaNode.on(Node.EventType.TOUCH_END, this.onStaminaAddClick, this);

        const staminaFontSize = this.scaleHud(24);
        const staminaLineHeight = this.scaleHud(42);
        const staminaTextGroupWidth = this.scaleHud(116);
        const staminaValueWidth = Math.round(staminaTextGroupWidth * 0.43);
        const staminaSlashWidth = this.scaleHud(16);
        const staminaMaxWidth = staminaTextGroupWidth - staminaValueWidth - staminaSlashWidth;
        const staminaTextLeft = -staminaTextGroupWidth / 2;
        const staminaTextY = -this.scaleHud(4);
        const staminaValue = this.createNode('GlobalStaminaValue', this.staminaNode);
        staminaValue.getComponent(UITransform)!.setContentSize(new Size(staminaValueWidth, staminaLineHeight));
        staminaValue.setPosition(staminaTextLeft + staminaValueWidth / 2, staminaTextY, 0);
        this.staminaShadowLabel = this.addShadowLabel(staminaValue, 'GlobalStaminaShadow', staminaFontSize, HUD_NUMBER_SHADOW, this.scaleHud(1), -this.scaleHud(1));
        const staminaLabel = this.addShadowLabel(staminaValue, 'GlobalStaminaText', staminaFontSize, HUD_STAMINA_CURRENT_TEXT, 0, 0);
        this.staminaShadowLabel.lineHeight = staminaLineHeight;
        staminaLabel.lineHeight = staminaLineHeight;
        this.staminaShadowLabel.overflow = Label.Overflow.SHRINK;
        staminaLabel.overflow = Label.Overflow.SHRINK;
        this.staminaShadowLabel.horizontalAlign = Label.HorizontalAlign.RIGHT;
        staminaLabel.horizontalAlign = Label.HorizontalAlign.RIGHT;
        this.staminaLabel = staminaLabel;

        const staminaSlashValue = this.createNode('GlobalStaminaSlash', this.staminaNode);
        staminaSlashValue.getComponent(UITransform)!.setContentSize(new Size(staminaSlashWidth, staminaLineHeight));
        staminaSlashValue.setPosition(staminaTextLeft + staminaValueWidth + staminaSlashWidth / 2, staminaTextY, 0);
        this.staminaSlashShadowLabel = this.addShadowLabel(staminaSlashValue, 'GlobalStaminaSlashShadow', staminaFontSize, HUD_NUMBER_SHADOW, this.scaleHud(1), -this.scaleHud(1));
        const staminaSlashLabel = this.addShadowLabel(staminaSlashValue, 'GlobalStaminaSlashText', staminaFontSize, HUD_STAMINA_SLASH_TEXT, 0, 0);
        this.staminaSlashShadowLabel.lineHeight = staminaLineHeight;
        staminaSlashLabel.lineHeight = staminaLineHeight;
        this.staminaSlashShadowLabel.string = '/';
        staminaSlashLabel.string = '/';
        this.staminaSlashLabel = staminaSlashLabel;

        const staminaMaxValue = this.createNode('GlobalStaminaMax', this.staminaNode);
        staminaMaxValue.getComponent(UITransform)!.setContentSize(new Size(staminaMaxWidth, staminaLineHeight));
        staminaMaxValue.setPosition(staminaTextLeft + staminaValueWidth + staminaSlashWidth + staminaMaxWidth / 2, staminaTextY, 0);
        this.staminaMaxShadowLabel = this.addShadowLabel(staminaMaxValue, 'GlobalStaminaMaxShadow', staminaFontSize, HUD_NUMBER_SHADOW, this.scaleHud(1), -this.scaleHud(1));
        const staminaMaxLabel = this.addShadowLabel(staminaMaxValue, 'GlobalStaminaMaxText', staminaFontSize, HUD_STAMINA_MAX_TEXT, 0, 0);
        this.staminaMaxShadowLabel.lineHeight = staminaLineHeight;
        staminaMaxLabel.lineHeight = staminaLineHeight;
        this.staminaMaxShadowLabel.overflow = Label.Overflow.SHRINK;
        staminaMaxLabel.overflow = Label.Overflow.SHRINK;
        this.staminaMaxShadowLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        staminaMaxLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.staminaMaxLabel = staminaMaxLabel;

        this.staminaCountdownNode = this.createNode('GlobalStaminaCountdown', this.staminaNode);
        this.staminaCountdownNode.setPosition(0, this.scaleHud(-34), 0);
        this.staminaCountdownNode.getComponent(UITransform)!.setContentSize(new Size(staminaPillWidth, this.scaleHud(30)));

        const countdownBg = this.createNode('CountdownBg', this.staminaCountdownNode);
        countdownBg.getComponent(UITransform)!.setContentSize(new Size(this.scaleHud(62), this.scaleHud(24)));
        this.drawCountdownBackground(countdownBg, this.scaleHud(62), this.scaleHud(24));

        const countdownTextNode = this.createNode('CountdownText', this.staminaCountdownNode);
        countdownTextNode.getComponent(UITransform)!.setContentSize(new Size(this.scaleHud(62), this.scaleHud(28)));
        const countdownLabel = countdownTextNode.addComponent(Label);
        countdownLabel.fontSize = this.scaleHud(19);
        countdownLabel.lineHeight = this.scaleHud(28);
        countdownLabel.isBold = true;
        countdownLabel.color = COLOR_STAMINA_COUNTDOWN;
        countdownLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        countdownLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this.staminaCountdownLabel = countdownLabel;

        this.layoutHud();
    }

    private createNode(name: string, parent: Node = this.node): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform);
        parent.addChild(node);
        return node;
    }

    private scaleHud(value: number): number {
        const layout = getAdaptiveLayout({ maxContentWidth: this.designMaxWidth });
        return Math.round(value * this.hudVisualScale * layout.scale);
    }

    private layoutHud(): void {
        const { left, top, topRowY } = this.getLayoutAnchors();
        const hudTop = topRowY;
        const settingX = left + this.scaleHud(28);
        const coinX = left + this.scaleHud(HUD_COIN_PILL_WIDTH) / 2;
        const coinY = hudTop - this.scaleHud(58);
        const staminaX = left + this.scaleHud(HUD_STAMINA_LEFT_OFFSET) + this.scaleHud(HUD_STAMINA_PILL_WIDTH) / 2;
        const staminaY = hudTop - this.scaleHud(116);

        this.settingButton && (this.settingButton.active = false);
        this.homeButton && (this.homeButton.active = false);
        this.coinNode && (this.coinNode.active = false);
        this.staminaNode && (this.staminaNode.active = false);
        this.staminaCountdownNode && (this.staminaCountdownNode.active = false);
        this.staminaNode?.setScale(v3(1, 1, 1));

        if (this.mode === GlobalHudMode.Home) {
            this.settingButton?.setPosition(settingX, hudTop, 0);
            this.coinNode?.setPosition(coinX, coinY, 0);
            this.staminaNode?.setPosition(staminaX, staminaY, 0);
            this.settingButton && (this.settingButton.active = true);
            this.coinNode && (this.coinNode.active = true);
            this.staminaNode && (this.staminaNode.active = true);
            this.staminaCountdownNode && (this.staminaCountdownNode.active = true);
            return;
        }

        if (this.mode === GlobalHudMode.LevelFail) {
            this.homeButton?.setPosition(left + this.scaleHud(32), hudTop, 0);
            this.staminaNode?.setPosition(staminaX, staminaY, 0);
            this.homeButton && (this.homeButton.active = true);
            this.staminaNode && (this.staminaNode.active = true);
            this.staminaCountdownNode && (this.staminaCountdownNode.active = true);
            return;
        }

        if (this.mode === GlobalHudMode.ChallengeSettlement) {
            this.staminaNode?.setPosition(staminaX, staminaY, 0);
            this.staminaNode && (this.staminaNode.active = true);
            this.staminaCountdownNode && (this.staminaCountdownNode.active = true);
            this.staminaNode?.setScale(v3(0.92, 0.92, 1));
            return;
        }

        if (this.mode === GlobalHudMode.Gameplay || this.mode === GlobalHudMode.SurvivalGameplay || this.mode === GlobalHudMode.LevelWin) {
            this.settingButton?.setPosition(settingX, hudTop, 0);
            this.coinNode?.setPosition(coinX, coinY, 0);
            this.settingButton && (this.settingButton.active = true);
            this.coinNode && (this.coinNode.active = this.mode !== GlobalHudMode.SurvivalGameplay);
        }
    }

    private getLayoutAnchors(): { left: number; top: number; topRowY: number } {
        const layout = getAdaptiveLayout({
            maxContentWidth: this.designMaxWidth,
            topRowDrop: this.hudFixedDrop,
        });
        const left = layout.contentLeft + this.scaleHud(this.hudLeftMargin);
        const top = layout.topY - this.scaleHud(this.hudTopMargin);
        const topRowY = layout.menuButtonRect?.centerY ?? top - this.scaleHud(this.hudFixedDrop);
        return { left, top, topRowY };
    }

    private drawPillSurface(node: Node, width: number, height: number): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();
        const x = -width / 2;
        const y = -height / 2;
        const radius = height / 2;
        g.fillColor = HUD_SURFACE_SHADOW;
        g.roundRect(x + 4, y - 5, width, height, radius);
        g.fill();
        g.fillColor = new Color(HUD_SURFACE_EDGE.r, HUD_SURFACE_EDGE.g, HUD_SURFACE_EDGE.b, 72);
        g.roundRect(x - 3, y - 3, width + 6, height + 6, radius + 3);
        g.fill();
        g.fillColor = HUD_SURFACE_EDGE;
        g.roundRect(x - 1, y - 1, width + 2, height + 2, radius + 1);
        g.fill();
        g.fillColor = HUD_SURFACE;
        g.roundRect(x, y, width, height, radius);
        g.fill();
        g.fillColor = HUD_SURFACE_HIGHLIGHT;
        g.roundRect(x + 8, y + height * 0.47, width - 16, height * 0.34, height * 0.17);
        g.fill();
        g.fillColor = HUD_SURFACE_BOTTOM_EDGE;
        g.roundRect(x + 10, y + 2, width - 20, 5, 3);
        g.fill();
        g.strokeColor = HUD_SURFACE_INNER_EDGE;
        g.lineWidth = 2;
        g.roundRect(x + 1, y + 1, width - 2, height - 2, Math.max(0, radius - 1));
        g.stroke();
        g.strokeColor = HUD_SURFACE_EDGE;
        g.lineWidth = 1.5;
        g.roundRect(x, y, width, height, radius);
        g.stroke();
    }

    private addImagePillSurface(node: Node, width: number, height: number, path = HUD_IMAGE_PILL_PATH): void {
        const surfaceNode = this.createNode('GlobalHudImagePillSurface', node);
        surfaceNode.getComponent(UITransform)!.setContentSize(new Size(width, height));
        surfaceNode.setSiblingIndex(0);
        const sprite = surfaceNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        AssetService.loadSpriteFrame(path, frame => {
            if (!frame || !surfaceNode.isValid) {
                this.drawPillSurface(node, width, height);
                return;
            }
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            surfaceNode.getComponent(UITransform)?.setContentSize(new Size(width, height));
        }, 'smooth');
    }

    private drawCountdownBackground(node: Node, width: number, height: number): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        const x = -width / 2;
        const y = -height / 2;
        const radius = height / 2;
        g.clear();
        g.fillColor = HUD_COUNTDOWN_SHADOW;
        g.roundRect(x + 2, y - 2, width, height, radius);
        g.fill();
        g.fillColor = HUD_COUNTDOWN_BG;
        g.roundRect(x, y, width, height, radius);
        g.fill();
    }

    private drawRoundIconSurface(node: Node, color: Color): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();
        g.fillColor = new Color(0, 0, 0, 36);
        g.circle(3, -3, 31);
        g.fill();
        g.fillColor = color;
        g.circle(0, 0, 31);
        g.fill();
    }

    private addShadowLabel(parent: Node, name: string, fontSize: number, color: Color, x: number, y: number): Label {
        const node = this.createNode(name, parent);
        node.getComponent(UITransform)!.setContentSize(parent.getComponent(UITransform)!.contentSize);
        node.setPosition(x, y, 0);
        const label = node.addComponent(Label);
        label.fontSize = fontSize;
        label.lineHeight = Math.round(fontSize * 1.18);
        label.isBold = true;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return label;
    }

    private drawHomeIcon(parent: Node): void {
        const icon = this.createNode('GlobalHomeIcon', parent);
        const g = icon.addComponent(Graphics);
        g.fillColor = new Color(255, 255, 255, 245);
        g.moveTo(-22, -4);
        g.lineTo(0, 18);
        g.lineTo(22, -4);
        g.lineTo(16, -4);
        g.lineTo(16, -24);
        g.lineTo(-16, -24);
        g.lineTo(-16, -4);
        g.close();
        g.fill();
    }

    private refreshStaminaCountdown(stamina: number, maxStamina: number): void {
        if (!this.staminaCountdownNode || !this.staminaCountdownLabel) return;
        this.staminaCountdownNode.active = true;
        if (stamina >= maxStamina) {
            this.staminaCountdownLabel.string = '已满';
            this.staminaCountdownLabel.color = new Color(62, 137, 105, 255);
            return;
        }
        const seconds = this.getStaminaCountdownSeconds();
        this.staminaCountdownLabel.string = `${seconds}s`;
        this.staminaCountdownLabel.color = COLOR_STAMINA_COUNTDOWN;
    }

    private getStaminaCountdownSeconds(): number {
        const countdown = GameApp.tiliManager?.getCountdownText?.();
        if (countdown) {
            const parts = countdown.split(':').map(part => Number(part));
            if (parts.length === 2 && parts.every(part => Number.isFinite(part))) {
                return Math.max(0, Math.floor(parts[0] * 60 + parts[1]));
            }
            const numeric = Number(countdown.replace(/[^\d]/g, ''));
            if (Number.isFinite(numeric) && numeric > 0) {
                return Math.floor(numeric);
            }
        }
        return this.getFallbackStaminaCountdownSeconds();
    }

    private getFallbackStaminaCountdownSeconds(): number {
        const user = GameApp.user;
        if (!user) return 0;
        const recoveryTime = 60;
        const last = user.lastRecoveryTimestamp > 0 ? user.lastRecoveryTimestamp : user.serverTime;
        const elapsed = Math.max(0, user.serverTime - last);
        const remaining = recoveryTime - (elapsed % recoveryTime);
        const seconds = Math.max(1, Math.min(recoveryTime, remaining));
        return seconds;
    }

    private loadSettingIcon(sprite: Sprite): void {
        const applyFrame = (frame: SpriteFrame | null) => {
            if (!frame || !sprite.node.isValid) return;
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            sprite.node.getComponent(UITransform)?.setContentSize(new Size(this.scaleHud(HUD_SETTING_ICON_WIDTH), this.scaleHud(HUD_SETTING_ICON_HEIGHT)));
        };

        AssetService.loadSpriteFrame('images/hud_setting', spriteFrame => {
            if (spriteFrame) {
                applyFrame(spriteFrame);
            } else {
                console.warn('[GlobalHud] Setting icon load failed');
                this.drawFallbackSetting(sprite.node);
            }
        }, 'smooth');
    }

    private loadCoinIcon(sprite: Sprite): void {
        const applyFrame = (frame: SpriteFrame | null) => {
            if (!frame || !sprite.node.isValid) {
                this.drawFallbackCoin(sprite.node);
                return;
            }
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
        };

        AssetService.loadSpriteFrame('images/hud_coin', spriteFrame => applyFrame(spriteFrame), 'smooth');
    }

    private loadHudIcon(sprite: Sprite, path: string, onMissing: () => void): void {
        AssetService.loadSpriteFrame(path, frame => {
            if (!frame || !sprite.node.isValid) {
                onMissing();
                return;
            }
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
        }, 'smooth');
    }

    private drawFallbackCoin(node: Node): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        const size = node.getComponent(UITransform)?.contentSize;
        const minSide = Math.min(size?.width ?? 42, size?.height ?? 42);
        const radius = minSide * 0.36;
        g.clear();
        g.fillColor = COLOR_GOLD;
        g.circle(0, 0, radius);
        g.fill();
        g.strokeColor = new Color(255, 242, 150, 230);
        g.lineWidth = Math.max(2, minSide * 0.07);
        g.circle(0, 0, radius * 0.73);
        g.stroke();
    }

    private drawFallbackEnergy(node: Node): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        const size = node.getComponent(UITransform)?.contentSize;
        const s = Math.min(size?.width ?? 54, size?.height ?? 54) / 54;
        g.clear();
        g.fillColor = new Color(28, 145, 225, 255);
        g.moveTo(-8 * s, 24 * s);
        g.lineTo(17 * s, 24 * s);
        g.lineTo(3 * s, 2 * s);
        g.lineTo(20 * s, 2 * s);
        g.lineTo(-7 * s, -28 * s);
        g.lineTo(-1 * s, -6 * s);
        g.lineTo(-19 * s, -6 * s);
        g.close();
        g.fill();
    }

    private drawFallbackPlus(node: Node): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        const size = node.getComponent(UITransform)?.contentSize;
        const minSide = Math.min(size?.width ?? 32, size?.height ?? 32);
        const radius = minSide * 0.47;
        const arm = radius * 0.5;
        g.clear();
        g.fillColor = new Color(89, 198, 46, 255);
        g.circle(0, 0, radius);
        g.fill();
        g.strokeColor = new Color(255, 255, 255, 240);
        g.lineWidth = Math.max(4, radius * 0.32);
        g.lineCap = Graphics.LineCap.ROUND;
        g.moveTo(-arm, 0);
        g.lineTo(arm, 0);
        g.moveTo(0, -arm);
        g.lineTo(0, arm);
        g.stroke();
    }

    private drawFallbackSetting(node: Node): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();
        g.fillColor = HUD_SURFACE_SHADOW;
        g.circle(3, -4, 23);
        g.fill();
        g.fillColor = new Color(HUD_SURFACE_EDGE.r, HUD_SURFACE_EDGE.g, HUD_SURFACE_EDGE.b, 92);
        g.circle(0, 0, 24);
        g.fill();
        g.fillColor = HUD_SURFACE_EDGE;
        g.circle(0, 0, 22);
        g.fill();
        g.fillColor = HUD_SURFACE;
        g.circle(0, 0, 21);
        g.fill();
        g.fillColor = HUD_SURFACE_HIGHLIGHT;
        g.circle(-5, 7, 10);
        g.fill();
        g.strokeColor = HUD_SURFACE_INNER_EDGE;
        g.lineWidth = 2;
        g.circle(0, 0, 20);
        g.stroke();
        g.strokeColor = new Color(72, 120, 180, 255);
        g.lineWidth = 5;
        g.circle(0, 0, 11);
        g.stroke();
        for (let i = 0; i < 8; i++) {
            const angle = Math.PI * 2 * i / 8;
            const x1 = Math.cos(angle) * 17;
            const y1 = Math.sin(angle) * 17;
            const x2 = Math.cos(angle) * 25;
            const y2 = Math.sin(angle) * 25;
            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
        }
        g.stroke();
    }

    private onSettingTouchStart(): void {
        SfxManager.instance.forceUnlock();
    }

    private onSettingClick(): void {
        GameApp.uiManager?.open(UIID.SettingPanel);
    }

    private onHomeClick(): void {
        SfxManager.instance.playUiClick();
        GameApp.isStartGame = false;
        const dg = GameApp.drawGrid as { setGameUIVisible?: (visible: boolean) => void } | null;
        dg?.setGameUIVisible?.(false);
        GameApp.uiManager?.closeSettlementPanels(() => {
            GameApp.uiManager?.open(UIID.MainPanel);
        });
    }

    private onStaminaAddClick(): void {
        GameApp.uiManager?.open(UIID.PowerPanel);
    }
}
