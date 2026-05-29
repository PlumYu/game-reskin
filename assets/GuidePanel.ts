import { _decorator, Component, Node, Label, Graphics, UITransform, Color, Size, tween, v3 } from 'cc';
import GameApp from './Core/GameApp';
import { UIID } from './Core/Enum';
import SfxManager from './Core/SfxManager';
import {
    createNode, createLabel, createFullScreenOverlay, createRoundedButton, getScreenSize,
    COLOR_DARK_BLUE, COLOR_GOLD, COLOR_WHITE, COLOR_GRAY,
} from './Utils/UIBuilder';

const { ccclass } = _decorator;

interface GuideStep {
    title: string;
    desc: string;
    highlight?: string;
}

const GUIDE_STEPS: GuideStep[] = [
    { title: '欢迎来到谁偷了我的奶茶！', desc: '在藏身格里找出目标奶茶\n每种口味只会藏1杯奶茶' },
    { title: '先标记', desc: '点击格子可以标记或取消\n确定不可能的格子先标记' },
    { title: '排除思路', desc: '每行每列都只会有1杯奶茶\n定住一格后，其他格就能继续排' },
    { title: '双击确认', desc: '双击格子可以直接揭示\n判断对了就能锁定一个' },
    { title: '相邻规则', desc: '奶茶之间不会挨着（包括对角线）\n这个规则最容易帮你缩范围' },
    { title: '准备开始！', desc: '规则不多，但特别容易差一格\n开始试试吧！' },
];

@ccclass('GuidePanel')
export default class GuidePanel extends Component {
    private currentStep: number = 0;
    private stepTitle!: Label;
    private stepDesc!: Label;
    private prevBtn!: Node;
    private nextBtn!: Node;
    private nextBtnLabel!: Label;
    private progressLabel!: Label;
    private dots: Node[] = [];

    onLoad(): void {
        this.buildUI();
        this.showStep(0);
    }

    private buildUI(): void {
        const screenSize = getScreenSize();
        const ut = this.node.getComponent(UITransform)!;
        ut.setContentSize(screenSize);

        createFullScreenOverlay('bgOverlay', this.node, new Color(0, 0, 0, 255), 180);

        const card = createNode('card', this.node);
        const cardW = 500;
        const cardH = 440;
        const cardUt = card.getComponent(UITransform)!;
        cardUt.setContentSize(new Size(cardW, cardH));

        const cardG = card.addComponent(Graphics);
        cardG.fillColor = new Color(22, 33, 62, 255);
        cardG.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);
        cardG.fill();

        // 步骤图标区
        const iconArea = createNode('iconArea', card);
        iconArea.setPosition(0, 155, 0);
        const ig = iconArea.addComponent(Graphics);
        ig.fillColor = new Color(232, 184, 75, 40);
        ig.circle(0, 0, 36);
        ig.fill();
        ig.strokeColor = COLOR_GOLD;
        ig.lineWidth = 2;
        ig.circle(0, 0, 36);
        ig.stroke();

        const iconLabel = createLabel('icon', iconArea, '?', 36, COLOR_GOLD, true);
        iconLabel.node.setPosition(0, 0, 0);

        // 标题
        this.stepTitle = createLabel('stepTitle', card, '', 28, COLOR_GOLD, true);
        this.stepTitle.node.setPosition(0, 90, 0);
        this.stepTitle.node.getComponent(UITransform)!.setContentSize(new Size(440, 40));

        // 描述
        this.stepDesc = createLabel('stepDesc', card, '', 20, new Color(200, 200, 220, 230));
        this.stepDesc.node.setPosition(0, 20, 0);
        this.stepDesc.node.getComponent(UITransform)!.setContentSize(new Size(420, 100));
        this.stepDesc.overflow = Label.Overflow.RESIZE_HEIGHT;

