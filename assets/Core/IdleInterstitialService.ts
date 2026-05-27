import { input, Input } from 'cc';
import GameApp from './GameApp';
import { GameMode, UIID } from './Enum';
import RewardService from './RewardService';

class IdleInterstitialService {
    private readonly IDLE_THRESHOLD_MS = 15000;
    private readonly CHECK_INTERVAL_MS = 1000;
    private started = false;
    private lastInteractionTimestamp = Date.now();
    private timer: ReturnType<typeof setInterval> | null = null;

    public start(): void {
        if (this.started) return;
        this.started = true;
        this.lastInteractionTimestamp = Date.now();
        input.on(Input.EventType.TOUCH_START, this.onUserInteraction, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onUserInteraction, this);
        input.on(Input.EventType.TOUCH_END, this.onUserInteraction, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onUserInteraction, this);
        this.timer = setInterval(() => this.checkIdle(), this.CHECK_INTERVAL_MS);
    }

    public stop(): void {
        if (!this.started) return;
        this.started = false;
        input.off(Input.EventType.TOUCH_START, this.onUserInteraction, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onUserInteraction, this);
        input.off(Input.EventType.TOUCH_END, this.onUserInteraction, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onUserInteraction, this);
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private onUserInteraction(): void {
        this.lastInteractionTimestamp = Date.now();
    }

    private checkIdle(): void {
        if (!this.canRequestInterstitial()) {
            this.lastInteractionTimestamp = Date.now();
            return;
        }
        if (Date.now() - this.lastInteractionTimestamp < this.IDLE_THRESHOLD_MS) return;
        const requested = RewardService.requestInterstitial({
            scene: 'screen_idle_15s',
            onShown: () => this.onUserInteraction(),
            onSkipped: () => this.onUserInteraction(),
        });
        if (!requested) {
            this.onUserInteraction();
        }
    }

    private canRequestInterstitial(): boolean {
        if (!GameApp.platformReady) return false;
        if (!RewardService.isInterstitialAdAvailable()) return false;
        if (RewardService.isRewardAdPlaying()) return false;
        if (GameApp.isStartGame) return false;
        if (!GameApp.uiManager?.isOpen(UIID.MainPanel)) return false;
        if (GameApp.gameMode === GameMode.level && GameApp.user.firstGame < 2) return false;
        if (GameApp.isGuideSettlement) return false;
        if (GameApp.uiManager?.isOpen(UIID.GuidePanel)) return false;
        if (GameApp.uiManager?.isOpen(UIID.PrivacyPanel)) return false;
        if (GameApp.uiManager?.isOpen(UIID.AntiAddictionPanel)) return false;
        return true;
    }
}

export default new IdleInterstitialService();
