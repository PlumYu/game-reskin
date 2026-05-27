import { Color, Graphics } from 'cc';

export type BalloonVisualState = 'normal' | 'found' | 'pop';

export function getBalloonVisualSize(maxWidth: number, maxHeight: number): { width: number; height: number } {
    const size = Math.max(1, Math.floor(Math.min(maxWidth, maxHeight)));
    return { width: size, height: size };
}

export function drawBalloonVisual(g: Graphics, width: number, height: number, baseColor: Color, state: BalloonVisualState = 'normal'): void {
    g.clear();

    const size = Math.max(1, Math.min(width, height));
    const rx = size * 0.305;
    const ry = size * 0.38;
    const cx = 0;
    const cy = size * 0.095;
    const found = state === 'found';
    const pop = state === 'pop';
    const alpha = pop ? 215 : 255;
    const base = normalizeLatexColor(baseColor, alpha);
    const rim = mixColor(base, new Color(15, 24, 38, 255), found ? 0.28 : 0.22, alpha);
    const lowerRim = mixColor(base, new Color(6, 12, 22, 255), found ? 0.34 : 0.28, found ? 96 : 82);
    const middle = mixColor(base, new Color(255, 255, 255, 255), found ? 0.18 : 0.1, Math.floor(alpha * 0.96));
    const upperGlow = mixColor(base, new Color(255, 255, 255, 255), 0.36, found ? 94 : 76);
    const broadHighlight = new Color(255, 255, 255, found ? 150 : 118);
    const sharpHighlight = new Color(255, 255, 255, found ? 232 : 208);
    const glow = mixColor(base, new Color(255, 255, 255, 255), 0.6, found ? 116 : 0);

    if (found) {
        g.fillColor = glow;
        g.ellipse(cx, cy, rx * 1.22, ry * 1.1);
        g.fill();
    }

    g.fillColor = new Color(32, 42, 58, found ? 50 : 34);
    g.ellipse(cx + rx * 0.08, cy - ry * 0.13, rx * 0.98, ry * 0.9);
    g.fill();

    g.fillColor = rim;
    g.ellipse(cx + rx * 0.035, cy - ry * 0.045, rx, ry);
    g.fill();

    g.fillColor = base;
    g.ellipse(cx - rx * 0.025, cy + ry * 0.025, rx * 0.96, ry * 0.985);
    g.fill();

    for (let i = 0; i < 8; i++) {
        const t = i / 7;
        const layerColor = mixColor(middle, new Color(255, 255, 255, 255), t * 0.13, Math.floor((found ? 72 : 58) * (1 - t * 0.58)));
        g.fillColor = layerColor;
        g.ellipse(
            cx - rx * (0.12 + t * 0.08),
            cy + ry * (0.1 + t * 0.06),
            rx * (0.78 - t * 0.12),
            ry * (0.78 - t * 0.14)
        );
        g.fill();
    }

    g.fillColor = lowerRim;
    g.ellipse(cx + rx * 0.2, cy - ry * 0.42, rx * 0.58, ry * 0.34);
    g.fill();

    g.fillColor = upperGlow;
    g.ellipse(cx - rx * 0.36, cy + ry * 0.45, rx * 0.26, ry * 0.18);
    g.fill();

    g.fillColor = broadHighlight;
    g.ellipse(cx - rx * 0.47, cy + ry * 0.53, rx * 0.105, ry * 0.07);
    g.fill();
    g.fillColor = sharpHighlight;
    g.ellipse(cx - rx * 0.49, cy + ry * 0.56, rx * 0.052, ry * 0.035);
    g.fill();

    g.fillColor = new Color(255, 255, 255, found ? 72 : 56);
    g.ellipse(cx - rx * 0.16, cy + ry * 0.17, rx * 0.18, ry * 0.12);
    g.fill();

    g.strokeColor = mixColor(base, new Color(255, 255, 255, 255), 0.42, found ? 86 : 66);
    g.lineWidth = Math.max(1, size * 0.009);
    g.ellipse(cx - rx * 0.02, cy + ry * 0.025, rx * 0.955, ry * 0.98);
    g.stroke();

    drawKnot(g, size, cx, cy - ry * 0.9, base, rim, found);

    if (found) {
        drawFoundMark(g, size);
    }
}

function drawKnot(g: Graphics, size: number, x: number, y: number, base: Color, rim: Color, found: boolean): void {
    const neckW = Math.max(4, size * 0.07);
    const neckH = Math.max(3, size * 0.045);
    const knotW = Math.max(6, size * 0.105);
    const knotH = Math.max(4, size * 0.054);
    const dark = mixColor(rim, new Color(10, 14, 20, 255), 0.1, found ? 245 : 228);

    g.fillColor = mixColor(base, new Color(20, 25, 35, 255), 0.22, found ? 245 : 235);
    g.moveTo(x - neckW * 0.48, y + neckH * 0.28);
    g.lineTo(x + neckW * 0.48, y + neckH * 0.28);
    g.lineTo(x + neckW * 0.28, y - neckH * 0.6);
    g.lineTo(x - neckW * 0.28, y - neckH * 0.6);
    g.close();
    g.fill();

    g.fillColor = dark;
    g.ellipse(x, y - knotH * 0.58, knotW * 0.5, knotH * 0.46);
    g.fill();
    g.fillColor = mixColor(base, new Color(255, 255, 255, 255), 0.08, found ? 235 : 220);
    g.ellipse(x - knotW * 0.08, y - knotH * 0.45, knotW * 0.36, knotH * 0.32);
    g.fill();

    g.strokeColor = new Color(35, 45, 58, found ? 92 : 70);
    g.lineWidth = Math.max(0.8, size * 0.007);
    g.moveTo(x, y - knotH * 0.92);
    g.lineTo(x, y - knotH * 1.16);
    g.stroke();
}

function drawFoundMark(g: Graphics, size: number): void {
    const markSize = size * 0.17;
    const y = size * 0.1;
    g.strokeColor = new Color(255, 255, 255, 230);
    g.lineWidth = Math.max(3, size * 0.038);
    g.moveTo(-markSize * 0.78, y - markSize * 0.08);
    g.lineTo(-markSize * 0.22, y - markSize * 0.62);
    g.lineTo(markSize * 0.86, y + markSize * 0.52);
    g.stroke();
}

function normalizeLatexColor(color: Color, alpha: number): Color {
    return new Color(
        clampChannel(color.r * 0.96 + 12),
        clampChannel(color.g * 0.96 + 12),
        clampChannel(color.b * 0.96 + 12),
        alpha
    );
}

function mixColor(color: Color, target: Color, amount: number, alpha: number): Color {
    const t = Math.max(0, Math.min(1, amount));
    return new Color(
        clampChannel(color.r + (target.r - color.r) * t),
        clampChannel(color.g + (target.g - color.g) * t),
        clampChannel(color.b + (target.b - color.b) * t),
        clampChannel(alpha)
    );
}

function clampChannel(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
}
