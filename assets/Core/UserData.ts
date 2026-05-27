import { sys } from 'cc';

export type UserDataPayload = {
    gameVideoTime: number;
    shareNum: number;
    nickName: string;
    avatarUrl: string;
    gender: number;
    date: number;
    signState: number;
    signday: number;
    firstGame: number;
    level: number;
    foundCowNum: number;
    myScore: number;
    lastRecoveryTimestamp: number;
    stamina: number;
    adStaminaUsedToday: number;
    coin: number;
    cowHintCount: number;
    excludeHintCount: number;
    cowHintUnlockShown: boolean;
    excludeHintUnlockShown: boolean;
    unlockSkin: number[];
    useSkin: number;
    freeSurvivalTime: number;
    nightMode: boolean;
    survivalBestRound: number;
    lastLoginDate: string;
    dailyChallengeFreeUsed: boolean;
    dailyChallengeStreak: number;
    lastDailyChallengeDate: string;
    lastInterstitialAdDate: string;
    interstitialAdShownToday: number;
    lastInterstitialAdTimestamp: number;
    lastInterstitialAdLevel: number;
};

export default class UserData {
    private static _instance: UserData | null = null;

    private readonly storageKey = 'mo_yu_user_data';
    private readonly legacyStorageKey = 'mo_yu_data';

    private _gameVideoTime = 0;
    private _shareNum = 3;
    private _nickName = '';
    private _avatarUrl = '';
    private _gender = 0;
    private _date = 0;
    private _signState = 0;
    private _signday = 1;
    private _firstGame = 0;
    private _level = 1;
    private _foundCowNum = 0;
    private _myScore = 1;
    private _lastRecoveryTimestamp = 0;
    private _stamina = 60;
    private _adStaminaUsedToday = 0;
    private _coin = 0;
    private _cowHintCount = 0;
    private _excludeHintCount = 0;
    private _cowHintUnlockShown = false;
    private _excludeHintUnlockShown = false;
    private _unlockSkin: number[] = [1];
    private _useSkin = 1;
    private _freeSurvivalTime = 2;
    private _nightMode = false;
    private _survivalBestRound = 0;
    private _lastLoginDate = '';
    private _dailyChallengeFreeUsed = false;
    private _dailyChallengeStreak = 0;
    private _lastDailyChallengeDate = '';
    private _lastInterstitialAdDate = '';
    private _interstitialAdShownToday = 0;
    private _lastInterstitialAdTimestamp = 0;
    private _lastInterstitialAdLevel = 0;
    private saveListeners: Array<() => void> = [];

    public static get instance(): UserData {
        if (!this._instance) {
            this._instance = new UserData();
        }
        return this._instance;
    }

    public decode() {
        const raw = sys.localStorage.getItem(this.storageKey);
        if (raw) {
            this.applyPayload(raw);
            return;
        }

        const legacyRaw = sys.localStorage.getItem(this.legacyStorageKey);
        if (!legacyRaw) {
            return;
        }

        try {
            const legacy = JSON.parse(legacyRaw) as { level?: number; coins?: number };
            this._level = Math.max(1, Math.floor(this.readNumber(legacy.level, 1)));
            this._coin = Math.max(0, Math.floor(this.readNumber(legacy.coins, 0)));
            this.save();
        } catch (error) {
            console.error('读取旧版存档失败', error);
        }
    }

    public newDate() {
        this._date = this.day;
        this._shareNum = 3;
        this._signState = 0;
        this._freeSurvivalTime = 2;
        this._adStaminaUsedToday = 0;
        this._dailyChallengeFreeUsed = false;
        this._interstitialAdShownToday = 0;
        this._lastInterstitialAdDate = this.getTodayDateString();
        if (this._signday === 8) {
            this._signday = 1;
        }
        this.save();
    }

    public save() {
        sys.localStorage.setItem(this.storageKey, JSON.stringify(this.toJSON()));
        this.notifySaveListeners();
    }

    public delaySave() {
        this.save();
    }

    public addSaveListener(listener: () => void): void {
        if (this.saveListeners.indexOf(listener) >= 0) {
            return;
        }
        this.saveListeners.push(listener);
    }

    public toPayload(): UserDataPayload {
        return this.toJSON();
    }

    public applyPayloadData(payload: UserDataPayload, shouldSave: boolean = true): void {
        this.applyPayload(JSON.stringify(payload));
        if (shouldSave) {
            this.save();
        }
    }

    public get day(): number {
        return new Date().getDate();
    }

    public get serverTime(): number {
        return Math.floor(Date.now() / 1000);
    }

    public get gameVideoTime(): number {
        return this._gameVideoTime;
    }

    public set gameVideoTime(value: number) {
        this._gameVideoTime = value;
        this.delaySave();
    }

