import { AudioClip, AudioSource, Node, director, input, Input, sys } from 'cc';
import AssetService from './AssetService';
import PerfDebug from '../Utils/PerfDebug';

declare const wx: any;

type SfxKey = 'mark' | 'unmark' | 'revealCow' | 'revealFail' | 'ruleViolation' | 'levelWin' | 'levelFail' | 'coinGain' | 'uiClick' | 'ruleIntro';

class SfxManager {
  private static _instance: SfxManager | null = null;

  public static get instance(): SfxManager {
    if (!this._instance) {
      this._instance = new SfxManager();
    }
    return this._instance;
  }

  private readonly clipPaths: Record<SfxKey, string> = {
    mark: 'audio/mark',
    unmark: 'audio/unmark',
    revealCow: 'audio/reveal_cow_treasure',
    revealFail: 'audio/reveal_fail',
    ruleViolation: 'audio/rule_violation',
    levelWin: 'audio/level_win',
    levelFail: 'audio/level_fail',
    coinGain: 'audio/coin_gain',
    uiClick: 'audio/ui_click',
    ruleIntro: 'audio/rule_intro',
  };

  private readonly volumes: Record<SfxKey, number> = {
    mark: 0.8,
    unmark: 0.6,
    revealCow: 0.65,
    revealFail: 0.55,
    ruleViolation: 0.7,
    levelWin: 0.7,
    levelFail: 0.65,
    coinGain: 0.6,
    uiClick: 0.5,
    ruleIntro: 0.6,
  };

  private audioSource: AudioSource | null = null;
  private bgmSource: AudioSource | null = null;
  private clips: Partial<Record<SfxKey, AudioClip>> = {};
  private menuBgmClip: AudioClip | null = null;  // Main menu BGM
  private levelBgmClip: AudioClip | null = null; // Level gameplay BGM
  private currentBgmType: 'menu' | 'level' = 'menu'; // Current playing BGM type
  private playingBgmType: 'menu' | 'level' | null = null;
  private loading: Partial<Record<SfxKey, boolean>> = {};
  private pendingCallbacks: Partial<Record<SfxKey, Array<(clip: AudioClip | null) => void>>> = {};
  private lastPlayTime: Record<string, number> = {};
  private bgmEnabled: boolean = true;
  private sfxEnabled: boolean = true;
  private vibrateEnabled: boolean = true;
  private audioUnlocked: boolean = false;
  private warmupRequested: boolean = false;
  private menuBgmLoaded: boolean = false;
  private levelBgmLoaded: boolean = false;
  private menuBgmLoading: boolean = false;
  private levelBgmLoading: boolean = false;
  private globalUnlockBound: boolean = false;
  private miniGameShowBound: boolean = false;
  private bgmRetryToken: number = 0;
  private readonly bgmStorageKey = 'niuma_bgm_enabled';
  private readonly sfxStorageKey = 'niuma_sfx_enabled';
  private readonly vibrateStorageKey = 'niuma_vibrate_enabled';

  private constructor() {
    this.bgmEnabled = this.readBool(this.bgmStorageKey, true);
    this.sfxEnabled = this.readBool(this.sfxStorageKey, true);
    this.vibrateEnabled = this.readBool(this.vibrateStorageKey, true);
  }

  public preload() {
    PerfDebug.mark('Sfx.preload');
    this.applyMiniGameAudioOptions();
    if (this.isMiniGameRuntime()) {
      this.audioUnlocked = true;
    }
    this.ensureAudioSource();
    this.bindGlobalAudioUnlock();
    this.bindMiniGameLifecycleAudioResume();
    setTimeout(() => this.warmupGameplayAudio(), 1200);
  }

