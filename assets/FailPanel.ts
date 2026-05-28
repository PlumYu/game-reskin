import { _decorator, Component, Node, Label, Graphics, UITransform, Color, Size, Sprite, SpriteFrame, tween, v3 } from 'cc';
import { GameApp } from './Core/GameApp';
import { UIID, GameMode } from './Core/Enum';
import SfxManager from './Core/SfxManager';
import AssetService from './Core/AssetService';
import RewardService from './Core/RewardService';
import { GlobalHudMode } from './GlobalHud';
import { getAdaptiveLayout, scaleLayout } from './Utils/LayoutService';
import {
    createNode, createLabel, createFullScreenOverlay, staggerEntrance, addButtonFeedback,
    showToast,
    COLOR_WHITE, COLOR_BLACK,
} from './Utils/UIBuilder';

const { ccclass } = _decorator;

const FAIL_RED = new Color(63, 132, 232, 255);
const GOLD = new Color(255, 207, 42, 255);
const REVIVE_BUTTON_WIDTH = 336;
const REVIVE_BUTTON_HEIGHT = 96;
const REVIVE_BUTTON_Y_OFFSET = 150;
const MAX_HEART_COUNT = 3;
const REVIVE_HEART_COUNT = 1;

@ccclass('FailPanel')
export default class FailPanel extends Component {
    private retryBtn!: Node;
    private reviveBtn!: Node;
    private helpBtn!: Node;
    private remainingValueLabel!: Label;
    private contentRoot!: Node;
    private niumaFrame: SpriteFrame | null = null;
    private heartBalloonNode: Node | null = null;
    private heartBalloonBaseY = 0;

    onLoad(): void {
        this.buildUI();
    }

    private buildUI(): void {
        const layout = getAdaptiveLayout();
        this.node.getComponent(UITransform)?.setContentSize(new Size(layout.width, layout.height));

        createFullScreenOverlay('bgOverlay', this.node, COLOR_BLACK, 192);

        this.contentRoot = createNode('contentRoot', this.node);
        this.contentRoot.getComponent(UITransform)?.setContentSize(new Size(layout.width, layout.height));

        const titleY = Math.min(scaleLayout(460, layout), layout.topY - scaleLayout(160, layout));
        const bottomY = layout.bottomY + scaleLayout(356, layout);
        const sheetY = titleY - scaleLayout(222, layout);

        this.createFailureSheet(this.contentRoot, 0, sheetY, scaleLayout(572, layout), scaleLayout(520, layout));

        const title = this.createShadowLabel('title', this.contentRoot, '点名失败', 62, FAIL_RED, true);
        title.setPosition(0, sheetY + scaleLayout(180, layout), 0);

        const subtitle = this.createShadowLabel('subtitle', this.contentRoot, '缺席名单还没核对完', 32, GOLD, true);
        subtitle.setPosition(0, sheetY + scaleLayout(126, layout), 0);

        this.createAbsenceSheetIcon(this.contentRoot, 0, sheetY + scaleLayout(18, layout), scaleLayout(178, layout));

        const life = this.createShadowLabel('lifeHint', this.contentRoot, '补回 1 次点名机会', 34, new Color(58, 92, 138, 255), true);
        life.setPosition(0, sheetY - scaleLayout(110, layout), 0);

        const remainingRow = createNode('remainingRow', this.contentRoot);
        remainingRow.setPosition(0, sheetY - scaleLayout(176, layout), 0);
        this.drawSmallAbsenceIcon(remainingRow, -122, 0, 58);
        this.createShadowLabel('remainText', remainingRow, '未点到', 40, new Color(58, 92, 138, 255), true).setPosition(-18, 0, 0);
        const remainingValueNode = this.createShadowLabel('remainValue', remainingRow, '0', 58, FAIL_RED, true);
        remainingValueNode.setPosition(88, -2, 0);
        this.remainingValueLabel = remainingValueNode.getChildByName('remainValueLabel')?.getComponent(Label)!;

        this.reviveBtn = this.createReviveButton(this.contentRoot, 0, bottomY + scaleLayout(REVIVE_BUTTON_Y_OFFSET - 8, layout));
        this.retryBtn = this.createRetryButton(this.contentRoot, -132, bottomY);
        this.helpBtn = this.createHelpButton(this.contentRoot, 148, bottomY);
    }