    public get shareNum(): number {
        return this._shareNum;
    }

    public set shareNum(value: number) {
        this._shareNum = value;
        this.delaySave();
    }

    public get nickName(): string {
        return this._nickName;
    }

    public set nickName(value: string) {
        this._nickName = value;
        this.delaySave();
    }

    public get avatarUrl(): string {
        return this._avatarUrl;
    }

    public set avatarUrl(value: string) {
        this._avatarUrl = value;
        this.delaySave();
    }

    public get gender(): number {
        return this._gender;
    }

    public set gender(value: number) {
        this._gender = value;
        this.delaySave();
    }

    public get date(): number {
        return this._date;
    }

    public set date(value: number) {
        this._date = value;
        this.delaySave();
    }

    public get signState(): number {
        return this._signState;
    }

    public set signState(value: number) {
        this._signState = value;
        this.delaySave();
    }

    public get signday(): number {
        return this._signday;
    }

    public set signday(value: number) {
        this._signday = value;
        this.delaySave();
    }

    public get firstGame(): number {
        return this._firstGame;
    }

    public set firstGame(value: number) {
        this._firstGame = value;
        this.save();
    }

    public get level(): number {
        return this._level;
    }

    public set level(value: number) {
        this._level = Math.max(1, Math.floor(value || 1));
        this.delaySave();
    }

    public get foundCowNum(): number {
        return this._foundCowNum;
    }

    public set foundCowNum(value: number) {
        this._foundCowNum = Math.max(0, Math.floor(value || 0));
        this.delaySave();
    }

    public get myScore(): number {
        return this._myScore;
    }

    public set myScore(value: number) {
        this._myScore = value;
        this.delaySave();
    }

    public get lastRecoveryTimestamp(): number {
        return this._lastRecoveryTimestamp;
    }

    public set lastRecoveryTimestamp(value: number) {
        this._lastRecoveryTimestamp = value;
        this.delaySave();
    }

    public get stamina(): number {
        return this._stamina;
    }

    public set stamina(value: number) {
        this._stamina = Math.max(0, Math.floor(value || 0));
        this.delaySave();
    }

    public get adStaminaUsedToday(): number {
        return this._adStaminaUsedToday;
    }

    public set adStaminaUsedToday(value: number) {
        this._adStaminaUsedToday = Math.min(3, Math.max(0, Math.floor(value || 0)));
        this.delaySave();
    }

    public get coin(): number {
        return this._coin;
    }

    public set coin(value: number) {
        this._coin = Math.max(0, Math.floor(value || 0));
        this.delaySave();
    }

    public get cowHintCount(): number {
        return this._cowHintCount;
    }

    public set cowHintCount(value: number) {
        this._cowHintCount = Math.max(0, Math.floor(value || 0));
        this.delaySave();
    }

    public get excludeHintCount(): number {
        return this._excludeHintCount;
    }

    public set excludeHintCount(value: number) {
        this._excludeHintCount = Math.max(0, Math.floor(value || 0));
        this.delaySave();
    }

    public get cowHintUnlockShown(): boolean {
        return this._cowHintUnlockShown;
    }

    public set cowHintUnlockShown(value: boolean) {
        this._cowHintUnlockShown = !!value;
        this.delaySave();
    }

    public get excludeHintUnlockShown(): boolean {
        return this._excludeHintUnlockShown;
    }

    public set excludeHintUnlockShown(value: boolean) {
        this._excludeHintUnlockShown = !!value;
        this.delaySave();
    }

    public get unlockSkin(): number[] {
        return [...this._unlockSkin];
    }

    public set unlockSkin(value: number[]) {
        if (!Array.isArray(value) || value.length === 0) {
            return;
        }

        if (this._unlockSkin.indexOf(value[0]) >= 0) {
            return;
        }

        this._unlockSkin.push(value[0]);
        this.delaySave();
    }

    public get useSkin(): number {
        return this._useSkin;
    }

    public set useSkin(value: number) {
        this._useSkin = value;
        this.delaySave();
    }

    public get freeSurvivalTime(): number {
        return this._freeSurvivalTime;
    }

    public set freeSurvivalTime(value: number) {
        this._freeSurvivalTime = Math.max(0, Math.floor(value || 0));
        this.delaySave();
    }

    public get nightMode(): boolean {
        return this._nightMode;
    }

    public set nightMode(v: boolean) {
        this._nightMode = v;
        this.save();
    }

    public get survivalBestRound(): number {
        return this._survivalBestRound;
    }

    public set survivalBestRound(value: number) {
        this._survivalBestRound = Math.max(0, Math.floor(value || 0));
        this.delaySave();
    }

    public get lastLoginDate(): string {
        return this._lastLoginDate;
    }

