import { _decorator, Component, Node, Label, LabelOutline, UITransform, UIOpacity, Graphics, Color, Size, tween, Tween, v3, Sprite, SpriteFrame, view } from 'cc';
import { GameApp } from './Core/GameApp';
import { GameMode, UIID } from './Core/Enum';
import { BlockInputEvents } from 'cc';
import SfxManager from './Core/SfxManager';
import AssetService from './Core/AssetService';
import RewardService from './Core/RewardService';
import { formatCountdownTime } from './Utils/TimeFormat';
import PerfDebug from './Utils/PerfDebug';
import { GlobalHudMode } from './GlobalHud';
import { openRankPanel, RANK_LEVEL, RANK_SURVIVAL } from './RankPanel';
import { getAdaptiveLayout, scaleLayout, type AdaptiveLayout } from './Utils/LayoutService';
import {
    createNode, createLabel, createCircle, getScreenSize, addButtonFeedback,
    COLOR_WHITE,
    COLOR_AD_BLUE,
} from './Utils/UIBuilder';

const { ccclass } = _decorator;

@ccclass('MainPanel')
export default class MainPanel extends Component {
    private static menuIdleFramesCache: SpriteFrame[] | null = null;
    private static menuIdleLoading: boolean = false;
    private static menuIdleCallbacks: Array<(frames: SpriteFrame[]) => void> = [];
    private classicBtn!: Node;
    private survivalBar!: Node;
    private dailyChallengeCard!: Node;
    private rankShortcut!: Node;
    private rankMenuDismissLayer!: Node;
    private rankMenu!: Node;
    private rankLevelEntry!: Node;
    private rankSurvivalEntry!: Node;
    private menuIdleSprite: Sprite | null = null;
    private menuIdleFrames: SpriteFrame[] = [];
    private menuIdleFrameIndex: number = 0;
    private readonly menuIdleFrameInterval: number = 0.16;
    private readonly menuIdleLoadDelay: number = 0.25;
    private readonly homeForegroundLiftY: number = 60;
    private menuIdleSequenceRequested: boolean = false;
    onLoad(): void {
        PerfDebug.begin('MainPanel.onLoad');
        AssetService.preloadBundle('remote', 'home onLoad');
        this.buildUI();
        PerfDebug.end('MainPanel.onLoad');
    }

    private buildUI(): void {
        PerfDebug.begin('MainPanel.buildUI');
        const screenSize = getScreenSize();
        const ut = this.node.getComponent(UITransform)!;
        ut.setContentSize(screenSize);
        const layout = getAdaptiveLayout();
        const foregroundLiftY = scaleLayout(this.homeForegroundLiftY, layout);

        this.buildBackground(screenSize.width, screenSize.height);
        this.buildTitle(layout, foregroundLiftY);
        this.buildCharacterArea(layout, foregroundLiftY);
        this.buildRankShortcut(layout, foregroundLiftY);
        this.buildBottomSection(layout, foregroundLiftY);
        PerfDebug.end('MainPanel.buildUI', { width: screenSize.width, height: screenSize.height });
    }

    private buildBackground(w: number, h: number): void {
        PerfDebug.begin('MainPanel.background');
        const contentW = Math.min(w, 750);
        const fallbackNode = createNode('bgGradientFallback', this.node);
        const g = fallbackNode.addComponent(Graphics);

        const topColor = new Color(220, 228, 242, 255);
        const bottomColor = new Color(200, 210, 230, 255);
        const bands = 20;
        const bandH = h / bands;

        for (let i = 0; i < bands; i++) {
            const t = i / (bands - 1);
            const r = Math.round(topColor.r + (bottomColor.r - topColor.r) * t);
            const green = Math.round(topColor.g + (bottomColor.g - topColor.g) * t);
            const b = Math.round(topColor.b + (bottomColor.b - topColor.b) * t);
            g.fillColor = new Color(r, green, b, 255);
            g.rect(-contentW / 2, h / 2 - (i + 1) * bandH, contentW, bandH + 1);
            g.fill();
        }

        const bgNode = createNode('mainMenuBackground', this.node);
        const imageAspect = 941 / 1672;
        const viewAspect = contentW / h;
        const bgW = viewAspect > imageAspect ? contentW : Math.ceil(h * imageAspect);
        const bgH = viewAspect > imageAspect ? Math.ceil(contentW / imageAspect) : h;
        bgNode.getComponent(UITransform)!.setContentSize(new Size(bgW, bgH));
        const bgSprite = bgNode.addComponent(Sprite);
        bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        bgSprite.trim = false;
        AssetService.loadSpriteFrame('images/menu_main_bg', spriteFrame => {
            if (!spriteFrame || !bgNode.isValid) {
                PerfDebug.end('MainPanel.background', { ok: false });
                console.warn('[MainPanel] Background image load failed');
                return;
            }
            fallbackNode.active = false;
            bgSprite.spriteFrame = spriteFrame;
            PerfDebug.end('MainPanel.background', { ok: true });
        }, 'smooth');
    }

    private buildDecorations(w: number, h: number): void {
        const contentW = Math.min(w, 750);
        const halfW = contentW / 2;
        const decoLayer = createNode('decoLayer', this.node);

        const spots = [
            { x: -160, y: 520, r: 30, a: 10 },
            { x: 200, y: 440, r: 18, a: 12 },
            { x: -100, y: 180, r: 40, a: 8 },
            { x: 240, y: -80, r: 22, a: 10 },
            { x: -200, y: -320, r: 35, a: 8 },
            { x: 170, y: -480, r: 25, a: 10 },
            { x: 60, y: 320, r: 15, a: 12 },
        ];

        for (let i = 0; i < spots.length; i++) {
            const s = spots[i];
            const clampedX = Math.max(-halfW + s.r, Math.min(halfW - s.r, s.x));
            const circle = createCircle('spot' + i, decoLayer, s.r, new Color(180, 195, 220, 255), s.a);
            circle.setPosition(clampedX, s.y, 0);
        }

        const glow = createCircle('glow', decoLayer, 80, new Color(100, 140, 200, 255), 8);
        glow.setPosition(0, 200, 0);
    }

    private buildTitle(layout: AdaptiveLayout, foregroundLiftY: number): void {
        const titleNode = createNode('titleArea', this.node);
        titleNode.setPosition(0, layout.topY - scaleLayout(176, layout) + foregroundLiftY, 0);

        this.createMenuImage('titleImage', titleNode, 'images/menu_title_logo',
            scaleLayout(332, layout), scaleLayout(264, layout), v3(0, scaleLayout(8, layout), 0));

        const subLine = createNode('subLine', titleNode);
        subLine.setPosition(0, -scaleLayout(127, layout), 0);
        const lg = subLine.addComponent(Graphics);
        lg.strokeColor = new Color(86, 134, 210, 115);
        lg.lineWidth = Math.max(1, scaleLayout(2, layout));
        lg.moveTo(-scaleLayout(150, layout), 0);
        lg.lineTo(-scaleLayout(40, layout), 0);
        lg.stroke();
        lg.moveTo(scaleLayout(40, layout), 0);
        lg.lineTo(scaleLayout(150, layout), 0);
        lg.stroke();

        const diamond = createNode('diamond', subLine);
        const dg = diamond.addComponent(Graphics);
        dg.fillColor = new Color(74, 125, 218, 210);
        const diamondSize = scaleLayout(6, layout);
        dg.moveTo(0, diamondSize);
        dg.lineTo(diamondSize, 0);
        dg.lineTo(0, -diamondSize);
        dg.lineTo(-diamondSize, 0);
        dg.close();
        dg.fill();

        const subtitle = createLabel('subtitle', titleNode, '找出占座目标，守住好座位',
            scaleLayout(27, layout), new Color(38, 92, 132, 245), true);
        subtitle.node.getComponent(UITransform)!.setContentSize(scaleLayout(380, layout), scaleLayout(44, layout));
        subtitle.node.setPosition(0, -scaleLayout(161, layout), 0);
    }

