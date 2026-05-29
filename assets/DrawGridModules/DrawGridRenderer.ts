import { Graphics, Color, Vec3, v3, input, Input, EventTouch, tween, SpriteFrame, Node, Sprite, UITransform as CcUITransform, Label, EditBox, director, Layers, Texture2D, UIOpacity, view, Button, Widget } from 'cc';
import GameApp from '../Core/GameApp';
import { GameMode, UIID } from '../Core/Enum';
import UIManager from '../Core/UIManager';
import CountdownController from '../Core/CountdownController';
import SfxManager from '../Core/SfxManager';
import TiliManager from '../Core/TiliManager';
import AssetService from '../Core/AssetService';
import { createLabel, createNode, createFullScreenOverlay, createCircle, addButtonFeedback, createRoundedCard, COLOR_GOLD, COLOR_WHITE, COLOR_TOOLBAR_BG, RADIUS_MD, getScreenSize } from '../Utils/UIBuilder';
import { generateRandomLevel } from '../Game/LevelGenerator';
import { generateDailyChallengeLevel } from '../Game/DailyChallengeLevelGenerator';
import { applyLevelConfigData, isValidLevelConfig, type LevelConfigData } from '../Game/LevelConfig';
import { pickSurvivalLevel } from '../Game/SurvivalConfig';
import PerfDebug from '../Utils/PerfDebug';
type HiddenChallengeConfig = {
    key: 'noMistake' | 'noHint' | 'fastClear' | 'firstTry' | 'markFive' | 'steadyFinish';
    text: string;
};
type CowIdleActionKind = 'idle1' | 'idle2' | 'found';
type CowFrameLayout = {
    scale: number;
    x: number;
    y: number;
};
type BalloonFloatState = {
    x: number;
    y: number;
    angle: number;
    scale: number;
};
export function installDrawGridRenderer(target: any): void {
    Object.assign(target.prototype, {
    ensureBoardGraphicsLayers: function (): void {
        if (!this.rootGraphics) {
            this.rootGraphics = this.graphics || this.getComponent(Graphics) || null;
            this.rootGraphics?.clear();
        }
        const createLayer = (name: string, siblingIndex: number): Graphics => {
            let node = this.node.getChildByName(name);
            if (!node || !node.isValid) {
                node = new Node(name);
                this.setUILayer(node);
                node.parent = this.node;
                node.addComponent(CcUITransform);
                node.addComponent(Graphics);
            }
            node.setSiblingIndex(siblingIndex);
            return node.getComponent(Graphics)!;
        };
        this.staticBoardGraphics = this.staticBoardGraphics && this.staticBoardGraphics.node?.isValid
            ? this.staticBoardGraphics
            : createLayer('BoardStaticLayer', 0);
        this.dynamicBoardGraphics = this.dynamicBoardGraphics && this.dynamicBoardGraphics.node?.isValid
            ? this.dynamicBoardGraphics
            : createLayer('BoardDynamicLayer', 5);
        this.graphics = this.dynamicBoardGraphics;
    },
    invalidateStaticBoard: function (): void {
        this.staticBoardDirty = true;
    },
    getStaticBoardSignature: function (layout: any): string {
        return [
            this.gridSize,
            Math.round(layout.squareSize * 100) / 100,
            Math.round(layout.totalContentSize * 100) / 100,
            this.gridColors.join('|'),
        ].join(':');
    },
    renderStaticBoard: function (layout: any): void {
        this.ensureBoardGraphicsLayers();
        const g = this.staticBoardGraphics as Graphics | null;
        if (!g) return;
        const signature = this.getStaticBoardSignature(layout);
        if (!this.staticBoardDirty && this.staticBoardSignature === signature) {
            PerfDebug.count('staticBoard.skip');
            return;
        }
        const staticStartedAt = PerfDebug.enabled ? PerfDebug.now() : 0;
        PerfDebug.mark('DrawGrid.renderStaticBoard refresh', { gridSize: layout.gridSize, cells: layout.gridSize * layout.gridSize });
        g.clear();
        this.drawFrostedGridContainer(g, layout.startX, layout.startY, layout.totalContentSize, layout.squareSize, layout.gridSize);
        for (let i = 0; i < layout.gridSize * layout.gridSize; i++) {
            const row = Math.floor(i / layout.gridSize);
            const col = i % layout.gridSize;
            const baseX = layout.startX + col * (layout.squareSize + layout.gridGap);
            const baseY = layout.startY + row * (layout.squareSize + layout.gridGap);
            this.drawGlassCellPocket(g, baseX, baseY, layout.squareSize, 12);
        }
        this.drawGlassGridOverlay(g, layout.startX, layout.startY, layout.totalContentSize, layout.squareSize, layout.gridSize);
        this.staticBoardSignature = signature;
        this.staticBoardDirty = false;
        PerfDebug.count('staticBoard.refresh');
        PerfDebug.slow('DrawGrid.renderStaticBoard', staticStartedAt, 40, {
            gridSize: layout.gridSize,
            cells: layout.gridSize * layout.gridSize,
        });
    },
    getBoardSize: function (gridSize: number = this.gridSize): number {
        if (gridSize >= 11) return 720;
        if (gridSize >= 9) return 680;
        return this.BG_SIZE;
    },
    getGridGap: function (gridSize: number = this.gridSize): number {
        if (gridSize >= 11) return 4;
        if (gridSize >= 9) return 6;
        return this.GRID_GAP;
    },
    getBalloonCellVisualScale: function (gridSize: number = this.gridSize): number {
        if (gridSize >= 11) return 1.32;
        if (gridSize >= 9) return 1.23;
        return this.BALLOON_CELL_VISUAL_SCALE;
    },
    getGridContainerVisualInset: function (gridSize: number = this.gridSize): number {
        if (gridSize >= 11) return 10;
        if (gridSize >= 9) return 8;
        return 4;
    },
    getCoordinateLabelOffset: function (gridSize: number = this.gridSize): number {
        if (gridSize >= 11) return 20;
        if (gridSize >= 9) return 26;
        return 35;
    },
    getGridLayoutMetrics: function () {
        const gridSize = this.gridSize;
        const boardSize = this.getBoardSize(gridSize);
        const gridGap = this.getGridGap(gridSize);
        const squareSize = (boardSize - this.GRID_PADDING * 2 - (gridSize - 1) * gridGap) / gridSize;
        const totalContentSize = gridSize * squareSize + (gridSize - 1) * gridGap;
        const startX = -totalContentSize / 2;
        const startY = -totalContentSize / 2;
        return {
            gridSize,
            boardSize,
            gridGap,
            squareSize,
            totalContentSize,
            startX,
            startY,
            pitch: squareSize + gridGap,
        };
    },
    makeColor: function (hex: string, brightness = 1, alpha = 255): Color {
        if (!hex) return new Color(200, 200, 200, alpha);
        const normalized = hex.replace('#', '');
        const value = parseInt(normalized, 16);
        const r = Math.min(255, Math.max(0, Math.floor(((value >> 16) & 255) * brightness)));
        const g = Math.min(255, Math.max(0, Math.floor(((value >> 8) & 255) * brightness)));
        const b = Math.min(255, Math.max(0, Math.floor((value & 255) * brightness)));
        return new Color(r, g, b, alpha);
    },
    drawCellBlock: function (g: Graphics, x: number, y: number, size: number, radius: number, colorHex: string) {
        if (!colorHex) return;
        const depth = Math.max(2, size * 0.055);
        g.fillColor = this.makeColor(colorHex, 0.72, 230);
        g.roundRect(x + depth * 0.4, y - depth, size, size, radius);
        g.fill();

        g.fillColor = new Color().fromHEX(colorHex);
        g.roundRect(x, y, size, size, radius);
        g.fill();

        g.strokeColor = new Color(255, 255, 255, 72);
        g.lineWidth = Math.max(1, size * 0.025);
        g.roundRect(x + 1, y + 1, size - 2, size - 2, Math.max(2, radius - 1));
        g.stroke();
    },
    drawFrostedGridContainer: function (g: Graphics, startX: number, startY: number, contentSize: number, squareSize: number, gridSize: number): void {
        const boardSize = this.getBoardSize(gridSize);
        const inset = this.getGridContainerVisualInset(gridSize);
        const x = -boardSize / 2 + inset;
        const y = -boardSize / 2 + inset;
        const w = boardSize - inset * 2;
        const h = boardSize - inset * 2;
        const radius = Math.max(26, 36 - inset * 0.45);

        g.fillColor = new Color(26, 55, 78, 24);
        g.roundRect(x + 3, y - 5, w, h, radius + 2);
        g.fill();
        g.fillColor = new Color(55, 98, 128, 12);
        g.roundRect(x + 6, y - 9, w - 4, h - 2, radius + 1);
        g.fill();

        g.fillColor = new Color(225, 245, 255, 86);
        g.roundRect(x, y, w, h, radius);
        g.fill();

        g.fillColor = new Color(255, 255, 255, 56);
        g.roundRect(x + 6, y + 6, w - 12, h - 12, radius - 5);
        g.fill();

        g.fillColor = new Color(189, 223, 242, 36);
        g.roundRect(x + 13, y + 12, w - 26, h - 25, radius - 11);
        g.fill();

        g.lineCap = Graphics.LineCap.ROUND;
        g.lineJoin = Graphics.LineJoin.ROUND;

        g.strokeColor = new Color(94, 133, 158, 80);
        g.lineWidth = 2.4;
        g.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, radius - 2);
        g.stroke();

        g.strokeColor = new Color(255, 255, 255, 150);
        g.lineWidth = 3;
        g.roundRect(x + 5, y + 5, w - 10, h - 10, radius - 6);
        g.stroke();

        g.strokeColor = new Color(40, 78, 105, 42);
        g.lineWidth = 2;
        g.roundRect(x + 11, y + 9, w - 22, h - 20, radius - 12);
        g.stroke();

        g.strokeColor = new Color(255, 255, 255, 182);
        g.lineWidth = 2;
        g.moveTo(x + radius * 0.75, y + h - 7);
        g.lineTo(x + w - radius * 0.86, y + h - 7);
        g.moveTo(x + 7, y + radius * 0.86);
        g.lineTo(x + 7, y + h - radius * 0.86);
        g.stroke();

        g.strokeColor = new Color(48, 83, 108, 35);
        g.lineWidth = 2.2;
        g.moveTo(x + radius * 0.8, y + 8);
        g.lineTo(x + w - radius * 0.78, y + 8);
        g.moveTo(x + w - 8, y + radius * 0.78);
        g.lineTo(x + w - 8, y + h - radius * 0.8);
        g.stroke();

        g.fillColor = new Color(255, 255, 255, 20);
        g.roundRect(startX - 5, startY - 5, contentSize + 10, contentSize + 10, 16);
        g.fill();
    },
    drawGlassGridOverlay: function (g: Graphics, startX: number, startY: number, contentSize: number, squareSize: number, gridSize: number): void {
        const gridGap = this.getGridGap(gridSize);
        const lineMinX = startX - gridGap * 0.18;
        const lineMaxX = startX + contentSize + gridGap * 0.18;
        const lineMinY = startY - gridGap * 0.18;
        const lineMaxY = startY + contentSize + gridGap * 0.18;
        for (let i = 1; i < gridSize; i++) {
            const p = startX + i * squareSize + (i - 0.5) * gridGap;
            this.drawRubberGridTube(g, p, lineMinY, p, lineMaxY);
            this.drawRubberGridTube(g, lineMinX, p, lineMaxX, p);
        }

        this.drawRubberGridTube(g, startX, startY, startX + contentSize, startY, 0.72);
        this.drawRubberGridTube(g, startX, startY + contentSize, startX + contentSize, startY + contentSize, 0.72);
        this.drawRubberGridTube(g, startX, startY, startX, startY + contentSize, 0.72);
        this.drawRubberGridTube(g, startX + contentSize, startY, startX + contentSize, startY + contentSize, 0.72);
    },
    drawRubberGridTube: function (g: Graphics, x1: number, y1: number, x2: number, y2: number, opacityScale: number = 1): void {
        g.lineCap = Graphics.LineCap.ROUND;
        g.strokeColor = new Color(106, 154, 184, Math.floor(92 * opacityScale));
        g.lineWidth = 2.2;
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
    },
    drawGlassCellPocket: function (g: Graphics, x: number, y: number, size: number, radius: number): void {
        const r = Math.max(5, radius);
        g.fillColor = new Color(122, 181, 214, 24);
        g.roundRect(x + 1, y - 2, size - 2, size - 1, r);
        g.fill();

        g.fillColor = new Color(236, 250, 255, 48);
        g.roundRect(x + 2, y + 2, size - 4, size - 4, Math.max(4, r - 2));
        g.fill();

        g.fillColor = new Color(255, 255, 255, 28);
        g.roundRect(x + 5, y + size * 0.5, size - 10, size * 0.4 - 5, Math.max(4, r - 5));
        g.fill();

    },
    drawCowRevealEffect: function (g: Graphics, centerX: number, centerY: number, size: number, progress: number) {
        if (progress <= 0) {
            return;
        }

        const t = Math.max(0, Math.min(1, progress));
        const fade = 1 - t;
        const pulse = Math.sin(t * Math.PI);
        const flashRadius = size * (0.24 + t * 0.18);

        g.fillColor = new Color(255, 246, 126, Math.floor(34 * pulse));
        g.circle(centerX, centerY, flashRadius);
        g.fill();

        g.strokeColor = new Color(255, 232, 92, Math.floor(96 * fade));
        g.lineWidth = Math.max(1.5, size * 0.028 * fade);
        g.circle(centerX, centerY, size * (0.18 + t * 0.34));
        g.stroke();

        g.strokeColor = new Color(255, 255, 255, Math.floor(82 * pulse));
        g.lineWidth = Math.max(1, size * 0.018 * pulse);
        g.circle(centerX, centerY, size * (0.12 + t * 0.16));
        g.stroke();

        const rayCount = 8;
        const inner = size * (0.14 + t * 0.12);
        const outer = size * (0.34 + t * 0.3);
        g.strokeColor = new Color(255, 248, 180, Math.floor(110 * fade));
        g.lineWidth = Math.max(1, size * 0.018 * fade);
        for (let i = 0; i < rayCount; i++) {
            const angle = (Math.PI * 2 * i / rayCount) + t * 0.45;
            const sx = centerX + Math.cos(angle) * inner;
            const sy = centerY + Math.sin(angle) * inner;
            const ex = centerX + Math.cos(angle) * outer;
            const ey = centerY + Math.sin(angle) * outer;
            g.moveTo(sx, sy);
            g.lineTo(ex, ey);
        }
        g.stroke();
    },
    renderGrid: function () {
        const renderStartedAt = PerfDebug.enabled ? PerfDebug.now() : 0;
        if (PerfDebug.enabled) PerfDebug.count('renderGrid.total');
        this.ensureBoardGraphicsLayers();
        if (!this.graphics) return;
        const g = this.graphics;
        if (!GameApp.isStartGame) {
            g.clear();
            this.staticBoardGraphics?.clear();
            this.staticBoardSignature = '';
            this.staticBoardDirty = true;
            this.balloonCellNodes.forEach(node => { if (node && node.isValid) node.active = false; });
            this.balloonPopNodes.forEach(node => { if (node && node.isValid) node.active = false; });
            this.cowNodes.forEach(node => { if (node && node.isValid) node.active = false; });
            this.coordinateNodes.forEach(node => { if (node && node.isValid) node.active = false; });
            this.balloonCellBasePositions.fill(null);
            this.balloonCowBasePositions.fill(null);
            return;
        }
        g.clear();

        if (this.gridColors.length === 0) {
            if (GameApp.gameMode === GameMode.level) {
                this.initGrid(() => this.renderGrid());
            }
            return;
        }

        const layout = this.getGridLayoutMetrics();
        const gridSize = layout.gridSize;
        if (PerfDebug.enabled) PerfDebug.count(`renderGrid.${gridSize}x${gridSize}`);
        const gridGap = layout.gridGap;
        const squareSizeReady = layout.squareSize;
        const totalContentSize = layout.totalContentSize;
        const startX = layout.startX;
        const startY = layout.startY;

        this.renderStaticBoard(layout);

        // 清理/重置目标显示
        this.updateCowNodes();
        this.updateBalloonCellNodes();
        // 清理坐标显示
        this.updateCoordinateNodes();

        // 2. 棋子与标记
        for (let i = 0; i < gridSize * gridSize; i++) {
            const row = Math.floor(i / gridSize);
            const col = i % gridSize;
            const basePos = v3(
                startX + col * (squareSizeReady + gridGap) + (this.squareShakeOffsets[i] || 0),
                startY + row * (squareSizeReady + gridGap),
                0
            );

            const introScale = this.introScales[i] ?? 1;
            const scale = this.squareScales[i] * introScale;
            if (scale <= 0.01) {
                continue;
            }
            const currentSize = squareSizeReady * scale;
            const offset = (squareSizeReady - currentSize) / 2;

            const xOffset = basePos.x + offset;
            const yOffset = basePos.y + offset;
            const centerX = basePos.x + squareSizeReady / 2;
            const centerY = basePos.y + squareSizeReady / 2;
            const hasBalloon = this.hasVisibleBalloonCell(i);
            if (!hasBalloon) {
                this.drawCellBlock(g, xOffset, yOffset, currentSize, 15 * scale, this.gridColors[i]);
            }

            if (hasBalloon) {
                this.showBalloonCellVisual(i, centerX, centerY, squareSizeReady, scale);
            }

            // 1. 已翻开显示
            if (this.revealedSquares[i]) {
                if (this.cowPositions[i]) {
                    // 显示目标
                    const cowNode = this.getCowNode(i);
                    const visualNode = this.getCowVisualNode(cowNode, i);
                    const visualSprite = visualNode.getComponent(Sprite);
                    if (
                        visualSprite &&
                        this.hasBalloonCowFrame(i) &&
                        !this.cowFoundActionActive[i] &&
                        !this.cowIdleColorActionActive[i]
                    ) {
                        visualSprite.trim = false;
                        visualSprite.spriteFrame = this.getCowRestSpriteFrame(i);
                    }
                    cowNode.active = true;
                    cowNode.setPosition(this.snapPixelPosition(centerX), this.snapPixelPosition(centerY));
                    cowNode.getComponent(CcUITransform)!.setContentSize(this.snapPixelValue(squareSizeReady), this.snapPixelValue(squareSizeReady));
                    const cowBasePosition = v3(centerX, centerY, 0);
                    this.balloonCowBasePositions[i] = cowBasePosition;
                    this.balloonCowBaseSizes[i] = squareSizeReady * scale;
                    if (this.ENABLE_BALLOON_FLOAT) {
                        this.applyBalloonFloatToNode(cowNode, i, cowBasePosition, this.balloonCowBaseSizes[i], 1);
                    } else {
                        cowNode.setPosition(this.snapPixelPosition(centerX), this.snapPixelPosition(centerY), 0);
                        cowNode.angle = 0;
                        cowNode.setScale(v3(1, 1, 1));
                    }
                    this.drawCowRevealEffect(g, centerX, centerY, squareSizeReady, this.cowHaloProgress[i] || 0);
                    if (!this.cowSpawnedOnce[i]) {
                        this.cowSpawnedOnce[i] = true;
                        visualNode.setPosition(v3(0, 0, 0));
                        visualNode.setScale(v3(1, 1, 1));
                        this.startCowIdleAnimation(i);
                    }
                    const revealVisualScale = Math.max(0.01, this.cowRevealVisualScales[i] || 1);
                    const visualSizeScale = hasBalloon ? this.FOUND_COW_DANCE_VISUAL_SCALE : 0.96;
                    const visualSize = squareSizeReady * visualSizeScale * scale * revealVisualScale;

                    // 保持原比例计算大小
                    const currentFrame = visualNode.getComponent(Sprite)?.spriteFrame || this.getCowRestSpriteFrame(i);
                    if (currentFrame) {
                        const fitted = this.getPixelPerfectFitSize(currentFrame, visualSize, visualSize);
                        visualNode.getComponent(CcUITransform)!.setContentSize(fitted.width, fitted.height);
                    }
                    const revealOffsetY = this.cowRevealVisualOffsets[i] || 0;
                    if (revealOffsetY !== 0) {
                        visualNode.setPosition(v3(0, this.snapPixelPosition(revealOffsetY), 0));
                    }
                } else {
                    // 非目标显示红色 X
                    if (!hasBalloon) {
                        this.drawAnimatedX(xOffset, yOffset, currentSize, this.xAnimationProgress[i], this.WRONG_REVEAL_X_COLOR);
                    }
                }
            } else {
                // 2. 未翻开，如果标记了 X，显示白色 X (Marker)
                if (this.clickedSquares[i] || (this.xAnimationProgress[i] || 0) > 0.01) {
                    if (!hasBalloon) {
                        this.drawAnimatedX(xOffset, yOffset, currentSize, this.xAnimationProgress[i] ?? 1, Color.WHITE);
                    }
                }
            }
        }

        // 3. 坐标绘制 (只有开启时显示)
        if (this.showCoordinates) {
            const coordOffset = this.getCoordinateLabelOffset(gridSize);
            for (let i = 0; i < gridSize; i++) {
                // 下方数字 (X 轴: 1, 2, 3...) 从左往右
                const bottomNode = this.getCoordNode(`CoordX_${i}`);
                bottomNode.active = true;
                const posX = startX + i * (squareSizeReady + gridGap) + squareSizeReady / 2;
                const posY = startY - coordOffset; // 偏移到网格下方
                bottomNode.setPosition(posX, posY);
                bottomNode.getComponent(Label)!.string = (i + 1).toString();

                // 左侧数字 (Y 轴: 1, 2, 3...) 从下往上
                const leftNode = this.getCoordNode(`CoordY_${i}`);
                leftNode.active = true;
                const lPosX = startX - coordOffset; // 偏移到网格左侧
                const lPosY = startY + i * (squareSizeReady + gridGap) + squareSizeReady / 2;
                leftNode.setPosition(lPosX, lPosY);
                leftNode.getComponent(Label)!.string = (i + 1).toString();
            }
        }
        if (PerfDebug.enabled) {
            const activeCount = (nodes: (Node | null | undefined)[]): number => {
                if (!nodes || nodes.length === 0) return 0;
                let count = 0;
                for (let i = 0; i < nodes.length; i++) {
                    const node = nodes[i];
                    if (node && node.isValid && node.active) count++;
                }
                return count;
            };
            PerfDebug.slow('DrawGrid.renderGrid', renderStartedAt, 60, {
                mode: GameApp.gameMode,
                gridSize,
                cells: gridSize * gridSize,
                children: this.node?.children?.length || 0,
                activeCowNodes: activeCount(this.cowNodes),
                activeBalloonNodes: activeCount(this.balloonCellNodes),
                activePopNodes: activeCount(this.balloonPopNodes),
                activeCoordNodes: activeCount(this.coordinateNodes),
                activeMarkAnimations: this.activeMarkAnimations || 0,
            });
        }
    },
    getGridCellVisualRect: function (index: number, startX: number, startY: number, squareSize: number): { x: number; y: number; size: number } {
        const row = Math.floor(index / this.gridSize);
        const col = index % this.gridSize;
        const gridGap = this.getGridGap(this.gridSize);
        const baseX = startX + col * (squareSize + gridGap) + (this.squareShakeOffsets[index] || 0);
        const baseY = startY + row * (squareSize + gridGap);
        const introScale = this.introScales[index] ?? 1;
        const scale = Math.max(0.01, (this.squareScales[index] || 1) * introScale);
        const currentSize = squareSize * scale;
        const offset = (squareSize - currentSize) / 2;
        return {
            x: baseX + offset,
            y: baseY + offset,
            size: currentSize
        };
    },
    getCellCornerRadius: function (size: number): number {
        return Math.max(8, Math.min(size * 0.5, size * 0.18));
    },
    getGridCellVisualRadius: function (index: number): number {
        const squareSize = (this.BG_SIZE - this.GRID_PADDING * 2 - (this.gridSize - 1) * this.GRID_GAP) / this.gridSize;
        const introScale = this.introScales[index] ?? 1;
        const scale = Math.max(0.01, (this.squareScales[index] || 1) * introScale);
        return this.getCellCornerRadius(squareSize * scale);
    },
    drawHintActionPulse: function (g: Graphics, x: number, y: number, size: number, radius: number, isExcludePreview: boolean = false) {
        const pulse = 0.35 + this.hintPulseProgress * 0.65;
        const expand = isExcludePreview ? 5 + this.hintPulseProgress * 7 : 4 + this.hintPulseProgress * 5;
        const outerAlpha = Math.floor((isExcludePreview ? 128 : 92) + (isExcludePreview ? 92 : 92) * pulse);
        const innerAlpha = Math.floor((isExcludePreview ? 172 : 150) + (isExcludePreview ? 66 : 90) * pulse);

        g.strokeColor = isExcludePreview
            ? new Color(255, 112, 36, outerAlpha)
            : new Color(255, 184, 28, outerAlpha);
        g.lineWidth = isExcludePreview ? 12 : 11;
        g.roundRect(x - expand, y - expand, size + expand * 2, size + expand * 2, radius + expand);
        g.stroke();

        g.strokeColor = isExcludePreview
            ? new Color(255, 250, 214, innerAlpha)
            : new Color(255, 242, 92, innerAlpha);
        g.lineWidth = isExcludePreview ? 5 : 4;
        g.roundRect(x - 2, y - 2, size + 4, size + 4, radius + 2);
        g.stroke();
    },
    drawHintCowInnerPulse: function (g: Graphics, x: number, y: number, size: number, radius: number) {
        const pulse = 0.35 + this.hintPulseProgress * 0.65;
        const edgeAlpha = Math.floor(190 + 58 * pulse);
        const innerAlpha = Math.floor(72 + 88 * pulse);

        g.strokeColor = new Color(255, 255, 255, edgeAlpha);
        g.lineWidth = 4;
        g.roundRect(x + 2, y + 2, size - 4, size - 4, Math.max(4, radius - 1));
        g.stroke();

        g.strokeColor = new Color(255, 255, 255, innerAlpha);
        g.lineWidth = 3;
        g.roundRect(x + 6, y + 6, size - 12, size - 12, Math.max(4, radius - 4));
        g.stroke();
    },
    updateBalloonCellNodes: function () {
        this.balloonCellNodes.forEach(node => {
            if (node && node.isValid) {
                node.active = false;
            }
        });
        this.balloonCellBasePositions.fill(null);
        this.balloonCowBasePositions.fill(null);
    },
    getBalloonCellNode: function (index: number): Node {
        if (!this.balloonCellNodes[index] || !this.balloonCellNodes[index].isValid) {
            const node = new Node(`BalloonCell_${index}`);
            this.setUILayer(node);
            node.addComponent(CcUITransform);
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            node.addComponent(Graphics);
            node.parent = this.node;
            node.setSiblingIndex(10);
            this.balloonCellNodes[index] = node;
        }
        return this.balloonCellNodes[index];
    },
    showBalloonCellVisual: function (index: number, centerX: number, centerY: number, cellSize: number, scale: number) {
        const node = this.getBalloonCellNode(index);
        const transform = node.getComponent(CcUITransform);
        const graphics = node.getComponent(Graphics);
        const sprite = node.getComponent(Sprite);
        if (!graphics || !transform || !sprite) return;

        node.active = true;
        node.setSiblingIndex(10);

        const backdropScale = this.revealedSquares[index] && this.cowPositions[index]
            ? Math.max(0, this.foundBalloonBackdropScales[index] ?? 1)
            : 1;
        const visualSize = cellSize * this.getBalloonCellVisualScale(this.gridSize) * Math.max(0.01, scale) * backdropScale;
        const frame = this.getBalloonSpriteFrame(index);
        if (!frame) {
            graphics.clear();
            sprite.spriteFrame = null;
            node.active = false;
            (node as any)._balloonVisualKey = 'missing-frame';
            return;
        }

        const fitted = this.getRawSpriteFrameFitSize(frame, visualSize, visualSize);
        const state = this.revealedSquares[index] && this.cowPositions[index] ? 'found' : 'normal';
        const color = this.getBalloonColor(index);
        const frameKey = (frame as any).uuid || (frame as any)._uuid || frame.name || 'frame';
        const visualKey = [
            frameKey,
            state,
            Math.round(fitted.width * 10) / 10,
            Math.round(fitted.height * 10) / 10,
            color.r,
            color.g,
            color.b,
        ].join(':');
        if ((node as any)._balloonVisualKey !== visualKey) {
            transform.setContentSize(fitted.width, fitted.height);
            graphics.clear();
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            sprite.spriteFrame = frame;
            (node as any)._balloonVisualKey = visualKey;
            PerfDebug.count('balloonVisual.refresh');
        } else {
            PerfDebug.count('balloonVisual.skip');
        }
        this.updateBalloonXOverlay(node, index, fitted.width, fitted.height);

        const basePosition = v3(centerX, centerY, 0);
        this.balloonCellBasePositions[index] = basePosition;
        this.balloonCellBaseSizes[index] = cellSize * Math.max(0.01, scale) * Math.max(0.01, backdropScale);
        const hasActiveX = (this.xAnimationProgress[index] || 0) > 0.01;
        if (!this.ENABLE_BALLOON_FLOAT) {
            this.applyJellyMotionToBalloonNode(node, index, basePosition, fitted.width, fitted.height, color);
            return;
        }
        if ((!this.revealedSquares[index] && (this.clickedSquares[index] || hasActiveX)) || (this.revealedSquares[index] && !this.cowPositions[index])) {
            if (this.jellyInteractionActive?.[index]) {
                this.applyJellyMotionToBalloonNode(node, index, basePosition, fitted.width, fitted.height, color);
            } else {
                node.setPosition(this.snapPixelPosition(centerX), this.snapPixelPosition(centerY), 0);
                node.angle = 0;
                node.setScale(v3(1, 1, 1));
                this.updateJellyEffectOverlay(node, index, fitted.width, fitted.height, color);
            }
            return;
        }
        this.applyBalloonFloatToNode(node, index, basePosition, this.balloonCellBaseSizes[index], 1);
    },
    updateBalloonXOverlay: function (balloonNode: Node, index: number, width: number, height: number) {
        const xNode = this.getBalloonXOverlayNode(balloonNode);
        const isWrongReveal = this.revealedSquares[index] && !this.cowPositions[index];
        const isMarked = !this.revealedSquares[index] && this.clickedSquares[index];
        const rawProgress = this.xAnimationProgress[index];
        const progress = rawProgress === undefined ? (isWrongReveal || isMarked ? 1 : 0) : Math.max(0, Math.min(1.08, rawProgress));
        const hasFadingX = progress > 0.01;
        if (!isWrongReveal && !isMarked && !hasFadingX) {
            xNode.active = false;
            (xNode as any)._balloonXKey = '';
            return;
        }

        xNode.active = true;
        xNode.setSiblingIndex(10);
        const color = isWrongReveal ? this.WRONG_REVEAL_X_COLOR : Color.WHITE;
        const xKey = [
            Math.round(width * 10) / 10,
            Math.round(height * 10) / 10,
            Math.round(progress * 100) / 100,
            color.r,
            color.g,
            color.b,
            isWrongReveal ? 1 : 0,
        ].join(':');
        if ((xNode as any)._balloonXKey === xKey) return;
        xNode.getComponent(CcUITransform)?.setContentSize(width, height);
        const g = xNode.getComponent(Graphics);
        if (!g) return;
        this.drawBalloonXOnGraphics(g, width, height, progress, color, isWrongReveal);
        (xNode as any)._balloonXKey = xKey;
        PerfDebug.count('balloonX.refresh');
    },
    updateBalloonMarkVisualIndex: function (index: number): boolean {
        const node = this.balloonCellNodes[index];
        if (!node || !node.isValid || !node.active) return false;
        const transform = node.getComponent(CcUITransform);
        const size = transform?.contentSize;
        const width = Math.max(1, size?.width || this.balloonCellBaseSizes[index] || 80);
        const height = Math.max(1, size?.height || this.balloonCellBaseSizes[index] || 80);
        this.updateBalloonXOverlay(node, index, width, height);
        return true;
    },
    getBalloonXOverlayNode: function (balloonNode: Node): Node {
        let xNode = balloonNode.getChildByName('BalloonXOverlay');
        if (!xNode) {
            xNode = new Node('BalloonXOverlay');
            this.setUILayer(xNode);
            xNode.parent = balloonNode;
            xNode.addComponent(CcUITransform);
            xNode.addComponent(Graphics);
        }
        return xNode;
    },
    drawBalloonXOnGraphics: function (g: Graphics, width: number, height: number, progress: number, color: Color, isErrorColor: boolean) {
        g.clear();
        if (progress <= 0) return;
        const normalized = Math.max(0, Math.min(1, progress));
        const eased = 1 - Math.pow(1 - normalized, 2);
        const visualScale = progress > 1 ? Math.min(1.08, progress) : 0.65 + eased * 0.35;
        const alphaScale = isErrorColor ? 1 : Math.max(0, Math.min(1, eased));
        const size = Math.min(width, height) * 0.52 * visualScale;
        const thickness = Math.max(7, size * (isErrorColor ? 0.19 : 0.17));
        const length = size;
        const strokeColor = new Color(color.r, color.g, color.b, Math.round(color.a * alphaScale));
        const shadow = isErrorColor
            ? new Color(122, 34, 18, 92)
            : new Color(60, 76, 96, Math.round(92 * alphaScale));
        this.drawRoundedStrokeOnGraphics(g, 2, -2, length, thickness * 1.18, -Math.PI / 4, shadow);
        this.drawRoundedStrokeOnGraphics(g, 2, -2, length, thickness * 1.18, Math.PI / 4, shadow);
        this.drawRoundedStrokeOnGraphics(g, 0, 0, length, thickness, -Math.PI / 4, strokeColor);
        this.drawRoundedStrokeOnGraphics(g, 0, 0, length, thickness, Math.PI / 4, strokeColor);
    },
    applyJellyMotionToBalloonIndex: function (index: number): boolean {
        const node = this.balloonCellNodes[index];
        const base = this.balloonCellBasePositions[index];
        if (!node || !node.isValid || !node.active || !base) return false;
        const transform = node.getComponent(CcUITransform);
        const size = transform?.contentSize;
        const width = Math.max(1, size?.width || this.balloonCellBaseSizes[index] || 80);
        const height = Math.max(1, size?.height || this.balloonCellBaseSizes[index] || 80);
        this.applyJellyMotionToBalloonNode(node, index, base, width, height, this.getBalloonColor(index));
        return true;
    },
    updateJellyMotionVisuals: function () {
        if (!this.ENABLE_JELLY_MOTION) return;
        const startedAt = PerfDebug.enabled ? PerfDebug.now() : 0;
        let activeBalloonNodes = 0;
        for (let i = 0; i < this.balloonCellNodes.length; i++) {
            const node = this.balloonCellNodes[i];
            const base = this.balloonCellBasePositions[i];
            if (!node || !node.isValid || !node.active || !base) continue;
            activeBalloonNodes++;
            const transform = node.getComponent(CcUITransform);
            const size = transform?.contentSize;
            const width = Math.max(1, size?.width || this.balloonCellBaseSizes[i] || 80);
            const height = Math.max(1, size?.height || this.balloonCellBaseSizes[i] || 80);
            this.applyJellyMotionToBalloonNode(node, i, base, width, height, this.getBalloonColor(i));
        }
        if (PerfDebug.enabled) {
            PerfDebug.slow('DrawGrid.updateJellyMotionVisuals', startedAt, 30, {
                activeBalloonNodes,
                gridSize: this.gridSize,
            });
        }
    },
    applyJellyMotionToBalloonNode: function (node: Node, index: number, basePosition: Vec3, width: number, height: number, color: Color): void {
        const motion = this.getJellyMotionState(index);
        node.setPosition(
            this.snapPixelPosition(basePosition.x),
            this.snapPixelPosition(basePosition.y + motion.y),
            basePosition.z
        );
        node.angle = motion.angle;
        node.setScale(v3(motion.scaleX, motion.scaleY, 1));
        this.updateJellyEffectOverlay(node, index, width, height, color);
    },
    getJellyMotionState: function (index: number): { scaleX: number; scaleY: number; y: number; angle: number } {
        if (this.jellyInteractionActive?.[index]) {
            return {
                scaleX: this.jellyScaleX?.[index] || 1,
                scaleY: this.jellyScaleY?.[index] || 1,
                y: this.jellyOffsetY?.[index] || 0,
                angle: this.jellyAngle?.[index] || 0,
            };
        }

        const isMarked = !this.revealedSquares[index] && this.clickedSquares[index];
        const isWrongReveal = this.revealedSquares[index] && !this.cowPositions[index];
        const strength = isWrongReveal ? 0 : isMarked ? 0.35 : 1;
        const phase = index * 1.19 + (index % 7) * 0.31;
        const t = this.jellyMotionTime || 0;
        const breath = Math.sin(t * (1.28 + (index % 4) * 0.045) + phase);
        const settle = Math.sin(t * (0.82 + (index % 5) * 0.03) + phase * 0.57);
        return {
            scaleX: 1 + breath * 0.0055 * strength,
            scaleY: 1 - breath * 0.0048 * strength + settle * 0.0018 * strength,
            y: 0,
            angle: 0,
        };
    },
    getJellyEffectOverlayNode: function (balloonNode: Node): Node {
        let node = balloonNode.getChildByName('JellyEffectOverlay');
        if (!node) {
            node = new Node('JellyEffectOverlay');
            this.setUILayer(node);
            node.parent = balloonNode;
            node.addComponent(CcUITransform);
            node.addComponent(Graphics);
            node.setSiblingIndex(8);
        }
        return node;
    },
    updateJellyEffectOverlay: function (balloonNode: Node, index: number, width: number, height: number, color: Color): void {
        const rippleAlpha = Math.max(0, Math.min(1, this.jellyRippleAlpha?.[index] || 0));
        const errorFlash = Math.max(0, Math.min(1, this.jellyErrorFlash?.[index] || 0));
        const interactionActive = !!this.jellyInteractionActive?.[index];
        const hasEffect = rippleAlpha > 0.01 || errorFlash > 0.01 || interactionActive;
        const existingOverlay = balloonNode.getChildByName('JellyEffectOverlay');
        if (!hasEffect) {
            if (existingOverlay) existingOverlay.active = false;
            return;
        }

        const overlay = existingOverlay || this.getJellyEffectOverlayNode(balloonNode);
        overlay.active = true;
        overlay.setSiblingIndex(8);
        overlay.getComponent(CcUITransform)?.setContentSize(width, height);
        const g = overlay.getComponent(Graphics);
        if (!g) return;
        g.clear();

        if (interactionActive) {
            const shineShift = Math.sin((this.jellyMotionTime || 0) * 2.2 + index * 0.8) * width * 0.018;
            g.fillColor = new Color(255, 255, 255, 42);
            g.ellipse(-width * 0.18 + shineShift, height * 0.2, width * 0.13, height * 0.055);
            g.fill();
            g.fillColor = new Color(255, 255, 255, 86);
            g.ellipse(-width * 0.3 + shineShift * 0.7, height * 0.3, width * 0.055, height * 0.026);
            g.fill();
        }

        if (rippleAlpha > 0.01) {
            const progress = Math.max(0, Math.min(1, this.jellyRippleProgress?.[index] || 0));
            const eased = 1 - Math.pow(1 - progress, 2);
            const rx = width * (0.24 + eased * 0.32);
            const ry = height * (0.2 + eased * 0.28);
            g.strokeColor = new Color(255, 255, 255, Math.round(160 * rippleAlpha * (1 - progress * 0.45)));
            g.lineWidth = Math.max(2, Math.min(width, height) * 0.028);
            g.ellipse(0, 0, rx, ry);
            g.stroke();
            g.strokeColor = new Color(color.r, color.g, color.b, Math.round(90 * rippleAlpha));
            g.lineWidth = Math.max(1, Math.min(width, height) * 0.012);
            g.ellipse(0, -height * 0.02, rx * 0.78, ry * 0.68);
            g.stroke();
        }

        if (errorFlash > 0.01) {
            g.strokeColor = new Color(255, 82, 72, Math.round(210 * errorFlash));
            g.lineWidth = Math.max(3, Math.min(width, height) * 0.035);
            g.ellipse(0, 0, width * 0.48, height * 0.46);
            g.stroke();
        }
    },
    updateBalloonFloatVisuals: function () {
        if (!this.ENABLE_BALLOON_FLOAT) return;
        for (let i = 0; i < this.balloonCellNodes.length; i++) {
            const node = this.balloonCellNodes[i];
            const base = this.balloonCellBasePositions[i];
            if (!node || !node.isValid || !node.active || !base) continue;
            const hasActiveX = (this.xAnimationProgress[i] || 0) > 0.01;
            if ((!this.revealedSquares[i] && (this.clickedSquares[i] || hasActiveX)) || (this.revealedSquares[i] && !this.cowPositions[i])) {
                if (this.jellyInteractionActive?.[i]) {
                    this.applyJellyMotionToBalloonIndex?.(i);
                } else {
                    node.setPosition(this.snapPixelPosition(base.x), this.snapPixelPosition(base.y), base.z);
                    node.angle = 0;
                    node.setScale(v3(1, 1, 1));
                }
                continue;
            }
            this.applyBalloonFloatToNode(node, i, base, this.balloonCellBaseSizes[i] || 80, 1);
        }

        for (let i = 0; i < this.cowNodes.length; i++) {
            const node = this.cowNodes[i];
            const base = this.balloonCowBasePositions[i];
            if (!node || !node.isValid || !node.active || !base) continue;
            this.applyBalloonFloatToNode(node, i, base, this.balloonCowBaseSizes[i] || 80, 1.08);
        }
    },
    applyBalloonFloatToNode: function (node: Node, index: number, basePosition: Vec3, baseSize: number, strength: number) {
        const motion = this.getBalloonFloatState(index, baseSize, strength);
        node.setPosition(
            this.snapPixelPosition(basePosition.x + motion.x),
            this.snapPixelPosition(basePosition.y + motion.y),
            basePosition.z
        );
        node.angle = motion.angle;
        node.setScale(v3(motion.scale, motion.scale, 1));
    },
    getBalloonFloatState: function (index: number, baseSize: number, strength: number): BalloonFloatState {
        const sizeFactor = Math.max(0.55, Math.min(1.15, baseSize / 95));
        const phase = index * 1.37 + (index % 5) * 0.43;
        const t = this.balloonFloatTime;
        const yAmp = Math.max(1.2, baseSize * 0.042) * sizeFactor * strength;
        const xAmp = Math.max(0.55, baseSize * 0.018) * sizeFactor * strength;
        const y = Math.sin(t * (0.92 + (index % 4) * 0.045) + phase) * yAmp;
        const x = Math.sin(t * (0.54 + (index % 3) * 0.035) + phase * 0.71) * xAmp;
        const angle = Math.sin(t * (0.44 + (index % 6) * 0.025) + phase * 0.53) * (1.6 + (index % 3) * 0.22) * strength;
        const scale = 1 + Math.sin(t * (0.7 + (index % 4) * 0.02) + phase * 0.37) * 0.014 * strength;
        return { x, y, angle, scale };
    },
    updateCowNodes: function () {
        for (let i = 0; i < this.cowNodes.length; i++) {
            const node = this.cowNodes[i];
            if (node && node.isValid) {
                node.active = false;
            } else {
                this.cowNodes[i] = null;
            }
        }
        this.balloonCowBasePositions.fill(null);
    },
    getCowNode: function (index: number): Node {
        if (!this.cowNodes[index] || !this.cowNodes[index].isValid) {
            const node = new Node(`Cow_${index}`);
            this.setUILayer(node);
            node.addComponent(CcUITransform);
            const visualNode = new Node('CowVisual');
            this.setUILayer(visualNode);
            node.addChild(visualNode);
            visualNode.addComponent(CcUITransform);
            const sprite = visualNode.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            sprite.spriteFrame = this.getCowRestSpriteFrame(index);
            // 将目标节点挂在网格节点下
            node.parent = this.node;
            node.setSiblingIndex(20);
            this.cowNodes[index] = node;
        }
        return this.cowNodes[index];
    },
    getCowVisualNode: function (cowNode: Node, index: number = -1): Node {
        let visualNode = cowNode.getChildByName('CowVisual');
        if (!visualNode) {
            visualNode = new Node('CowVisual');
            this.setUILayer(visualNode);
            cowNode.addChild(visualNode);
            visualNode.addComponent(CcUITransform);
            const sprite = visualNode.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            sprite.spriteFrame = this.getCowRestSpriteFrame(index);
        }
        const sprite = visualNode.getComponent(Sprite);
        if (sprite) {
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            sprite.spriteFrame = sprite.spriteFrame || this.getCowRestSpriteFrame(index);
        }
        return visualNode;
    },
    drawAnimatedX: function (x: number, y: number, size: number, progress: number, color: Color = Color.WHITE) {
        const g = this.graphics;
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        if (progress <= 0) return;

        const isErrorColor = !(color.r === 255 && color.g === 255 && color.b === 255);
        const normalized = Math.max(0, Math.min(1, progress));
        const eased = 1 - Math.pow(1 - normalized, 2);
        const visualScale = progress > 1 ? Math.min(1.08, progress) : 0.65 + eased * 0.35;
        const alphaScale = isErrorColor ? 1 : Math.max(0, Math.min(1, eased));
        const thickness = (isErrorColor ? 18 : 16) * (size / 140) * visualScale;
        const length = size * 0.5 * visualScale;
        const strokeColor = new Color(color.r, color.g, color.b, Math.round(color.a * alphaScale));
        this.drawRoundedStroke(centerX, centerY, length, thickness, -Math.PI / 4, strokeColor);
        this.drawRoundedStroke(centerX, centerY, length, thickness, Math.PI / 4, strokeColor);
    },
    drawRoundedStroke: function (cx: number, cy: number, length: number, thickness: number, angle: number, color: Color) {
        this.drawRoundedStrokeOnGraphics(this.graphics, cx, cy, length, thickness, angle, color);
    },
    drawRoundedStrokeOnGraphics: function (g: Graphics, cx: number, cy: number, length: number, thickness: number, angle: number, color: Color) {
        const halfLength = length / 2;
        const halfThickness = thickness / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const bodyHalfLength = Math.max(0, halfLength - halfThickness);
        const points = [
            { x: -bodyHalfLength, y: -halfThickness },
            { x: bodyHalfLength, y: -halfThickness },
            { x: bodyHalfLength, y: halfThickness },
            { x: -bodyHalfLength, y: halfThickness }
        ];

        g.fillColor = color;
        for (let i = 0; i < points.length; i++) {
            const px = cx + points[i].x * cos - points[i].y * sin;
            const py = cy + points[i].x * sin + points[i].y * cos;
            if (i === 0) {
                g.moveTo(px, py);
            } else {
                g.lineTo(px, py);
            }
        }
        g.close();
        g.fill();

        const startX = cx - bodyHalfLength * cos;
        const startY = cy - bodyHalfLength * sin;
        const endX = cx + bodyHalfLength * cos;
        const endY = cy + bodyHalfLength * sin;
        g.circle(startX, startY, halfThickness);
        g.fill();
        g.circle(endX, endY, halfThickness);
        g.fill();
        g.circle(cx, cy, halfThickness * 0.82);
        g.fill();
    },
    updateCoordinateNodes: function () {
        for (let i = 0; i < this.coordinateNodes.length; i++) {
            const node = this.coordinateNodes[i];
            if (node && node.isValid) {
                node.active = false;
            } else {
                this.coordinateNodes[i] = null;
            }
        }
    },
    getCoordNode: function (name: string): Node {
        let node = this.coordinateNodes.find(n => n && n.isValid && n.name === name);
        if (!node || !node.isValid) {
            node = new Node(name);
            node.addComponent(CcUITransform);
            const label = node.addComponent(Label);
            label.fontSize = 24;
            label.color = Color.BLACK;
            node.parent = this.node;
            this.coordinateNodes.push(node);
        }
        return node;
    },
    showPausePopup: function () {
        if (this.isGameOver) return;
        GameApp.popupIndex = 1;
        GameApp.uiManager?.open(UIID.PopupPanel);
    },
    showReturnConfirm: function () {
        GameApp.popupIndex = 2;
        GameApp.uiManager?.open(UIID.PopupPanel);
    },
    });
}
