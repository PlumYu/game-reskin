import { Graphics, Color } from 'cc';

type CelebrationPiece = {
    kind: 'confetti' | 'coin';
    x: number;
    y: number;
    vx: number;
    vy: number;
    rot: number;
    vr: number;
    size: number;
    color: Color;
    delay: number;
    life: number;
    side: number;
    phase: number;
    launch: number;
    widthRatio: number;
    heightRatio: number;
};

export function installWinPanelCelebration(target: any): void {
    Object.assign(target.prototype, {
    prepareCelebrationParticles: function (): void {
        const colors = [
            new Color(255, 126, 166, 255),
            new Color(255, 190, 90, 255),
            new Color(255, 236, 116, 255),
            new Color(150, 224, 132, 255),
            new Color(126, 214, 255, 255),
            new Color(190, 146, 255, 255),
            new Color(86, 238, 214, 255),
            new Color(255, 255, 255, 255),
        ];

        this.celebrationPieces = [];
        for (let i = 0; i < 82; i++) {
            const angle = Math.PI * 2 * this.celebrationRand(i + 17);
            const radius = 14 + this.celebrationRand(i + 19) * 108;
            const side = Math.cos(angle) >= 0 ? 1 : -1;
            const isWide = this.celebrationRand(i + 16) > 0.34;
            const size = 8 + this.celebrationRand(i + 71) * 12;
            this.celebrationPieces.push({
                kind: 'confetti',
                x: Math.cos(angle) * radius * 0.55,
                y: 88 + Math.sin(angle) * radius * 0.55,
                vx: Math.cos(angle) * (190 + this.celebrationRand(i + 91) * 230),
                vy: Math.sin(angle) * (112 + this.celebrationRand(i + 111) * 155) + 210,
                rot: this.celebrationRand(i + 41) * Math.PI,
                vr: (this.celebrationRand(i + 51) > 0.5 ? 1 : -1) * (1.6 + this.celebrationRand(i + 61) * 3.8),
                size,
                color: colors[i % colors.length],
                delay: 0.02 + this.celebrationRand(i + 81) * 0.28,
                life: 3.7 + this.celebrationRand(i + 121) * 2.4,
                side,
                phase: this.celebrationRand(i + 131) * Math.PI * 2,
                launch: 0.36 + this.celebrationRand(i + 141) * 0.42,
                widthRatio: isWide ? 1.28 + this.celebrationRand(i + 151) * 0.36 : 0.82 + this.celebrationRand(i + 161) * 0.18,
                heightRatio: isWide ? 0.48 + this.celebrationRand(i + 171) * 0.18 : 0.84 + this.celebrationRand(i + 181) * 0.18,
            });
        }

        for (let i = 0; i < 48; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            this.celebrationPieces.push({
                kind: 'confetti',
                x: side * (245 + this.celebrationRand(i + 93) * 98),
                y: 210 + this.celebrationRand(i + 94) * 345,
                vx: -side * (28 + this.celebrationRand(i + 95) * 86) + (this.celebrationRand(i + 96) - 0.5) * 55,
                vy: -26 - this.celebrationRand(i + 97) * 86,
                rot: this.celebrationRand(i + 95) * Math.PI,
                vr: (this.celebrationRand(i + 96) > 0.5 ? 1 : -1) * (1.1 + this.celebrationRand(i + 97) * 2.6),
                size: 9 + this.celebrationRand(i + 98) * 10,
                color: colors[(i + 1) % colors.length],
                delay: 0.38 + this.celebrationRand(i + 99) * 2.9,
                life: 5.0 + this.celebrationRand(i + 109) * 2.8,
                side,
                phase: this.celebrationRand(i + 131) * Math.PI * 2,
                launch: 0.2 + this.celebrationRand(i + 141) * 0.2,
                widthRatio: 1.2 + this.celebrationRand(i + 151) * 0.34,
                heightRatio: 0.46 + this.celebrationRand(i + 161) * 0.22,
            });
        }

        for (let i = 0; i < 5; i++) {
            const angle = Math.PI * (0.16 + this.celebrationRand(i + 201) * 0.68);
            const speed = 360 + this.celebrationRand(i + 211) * 160;
            this.celebrationPieces.push({
                kind: 'coin',
                x: -10 + this.celebrationRand(i + 221) * 20,
                y: 24 + this.celebrationRand(i + 231) * 48,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                rot: 0,
                vr: 0,
                size: 9 + this.celebrationRand(i + 241) * 7,
                color: new Color(255, 206, 48, 255),
                delay: 0.05 + i * 0.018,
                life: 0.92 + this.celebrationRand(i + 251) * 0.26,
                side: 0,
                phase: this.celebrationRand(i + 261) * Math.PI * 2,
                launch: 0,
                widthRatio: 1,
                heightRatio: 1,
            });
        }

    },
    renderVictoryStaticLayer: function (): void {
        const g = this.celebrationOverlayGraphics;
        if (!g) return;
        g.clear();
        const size = this.getSettlementSize();
        g.fillColor = new Color(0, 0, 0, 198);
        g.rect(-size.width / 2, -size.height / 2, size.width, size.height);
        g.fill();
    },
    drawCelebrationButtonBlock: function (g: Graphics, x: number, y: number, width: number, height: number, color: Color): void {
        const radius = height * 0.42;
        g.fillColor = new Color(0, 0, 0, 56);
        g.roundRect(x - width / 2, y - height / 2 - 6, width, height, radius);
        g.fill();
        g.fillColor = color;
        g.roundRect(x - width / 2, y - height / 2, width, height, radius);
        g.fill();
        g.strokeColor = new Color(255, 255, 255, 92);
        g.lineWidth = 3;
        g.roundRect(x - width / 2 + 5, y - height / 2 + 5, width - 10, height - 13, Math.max(8, radius - 5));
        g.stroke();
        g.fillColor = new Color(255, 255, 255, 34);
        g.roundRect(x - width / 2 + 12, y + height * 0.1, width - 24, height * 0.18, height * 0.09);
        g.fill();
    },
    renderVictoryCelebration: function (progress: number): void {
        const g = this.celebrationGraphics;
        if (!g) return;
        const t = Math.max(0, progress);
        g.clear();
        this.drawVictoryStageGlow(g, t);
        this.drawReferenceVictoryBurst(g, t);
        this.drawSideCelebrationCannons(g, t);
        this.drawCelebrationConfetti(g, t);
        this.drawAmbientCelebrationCoins(g, t);
    },
    drawVictoryStageGlow: function (g: Graphics, time: number): void {
        const pulse = 0.76 + Math.sin(time * 2.2) * 0.08;
        const intro = Math.min(1, time / 0.45);
        const centerY = 112;
        g.fillColor = new Color(255, 226, 112, Math.floor(28 * intro));
        g.circle(0, centerY, 238 * pulse);
        g.fill();
        g.fillColor = new Color(86, 166, 255, Math.floor(22 * intro));
        g.circle(0, centerY - 16, 310 * pulse);
        g.fill();

        for (let i = 0; i < 3; i++) {
            const local = time - 0.08 - i * 0.18;
            if (local < 0 || local > 1.05) continue;
            const p = this.easeOutCubic(local / 1.05);
            const alpha = Math.floor(165 * (1 - p));
            const radius = 72 + p * (230 + i * 52);
            g.strokeColor = new Color(255, 238, 126, alpha);
            g.lineWidth = 8 - i * 1.2;
            g.circle(0, centerY, radius);
            g.stroke();
            g.strokeColor = new Color(255, 255, 255, Math.floor(alpha * 0.55));
            g.lineWidth = 3;
            g.circle(0, centerY, radius + 9);
            g.stroke();
        }
    },
    drawReferenceVictoryBurst: function (g: Graphics, time: number): void {
        const flash = Math.max(0, 1 - Math.abs(time - 0.22) / 0.22);
        if (flash > 0) {
            g.fillColor = new Color(255, 255, 255, Math.floor(180 * flash));
            g.circle(0, 92, 150 + 105 * flash);
            g.fill();
            g.strokeColor = new Color(255, 255, 255, Math.floor(190 * flash));
            g.lineWidth = 8;
            for (let i = 0; i < 24; i++) {
                const angle = Math.PI * 2 * i / 24 + time * 1.8;
                const inner = 102 + 12 * flash;
                const outer = 204 + 74 * flash + (i % 2) * 34;
                g.moveTo(Math.cos(angle) * inner, 92 + Math.sin(angle) * inner);
                g.lineTo(Math.cos(angle) * outer, 92 + Math.sin(angle) * outer);
            }
            g.stroke();
        }

    },
    drawSideCelebrationCannons: function (g: Graphics, time: number): void {
        const colors = [
            new Color(255, 126, 166, 255),
            new Color(255, 220, 92, 255),
            new Color(101, 218, 255, 255),
            new Color(139, 235, 151, 255),
            new Color(198, 151, 255, 255),
        ];
        for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
            const side = sideIndex === 0 ? -1 : 1;
            const baseX = side * 312;
            const baseY = -126;
            const burst = Math.max(0, 1 - Math.abs(time - 0.32) / 0.32);
            if (burst > 0) {
                g.fillColor = new Color(255, 245, 166, Math.floor(110 * burst));
                g.circle(baseX, baseY, 34 + burst * 34);
                g.fill();
            }
            for (let i = 0; i < 9; i++) {
                const local = time - 0.15 - i * 0.035;
                if (local < 0 || local > 0.95) continue;
                const p = this.easeOutCubic(local / 0.95);
                const angle = (-side * Math.PI * (0.78 + i * 0.035)) + (side < 0 ? Math.PI : 0);
                const length = 72 + i * 7;
                const x1 = baseX + side * 16;
                const y1 = baseY + 8;
                const x2 = x1 + Math.cos(angle) * length * p;
                const y2 = y1 + Math.sin(angle) * length * p + 154 * p;
                const alpha = Math.floor(205 * (1 - Math.max(0, p - 0.72) / 0.28));
                g.strokeColor = new Color(colors[i % colors.length].r, colors[i % colors.length].g, colors[i % colors.length].b, alpha);
                g.lineWidth = 5;
                g.lineCap = Graphics.LineCap.ROUND;
                g.moveTo(x1, y1);
                g.lineTo(x2, y2);
                g.stroke();
            }
        }
    },
    drawCelebrationConfetti: function (g: Graphics, time: number): void {
        for (let i = 0; i < this.celebrationPieces.length; i++) {
            const p = this.celebrationPieces[i];
            const cycle = p.life + this.CELEBRATION_PARTICLE_LOOP_GAP + this.celebrationRand(i + 401) * 1.2;
            const local = this.getLoopedLocalTime(time, p.delay, p.life, cycle);
            if (local <= 0 || local >= p.life) continue;
            const isRain = p.kind === 'confetti' && p.y > 240;
            const drag = p.kind === 'coin' ? 2.1 : (isRain ? 0.7 : 1.18);
            const travel = (1 - Math.exp(-drag * local)) / drag;
            const wind = p.kind === 'coin'
                ? Math.sin(local * 8 + p.rot) * 18
                : Math.sin(time * (isRain ? 1.05 : 1.45) + p.phase) * (isRain ? 34 : 22) + Math.sin(local * 2.7 + p.delay) * (isRain ? 18 : 12);
            const fall = p.kind === 'coin'
                ? 235 * local * local
                : (isRain ? 24 * local + 24 * local * local : 62 * local * local + Math.max(0, local - 1.25) * Math.max(0, local - 1.25) * 54);
            const x = p.x + p.vx * travel + wind;
            const y = p.y + p.vy * travel - fall;
            const fadeIn = Math.min(1, local / 0.18);
            const fade = 1 - Math.max(0, local / p.life - 0.72) / 0.28;
            const alpha = Math.floor((p.kind === 'coin' ? 245 : 225) * fadeIn * Math.max(0, Math.min(1, fade)));
            if (p.kind === 'coin') {
                if (this.isCelebrationEffectVisible(x, y, p.size)) {
                    this.drawCelebrationCoin(g, x, y, p.size, alpha);
                }
            } else {
                this.drawFlowerPetal(g, x, y, p, local, alpha, isRain ? 0.98 : 1.18);
            }
        }
    },
    drawAmbientCelebrationCoins: function (g: Graphics, time: number): void {
        if (this.isGuideSettlementActive) return;
        if (time < 1) return;
        for (let i = 0; i < 5; i++) {
            const life = 5.8 + (i % 3) * 0.7;
            const local = this.getLoopedLocalTime(time, 0.7 + i * 0.22, life, life + 1.4 + i * 0.18);
            if (local <= 0 || local >= life) continue;
            const ratio = local / life;
            const fromLeft = i % 2 === 0;
            const x = (fromLeft ? -320 : 320) + (fromLeft ? 1 : -1) * local * (30 + i * 4) + Math.sin(time * 1.7 + i) * 24;
            const y = 120 + Math.sin(i * 1.7) * 110 + local * 78 - 48 * local * local;
            const lowerFade = y < -230 ? Math.max(0, (y + 340) / 110) : 1;
            const alpha = Math.floor(160 * lowerFade * (1 - Math.max(0, ratio - 0.76) / 0.24));
            if (alpha > 0 && this.isCelebrationEffectVisible(x, y, 14)) {
                this.drawCelebrationCoin(g, x, y, 7 + (i % 3) * 2, alpha);
            }
        }
    },
    drawFlowerPetal: function (g: Graphics, x: number, y: number, p: CelebrationPiece, local: number, alpha: number, scale: number): void {
        if (alpha <= 0) return;
        const size = p.size * scale;
        if (!this.isCelebrationEffectVisible(x, y, size * 1.8)) return;

        const spin = p.rot + p.vr * local;
        const pulse = 0.88 + Math.abs(Math.sin(local * 3.8 + p.phase)) * 0.16;
        const petalCount = p.widthRatio > 1.05 ? 5 : 4;
        const orbit = size * 0.34 * pulse;
        const petalRadius = Math.max(2.6, size * 0.22 * pulse);
        const petalAlpha = Math.floor(alpha * 0.82);
        const glowAlpha = Math.floor(alpha * 0.18);

        g.fillColor = new Color(255, 255, 255, glowAlpha);
        g.circle(x, y, size * 0.78);
        g.fill();
        if (p.widthRatio > 1.05) {
            g.fillColor = new Color(p.color.r, p.color.g, p.color.b, Math.floor(alpha * 0.92));
            const w = size * p.widthRatio;
            const h = Math.max(3, size * p.heightRatio);
            const dx = Math.cos(spin) * w * 0.5;
            const dy = Math.sin(spin) * w * 0.5;
            g.lineWidth = h;
            g.lineCap = Graphics.LineCap.ROUND;
            g.strokeColor = g.fillColor;
            g.moveTo(x - dx, y - dy);
            g.lineTo(x + dx, y + dy);
            g.stroke();
            g.fillColor = new Color(255, 255, 255, Math.floor(alpha * 0.35));
            g.circle(x - dx * 0.28, y - dy * 0.28, Math.max(1.6, h * 0.24));
            g.fill();
        } else {
            for (let i = 0; i < petalCount; i++) {
                const angle = spin + Math.PI * 2 * i / petalCount;
                g.fillColor = new Color(p.color.r, p.color.g, p.color.b, petalAlpha);
                g.circle(x + Math.cos(angle) * orbit, y + Math.sin(angle) * orbit, petalRadius * (0.88 + (i % 2) * 0.12));
                g.fill();
            }
            g.fillColor = new Color(255, 237, 118, Math.floor(alpha * 0.9));
            g.circle(x, y, Math.max(1.8, size * 0.13));
            g.fill();
        }
    },
    getLoopedLocalTime: function (time: number, delay: number, life: number, cycle: number): number {
        const raw = time - delay;
        if (raw < 0) return -1;
        const safeCycle = Math.max(life + 0.05, cycle);
        return raw % safeCycle;
    },
    drawCelebrationCoin: function (g: Graphics, x: number, y: number, radius: number, alpha: number): void {
        g.fillColor = new Color(255, 202, 45, alpha);
        g.circle(x, y, radius);
        g.fill();
        g.strokeColor = new Color(255, 244, 148, alpha);
        g.lineWidth = 4;
        g.circle(x, y, radius * 0.72);
        g.stroke();
    },
    isCelebrationEffectVisible: function (x: number, y: number, margin = 0): boolean {
        const left = -this.CELEBRATION_WIDTH / 2 - margin;
        const right = this.CELEBRATION_WIDTH / 2 + margin;
        const top = this.CELEBRATION_HEIGHT / 2 - 96 + margin;
        const bottom = -this.CELEBRATION_HEIGHT / 2 + 22 - margin;
        return x >= left && x <= right && y <= top && y >= bottom;
    },
    celebrationRand: function (seed: number): number {
        const x = Math.sin(seed * 12.9898) * 43758.5453;
        return x - Math.floor(x);
    },
    easeOutCubic: function (t: number): number {
        const clamped = Math.max(0, Math.min(1, t));
        return 1 - Math.pow(1 - clamped, 3);
    },
    easeOutBack: function (t: number, overshoot = 1.70158): number {
        const clamped = Math.max(0, Math.min(1, t));
        const p = clamped - 1;
        return 1 + (overshoot + 1) * p * p * p + overshoot * p * p;
    },
    });
}
