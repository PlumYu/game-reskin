import { _decorator, Color, Component, Graphics, Label, Node, Size, UITransform } from 'cc';
import GameApp from './Core/GameApp';
import { UIID } from './Core/Enum';
import type { RankItem, RankResult } from './Core/PlatformBase';
import {
    addButtonFeedback,
    COLOR_DESC_GRAY,
    COLOR_DIVIDER,
    COLOR_GOLD,
    COLOR_TITLE_NAVY,
    COLOR_WHITE,
    createFullScreenOverlay,
    createLabel,
    createNode,
    createRoundedButton,
    createRoundedCard,
    getScreenSize,
} from './Utils/UIBuilder';

const { ccclass } = _decorator;

export const RANK_LEVEL = 0;
export const RANK_SURVIVAL = 4;

type RankType = typeof RANK_LEVEL | typeof RANK_SURVIVAL;

const PANEL_BG = new Color(247, 251, 247, 255);
const ROW_BG = new Color(255, 255, 255, 230);
const SELF_ROW_BG = new Color(220, 246, 238, 255);
const MUTED_BLUE = new Color(88, 140, 130, 255);
const TEAL_PRIMARY = new Color(44, 127, 139, 255);
const TEAL_LIGHT = new Color(222, 246, 240, 255);

function submitRankScores(onComplete?: () => void): void {
    const scores = [
        { type: RANK_LEVEL, score: GameApp.user.level },
        { type: RANK_SURVIVAL, score: GameApp.user.survivalBestRound ?? 0 },
    ];
    let remaining = scores.length;
    const finishOne = () => {
        remaining--;
        if (remaining <= 0) {
            onComplete?.();
        }
    };

    scores.forEach(({ type, score }) => {
        try {
            GameApp.platform.submitScoreForRank(type, score, finishOne);
        } catch (error) {
            console.warn('[RankPanel] submit rank score failed', { type, score, error });
            finishOne();
        }
    });
}

function rankTypeTitle(type: number): string {
    return type === RANK_SURVIVAL ? '生存榜' : '关卡榜';
}

function emptyRankText(type: number): string {
    return type === RANK_SURVIVAL ? '暂无生存榜数据' : '暂无关卡榜数据';
}

function formatScore(type: number, score: number): string {
    const normalized = Math.max(0, Math.floor(score || 0));
    return type === RANK_SURVIVAL ? `${normalized}轮` : `第${Math.max(1, normalized || 1)}关`;
}

function drawLine(parent: Node, name: string, width: number, y: number): void {
    const line = createNode(name, parent);
    line.setPosition(0, y, 0);
    const g = line.addComponent(Graphics);
    g.fillColor = COLOR_DIVIDER;
    g.rect(-width / 2, -1, width, 2);
    g.fill();
}

@ccclass('RankPanel')
export default class RankPanel extends Component {
    private built = false;
    private currentType: RankType = RANK_LEVEL;
    private titleLabel!: Label;
    private statusLabel!: Label;
    private myRankLabel!: Label;
    private rowsRoot!: Node;
    private levelTabLabel!: Label;
    private survivalTabLabel!: Label;
    private levelTabBg!: Graphics;
    private survivalTabBg!: Graphics;
    private prevPageLabel!: Label;
    private nextPageLabel!: Label;
    private pageLabel!: Label;
    private rankRows: RankItem[] = [];
    private currentPage = 0;
    private loadRequestId = 0;
    private cardWidth = 620;
    private rowWidth = 540;
    private readonly pageSize = 6;

    onLoad(): void {
        this.buildUI();
    }

    public show(type: number = RANK_LEVEL): void {
        this.buildUI();
        this.currentType = type === RANK_SURVIVAL ? RANK_SURVIVAL : RANK_LEVEL;
        this.currentPage = 0;
        this.refreshTabs();
        this.loadRank();
    }

