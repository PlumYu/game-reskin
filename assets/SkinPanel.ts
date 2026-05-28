import { _decorator, Component, Node, Label, Graphics, UITransform, Color, Size, tween, v3 } from 'cc';
import GameApp from './Core/GameApp';
import { UIID } from './Core/Enum';
import SfxManager from './Core/SfxManager';
import {
    createNode, createLabel, createFullScreenOverlay, createRoundedButton, getScreenSize,
    COLOR_DARK_BLUE, COLOR_GOLD, COLOR_WHITE, COLOR_GRAY, COLOR_RED,
} from './Utils/UIBuilder';

const { ccclass } = _decorator;

interface SkinDef {
    id: number;
    name: string;
    cost: number;
    color: Color;
}

const SKINS: SkinDef[] = [
    { id: 1, name: '经典座位', cost: 0, color: new Color(232, 184, 75, 255) },
    { id: 2, name: '暖色座位', cost: 300, color: new Color(220, 80, 50, 255) },
    { id: 3, name: '冰蓝座位', cost: 300, color: new Color(80, 180, 240, 255) },
    { id: 4, name: '夜读座位', cost: 500, color: new Color(120, 60, 200, 255) },
    { id: 5, name: '金色座位', cost: 800, color: new Color(255, 215, 0, 255) },
    { id: 6, name: '彩虹座位', cost: 1200, color: new Color(255, 100, 180, 255) },
];

@ccclass('SkinPanel')
export default class SkinPanel extends Component {
    private closeBtn!: Node;
    private coinLabel!: Label;
    private skinItems: { node: Node; skinId: number }[] = [];
    private selectedBorder: Node | null = null;

    onLoad(): void {
        this.buildUI();
    }

    private buildUI(): void {
        const screenSize = getScreenSize();
        const ut = this.node.getComponent(UITransform)!;
        ut.setContentSize(screenSize);

        createFullScreenOverlay('bgOverlay', this.node, new Color(0, 0, 0, 255), 160);

        const card = createNode('card', this.node);
        const cardW = 500;
        const cardH = 560;
        const cardUt = card.getComponent(UITransform)!;
        cardUt.setContentSize(new Size(cardW, cardH));

        const cardG = card.addComponent(Graphics);
        cardG.fillColor = new Color(22, 33, 62, 255);
        cardG.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);
        cardG.fill();

        // 标题
        createLabel('title', card, '座位皮肤', 30, COLOR_GOLD, true).node.setPosition(0, 230, 0);

        // 金币显示
        this.coinLabel = createLabel('coin', card, '', 20, COLOR_GOLD);
        this.coinLabel.node.setPosition(0, 195, 0);
        this.updateCoinDisplay();

        // 分割线
        const divider = createNode('divider', card);
        divider.setPosition(0, 175, 0);
        const dg = divider.addComponent(Graphics);
        dg.strokeColor = new Color(232, 184, 75, 60);
        dg.lineWidth = 1;
        dg.moveTo(-210, 0);
        dg.lineTo(210, 0);
        dg.stroke();

        // 皮肤网格 (3x2)
        this.buildSkinGrid(card);

