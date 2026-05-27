import { view } from 'cc';
import GameApp from '../Core/GameApp';
import type { MenuButtonRect } from '../Core/PlatformBase';

export type LayoutMenuButtonRect = MenuButtonRect & {
    centerX: number;
    centerY: number;
    topInset: number;
    bottomInset: number;
};

export type AdaptiveLayout = {
    width: number;
    height: number;
    contentWidth: number;
    contentLeft: number;
    contentRight: number;
    centerX: number;
    scale: number;
    safeTop: number;
    safeBottom: number;
    topY: number;
    bottomY: number;
    topRowY: number;
    secondTopRowY: number;
    bottomActionY: number;
    menuButtonRect: LayoutMenuButtonRect | null;
};

type LayoutOptions = {
    designWidth?: number;
    maxContentWidth?: number;
    minScale?: number;
    maxScale?: number;
    topRowDrop?: number;
    topRowGap?: number;
    bottomActionMargin?: number;
};

type PanelLayoutOptions = {
    layout?: AdaptiveLayout;
    horizontalMargin?: number;
    topMargin?: number;
    bottomMargin?: number;
    preferredY?: number;
    minScale?: number;
    maxScale?: number;
};

export type AdaptivePanelLayout = {
    layout: AdaptiveLayout;
    scale: number;
    width: number;
    height: number;
    y: number;
};

const DEFAULT_DESIGN_WIDTH = 750;
const DEFAULT_MAX_CONTENT_WIDTH = 750;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function getViewSize(): { width: number; height: number } {
    const visible = view.getVisibleSize();
    return {
        width: Math.max(1, visible.width || DEFAULT_DESIGN_WIDTH),
        height: Math.max(1, visible.height || 1334),
    };
}

function getSafeInsets(width: number, height: number): { safeTop: number; safeBottom: number } {
    const safeGetter = (view as unknown as { getSafeAreaRect?: () => { x: number; y: number; width: number; height: number } }).getSafeAreaRect;
    const rect = safeGetter?.call(view);
    if (!rect) {
        return { safeTop: 0, safeBottom: 0 };
    }

    const frame = view.getFrameSize?.();
    const scaleX = frame?.width ? width / frame.width : 1;
    const scaleY = frame?.height ? height / frame.height : 1;
    const looksLikeFrameUnits = rect.width > width * 1.5 || rect.height > height * 1.5;
    const y = looksLikeFrameUnits ? rect.y * scaleY : rect.y;
    const safeHeight = looksLikeFrameUnits ? rect.height * scaleY : rect.height;

    return {
        safeTop: Math.max(0, height - y - safeHeight),
        safeBottom: Math.max(0, y),
    };
}

function getMenuButtonRect(width: number, height: number): LayoutMenuButtonRect | null {
    const rect = GameApp.platform?.getMenuButtonBoundingClientRect?.();
    if (!rect || typeof rect.bottom !== 'number' || typeof rect.right !== 'number') {
        return null;
    }

    const frame = view.getFrameSize?.();
    const scaleX = frame?.width ? width / frame.width : 1;
    const scaleY = frame?.height ? height / frame.height : 1;
    const leftInset = Math.max(0, rect.left || 0) * scaleX;
    const rightInset = Math.max(0, rect.right || 0) * scaleX;
    const topInset = Math.max(0, rect.top || 0) * scaleY;
    const bottomInset = Math.max(0, rect.bottom || 0) * scaleY;
    const menuWidth = Math.max(0, rect.width || Math.max(0, rect.right - rect.left)) * scaleX;
    const menuHeight = Math.max(0, rect.height || Math.max(0, rect.bottom - rect.top)) * scaleY;
    const left = -width / 2 + leftInset;
    const right = -width / 2 + rightInset;
    const top = height / 2 - topInset;
    const bottom = height / 2 - bottomInset;

    return {
        left,
        right,
        top,
        bottom,
        width: menuWidth,
        height: menuHeight,
        centerX: (left + right) / 2,
        centerY: (top + bottom) / 2,
        topInset,
        bottomInset,
    };
}

export function getAdaptiveLayout(options: LayoutOptions = {}): AdaptiveLayout {
    const { width, height } = getViewSize();
    const designWidth = options.designWidth ?? DEFAULT_DESIGN_WIDTH;
    const maxContentWidth = options.maxContentWidth ?? DEFAULT_MAX_CONTENT_WIDTH;
    const contentWidth = Math.min(width, maxContentWidth);
    const scale = clamp(contentWidth / Math.max(1, designWidth), options.minScale ?? 0.88, options.maxScale ?? 1.08);
    const contentLeft = -contentWidth / 2;
    const contentRight = contentWidth / 2;
    const menuButtonRect = getMenuButtonRect(width, height);
    const insets = getSafeInsets(width, height);
    const safeTop = menuButtonRect
        ? Math.max(insets.safeTop, menuButtonRect.bottomInset + 12 * scale)
        : insets.safeTop;
    const safeBottom = insets.safeBottom;
    const topY = height / 2 - safeTop;
    const bottomY = -height / 2 + safeBottom;
    const topRowY = menuButtonRect?.centerY ?? topY - scaleLayout(options.topRowDrop ?? 60, { scale });
    const topRowGap = scaleLayout(options.topRowGap ?? 56, { scale });
    const bottomActionY = bottomY + scaleLayout(options.bottomActionMargin ?? 96, { scale });

    return {
        width,
        height,
        contentWidth,
        contentLeft,
        contentRight,
        centerX: 0,
        scale,
        safeTop,
        safeBottom,
        topY,
        bottomY,
        topRowY,
        secondTopRowY: topRowY - topRowGap,
        bottomActionY,
        menuButtonRect,
    };
}

export function scaleLayout(value: number, layout: Pick<AdaptiveLayout, 'scale'>): number {
    return Math.round(value * layout.scale);
}

export function getAdaptivePanelLayout(baseWidth: number, baseHeight: number, options: PanelLayoutOptions = {}): AdaptivePanelLayout {
    const layout = options.layout ?? getAdaptiveLayout();
    const horizontalMargin = scaleLayout(options.horizontalMargin ?? 48, layout);
    const topMargin = scaleLayout(options.topMargin ?? 96, layout);
    const bottomMargin = scaleLayout(options.bottomMargin ?? 88, layout);
    const availableWidth = Math.max(1, layout.contentWidth - horizontalMargin * 2);
    const availableHeight = Math.max(1, layout.topY - layout.bottomY - topMargin - bottomMargin);
    const maxScale = options.maxScale ?? 1.04;
    const rawScale = Math.min(layout.scale, maxScale, availableWidth / Math.max(1, baseWidth), availableHeight / Math.max(1, baseHeight));
    const minScale = Math.min(options.minScale ?? 0.82, rawScale);
    const scale = clamp(rawScale, minScale, maxScale);
    const width = Math.round(baseWidth * scale);
    const height = Math.round(baseHeight * scale);
    const minY = layout.bottomY + bottomMargin + height / 2;
    const maxY = layout.topY - topMargin - height / 2;
    const preferredY = scaleLayout(options.preferredY ?? 0, { scale });
    const y = minY <= maxY
        ? clamp(preferredY, minY, maxY)
        : (minY + maxY) / 2;

    return {
        layout,
        scale,
        width,
        height,
        y,
    };
}