        // 进度点
        const dotsRow = createNode('dots', card);
        dotsRow.setPosition(0, -60, 0);
        for (let i = 0; i < GUIDE_STEPS.length; i++) {
            const dot = createNode('dot' + i, dotsRow);
            dot.setPosition(-40 + i * 16, 0, 0);
            const dg = dot.addComponent(Graphics);
            dg.fillColor = i === 0 ? COLOR_GOLD : new Color(100, 100, 100, 150);
            dg.circle(0, 0, 5);
            dg.fill();
            this.dots.push(dot);
        }

        // 进度文字
        this.progressLabel = createLabel('progress', card, '', 16, COLOR_GRAY);
        this.progressLabel.node.setPosition(0, -85, 0);

        // 上一步按钮
        const prev = createRoundedButton('prevBtn', card, '上一步', 160, 52, new Color(60, 60, 80, 255), COLOR_GRAY, 20, 14);
        prev.node.setPosition(-100, -140, 0);
        this.prevBtn = prev.node;

        // 下一步按钮
        const next = createRoundedButton('nextBtn', card, '下一步', 160, 52, COLOR_GOLD, COLOR_DARK_BLUE, 20, 14);
        next.node.setPosition(100, -140, 0);
        this.nextBtn = next.node;
        this.nextBtnLabel = next.label;

        // 跳过按钮
        const skip = createLabel('skipBtn', card, '跳过引导', 16, COLOR_GRAY);
        skip.node.setPosition(0, -185, 0);
        skip.node.getComponent(UITransform)!.setContentSize(new Size(120, 30));
        skip.node.on(Node.EventType.TOUCH_END, this.onSkip, this);
    }

    private showStep(index: number): void {
        this.currentStep = index;
        const step = GUIDE_STEPS[index];

        this.stepTitle.string = step.title;
        this.stepDesc.string = step.desc;
        this.progressLabel.string = `${index + 1} / ${GUIDE_STEPS.length}`;

        // 更新进度点
        for (let i = 0; i < this.dots.length; i++) {
            const dg = this.dots[i].getComponent(Graphics)!;
            dg.clear();
            dg.fillColor = i === index ? COLOR_GOLD : new Color(100, 100, 100, 150);
            dg.circle(0, 0, i === index ? 6 : 5);
            dg.fill();
        }

        // 上一步按钮可见性
        this.prevBtn.active = index > 0;

        // 最后一步改按钮文字
        const isLast = index === GUIDE_STEPS.length - 1;
        this.nextBtnLabel.string = isLast ? '开始游戏' : '下一步';

        // 卡片动画
        const card = this.node.getChildByName('card');
        if (card) {
            card.setScale(v3(0.95, 0.95, 1));
            tween(card).to(0.15, { scale: v3(1, 1, 1) }, { easing: 'quadOut' }).start();
        }
    }

    onEnable(): void {
        this.prevBtn.on(Node.EventType.TOUCH_END, this.onPrev, this);
        this.nextBtn.on(Node.EventType.TOUCH_END, this.onNext, this);
    }

    onDisable(): void {
        this.prevBtn.off(Node.EventType.TOUCH_END, this.onPrev, this);
        this.nextBtn.off(Node.EventType.TOUCH_END, this.onNext, this);
    }

    private onPrev(): void {
        SfxManager.instance.playUiClick();
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    }

    private onNext(): void {
        SfxManager.instance.playUiClick();
        if (this.currentStep < GUIDE_STEPS.length - 1) {
            this.showStep(this.currentStep + 1);
        } else {
            this.finishGuide();
        }
    }

    private onSkip(): void {
        SfxManager.instance.playUiClick();
        this.finishGuide();
    }

    private finishGuide(): void {
        // Legacy static guide panel must not mutate firstGame; the in-game tutorial owns that state.
        GameApp.uiManager?.close(UIID.GuidePanel);
    }
}

export function createGuidePanel(parent: Node): Component {
    const node = createNode('GuidePanel', parent);
    return node.addComponent(GuidePanel);
}
