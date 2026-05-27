import GameApp from './GameApp';

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
        this.rewardRequesting = true;
        try {
            GameApp.platform.watchAd((rewarded) => {
                this.rewardRequesting = false;
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
}

export default new RewardService();
