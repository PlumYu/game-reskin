import {
    Node,
    Label,
    Sprite,
    SpriteFrame,
    Texture2D,
    ImageAsset,
    Graphics,
    UITransform,
    Color,
    Size,
    Widget,
    Layers,
    view,
    BlockInputEvents,
    tween,
    UIOpacity,
    v3,
} from 'cc';

let _whiteSF: SpriteFrame | null = null;

function getWhiteSpriteFrame(): SpriteFrame {
    if (_whiteSF) return _whiteSF;
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 2, 2);
    const img = new ImageAsset(canvas);
    const tex = new Texture2D();
    tex.image = img;
    _whiteSF = new SpriteFrame();
    _whiteSF.texture = tex;
    return _whiteSF;
}

export function createNode(name: string, parent: Node): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.addComponent(UITransform);
    parent.addChild(node);
    return node;
}

export function getScreenSize(): Size {
    return view.getVisibleSize();
}

export function createLabel(
    name: string,
    parent: Node,
    text: string,
    fontSize: number,
    color: Color,
    isBold: boolean = false,
): Label {
    const node = createNode(name, parent);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.4);
    label.color = color;
    label.isBold = isBold;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.NONE;
    return label;
}

export function createSprite(name: string, parent: Node, color: Color, size: Size): Sprite {
    const node = createNode(name, parent);
    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = getWhiteSpriteFrame();
    sprite.color = color;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const ut = node.getComponent(UITransform)!;
    ut.setContentSize(size);
    return sprite;
}

export function createFullScreenOverlay(name: string, parent: Node, color: Color, alpha: number): Node {
    const screenSize = getScreenSize();
    const node = createNode(name, parent);
    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = getWhiteSpriteFrame();
    sprite.color = new Color(color.r, color.g, color.b, alpha);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const ut = node.getComponent(UITransform)!;
    ut.setContentSize(screenSize);
    node.addComponent(BlockInputEvents);
    return node;
}

export function createButton(
    name: string,
    parent: Node,
    text: string,
    width: number,
    height: number,
    bgColor: Color,
    textColor: Color,
    fontSize: number = 24,
): { node: Node; label: Label } {
    const node = createNode(name, parent);
    const ut = node.getComponent(UITransform)!;
    ut.setContentSize(new Size(width, height));

    const bg = createSprite('bg', node, bgColor, new Size(width, height));
    bg.node.setPosition(0, 0, 0);

    const label = createLabel('label', node, text, fontSize, textColor, true);
    label.node.getComponent(UITransform)!.setContentSize(new Size(width - 20, height));

    addButtonFeedback(node);
    return { node, label };
}

export const COLOR_DEEP_NAVY = new Color(26, 26, 46, 255);
export const COLOR_DARK_BLUE = new Color(22, 33, 62, 255);
export const COLOR_GOLD = new Color(232, 184, 75, 255);
export const COLOR_WHITE = new Color(255, 255, 255, 255);
export const COLOR_RED = new Color(224, 82, 82, 255);
export const COLOR_GRAY = new Color(160, 160, 160, 255);
export const COLOR_LIGHT_GRAY = new Color(192, 192, 192, 255);
export const COLOR_BLACK = new Color(0, 0, 0, 255);
export const COLOR_PURPLE = new Color(45, 27, 105, 255);
export const COLOR_AD_BLUE = new Color(68, 132, 232, 255);
export const COLOR_TEAL = new Color(50, 160, 130, 255);
export const COLOR_STAMINA = new Color(255, 180, 30, 255);
export const COLOR_SURFACE_LIGHT = new Color(255, 255, 255, 200);
export const COLOR_TITLE_NAVY = new Color(42, 62, 100, 255);
export const COLOR_TOGGLE_BLUE = new Color(68, 132, 232, 255);
export const COLOR_TOGGLE_GRAY = new Color(200, 200, 210, 255);
export const COLOR_SETTING_BG = new Color(255, 255, 255, 255);
export const COLOR_DIVIDER = new Color(220, 220, 230, 255);
export const COLOR_DESC_GRAY = new Color(140, 140, 150, 255);
export const COLOR_TOOLBAR_BG = new Color(255, 255, 255, 180);

// ---- Design Tokens: Font Size ----
export const FONT_HERO = 56;
export const FONT_TITLE = 36;
export const FONT_HEADING = 32;
export const FONT_SUBTITLE = 26;
export const FONT_BUTTON = 24;
export const FONT_BODY = 20;
export const FONT_CAPTION = 18;
export const FONT_SMALL = 14;

// ---- Design Tokens: Spacing ----
export const SPACING_XS = 8;
export const SPACING_SM = 16;
export const SPACING_MD = 32;
export const SPACING_LG = 50;
export const SPACING_XL = 80;

// ---- Design Tokens: Border Radius ----
export const RADIUS_XS = 6;
export const RADIUS_SM = 10;
export const RADIUS_MD = 16;
export const RADIUS_LG = 20;
export const RADIUS_XL = 24;
export const RADIUS_PILL = 28;
export const RADIUS_FULL = 36;

// ---- Design Tokens: Layout Ratio ----
export const LAYOUT_CARD_WIDTH_RATIO = 0.85;
export const LAYOUT_CONTENT_WIDTH_RATIO = 0.7;