    onEnable(): void {
        const globalHud = GameApp.globalHud as { setMode?: (mode: GlobalHudMode) => void; syncLayout?: () => void } | null;
        globalHud?.setMode?.(GlobalHudMode.LevelFail);
        globalHud?.syncLayout?.();
        this.refreshRemainingCount();
        staggerEntrance([this.contentRoot], 0, 0.24, 34);
        this.retryBtn.on(Node.EventType.TOUCH_END, this.onRetryClick, this);
        this.reviveBtn.on(Node.EventType.TOUCH_END, this.onReviveClick, this);
        this.helpBtn.on(Node.EventType.TOUCH_END, this.onHelpClick, this);
        this.startHeartBalloonMotion();
        this.startReviveButtonPulse();
    }

    onDisable(): void {
        this.retryBtn.off(Node.EventType.TOUCH_END, this.onRetryClick, this);
        this.reviveBtn.off(Node.EventType.TOUCH_END, this.onReviveClick, this);
        this.helpBtn.off(Node.EventType.TOUCH_END, this.onHelpClick, this);
        if (this.heartBalloonNode?.isValid) {
            tween(this.heartBalloonNode).stop();
            this.heartBalloonNode.setPosition(0, this.heartBalloonBaseY, 0);
            this.heartBalloonNode.angle = 0;
        }
        if (this.reviveBtn?.isValid) {
            tween(this.reviveBtn).stop();
            this.reviveBtn.setScale(v3(1, 1, 1));
        }
    }

    private refreshRemainingCount(): void {
        const dg = GameApp.drawGrid as any;
        const total = Math.max(0, Math.floor(dg?.totalCows || 0));
        const found = Math.max(0, Math.floor(dg?.cowsFound || GameApp.foundCowNum || 0));
        const remaining = total > 0 ? Math.max(0, total - found) : 0;
        this.remainingValueLabel.string = remaining.toString();
    }

    private createShadowLabel(name: string, parent: Node, text: string, fontSize: number, color: Color, bold = false): Node {
        const root = createNode(name, parent);
        const label = createLabel(`${name}Label`, root, text, fontSize, color, bold);
        label.node.setPosition(0, 0, 0);
        return root;
    }

    private createFailureSheet(parent: Node, x: number, y: number, width: number, height: number): void {
        const node = createNode('absenceReportSheet', parent);
        node.setPosition(x, y, 0);
        node.getComponent(UITransform)?.setContentSize(new Size(width, height));
        const g = node.addComponent(Graphics);
        const radius = Math.max(18, height * 0.045);
        g.fillColor = new Color(0, 0, 0, 68);
        g.roundRect(-width / 2 + 8, -height / 2 - 8, width - 16, height, radius);
        g.fill();
        g.fillColor = new Color(246, 251, 255, 250);
        g.roundRect(-width / 2, -height / 2, width, height, radius);
        g.fill();
        g.strokeColor = new Color(184, 213, 243, 230);
        g.lineWidth = 3;
        g.roundRect(-width / 2, -height / 2, width, height, radius);
        g.stroke();

        g.fillColor = new Color(229, 242, 255, 255);
        g.roundRect(-width / 2 + 28, height / 2 - 98, width - 56, 74, 20);
        g.fill();
        g.strokeColor = new Color(191, 221, 247, 160);
        g.lineWidth = 2;
        for (let lineY = height / 2 - 138; lineY > -height / 2 + 48; lineY -= 48) {
            g.moveTo(-width / 2 + 80, lineY);
            g.lineTo(width / 2 - 54, lineY);
        }
        g.stroke();

        g.strokeColor = new Color(83, 151, 222, 180);
        g.lineWidth = 4;
        g.moveTo(-width / 2 + 78, height / 2 - 126);
        g.lineTo(-width / 2 + 78, -height / 2 + 46);
        g.stroke();
    }

