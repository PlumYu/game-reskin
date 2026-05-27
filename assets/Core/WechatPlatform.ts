import { PlatformBase, AdCallback, InterstitialCallback, ShareCallback, RankResult, MenuButtonRect } from './PlatformBase';
import CloudSyncService from './CloudSyncService';
import { WECHAT_AD_CONFIG, WECHAT_ENABLE_CLOUD_SYNC } from './CloudConfig';

declare const wx: any;

type WechatAdConfig = {
    rewardVideoId?: string;
    bannerId?: string;
    interstitialId?: string;
};

export default class WechatPlatform extends PlatformBase {
    private rewardVideoAd: any = null;
    private bannerAd: any = null;
    private interstitialAd: any = null;
    private adConfig: WechatAdConfig = { ...WECHAT_AD_CONFIG };
    private token: string = '';
    private openID: string = '';
    private appId: string = '';
    private shareTime: number = 0;
    private shareCallback: ShareCallback | null = null;

    constructor() {
        super();
        this.readAppInfo();
        this.initShare();
        this.registerLifecycle();
        this.loadLocalAdConfig();
        this.initAds();
    }

    private getWx(): any | null {
        const root = globalThis as any;
        if (root.__rawWx) return root.__rawWx;
        if (root.wx) return root.wx;
        if (typeof wx !== 'undefined') return wx;
        return null;
    }

    private readAppInfo(): void {
        const wxApi = this.getWx();
        if (!wxApi || typeof wxApi.getAccountInfoSync !== 'function') return;

        try {
            const info = wxApi.getAccountInfoSync();
            this.appId = info?.miniProgram?.appId || '';
        } catch (e) {
            console.warn('[WechatPlatform] read app info failed', e);
        }
    }

    private initShare(): void {
        const wxApi = this.getWx();
        if (!wxApi) return;

        try {
            if (typeof wxApi.showShareMenu === 'function') {
                wxApi.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
            }
            if (typeof wxApi.onShareAppMessage === 'function') {
                wxApi.onShareAppMessage(() => ({
                    title: 'Niu Ma Xiao Xiao Qi',
                    imageUrl: '',
                }));
            }
        } catch (e) {
            console.warn('[WechatPlatform] initShare failed', e);
        }
    }

    private registerLifecycle(): void {
        const wxApi = this.getWx();
        if (!wxApi || typeof wxApi.onShow !== 'function') return;

        try {
            wxApi.onShow(() => {
                if (this.shareCallback && Date.now() - this.shareTime > 3000) {
                    this.shareCallback(true);
                    this.shareCallback = null;
                }
            });
        } catch (e) {
            console.warn('[WechatPlatform] registerLifecycle failed', e);
        }
    }

    private loadLocalAdConfig(): void {
        this.adConfig = {
            rewardVideoId: (WECHAT_AD_CONFIG.rewardVideoId || '').trim(),
            bannerId: (WECHAT_AD_CONFIG.bannerId || '').trim(),
            interstitialId: (WECHAT_AD_CONFIG.interstitialId || '').trim(),
        };
    }

    private initAds(): void {
        const wxApi = this.getWx();
        if (!wxApi) return;

        this.ensureRewardVideoAd();

        if (this.adConfig.interstitialId && typeof wxApi.createInterstitialAd === 'function') {
            try {
                this.interstitialAd = wxApi.createInterstitialAd({ adUnitId: this.adConfig.interstitialId });
            } catch (e) {
                this.interstitialAd = null;
                console.warn('[WechatPlatform] interstitial ad init failed', e);
            }
        }
    }

    private ensureRewardVideoAd(): any | null {
        if (this.rewardVideoAd) return this.rewardVideoAd;
        const wxApi = this.getWx();
        if (!this.adConfig.rewardVideoId || !wxApi || typeof wxApi.createRewardedVideoAd !== 'function') {
            return null;
        }

        try {
            this.rewardVideoAd = wxApi.createRewardedVideoAd({ adUnitId: this.adConfig.rewardVideoId });
            this.rewardVideoAd?.onError?.((e: any) => {
                console.warn('[WechatPlatform] reward video ad error', e);
            });
            const loadResult = this.rewardVideoAd?.load?.();
            if (loadResult && typeof loadResult.catch === 'function') {
                loadResult.catch((e: any) => console.warn('[WechatPlatform] reward video ad load failed', e));
            }
        } catch (e) {
            this.rewardVideoAd = null;
            console.warn('[WechatPlatform] reward video ad init failed', e);
        }
        return this.rewardVideoAd;
    }

