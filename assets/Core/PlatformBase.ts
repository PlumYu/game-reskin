export type AdCallback = (rewarded: boolean) => void;
export type InterstitialCallback = (shown: boolean) => void;
export type ShareCallback = (success: boolean) => void;

export interface RankItem {
    rank: number;
    name: string;
    score: number;
    isMe?: boolean;
}

export interface RankResult {
    myRank: number;
    myInfo: RankItem | null;
    userList: RankItem[];
    errorMessage?: string;
}

export interface MenuButtonRect {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
}

export abstract class PlatformBase {
    public abstract login(): Promise<void>;
    public abstract share(callback: ShareCallback): void;
    public abstract watchAd(callback: AdCallback): void;
    public abstract showBannerAd(): void;
    public abstract hideBannerAd(): void;
    public abstract showInterstitialAd(callback?: InterstitialCallback): void;
    public abstract submitScore(score: number): void;
    public abstract submitScoreForRank(type: number, score: number, callback?: () => void): void;
    public abstract vibrate(type: 'short' | 'long'): void;
    public abstract getPlatformName(): string;
    public abstract getRankInfo(type: number, callback: (data: RankResult) => void): void;
    public abstract openNativeRankList(type: number, callback?: (opened: boolean) => void): void;
    public abstract checkPrivacy(callback: (agreed: boolean) => void): void;
    public abstract checkAntiAddiction(callback: (allowed: boolean) => void): void;
    public abstract getMenuButtonBoundingClientRect(): MenuButtonRect | null;

    public isRewardAdAvailable(): boolean {
        return true;
    }

    public isInterstitialAdAvailable(): boolean {
        return true;
    }
}