    private createAbsenceSheetIcon(parent: Node, x: number, y: number, size: number): void {
        const node = createNode('absenceGridIcon', parent);
        node.setPosition(x, y, 0);
        node.getComponent(UITransform)?.setContentSize(new Size(size, size));
        const g = node.addComponent(Graphics);
        const cell = size / 4.8;
        const startX = -cell * 1.5;
        const startY = cell * 1.5;
        g.fillColor = new Color(63, 132, 232, 255);
        g.roundRect(-size * 0.42, -size * 0.42, size * 0.84, size * 0.84, size * 0.12);
        g.fill();
        g.fillColor = new Color(255, 255, 255, 235);
        g.roundRect(-size * 0.34, -size * 0.34, size * 0.68, size * 0.68, size * 0.08);
        g.fill();
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const cx = startX + col * cell;
                const cy = startY - row * cell;
                const isMissing = row === 2 && col === 2;
                g.fillColor = isMissing ? new Color(255, 207, 42, 255) : new Color(204, 225, 246, 255);
                g.roundRect(cx - cell * 0.36, cy - cell * 0.3, cell * 0.72, cell * 0.6, cell * 0.12);
                g.fill();
            }
        }
        g.strokeColor = new Color(255, 255, 255, 255);
        g.lineWidth = Math.max(4, size * 0.04);
        g.lineCap = Graphics.LineCap.ROUND;
        g.moveTo(size * 0.17, -size * 0.16);
        g.lineTo(size * 0.34, -size * 0.33);
        g.stroke();
    }

    private drawSmallAbsenceIcon(parent: Node, x: number, y: number, size: number): void {
        const node = createNode('smallAbsenceIcon', parent);
        node.setPosition(x, y, 0);
        node.getComponent(UITransform)?.setContentSize(new Size(size, size));
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(63, 132, 232, 255);
        g.roundRect(-size / 2, -size / 2, size, size, size * 0.18);
        g.fill();
        g.fillColor = COLOR_WHITE;
        g.roundRect(-size * 0.28, -size * 0.16, size * 0.56, size * 0.32, size * 0.08);
        g.fill();
        g.strokeColor = GOLD;
        g.lineWidth = Math.max(3, size * 0.06);
        g.circle(size * 0.24, -size * 0.18, size * 0.12);
        g.stroke();
    }

    private createReviveButton(parent: Node, x: number, y: number): Node {
        const node = this.createPillButton('reviveBtn', parent, REVIVE_BUTTON_WIDTH, REVIVE_BUTTON_HEIGHT, FAIL_RED);
        node.setPosition(x, y, 0);
        this.drawPlayBadge(node, -78, 0);
        createLabel('label', node, '继续', 44, COLOR_WHITE, true).node.setPosition(40, 1, 0);
        return node;
    }

    private createRetryButton(parent: Node, x: number, y: number): Node {
        const node = this.createPillButton('retryBtn', parent, 250, 78, FAIL_RED);
        node.setPosition(x, y, 0);
        createLabel('label', node, '重来', 34, COLOR_WHITE, true).node.setPosition(0, 13, 0);

        const chip = createNode('staminaChip', node);
        chip.setPosition(0, -25, 0);
        chip.getComponent(UITransform)?.setContentSize(new Size(96, 30));
        const g = chip.addComponent(Graphics);
        g.fillColor = new Color(37, 85, 148, 215);
        g.roundRect(-48, -15, 96, 30, 15);
        g.fill();
        createLabel('cost', chip, '⚡-15', 22, COLOR_WHITE, true).node.setPosition(0, 0, 0);
        return node;
    }

    private createHelpButton(parent: Node, x: number, y: number): Node {
        const node = this.createPillButton('helpBtn', parent, 280, 78, COLOR_WHITE);
        node.setPosition(x, y, 0);
        this.drawShareIcon(node, -72, 0, FAIL_RED);
        createLabel('label', node, '求助同学', 30, FAIL_RED, true).node.setPosition(26, 0, 0);
        return node;
    }

    private createPillButton(name: string, parent: Node, width: number, height: number, fill: Color): Node {
        const node = createNode(name, parent);
        node.getComponent(UITransform)?.setContentSize(new Size(width, height));
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 70);
        g.roundRect(-width / 2 + 4, -height / 2 - 6, width, height, height / 2);
        g.fill();
        g.fillColor = fill;
        g.roundRect(-width / 2, -height / 2, width, height, height / 2);
        g.fill();
        if (fill.r > 245 && fill.g > 245 && fill.b > 245) {
            g.strokeColor = new Color(255, 255, 255, 230);
            g.lineWidth = 3;
            g.roundRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, height / 2 - 2);
            g.stroke();
        }
        addButtonFeedback(node);
        return node;
    }

    private createHeartBalloon(parent: Node, x: number, y: number, size: number): Node {
        const node = createNode('lifeHeart', parent);
        node.setPosition(x, y, 0);
        node.getComponent(UITransform)?.setContentSize(new Size(size, size));
        const g = node.addComponent(Graphics);
        const s = size / 100;
        this.heartBalloonBaseY = y;

        g.fillColor = new Color(0, 0, 0, 52);
        g.ellipse(12 * s, -56 * s, 38 * s, 10 * s);
        g.fill();

        g.fillColor = new Color(188, 50, 22, 150);
        this.drawHeartPath(g, 7 * s, -9 * s, s * 1.05);
        g.fill();

        g.fillColor = new Color(230, 68, 24, 255);
        this.drawHeartPath(g, 4 * s, -5 * s, s * 1.03);
        g.fill();

        g.fillColor = new Color(255, 103, 39, 255);
        this.drawHeartPath(g, 0, 0, s);
        g.fill();

        g.fillColor = new Color(255, 156, 84, 72);
        this.drawHeartPath(g, -8 * s, 7 * s, s * 0.74);
        g.fill();

        g.fillColor = new Color(255, 255, 255, 196);
        g.ellipse(-20 * s, 20 * s, 8 * s, 16 * s);
        g.fill();
        g.fillColor = new Color(255, 255, 255, 92);
        g.ellipse(-29 * s, 4 * s, 8 * s, 11 * s);
        g.fill();

        g.strokeColor = new Color(255, 203, 168, 104);
        g.lineWidth = Math.max(2, 2.1 * s);
        this.drawHeartPath(g, -1 * s, 1 * s, s * 0.98);
        g.stroke();

        g.fillColor = new Color(213, 59, 22, 255);
        g.roundRect(-13 * s, -56 * s, 26 * s, 14 * s, 6 * s);
        g.fill();
        g.fillColor = new Color(255, 141, 73, 170);
        g.ellipse(-4 * s, -51 * s, 6 * s, 3 * s);
        g.fill();

        g.strokeColor = new Color(255, 220, 197, 120);
        g.lineWidth = Math.max(1.5, 1.4 * s);
        g.moveTo(0, -64 * s);
        g.bezierCurveTo(8 * s, -78 * s, -7 * s, -89 * s, 4 * s, -103 * s);
        g.stroke();
        return node;
    }

    private startHeartBalloonMotion(): void {
        const node = this.heartBalloonNode;
        if (!node?.isValid) return;
        tween(node).stop();
        node.setPosition(0, this.heartBalloonBaseY, 0);
        node.angle = 0;
        tween(node)
            .repeatForever(
                tween()
                    .to(0.92, { position: v3(-8, this.heartBalloonBaseY + 10, 0), angle: -3.5, scale: v3(1.03, 1.02, 1) }, { easing: 'sineOut' })
                    .to(0.98, { position: v3(7, this.heartBalloonBaseY + 1, 0), angle: 3, scale: v3(0.995, 1.01, 1) }, { easing: 'sineInOut' })
                    .to(0.86, { position: v3(0, this.heartBalloonBaseY, 0), angle: 0, scale: v3(1, 1, 1) }, { easing: 'sineIn' })
            )
            .start();
    }

    private startReviveButtonPulse(): void {
        const node = this.reviveBtn;
        if (!node?.isValid) return;
        tween(node).stop();
        node.setScale(v3(1, 1, 1));
        tween(node)
            .delay(0.18)
            .repeatForever(
                tween()
                    .to(0.66, { scale: v3(1.08, 1.08, 1) }, { easing: 'quadInOut' })
                    .to(0.66, { scale: v3(1, 1, 1) }, { easing: 'quadInOut' })
            )
            .start();
    }

    private drawHeartPath(g: Graphics, x: number, y: number, s: number): void {
        g.moveTo(x, y - 31 * s);
        g.bezierCurveTo(x - 45 * s, y - 4 * s, x - 55 * s, y + 38 * s, x - 22 * s, y + 48 * s);
        g.bezierCurveTo(x - 7 * s, y + 53 * s, x, y + 42 * s, x, y + 30 * s);
        g.bezierCurveTo(x, y + 42 * s, x + 7 * s, y + 53 * s, x + 22 * s, y + 48 * s);
        g.bezierCurveTo(x + 55 * s, y + 38 * s, x + 45 * s, y - 4 * s, x, y - 31 * s);
        g.close();
    }

    private createNiumaBadge(parent: Node, x: number, y: number, size: number): void {
        const node = createNode('niumaBadge', parent);
        node.setPosition(x, y, 0);
        node.getComponent(UITransform)?.setContentSize(new Size(size, size));
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, 68);
        g.circle(size * 0.04, -size * 0.05, size * 0.48);
        g.fill();
        g.fillColor = new Color(142, 190, 82, 255);
        g.circle(0, 0, size * 0.47);
        g.fill();
        g.strokeColor = COLOR_WHITE;
        g.lineWidth = Math.max(4, size * 0.07);
        g.circle(0, 0, size * 0.43);
        g.stroke();
        const spriteNode = createNode('niumaSprite', node);
        spriteNode.getComponent(UITransform)?.setContentSize(new Size(size * 0.86, size * 0.86));
        spriteNode.setPosition(0, -size * 0.02, 0);
        const sprite = spriteNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        this.loadNiumaFrame(frame => {
            if (!frame || !spriteNode.isValid) return;
            sprite.spriteFrame = frame;
        });
    }

    private loadNiumaFrame(onLoaded: (frame: SpriteFrame | null) => void): void {
        if (this.niumaFrame) {
            onLoaded(this.niumaFrame);
            return;
        }
        AssetService.loadSpriteFrame('characters/menu_idle_static', frame => {
            this.niumaFrame = frame;
            onLoaded(frame);
        }, 'smooth');
    }

    private drawPlayBadge(parent: Node, x: number, y: number): void {
        const node = createNode('playBadge', parent);
        node.setPosition(x, y, 0);
        node.getComponent(UITransform)?.setContentSize(new Size(72, 52));
        const g = node.addComponent(Graphics);
        g.fillColor = COLOR_WHITE;
        g.roundRect(-36, -26, 72, 52, 14);
        g.fill();
        g.fillColor = FAIL_RED;
        g.moveTo(-8, -14);
        g.lineTo(-8, 14);
        g.lineTo(18, 0);
        g.close();
        g.fill();
    }

    private drawShareIcon(parent: Node, x: number, y: number, color: Color): void {
        const node = createNode('shareIcon', parent);
        node.setPosition(x, y, 0);
        node.getComponent(UITransform)?.setContentSize(new Size(54, 48));
        const g = node.addComponent(Graphics);
        g.strokeColor = color;
        g.lineWidth = 7;
        g.lineCap = Graphics.LineCap.ROUND;
        g.moveTo(-12, 0);
        g.lineTo(14, 17);
        g.moveTo(-12, 0);
        g.lineTo(14, -17);
        g.stroke();
        g.fillColor = color;
        g.circle(-17, 0, 8);
        g.circle(18, 20, 8);
        g.circle(18, -20, 8);
        g.fill();
    }

    private onRetryClick(): void {
        SfxManager.instance.playUiClick();
        if (GameApp.gameMode === GameMode.level) {
            if (GameApp.user.stamina < 15) {
                GameApp.uiManager?.closeAndOpen(UIID.FailPanel, UIID.PowerPanel);
                return;
            }
            GameApp.tiliManager?.useTili(15);
        }
        GameApp.uiManager?.close(UIID.FailPanel);
        const dg = GameApp.drawGrid as { reStartGame?: () => void };
        dg?.reStartGame?.();
    }

    private onCloseClick(): void {
        SfxManager.instance.playUiClick();
        GameApp.isStartGame = false;
        const dg = GameApp.drawGrid as { setGameUIVisible?: (v: boolean) => void };
        dg?.setGameUIVisible?.(false);
        GameApp.uiManager?.closeAndOpen(UIID.FailPanel, UIID.MainPanel);
    }

    private onReviveClick(): void {
        SfxManager.instance.playUiClick();
        RewardService.requestReward((rewarded) => {
            if (rewarded) {
                GameApp.uiManager?.close(UIID.FailPanel);
                this.restoreOneLife();
            }
        });
    }

    private onHelpClick(): void {
        SfxManager.instance.playUiClick();
        GameApp.platform.share((success) => {
            if (!success) {
                showToast(GameApp.uiManager?.node || this.node, '分享暂不可用，请稍后再试');
            }
        });
    }

    private restoreOneLife(): void {
        const dg = GameApp.drawGrid as any;
        if (!dg) return;
        dg.isGameOver = false;
        dg.mistakeCount = MAX_HEART_COUNT - REVIVE_HEART_COUNT;
        dg.setGameUIVisible?.(true);
        dg.renderGrid?.();
        this.syncRevivedHearts(dg);
    }

    private syncRevivedHearts(dg: any): void {
        const hearts = dg.heartContainer?.children || [];
        for (let i = 0; i < hearts.length; i++) {
            tween(hearts[i]).stop();
            hearts[i].active = i < REVIVE_HEART_COUNT;
            hearts[i].setScale(1, 1, 1);
        }
    }
}

export function createFailPanel(parent: Node): Component {
    const node = createNode('FailPanel', parent);
    return node.addComponent(FailPanel);
}
