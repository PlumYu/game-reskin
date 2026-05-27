import { CloudBackend, CloudSaveRecord, CloudUser, RankMetric } from './CloudBackend';
import { WECHAT_CLOUD_ENV_ID, WECHAT_CLOUD_FUNCTION_NAME } from './CloudConfig';
import type { RankResult } from './PlatformBase';

declare const wx: any;

const CLOUD_CALL_TIMEOUT_MS = 10000;

export default class WechatCloudBackend implements CloudBackend {
    private available = false;
    private user: CloudUser | null = null;

    public async init(): Promise<void> {
        try {
            if (!wx?.cloud || typeof wx.cloud.init !== 'function') {
                this.available = false;
                throw new Error('[WechatCloudBackend] wx.cloud unavailable');
            }

            wx.cloud.init({
                env: WECHAT_CLOUD_ENV_ID || undefined,
                traceUser: true,
            });
            this.available = true;
        } catch (e) {
            console.error('[WechatCloudBackend] init failed', e);
            this.available = false;
            throw e;
        }
    }

    public async login(): Promise<CloudUser | null> {
        if (!this.available) {
            throw new Error('[WechatCloudBackend] cloud backend unavailable');
        }

        const result = await this.call<{ openId?: string; openid?: string }>('login');
        const openId = result?.openId || result?.openid || '';
        if (!openId) {
            throw new Error('[WechatCloudBackend] missing openId');
        }
        this.user = { platform: 'wechat', openId };
        return this.user;
    }

    public async loadSave(): Promise<CloudSaveRecord | null> {
        return this.call<CloudSaveRecord | null>('loadSave', {}, true);
    }

    public async save(record: CloudSaveRecord): Promise<void> {
        await this.call<void>('save', record);
    }

    public async submitRank(metric: RankMetric, score: number): Promise<void> {
        await this.call<void>('submitRank', { metric, score });
    }

    public async getWorldRank(metric: RankMetric): Promise<RankResult> {
        const result = await this.call<RankResult>('getWorldRank', { metric });
        if (!result) {
            throw new Error(`[WechatCloudBackend] getWorldRank returned empty result: ${metric}`);
        }
        return result;
    }

    public async getServerTime(): Promise<number> {
        const result = await this.call<{ now: number }>('getServerTime');
        const now = Number(result?.now);
        if (!Number.isFinite(now) || now <= 0) {
            throw new Error('[WechatCloudBackend] invalid server time');
        }
        return Math.floor(now);
    }

    public async reportEvent(eventName: string, payload: Record<string, unknown>): Promise<void> {
        await this.call<void>('reportEvent', { eventName, payload });
    }

    public isAvailable(): boolean {
        return this.available;
    }

    private async call<T>(action: string, payload: any = {}, allowNull = false): Promise<T | null> {
        if (!this.available || typeof wx?.cloud?.callFunction !== 'function') {
            throw new Error('[WechatCloudBackend] cloud function unavailable');
        }

        try {
            const res = await this.withTimeout(wx.cloud.callFunction({
                name: WECHAT_CLOUD_FUNCTION_NAME,
                data: { action, ...payload },
            }), action);
            const result = res?.result?.data ?? res?.result ?? null;
            if (result && typeof result === 'object' && (result as { ok?: boolean }).ok === false) {
                const message = (result as { errorMessage?: string }).errorMessage || `cloud function error: ${action}`;
                throw new Error(`[WechatCloudBackend] ${message}`);
            }
            if (result === null || result === undefined) {
                if (allowNull) {
                    return null;
                }
                throw new Error(`[WechatCloudBackend] empty cloud result: ${action}`);
            }
            return result as T;
        } catch (e) {
            console.error('[WechatCloudBackend] call failed', action, e);
            throw e;
        }
    }

    private async withTimeout<T>(promise: Promise<T>, action: string): Promise<T> {
        let timeoutId = 0;
        const timeout = new Promise<T>((_resolve, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`[WechatCloudBackend] cloud function timed out: ${action}`));
            }, CLOUD_CALL_TIMEOUT_MS) as unknown as number;
        });

        try {
            return await Promise.race([promise, timeout]);
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
    }
}
