import type { LevelConfigData } from './LevelConfig';

const EARLY_MAIN_LEVEL_CONFIGS: Record<number, LevelConfigData> = {
    1: {
        n: 4,
        c: [1, 0, 0, 3, 1, 1, 0, 3, 1, 1, 1, 3, 1, 1, 2, 3],
        cows: [1, 7, 8, 14],
    },
    2: {
        n: 4,
        c: [0, 1, 3, 3, 0, 1, 3, 2, 0, 0, 3, 3, 0, 0, 3, 3],
        cows: [1, 7, 8, 14],
    },
    3: {
        n: 6,
        c: [1, 1, 1, 4, 3, 3, 1, 1, 1, 3, 3, 3, 1, 1, 1, 5, 0, 3, 1, 1, 5, 5, 2, 3, 1, 1, 5, 2, 2, 3, 1, 2, 2, 2, 2, 2],
        cows: [3, 6, 16, 20, 29, 31],
    },
    4: {
        n: 6,
        c: [5, 5, 5, 2, 3, 3, 5, 5, 5, 3, 3, 3, 5, 5, 5, 4, 1, 3, 5, 5, 4, 4, 0, 3, 5, 5, 4, 0, 0, 3, 5, 0, 0, 0, 0, 0],
        cows: [3, 6, 16, 20, 29, 31],
    },
    5: {
        n: 7,
        c: [5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 5, 5, 5, 2, 2, 2, 3, 3, 4, 5, 2, 2, 2, 2, 3, 3, 3, 2, 2, 0, 1, 1, 3, 3, 2, 2, 2, 2, 1, 3, 3, 2, 2, 2, 1, 1, 3, 6],
        cows: [1, 10, 19, 21, 30, 39, 48],
    },
};

export function getEarlyMainLevelConfig(level: number): LevelConfigData | null {
    const config = EARLY_MAIN_LEVEL_CONFIGS[level];
    if (!config) return null;
    return {
        n: config.n,
        c: config.c.slice(),
        cows: config.cows.slice(),
    };
}

