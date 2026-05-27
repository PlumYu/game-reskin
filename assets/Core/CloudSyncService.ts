import { CloudBackend, CloudSaveRecord, RankMetric } from './CloudBackend';
import type { RankResult } from './PlatformBase';
import UserData, { type UserDataPayload } from './UserData';

const CLOUD_SAVE_DELAY_MS = 3500;

export default class CloudSyncService {
    private static _instance: CloudSyncService | null = null;
    private backend: CloudBackend | null = null;
    private user: UserData | null = null;
    private saveTimer: number | null = null;
    private bootstrapped = false;
    private flushing = false;
    private currentRevision = 0;

    public static get instance(): CloudSyncService {
        if (!this._instance) {
            this._instance = new CloudSyncService();
        }
        return this._instance;
    }

    public configure(backend: CloudBackend): void {
        this.backend = backend;
        this.bootstrapped = false;
        this.currentRevision = 0;
        this.clearTimer();
    }

    public async bootstrap(user: UserData): Promise<void> {
        this.user = user;
        user.addSaveListener(this.queueSave);

        const backend = this.requireBackend();
        await backend.init();
        const cloudUser = await backend.login();
        if (!cloudUser || !backend.isAvailable()) {
            throw new Error('[CloudSyncService] cloud backend login failed');
        }

        const remote = await backend.loadSave();
        if (remote?.data) {
            const merged = CloudSyncService.mergePayloads(user.toPayload(), remote.data);
            this.currentRevision = Math.max(0, Math.floor(remote.revision || 0));
            user.applyPayloadData(merged, true);
        }

        this.bootstrapped = true;
        await this.flushNow();
        await this.submitCoreRanks(user);
    }

    public queueSave = (): void => {
        if (!this.bootstrapped || !this.backend?.isAvailable()) {
            return;
        }

        this.clearTimer();
        this.saveTimer = setTimeout(() => {
            this.flushNow();
        }, CLOUD_SAVE_DELAY_MS) as unknown as number;
    };

    public async flushNow(): Promise<void> {
        if (!this.user || !this.bootstrapped || this.flushing) {
            return;
        }

        const backend = this.requireAvailableBackend();
        this.flushing = true;
        this.clearTimer();
        try {
            const record: CloudSaveRecord = {
                data: this.user.toPayload(),
                revision: this.currentRevision + 1,
                updatedAt: await backend.getServerTime(),
            };
            await backend.save(record);
            this.currentRevision = record.revision;
        } finally {
            this.flushing = false;
        }
    }

    public async submitRankByType(type: number, score: number): Promise<void> {
        const metric = this.rankTypeToMetric(type);
        if (!metric) {
            throw new Error(`[CloudSyncService] unsupported rank type: ${type}`);
        }

        await this.requireAvailableBackend().submitRank(metric, Math.max(0, Math.floor(score || 0)));
    }

    public async getRankInfoByType(type: number): Promise<RankResult> {
        const metric = this.rankTypeToMetric(type);
        if (!metric) {
            throw new Error(`[CloudSyncService] unsupported rank type: ${type}`);
        }

        return await this.requireAvailableBackend().getWorldRank(metric, this.rankTypeToScope(type));
    }

    public async openNativeRankListByType(type: number): Promise<boolean> {
        const metric = this.rankTypeToMetric(type);
        const backend = this.requireAvailableBackend() as CloudBackend & { openNativeRankList?: (metric: RankMetric) => Promise<boolean> };
        if (!metric) {
            throw new Error(`[CloudSyncService] unsupported rank type: ${type}`);
        }
        if (typeof backend.openNativeRankList !== 'function') {
            throw new Error('[CloudSyncService] native rank list unavailable');
        }

        return await backend.openNativeRankList(metric);
    }

    public async reportEvent(eventName: string, payload: Record<string, unknown>): Promise<void> {
        await this.requireAvailableBackend().reportEvent(eventName, payload);
    }

