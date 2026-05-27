export function getNeighbors4(index: number, size: number): number[] {
    const row = Math.floor(index / size);
    const col = index % size;
    const out: number[] = [];
    if (row > 0) out.push(index - size);
    if (row < size - 1) out.push(index + size);
    if (col > 0) out.push(index - 1);
    if (col < size - 1) out.push(index + 1);
    return out;
}

export function getNeighbors8(index: number, size: number): number[] {
    const row = Math.floor(index / size);
    const col = index % size;
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < size && c >= 0 && c < size) {
                out.push(r * size + c);
            }
        }
    }
    return out;
}

export function shuffleInPlace<T>(items: T[], random: () => number = Math.random): T[] {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

