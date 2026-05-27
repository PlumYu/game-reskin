export const MAIN_LEVEL_COUNT = 500;
export const SURVIVAL_LEVEL_COUNT = 200;
export const DAILY_CHALLENGE_LEVEL_COUNT = 200;

function normalizeLevel(value: number, total: number): number {
    const numeric = Math.max(1, Math.floor(value || 1));
    return ((numeric - 1) % total) + 1;
}

function padLevelId(value: number): string {
    return value.toString().padStart(3, '0');
}

function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    return hash >>> 0;
}

export function getMainLevelPath(level: number): string {
    const index = normalizeLevel(level, MAIN_LEVEL_COUNT);
    return `configs/main/${padLevelId(index)}`;
}

export function pickSurvivalLevel(passLevel: number): number {
    return normalizeLevel((Math.floor(passLevel || 0) + 1), SURVIVAL_LEVEL_COUNT);
}

export function getSurvivalLevelPath(passLevel: number): string {
    return `configs/survival/${padLevelId(pickSurvivalLevel(passLevel))}`;
}

export function getSurvivalStagePath(stage: number): string {
    const index = normalizeLevel(stage, SURVIVAL_LEVEL_COUNT);
    return `configs/survival/${padLevelId(index)}`;
}

export function getDailyChallengeLevelPath(dateString: string): string {
    const index = (hashString(dateString) % DAILY_CHALLENGE_LEVEL_COUNT) + 1;
    return `configs/daily_challenge/${padLevelId(index)}`;
}

export function getDailyChallengeStagePath(stage: number): string {
    const index = normalizeLevel(stage, DAILY_CHALLENGE_LEVEL_COUNT);
    return `configs/daily_challenge/${padLevelId(index)}`;
}