    private createMainLogoLayer(
        parent: Node,
        name: string,
        text: string,
        fontSize: number,
        color: Color,
        y: number,
        outlineColor?: Color,
        outlineWidth: number = 0,
    ): Label {
        const label = createLabel(name, parent, text, fontSize, color, true);
        label.lineHeight = Math.round(fontSize * 1.12);
        label.node.getComponent(UITransform)!.setContentSize(new Size(650, 116));
        label.node.setPosition(0, y, 0);
        label.node.addComponent(UIOpacity);
        if (outlineColor && outlineWidth > 0) {
            const outline = label.node.addComponent(LabelOutline);
            outline.color = outlineColor;
            outline.width = outlineWidth;
        }
        return label;
    }

    private buildCharacterArea(layout: AdaptiveLayout, foregroundLiftY: number): void {
        const titleY = layout.topY - scaleLayout(176, layout);
        const bottomSectionY = layout.bottomY + scaleLayout(277, layout);
        const characterY = Math.round((titleY + bottomSectionY) / 2 - scaleLayout(42, layout));
        const charArea = createNode('characterArea', this.node);
        charArea.setPosition(0, characterY + foregroundLiftY, 0);

        // Glow backing
        const glowNode = createNode('charGlow', charArea);
        const gg = glowNode.addComponent(Graphics);
        gg.fillColor = new Color(COLOR_AD_BLUE.r, COLOR_AD_BLUE.g, COLOR_AD_BLUE.b, 15);
        gg.circle(0, -scaleLayout(12, layout), scaleLayout(150, layout));
        gg.fill();

        // 主菜单形象序列帧
        const characterNode = createNode('menuIdleCharacter', charArea);
        characterNode.setPosition(0, scaleLayout(16, layout), 0);
        characterNode.getComponent(UITransform)!.setContentSize(new Size(scaleLayout(420, layout), scaleLayout(439, layout)));
        const sprite = characterNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        this.menuIdleSprite = sprite;
        this.loadMenuIdleFrames();
    }

    private loadMenuIdleFrames(): void {
        if (MainPanel.menuIdleFramesCache && MainPanel.menuIdleFramesCache.length > 0) {
            this.applyMenuIdleFrames(MainPanel.menuIdleFramesCache);
            return;
        }

        const path = 'characters/menu_idle';
        this.loadMenuIdleFirstFrame(path);
        if (!this.menuIdleSequenceRequested) {
            this.menuIdleSequenceRequested = true;
            this.scheduleOnce(() => this.loadMenuIdleSequence(path), this.menuIdleLoadDelay);
        }
    }

    private loadMenuIdleSequence(path: string): void {
        if (!this.node || !this.node.isValid) return;
        if (MainPanel.menuIdleFramesCache && MainPanel.menuIdleFramesCache.length > 0) {
            PerfDebug.mark('MainPanel.menuIdle sequence cache apply', { count: MainPanel.menuIdleFramesCache.length });
            this.applyMenuIdleFrames(MainPanel.menuIdleFramesCache);
            return;
        }

        MainPanel.menuIdleCallbacks.push(frames => {
            if (!this.node || !this.node.isValid) return;
            this.applyMenuIdleFrames(frames);
        });

        if (MainPanel.menuIdleLoading) {
            return;
        }

        MainPanel.menuIdleLoading = true;
        PerfDebug.begin('MainPanel.menuIdle sequence', { path });
        AssetService.loadSpriteFrameDir(path, frames => {
            if (frames.length === 0) {
                console.warn('[MainPanel] Menu idle frames not loaded: ' + path);
            }
            PerfDebug.end('MainPanel.menuIdle sequence', { count: frames.length });
            this.finishMenuIdleLoad(frames);
        }, 'smooth');
    }

    private loadMenuIdleFirstFrame(path: string): void {
        PerfDebug.begin('MainPanel.menuIdle first frame', { path });
        AssetService.loadSpriteFrame('characters/menu_idle_static', frame => {
            PerfDebug.end('MainPanel.menuIdle first frame', { ok: !!frame });
            if (!frame || !this.node || !this.node.isValid || !this.menuIdleSprite || this.menuIdleFrames.length > 0) return;
            this.menuIdleSprite.spriteFrame = frame;
        }, 'smooth');
    }

    private finishMenuIdleLoad(frames: SpriteFrame[]): void {
        const sortedFrames = AssetService.sortSpriteFrames(frames);
        MainPanel.menuIdleFramesCache = sortedFrames;
        MainPanel.menuIdleLoading = false;
        const callbacks = MainPanel.menuIdleCallbacks;
        MainPanel.menuIdleCallbacks = [];
        callbacks.forEach(callback => callback(sortedFrames));
    }

    private applyMenuIdleFrames(frames: SpriteFrame[]): void {
        if (!this.node || !this.node.isValid || !this.menuIdleSprite) return;
        this.menuIdleFrames = frames;
        this.menuIdleFrameIndex = 0;
        if (this.menuIdleFrames.length > 0) {
            this.menuIdleSprite.spriteFrame = this.menuIdleFrames[0];
        }
        this.startMenuIdleLoop();
    }

    private startMenuIdleLoop(): void {
        if (!this.node || !this.node.isValid) return;
        this.unschedule(this.advanceMenuIdleFrame);
        if (!this.menuIdleSprite || this.menuIdleFrames.length <= 1 || !this.node.activeInHierarchy) return;
        this.schedule(this.advanceMenuIdleFrame, this.menuIdleFrameInterval);
    }

    private advanceMenuIdleFrame(): void {
        if (!this.menuIdleSprite || this.menuIdleFrames.length === 0) return;
        this.menuIdleFrameIndex = (this.menuIdleFrameIndex + 1) % this.menuIdleFrames.length;
        this.menuIdleSprite.spriteFrame = this.menuIdleFrames[this.menuIdleFrameIndex];
    }

