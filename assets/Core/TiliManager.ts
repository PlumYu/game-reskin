import { Component, _decorator } from 'cc';
import GameApp from './GameApp';
import { formatClockTime } from '../Utils/TimeFormat';

const { ccclass } = _decorator;

@ccclass('TiliManager')
export default class TiliManager extends Component {
    private readonly maxStamina: number = 120;
    private readonly recoveryTime: number = 60;
    private countdownText: string = '';

    onLoad(): void {
        GameApp.tiliManager = this;
        this.recoverOfflineStamina();
        this.schedule(this.tickRecovery, 1);
    }

    private recoverOfflineStamina(): void {
        const user = GameApp.user;
        if (user.stamina >= this.maxStamina) {
            return;
        }
        if (user.lastRecoveryTimestamp <= 0) {
            user.lastRecoveryTimestamp = user.serverTime;
            return;
        }

        const elapsed = user.serverTime - user.lastRecoveryTimestamp;
        if (elapsed <= 0) {
            return;
        }

        const recovered = Math.floor(elapsed / this.recoveryTime);
        if (recovered > 0) {
            user.stamina = Math.min(this.maxStamina, user.stamina + recovered);
            user.lastRecoveryTimestamp += recovered * this.recoveryTime;
        }
    }

    private tickRecovery(): void {
        const user = GameApp.user;
        if (user.stamina >= this.maxStamina) {
            user.lastRecoveryTimestamp = user.serverTime;
            this.countdownText = '';
            return;
        }

        const elapsed = user.serverTime - user.lastRecoveryTimestamp;
        if (elapsed >= this.recoveryTime) {
            const recovered = Math.floor(elapsed / this.recoveryTime);
            user.stamina = Math.min(this.maxStamina, user.stamina + recovered);
            user.lastRecoveryTimestamp += recovered * this.recoveryTime;
        }

        if (user.stamina < this.maxStamina) {
            const remaining = this.recoveryTime - (user.serverTime - user.lastRecoveryTimestamp);
            this.countdownText = this.formatTime(Math.max(0, remaining));
        } else {
            this.countdownText = '';
        }
    }

    public getCountdownText(): string {
        return this.countdownText;
    }

    public getMaxStamina(): number {
        return this.maxStamina;
    }

    /** @deprecated 使用 getMaxStamina() */
    public getMaxHearts(): number {
        return this.maxStamina;
    }

    public useTili(amount: number): boolean {
        const user = GameApp.user;
        if (user.stamina < amount) {
            return false;
        }

        if (user.stamina >= this.maxStamina) {
            user.lastRecoveryTimestamp = user.serverTime;
        }
        user.stamina -= amount;
        return true;
    }

    public addTili(amount: number): void {
        const user = GameApp.user;
        user.stamina += Math.max(0, Math.floor(amount || 0));
    }

    public isFull(): boolean {
        return GameApp.user.stamina >= this.maxStamina;
    }

    public isEmpty(): boolean {
        return GameApp.user.stamina <= 0;
    }

    private formatTime(seconds: number): string {
        return formatClockTime(seconds);
    }
}
