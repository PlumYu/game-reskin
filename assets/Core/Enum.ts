import { Component, Node } from 'cc';

export enum GameMode {
    level = 0,
    survival = 1,
    battle = 2,
    daily_challenge = 3,
}

export enum UIID {
    MainPanel = 1,
    WinPanel = 2,
    FailPanel = 3,
    PopupPanel = 4,
    SurvivalOverPanel = 5,
    SettingPanel = 6,
    PowerPanel = 7,
    GuidePanel = 8,
    SkinPanel = 9,
    RankPanel = 10,
    DailyChallengeOverPanel = 11,
    PrivacyPanel = 12,
    AntiAddictionPanel = 13,
}

export enum UILayer {
    Background = 0,
    Game = 1,
    UI = 2,
    Popup = 3,
    Toast = 4,
    TopHud = 5,
}

export type PanelFactory = (parent: Node) => Component;

export interface UIConfigData {
    uiId: UIID;
    layer: UILayer;
    factory: PanelFactory;
}
