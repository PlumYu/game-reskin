import { shuffleInPlace } from './GridMath';

export type DailyChallengeLevel = {
    gridSize: number;
    gridColors: string[];
    cowPositions: boolean[];
    totalCows: number;
};

export function generateDailyChallengeLevel(dateString: string, palette: string[]): DailyChallengeLevel {
    const rng = mulberry32(hashDateString(dateString));
    const gridSize = 7;
    const total = gridSize * gridSize;
    const cowPositions = new Array(total).fill(false);
    const cowIndices = placeCows(gridSize, rng);

    for (const index of cowIndices) {
        cowPositions[index] = true;
    }
    const gridColors = assignConnectedColors(gridSize, palette, cowIndices, rng);

    return { gridSize, gridColors, cowPositions, totalCows: cowIndices.length };
}

function mulberry32(seed: number): () => number {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function hashDateString(dateString: string): number {
    let hash = 0;
    for (let i = 0; i < dateString.length; i++) {
        hash = ((hash << 5) - hash) + dateString.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

function placeCows(size: number, rng: () => number): number[] {
    const result: number[] = [];
    const usedCols = new Array(size).fill(false);

    const solve = (row: number): boolean => {
        if (row === size) return true;
        const cols = shuffleInPlace(Array.from({ length: size }, (_, i) => i), rng);
        for (const col of cols) {
            if (usedCols[col]) continue;
            if (row > 0 && Math.abs((result[row - 1] % size) - col) <= 1) continue;
            usedCols[col] = true;
            result[row] = row * size + col;
            if (solve(row + 1)) return true;
            usedCols[col] = false;
        }
        return false;
    };

    solve(0);
    return result;
}

function assignConnectedColors(size: number, palette: string[], cowIndices: number[], rng: () => number): string[] {
    const total = size * size;
    const availableColors = shuffleInPlace(palette.slice(0, size), rng);
    const assigned = new Array(total).fill(-1);

    for (let region = 0; region < size; region++) {
        assigned[cowIndices[region]] = region;
    }

    let remaining = total - size;
    while (remaining > 0) {
        const expandable: { region: number; cells: number[] }[] = [];
        for (let region = 0; region < size; region++) {
            const cells: number[] = [];
            for (let i = 0; i < total; i++) {
                if (assigned[i] !== region) continue;
                for (const neighbor of neighbors4(i, size)) {
                    if (assigned[neighbor] === -1 && cells.indexOf(neighbor) < 0) {
                        cells.push(neighbor);
                    }
                }
            }
            if (cells.length > 0) expandable.push({ region, cells });
        }

        if (expandable.length === 0) break;
        const next = expandable[Math.floor(rng() * expandable.length)];
        const cell = next.cells[Math.floor(rng() * next.cells.length)];
        assigned[cell] = next.region;
        remaining--;
    }

    for (let i = 0; i < total; i++) {
        if (assigned[i] >= 0) continue;
        for (const neighbor of neighbors4(i, size)) {
            if (assigned[neighbor] >= 0) {
                assigned[i] = assigned[neighbor];
                break;
            }
        }
        if (assigned[i] < 0) assigned[i] = 0;
    }

    return assigned.map(region => availableColors[region] || palette[0]);
}

function neighbors4(index: number, size: number): number[] {
    const row = Math.floor(index / size);
    const col = index % size;
    const out: number[] = [];
    if (row > 0) out.push(index - size);
    if (row + 1 < size) out.push(index + size);
    if (col > 0) out.push(index - 1);
    if (col + 1 < size) out.push(index + 1);
    return out;
}
