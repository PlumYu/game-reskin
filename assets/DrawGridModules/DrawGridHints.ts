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
export function installDrawGridHints(target: any): void {
    Object.assign(target.prototype, {
    getHintColorDisplayName: function (hex: string): string {
        const normalized = (hex || '').toLowerCase();
        const paletteIndex = this.palette.findIndex((color: string) => (color || '').toLowerCase() === normalized);
        const rawName = paletteIndex >= 0 && paletteIndex < this.paletteNames.length
            ? `${this.paletteNames[paletteIndex] || ''}`
            : '';
        if (!rawName) return '这种颜色';
        return rawName.endsWith('色') ? rawName : `${rawName}色`;
    },
    getHintColorCellName: function (hex: string): string {
        const colorName = this.getHintColorDisplayName(hex);
        return colorName === '这种颜色' ? '这种颜色的格子' : `${colorName}格子`;
    },
    getHintColorCowName: function (hex: string): string {
        const colorName = this.getHintColorDisplayName(hex);
        return colorName === '这种颜色' ? '这种颜色的牛马' : `${colorName}牛马`;
    },
    getHintColorCellNameByIndex: function (index: number): string {
        return this.getHintColorCellName(this.gridColors[index]);
    },
    joinHintColorCellNames: function (colors: string[]): string {
        const names = colors
            .map((hex: string) => this.getHintColorDisplayName(hex))
            .filter((name: string, index: number, list: string[]) => !!name && list.indexOf(name) === index);
        return names.length > 0 ? `${names.join('、')}格子` : '这些颜色的格子';
    },
    showHint: function () {
        this.hideSceneHintGuidePrompt?.();
        SfxManager.instance.playUiClick(); // UI点击音效
        const count = typeof this.getAvailableHintCount === 'function' ? this.getAvailableHintCount('exclude') : 0;
        if (count <= 0) {
            this.openHintPurchasePanel?.('exclude');
            this.refreshSceneHintCountBadges?.();
            return;
        }

        this.clearHintVisuals();
        this.resetHintActionState();
        const shown = this.showWrongExcludeHint()
            || this.showLogicHint()
            || this.showExcludeRowColHint()
            || this.showNeighborExcludeHint()
            || this.showColorOccupiedRowHint()
            || this.showRuleEExcludeHint()
            || this.showOccupiedRowsHint()
            || this.showNeighborColorOnlyHint();
        if (shown && typeof this.consumeHintCount === 'function' && !this.consumeHintCount('exclude')) {
            return;
        }
        this.hintUsedThisLevel = true;
        this.showWorkplaceToast(
            shown ? '给你一条线索' : '这一步先自己想想',
            v3(0, 330, 0),
            shown ? new Color(255, 238, 92, 255) : new Color(180, 190, 205, 255)
        );
        if (shown) return;
        this.renderGrid();
    },
    showWrongExcludeHint: function (): boolean {
        if (this.isGameOver || !this.hintPanelNode) return false;

        const total = this.gridSize * this.gridSize;
        for (let i = 0; i < total; i++) {
            if (!this.clickedSquares[i] || !this.cowPositions[i] || this.revealedSquares[i]) continue;

            this.hintTargetIndex = i;
            this.highlightIndex = i;
            this.highlightIndices = [];
            this.showHintVisuals([i], [i]);

            const label = this.hintPanelNode.getComponentInChildren(Label);
            if (label) {
                label.string = '这个格子被你排除了，但它其实就是牛马的位置；点一键应用，把它找出来。';
            }
            this.setHintPanelShown(true);
            this.renderGrid();
            return true;
        }
        return false;
    },
    showLogicHint: function (): boolean {
        if (this.isGameOver || !this.hintPanelNode) return false;

        const n = this.gridSize;
        const total = n * n;
        const knownCowIdx = new Set<number>();
        for (let i = 0; i < total; i++) {
            if (this.revealedSquares[i] && this.cowPositions[i]) knownCowIdx.add(i);
        }

        let targetIndex = -1;
        let reasonColorCellName = '';

        for (let r = 0; r < n; r++) {
            let rowCowsFound = 0;
            let unknownInRow: number[] = [];
            for (let c = 0; c < n; c++) {
                const idx = r * n + c;
                if (knownCowIdx.has(idx)) rowCowsFound++;
                if (!this.revealedSquares[idx] && !this.clickedSquares[idx]) unknownInRow.push(idx);
            }
            if (rowCowsFound === 0 && unknownInRow.length === 1) {
                targetIndex = unknownInRow[0];
                reasonColorCellName = this.getHintColorCellNameByIndex(targetIndex);
                break;
            }
        }
        if (targetIndex < 0) {
            for (let c = 0; c < n; c++) {
                let colCowsFound = 0;
                let unknownInCol: number[] = [];
                for (let r = 0; r < n; r++) {
                    const idx = r * n + c;
                    if (knownCowIdx.has(idx)) colCowsFound++;
                    if (!this.revealedSquares[idx] && !this.clickedSquares[idx]) unknownInCol.push(idx);
                }
                if (colCowsFound === 0 && unknownInCol.length === 1) {
                    targetIndex = unknownInCol[0];
                    reasonColorCellName = this.getHintColorCellNameByIndex(targetIndex);
                    break;
                }
            }
        }
        if (targetIndex < 0) {
            const colorIndices = new Map<string, number[]>();
            for (let i = 0; i < total; i++) {
                const color = this.gridColors[i];
                if (!colorIndices.has(color)) colorIndices.set(color, []);
                colorIndices.get(color)!.push(i);
            }
            for (const [color, indices] of colorIndices) {
                let colorCowsFound = 0;
                let unknownInRegion: number[] = [];
                for (const idx of indices) {
                    if (knownCowIdx.has(idx)) colorCowsFound++;
                    if (!this.revealedSquares[idx] && !this.clickedSquares[idx]) unknownInRegion.push(idx);
                }
                if (colorCowsFound === 0 && unknownInRegion.length === 1) {
                    targetIndex = unknownInRegion[0];
                    reasonColorCellName = this.getHintColorCellNameByIndex(targetIndex);
                    break;
                }
            }
        }

        if (targetIndex < 0) return false;

        this.hintTargetIndex = targetIndex;
        this.highlightIndex = targetIndex;
        this.hintExcludeCowIndex = -1;
        this.highlightIndices = [];
        this.showHintVisuals([targetIndex], []);

        const label = this.hintPanelNode.getComponentInChildren(Label);
        if (label) {
            label.string = `${reasonColorCellName || '这种颜色的格子'}只剩这一个还可能藏牛马，所以牛马就在这里。`;
        }
        this.setHintPanelShown(true);
        this.renderGrid();
        return true;
    },
    showExcludeRowColHint: function (): boolean {
        if (this.isGameOver || !this.hintPanelNode) return false;

        const n = this.gridSize;
        const total = n * n;
        for (let cowIdx = 0; cowIdx < total; cowIdx++) {
            if (!this.revealedSquares[cowIdx] || !this.cowPositions[cowIdx]) continue;
            const row = Math.floor(cowIdx / n);
            const col = cowIdx % n;
            const toHighlight: number[] = [];
            for (let c = 0; c < n; c++) {
                const i = row * n + c;
                if (i !== cowIdx && !this.revealedSquares[i] && !this.clickedSquares[i]) toHighlight.push(i);
            }
            for (let r = 0; r < n; r++) {
                const i = r * n + col;
                if (i !== cowIdx && !this.revealedSquares[i] && !this.clickedSquares[i]) toHighlight.push(i);
            }
            if (toHighlight.length === 0) continue;

            this.hintTargetIndex = -1;
            this.highlightIndex = -1;
            this.hintExcludeCowIndex = cowIdx;
            this.highlightIndices = toHighlight;
            this.showHintVisuals([cowIdx], toHighlight);

            const label = this.hintPanelNode.getComponentInChildren(Label);
            if (label) {
                label.string = '这行和这列已经有牛马了；每行每列只能有1只，所以同排同列其他格子都可以排除。';
            }
            this.setHintPanelShown(true);
            this.renderGrid();
            return true;
        }
        return false;
    },
    showNeighborExcludeHint: function (): boolean {
        if (this.isGameOver || !this.hintPanelNode) return false;

        const n = this.gridSize;
        const total = n * n;
        for (let cowIdx = 0; cowIdx < total; cowIdx++) {
            if (!this.revealedSquares[cowIdx] || !this.cowPositions[cowIdx]) continue;
            const neighbors = this.getNeighbors8(cowIdx, n);
            const toHighlight = neighbors.filter(i => !this.revealedSquares[i] && !this.clickedSquares[i]);
            if (toHighlight.length === 0) continue;

            this.hintTargetIndex = -1;
            this.highlightIndex = -1;
            this.hintExcludeCowIndex = -1;
            this.hintExcludeNeighborCowIndex = cowIdx;
            this.highlightIndices = toHighlight;
            this.showHintVisuals([cowIdx], toHighlight);

            const label = this.hintPanelNode.getComponentInChildren(Label);
            if (label) {
                label.string = '牛马不能挨着牛马；这只牛马周围一圈都不可能再有牛马，可以排除。';
            }
            this.setHintPanelShown(true);
            this.renderGrid();
            return true;
        }
        return false;
    },
    showColorOccupiedRowHint: function (): boolean {
        if (this.isGameOver || !this.hintPanelNode) return false;

        const n = this.gridSize;
        const total = n * n;
        const isUnknown = (i: number) => !this.revealedSquares[i] && !this.clickedSquares[i];

        for (const color of this.palette) {
            const indices: number[] = [];
            for (let i = 0; i < total; i++) {
                if (this.gridColors[i] === color && isUnknown(i)) indices.push(i);
            }
            if (indices.length === 0) continue;

            const rows = new Set(indices.map(i => Math.floor(i / n)));
            const cols = new Set(indices.map(i => i % n));

            if (rows.size === 1) {
                const r = rows.values().next().value as number;
                const toHighlight: number[] = [];
                for (let c = 0; c < n; c++) {
                    const j = r * n + c;
                    if (isUnknown(j) && this.gridColors[j] !== color) toHighlight.push(j);
                }
                if (toHighlight.length === 0) continue;

                this.hintTargetIndex = -1;
                this.highlightIndex = -1;
                this.hintExcludeCowIndex = -1;
                this.hintExcludeNeighborCowIndex = -1;
                this.hintColorOccupiedRowOrCol = r;
                this.hintColorOccupiedIsCol = false;
                this.hintColorOccupiedColor = color;
                this.highlightIndices = toHighlight;
                this.showHintVisuals(indices, toHighlight);

                const label = this.hintPanelNode.getComponentInChildren(Label);
                if (label) {
                    const colorCellName = this.getHintColorCellName(color);
                    const colorCowName = this.getHintColorCowName(color);
                    label.string = `剩下的${colorCellName}都在这一行里，所以${colorCowName}一定在这一行；这一行里的其他颜色格子可以排除。`;
                }
                this.setHintPanelShown(true);
                this.renderGrid();
                return true;
            }

            if (cols.size === 1) {
                const col = cols.values().next().value as number;
                const toHighlight: number[] = [];
                for (let r = 0; r < n; r++) {
                    const j = r * n + col;
                    if (isUnknown(j) && this.gridColors[j] !== color) toHighlight.push(j);
                }
                if (toHighlight.length === 0) continue;

                this.hintTargetIndex = -1;
                this.highlightIndex = -1;
                this.hintExcludeCowIndex = -1;
                this.hintExcludeNeighborCowIndex = -1;
                this.hintColorOccupiedRowOrCol = col;
                this.hintColorOccupiedIsCol = true;
                this.hintColorOccupiedColor = color;
                this.highlightIndices = toHighlight;
                this.showHintVisuals(indices, toHighlight);

                const label = this.hintPanelNode.getComponentInChildren(Label);
                if (label) {
                    const colorCellName = this.getHintColorCellName(color);
                    const colorCowName = this.getHintColorCowName(color);
                    label.string = `剩下的${colorCellName}都在这一列里，所以${colorCowName}一定在这一列；这一列里的其他颜色格子可以排除。`;
                }
                this.setHintPanelShown(true);
                this.renderGrid();
                return true;
            }
        }
        return false;
    },
    showRuleEExcludeHint: function (): boolean {
        if (this.isGameOver || !this.hintPanelNode) return false;

        const n = this.gridSize;
        const total = n * n;
        const isUnknown = (i: number) => !this.revealedSquares[i] && !this.clickedSquares[i];

        for (let r = 0; r < n; r++) {
            const rowColor = this.gridColors[r * n];
            let same = true;
            for (let c = 1; c < n; c++) {
                if (this.gridColors[r * n + c] !== rowColor) { same = false; break; }
            }
            if (!same) continue;
            const toHighlight: number[] = [];
            for (let i = 0; i < total; i++) {
                if (Math.floor(i / n) === r) continue;
                if (this.gridColors[i] !== rowColor) continue;
                if (!isUnknown(i)) continue;
                toHighlight.push(i);
            }
            if (toHighlight.length === 0) continue;

            this.hintTargetIndex = -1;
            this.highlightIndex = -1;
            this.hintExcludeCowIndex = -1;
            this.hintExcludeNeighborCowIndex = -1;
            this.hintColorOccupiedRowOrCol = -1;
            this.hintColorOccupiedColor = '';
            this.hintRuleERowOrCol = r;
            this.hintRuleEIsCol = false;
            this.hintRuleEColor = rowColor;
            this.highlightIndices = toHighlight;
            const focusIndices: number[] = [];
            for (let c = 0; c < n; c++) focusIndices.push(r * n + c);
            this.showHintVisuals(focusIndices, toHighlight);

            const label = this.hintPanelNode.getComponentInChildren(Label);
            if (label) {
                const colorCellName = this.getHintColorCellName(rowColor);
                const colorCowName = this.getHintColorCowName(rowColor);
                label.string = `这一整行都是${colorCellName}，说明${colorCowName}只能在这一行里；棋盘上其他${colorCellName}可以排除。`;
            }
            this.setHintPanelShown(true);
            this.renderGrid();
            return true;
        }

        for (let col = 0; col < n; col++) {
            const colColor = this.gridColors[col];
            let same = true;
            for (let r = 1; r < n; r++) {
                if (this.gridColors[r * n + col] !== colColor) { same = false; break; }
            }
            if (!same) continue;
            const toHighlight: number[] = [];
            for (let i = 0; i < total; i++) {
                if ((i % n) === col) continue;
                if (this.gridColors[i] !== colColor) continue;
                if (!isUnknown(i)) continue;
                toHighlight.push(i);
            }
            if (toHighlight.length === 0) continue;

            this.hintTargetIndex = -1;
            this.highlightIndex = -1;
            this.hintExcludeCowIndex = -1;
            this.hintExcludeNeighborCowIndex = -1;
            this.hintColorOccupiedRowOrCol = -1;
            this.hintColorOccupiedColor = '';
            this.hintRuleERowOrCol = col;
            this.hintRuleEIsCol = true;
            this.hintRuleEColor = colColor;
            this.highlightIndices = toHighlight;
            const focusIndices: number[] = [];
            for (let r = 0; r < n; r++) focusIndices.push(r * n + col);
            this.showHintVisuals(focusIndices, toHighlight);

            const label = this.hintPanelNode.getComponentInChildren(Label);
            if (label) {
                const colorCellName = this.getHintColorCellName(colColor);
                const colorCowName = this.getHintColorCowName(colColor);
                label.string = `这一整列都是${colorCellName}，说明${colorCowName}只能在这一列里；棋盘上其他${colorCellName}可以排除。`;
            }
            this.setHintPanelShown(true);
            this.renderGrid();
            return true;
        }
        return false;
    },
    showOccupiedRowsHint: function (): boolean {
        if (this.isGameOver || !this.hintPanelNode) return false;

        const n = this.gridSize;
        const total = n * n;
        const isUnknown = (i: number) => !this.revealedSquares[i] && !this.clickedSquares[i];

        const colorIndices = new Map<string, number[]>();
        for (let i = 0; i < total; i++) {
            const c = this.gridColors[i];
            if (!colorIndices.has(c)) colorIndices.set(c, []);
            colorIndices.get(c)!.push(i);
        }

        // 若干行被若干颜色占据
        for (let mask = 1; mask < (1 << n); mask++) {
            const rows: number[] = [];
            for (let r = 0; r < n; r++) if (mask & (1 << r)) rows.push(r);
            const rowSet = new Set(rows);
            const occupyingColors: string[] = [];
            for (const [color, indices] of colorIndices) {
                const unknown = indices.filter(idx => isUnknown(idx));
                if (unknown.length === 0) continue;
                const colorRows = new Set(unknown.map(idx => Math.floor(idx / n)));
                let allIn = true;
                for (const cr of colorRows) { if (!rowSet.has(cr)) { allIn = false; break; } }
                if (allIn) occupyingColors.push(color);
            }
            if (occupyingColors.length < rows.length) continue;
            const occupyingSet = new Set(occupyingColors);
            const toHighlight: number[] = [];
            for (const row of rows) {
                for (let c = 0; c < n; c++) {
                    const j = row * n + c;
                    if (!isUnknown(j)) continue;
                    if (occupyingSet.has(this.gridColors[j])) continue;
                    toHighlight.push(j);
                }
            }
            if (toHighlight.length === 0) continue;

            this.hintTargetIndex = -1;
            this.highlightIndex = -1;
            this.hintExcludeCowIndex = -1;
            this.hintExcludeNeighborCowIndex = -1;
            this.hintColorOccupiedRowOrCol = -1;
            this.hintColorOccupiedColor = '';
            this.hintRuleERowOrCol = -1;
            this.hintRuleEColor = '';
            this.hintOccupiedLineIndices = rows.slice();
            this.hintOccupiedIsCol = false;
            this.hintOccupiedColors = occupyingColors.slice();
            this.highlightIndices = toHighlight;
            const focusIndices: number[] = [];
            for (const row of rows) {
                for (let c = 0; c < n; c++) {
                    const j = row * n + c;
                    if (isUnknown(j) && occupyingSet.has(this.gridColors[j])) {
                        focusIndices.push(j);
                    }
                }
            }
            this.showHintVisuals(focusIndices, toHighlight);

            const colorCellNames = this.joinHintColorCellNames(occupyingColors);
            const label = this.hintPanelNode.getComponentInChildren(Label);
            if (label) {
                label.string = `剩下的${colorCellNames}只能分布在这${rows.length}行里；这些行里的其他颜色格子不会有牛马，可以排除。`;
            }
            this.setHintPanelShown(true);
            this.renderGrid();
            return true;
        }

        // 若干列被若干颜色占据
        for (let mask = 1; mask < (1 << n); mask++) {
            const cols: number[] = [];
            for (let c = 0; c < n; c++) if (mask & (1 << c)) cols.push(c);
            const colSet = new Set(cols);
            const occupyingColors: string[] = [];
            for (const [color, indices] of colorIndices) {
                const unknown = indices.filter(idx => isUnknown(idx));
                if (unknown.length === 0) continue;
                const colorCols = new Set(unknown.map(idx => idx % n));
                let allIn = true;
                for (const cc of colorCols) { if (!colSet.has(cc)) { allIn = false; break; } }
                if (allIn) occupyingColors.push(color);
            }
            if (occupyingColors.length < cols.length) continue;
            const occupyingSet = new Set(occupyingColors);
            const toHighlight: number[] = [];
            for (const col of cols) {
                for (let r = 0; r < n; r++) {
                    const j = r * n + col;
                    if (!isUnknown(j)) continue;
                    if (occupyingSet.has(this.gridColors[j])) continue;
                    toHighlight.push(j);
                }
            }
            if (toHighlight.length === 0) continue;

            this.hintTargetIndex = -1;
            this.highlightIndex = -1;
            this.hintExcludeCowIndex = -1;
            this.hintExcludeNeighborCowIndex = -1;
            this.hintColorOccupiedRowOrCol = -1;
            this.hintColorOccupiedColor = '';
            this.hintRuleERowOrCol = -1;
            this.hintRuleEColor = '';
            this.hintOccupiedLineIndices = cols.slice();
            this.hintOccupiedIsCol = true;
            this.hintOccupiedColors = occupyingColors.slice();
            this.highlightIndices = toHighlight;
            const focusIndices: number[] = [];
            for (const col of cols) {
                for (let r = 0; r < n; r++) {
                    const j = r * n + col;
                    if (isUnknown(j) && occupyingSet.has(this.gridColors[j])) {
                        focusIndices.push(j);
                    }
                }
            }
            this.showHintVisuals(focusIndices, toHighlight);

            const colorCellNames = this.joinHintColorCellNames(occupyingColors);
            const label = this.hintPanelNode.getComponentInChildren(Label);
            if (label) {
                label.string = `剩下的${colorCellNames}只能分布在这${cols.length}列里；这些列里的其他颜色格子不会有牛马，可以排除。`;
            }
            this.setHintPanelShown(true);
            this.renderGrid();
            return true;
        }
        return false;
    },
    showNeighborColorOnlyHint: function (): boolean {
        if (this.isGameOver || !this.hintPanelNode) return false;

        const n = this.gridSize;
        const total = n * n;
        const isUnmarked = (i: number) => !this.revealedSquares[i] && !this.clickedSquares[i];

        // 仅统计未标记格子（未翻开且未标×）上每种颜色的位置，用于判断「该颜色是否仅存在于当前格邻居内」
        const colorToIndices = new Map<string, number[]>();
        for (let i = 0; i < total; i++) {
            if (!isUnmarked(i)) continue;
            const c = this.gridColors[i];
            if (!colorToIndices.has(c)) colorToIndices.set(c, []);
            colorToIndices.get(c)!.push(i);
        }

        for (let i = 0; i < total; i++) {
            if (!isUnmarked(i)) continue;

            const neighbors = this.getNeighbors8(i, n);
            if (neighbors.length === 0) continue;

            const neighborSet = new Set(neighbors);
            const colorsInNeighbors = new Set<string>();
            for (const j of neighbors) {
                if (!isUnmarked(j)) continue;
                colorsInNeighbors.add(this.gridColors[j]);
            }

            if (colorsInNeighbors.size === 0) continue;

            // 若存在至少一种颜色：该颜色在邻居中出现，且在未标记格中仅出现在该邻居集合内 → 可提示
            let neighborOnlyColor = '';
            for (const color of colorsInNeighbors) {
                const indices = colorToIndices.get(color);
                if (!indices) continue;
                let onlyInNeighbors = true;
                for (const k of indices) {
                    if (!neighborSet.has(k)) {
                        onlyInNeighbors = false;
                        break;
                    }
                }
                if (onlyInNeighbors) {
                    neighborOnlyColor = color;
                    break;
                }
            }

            if (!neighborOnlyColor) continue;

            this.hintTargetIndex = -1;
            this.highlightIndex = i;
            this.hintExcludeCowIndex = -1;
            this.hintExcludeNeighborCowIndex = -1;
            this.hintColorOccupiedRowOrCol = -1;
            this.hintColorOccupiedColor = '';
            this.hintRuleERowOrCol = -1;
            this.hintRuleEColor = '';
            this.hintOccupiedLineIndices = [];
            this.hintOccupiedColors = [];
            this.hintNeighborColorOnlyIndex = i;
            this.highlightIndices = [];
            const focusIndices = neighbors.filter(j => isUnmarked(j));
            this.showHintVisuals(focusIndices, [i]);

            const label = this.hintPanelNode.getComponentInChildren(Label);
            if (label) {
                const colorCellName = this.getHintColorCellName(neighborOnlyColor);
                label.string = `如果这个格子是牛马，旁边的${colorCellName}就没有合法位置了；所以这个格子可以排除。`;
            }
            this.setHintPanelShown(true);
            this.renderGrid();
            return true;
        }
        return false;
    },
    getNeighbors: function (i: number, n: number): number[] {
        const row = Math.floor(i / n), col = i % n;
        const out: number[] = [];
        if (row > 0) out.push(i - n);
        if (row < n - 1) out.push(i + n);
        if (col > 0) out.push(i - 1);
        if (col < n - 1) out.push(i + 1);
        return out;
    },
    getNeighbors8: function (i: number, n: number): number[] {
        const row = Math.floor(i / n), col = i % n;
        const out: number[] = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const r = row + dr, c = col + dc;
                if (r >= 0 && r < n && c >= 0 && c < n) out.push(r * n + c);
            }
        }
        return out;
    },
    generateCows: function () {
        const generated = generateRandomLevel(this.gridSize, this.palette);
        this.gridColors = generated.gridColors;
        this.cowPositions = generated.cowPositions;
        this.totalCows = generated.totalCows;
    },
    });
}