    private buildUI(): void {
        if (this.built) {
            return;
        }
        this.built = true;

        const screenSize = getScreenSize();
        this.node.getComponent(UITransform)!.setContentSize(screenSize);

        const overlay = createFullScreenOverlay('mask', this.node, new Color(0, 0, 0, 255), 145);
        overlay.setPosition(0, 0, 0);

        this.cardWidth = Math.min(650, Math.max(560, screenSize.width * 0.86));
        const cardHeight = Math.min(860, Math.max(740, screenSize.height * 0.68));
        this.rowWidth = this.cardWidth - 80;
        const card = createRoundedCard('card', overlay, this.cardWidth, cardHeight, PANEL_BG, 30, 4, 35);
        card.setPosition(0, 0, 0);

        const cardG = card.getComponent(Graphics)!;
        cardG.fillColor = TEAL_PRIMARY;
        cardG.roundRect(-this.cardWidth / 2 + 24, cardHeight / 2 - 94, this.cardWidth - 48, 66, 20);
        cardG.fill();
        cardG.fillColor = new Color(255, 255, 255, 72);
        cardG.roundRect(-this.cardWidth / 2 + 42, cardHeight / 2 - 48, this.cardWidth - 84, 8, 4);
        cardG.fill();

        this.titleLabel = createLabel('title', card, '排行榜', 32, COLOR_WHITE, true);
        this.titleLabel.node.setPosition(0, cardHeight / 2 - 62, 0);
        this.titleLabel.node.getComponent(UITransform)!.setContentSize(new Size(this.cardWidth - 120, 54));

        const closeNode = createNode('close', card);
        closeNode.setPosition(0, -cardHeight / 2 - 54, 0);
        closeNode.getComponent(UITransform)!.setContentSize(new Size(64, 64));
        const closeG = closeNode.addComponent(Graphics);
        closeG.fillColor = TEAL_PRIMARY;
        closeG.circle(0, 0, 32);
        closeG.fill();
        closeG.strokeColor = TEAL_LIGHT;
        closeG.lineWidth = 3;
        closeG.circle(0, 0, 29);
        closeG.stroke();
        closeG.strokeColor = COLOR_WHITE;
        closeG.lineWidth = 9;
        closeG.lineCap = Graphics.LineCap.ROUND;
        closeG.moveTo(-15, 15);
        closeG.lineTo(15, -15);
        closeG.stroke();
        closeG.moveTo(15, 15);
        closeG.lineTo(-15, -15);
        closeG.stroke();
        addButtonFeedback(closeNode);
        closeNode.on(Node.EventType.TOUCH_END, () => {
            GameApp.uiManager?.close(UIID.RankPanel);
        });

        const levelTab = this.createTab(card, 'levelTab', '关卡榜');
        levelTab.node.setPosition(-118, cardHeight / 2 - 122, 0);
        this.levelTabLabel = levelTab.label;
        this.levelTabBg = levelTab.bg;
        levelTab.node.on(Node.EventType.TOUCH_END, () => this.switchType(RANK_LEVEL));

        const survivalTab = this.createTab(card, 'survivalTab', '生存榜');
        survivalTab.node.setPosition(118, cardHeight / 2 - 122, 0);
        this.survivalTabLabel = survivalTab.label;
        this.survivalTabBg = survivalTab.bg;
        survivalTab.node.on(Node.EventType.TOUCH_END, () => this.switchType(RANK_SURVIVAL));

        drawLine(card, 'divider', this.rowWidth, cardHeight / 2 - 162);

        this.myRankLabel = createLabel('myRank', card, '我的排名：加载中', 24, COLOR_TITLE_NAVY, true);
        this.myRankLabel.node.setPosition(0, cardHeight / 2 - 198, 0);
        this.myRankLabel.node.getComponent(UITransform)!.setContentSize(new Size(this.rowWidth, 46));

        this.rowsRoot = createNode('rows', card);
        this.rowsRoot.setPosition(0, 0, 0);

        const prevButton = createRoundedButton('prevPage', card, '上一页', 128, 48, new Color(232, 246, 242, 255), COLOR_TITLE_NAVY, 22, 20);
        prevButton.node.setPosition(-150, -cardHeight / 2 + 118, 0);
        prevButton.node.on(Node.EventType.TOUCH_END, () => this.changePage(-1));
        this.prevPageLabel = prevButton.label;

        this.pageLabel = createLabel('pageLabel', card, '1/1', 20, COLOR_DESC_GRAY, true);
        this.pageLabel.node.setPosition(0, -cardHeight / 2 + 118, 0);
        this.pageLabel.node.getComponent(UITransform)!.setContentSize(new Size(130, 42));

        const nextButton = createRoundedButton('nextPage', card, '下一页', 128, 48, new Color(232, 246, 242, 255), COLOR_TITLE_NAVY, 22, 20);
        nextButton.node.setPosition(150, -cardHeight / 2 + 118, 0);
        nextButton.node.on(Node.EventType.TOUCH_END, () => this.changePage(1));
        this.nextPageLabel = nextButton.label;

        this.statusLabel = createLabel('status', card, '', 24, MUTED_BLUE, true);
        this.statusLabel.node.setPosition(0, -cardHeight / 2 + 66, 0);
        this.statusLabel.node.getComponent(UITransform)!.setContentSize(new Size(this.rowWidth, 48));
    }

    private createTab(parent: Node, name: string, text: string): { node: Node; label: Label; bg: Graphics } {
        const node = createNode(name, parent);
        node.getComponent(UITransform)!.setContentSize(new Size(190, 58));
        const bg = node.addComponent(Graphics);
        const label = createLabel('label', node, text, 24, COLOR_WHITE, true);
        label.node.getComponent(UITransform)!.setContentSize(new Size(170, 48));
        addButtonFeedback(node);
        return { node, label, bg };
    }

    private switchType(type: RankType): void {
        if (this.currentType === type) {
            return;
        }
        this.currentType = type;
        this.currentPage = 0;
        this.refreshTabs();
        this.loadRank();
    }

    private refreshTabs(): void {
        this.paintTab(this.levelTabBg, this.currentType === RANK_LEVEL);
        this.paintTab(this.survivalTabBg, this.currentType === RANK_SURVIVAL);
        this.levelTabLabel.color = this.currentType === RANK_LEVEL ? COLOR_WHITE : COLOR_TITLE_NAVY;
        this.survivalTabLabel.color = this.currentType === RANK_SURVIVAL ? COLOR_WHITE : COLOR_TITLE_NAVY;
        this.titleLabel.string = rankTypeTitle(this.currentType);
    }

