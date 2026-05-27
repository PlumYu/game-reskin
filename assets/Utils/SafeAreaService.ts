import { view } from 'cc';
import GameApp from '../Core/GameApp';

export function getSafeTopInset(screenHeight: number): number {
    const safeGetter = (view as unknown as { getSafeAreaRect?: () => { y: number; height: number } }).getSafeAreaRect;
    const rect = safeGetter?.call(view);
    const systemSafeTop = rect ? Math.max(0, screenHeight - rect.y - rect.height) : 0;
    const menuRect = GameApp.platform?.getMenuButtonBoundingClientRect?.();
    if (!menuRect) return systemSafeTop;

    const frameHeight = view.getFrameSize?.().height || screenHeight;
    const scaleY = frameHeight > 0 ? screenHeight / frameHeight : 1;
    return Math.max(systemSafeTop, Math.ceil(menuRect.bottom * scaleY + 12));
}

