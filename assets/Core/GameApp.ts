import { sys } from 'cc';
import { GameMode, UIID } from './Enum';
import { PlatformBase } from './PlatformBase';
import { CloudBackend } from './CloudBackend';
import BrowserPlatform from './BrowserPlatform';
import { WECHAT_ENABLE_CLOUD_SYNC } from './CloudConfig';
import CloudSyncService from './CloudSyncService';
import TiliManager from './TiliManager';
import UIManager from './UIManager';
import UserData from './UserData';
import WechatCloudBackend from './WechatCloudBackend';
import WechatPlatform from './WechatPlatform';
import PerfDebug from '../Utils/PerfDebug';

class GameAppManager {
    private readonly privacyStorageKey = 'find_the_cow_privacy_agreed_v1';
    private pendingPlatformBootstrap: (() => void) | null = null;
    public isInited = false;
    public starting = false;
    public playerId = 1;
    public gameStartTime = 0;
    public needShop = false;
    public isOnLine = true;
    public isReStartNoTiLi = false;
    public isStartGame = false;
    public drawGrid: unknown = null;
    public tiliManager: TiliManager | null = null;
    public popupIndex = 0;
    public gameMode = GameMode.level;
    public useTime = 0;
    public passLevel = 0;
    public foundCowNum = 0;
    public survivalReviveTime = 1;
    public survivalIsWin: boolean = false;
    public survivalSettlementPassLevel = 0;
    public survivalSettlementFoundCowNum = 0;
    public survivalSettlementUseTime = 0;
    public survivalSettlementStaminaReward = 0;
    public dailyChallengeIsWin: boolean = false;
    public dailyChallengeReviveTime: number = 1;
    public winRewardCoins: number = 4;
    public isGuideSettlement: boolean = false;
    public countDownControl: unknown = null;
    public uiManager: UIManager | null = null;
    public globalHud: unknown = null;
    public platform!: PlatformBase;
    public cloudSync: CloudSyncService = CloudSyncService.instance;
    public platformReady: boolean = false;
    public privacyPromptMessage = '进入游戏前，请先阅读并同意隐私说明。';
    public antiAddictionMessage = '当前账号处于平台限制状态，暂时无法继续游戏。';

    public init() {
        if (this.isInited) {
            return;
        }

        PerfDebug.begin('GameApp.init');
        const user = UserData.instance;
        user.decode();
        if (user.date !== user.day) {
            user.newDate();
        }

        this.foundCowNum = user.foundCowNum;
        this.initPlatform();
        this.isInited = true;
        PerfDebug.end('GameApp.init', {
            level: user.level,
            firstGame: user.firstGame,
            stamina: user.stamina,
            coin: user.coin,
        });
    }