  // Called on first user interaction (for browser preview)
  public unlock() {
    const startedAt = PerfDebug.now();
    const wasUnlocked = this.audioUnlocked;
    this.audioUnlocked = true;
    if (!this.bgmEnabled) {
      return;
    }
    if (wasUnlocked && this.bgmSource?.playing) {
      return;
    }
    this.playBgmInternal(this.currentBgmType);
    if (!wasUnlocked) {
      this.scheduleBgmRetry(this.currentBgmType, 6, 180);
    }
    PerfDebug.slow('Sfx.unlock', startedAt, 16, {
      currentBgmType: this.currentBgmType,
      bgmEnabled: this.bgmEnabled,
    });
  }

  public forceUnlock() {
    this.unlock();
  }

  public resumeCurrentBgm(reason: string = 'manual'): void {
    if (!this.bgmEnabled) return;
    this.bindMiniGameLifecycleAudioResume();
    if (this.isMiniGameRuntime()) {
      this.audioUnlocked = true;
    }
    PerfDebug.mark('Sfx.resumeCurrentBgm', {
      reason,
      type: this.currentBgmType,
      unlocked: this.audioUnlocked,
    });
    if (this.currentBgmType === 'menu') {
      this.loadMenuBgm();
    } else {
      this.loadLevelBgm();
    }
    this.playBgmInternal(this.currentBgmType);
    this.scheduleBgmRetry(this.currentBgmType, 12, 140);
  }

  public warmupGameplayAudio(): void {
    if (!this.sfxEnabled && !this.bgmEnabled) return;
    const shouldWarmupSfx = !this.warmupRequested;
    this.warmupRequested = true;
    PerfDebug.mark('Sfx.warmup gameplay begin');
    this.loadLevelBgm();
    if (!shouldWarmupSfx) return;
    const keys: SfxKey[] = [
      'uiClick',
      'ruleIntro',
      'mark',
      'unmark',
      'revealCow',
      'revealFail',
      'ruleViolation',
      'levelWin',
      'coinGain',
    ];
    keys.forEach((key, index) => {
      setTimeout(() => {
        if (!this.sfxEnabled) return;
        this.loadClip(key, clip => {
          PerfDebug.mark('Sfx.warmup item', { key, ok: !!clip });
        });
      }, index * 80);
    });
  }

  // ==================== Menu BGM ====================
  // Play menu BGM (for MainPanel)
  public playMenuBgm(): void {
    this.currentBgmType = 'menu';
    PerfDebug.mark('Sfx.playMenuBgm', { enabled: this.bgmEnabled, unlocked: this.audioUnlocked });
    if (!this.bgmEnabled) return;
    this.loadMenuBgm();
    this.stopAllBgm();
    if (!this.audioUnlocked) return;
    this.playBgmInternal('menu');
    this.scheduleBgmRetry('menu', 12, 140);
  }

  // Stop menu BGM
  public stopMenuBgm(): void {
    if (this.currentBgmType === 'menu') {
      this.stopAllBgm();
    }
  }

  // ==================== Level BGM ====================
  // Play level BGM (for gameplay)
  public playLevelBgm(): void {
    this.currentBgmType = 'level';
    PerfDebug.mark('Sfx.playLevelBgm', { enabled: this.bgmEnabled, unlocked: this.audioUnlocked });
    if (!this.bgmEnabled) return;
    this.loadLevelBgm();
    this.stopAllBgm();
    if (!this.audioUnlocked) return;
    this.playBgmInternal('level');
    this.scheduleBgmRetry('level', 10, 160);
  }

  // Stop level BGM
  public stopLevelBgm(): void {
    if (this.currentBgmType === 'level') {
      this.stopAllBgm();
    }
  }

  // ==================== Legacy compatibility ====================
  // Play BGM immediately (legacy - plays current type)
  public playBgmNow(): void {
    this.playBgmInternal(this.currentBgmType);
  }

  // Stop BGM (legacy)
  public stopBgmNow(): void {
    this.stopAllBgm();
  }

  // BGM controls
  public setBgmEnabled(enabled: boolean) {
    this.bgmEnabled = enabled;
    this.writeBool(this.bgmStorageKey, enabled);
    if (enabled) {
      this.playBgmInternal(this.currentBgmType);
    } else {
      this.stopAllBgm();
    }
  }