        // 关闭按钮
        const close = createRoundedButton('closeBtn', card, '关闭', 200, 52, COLOR_GOLD, COLOR_DARK_BLUE, 20, 14);
        close.node.setPosition(0, -240, 0);
        this.closeBtn = close.node;
    }

    private buildSkinGrid(parent: Node): void {
        const gridNode = createNode('grid', parent);
        gridNode.setPosition(0, 20, 0);

        const cols = 3;
        const cellW = 130;
        const cellH = 140;
        const gapX = 14;
        const gapY = 14;

        const user = GameApp.user;
        const unlocked = user.unlockSkin;
        const currentSkin = user.useSkin;

        for (let i = 0; i < SKINS.length; i++) {
            const skin = SKINS[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = (col - 1) * (cellW + gapX);
            const y = -row * (cellH + gapY) + 50;

            const cell = createNode('skin_' + skin.id, gridNode);
            cell.setPosition(x, y, 0);
            const cellUt = cell.getComponent(UITransform)!;
            cellUt.setContentSize(new Size(cellW, cellH));

            const isUnlocked = unlocked.indexOf(skin.id) >= 0;
            const isActive = skin.id === currentSkin;

            // 背景
            const bg = cell.addComponent(Graphics);
            const bgColor = isActive ? new Color(50, 50, 90, 255) : new Color(35, 40, 70, 255);
            bg.fillColor = bgColor;
            bg.roundRect(-cellW / 2, -cellH / 2, cellW, cellH, 12);
            bg.fill();

            if (isActive) {
                bg.strokeColor = COLOR_GOLD;
                bg.lineWidth = 2;
                bg.roundRect(-cellW / 2, -cellH / 2, cellW, cellH, 12);
                bg.stroke();
            }

            // 皮肤颜色预览圆
            const preview = createNode('preview', cell);
            preview.setPosition(0, 15, 0);
            const pg = preview.addComponent(Graphics);
            pg.fillColor = isUnlocked ? skin.color : new Color(80, 80, 80, 150);
            pg.circle(0, 0, 28);
            pg.fill();

            if (!isUnlocked) {
                // 锁定图标
                const lockLabel = createLabel('lock', preview, '🔒', 20, COLOR_GRAY);
                lockLabel.node.setPosition(0, 0, 0);
            }

            // 皮肤名称
            createLabel('name', cell, skin.name, 16, COLOR_WHITE).node.setPosition(0, -28, 0);

            // 价格/状态
            let statusText = '';
            let statusColor = COLOR_GRAY;
            if (isActive) {
                statusText = '使用中';
                statusColor = COLOR_GOLD;
            } else if (isUnlocked) {
                statusText = '已解锁';
                statusColor = new Color(80, 180, 80, 255);
            } else {
                statusText = `${skin.cost} 金币`;
                statusColor = COLOR_GOLD;
            }
            createLabel('status', cell, statusText, 14, statusColor).node.setPosition(0, -48, 0);

            this.skinItems.push({ node: cell, skinId: skin.id });
        }
    }

    onEnable(): void {
        this.closeBtn.on(Node.EventType.TOUCH_END, this.onClose, this);
        for (const item of this.skinItems) {
            item.node.on(Node.EventType.TOUCH_END, () => this.onSkinClick(item.skinId), this);
        }
    }

    onDisable(): void {
        this.closeBtn.off(Node.EventType.TOUCH_END, this.onClose, this);
        for (const item of this.skinItems) {
            item.node.off(Node.EventType.TOUCH_END);
        }
    }

    private onSkinClick(skinId: number): void {
        SfxManager.instance.playUiClick();
        const user = GameApp.user;
        const unlocked = user.unlockSkin;

        if (unlocked.indexOf(skinId) >= 0) {
            // 已解锁 → 切换使用
            user.useSkin = skinId;
            this.rebuildGrid();
            return;
        }

        // 未解锁 → 购买
        const skin = SKINS.find(s => s.id === skinId);
        if (!skin) return;

        if (user.coin < skin.cost) {
            this.showToast('金币不足');
            return;
        }

        user.coin -= skin.cost;
        user.unlockSkin = [skinId];
        user.useSkin = skinId;
        this.updateCoinDisplay();
        this.rebuildGrid();
    }

    private rebuildGrid(): void {
        const grid = this.node.getChildByName('card')?.getChildByName('grid');
        if (grid) {
            grid.destroy();
        }
        this.skinItems = [];
        this.buildSkinGrid(this.node.getChildByName('card')!);
        for (const item of this.skinItems) {
            item.node.on(Node.EventType.TOUCH_END, () => this.onSkinClick(item.skinId), this);
        }
    }

    private updateCoinDisplay(): void {
        this.coinLabel.string = `金币: ${GameApp.user.coin}`;
    }

    private showToast(msg: string): void {
        const existing = this.node.getChildByName('toast');
        if (existing) existing.destroy();

        const toast = createNode('toast', this.node);
        toast.setPosition(0, -260, 0);

        const g = toast.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 180);
        g.roundRect(-100, -20, 200, 40, 20);
        g.fill();

        createLabel('msg', toast, msg, 18, COLOR_WHITE).node.setPosition(0, 0, 0);

        toast.setScale(v3(0.8, 0.8, 1));
        tween(toast)
            .to(0.2, { scale: v3(1, 1, 1) }, { easing: 'backOut' })
            .delay(1.2)
            .to(0.3, { scale: v3(0, 0, 1) })
            .call(() => toast.destroy())
            .start();
    }

    private onClose(): void {
        SfxManager.instance.playUiClick();
        GameApp.uiManager?.close(UIID.SkinPanel);
    }
}

export function createSkinPanel(parent: Node): Component {
    const node = createNode('SkinPanel', parent);
    return node.addComponent(SkinPanel);
}
