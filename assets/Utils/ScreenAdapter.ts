import { _decorator, Component, view, ResolutionPolicy, screen, sys } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ScreenAdapter')
export class ScreenAdapter extends Component {

    onLoad() {
        // 初始化适配
        this.adjustResolutionPolicy();

        // 监听屏幕尺寸变化（主要用于PC端窗口大小改变时）
        view.setResizeCallback(() => {
            this.adjustResolutionPolicy();
        });
    }

    /**
     * 根据屏幕宽高比动态调整适配策略
     */
    adjustResolutionPolicy() {
        // 获取设计分辨率
        const designSize = view.getDesignResolutionSize();
        // 获取当前屏幕（窗口）尺寸
        const frameSize = view.getFrameSize();

        const designRatio = designSize.width / designSize.height;
        const frameRatio = frameSize.width / frameSize.height;

        // 核心逻辑：保证内容能够完整显示或者填满屏幕
        // 这里采用的策略是：
        // 1. 如果屏幕比设计分辨率更宽（如PC宽屏），则固定高度 (FIXED_HEIGHT)，让宽度自适应（视野变宽）
        // 2. 如果屏幕比设计分辨率更窄（如手机竖屏），则固定宽度 (FIXED_WIDTH)，让高度自适应（视野变高）

        if (frameRatio > designRatio) {
            view.setResolutionPolicy(ResolutionPolicy.FIXED_HEIGHT);
        } else {
            view.setResolutionPolicy(ResolutionPolicy.FIXED_WIDTH);
        }

        // 打印日志方便调试
        console.log(`[ScreenAdapter] Frame: ${frameSize.width}x${frameSize.height}, Ratio: ${frameRatio.toFixed(2)}. Policy: ${frameRatio > designRatio ? 'FIXED_HEIGHT' : 'FIXED_WIDTH'}`);
    }

    /**
     * 示例：判断当前运行平台
     */
    checkPlatform() {
        if (sys.isMobile) {
            console.log("当前是移动端环境");
            // 可以在这里开启移动端特有的逻辑，比如显示虚拟摇杆
        } else {
            console.log("当前是PC/桌面端环境");
            // 可以在这里开启PC端特有的逻辑，比如键盘监听
        }
    }
}