    public async login(): Promise<void> {
        const wxApi = this.getWx();
        if (!wxApi || typeof wxApi.login !== 'function') {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            try {
                wxApi.login({
                    success: (res: any) => {
                        this.token = '';
                        this.openID = '';
                        if (res?.code) {
                            console.log('[WechatPlatform] wx.login succeeded; backend exchange is deferred');
                        }
                        resolve();
                    },
                    fail: (err: any) => {
                        console.warn('[WechatPlatform] wx.login failed; continue as local user', err);
                        resolve();
                    },
                });
            } catch (e) {
                console.warn('[WechatPlatform] wx.login error; continue as local user', e);
                resolve();
            }
        });
    }

    public share(callback: ShareCallback): void {
        const wxApi = this.getWx();
        if (!wxApi || typeof wxApi.shareAppMessage !== 'function') {
            callback(false);
            return;
        }

        this.shareCallback = callback;
        this.shareTime = Date.now();
        try {
            wxApi.shareAppMessage({
                title: 'Niu Ma Xiao Xiao Qi',
                imageUrl: '',
            });
        } catch (e) {
            console.warn('[WechatPlatform] share failed', e);
            callback(false);
            this.shareCallback = null;
        }
    }

    public watchAd(callback: AdCallback): void {
        const rewardVideoAd = this.ensureRewardVideoAd();
        if (!rewardVideoAd) {
            console.warn('[WechatPlatform] rewardVideoAd not configured');
            callback(false);
            return;
        }

        const onClose = (res: any) => {
            rewardVideoAd.offClose?.(onClose);
            callback(res?.isEnded !== false);
        };

        try {
            rewardVideoAd.onClose?.(onClose);
            const showResult = rewardVideoAd.show();
            if (showResult && typeof showResult.catch === 'function') {
                showResult.catch(() => {
                    const loadResult = rewardVideoAd.load?.();
                    if (loadResult && typeof loadResult.then === 'function') {
                        loadResult
                            .then(() => rewardVideoAd.show())
                            .catch(() => {
                                rewardVideoAd.offClose?.(onClose);
                                callback(false);
                            });
                        return;
                    }
                    rewardVideoAd.offClose?.(onClose);
                    callback(false);
                });
            }
        } catch (e) {
            console.warn('[WechatPlatform] reward video ad show failed', e);
            rewardVideoAd.offClose?.(onClose);
            callback(false);
        }
    }

    public showBannerAd(): void {
        if (!this.adConfig.bannerId) return;

        const wxApi = this.getWx();
        if (!wxApi || typeof wxApi.createBannerAd !== 'function') return;

        try {
            if (this.bannerAd) {
                this.bannerAd.show?.();
                return;
            }

            const info = typeof wxApi.getSystemInfoSync === 'function' ? wxApi.getSystemInfoSync() : {};
            const windowHeight = Number(info?.windowHeight) || 667;
            const windowWidth = Number(info?.windowWidth) || 375;
            this.bannerAd = wxApi.createBannerAd({
                adUnitId: this.adConfig.bannerId,
                style: { left: 0, top: windowHeight - 80, width: windowWidth },
            });
            this.bannerAd.show?.();
        } catch (e) {
            console.warn('[WechatPlatform] showBannerAd failed', e);
        }
    }

    public hideBannerAd(): void {
        try {
            this.bannerAd?.hide?.();
        } catch (e) {
            console.warn('[WechatPlatform] hideBannerAd failed', e);
        }
    }

    public showInterstitialAd(callback?: InterstitialCallback): void {
        if (!this.interstitialAd) {
            callback?.(false);
            return;
        }

        const hasCloseListener = typeof this.interstitialAd.onClose === 'function';
        let completed = false;
        let finish: (shown: boolean) => void = () => {};
        const onClose = () => finish(true);
        finish = (shown: boolean) => {
            if (completed) return;
            completed = true;
            if (hasCloseListener && typeof this.interstitialAd.offClose === 'function') {
                this.interstitialAd.offClose(onClose);
            }
            callback?.(shown);
        };
        if (hasCloseListener) {
            this.interstitialAd.onClose(onClose);
        }

        try {
            const showResult = this.interstitialAd.show();
            if (showResult && typeof showResult.catch === 'function') {
                showResult.then?.(() => {
                    if (!hasCloseListener) finish(true);
                });
                showResult.catch(() => finish(false));
                if (!hasCloseListener && typeof showResult.then !== 'function') {
                    finish(true);
                }
            } else if (!hasCloseListener) {
                finish(true);
            }
        } catch (e) {
            console.warn('[WechatPlatform] showInterstitialAd failed', e);
            finish(false);
        }
    }

    public isRewardAdAvailable(): boolean {
        const wxApi = this.getWx();
        return !!this.adConfig.rewardVideoId && !!wxApi && typeof wxApi.createRewardedVideoAd === 'function';
    }

    public isInterstitialAdAvailable(): boolean {
        return !!this.interstitialAd;
    }

    public submitScore(score: number): void {
        this.submitScoreForRank(0, score);
    }

    public submitScoreForRank(type: number, score: number, callback?: () => void): void {
        if (!WECHAT_ENABLE_CLOUD_SYNC) {
            console.log('[WechatPlatform] rank submit deferred for local WeChat build', { type, score });
            callback?.();
            return;
        }

        CloudSyncService.instance.submitRankByType(type, score)
            .then(() => callback?.())
            .catch((e) => {
                console.warn('[WechatPlatform] submitScoreForRank failed', e);
                callback?.();
            });
    }

    public vibrate(type: 'short' | 'long'): void {
        const wxApi = this.getWx();
        if (!wxApi) return;

        try {
            if (type === 'long' && typeof wxApi.vibrateLong === 'function') {
                wxApi.vibrateLong();
            } else if (typeof wxApi.vibrateShort === 'function') {
                wxApi.vibrateShort({ type: 'medium' });
            }
        } catch (e) {
            console.warn('[WechatPlatform] vibrate failed', e);
        }
    }

    public getPlatformName(): string {
        return 'wechat';
    }

    public getRankInfo(type: number, callback: (data: RankResult) => void): void {
        if (!WECHAT_ENABLE_CLOUD_SYNC) {
            callback(this.createEmptyRankResult('排行榜未启用'));
            return;
        }

        CloudSyncService.instance.getRankInfoByType(type).then((data) => {
            callback(data);
        }).catch((e) => {
            console.warn('[WechatPlatform] getRankInfo failed; return empty rank', e);
            callback(this.createEmptyRankResult('排行榜加载失败，请稍后重试'));
        });
    }

    public openNativeRankList(_type: number, callback?: (opened: boolean) => void): void {
        console.warn('[WechatPlatform] native rank list is deferred');
        callback?.(false);
    }

    public checkPrivacy(callback: (agreed: boolean) => void): void {
        const wxApi = this.getWx();
        if (!wxApi || typeof wxApi.getPrivacySetting !== 'function') {
            callback(true);
            return;
        }

        try {
            wxApi.getPrivacySetting({
                success: (res: any) => {
                    if (res.needAuthorization && typeof wxApi.openPrivacyContract === 'function') {
                        wxApi.openPrivacyContract({
                            success: () => callback(true),
                            fail: () => callback(false),
                        });
                    } else {
                        callback(true);
                    }
                },
                fail: () => callback(true),
            });
        } catch (e) {
            console.warn('[WechatPlatform] checkPrivacy failed', e);
            callback(true);
        }
    }

    public checkAntiAddiction(callback: (allowed: boolean) => void): void {
        callback(true);
    }

    public getMenuButtonBoundingClientRect(): MenuButtonRect | null {
        const wxApi = this.getWx();
        if (!wxApi || typeof wxApi.getMenuButtonBoundingClientRect !== 'function') {
            return null;
        }

        try {
            const rect = wxApi.getMenuButtonBoundingClientRect();
            if (!rect) return null;
            return {
                top: Number(rect.top) || 0,
                bottom: Number(rect.bottom) || 0,
                left: Number(rect.left) || 0,
                right: Number(rect.right) || 0,
                width: Number(rect.width) || 0,
                height: Number(rect.height) || 0,
            };
        } catch (e) {
            console.warn('[WechatPlatform] getMenuButtonBoundingClientRect failed', e);
            return null;
        }
    }

    private createEmptyRankResult(errorMessage: string = ''): RankResult {
        return {
            myRank: 0,
            myInfo: null,
            userList: [],
            errorMessage,
        };
    }
}