    private initPlatform(): void {
        const onPlatformLoaded = (platform: PlatformBase) => {
            this.platform = platform;
            PerfDebug.mark('platform detected', { name: platform.getPlatformName() });
            console.log('[GameApp] platform loaded:', platform.getPlatformName());
            const continueBootstrap = () => {
                PerfDebug.begin('platform bootstrap');
                platform.checkPrivacy((agreed) => {
                    PerfDebug.mark('platform privacy result', { agreed });
                    console.log('[GameApp] privacy check result:', agreed);
                    if (!agreed) {
                        this.platformReady = false;
                        this.pendingPlatformBootstrap = continueBootstrap;
                        this.privacyPromptMessage = '需要先完成隐私授权，才能继续进入游戏。';
                        this.showPrivacyPanel();
                        return;
                    }

                    platform.checkAntiAddiction((allowed) => {
                        PerfDebug.mark('platform anti addiction result', { allowed });
                        console.log('[GameApp] anti-addiction check result:', allowed);
                        if (!allowed) {
                            this.platformReady = false;
                            this.antiAddictionMessage = '当前账号处于防沉迷限制状态，暂时无法继续游戏，请稍后再试。';
                            this.showAntiAddictionPanel();
                            return;
                        }

                        platform.login().then(async () => {
                            const platformName = platform.getPlatformName();
                            if (!this.shouldBootstrapCloud(platformName)) {
                                this.platformReady = true;
                                PerfDebug.end('platform bootstrap', { ready: true, localOnly: true, platform: platformName });
                                console.log('[GameApp] platform ready without cloud sync:', platformName);
                                return;
                            }

                            try {
                                console.log('[GameApp] cloud bootstrap begin:', platformName);
                                this.cloudSync.configure(this.createCloudBackend(platformName));
                                await this.cloudSync.bootstrap(UserData.instance);
                                this.platformReady = true;
                                PerfDebug.end('platform bootstrap', { ready: true, cloud: true });
                                console.log('[GameApp] platform ready');
                            } catch (e) {
                                if (platformName === 'wechat') {
                                    console.warn('[GameApp] wechat cloud bootstrap skipped, using local save', e);
                                    this.platformReady = true;
                                    PerfDebug.end('platform bootstrap', { ready: true, cloud: false, fallback: true });
                                    return;
                                }
                                throw e;
                            }
                        }).catch((e) => {
                            console.error('[GameApp] platform bootstrap failed', e);
                            this.platformReady = false;
                            PerfDebug.end('platform bootstrap', { ready: false, failed: true });
                            throw e;
                        });
                    });
                });
            };

            this.pendingPlatformBootstrap = continueBootstrap;
            if (this.requiresLocalPrivacyGate()) {
                this.showPrivacyPanel();
                return;
            }

            continueBootstrap();
        };

        if (typeof (globalThis as any).wx !== 'undefined') {
            console.log('[GameApp] using WechatPlatform');
            onPlatformLoaded(new WechatPlatform());
        } else {
            console.log('[GameApp] no wx detected, using BrowserPlatform preview');
            onPlatformLoaded(new BrowserPlatform());
        }
    }

    private shouldBootstrapCloud(platformName: string): boolean {
        if (platformName === 'browser') {
            return false;
        }
        if (platformName === 'wechat') {
            return WECHAT_ENABLE_CLOUD_SYNC;
        }
        return true;
    }

    private createCloudBackend(platformName: string): CloudBackend {
        if (platformName === 'wechat') {
            return new WechatCloudBackend();
        }
        throw new Error(`[GameApp] unsupported cloud backend platform: ${platformName}`);
    }

    public get user(): UserData {
        this.init();
        return UserData.instance;
    }

    public getSurvivalStaminaReward(passLevel: number): number {
        const round = Math.max(0, Math.floor(passLevel || 0));
        switch (round) {
            case 0:
            case 1:
                return 2;
            case 2:
            case 3:
                return 5;
            case 4:
            case 5:
                return 8;
            case 6:
            case 7:
                return 12;
            case 8:
                return 15;
            case 9:
                return 20;
            default:
                return 30;
        }
    }

    public acceptPrivacyAgreement(): void {
        sys.localStorage.setItem(this.privacyStorageKey, '1');
        this.uiManager?.close(UIID.PrivacyPanel);
        const pending = this.pendingPlatformBootstrap;
        this.pendingPlatformBootstrap = null;
        pending?.();
    }

    public refusePrivacyAgreement(): void {
        this.platformReady = false;
    }

    private requiresLocalPrivacyGate(): boolean {
        return false;
    }

    private showPrivacyPanel(): void {
        if (!this.uiManager || this.uiManager.isOpen(UIID.PrivacyPanel)) {
            return;
        }
        this.uiManager.open(UIID.PrivacyPanel);
    }

    private showAntiAddictionPanel(): void {
        if (!this.uiManager || this.uiManager.isOpen(UIID.AntiAddictionPanel)) {
            return;
        }
        this.uiManager.open(UIID.AntiAddictionPanel);
    }
}

const GameApp = new GameAppManager();

export { GameApp };
export default GameApp;
