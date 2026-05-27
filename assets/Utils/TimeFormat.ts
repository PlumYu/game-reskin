export function formatClockTime(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
    const restSeconds = (safeSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${restSeconds}`;
}

export function formatCountdownTime(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safeSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((safeSeconds % 3600) / 60).toString().padStart(2, '0');
    const restSeconds = (safeSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${restSeconds}`;
}

