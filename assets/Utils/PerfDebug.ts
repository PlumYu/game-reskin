import { ENABLE_PERF_DEBUG } from './BuildFlags';

type PerfData = object;

type FpsProbe = {
    name: string;
    startedAt: number;
    endAt: number;
    nextReportAt: number;
    frames: number;
    totalDt: number;
    maxDt: number;
    slow33: number;
    slow50: number;
};

class PerfDebug {
    private readonly bootAt = Date.now();
    private lastAt = this.bootAt;
    private spans: Record<string, number> = {};
    private slowLastReportAt: Record<string, number> = {};
    private slowSuppressed: Record<string, number> = {};
    private fpsProbe: FpsProbe | null = null;
    private counters: Record<string, number> = {};

    public get enabled(): boolean {
        return ENABLE_PERF_DEBUG;
    }

    public now(): number {
        return Date.now();
    }

    public mark(label: string, data?: PerfData): void {
        if (!this.enabled) return;
        this.write(label, data);
    }

    public count(label: string, amount: number = 1): void {
        if (!this.enabled) return;
        this.counters[label] = (this.counters[label] || 0) + amount;
    }

    public flushCounters(label: string): void {
        if (!this.enabled) return;
        const counters = this.drainCounters();
        if (!counters) return;
        this.write(`counters ${label}`, counters);
    }

    public begin(label: string, data?: PerfData): void {
        if (!this.enabled) return;
        this.spans[label] = this.now();
        this.write(`${label} begin`, data);
    }

    public end(label: string, data?: PerfData): void {
        if (!this.enabled) return;
        const now = this.now();
        const startedAt = this.spans[label] || now;
        delete this.spans[label];
        this.write(`${label} end`, { costMs: now - startedAt, ...(data || {}) });
    }

    public slow(label: string, startedAt: number, thresholdMs: number, data?: PerfData): void {
        if (!this.enabled) return;
        const costMs = this.now() - startedAt;
        if (costMs >= thresholdMs) {
            const now = this.now();
            const lastReportAt = this.slowLastReportAt[label] || 0;
            if (now - lastReportAt < 1000) {
                this.slowSuppressed[label] = (this.slowSuppressed[label] || 0) + 1;
                return;
            }
            const suppressed = this.slowSuppressed[label] || 0;
            this.slowSuppressed[label] = 0;
            this.slowLastReportAt[label] = now;
            this.write(`${label} slow`, { costMs, thresholdMs, suppressed, ...(data || {}) });
        }
    }

    public startFpsProbe(name: string, durationMs: number = 15000): void {
        if (!this.enabled) return;
        const now = this.now();
        this.fpsProbe = {
            name,
            startedAt: now,
            endAt: now + durationMs,
            nextReportAt: now + 5000,
            frames: 0,
            totalDt: 0,
            maxDt: 0,
            slow33: 0,
            slow50: 0,
        };
        this.write(`fps ${name} begin`, { durationMs });
    }

    public frame(dt: number): void {
        if (!this.enabled || !this.fpsProbe) return;
        const probe = this.fpsProbe;
        const safeDt = Math.max(0, Math.min(dt || 0, 1));
        const dtMs = safeDt * 1000;
        probe.frames++;
        probe.totalDt += safeDt;
        probe.maxDt = Math.max(probe.maxDt, dtMs);
        if (dtMs > 33.34) probe.slow33++;
        if (dtMs > 50) probe.slow50++;

        const now = this.now();
        if (now >= probe.nextReportAt || now >= probe.endAt) {
            this.reportFpsProbe(now >= probe.endAt);
            if (this.fpsProbe) {
                this.fpsProbe.nextReportAt = now + 5000;
            }
        }
    }

    public stopFpsProbe(reason: string = 'manual'): void {
        if (!this.enabled || !this.fpsProbe) return;
        this.reportFpsProbe(true, reason);
    }

    private reportFpsProbe(final: boolean, reason: string = 'duration'): void {
        const probe = this.fpsProbe;
        if (!probe) return;
        const avgFps = probe.totalDt > 0 ? Math.round((probe.frames / probe.totalDt) * 10) / 10 : 0;
        this.write(`fps ${probe.name} ${final ? 'end' : 'sample'}`, {
            reason: final ? reason : 'interval',
            elapsedMs: this.now() - probe.startedAt,
            frames: probe.frames,
            avgFps,
            maxFrameMs: Math.round(probe.maxDt * 10) / 10,
            slow33: probe.slow33,
            slow50: probe.slow50,
            counters: this.drainCounters(),
        });
        if (final) {
            this.fpsProbe = null;
        }
    }

    private drainCounters(): Record<string, number> | undefined {
        const keys = Object.keys(this.counters);
        if (keys.length === 0) return undefined;
        const counters = this.counters;
        this.counters = {};
        return counters;
    }

    private write(label: string, data?: PerfData): void {
        const now = this.now();
        const totalMs = now - this.bootAt;
        const deltaMs = now - this.lastAt;
        this.lastAt = now;
        const memory = this.getMemoryText();
        const prefix = `[PERF] +${totalMs}ms delta=${deltaMs}ms ${label}${memory}`;
        if (data) {
            console.log(prefix, data);
        } else {
            console.log(prefix);
        }
    }

    private getMemoryText(): string {
        const g = globalThis as any;
        const memory = g.performance?.memory || g.wx?.getPerformance?.()?.memory;
        if (!memory) return '';
        const used = this.toMb(memory.usedJSHeapSize || memory.used || memory.jsHeapSizeUsed);
        const total = this.toMb(memory.totalJSHeapSize || memory.total || memory.jsHeapSizeTotal);
        if (used > 0 && total > 0) return ` mem=${used}/${total}MB`;
        if (used > 0) return ` mem=${used}MB`;
        return '';
    }

    private toMb(value: number): number {
        if (!Number.isFinite(value) || value <= 0) return 0;
        return Math.round((value / 1024 / 1024) * 10) / 10;
    }
}

export default new PerfDebug();
