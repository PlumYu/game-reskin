import { _decorator, Component, Label } from 'cc';
import GameApp from './GameApp';

const { ccclass } = _decorator;

@ccclass('CountdownController')
export default class CountdownController extends Component {
    private currentTime: number = 0;
    private totalTimeConfigured: number = 0;
    private _isRunning: boolean = false;
    private displayLabelExternal: Label | null = null;
    private onEndCallback: (() => void) | null = null;
    private onTickCallback: ((time: number) => void) | null = null;

    onLoad(): void {
        GameApp.countDownControl = this;
    }

    init(totalTime: number, displayLabel: Label | null, onEndCallback: (() => void) | null): void {
        this.endCountDown();
        this.totalTimeConfigured = Math.max(0, Math.floor(totalTime));
        this.currentTime = this.totalTimeConfigured;
        this.displayLabelExternal = displayLabel;
        this.onEndCallback = onEndCallback;
        this.notifyTick();
    }

    registerTickCallback(callback: (time: number) => void): void {
        this.onTickCallback = callback;
    }

    initAndStart(totalTime: number, displayLabel: Label | null, onEndCallback: (() => void) | null): void {
        this.init(totalTime, displayLabel, onEndCallback);
        this.startCountDown();
    }

    startCountDown(): void {
        if (this._isRunning) {
            console.warn('Countdown is already running.');
            return;
        }
        if (this.currentTime <= 0) {
            this.currentTime = this.totalTimeConfigured;
        }
        this.notifyTick();
        this._isRunning = true;
        this.schedule(this.tick, 1);
    }

    endCountDown(): void {
        this.unschedule(this.tick);
        this._isRunning = false;
    }

    resetCountDown(): void {
        this.endCountDown();
        this.currentTime = this.totalTimeConfigured;
        this.notifyTick();
    }

    pauseCountDown(): void {
        this.endCountDown();
    }

    addTime(seconds: number): void {
        if (seconds <= 0) {
            console.warn('addTime: seconds must be greater than 0.');
            return;
        }
        this.currentTime += seconds;
        this.notifyTick();
    }

    subtractTime(seconds: number): boolean {
        if (seconds <= 0) {
            console.warn('subtractTime: seconds must be greater than 0.');
            return false;
        }
        this.currentTime -= seconds;
        if (this.currentTime <= 0) {
            this.currentTime = 0;
            this.onCountdownFinished();
            return true;
        }
        this.notifyTick();
        return false;
    }

    getCurrentTime(): number {
        return this.currentTime;
    }

    getTotalTime(): number {
        return this.totalTimeConfigured;
    }

    isCountingDown(): boolean {
        return this._isRunning;
    }

    private tick(): void {
        if (this.currentTime > 0) {
            this.currentTime--;
            this.notifyTick();
            GameApp.useTime++;
            if (this.currentTime <= 0) {
                this.currentTime = 0;
                this.onCountdownFinished();
            }
        }
    }

    private notifyTick(): void {
        if (this.onTickCallback) {
            this.onTickCallback(this.currentTime);
        } else if (this.displayLabelExternal) {
            this.displayLabelExternal.string = `${Math.max(0, Math.floor(this.currentTime || 0))}s`;
        }
    }

    private onCountdownFinished(): void {
        this.endCountDown();
        this.onEndCallback?.();
    }

    onDestroy(): void {
        this.unschedule(this.tick);
    }
}

export { CountdownController };
