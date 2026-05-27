import { view } from 'cc';
import { PlatformBase, AdCallback, InterstitialCallback, ShareCallback, RankResult, MenuButtonRect } from './PlatformBase';

export default class BrowserPlatform extends PlatformBase {
    private readonly previewCapsuleTop = 58;
    private readonly previewCapsuleRight = 10;
    private readonly previewCapsuleWidth = 88;
    private readonly previewCapsuleHeight = 32;

    public async login(): Promise<void> {
        return Promise.resolve();
    }

    public share(callback: ShareCallback): void {
        callback(false);
    }

    public watchAd(callback: AdCallback): void {
        callback(true);
    }

    public showBannerAd(): void {}

    public hideBannerAd(): void {}

    public showInterstitialAd(callback?: InterstitialCallback): void {
        callback?.(false);
    }

    public submitScore(_score: number): void {}

    public submitScoreForRank(_type: number, _score: number, callback?: () => void): void {
        callback?.();
    }

    public vibrate(_type: 'short' | 'long'): void {}

    public getPlatformName(): string {
        return 'browser';
    }

    public getRankInfo(_type: number, callback: (data: RankResult) => void): void {
        callback({
            myRank: 0,
            myInfo: null,
            userList: [],
        });
    }

    public openNativeRankList(_type: number, callback?: (opened: boolean) => void): void {
        callback?.(false);
    }

    public checkPrivacy(callback: (agreed: boolean) => void): void {
        callback(true);
    }

    public checkAntiAddiction(callback: (allowed: boolean) => void): void {
        callback(true);
    }

    public getMenuButtonBoundingClientRect(): MenuButtonRect | null {
        const frame = view.getFrameSize?.();
        const frameWidth = Math.max(1, frame?.width || 390);
        const width = Math.min(this.previewCapsuleWidth, Math.max(72, Math.round(frameWidth * 0.22)));
        const height = this.previewCapsuleHeight;
        const right = Math.max(width, frameWidth - this.previewCapsuleRight);
        const left = right - width;
        const top = this.previewCapsuleTop;

        return {
            top,
            bottom: top + height,
            left,
            right,
            width,
            height,
        };
    }

    public isRewardAdAvailable(): boolean {
        return true;
    }
}
