import type { RankResult } from './PlatformBase';
import type { UserDataPayload } from './UserData';

export type CloudPlatformName = 'wechat';
export type RankMetric = 'level' | 'foundCowNum' | 'survivalBestRound';
export type RankScope = 'world' | 'friend';

export interface CloudUser {
    platform: CloudPlatformName;
    openId: string;
    anonymousId?: string;
}

export interface CloudSaveRecord {
    data: UserDataPayload;
    revision: number;
    updatedAt: number;
}

export interface CloudBackend {
    init(): Promise<void>;
    login(): Promise<CloudUser | null>;
    loadSave(): Promise<CloudSaveRecord | null>;
    save(record: CloudSaveRecord): Promise<void>;
    submitRank(metric: RankMetric, score: number): Promise<void>;
    getWorldRank(metric: RankMetric, scope?: RankScope): Promise<RankResult>;
    getServerTime(): Promise<number>;
    reportEvent(eventName: string, payload: Record<string, unknown>): Promise<void>;
    isAvailable(): boolean;
}
