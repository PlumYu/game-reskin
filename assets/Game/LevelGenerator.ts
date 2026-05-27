import { getNeighbors4, getNeighbors8, shuffleInPlace } from './GridMath';

export type GeneratedLevel = {
    gridColors: string[];
    cowPositions: boolean[];
    totalCows: number;
    solvedByLogic: boolean;
};

export function generateRandomLevel(size: number, palette: string[]): GeneratedLevel {
    const maxAttempts = 10000;
    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
        const generated = tryGenerateSolvableLayout(size, palette);
        if (generated) {
            console.log(`关卡生成成功，尝试次数: ${attempts}`);
            return generated;
        }
    }

    throw new Error(`Unable to generate a solvable level after ${maxAttempts} attempts.`);
}

function tryGenerateSolvableLayout(size: number, palette: string[]): GeneratedLevel | null {
    const total = size * size;
    const cowPositions = new Array(total).fill(false);
    const cowIndices: number[] = [];
    const resultCols: number[] = new Array(size);

    const solve = (row: number, usedCols: boolean[], currentCols: number[]): boolean => {
        if (row === size) return true;
        const cols = shuffleInPlace(Array.from({ length: size }, (_, i) => i));
        for (const col of cols) {
            if (usedCols[col]) continue;
            if (row > 0 && Math.abs(currentCols[row - 1] - col) <= 1) continue;
            usedCols[col] = true;
            currentCols[row] = col;
            if (solve(row + 1, usedCols, currentCols)) return true;
            usedCols[col] = false;
        }
        return false;
    };

    if (!solve(0, new Array(size).fill(false), resultCols)) {
        return null;
    }

    for (let row = 0; row < size; row++) {
        const index = row * size + resultCols[row];
        cowIndices.push(index);
        cowPositions[index] = true;
    }

    const gridColors = generateConnectedRegions(size, cowIndices, palette);
    if (!checkIsSolvable(size, gridColors, cowPositions)) {
        return null;
    }

    return { gridColors, cowPositions, totalCows: size, solvedByLogic: true };
}

function generateConnectedRegions(size: number, cowIndices: number[], palette: string[]): string[] {
    const total = size * size;
    const counts = new Array(size).fill(1);
    let remaining = total - size;
    for (let i = 0; i < remaining; i++) {
        counts[Math.floor(Math.random() * size)]++;
    }

    const assigned: number[] = new Array(total).fill(-1);
    const regionSizes = new Array(size).fill(1);
    for (let k = 0; k < size; k++) {
        assigned[cowIndices[k]] = k;
    }

    const canGrow = (): { region: number; cells: number[] } | null => {
        for (let k = 0; k < size; k++) {
            if (regionSizes[k] >= counts[k]) continue;
            const adj: number[] = [];
            for (let i = 0; i < total; i++) {
                if (assigned[i] !== k) continue;
                for (const neighbor of getNeighbors4(i, size)) {
                    if (assigned[neighbor] === -1 && adj.indexOf(neighbor) === -1) {
                        adj.push(neighbor);
                    }
                }
            }
            if (adj.length > 0) return { region: k, cells: adj };
        }
        return null;
    };

    for (;;) {
        const next = canGrow();
        if (!next) break;
        const cell = next.cells[Math.floor(Math.random() * next.cells.length)];
        assigned[cell] = next.region;
        regionSizes[next.region]++;
    }

    fillUnassignedCells(size, assigned);
    return assigned.map(region => palette[(region >= 0 ? region : 0) % palette.length]);
}

function fillUnassignedCells(size: number, assigned: number[]): void {
    const total = size * size;
    let changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < total; i++) {
            if (assigned[i] !== -1) continue;
            for (const neighbor of getNeighbors4(i, size)) {
                if (assigned[neighbor] >= 0) {
                    assigned[i] = assigned[neighbor];
                    changed = true;
                    break;
                }
            }
        }
    }

    changed = true;
    while (changed) {
        changed = false;
        for (let i = 0; i < total; i++) {
            if (assigned[i] !== -1) continue;
            for (const neighbor of getNeighbors8(i, size)) {
                if (assigned[neighbor] >= 0) {
                    assigned[i] = assigned[neighbor];
                    changed = true;
                    break;
                }
            }
        }
    }
}