    public static mergePayloads(local: UserDataPayload, remote: UserDataPayload): UserDataPayload {
        const unlockSkin = Array.from(new Set([...(remote.unlockSkin || [1]), ...(local.unlockSkin || [1])]))
            .filter((item) => Number.isFinite(Number(item)))
            .map((item) => Number(item));
        const localUseSkin = unlockSkin.indexOf(local.useSkin) >= 0 ? local.useSkin : remote.useSkin;
        const lastInterstitialAdDate = CloudSyncService.maxDateString(local.lastInterstitialAdDate, remote.lastInterstitialAdDate);
        const localInterstitialCount = local.lastInterstitialAdDate === lastInterstitialAdDate
            ? local.interstitialAdShownToday || 0
            : 0;
        const remoteInterstitialCount = remote.lastInterstitialAdDate === lastInterstitialAdDate
            ? remote.interstitialAdShownToday || 0
            : 0;

        return {
            ...remote,
            gameVideoTime: Math.max(local.gameVideoTime || 0, remote.gameVideoTime || 0),
            firstGame: Math.max(local.firstGame || 0, remote.firstGame || 0),
            level: Math.max(local.level || 1, remote.level || 1),
            foundCowNum: Math.max(local.foundCowNum || 0, remote.foundCowNum || 0),
            myScore: Math.max(local.myScore || 1, remote.myScore || 1),
            lastRecoveryTimestamp: Math.max(local.lastRecoveryTimestamp || 0, remote.lastRecoveryTimestamp || 0),
            stamina: Math.max(local.stamina || 0, remote.stamina || 0),
            coin: Math.max(local.coin || 0, remote.coin || 0),
            cowHintCount: Math.max(local.cowHintCount || 0, remote.cowHintCount || 0),
            excludeHintCount: Math.max(local.excludeHintCount || 0, remote.excludeHintCount || 0),
            unlockSkin,
            useSkin: localUseSkin,
            nightMode: local.nightMode,
            survivalBestRound: Math.max(local.survivalBestRound || 0, remote.survivalBestRound || 0),
            lastLoginDate: CloudSyncService.maxDateString(local.lastLoginDate, remote.lastLoginDate),
            dailyChallengeStreak: Math.max(local.dailyChallengeStreak || 0, remote.dailyChallengeStreak || 0),
            lastDailyChallengeDate: CloudSyncService.maxDateString(local.lastDailyChallengeDate, remote.lastDailyChallengeDate),
            lastInterstitialAdDate,
            interstitialAdShownToday: Math.max(localInterstitialCount, remoteInterstitialCount),
            lastInterstitialAdTimestamp: Math.max(local.lastInterstitialAdTimestamp || 0, remote.lastInterstitialAdTimestamp || 0),
            lastInterstitialAdLevel: Math.max(local.lastInterstitialAdLevel || 0, remote.lastInterstitialAdLevel || 0),
        };
    }

    private async submitCoreRanks(user: UserData): Promise<void> {
        await this.submitRankByType(0, user.level);
        await this.requireAvailableBackend().submitRank('survivalBestRound', user.survivalBestRound);
    }

    private rankTypeToMetric(type: number): RankMetric | null {
        if (type === 0 || type === 2) {
            return 'level';
        }
        if (type === 1 || type === 3) {
            return 'foundCowNum';
        }
        if (type === 4 || type === 5) {
            return 'survivalBestRound';
        }
        return null;
    }

    private rankTypeToScope(type: number): 'world' | 'friend' {
        return type === 2 || type === 3 || type === 5 ? 'friend' : 'world';
    }

    private clearTimer(): void {
        if (this.saveTimer !== null) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
    }

    private static maxDateString(a: string, b: string): string {
        return (a || '') > (b || '') ? (a || '') : (b || '');
    }

    private requireBackend(): CloudBackend {
        if (!this.backend) {
            throw new Error('[CloudSyncService] cloud backend is not configured');
        }
        return this.backend;
    }

    private requireAvailableBackend(): CloudBackend {
        const backend = this.requireBackend();
        if (!backend.isAvailable()) {
            throw new Error('[CloudSyncService] cloud backend is unavailable');
        }
        return backend;
    }
}