    private buildBottomSection(layout: AdaptiveLayout, foregroundLiftY: number): void {
        const bottomSection = createNode('bottomSection', this.node);
        bottomSection.setPosition(0, layout.bottomY + scaleLayout(252, layout) + foregroundLiftY, 0);
        const contentW = layout.contentWidth;
        const primaryW = Math.min(scaleLayout(454, layout), Math.max(scaleLayout(396, layout), contentW - scaleLayout(220, layout)));
        const primaryH = Math.round(primaryW * 162 / 404);
        const modeW = Math.min(scaleLayout(558, layout), contentW - scaleLayout(84, layout));
        const modeH = scaleLayout(112, layout);
        const modeIconW = scaleLayout(132, layout);
        const modeIconH = scaleLayout(96, layout);
        const modeTitleX = -modeW * 0.21;
        const modeInfoX = modeW * 0.28;
        const modeRowTopY = scaleLayout(10, layout);
        const modeRowGap = scaleLayout(124, layout);

        // classicBtn: main level entry
        const levelNum = GameApp.user.level;
        const classicNode = createNode('classicBtn', bottomSection);
        classicNode.setPosition(0, scaleLayout(172, layout), 0);
        const classicUt = classicNode.getComponent(UITransform)!;
        classicUt.setContentSize(new Size(primaryW, primaryH));
        this.createMenuImage('classicButtonImage', classicNode, 'images/menu_level_button', primaryW, primaryH, v3(0, 0, 0));
        const classicShadow = createLabel('classicLabelShadow', classicNode, '第 ' + levelNum + ' 关',
            scaleLayout(58, layout), new Color(176, 72, 10, 165), true);
        classicShadow.node.getComponent(UITransform)!.setContentSize(new Size(primaryW - scaleLayout(36, layout), primaryH));
        classicShadow.node.setPosition(0, scaleLayout(3, layout), 0);
        const classicLabel = createLabel('classicLabel', classicNode, '第 ' + levelNum + ' 关',
            scaleLayout(58, layout), COLOR_WHITE, true);
        classicLabel.lineHeight = scaleLayout(66, layout);
        const classicOutline = classicLabel.node.addComponent(LabelOutline);
        classicOutline.color = new Color(232, 104, 18, 255);
        classicOutline.width = scaleLayout(4, layout);
        classicLabel.node.getComponent(UITransform)!.setContentSize(new Size(primaryW - scaleLayout(36, layout), primaryH));
        classicLabel.node.setPosition(0, scaleLayout(8, layout), 0);
        this.classicBtn = classicNode;

        // survivalBar: survival mode entry
        const survivalNode = createNode('survivalBar', bottomSection);
        survivalNode.setPosition(0, modeRowTopY - modeRowGap, 0);
        const survivalUt = survivalNode.getComponent(UITransform)!;
        survivalUt.setContentSize(new Size(modeW, modeH));
        this.createHomeModeCardSurface('survivalCardSurface', survivalNode, modeW, modeH, new Color(16, 135, 158, 246), new Color(10, 78, 104, 240));
        const survivalImage = this.createMenuImage('survivalButtonImage', survivalNode, 'images/menu_survival_button', modeIconW, modeIconH, v3(-modeW * 0.36, 0, 0));
        survivalImage.addComponent(UIOpacity).opacity = 196;
        survivalImage.setSiblingIndex(1);
        this.createSparkle('survivalDecorSparkle', survivalNode, scaleLayout(18, layout), -modeW * 0.45, modeH * 0.26);
        const survTitle = createLabel('survTitle', survivalNode, '生存模式', scaleLayout(34, layout), COLOR_WHITE, true);
        survTitle.horizontalAlign = Label.HorizontalAlign.LEFT;
        survTitle.node.getComponent(UITransform)!.setContentSize(new Size(modeW * 0.44, scaleLayout(46, layout)));
        survTitle.node.setPosition(modeTitleX, scaleLayout(24, layout), 0);
        const survTitleOutline = survTitle.node.addComponent(LabelOutline);
        survTitleOutline.color = new Color(6, 46, 72, 255);
        survTitleOutline.width = scaleLayout(5, layout);
        const survFree = createLabel('survFree', survivalNode, '今日免费', scaleLayout(22, layout), new Color(255, 247, 190, 255), true);
        survFree.horizontalAlign = Label.HorizontalAlign.LEFT;
        survFree.node.getComponent(UITransform)!.setContentSize(new Size(modeW * 0.34, scaleLayout(32, layout)));
        survFree.node.setPosition(modeTitleX, -scaleLayout(18, layout), 0);
        const survFreeCount = createLabel('survFreeCount', survivalNode, '1/2', scaleLayout(22, layout), new Color(255, 246, 190, 255), true);
        survFreeCount.horizontalAlign = Label.HorizontalAlign.LEFT;
        survFreeCount.node.getComponent(UITransform)!.setContentSize(new Size(modeW * 0.2, scaleLayout(32, layout)));
        survFreeCount.node.setPosition(modeInfoX, -scaleLayout(18, layout), 0);

        const adPrompt = createNode('survAdPrompt', survivalNode);
        adPrompt.getComponent(UITransform)!.setContentSize(new Size(modeW * 0.42, scaleLayout(36, layout)));
        adPrompt.setPosition(modeInfoX, -scaleLayout(18, layout), 0);
        const adTextColor = new Color(255, 246, 190, 255);
        const adPrefix = createLabel('survAdPromptPrefix', adPrompt, '看', scaleLayout(21, layout), adTextColor, true);
        adPrefix.node.getComponent(UITransform)!.setContentSize(new Size(scaleLayout(30, layout), scaleLayout(34, layout)));
        adPrefix.node.setPosition(-scaleLayout(62, layout), 0, 0);
        const adIcon = createNode('survAdIcon', adPrompt);
        const adIconW = scaleLayout(36, layout);
        const adIconH = scaleLayout(26, layout);
        adIcon.getComponent(UITransform)!.setContentSize(new Size(adIconW, adIconH));
        adIcon.setPosition(-scaleLayout(31, layout), 0, 0);
        this.drawSurvivalAdIcon(adIcon, adIconW, adIconH);
        const adSuffix = createLabel('survAdPromptSuffix', adPrompt, '增加次数', scaleLayout(21, layout), adTextColor, true);
        adSuffix.node.getComponent(UITransform)!.setContentSize(new Size(scaleLayout(100, layout), scaleLayout(34, layout)));
        adSuffix.node.setPosition(scaleLayout(38, layout), 0, 0);
        this.survivalBar = survivalNode;
        this.refreshSurvivalFreeText();

        // dailyChallengeCard: secondary daily challenge entry
        const dailyNode = createNode('dailyChallengeCard', bottomSection);
        dailyNode.setPosition(0, modeRowTopY, 0);
        const dailyUt = dailyNode.getComponent(UITransform)!;
        dailyUt.setContentSize(new Size(modeW, modeH));
        this.createHomeModeCardSurface('dailyCardSurface', dailyNode, modeW, modeH, new Color(92, 84, 206, 247), new Color(54, 48, 134, 245));
        const dailyImage = this.createMenuImage('dailyButtonImage', dailyNode, 'images/menu_daily_button', modeIconW, modeIconH, v3(-modeW * 0.36, 0, 0));
        dailyImage.addComponent(UIOpacity).opacity = 196;
        dailyImage.setSiblingIndex(1);
        this.createSparkle('dailyDecorSparkle', dailyNode, scaleLayout(18, layout), -modeW * 0.45, modeH * 0.26);
        const dailyTitle = createLabel('dailyTitle', dailyNode, '每日挑战', scaleLayout(34, layout), COLOR_WHITE, true);
        dailyTitle.horizontalAlign = Label.HorizontalAlign.LEFT;
        dailyTitle.node.getComponent(UITransform)!.setContentSize(new Size(modeW * 0.44, scaleLayout(46, layout)));
        dailyTitle.node.setPosition(modeTitleX, scaleLayout(24, layout), 0);
        const dailyTitleOutline = dailyTitle.node.addComponent(LabelOutline);
        dailyTitleOutline.color = new Color(44, 34, 110, 255);
        dailyTitleOutline.width = scaleLayout(5, layout);
        const dailySub = createLabel('dailySub', dailyNode, '全网同一关', scaleLayout(21, layout), new Color(255, 248, 207, 255), true);
        dailySub.horizontalAlign = Label.HorizontalAlign.LEFT;
        dailySub.node.getComponent(UITransform)!.setContentSize(new Size(modeW * 0.34, scaleLayout(30, layout)));
        dailySub.node.setPosition(modeTitleX, -scaleLayout(15, layout), 0);
        const dailyFree = createLabel('dailyFree', dailyNode, '免费 1/1', scaleLayout(20, layout), new Color(255, 248, 207, 255), true);
        dailyFree.horizontalAlign = Label.HorizontalAlign.LEFT;
        dailyFree.node.getComponent(UITransform)!.setContentSize(new Size(modeW * 0.22, scaleLayout(30, layout)));
        dailyFree.node.setPosition(modeInfoX, scaleLayout(19, layout), 0);
        const clockSize = scaleLayout(30, layout);
        const dailyClockX = modeInfoX - scaleLayout(54, layout);
        const dailyClock = createNode('dailyTimerClock', dailyNode);
        dailyClock.getComponent(UITransform)!.setContentSize(new Size(clockSize, clockSize));
        dailyClock.setPosition(dailyClockX, -scaleLayout(19, layout), 0);
        this.drawDailyClockIcon(dailyClock, clockSize);
        const dailyTimerW = scaleLayout(118, layout);
        const clockTextGap = scaleLayout(2, layout);
        const dailyTimer = createLabel('dailyTimer', dailyNode, '--:--:--', scaleLayout(20, layout), COLOR_WHITE, true);
        dailyTimer.horizontalAlign = Label.HorizontalAlign.LEFT;
        dailyTimer.overflow = Label.Overflow.SHRINK;
        dailyTimer.node.getComponent(UITransform)!.setContentSize(new Size(dailyTimerW, scaleLayout(30, layout)));
        dailyTimer.node.setPosition(dailyClockX + clockSize / 2 + clockTextGap + dailyTimerW / 2, -scaleLayout(19, layout), 0);
        const dailyTimerOutline = dailyTimer.node.addComponent(LabelOutline);
        dailyTimerOutline.color = new Color(44, 34, 110, 255);
        dailyTimerOutline.width = scaleLayout(2, layout);
        this.dailyChallengeCard = dailyNode;
    }

