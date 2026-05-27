import { _decorator, Component, Node, Label, Graphics, UITransform, Color, Size, sys } from 'cc';
import GameApp from './Core/GameApp';
import SfxManager from './Core/SfxManager';
import {
    createNode, createLabel, createFullScreenOverlay, createRoundedButton, getScreenSize,
    COLOR_WHITE, COLOR_GRAY,
} from './Utils/UIBuilder';

const { ccclass } = _decorator;

@ccclass('PrivacyPanel')
export default class PrivacyPanel extends Component {
    private checkboxNode!: Node;
    private checkboxMark!: Label;
    private agreeBtn!: Node;
    private rejectBtn!: Node;
    private contractBtn!: Node;
    private hintLabel!: Label;
    private checked = false;

    onLoad(): void {
        this.buildUI();
    }

    private buildUI(): void {
        const screenSize = getScreenSize();
        const ut = this.node.getComponent(UITransform)!;
        ut.setContentSize(screenSize);

        createFullScreenOverlay('bgOverlay', this.node, new Color(0, 0, 0, 255), 170);

        const card = createNode('card', this.node);
        const cardW = 580;
        const cardH = 620;
        card.getComponent(UITransform)!.setContentSize(new Size(cardW, cardH));
        const cg = card.addComponent(Graphics);
        cg.fillColor = new Color(248, 250, 255, 255);
        cg.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 24);
        cg.fill();

        const title = createLabel('title', card, '隐私说明', 34, new Color(42, 62, 100, 255), true);
        title.node.setPosition(0, 250, 0);

        const desc = createLabel('desc', card, GameApp.privacyPromptMessage, 22, new Color(88, 104, 135, 255));
        desc.node.getComponent(UITransform)!.setContentSize(new Size(470, 70));
        desc.overflow = Label.Overflow.SHRINK;
        desc.node.setPosition(0, 180, 0);

        const body = createLabel(
            'body',
            card,
            '为保障基础功能运行，游戏会在平台规则范围内读取必要的设备与账号信息，用于存档、分享、广告与合规校验。',
            20,
            new Color(105, 118, 145, 255),
        );
        body.node.getComponent(UITransform)!.setContentSize(new Size(470, 130));
        body.overflow = Label.Overflow.SHRINK;
        body.node.setPosition(0, 80, 0);

        const points = [
            '1. 本地保存关卡、金币、体力等基础进度',
            '2. 使用平台分享、振动与隐私授权能力',
            '3. 在平台要求时进行防沉迷与合规检查',
        ];
        for (let i = 0; i < points.length; i++) {
            const row = createLabel('point' + i, card, points[i], 18, new Color(118, 128, 150, 255));
            row.node.getComponent(UITransform)!.setContentSize(new Size(460, 32));
            row.overflow = Label.Overflow.SHRINK;
            row.node.setPosition(0, 10 - i * 38, 0);
        }

        const toggleRow = createNode('toggleRow', card);
        toggleRow.setPosition(0, -130, 0);
        toggleRow.getComponent(UITransform)!.setContentSize(new Size(470, 48));

        this.checkboxNode = createNode('checkbox', toggleRow);
        this.checkboxNode.setPosition(-200, 0, 0);
        this.checkboxNode.getComponent(UITransform)!.setContentSize(new Size(30, 30));
        const box = this.checkboxNode.addComponent(Graphics);
        box.fillColor = COLOR_WHITE;
        box.roundRect(-15, -15, 30, 30, 8);
        box.fill();
        box.strokeColor = new Color(124, 142, 178, 255);
        box.lineWidth = 2;
        box.roundRect(-15, -15, 30, 30, 8);
        box.stroke();

        this.checkboxMark = createLabel('checkboxMark', this.checkboxNode, '', 20, new Color(58, 118, 235, 255), true);
        this.checkboxMark.node.getComponent(UITransform)!.setContentSize(new Size(30, 30));

        const agreeText = createLabel('agreeText', toggleRow, '我已阅读并同意隐私说明', 20, new Color(72, 88, 122, 255));
        agreeText.node.getComponent(UITransform)!.setContentSize(new Size(370, 40));
        agreeText.node.setPosition(30, 0, 0);

        const contract = createRoundedButton('contractBtn', card, '查看平台隐私说明', 250, 54, new Color(222, 230, 245, 255), new Color(69, 92, 138, 255), 20, 14);
        contract.node.setPosition(0, -210, 0);
        this.contractBtn = contract.node;

        this.hintLabel = createLabel('hint', card, '', 18, new Color(219, 78, 78, 255));
        this.hintLabel.node.getComponent(UITransform)!.setContentSize(new Size(420, 30));
        this.hintLabel.node.setPosition(0, -260, 0);

        const reject = createRoundedButton('rejectBtn', card, '暂不使用', 210, 62, new Color(198, 206, 220, 255), new Color(77, 90, 117, 255), 22, 16);
        reject.node.setPosition(-120, -320, 0);
        this.rejectBtn = reject.node;

        const agree = createRoundedButton('agreeBtn', card, '同意并继续', 210, 62, new Color(58, 118, 235, 255), COLOR_WHITE, 22, 16);
        agree.node.setPosition(120, -320, 0);
        this.agreeBtn = agree.node;
    }

    onEnable(): void {
        this.checkboxNode.on(Node.EventType.TOUCH_END, this.onToggleChecked, this);
        this.agreeBtn.on(Node.EventType.TOUCH_END, this.onAgree, this);
        this.rejectBtn.on(Node.EventType.TOUCH_END, this.onReject, this);
        this.contractBtn.on(Node.EventType.TOUCH_END, this.onOpenContract, this);
    }

    onDisable(): void {
        this.checkboxNode.off(Node.EventType.TOUCH_END, this.onToggleChecked, this);
        this.agreeBtn.off(Node.EventType.TOUCH_END, this.onAgree, this);
        this.rejectBtn.off(Node.EventType.TOUCH_END, this.onReject, this);
        this.contractBtn.off(Node.EventType.TOUCH_END, this.onOpenContract, this);
    }

    private onToggleChecked(): void {
        SfxManager.instance.playUiClick();
        this.checked = !this.checked;
        this.checkboxMark.string = this.checked ? '✓' : '';
        if (this.checked) {
            this.hintLabel.string = '';
        }
    }

    private onOpenContract(): void {
        SfxManager.instance.playUiClick();
        const wxApi = (globalThis as { wx?: { openPrivacyContract?: (opts?: unknown) => void } }).wx;
        wxApi?.openPrivacyContract?.({});
    }

    private onAgree(): void {
        if (!this.checked) {
            this.hintLabel.string = '请先勾选同意后再继续';
            return;
        }

        SfxManager.instance.playUiClick();
        GameApp.acceptPrivacyAgreement();
    }

    private onReject(): void {
        SfxManager.instance.playUiClick();
        GameApp.refusePrivacyAgreement();
        this.hintLabel.string = '未同意隐私说明，无法继续进入游戏';

        const wxApi = (globalThis as { wx?: { exitMiniProgram?: () => void } }).wx;
        wxApi?.exitMiniProgram?.();

        if (!wxApi) {
            sys.localStorage.removeItem('find_the_cow_privacy_agreed_v1');
        }
    }
}

export function createPrivacyPanel(parent: Node): Component {
    const node = createNode('PrivacyPanel', parent);
    return node.addComponent(PrivacyPanel);
}
