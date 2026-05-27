export type BalloonColorDef = {
    index: number;
    key: string;
    label: string;
    hex: string;
    rgb: [number, number, number];
};

export const BALLOON_COLOR_DEFS: BalloonColorDef[] = [
    { index: 1, key: 'purple', label: '紫', hex: '#AA7ADD', rgb: [170, 122, 221] },
    { index: 2, key: 'blue', label: '蓝', hex: '#5AB4F6', rgb: [90, 180, 246] },
    { index: 3, key: 'green', label: '绿', hex: '#A4D375', rgb: [164, 211, 117] },
    { index: 4, key: 'pink', label: '粉', hex: '#F489A8', rgb: [244, 137, 168] },
    { index: 5, key: 'teal', label: '青', hex: '#31AFA3', rgb: [49, 175, 163] },
    { index: 6, key: 'rose', label: '玫', hex: '#CA476C', rgb: [202, 71, 108] },
    { index: 7, key: 'yellow', label: '黄', hex: '#EFAC20', rgb: [239, 172, 32] },
    { index: 8, key: 'grayblue', label: '灰蓝', hex: '#829DC5', rgb: [130, 157, 197] },
    { index: 9, key: 'orange', label: '橙', hex: '#FC863A', rgb: [252, 134, 58] },
    { index: 10, key: 'steelblue', label: '钢蓝', hex: '#4A78B6', rgb: [74, 120, 182] },
    { index: 11, key: 'brown', label: '棕', hex: '#C26932', rgb: [194, 105, 50] },
    { index: 12, key: 'brightyellow', label: '明黄', hex: '#EEC418', rgb: [238, 196, 24] },
];

export const DEFAULT_PALETTE: string[] = BALLOON_COLOR_DEFS.map(def => def.hex.toLowerCase());
export const DEFAULT_PALETTE_NAMES: string[] = BALLOON_COLOR_DEFS.map(def => def.label);