    private createHomeModeCardSurface(name: string, parent: Node, width: number, height: number, fill: Color, edge: Color): Node {
        const surface = createNode(name, parent);
        surface.getComponent(UITransform)!.setContentSize(new Size(width, height));
        surface.setSiblingIndex(0);
        const g = surface.addComponent(Graphics);
        const x = -width / 2;
        const y = -height / 2;
        const radius = Math.min(28, height * 0.28);

        g.fillColor = new Color(8, 30, 42, 82);
        g.roundRect(x + 6, y - 9, width - 12, height, radius);
        g.fill();

        g.fillColor = fill;
        g.roundRect(x, y, width, height, radius);
        g.fill();

        g.strokeColor = edge;
        g.lineWidth = 4;
        g.roundRect(x + 2, y + 2, width - 4, height - 4, radius - 2);
        g.stroke();

        g.fillColor = new Color(255, 255, 255, 58);
        g.roundRect(x + 22, y + height - 24, width - 44, 9, 5);
        g.fill();

        g.strokeColor = new Color(255, 255, 255, 42);
        g.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            const yy = y + 30 + i * 18;
            g.moveTo(x + width * 0.38, yy);
            g.lineTo(x + width - 26, yy);
        }
        g.stroke();

        g.fillColor = new Color(255, 248, 204, 34);
        for (let i = 0; i < 5; i++) {
            g.roundRect(x + width * 0.08 + i * 13, y + 18, 8, 8, 2);
            g.fill();
        }
        return surface;
    }

    private buildRankShortcut(layout: AdaptiveLayout, foregroundLiftY: number): void {
        const contentW = layout.contentWidth;
        const baseShortcutH = Math.min(scaleLayout(204, layout), Math.max(scaleLayout(172, layout), contentW * 0.255));
        const shortcutH = Math.round(baseShortcutH * 0.66);
        const rankW = Math.round(shortcutH * 296 / 363);
        const touchW = rankW + scaleLayout(20, layout);
        const touchH = shortcutH + scaleLayout(14, layout);
        const x = layout.contentLeft + touchW / 2 + scaleLayout(22, layout);
        const topY = Math.max(scaleLayout(122, layout), layout.topY - scaleLayout(356, layout)) + foregroundLiftY;

        const shortcut = createNode('rankShortcut', this.node);
        shortcut.setPosition(x, topY, 0);
        shortcut.getComponent(UITransform)!.setContentSize(new Size(touchW, touchH));
        const rankImage = this.createMenuImage('rankEntryImage', shortcut, 'images/menu_rank_entry', rankW, shortcutH);
        this.createSparkle('rankEntrySparkle', rankImage, scaleLayout(13, layout), -rankW * 0.2, shortcutH * 0.22);
        this.createRankShortcutLabel(rankImage, layout, rankW, shortcutH);
        addButtonFeedback(shortcut);
        this.rankShortcut = shortcut;

        this.buildRankSideMenu(layout, x, touchW, topY);
    }

    private createRankShortcutLabel(parent: Node, layout: AdaptiveLayout, width: number, height: number): void {
        const labelBg = createNode('rankLabelBg', parent);
        const bgW = Math.max(scaleLayout(86, layout), width * 0.92);
        const bgH = scaleLayout(34, layout);
        labelBg.getComponent(UITransform)!.setContentSize(new Size(bgW, bgH));
        labelBg.setPosition(0, -height * 0.3, 0);
        const bg = labelBg.addComponent(Graphics);
        bg.fillColor = new Color(28, 67, 78, 225);
        bg.roundRect(-bgW / 2, -bgH / 2, bgW, bgH, bgH / 2);
        bg.fill();
        bg.strokeColor = new Color(255, 248, 205, 230);
        bg.lineWidth = Math.max(2, scaleLayout(2, layout));
        bg.roundRect(-bgW / 2 + 2, -bgH / 2 + 2, bgW - 4, bgH - 4, bgH / 2 - 2);
        bg.stroke();

        const label = createLabel('rankEntryLabel', parent, '排行榜', scaleLayout(23, layout), COLOR_WHITE, true);
        label.node.getComponent(UITransform)!.setContentSize(new Size(bgW, bgH));
        label.node.setPosition(0, -height * 0.3 + scaleLayout(1, layout), 0);
        const outline = label.node.addComponent(LabelOutline);
        outline.color = new Color(12, 46, 60, 255);
        outline.width = Math.max(2, scaleLayout(2, layout));
    }

    private buildRankSideMenu(layout: AdaptiveLayout, shortcutX: number, touchW: number, topY: number): void {
        this.rankMenuDismissLayer = createNode('rankMenuDismissLayer', this.node);
        this.rankMenuDismissLayer.getComponent(UITransform)!.setContentSize(new Size(layout.width, layout.height));
        this.rankMenuDismissLayer.addComponent(BlockInputEvents);
        this.rankMenuDismissLayer.active = false;

        const menuW = scaleLayout(170, layout);
        const entryH = scaleLayout(44, layout);
        const entryGap = scaleLayout(6, layout);
        const menuPadding = scaleLayout(5, layout);
        const menuH = entryH * 2 + entryGap + menuPadding * 2;
        const menu = createNode('rankSideMenu', this.node);
        menu.setPosition(shortcutX + touchW / 2 + menuW / 2 + scaleLayout(10, layout), topY, 0);
        menu.getComponent(UITransform)!.setContentSize(new Size(menuW, menuH));
        menu.addComponent(BlockInputEvents);
        const bg = menu.addComponent(Graphics);
        this.drawRankMenuSurface(bg, menuW, menuH);
        bg.strokeColor = new Color(226, 232, 244, 210);
        bg.lineWidth = Math.max(1, scaleLayout(1, layout));
        bg.moveTo(-menuW / 2 + scaleLayout(16, layout), 0);
        bg.lineTo(menuW / 2 - scaleLayout(16, layout), 0);
        bg.stroke();

        const entryOffset = (entryH + entryGap) / 2;
        this.rankLevelEntry = this.createRankMenuTextEntry('rankLevelEntry', menu, '关卡榜', entryOffset, menuW, entryH);
        this.rankSurvivalEntry = this.createRankMenuTextEntry('rankSurvivalEntry', menu, '生存榜', -entryOffset, menuW, entryH);
        this.rankMenu = menu;
        this.rankMenu.active = false;
    }

    private drawRankMenuSurface(g: Graphics, width: number, height: number): void {
        this.drawRankMenuPath(g, width, height, 4, -7);
        g.fillColor = new Color(112, 144, 190, 64);
        g.fill();

        this.drawRankMenuPath(g, width, height, 0, 0);
        g.fillColor = new Color(255, 255, 255, 242);
        g.fill();
        g.strokeColor = new Color(31, 39, 56, 160);
        g.lineWidth = 3;
        g.stroke();

        this.drawRankMenuPath(g, width - 8, height - 8, 4, 0);
        g.strokeColor = new Color(255, 255, 255, 150);
        g.lineWidth = 1;
        g.stroke();
    }

    private drawRankMenuPath(g: Graphics, width: number, height: number, offsetX: number, offsetY: number): void {
        const left = -width / 2 + offsetX;
        const right = width / 2 + offsetX;
        const top = height / 2 + offsetY;
        const bottom = -height / 2 + offsetY;
        const radius = Math.min(16, height / 2 - 7);
        const tailX = left - 26;
        const tailTop = 26 + offsetY;
        const tailBottom = -26 + offsetY;

        g.moveTo(left + radius, top);
        g.lineTo(right - radius, top);
        g.bezierCurveTo(right - radius * 0.45, top, right, top - radius * 0.45, right, top - radius);
        g.lineTo(right, bottom + radius);
        g.bezierCurveTo(right, bottom + radius * 0.45, right - radius * 0.45, bottom, right - radius, bottom);
        g.lineTo(left + radius, bottom);
        g.bezierCurveTo(left + 8, bottom, left, bottom + 8, left, bottom + radius);
        g.lineTo(left, tailBottom);
        g.lineTo(tailX, offsetY);
        g.lineTo(left, tailTop);
        g.lineTo(left, top - radius);
        g.bezierCurveTo(left, top - 8, left + 8, top, left + radius, top);
        g.close();
    }

    private createRankMenuTextEntry(name: string, parent: Node, text: string, y: number, width: number, height: number): Node {
        const entry = createNode(name, parent);
        entry.setPosition(0, y, 0);
        entry.getComponent(UITransform)!.setContentSize(new Size(width, height));
        const buttonBg = entry.addComponent(Graphics);
        buttonBg.fillColor = new Color(239, 246, 255, 220);
        buttonBg.roundRect(-width / 2 + 10, -height / 2 + 4, width - 20, height - 8, 12);
        buttonBg.fill();
        buttonBg.strokeColor = new Color(180, 211, 248, 170);
        buttonBg.lineWidth = 1.5;
        buttonBg.roundRect(-width / 2 + 10, -height / 2 + 4, width - 20, height - 8, 12);
        buttonBg.stroke();
        const label = createLabel(name + 'Label', entry, text, 24, new Color(48, 96, 178, 255), true);
        label.node.getComponent(UITransform)!.setContentSize(new Size(width - 24, height));
        addButtonFeedback(entry);
        return entry;
    }

    private createMenuImage(name: string, parent: Node, path: string, width: number, height: number, position = v3(0, 0, 0)): Node {
        const node = createNode(name, parent);
        const transform = node.getComponent(UITransform)!;
        transform.setContentSize(new Size(width, height));
        node.setPosition(position);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        AssetService.loadSpriteFrame(path, frame => {
            if (!frame || !node.isValid) {
                console.warn(`[MainPanel] Menu image load failed: ${path}`);
                return;
            }
            sprite.spriteFrame = frame;
            parent.getComponent(Graphics)?.clear();
        }, 'smooth');
        node.setSiblingIndex(0);
        return node;
    }

    private createSparkle(name: string, parent: Node, size: number, x: number, y: number): Node {
        const sparkle = createNode(name, parent);
        sparkle.setPosition(x, y, 0);
        sparkle.getComponent(UITransform)!.setContentSize(new Size(size * 1.6, size * 1.6));
        const g = sparkle.addComponent(Graphics);
        const long = size * 0.58;
        const short = size * 0.18;
        g.fillColor = new Color(255, 250, 174, 245);
        g.moveTo(0, long);
        g.lineTo(short, short);
        g.lineTo(long, 0);
        g.lineTo(short, -short);
        g.lineTo(0, -long);
        g.lineTo(-short, -short);
        g.lineTo(-long, 0);
        g.lineTo(-short, short);
        g.close();
        g.fill();
        g.fillColor = new Color(255, 255, 255, 220);
        g.circle(-size * 0.09, size * 0.12, size * 0.12);
        g.fill();
        const opacity = sparkle.addComponent(UIOpacity);
        opacity.opacity = 0;
        sparkle.setScale(v3(0.5, 0.5, 1));
        return sparkle;
    }

    private drawMenuButtonSurface(
        g: Graphics,
        width: number,
        height: number,
        radius: number,
        topColor: Color,
        middleColor: Color,
        bottomColor: Color,
        borderColor: Color,
        shadowColor: Color,
        strongHighlight: boolean,
        showHighlight: boolean = true,
    ): void {
        const x = -width / 2;
        const y = -height / 2;
        g.clear();

        g.fillColor = shadowColor;
        g.roundRect(x + 4, y - 10, width - 8, height, radius);
        g.fill();

        g.fillColor = bottomColor;
        g.roundRect(x, y, width, height, radius);
        g.fill();

        g.fillColor = middleColor;
        g.roundRect(x + 4, y + 8, width - 8, height - 16, Math.max(12, radius - 5));
        g.fill();

        if (showHighlight) {
            g.fillColor = topColor;
            g.roundRect(x + 10, y + height - (strongHighlight ? 34 : 26), width - 20, strongHighlight ? 26 : 18, Math.max(12, radius - 10));
            g.fill();
        }

        if (borderColor.a > 0) {
            g.strokeColor = new Color(borderColor.r, borderColor.g, borderColor.b, Math.min(255, borderColor.a));
            g.lineWidth = strongHighlight ? 7 : 6;
            g.roundRect(x - 1, y - 1, width + 2, height + 2, radius + 2);
            g.stroke();

            g.strokeColor = borderColor;
            g.lineWidth = strongHighlight ? 3 : 2;
            g.roundRect(x + 4, y + 4, width - 8, height - 8, Math.max(10, radius - 4));
            g.stroke();
        }

        if (showHighlight) {
            g.fillColor = new Color(255, 255, 255, strongHighlight ? 95 : 58);
            g.roundRect(x + 26, y + height - (strongHighlight ? 20 : 18), width - 52, strongHighlight ? 9 : 7, 7);
            g.fill();
        }
    }

    private drawSurvivalMenuIcon(parent: Node, x: number, y: number, size: number): void {
        const node = createNode('survivalDecorIcon', parent);
        node.setPosition(x, y, 0);
        const g = node.addComponent(Graphics);
        const s = size / 64;

        g.fillColor = new Color(168, 255, 222, 58);
        g.roundRect(-34 * s, -30 * s, 68 * s, 48 * s, 14 * s);
        g.fill();

        g.fillColor = new Color(6, 115, 99, 70);
        g.roundRect(-20 * s, -30 * s, 40 * s, 10 * s, 5 * s);
        g.fill();

        g.fillColor = new Color(195, 255, 232, 96);
        g.roundRect(-22 * s, -18 * s, 44 * s, 36 * s, 10 * s);
        g.fill();
        g.roundRect(-36 * s, -9 * s, 18 * s, 22 * s, 9 * s);
        g.fill();
        g.roundRect(18 * s, -9 * s, 18 * s, 22 * s, 9 * s);
        g.fill();

        g.fillColor = new Color(10, 137, 113, 92);
        g.moveTo(0, 9 * s);
        g.lineTo(7 * s, -2 * s);
        g.lineTo(19 * s, -2 * s);
        g.lineTo(9 * s, -10 * s);
        g.lineTo(13 * s, -22 * s);
        g.lineTo(0, -15 * s);
        g.lineTo(-13 * s, -22 * s);
        g.lineTo(-9 * s, -10 * s);
        g.lineTo(-19 * s, -2 * s);
        g.lineTo(-7 * s, -2 * s);
        g.close();
        g.fill();
    }

    private drawDailyMenuIcon(parent: Node, x: number, y: number, size: number): void {
        const node = createNode('dailyDecorIcon', parent);
        node.setPosition(x, y, 0);
        const g = node.addComponent(Graphics);
        const s = size / 64;

        g.fillColor = new Color(230, 217, 255, 72);
        g.roundRect(-28 * s, -30 * s, 56 * s, 60 * s, 10 * s);
        g.fill();

        g.fillColor = new Color(101, 72, 214, 82);
        g.roundRect(-28 * s, 13 * s, 56 * s, 17 * s, 8 * s);
        g.fill();

        g.strokeColor = new Color(242, 235, 255, 95);
        g.lineWidth = 5 * s;
        g.moveTo(-10 * s, 0);
        g.lineTo(-1 * s, -10 * s);
        g.lineTo(16 * s, 8 * s);
        g.stroke();

        g.fillColor = new Color(246, 238, 255, 85);
        g.roundRect(-17 * s, 23 * s, 8 * s, 16 * s, 4 * s);
        g.fill();
        g.roundRect(9 * s, 23 * s, 8 * s, 16 * s, 4 * s);
        g.fill();
    }

    private drawSurvivalAdIcon(node: Node, width: number, height: number): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        const x = -width / 2;
        const y = -height / 2;
        const radius = Math.max(6, height * 0.28);
        g.clear();

        g.fillColor = new Color(128, 42, 24, 72);
        g.roundRect(x + 2, y - 2, width, height, radius);
        g.fill();

        g.fillColor = new Color(255, 238, 168, 255);
        g.roundRect(x, y, width, height, radius);
        g.fill();
        g.fillColor = new Color(255, 106, 62, 255);
        g.roundRect(x + 2, y + 2, width - 4, height - 4, Math.max(4, radius - 2));
        g.fill();

        g.fillColor = new Color(255, 255, 255, 255);
        g.moveTo(-width * 0.14, -height * 0.22);
        g.lineTo(-width * 0.14, height * 0.22);
        g.lineTo(width * 0.22, 0);
        g.close();
        g.fill();
    }

    private drawDailyClockIcon(node: Node, size: number): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        const r = size / 2 - Math.max(2.5, size * 0.09);
        const purple = new Color(122, 82, 205, 255);
        g.clear();
        g.fillColor = new Color(255, 255, 255, 255);
        g.circle(0, 0, r);
        g.fill();
        g.strokeColor = purple;
        g.lineWidth = Math.max(4, size * 0.16);
        g.circle(0, 0, r);
        g.stroke();
        g.strokeColor = purple;
        g.lineWidth = Math.max(3, size * 0.13);
        g.moveTo(0, 0);
        g.lineTo(0, r * 0.52);
        g.moveTo(0, 0);
        g.lineTo(r * 0.48, 0);
        g.stroke();
        g.fillColor = purple;
        g.circle(0, 0, Math.max(1.5, size * 0.08));
        g.fill();
    }

    public refreshCoinHud(): void {
        const globalHud = GameApp.globalHud as { refreshCoin?: (animated?: boolean) => void } | null;
        globalHud?.refreshCoin?.(true);
    }

    public refreshStaminaHud(): void {
        const globalHud = GameApp.globalHud as { refreshStamina?: () => void } | null;
        globalHud?.refreshStamina?.();
    }

    private refreshSurvivalFreeText(): void {
        const survFreeLabel = this.survivalBar?.getChildByName('survFree')?.getComponent(Label);
        const survFreeCountLabel = this.survivalBar?.getChildByName('survFreeCount')?.getComponent(Label);
        const adPrompt = this.survivalBar?.getChildByName('survAdPrompt');
        const hasFreeChance = GameApp.user.freeSurvivalTime > 0;
        if (survFreeLabel) {
            survFreeLabel.string = '今日免费';
            survFreeLabel.node.active = hasFreeChance;
        }
        if (survFreeCountLabel) {
            survFreeCountLabel.string = GameApp.user.freeSurvivalTime + '/2';
            survFreeCountLabel.node.active = hasFreeChance;
        }
        if (adPrompt) {
            adPrompt.active = !hasFreeChance;
        }
    }

    private startMenuDynamicEffects(): void {
        this.stopMenuDynamicEffects();
        this.startIconFloat('rankEntryImage', 4, 0);
        this.startSparklePulse('rankEntrySparkle', 0.1, 2.1);
        this.startSparklePulse('dailyDecorSparkle', 0.45, 2.4);
        this.startSparklePulse('survivalDecorSparkle', 1.05, 2.6);
    }

    private stopMenuDynamicEffects(): void {
        ['rankEntryImage'].forEach(name => {
            const node = this.findChildDeep(this.node, name);
            if (!node) return;
            this.stopNodeTweensDeep(node);
            node.setPosition(0, 0, 0);
            node.setScale(v3(1, 1, 1));
        });
        ['dailyDecorSparkle', 'survivalDecorSparkle'].forEach(name => {
            const node = this.findChildDeep(this.node, name);
            if (node) this.stopNodeTweensDeep(node);
        });
    }

    private startIconFloat(name: string, amplitude: number, delay: number): void {
        const node = this.findChildDeep(this.node, name);
        if (!node?.isValid) return;
        Tween.stopAllByTarget(node);
        node.setPosition(0, 0, 0);
        tween(node)
            .delay(delay)
            .repeatForever(
                tween()
                    .to(1.2, { position: v3(0, amplitude, 0) }, { easing: 'sineInOut' })
                    .to(1.2, { position: v3(0, -amplitude, 0) }, { easing: 'sineInOut' })
            )
            .start();
    }

    private startSparklePulse(name: string, delay: number, gap: number): void {
        const sparkle = this.findChildDeep(this.node, name);
        if (!sparkle?.isValid) return;
        const opacity = sparkle.getComponent(UIOpacity) ?? sparkle.addComponent(UIOpacity);
        Tween.stopAllByTarget(sparkle);
        Tween.stopAllByTarget(opacity);
        sparkle.setScale(v3(0.48, 0.48, 1));
        opacity.opacity = 0;
        tween(sparkle)
            .delay(delay)
            .repeatForever(
                tween()
                    .call(() => sparkle.setScale(v3(0.48, 0.48, 1)))
                    .to(0.18, { scale: v3(1.15, 1.15, 1) }, { easing: 'quadOut' })
                    .to(0.36, { scale: v3(0.66, 0.66, 1) }, { easing: 'sineInOut' })
                    .delay(gap)
            )
            .start();
        tween(opacity)
            .delay(delay)
            .repeatForever(
                tween()
                    .call(() => { opacity.opacity = 0; })
                    .to(0.18, { opacity: 255 }, { easing: 'quadOut' })
                    .to(0.36, { opacity: 0 }, { easing: 'sineInOut' })
                    .delay(gap)
            )
            .start();
    }

    private stopNodeTweensDeep(node: Node): void {
        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) Tween.stopAllByTarget(opacity);
        node.children.forEach(child => this.stopNodeTweensDeep(child));
    }

    private findChildDeep(parent: Node, name: string): Node | null {
        if (parent.name === name) return parent;
        for (const child of parent.children) {
            const found = this.findChildDeep(child, name);
            if (found) return found;
        }
        return null;
    }

    onEnable(): void {
        PerfDebug.mark('MainPanel.onEnable');
        AssetService.logCacheStats('home enable');
        PerfDebug.startFpsProbe('home', 15000);
        const globalHud = GameApp.globalHud as { setMode?: (mode: GlobalHudMode) => void; syncLayout?: () => void } | null;
        globalHud?.setMode?.(GlobalHudMode.Home);
        globalHud?.syncLayout?.();

        AssetService.preloadBundle('remote', 'home immediate');
        SfxManager.instance.playMenuBgm();
        this.scheduleOnce(() => {
            if (GameApp.isStartGame) return;
            SfxManager.instance.resumeCurrentBgm('home-panel-settled');
        }, 0.2);
        this.scheduleOnce(() => {
            if (GameApp.isStartGame) return;
            SfxManager.instance.warmupGameplayAudio();
            const currentDrawGrid = GameApp.drawGrid as { loadBalloonAssets?: () => void } | null;
            currentDrawGrid?.loadBalloonAssets?.();
        }, 0.65);
        this.scheduleOnce(() => {
            if (GameApp.isStartGame) return;
            const currentDrawGrid = GameApp.drawGrid as { loadCowAnimationFrames?: () => void } | null;
            currentDrawGrid?.loadCowAnimationFrames?.();
            AssetService.logCacheStats('home warmup requested');
        }, 2.0);

        // Entry animation
        const targets = [this.classicBtn, this.survivalBar, this.dailyChallengeCard, this.rankShortcut];
        targets.forEach((node, i) => {
            if (!node) return;
            node.setScale(v3(0.85, 0.85, 1));
            const op = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
            op.opacity = 0;
            tween(node)
                .delay(i * 0.08)
                .to(0.25, { scale: v3(1, 1, 1) }, { easing: 'backOut' })
                .start();
            tween(op)
                .delay(i * 0.08)
                .to(0.2, { opacity: 255 })
                .start();
        });

        // Button feedback
        const btns = [this.classicBtn, this.survivalBar, this.dailyChallengeCard].filter(Boolean) as Node[];
        btns.forEach(b => addButtonFeedback(b));

        // Event binding
        btns.forEach(b => b.on(Node.EventType.TOUCH_START, this.onMainButtonTouchStart, this));
        this.classicBtn.on(Node.EventType.TOUCH_END, this.onClassicClick, this);
        this.survivalBar.on(Node.EventType.TOUCH_END, this.onSurvivalClick, this);
        this.dailyChallengeCard.on(Node.EventType.TOUCH_END, this.onDailyChallengeClick, this);
        this.rankShortcut.on(Node.EventType.TOUCH_END, this.onRankClick, this);
        this.rankMenuDismissLayer.on(Node.EventType.TOUCH_END, this.closeRankMenu, this);
        this.rankLevelEntry.on(Node.EventType.TOUCH_END, this.onRankLevelClick, this);
        this.rankSurvivalEntry.on(Node.EventType.TOUCH_END, this.onRankSurvivalClick, this);

        this.refreshStaminaHud();
        this.refreshCoinHud();
        this.refreshSurvivalFreeText();
        this.refreshDailyChallengeCard();
        this.schedule(this.updateDailyChallengeCountdown, 1);
        this.schedule(this.refreshStaminaHud, 60);
        this.startMenuIdleLoop();
        this.scheduleOnce(this.startMenuDynamicEffects, 0.45);

        // Title float animation
        const titleArea = this.node.getChildByName('titleArea');
        if (titleArea) {
            const baseY = titleArea.position.y;
            tween(titleArea)
                .repeatForever(
                    tween()
                        .to(1.5, { position: v3(0, baseY + 8, 0) }, { easing: 'sineInOut' })
                        .to(1.5, { position: v3(0, baseY - 8, 0) }, { easing: 'sineInOut' })
                )
                .start();
        }

        // Character backdrop pulse animation.
        const charArea = this.node.getChildByName('characterArea');
        if (charArea) {

            // Glow pulse animation
            const charGlow = charArea.getChildByName('charGlow');
            if (charGlow) {
                tween(charGlow)
                    .repeatForever(
                        tween()
                            .to(1.25, { scale: v3(1.15, 1.15, 1) }, { easing: 'sineInOut' })
                            .to(1.25, { scale: v3(1, 1, 1) }, { easing: 'sineInOut' })
                    )
                    .start();
            }
        }
    }

    onDisable(): void {
        PerfDebug.mark('MainPanel.onDisable');
        this.closeRankMenu();
        this.classicBtn.off(Node.EventType.TOUCH_END, this.onClassicClick, this);
        this.survivalBar.off(Node.EventType.TOUCH_END, this.onSurvivalClick, this);
        this.dailyChallengeCard.off(Node.EventType.TOUCH_END, this.onDailyChallengeClick, this);
        this.rankShortcut.off(Node.EventType.TOUCH_END, this.onRankClick, this);
        this.rankMenuDismissLayer.off(Node.EventType.TOUCH_END, this.closeRankMenu, this);
        this.rankLevelEntry.off(Node.EventType.TOUCH_END, this.onRankLevelClick, this);
        this.rankSurvivalEntry.off(Node.EventType.TOUCH_END, this.onRankSurvivalClick, this);
        const btns = [this.classicBtn, this.survivalBar, this.dailyChallengeCard].filter(Boolean) as Node[];
        btns.forEach(b => b.off(Node.EventType.TOUCH_START, this.onMainButtonTouchStart, this));
        this.unschedule(this.refreshStaminaHud);
        this.unschedule(this.updateDailyChallengeCountdown);
        this.unschedule(this.advanceMenuIdleFrame);
        this.unschedule(this.startMenuDynamicEffects);
        this.stopMenuDynamicEffects();

        // Stop transient animations
        const titleArea = this.node.getChildByName('titleArea');
        if (titleArea) Tween.stopAllByTarget(titleArea);

        const charArea = this.node.getChildByName('characterArea');
        if (charArea) {
            const charGlow = charArea.getChildByName('charGlow');
            if (charGlow) Tween.stopAllByTarget(charGlow);
        }

    }

    private onMainButtonTouchStart(): void {
        console.log('[MainPanel] button touch start');
        SfxManager.instance.forceUnlock();
        SfxManager.instance.playUiClick();
    }

    private onRankClick(): void {
        SfxManager.instance.forceUnlock();
        SfxManager.instance.playUiClick();
        this.toggleRankMenu();
    }

    private toggleRankMenu(): void {
        if (!this.rankMenu?.isValid || !this.rankMenuDismissLayer?.isValid) return;
        if (this.rankMenu.active) {
            this.closeRankMenu();
            return;
        }
        this.rankMenuDismissLayer.active = true;
        this.rankMenu.active = true;
        this.rankMenuDismissLayer.setSiblingIndex(this.node.children.length - 1);
        this.rankMenu.setSiblingIndex(this.node.children.length - 1);
        this.rankShortcut.setSiblingIndex(this.node.children.length - 1);

        const op = this.rankMenu.getComponent(UIOpacity) ?? this.rankMenu.addComponent(UIOpacity);
        op.opacity = 0;
        this.rankMenu.setScale(v3(0.92, 0.92, 1));
        tween(this.rankMenu)
            .to(0.14, { scale: v3(1, 1, 1) }, { easing: 'backOut' })
            .start();
        tween(op)
            .to(0.1, { opacity: 255 })
            .start();
    }

    private closeRankMenu(): void {
        if (this.rankMenu?.isValid) {
            this.rankMenu.active = false;
        }
        if (this.rankMenuDismissLayer?.isValid) {
            this.rankMenuDismissLayer.active = false;
        }
    }

    private onRankLevelClick(): void {
        this.openRankList(RANK_LEVEL);
    }

    private onRankSurvivalClick(): void {
        this.openRankList(RANK_SURVIVAL);
    }

    private openRankList(type: number): void {
        this.closeRankMenu();
        SfxManager.instance.forceUnlock();
        SfxManager.instance.playUiClick();
        openRankPanel(type);
    }

    private onClassicClick(): void {
        console.log('[MainPanel] classic click', {
            level: GameApp.user.level,
            firstGame: GameApp.user.firstGame,
            stamina: GameApp.user.stamina,
            platformReady: GameApp.platformReady,
        });
        PerfDebug.begin('enter classic click', { level: GameApp.user.level, firstGame: GameApp.user.firstGame });
        SfxManager.instance.forceUnlock();
        // first-time guide: skip stamina cost, enter guide directly
        if (GameApp.user.firstGame === 0 && GameApp.user.level <= 1) {
            GameApp.gameMode = GameMode.level;
            GameApp.isStartGame = true;
            GameApp.uiManager?.close(UIID.MainPanel);
            const dg = GameApp.drawGrid as { reStartGame?: () => void; setGameUIVisible?: (v: boolean) => void };
            dg?.setGameUIVisible?.(true);
            dg?.reStartGame?.();
            PerfDebug.end('enter classic click', { guide: true });
            // guide is handled inside DrawGrid.initGrid for first-time users
            return;
        }
        if (GameApp.user.stamina < 15) {
            GameApp.uiManager?.open(UIID.PowerPanel);
            PerfDebug.end('enter classic click', { blocked: 'stamina' });
            return;
        }
        GameApp.tiliManager?.useTili(15);
        GameApp.gameMode = GameMode.level;
        GameApp.isStartGame = true;
        GameApp.uiManager?.close(UIID.MainPanel);
        const dg = GameApp.drawGrid as { reStartGame?: () => void; setGameUIVisible?: (v: boolean) => void };
        dg?.setGameUIVisible?.(true);
        dg?.reStartGame?.();
        PerfDebug.end('enter classic click', { guide: false });
        // guide is handled inside DrawGrid.initGrid for first-time users
    }

    private onSurvivalClick(): void {
        console.log('[MainPanel] survival click', {
            freeSurvivalTime: GameApp.user.freeSurvivalTime,
            platformReady: GameApp.platformReady,
        });
        PerfDebug.mark('enter survival click', { freeSurvivalTime: GameApp.user.freeSurvivalTime });
        SfxManager.instance.forceUnlock();
        if (GameApp.user.freeSurvivalTime <= 0) {
            RewardService.requestReward((rewarded) => {
                if (rewarded) this.enterSurvivalMode();
            });
            return;
        }
        GameApp.user.freeSurvivalTime--;
        GameApp.user.save();
        this.refreshSurvivalFreeText();
        this.enterSurvivalMode();
    }

    private enterSurvivalMode(): void {
        PerfDebug.begin('enter survival mode');
        GameApp.gameMode = GameMode.survival;
        GameApp.useTime = 0;
        GameApp.passLevel = 0;
        GameApp.foundCowNum = 0;
        GameApp.survivalReviveTime = 1;
        GameApp.isStartGame = true;
        GameApp.uiManager?.close(UIID.MainPanel);
        const dg = GameApp.drawGrid as { reStartGame?: () => void; setGameUIVisible?: (v: boolean) => void; startSurvivalMode?: () => void };
        dg?.setGameUIVisible?.(true);
        dg?.startSurvivalMode?.();
        PerfDebug.end('enter survival mode');
    }

    private onDailyChallengeClick(): void {
        console.log('[MainPanel] daily challenge click', {
            dailyChallengeFreeUsed: GameApp.user.dailyChallengeFreeUsed,
            platformReady: GameApp.platformReady,
        });
        PerfDebug.mark('enter daily challenge click', { freeUsed: GameApp.user.dailyChallengeFreeUsed });
        SfxManager.instance.forceUnlock();
        const user = GameApp.user;

        // cross-day check: reset dailyChallengeFreeUsed if new day
        const today = user.getTodayDateString();
        if (user.lastLoginDate !== today) {
            user.dailyChallengeFreeUsed = false;
            user.freeSurvivalTime = 2;
            user.adStaminaUsedToday = 0;
            user.lastLoginDate = today;
        }

        if (!user.dailyChallengeFreeUsed) {
            // free attempt
            user.dailyChallengeFreeUsed = true;
            this.refreshDailyChallengeCard();
            this.enterDailyChallengeMode();
        } else {
            // already used free attempt today: watch ad to play again
            RewardService.requestReward((success: boolean) => {
                if (success) {
                    this.enterDailyChallengeMode();
                }
            });
        }
    }

    private enterDailyChallengeMode(): void {
        PerfDebug.begin('enter daily challenge mode');
        GameApp.gameMode = GameMode.daily_challenge;
        GameApp.useTime = 0;
        GameApp.passLevel = 0;
        GameApp.foundCowNum = 0;
        GameApp.dailyChallengeReviveTime = 1;
        GameApp.dailyChallengeIsWin = false;
        GameApp.isStartGame = true;
        GameApp.uiManager?.close(UIID.MainPanel);
        const dg = GameApp.drawGrid as { startDailyChallengeMode?: () => void; setGameUIVisible?: (v: boolean) => void };
        dg?.setGameUIVisible?.(true);
        dg?.startDailyChallengeMode?.();
        PerfDebug.end('enter daily challenge mode');
    }

    private refreshDailyChallengeCard(): void {
        const freeLabel = this.dailyChallengeCard.getChildByName('dailyFree')?.getComponent(Label);
        if (freeLabel) {
            const used = GameApp.user.dailyChallengeFreeUsed;
            freeLabel.string = used ? '免费 0/1' : '免费 1/1';
        }
        this.updateDailyChallengeCountdown();
    }

    private updateDailyChallengeCountdown(): void {
        const timerLabel = this.dailyChallengeCard.getChildByName('dailyTimer')?.getComponent(Label);
        if (!timerLabel) return;
        const now = new Date();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
        const remainSec = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));
        timerLabel.string = formatCountdownTime(remainSec);
    }

}

export function createMainPanel(parent: Node): Component {
    const node = createNode('MainPanel', parent);
    return node.addComponent(MainPanel);
}