export function createCircle(name: string, parent: Node, radius: number, color: Color, alpha: number): Node {
    const node = createNode(name, parent);
    const g = node.addComponent(Graphics);
    g.fillColor = new Color(color.r, color.g, color.b, alpha);
    g.circle(0, 0, radius);
    g.fill();
    return node;
}

export function createRoundedButton(
    name: string,
    parent: Node,
    text: string,
    width: number,
    height: number,
    bgColor: Color,
    textColor: Color,
    fontSize: number = 24,
    radius: number = 16,
): { node: Node; label: Label } {
    const node = createNode(name, parent);
    const ut = node.getComponent(UITransform)!;
    ut.setContentSize(new Size(width, height));

    const g = node.addComponent(Graphics);
    g.fillColor = bgColor;
    g.roundRect(-width / 2, -height / 2, width, height, radius);
    g.fill();

    const label = createLabel('label', node, text, fontSize, textColor, true);
    label.node.getComponent(UITransform)!.setContentSize(new Size(width - 20, height));

    addButtonFeedback(node);
    return { node, label };
}

export function createAdButton(
    name: string,
    parent: Node,
    rewardText: string,
    width: number,
    height: number,
): { node: Node; label: Label } {
    const text = `▶ 看广告 ${rewardText}`;
    const radius = Math.round(height / 2);
    return createRoundedButton(name, parent, text, width, height, COLOR_AD_BLUE, COLOR_WHITE, 22, radius);
}

export function showToast(parent: Node, text: string): void {
    const existing = parent.getChildByName('toast');
    if (existing) existing.destroy();
    const toast = createNode('toast', parent);
    const screenSize = getScreenSize();
    toast.setPosition(0, -screenSize.height / 2 + 200, 0);
    const g = toast.addComponent(Graphics);
    g.fillColor = new Color(0, 0, 0, 180);
    g.roundRect(-150, -26, 300, 52, 26);
    g.fill();
    const lbl = createLabel('toastLabel', toast, text, 18, COLOR_WHITE);
    lbl.node.getComponent(UITransform)!.setContentSize(new Size(280, 40));
    toast.setScale(v3(0.8, 0.8, 1));
    tween(toast)
        .to(0.2, { scale: v3(1, 1, 1) }, { easing: 'backOut' })
        .delay(1.5)
        .to(0.3, { scale: v3(0, 0, 1) })
        .call(() => { if (toast.isValid) toast.destroy(); })
        .start();
}

// ---- Button Touch Feedback ----
export function addButtonFeedback(node: Node): void {
    node.on(Node.EventType.TOUCH_START, () => {
        tween(node).to(0.1, { scale: v3(0.9, 0.9, 1) }).start();
    });
    node.on(Node.EventType.TOUCH_END, () => {
        tween(node).to(0.1, { scale: v3(1, 1, 1) }).start();
    });
    node.on(Node.EventType.TOUCH_CANCEL, () => {
        tween(node).to(0.1, { scale: v3(1, 1, 1) }).start();
    });
}

export function createRoundedCard(
    name: string,
    parent: Node,
    width: number,
    height: number,
    bgColor: Color = COLOR_DARK_BLUE,
    radius: number = RADIUS_XL,
    shadowOffset: number = 3,
    shadowAlpha: number = 30,
): Node {
    const node = createNode(name, parent);
    const ut = node.getComponent(UITransform)!;
    ut.setContentSize(new Size(width, height));

    const g = node.addComponent(Graphics);
    g.fillColor = new Color(0, 0, 0, shadowAlpha);
    g.roundRect(
        -width / 2 - shadowOffset,
        -height / 2 - shadowOffset,
        width + shadowOffset * 2,
        height + shadowOffset * 2,
        radius + 2,
    );
    g.fill();
    g.fillColor = bgColor;
    g.roundRect(-width / 2, -height / 2, width, height, radius);
    g.fill();

    return node;
}

export function animateNumber(
    label: Label,
    from: number,
    to: number,
    duration: number = 0.8,
    prefix: string = '',
    suffix: string = '',
    onComplete?: () => void,
): void {
    const obj = { value: from };
    tween(obj)
        .to(duration, { value: to }, {
            onUpdate: () => {
                label.string = `${prefix}${Math.floor(obj.value)}${suffix}`;
            },
            easing: 'quartOut',
        })
        .call(() => {
            onComplete?.();
        })
        .start();
}

export function staggerEntrance(
    elements: Node[],
    staggerDelay: number = 0.12,
    duration: number = 0.3,
    offsetY: number = 30,
): void {
    elements.forEach((el, i) => {
        const origX = el.position.x;
        const origY = el.position.y;
        el.setPosition(origX, origY - offsetY, 0);
        const opComp = el.getComponent(UIOpacity) || el.addComponent(UIOpacity);
        opComp.opacity = 0;

        tween(el)
            .delay(i * staggerDelay)
            .to(duration, { position: v3(origX, origY, 0) }, { easing: 'backOut' })
            .start();

        tween(opComp)
            .delay(i * staggerDelay)
            .to(duration, { opacity: 255 })
            .start();
    });
}