    public set lastLoginDate(value: string) {
        this._lastLoginDate = value;
        this.delaySave();
    }

    public get dailyChallengeFreeUsed(): boolean {
        return this._dailyChallengeFreeUsed;
    }

    public set dailyChallengeFreeUsed(value: boolean) {
        this._dailyChallengeFreeUsed = value;
        this.delaySave();
    }

    public get dailyChallengeStreak(): number {
        return this._dailyChallengeStreak;
    }

    public set dailyChallengeStreak(value: number) {
        this._dailyChallengeStreak = Math.max(0, Math.floor(value || 0));
        this.delaySave();
    }

    public get lastDailyChallengeDate(): string {
        return this._lastDailyChallengeDate;
    }

    public set lastDailyChallengeDate(value: string) {
        this._lastDailyChallengeDate = value;
        this.delaySave();
    }

    public get lastInterstitialAdDate(): string {
        return this._lastInterstitialAdDate;
    }

    public set lastInterstitialAdDate(value: string) {
        this._lastInterstitialAdDate = value || '';
        this.delaySave();
    }

    public get interstitialAdShownToday(): number {
        return this._interstitialAdShownToday;
    }

    public set interstitialAdShownToday(value: number) {
        this._interstitialAdShownToday = Math.max(0, Math.floor(value || 0));
        this.delaySave();
    }

    public get lastInterstitialAdTimestamp(): number {
        return this._lastInterstitialAdTimestamp;
    }

    public set lastInterstitialAdTimestamp(value: number) {
        this._lastInterstitialAdTimestamp = Math.max(0, Math.floor(value || 0));
        this.delaySave();
    }

    public get lastInterstitialAdLevel(): number {
        return this._lastInterstitialAdLevel;
    }

    public set lastInterstitialAdLevel(value: number) {
        this._lastInterstitialAdLevel = Math.max(0, Math.floor(value || 0));
        this.delaySave();
    }

    public getTodayDateString(): string {
        const now = new Date();
        const y = now.getFullYear().toString();
        const m = (now.getMonth() + 1).toString().padStart(2, '0');
        const d = now.getDate().toString().padStart(2, '0');
        return y + m + d;
    }

