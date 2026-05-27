export type LevelConfigData = {
    n: number;
    c: number[];
    cows: number[];
};

export type LevelState = {
    gridSize: number;
    gridColors: string[];
    cowPositions: boolean[];
    totalCows: number;
};

export function isValidLevelConfig(data: { n?: number; c?: number[]; cows?: number[] } | null | undefined): data is LevelConfigData {
    if (!data || typeof data.n !== 'number' || !Array.isArray(data.c) || !Array.isArray(data.cows)) {
        return false;
    }

    const n = Math.floor(data.n);
    const total = n * n;
    if (n < 4 || n > 12 || data.c.length !== total || data.cows.length !== n) {
        return false;
    }

    const regions = data.c.map(value => Number(value));
    if (regions.some(value => !Number.isInteger(value))) {
        return false;
    }

    const expectedRegions = new Set(Array.from({ length: n }, (_, i) => i));
    const actualRegions = new Set(regions);
    if (actualRegions.size !== expectedRegions.size) {
        return false;
    }
    for (const region of actualRegions) {
        if (!expectedRegions.has(region)) return false;
    }

    const rowCounts = new Array(n).fill(0);
    const colCounts = new Array(n).fill(0);
    const regionCounts = new Array(n).fill(0);
    const cowSet = new Set<number>();
    for (const rawCow of data.cows) {
        const cow = Number(rawCow);
        if (!Number.isInteger(cow) || cow < 0 || cow >= total || cowSet.has(cow)) {
            return false;
        }
        cowSet.add(cow);
        const row = Math.floor(cow / n);
        const col = cow % n;
        rowCounts[row]++;
        colCounts[col]++;
        regionCounts[regions[cow]]++;
    }
    if (rowCounts.some(count => count !== 1) || colCounts.some(count => count !== 1) || regionCounts.some(count => count !== 1)) {
        return false;
    }

    const cows = Array.from(cowSet);
    for (let i = 0; i < cows.length; i++) {
        const r1 = Math.floor(cows[i] / n);
        const c1 = cows[i] % n;
        for (let j = i + 1; j < cows.length; j++) {
            const r2 = Math.floor(cows[j] / n);
            const c2 = cows[j] % n;
            if (Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2)) <= 1) {
                return false;
            }
        }
    }

    for (let region = 0; region < n; region++) {
        if (!isRegionConnected(regions, n, region)) {
            return false;
        }
    }

    return true;
}

export function applyLevelConfigData(data: LevelConfigData, palette: string[]): LevelState {
    const gridSize = Math.max(4, Math.min(12, data.n || 4));
    const total = gridSize * gridSize;
    const gridColors = (data.c || []).slice(0, total).map((idx: number) =>
        palette[Number(idx) % palette.length] || palette[0]
    );
    while (gridColors.length < total) gridColors.push(palette[0]);

    const cowPositions = new Array(total).fill(false);
    const cowsList = data.cows || [];
    cowsList.forEach((index: number) => {
        if (index >= 0 && index < total) cowPositions[index] = true;
    });

    return {
        gridSize,
        gridColors,
        cowPositions,
        totalCows: cowsList.length,
    };
}

function isRegionConnected(regions: number[], n: number, region: number): boolean {
    const cells: number[] = [];
    for (let i = 0; i < regions.length; i++) {
        if (regions[i] === region) cells.push(i);
    }
    if (cells.length === 0) return false;

    const seen = new Set<number>([cells[0]]);
    const stack = [cells[0]];
    while (stack.length > 0) {
        const current = stack.pop()!;
        for (const neighbor of getNeighbors4(current, n)) {
            if (seen.has(neighbor) || regions[neighbor] !== region) continue;
            seen.add(neighbor);
            stack.push(neighbor);
        }
    }
    return seen.size === cells.length;
}

function getNeighbors4(index: number, n: number): number[] {
    const row = Math.floor(index / n);
    const col = index % n;
    const out: number[] = [];
    if (row > 0) out.push(index - n);
    if (row + 1 < n) out.push(index + n);
    if (col > 0) out.push(index - 1);
    if (col + 1 < n) out.push(index + 1);
    return out;
}
