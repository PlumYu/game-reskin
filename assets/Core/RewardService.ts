import GameApp from './GameApp';
import { showToast } from '../Utils/UIBuilder';

export type RewardCallback = (rewarded: boolean) => void;

export type InterstitialRequestOptions = {
    scene: string;
    onShown?: () => void;
    onSkipped?: () => void;
};

class RewardService {
    private rewardRequesting = false;
    private interstitialRequesting = false;

    public requestReward(callback: RewardCallback): void {
        if (this.rewardRequesting) {
            this.showRewardNotice('广告正在加载，请稍候');
            return;
        }

        if (!this.isRewardAdAvailable()) {
            console.warn('[RewardService] reward ad unavailable, use free fallback');
            callback(true);
            return;
        }

        this.rewardRequesting = true;
        try {
            GameApp.platform.watchAd((rewarded) => {
                this.rewardRequesting = false;
                if (!rewarded) {
                    this.showRewardNotice('广告暂不可用，请稍后再试');
                }
                callback(rewarded);
            });
        } catch (error) {
            this.rewardRequesting = false;
            throw error;
        }
    }

    public isRewardAdAvailable(): boolean {
        return GameApp.platform.isRewardAdAvailable();
    }

    public isRewardAdPlaying(): boolean {
        return this.rewardRequesting;
    }

    public requestInterstitial(options: InterstitialRequestOptions): boolean {
        if (this.interstitialRequesting) {
            options.onSkipped?.();
            return false;
        }

        if (!this.isInterstitialAdAvailable()) {
            options.onSkipped?.();
            return false;
        }

        this.interstitialRequesting = true;
        try {
            let completed = false;
            GameApp.platform.showInterstitialAd((shown) => {
                if (completed) return;
                completed = true;
                this.interstitialRequesting = false;
                if (shown) {
                    options.onShown?.();
                } else {
                    options.onSkipped?.();
                }
            });
        } catch (error) {
            console.warn(`[RewardService] interstitial ad failed: ${options.scene}`, error);
            this.interstitialRequesting = false;
            options.onSkipped?.();
        }

        return true;
    }

    public isInterstitialAdAvailable(): boolean {
        return !!GameApp.platform?.isInterstitialAdAvailable?.();
    }

    private showRewardNotice(text: string): void {
        const root = GameApp.uiManager?.node;
        if (root?.isValid) {
            showToast(root, text);
            return;
        }
        console.warn(`[RewardService] ${text}`);
    }
}

export default new RewardService();