  public isBgmEnabled(): boolean {
    return this.bgmEnabled;
  }

  public setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    this.writeBool(this.sfxStorageKey, enabled);
    if (!enabled && this.audioSource) {
      this.audioSource.stop();
    }
  }

  public isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  // ==================== BGM Loading ====================
  private loadMenuBgm() {
    if (this.menuBgmLoaded || this.menuBgmLoading) return;
    this.menuBgmLoading = true;
    PerfDebug.begin('Sfx.loadMenuBgm');
    AssetService.loadAudio('audio/bgm', (clip) => {
      this.menuBgmLoading = false;
      if (!clip) {
        PerfDebug.end('Sfx.loadMenuBgm', { ok: false });
        console.warn('[MenuBGM] Cocos load failed');
        return;
      }
      this.menuBgmClip = clip;
      this.menuBgmLoaded = true;
      PerfDebug.end('Sfx.loadMenuBgm', { ok: true });
      if (PerfDebug.enabled) console.log('[MenuBGM] Cocos loaded');

      if (this.bgmEnabled && this.currentBgmType === 'menu') {
        this.playBgmCocos('menu');
        this.scheduleBgmRetry('menu');
      }
    });
  }

  private loadLevelBgm() {
    if (this.levelBgmLoaded || this.levelBgmLoading) return;
    this.levelBgmLoading = true;
    PerfDebug.begin('Sfx.loadLevelBgm');
    AssetService.loadAudio('audio/level_bgm', (clip) => {
      this.levelBgmLoading = false;
      if (!clip) {
        PerfDebug.end('Sfx.loadLevelBgm', { ok: false });
        console.warn('[LevelBGM] Cocos load failed');
        return;
      }
      this.levelBgmClip = clip;
      this.levelBgmLoaded = true;
      PerfDebug.end('Sfx.loadLevelBgm', { ok: true });
      if (PerfDebug.enabled) console.log('[LevelBGM] Cocos loaded');

      if (this.bgmEnabled && this.currentBgmType === 'level') {
        this.playBgmCocos('level');
        this.scheduleBgmRetry('level');
      }
    });
  }

  // ==================== BGM Playback ====================
  private playBgmInternal(type: 'menu' | 'level'): void {
    if (!this.bgmEnabled) return;
    if (!this.audioUnlocked) return;

    if (type === 'menu' && !this.menuBgmLoaded) {
      this.loadMenuBgm();
    } else if (type === 'level' && !this.levelBgmLoaded) {
      this.loadLevelBgm();
    }
    this.playBgmCocos(type);
  }

  private playBgmCocos(type: 'menu' | 'level', scheduleRetry: boolean = true): void {
    const clip = type === 'menu' ? this.menuBgmClip : this.levelBgmClip;
    if (!clip || !this.bgmEnabled) return;

    const source = this.ensureBgmSource();
    if (!source) return;
    if (source.playing && this.playingBgmType === type) return;

    source.stop();
    source.clip = clip;
    source.volume = type === 'level' ? 0.9 : 0.8;
    source.loop = true;
    source.play();
    this.playingBgmType = type;
    if (scheduleRetry) {
      this.scheduleBgmRetry(type);
    }
    if (PerfDebug.enabled) console.log(`[BGM-Cocos] Playing ${type} BGM`);
  }

  private scheduleBgmRetry(type: 'menu' | 'level', attempts: number = 8, delayMs: number = 180): void {
    const token = ++this.bgmRetryToken;
    const run = (remaining: number, delay: number): void => {
      setTimeout(() => {
        if (token !== this.bgmRetryToken) return;
        if (!this.bgmEnabled || !this.audioUnlocked || this.currentBgmType !== type) return;
        const clip = type === 'menu' ? this.menuBgmClip : this.levelBgmClip;
        if (!clip) return;
        const source = this.ensureBgmSource();
        if (!source || (source.playing && this.playingBgmType === type)) return;
        this.playBgmCocos(type, false);
        if (remaining > 1) {
          run(remaining - 1, Math.round(delay * 1.8));
        }
      }, delay);
    };
    run(attempts, delayMs);
  }

  private stopAllBgm(): void {
    if (this.bgmSource) {
      this.bgmSource.stop();
    }
    this.playingBgmType = null;
  }

  // SFX play methods
  public playMark() {
    if (!this.sfxEnabled) return;
    this.play('mark', 30);
  }

  public playUnmark() {
    if (!this.sfxEnabled) return;
    this.play('unmark', 30);
  }

  public playRevealCow() {
    if (!this.sfxEnabled) return;
    this.play('revealCow', 100);
  }

  public playRevealFail() {
    if (!this.sfxEnabled) return;
    this.play('revealFail', 150);
  }

  public playRuleViolation() {
    if (!this.sfxEnabled) return;
    this.play('ruleViolation', 1100);
  }

  public playLevelWin() {
    if (!this.sfxEnabled) return;
    this.play('levelWin', 200);
  }

  public playLevelFail() {
    if (!this.sfxEnabled) return;
    this.play('levelFail', 200);
  }

  public playCoinGain() {
    if (!this.sfxEnabled) return;
    this.play('coinGain', 60);
  }

  public playUiClick(volume?: number) {
    if (!this.sfxEnabled) return;
    this.play('uiClick', 40, volume);
  }

  public playRuleIntro() {
    if (!this.sfxEnabled) return;
    this.play('ruleIntro', 200);
  }

  public setVibrateEnabled(enabled: boolean) {
    this.vibrateEnabled = enabled;
    this.writeBool(this.vibrateStorageKey, enabled);
  }

  public isVibrateEnabled(): boolean {
    return this.vibrateEnabled;
  }

  public vibrateShort(duration: number = 40) {
    if (!this.vibrateEnabled) return;
    const startedAt = PerfDebug.now();
    const finishDiag = (mode: string): void => {
      PerfDebug.slow('Sfx.vibrateShort', startedAt, 16, { duration, mode });
    };

    const miniGameApi = this.getMiniGameApi();
    if (miniGameApi && typeof miniGameApi.vibrateShort === 'function') {
      const type = duration >= 60 ? 'heavy' : (duration > 30 ? 'medium' : 'light');
      try {
        miniGameApi.vibrateShort({
          type,
          fail: () => this.vibrateShortWithoutType(miniGameApi),
        });
        finishDiag(`wx-${type}`);
        return;
      } catch (e) {
        if (this.vibrateShortWithoutType(miniGameApi)) {
          finishDiag('wx-fallback');
          return;
        }
        console.warn('[Vibrate] vibrateShort failed', e);
      }
      finishDiag('wx-failed');
      return;
    }

    const navigatorApi = (globalThis as any).navigator;
    if (navigatorApi && typeof navigatorApi.vibrate === 'function') {
      navigatorApi.vibrate(duration);
      finishDiag('navigator');
    }
  }

  public vibrateRevealCell() {
    if (!this.vibrateEnabled) return;
    const startedAt = PerfDebug.now();
    const finishDiag = (mode: string): void => {
      PerfDebug.slow('Sfx.vibrateRevealCell', startedAt, 16, { mode });
    };

    const miniGameApi = this.getMiniGameApi();
    if (!miniGameApi) {
      finishDiag('no-api');
      return;
    }

    if (typeof miniGameApi.vibrateLong === 'function') {
      try {
        miniGameApi.vibrateLong({
          fail: () => this.vibrateShortHeavy(miniGameApi),
        });
        finishDiag('wx-long');
        return;
      } catch (e) {
        try {
          miniGameApi.vibrateLong();
          finishDiag('wx-long-fallback-call');
          return;
        } catch (fallbackError) {
          if (this.vibrateShortHeavy(miniGameApi)) {
            finishDiag('wx-short-heavy-fallback');
            return;
          }
          console.warn('[Vibrate] reveal cell vibration failed', fallbackError || e);
        }
      }
      finishDiag('wx-long-failed');
      return;
    }

    this.vibrateShortHeavy(miniGameApi);
    finishDiag('wx-short-heavy');
  }

  public vibrateLong() {
    if (!this.vibrateEnabled) return;

    const miniGameApi = this.getMiniGameApi();
    if (miniGameApi && typeof miniGameApi.vibrateLong === 'function') {
      try {
        miniGameApi.vibrateLong({});
      } catch (e) {
        try {
          miniGameApi.vibrateLong();
        } catch (fallbackError) {
          console.warn('[Vibrate] vibrateLong failed', fallbackError || e);
        }
      }
      return;
    }

    const navigatorApi = (globalThis as any).navigator;
    if (navigatorApi && typeof navigatorApi.vibrate === 'function') {
      navigatorApi.vibrate(400);
    }
  }

  private getMiniGameApi(): any | null {
    const root = globalThis as any;
    if (root.__rawWx) return root.__rawWx;
    if (root.wx) return root.wx;
    if (typeof wx !== 'undefined') return wx;
    return null;
  }

  private isMiniGameRuntime(): boolean {
    return this.getMiniGameApi() !== null;
  }

  private vibrateShortHeavy(api: any): boolean {
    if (!api || typeof api.vibrateShort !== 'function') return false;
    try {
      api.vibrateShort({
        type: 'heavy',
        fail: () => this.vibrateShortWithoutType(api),
      });
      return true;
    } catch (e) {
      return this.vibrateShortWithoutType(api);
    }
  }

  private vibrateShortWithoutType(api: any): boolean {
    if (!api || typeof api.vibrateShort !== 'function') return false;
    try {
      api.vibrateShort({});
      return true;
    } catch (e) {
      try {
        api.vibrateShort();
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  private play(key: SfxKey, minIntervalMs: number, volumeOverride?: number) {
    const startedAt = PerfDebug.now();
    if (!this.sfxEnabled) {
      return;
    }

    if (!this.canPlay(key, minIntervalMs)) {
      return;
    }

    const source = this.ensureAudioSource();
    if (!source) {
      return;
    }

    const clip = this.clips[key];
    if (clip) {
      PerfDebug.count(`sfx.hit.${key}`);
      source.playOneShot(clip, volumeOverride ?? this.volumes[key]);
      PerfDebug.slow('Sfx.play', startedAt, 16, { key, cache: 'hit' });
      return;
    }

    PerfDebug.count(`sfx.miss.${key}`);
    PerfDebug.mark('Sfx.play cache miss', { key, path: this.clipPaths[key] });
    this.loadClip(key, (loadedClip) => {
      if (!this.sfxEnabled) {
        return;
      }

      const latestSource = this.ensureAudioSource();
      if (latestSource && loadedClip) {
        latestSource.playOneShot(loadedClip, volumeOverride ?? this.volumes[key]);
      }
    });
    PerfDebug.slow('Sfx.play', startedAt, 16, { key, cache: 'miss' });
  }

  private loadClip(key: SfxKey, onLoaded?: (clip: AudioClip | null) => void) {
    if (this.clips[key]) {
      onLoaded?.(this.clips[key] || null);
      return;
    }
    if (this.loading[key]) {
      if (onLoaded) {
        if (!this.pendingCallbacks[key]) {
          this.pendingCallbacks[key] = [];
        }
        this.pendingCallbacks[key]!.push(onLoaded);
      }
      return;
    }

    if (onLoaded) {
      this.pendingCallbacks[key] = [onLoaded];
    }
    this.loading[key] = true;
    AssetService.loadAudio(this.clipPaths[key], (clip) => {
      this.loading[key] = false;
      const callbacks = this.pendingCallbacks[key] || [];
      delete this.pendingCallbacks[key];
      if (!clip) {
        console.warn(`Sfx load failed: ${this.clipPaths[key]}`);
        callbacks.forEach((callback) => callback(null));
        return;
      }

      this.clips[key] = clip;
      callbacks.forEach((callback) => callback(clip));
    });
  }

  private ensureAudioSource(): AudioSource | null {
    if (this.audioSource && this.audioSource.node && this.audioSource.node.isValid) {
      return this.audioSource;
    }

    const scene = director.getScene();
    if (!scene) {
      return null;
    }

    const parent = scene.getChildByName('Canvas') || scene;
    const node = new Node('SfxAudioSource');
    node.parent = parent;
    this.audioSource = node.addComponent(AudioSource);
    this.audioSource.loop = false;
    this.audioSource.playOnAwake = false;
    this.audioSource.volume = 1;
    return this.audioSource;
  }

  private ensureBgmSource(): AudioSource | null {
    if (this.bgmSource && this.bgmSource.node && this.bgmSource.node.isValid) {
      return this.bgmSource;
    }

    const scene = director.getScene();
    if (!scene) {
      return null;
    }

    const parent = scene.getChildByName('Canvas') || scene;
    const node = new Node('BgmAudioSource');
    node.parent = parent;
    this.bgmSource = node.addComponent(AudioSource);
    this.bgmSource.loop = true;
    this.bgmSource.playOnAwake = false;
    this.bgmSource.volume = 0.8; // BGM volume (raised)
    return this.bgmSource;
  }

  private bindGlobalAudioUnlock(): void {
    if (this.globalUnlockBound) return;
    this.globalUnlockBound = true;
    input.on(Input.EventType.TOUCH_START, this.onGlobalAudioTouch, this);
    input.on(Input.EventType.MOUSE_DOWN, this.onGlobalAudioTouch, this);
  }

  private onGlobalAudioTouch(): void {
    const wasUnlocked = this.audioUnlocked;
    this.audioUnlocked = true;
    if (!this.bgmEnabled) return;
    if (wasUnlocked && this.bgmSource?.playing) return;
    this.resumeCurrentBgm('global-touch');
  }

  private bindMiniGameLifecycleAudioResume(): void {
    if (this.miniGameShowBound) return;
    const miniGameApi = this.getMiniGameApi();
    if (!miniGameApi || typeof miniGameApi.onShow !== 'function') return;
    this.miniGameShowBound = true;
    miniGameApi.onShow(() => {
      this.resumeCurrentBgm('wx.onShow');
    });
  }

  private applyMiniGameAudioOptions() {
    const wxApi = (globalThis as any).__rawWx || (globalThis as any).wx || (typeof wx !== 'undefined' ? wx : null);
    if (wxApi && typeof wxApi.setInnerAudioOption === 'function') {
      try {
        wxApi.setInnerAudioOption({
          obeyMuteSwitch: false,
          mixWithOther: true,
        });
        if (PerfDebug.enabled) console.log('[SfxManager] WeChat audio options applied');
      } catch (error) {
        console.warn('[SfxManager] WeChat audio options failed', error);
      }
    }
  }

  private canPlay(key: string, minIntervalMs: number): boolean {
    const now = Date.now();
    const last = this.lastPlayTime[key] || 0;
    if (now - last < minIntervalMs) {
      return false;
    }
    this.lastPlayTime[key] = now;
    return true;
  }

  private readBool(key: string, fallback: boolean): boolean {
    try {
      const raw = sys.localStorage.getItem(key);
      if (raw === '1' || raw === 'true') return true;
      if (raw === '0' || raw === 'false') return false;
    } catch (error) {
      console.warn(`[SfxManager] read setting failed: ${key}`, error);
    }
    return fallback;
  }

  private writeBool(key: string, value: boolean): void {
    try {
      sys.localStorage.setItem(key, value ? '1' : '0');
    } catch (error) {
      console.warn(`[SfxManager] write setting failed: ${key}`, error);
    }
  }
}

export default SfxManager;
