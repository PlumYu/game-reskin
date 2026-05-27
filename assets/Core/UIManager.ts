import {
    _decorator,
    Component,
    Node,
    UITransform,
    UIOpacity,
    tween,
    Layers,
    Vec3,
    view,
    Widget,
    type TweenEasing,
} from 'cc';
import { UIID, UILayer } from './Enum';
import { UIConfigMap } from './UIConfig';
import GameApp from './GameApp';
import SfxManager from './SfxManager';
import GlobalHud from '../GlobalHud';

const { ccclass } = _decorator;

const SETTLEMENT_IDS: Set<UIID> = new Set([
    UIID.WinPanel, UIID.FailPanel, UIID.SurvivalOverPanel, UIID.DailyChallengeOverPanel,
]);

@ccclass('UIManager')
export default class UIManager extends Component {
    private _layers: Map<UILayer, Node> = new Map();
    private _panels: Map<UIID, Node> = new Map();

    onLoad(): void {
        GameApp.uiManager = this;

        const ut = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        const screenSize = view.getVisibleSize();
        ut.setContentSize(screenSize);

        const widget = this.node.addComponent(Widget);
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.top = 0;
        widget.bottom = 0;
        widget.left = 0;
        widget.right = 0;

        const layerValues: UILayer[] = [
            UILayer.Background,
            UILayer.Game,
            UILayer.UI,
            UILayer.Popup,
            UILayer.Toast,
            UILayer.TopHud,
        ];

        for (const layer of layerValues) {
            const layerNode = new Node(`Layer_${UILayer[layer]}`);
            layerNode.layer = Layers.Enum.UI_2D;
            const layerUt = layerNode.addComponent(UITransform);
            layerUt.setContentSize(screenSize);
            this.node.addChild(layerNode);
            layerNode.setSiblingIndex(layer);
            this._layers.set(layer, layerNode);
        }

        this.ensureGlobalHud();
    }

    public open(uiId: UIID, onOpened?: (node: Node) => void): void {
        if (uiId === UIID.MainPanel) {
            this.ensureGlobalHud();
            SfxManager.instance.playMenuBgm();
        }
        const config = UIConfigMap[uiId];
        if (!config) {
            console.error(`UIManager: no config found for UIID ${uiId}`);
            return;
        }

        if (this._panels.has(uiId)) {
            if (uiId === UIID.MainPanel) {
                SfxManager.instance.playMenuBgm();
            }
            return;
        }

        const layerNode = this._layers.get(config.layer);
        if (!layerNode) {
            console.error(`UIManager: layer node not found for UILayer ${config.layer}`);
            return;
        }

        const panel = config.factory(layerNode);
        const node = panel.node;
        node.setSiblingIndex(layerNode.children.length - 1);

        let uiOpacity = node.getComponent(UIOpacity);
        if (!uiOpacity) {
            uiOpacity = node.addComponent(UIOpacity);
        }
        uiOpacity.opacity = 0;
        node.setScale(new Vec3(0.8, 0.8, 1));

        this._panels.set(uiId, node);

        const anim = this.getAnimConfig(uiId);

        tween(node)
            .to(anim.openDur, { scale: new Vec3(1, 1, 1) }, { easing: anim.openEase })
            .start();

        tween(uiOpacity)
            .to(anim.openDur, { opacity: 255 }, { easing: anim.openEase })
            .call(() => {
                if (config.layer === UILayer.Popup || config.layer === UILayer.Toast) {
                    SfxManager.instance.playUiClick(0.3);
                }
                if (onOpened) {
                    onOpened(node);
                }
            })
            .start();
    }