    private paintTab(graphics: Graphics, active: boolean): void {
        graphics.clear();
        graphics.fillColor = active ? TEAL_PRIMARY : new Color(232, 246, 242, 255);
        graphics.roundRect(-95, -29, 190, 58, 24);
        graphics.fill();
    }

    private loadRank(): void {
        const requestId = ++this.loadRequestId;
        this.clearRows();
        this.rankRows = [];
        this.currentPage = 0;
        this.statusLabel.string = '加载中...';
        this.myRankLabel.string = '我的排名：加载中';
        this.updatePageControls();

        submitRankScores(() => {
            if (requestId !== this.loadRequestId || !this.node.isValid) return;
            GameApp.platform.getRankInfo(this.currentType, (data) => {
                if (requestId !== this.loadRequestId || !this.node.isValid) {
                    return;
                }
                this.renderRank(data);
            });
        });
    }

    private renderRank(data: RankResult): void {
        this.clearRows();
        this.rankRows = Array.isArray(data.userList) ? data.userList.slice(0, 50) : [];
        this.currentPage = 0;
        const myInfo = data.myInfo;
        if (myInfo) {
            this.myRankLabel.string = `我的排名：${myInfo.rank || data.myRank || '-'}    ${formatScore(this.currentType, myInfo.score)}`;
        } else {
            this.myRankLabel.string = '我的排名：暂无';
        }

        if (data.errorMessage) {
            this.statusLabel.string = data.errorMessage;
            this.updatePageControls();
            return;
        }

        if (this.rankRows.length === 0) {
            this.statusLabel.string = emptyRankText(this.currentType);
            this.updatePageControls();
            return;
        }

        this.statusLabel.string = '数据来自微信云开发';
        this.renderCurrentPage();
    }

    private renderCurrentPage(): void {
        this.clearRows();
        const start = this.currentPage * this.pageSize;
        const rows = this.rankRows.slice(start, start + this.pageSize);
        rows.forEach((item, index) => this.createRankRow(item, index));
        this.updatePageControls();
    }

    private changePage(delta: number): void {
        const totalPages = this.getTotalPages();
        const nextPage = Math.min(totalPages - 1, Math.max(0, this.currentPage + delta));
        if (nextPage === this.currentPage) {
            return;
        }
        this.currentPage = nextPage;
        this.renderCurrentPage();
    }

    private updatePageControls(): void {
        const totalPages = this.getTotalPages();
        this.pageLabel.string = `${Math.min(this.currentPage + 1, totalPages)}/${totalPages}`;
        this.prevPageLabel.color = this.currentPage > 0 ? COLOR_TITLE_NAVY : COLOR_DESC_GRAY;
        this.nextPageLabel.color = this.currentPage < totalPages - 1 ? COLOR_TITLE_NAVY : COLOR_DESC_GRAY;
    }

    private getTotalPages(): number {
        return Math.max(1, Math.ceil(this.rankRows.length / this.pageSize));
    }

    private createRankRow(item: RankItem, index: number): void {
        const y = 108 - index * 58;
        const row = createRoundedCard(
            `row_${index}`,
            this.rowsRoot,
            this.rowWidth,
            48,
            item.isMe ? SELF_ROW_BG : ROW_BG,
            12,
            1,
            item.isMe ? 20 : 8,
        );
        row.setPosition(0, y, 0);

        const rank = createLabel('rank', row, String(item.rank || index + 1), 22, item.rank <= 3 ? COLOR_GOLD : COLOR_DESC_GRAY, true);
        rank.node.setPosition(-this.rowWidth / 2 + 46, 0, 0);
        rank.node.getComponent(UITransform)!.setContentSize(new Size(58, 40));

        const name = createLabel('name', row, item.name || '玩家', 22, COLOR_TITLE_NAVY, true);
        name.node.setPosition(-30, 0, 0);
        name.node.getComponent(UITransform)!.setContentSize(new Size(this.rowWidth - 230, 40));
        name.horizontalAlign = Label.HorizontalAlign.LEFT;

        const score = createLabel('score', row, formatScore(this.currentType, item.score), 22, TEAL_PRIMARY, true);
        score.node.setPosition(this.rowWidth / 2 - 78, 0, 0);
        score.node.getComponent(UITransform)!.setContentSize(new Size(130, 40));
    }

    private clearRows(): void {
        this.rowsRoot?.removeAllChildren();
    }
}

export function openRankPanel(type: number): void {
    const existing = GameApp.uiManager?.getPanel(UIID.RankPanel);
    if (existing) {
        existing.getComponent(RankPanel)?.show(type);
        return;
    }
    GameApp.uiManager?.open(UIID.RankPanel, (node) => {
        node.getComponent(RankPanel)?.show(type);
    });
}

export function createRankPanel(parent: Node): Component {
    const node = createNode('RankPanel', parent);
    return node.addComponent(RankPanel);
}