    public checkAndUpdateDailyChallengeStreak(): void {
        const today = this.getTodayDateString();
        if (this._lastDailyChallengeDate === '') {
            // first daily_challenge ever
            this._dailyChallengeStreak = 1;
        } else {
            const lastDate = new Date(
                parseInt(this._lastDailyChallengeDate.substring(0, 4)),
                parseInt(this._lastDailyChallengeDate.substring(4, 6)) - 1,
                parseInt(this._lastDailyChallengeDate.substring(6, 8))
            );
            const todayDate = new Date(
                parseInt(today.substring(0, 4)),
                parseInt(today.substring(4, 6)) - 1,
                parseInt(today.substring(6, 8))
            );
            const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000);
            if (diffDays === 1) {
                this._dailyChallengeStreak++;
            } else if (diffDays > 1) {
                this._dailyChallengeStreak = 1; // streak broken
            }
            // diffDays === 0 means already completed today, don't increment
        }
        this._lastDailyChallengeDate = today;
        this.delaySave();
    }

    public reset(): void {
        this._gameVideoTime = 0;
        this._shareNum = 3;
        this._nickName = '';
        this._avatarUrl = '';
        this._gender = 0;
        this._date = 0;
        this._signState = 0;
        this._signday = 1;
        this._firstGame = 0;
        this._level = 1;
        this._foundCowNum = 0;
        this._myScore = 1;
        this._lastRecoveryTimestamp = 0;
        this._stamina = 60;
        this._adStaminaUsedToday = 0;
        this._coin = 0;
        this._cowHintCount = 0;
        this._excludeHintCount = 0;
        this._cowHintUnlockShown = false;
        this._excludeHintUnlockShown = false;
        this._unlockSkin = [1];
        this._useSkin = 1;
        this._freeSurvivalTime = 2;
        this._nightMode = false;
        this._survivalBestRound = 0;
        this._lastLoginDate = '';
        this._dailyChallengeFreeUsed = false;
        this._dailyChallengeStreak = 0;
        this._lastDailyChallengeDate = '';
        this._lastInterstitialAdDate = '';
        this._interstitialAdShownToday = 0;
        this._lastInterstitialAdTimestamp = 0;
        this._lastInterstitialAdLevel = 0;
        this.save();
    }

    private applyPayload(raw: string) {
        try {
            const payload = JSON.parse(raw) as Partial<UserDataPayload>;
            this._gameVideoTime = this.readNumber(payload.gameVideoTime, 0);
            this._shareNum = this.readNumber(payload.shareNum, 3);
            this._nickName = payload.nickName || '';
            this._avatarUrl = payload.avatarUrl || '';
            this._gender = this.readNumber(payload.gender, 0);
            this._date = this.readNumber(payload.date, 0);
            this._signState = this.readNumber(payload.signState, 0);
            this._signday = this.readNumber(payload.signday, 1);
            this._firstGame = this.readNumber(payload.firstGame, 0);
            this._level = Math.max(1, this.readNumber(payload.level, 1));
            this._foundCowNum = Math.max(0, this.readNumber(payload.foundCowNum, 0));
            this._myScore = this.readNumber(payload.myScore, 1);
            this._lastRecoveryTimestamp = this.readNumber(payload.lastRecoveryTimestamp, 0);
            this._stamina = Math.max(0, Math.floor(this.readNumber(payload.stamina, 60)));
            this._adStaminaUsedToday = Math.min(3, Math.max(0, this.readNumber(payload.adStaminaUsedToday, 0)));
            this._coin = Math.max(0, this.readNumber(payload.coin, 0));
            this._cowHintCount = Math.max(0, Math.floor(this.readNumber(payload.cowHintCount, 0)));
            this._excludeHintCount = Math.max(0, Math.floor(this.readNumber(payload.excludeHintCount, 0)));
            this._cowHintUnlockShown = payload.cowHintUnlockShown ?? false;
            this._excludeHintUnlockShown = payload.excludeHintUnlockShown ?? false;
            this._unlockSkin = Array.isArray(payload.unlockSkin) && payload.unlockSkin.length > 0
                ? payload.unlockSkin.map((item) => this.readNumber(item, 1))
                : [1];
            this._useSkin = this.readNumber(payload.useSkin, 1);
            this._freeSurvivalTime = Math.max(0, this.readNumber(payload.freeSurvivalTime, 2));
            this._nightMode = payload.nightMode ?? false;
            this._survivalBestRound = Math.max(0, this.readNumber(payload.survivalBestRound, 0));
            this._lastLoginDate = payload.lastLoginDate || '';
            this._dailyChallengeFreeUsed = payload.dailyChallengeFreeUsed ?? false;
            this._dailyChallengeStreak = Math.max(0, this.readNumber(payload.dailyChallengeStreak, 0));
            this._lastDailyChallengeDate = payload.lastDailyChallengeDate || '';
            this._lastInterstitialAdDate = payload.lastInterstitialAdDate || '';
            this._interstitialAdShownToday = Math.max(0, Math.floor(this.readNumber(payload.interstitialAdShownToday, 0)));
            this._lastInterstitialAdTimestamp = Math.max(0, Math.floor(this.readNumber(payload.lastInterstitialAdTimestamp, 0)));
            this._lastInterstitialAdLevel = Math.max(0, Math.floor(this.readNumber(payload.lastInterstitialAdLevel, 0)));
        } catch (error) {
            console.error('读取用户数据失败', error);
        }
    }

    private readNumber(value: unknown, fallback: number): number {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    private notifySaveListeners(): void {
        for (const listener of this.saveListeners) {
            try {
                listener();
            } catch (e) {
                console.warn('[UserData] save listener failed', e);
            }
        }
    }

    private toJSON(): UserDataPayload {
        return {
            gameVideoTime: this._gameVideoTime,
            shareNum: this._shareNum,
            nickName: this._nickName,
            avatarUrl: this._avatarUrl,
            gender: this._gender,
            date: this._date,
            signState: this._signState,
            signday: this._signday,
            firstGame: this._firstGame,
            level: this._level,
            foundCowNum: this._foundCowNum,
            myScore: this._myScore,
            lastRecoveryTimestamp: this._lastRecoveryTimestamp,
            stamina: this._stamina,
            adStaminaUsedToday: this._adStaminaUsedToday,
            coin: this._coin,
            cowHintCount: this._cowHintCount,
            excludeHintCount: this._excludeHintCount,
            cowHintUnlockShown: this._cowHintUnlockShown,
            excludeHintUnlockShown: this._excludeHintUnlockShown,
            unlockSkin: [...this._unlockSkin],
            useSkin: this._useSkin,
            freeSurvivalTime: this._freeSurvivalTime,
            nightMode: this._nightMode,
            survivalBestRound: this._survivalBestRound,
            lastLoginDate: this._lastLoginDate,
            dailyChallengeFreeUsed: this._dailyChallengeFreeUsed,
            dailyChallengeStreak: this._dailyChallengeStreak,
            lastDailyChallengeDate: this._lastDailyChallengeDate,
            lastInterstitialAdDate: this._lastInterstitialAdDate,
            interstitialAdShownToday: this._interstitialAdShownToday,
            lastInterstitialAdTimestamp: this._lastInterstitialAdTimestamp,
            lastInterstitialAdLevel: this._lastInterstitialAdLevel,
        };
    }
}