    public openImmediate(uiId: UIID, onOpened?: (node: Node) => void): void {
        if (uiId === UIID.MainPanel) {
            this.ensureGlobalHud();
            SfxManager.instance.playMenuBgm();
        }
        const config = UIConfigMap[uiId];
        if (!config) {
            console.error(`UIManager: no config found for UIID ${uiId}`);
            return;
        }

        const existing = this._panels.get(uiId);
        if (existing) {
            existing.setSiblingIndex((existing.parent?.children.length || 1) - 1);
            if (uiId === UIID.MainPanel) {
                SfxManager.instance.playMenuBgm();
            }
            onOpened?.(existing);
            return;
        }

        const layerNode = this._layers.get(config.layer);
        if (!layerNode) {
            console.error(`UIManager: layer node not found for UILayer ${config.layer}`);
            return;
        }

        const panel = config.factory(layerNode);
        const node = panel.node;
        node.setSiblingIndex(layerNode.children.length - 1);

        let uiOpacity = node.getComponent(UIOpacity);
        if (!uiOpacity) {
            uiOpacity = node.addComponent(UIOpacity);
        }
        uiOpacity.opacity = 255;
        node.setScale(new Vec3(1, 1, 1));

        this._panels.set(uiId, node);
        onOpened?.(node);
    }

    public close(uiId: UIID, onClosed?: () => void): void {
        const node = this._panels.get(uiId);
        if (!node) {
            onClosed?.();
            return;
        }

        const anim = this.getAnimConfig(uiId);
        const uiOpacity = node.getComponent(UIOpacity);

        tween(node)
            .to(anim.closeDur, { scale: new Vec3(0.8, 0.8, 1) }, { easing: anim.closeEase })
            .call(() => {
                node.destroy();
                this._panels.delete(uiId);
                onClosed?.();
            })
            .start();

        if (uiOpacity) {
            tween(uiOpacity)
                .to(anim.closeDur, { opacity: 0 }, { easing: anim.closeEase })
                .start();
        }
    }

    public closeAndOpen(closeId: UIID, openId: UIID, delayMs: number = 100): void {
        if (!this._panels.has(closeId)) {
            this.open(openId);
            return;
        }
        this.close(closeId, () => {
            this.scheduleOnce(() => {
                this.open(openId);
            }, delayMs / 1000);
        });
    }

    public closeSettlementPanels(onClosed?: () => void): void {
        const openSettlementIds = Array.from(SETTLEMENT_IDS).filter(uiId => this._panels.has(uiId));
        if (openSettlementIds.length === 0) {
            onClosed?.();
            return;
        }

        let remaining = openSettlementIds.length;
        const finishOne = () => {
            remaining--;
            if (remaining <= 0) {
                onClosed?.();
            }
        };

        openSettlementIds.forEach(uiId => this.close(uiId, finishOne));
    }

    public getPanel(uiId: UIID): Node | null {
        return this._panels.get(uiId) ?? null;
    }

    public isOpen(uiId: UIID): boolean {
        return this._panels.has(uiId);
    }

    private ensureGlobalHud(): void {
        const topLayer = this._layers.get(UILayer.TopHud);
        if (!topLayer) return;
        const existing = topLayer.getChildByName('GlobalHud');
        if (existing) {
            existing.active = true;
            existing.getComponent(GlobalHud)?.syncLayout();
            return;
        }

        const node = new Node('GlobalHud');
        node.layer = Layers.Enum.UI_2D;
        topLayer.addChild(node);
        node.addComponent(GlobalHud);
    }

    private getAnimConfig(uiId: UIID): { openDur: number; closeDur: number; openEase: TweenEasing; closeEase: TweenEasing } {
        if (uiId === UIID.MainPanel) {
            return { openDur: 0.25, closeDur: 0.15, openEase: 'quadOut', closeEase: 'quadIn' };
        }
        if (SETTLEMENT_IDS.has(uiId)) {
            return { openDur: 0.3, closeDur: 0.15, openEase: 'backOut', closeEase: 'quadIn' };
        }
        return { openDur: 0.2, closeDur: 0.12, openEase: 'backOut', closeEase: 'quadIn' };
    }

    onDestroy(): void {
        if (GameApp.uiManager === this) {
            GameApp.uiManager = null;
        }
    }
}