export function checkIsSolvable(size: number, gridColors: string[], cowPositions: boolean[]): boolean {
    const total = size * size;
    const board = new Array(total).fill(0);
    let solvedCows = 0;
    let changed = true;
    const colorIndices = new Map<string, number[]>();

    for (let i = 0; i < total; i++) {
        const color = gridColors[i];
        if (!colorIndices.has(color)) colorIndices.set(color, []);
        colorIndices.get(color)!.push(i);
    }

    while (changed && solvedCows < size) {
        changed = false;

        for (let i = 0; i < total; i++) {
            if (board[i] !== 1) continue;
            const row = Math.floor(i / size);
            const col = i % size;
            const color = gridColors[i];
            for (let j = 0; j < total; j++) {
                if (i === j || board[j] !== 0) continue;
                const r2 = Math.floor(j / size);
                const c2 = j % size;
                const isNeighbor = Math.abs(row - r2) <= 1 && Math.abs(col - c2) <= 1;
                if (r2 === row || c2 === col || gridColors[j] === color || isNeighbor) {
                    board[j] = -1;
                    changed = true;
                }
            }
        }
        if (changed) continue;

        if (applyFullLineColorRule(size, total, gridColors, board)) { changed = true; continue; }
        if (applySingleLineColorRule(size, colorIndices, gridColors, board)) { changed = true; continue; }
        if (applyOccupiedLineRule(size, colorIndices, gridColors, board, false)) { changed = true; continue; }
        if (applyOccupiedLineRule(size, colorIndices, gridColors, board, true)) { changed = true; continue; }

        const rowCow = confirmSingleCandidateInRows(size, board);
        if (rowCow >= 0) { board[rowCow] = 1; solvedCows++; changed = true; continue; }

        const colCow = confirmSingleCandidateInCols(size, board);
        if (colCow >= 0) { board[colCow] = 1; solvedCows++; changed = true; continue; }

        for (const indices of colorIndices.values()) {
            let candidates: number[] = [];
            let hasCow = false;
            for (const index of indices) {
                if (board[index] === 1) { hasCow = true; break; }
                if (board[index] === 0) candidates.push(index);
            }
            if (!hasCow && candidates.length === 1) {
                board[candidates[0]] = 1;
                solvedCows++;
                changed = true;
                break;
            }
        }
    }

    return solvedCows === size;
}

function applyFullLineColorRule(size: number, total: number, gridColors: string[], board: number[]): boolean {
    let changed = false;
    for (let row = 0; row < size; row++) {
        const rowColor = gridColors[row * size];
        let same = true;
        for (let col = 1; col < size; col++) {
            if (gridColors[row * size + col] !== rowColor) { same = false; break; }
        }
        if (!same) continue;
        for (let j = 0; j < total; j++) {
            if (board[j] === 0 && Math.floor(j / size) !== row && gridColors[j] === rowColor) {
                board[j] = -1;
                changed = true;
            }
        }
    }

    for (let col = 0; col < size; col++) {
        const colColor = gridColors[col];
        let same = true;
        for (let row = 1; row < size; row++) {
            if (gridColors[row * size + col] !== colColor) { same = false; break; }
        }
        if (!same) continue;
        for (let j = 0; j < total; j++) {
            if (board[j] === 0 && j % size !== col && gridColors[j] === colColor) {
                board[j] = -1;
                changed = true;
            }
        }
    }
    return changed;
}

function applySingleLineColorRule(size: number, colorIndices: Map<string, number[]>, gridColors: string[], board: number[]): boolean {
    let changed = false;
    for (const [color, indices] of colorIndices) {
        const unknown = indices.filter(index => board[index] === 0);
        if (unknown.length === 0) continue;
        const rows = new Set(unknown.map(index => Math.floor(index / size)));
        const cols = new Set(unknown.map(index => index % size));
        if (rows.size === 1) {
            const row = rows.values().next().value;
            for (let col = 0; col < size; col++) {
                const index = row * size + col;
                if (board[index] === 0 && gridColors[index] !== color) {
                    board[index] = -1;
                    changed = true;
                }
            }
        }
        if (cols.size === 1) {
            const col = cols.values().next().value;
            for (let row = 0; row < size; row++) {
                const index = row * size + col;
                if (board[index] === 0 && gridColors[index] !== color) {
                    board[index] = -1;
                    changed = true;
                }
            }
        }
    }
    return changed;
}

function applyOccupiedLineRule(size: number, colorIndices: Map<string, number[]>, gridColors: string[], board: number[], rowsMode: boolean): boolean {
    for (let mask = 1; mask < (1 << size); mask++) {
        const lines: number[] = [];
        for (let i = 0; i < size; i++) {
            if (mask & (1 << i)) lines.push(i);
        }
        const lineSet = new Set(lines);
        const occupyingColors: string[] = [];
        for (const [color, indices] of colorIndices) {
            const unknown = indices.filter(index => board[index] === 0);
            if (unknown.length === 0) continue;
            const colorLines = new Set(unknown.map(index => rowsMode ? Math.floor(index / size) : index % size));
            let allIn = true;
            for (const line of colorLines) {
                if (!lineSet.has(line)) { allIn = false; break; }
            }
            if (allIn) occupyingColors.push(color);
        }
        if (occupyingColors.length < lines.length) continue;

        const occupyingSet = new Set(occupyingColors);
        for (const line of lines) {
            for (let i = 0; i < size; i++) {
                const index = rowsMode ? line * size + i : i * size + line;
                if (board[index] !== 0 || occupyingSet.has(gridColors[index])) continue;
                board[index] = -1;
                return true;
            }
        }
    }
    return false;
}

function confirmSingleCandidateInRows(size: number, board: number[]): number {
    for (let row = 0; row < size; row++) {
        const candidates: number[] = [];
        let hasCow = false;
        for (let col = 0; col < size; col++) {
            const index = row * size + col;
            if (board[index] === 1) { hasCow = true; break; }
            if (board[index] === 0) candidates.push(index);
        }
        if (!hasCow && candidates.length === 1) return candidates[0];
    }
    return -1;
}

function confirmSingleCandidateInCols(size: number, board: number[]): number {
    for (let col = 0; col < size; col++) {
        const candidates: number[] = [];
        let hasCow = false;
        for (let row = 0; row < size; row++) {
            const index = row * size + col;
            if (board[index] === 1) { hasCow = true; break; }
            if (board[index] === 0) candidates.push(index);
        }
        if (!hasCow && candidates.length === 1) return candidates[0];
    }
    return -1;
}
