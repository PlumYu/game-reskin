import { AssetManager, AudioClip, ImageAsset, JsonAsset, assetManager, resources as cocosResources, SpriteAtlas, SpriteFrame, Texture2D } from 'cc';
import PerfDebug from '../Utils/PerfDebug';

export type TextureFilterMode = 'pixel' | 'smooth';
type BundlePathResolution = { bundleName: string; path: string; fallbackBundleName?: string };

const REMOTE_BUNDLE_NAME = 'remote';
const BOOTSTRAP_BUNDLE_NAME = 'bootstrap';
const BOOTSTRAP_ASSET_PATHS = new Set<string>([
    'images/hud_pill_base',
    'images/hud_stamina_frame',
    'images/hud_setting',
    'images/hud_coin',
    'images/menu_level_button',
    'images/背景图',
    'characters/menu_idle_static',
    'guide/guide_finger',
    'configs/main/001',
    'audio/ui_click',
    'audio/mark',
    'audio/unmark',
    'audio/reveal_fail',
    'audio/rule_violation',
]);
const BOOTSTRAP_DIR_PATHS = new Set<string>([
    'balloon_atlas',
]);

class AssetService {
    private spriteCache: Record<string, SpriteFrame | null> = {};
    private spriteDirCache: Record<string, SpriteFrame[]> = {};
    private jsonCache: Record<string, JsonAsset | null> = {};
    private audioCache: Record<string, AudioClip | null> = {};
    private bundleCache: Record<string, AssetManager.Bundle | null> = {};
    private bundleLoading: Record<string, boolean> = {};
    private bundleCallbacks: Record<string, Array<(bundle: AssetManager.Bundle | null) => void>> = {};
    private spriteLoading: Record<string, boolean> = {};
    private spriteCallbacks: Record<string, Array<(frame: SpriteFrame | null) => void>> = {};
    private spriteDirLoading: Record<string, boolean> = {};
    private spriteDirCallbacks: Record<string, Array<(frames: SpriteFrame[]) => void>> = {};
    private jsonLoading: Record<string, boolean> = {};
    private jsonCallbacks: Record<string, Array<(asset: JsonAsset | null) => void>> = {};
    private audioLoading: Record<string, boolean> = {};
    private audioCallbacks: Record<string, Array<(clip: AudioClip | null) => void>> = {};
    private traceSeq: number = 0;

    public loadSpriteFrame(path: string, onLoaded: (frame: SpriteFrame | null) => void, filter: TextureFilterMode = 'pixel'): void {
        const key = `${filter}:${path}`;
        if (Object.prototype.hasOwnProperty.call(this.spriteCache, key)) {
            PerfDebug.mark('asset sprite cache hit', { path, filter });
            onLoaded(this.spriteCache[key]);
            return;
        }

        if (!this.spriteCallbacks[key]) {
            this.spriteCallbacks[key] = [];
        }
        this.spriteCallbacks[key].push(onLoaded);
        if (this.spriteLoading[key]) {
            PerfDebug.mark('asset sprite loading join', { path, filter });
            return;
        }
        this.spriteLoading[key] = true;

        const resolved = this.resolveBundlePath(path);
        const trace = this.nextTrace(`asset sprite ${resolved.bundleName}:${resolved.path}`);
        PerfDebug.begin(trace, { path, filter });
        this.loadResolvedSpriteFrame(resolved, filter, (frame, bundleName) => {
            const configured = this.configureSpriteFrame(frame, filter);
            if (configured) {
                this.spriteCache[key] = configured;
            } else {
                delete this.spriteCache[key];
            }
            PerfDebug.end(trace, { ok: !!configured, bundle: bundleName });
            this.finishSpriteLoad(key, configured);
        });
    }

    public loadSpriteFrameDir(path: string, onLoaded: (frames: SpriteFrame[]) => void, filter: TextureFilterMode = 'pixel'): void {
        const key = `${filter}:${path}`;
        if (Object.prototype.hasOwnProperty.call(this.spriteDirCache, key)) {
            PerfDebug.mark('asset dir cache hit', { path, filter, count: this.spriteDirCache[key].length });
            onLoaded(this.spriteDirCache[key]);
            return;
        }

        if (!this.spriteDirCallbacks[key]) {
            this.spriteDirCallbacks[key] = [];
        }
        this.spriteDirCallbacks[key].push(onLoaded);
        if (this.spriteDirLoading[key]) {
            PerfDebug.mark('asset dir loading join', { path, filter });
            return;
        }
        this.spriteDirLoading[key] = true;

        const resolved = this.resolveBundlePath(path);
        const trace = this.nextTrace(`asset dir ${resolved.bundleName}:${resolved.path}`);
        PerfDebug.begin(trace, { path, filter });
        this.loadResolvedSpriteFrameDir(resolved, filter, (frames, bundleName) => {
            if (frames.length > 0) {
                this.spriteDirCache[key] = frames;
            } else {
                delete this.spriteDirCache[key];
            }
            PerfDebug.end(trace, { ok: frames.length > 0, bundle: bundleName, count: frames.length });
            this.finishSpriteDirLoad(key, frames);
        });
    }

    public loadJson(path: string, onLoaded: (asset: JsonAsset | null) => void): void {
        if (Object.prototype.hasOwnProperty.call(this.jsonCache, path)) {
            PerfDebug.mark('asset json cache hit', { path, ok: !!this.jsonCache[path] });
            onLoaded(this.jsonCache[path]);
            return;
        }

        if (!this.jsonCallbacks[path]) {
            this.jsonCallbacks[path] = [];
        }
        this.jsonCallbacks[path].push(onLoaded);
        if (this.jsonLoading[path]) {
            PerfDebug.mark('asset json loading join', { path });
            return;
        }
        this.jsonLoading[path] = true;

        const resolved = this.resolveBundlePath(path);
        const trace = this.nextTrace(`asset json ${resolved.bundleName}:${resolved.path}`);
        PerfDebug.begin(trace, { path });
        this.loadResolvedJson(resolved, (asset, bundleName) => {
            if (asset) {
                this.jsonCache[path] = asset;
            } else {
                delete this.jsonCache[path];
            }
            PerfDebug.end(trace, { ok: !!asset, bundle: bundleName });
            this.finishJsonLoad(path, asset);
        });
    }

    public loadAudio(path: string, onLoaded: (clip: AudioClip | null) => void): void {
        if (Object.prototype.hasOwnProperty.call(this.audioCache, path)) {
            PerfDebug.mark('asset audio cache hit', { path, ok: !!this.audioCache[path] });
            onLoaded(this.audioCache[path]);
            return;
        }

        if (!this.audioCallbacks[path]) {
            this.audioCallbacks[path] = [];
        }
        this.audioCallbacks[path].push(onLoaded);
        if (this.audioLoading[path]) {
            PerfDebug.mark('asset audio loading join', { path });
            return;
        }
        this.audioLoading[path] = true;

        const resolved = this.resolveBundlePath(path);
        const trace = this.nextTrace(`asset audio ${resolved.bundleName}:${resolved.path}`);
        PerfDebug.begin(trace, { path });
        this.loadResolvedAudio(resolved, (clip, bundleName) => {
            if (clip) {
                this.audioCache[path] = clip;
            } else {
                delete this.audioCache[path];
            }
            PerfDebug.end(trace, { ok: !!clip, bundle: bundleName });
            this.finishAudioLoad(path, clip);
        });
    }

    public preloadBundle(bundleName: string, label: string = bundleName): void {
        PerfDebug.mark('bundle preload request', { bundleName, label });
        this.withBundle(bundleName, bundle => {
            PerfDebug.mark('bundle preload ready', { bundleName, label, ok: !!bundle });
        });
    }

    public logCacheStats(label: string): void {
        const activeBundles = Object.keys(this.bundleCache).filter(key => !!this.bundleCache[key]);
        const loading = {
            bundles: Object.keys(this.bundleLoading).filter(key => this.bundleLoading[key]).length,
            sprites: Object.keys(this.spriteLoading).filter(key => this.spriteLoading[key]).length,
            dirs: Object.keys(this.spriteDirLoading).filter(key => this.spriteDirLoading[key]).length,
            json: Object.keys(this.jsonLoading).filter(key => this.jsonLoading[key]).length,
            audio: Object.keys(this.audioLoading).filter(key => this.audioLoading[key]).length,
        };
        PerfDebug.mark(`asset cache ${label}`, {
            sprites: Object.keys(this.spriteCache).length,
            dirs: Object.keys(this.spriteDirCache).length,
            json: Object.keys(this.jsonCache).length,
            audio: Object.keys(this.audioCache).length,
            bundles: activeBundles,
            loading,
        });
    }

    public sortSpriteFrames(frames: SpriteFrame[]): SpriteFrame[] {
        return [...frames].sort((a, b) => {
            const aMatch = a.name.match(/(\d+)(?!.*\d)/);
            const bMatch = b.name.match(/(\d+)(?!.*\d)/);
            const aNum = aMatch ? parseInt(aMatch[1], 10) : Number.MAX_SAFE_INTEGER;
            const bNum = bMatch ? parseInt(bMatch[1], 10) : Number.MAX_SAFE_INTEGER;
            if (aNum !== bNum) return aNum - bNum;
            return a.name.localeCompare(b.name);
        });
    }

    private loadResolvedSpriteFrame(
        resolved: BundlePathResolution,
        filter: TextureFilterMode,
        onLoaded: (frame: SpriteFrame | null, bundleName: string) => void,
    ): void {
        this.attemptBundleLoad(resolved, (bundle, bundleName, tryFallback) => {
            if (!bundle) {
                if (tryFallback()) return;
                onLoaded(null, bundleName);
                return;
            }
            this.loadSpriteFrameUncached(bundle, resolved.path, filter, frame => {
                if (!frame && tryFallback()) return;
                onLoaded(frame, bundleName);
            });
        });
    }

    private loadResolvedSpriteFrameDir(
        resolved: BundlePathResolution,
        filter: TextureFilterMode,
        onLoaded: (frames: SpriteFrame[], bundleName: string) => void,
    ): void {
        this.attemptBundleLoad(resolved, (bundle, bundleName, tryFallback) => {
            if (!bundle) {
                if (tryFallback()) return;
                onLoaded([], bundleName);
                return;
            }
            this.safeLoadDir(bundle, resolved.path, SpriteFrame, (spriteErr, spriteFrames) => {
                if (!spriteErr && spriteFrames && spriteFrames.length > 0) {
                    const frames = this.sortSpriteFrames(spriteFrames.map(frame => this.configureSpriteFrame(frame, filter)!));
                    onLoaded(frames, bundleName);
                    return;
                }

                this.safeLoadDir(bundle, resolved.path, Texture2D, (textureErr, textures) => {
                    if (!textureErr && textures && textures.length > 0) {
                        const frames = this.sortSpriteFrames(textures.map(texture => this.createSpriteFrame(texture, texture.name, filter)));
                        onLoaded(frames, bundleName);
                        return;
                    }

                    this.safeLoadDir(bundle, resolved.path, ImageAsset, (imageErr, images) => {
                        if (!imageErr && images && images.length > 0) {
                            const frames = this.sortSpriteFrames(images.map(image => this.createSpriteFrameFromImage(image, image.name, filter)));
                            onLoaded(frames, bundleName);
                            return;
                        }

                        this.loadSpriteAtlasFrames(bundle, resolved.path, filter, frames => {
                            if (frames.length > 0) {
                                onLoaded(frames, bundleName);
                                return;
                            }
                            if (tryFallback()) return;
                            onLoaded([], bundleName);
                        });
                    });
                });
            });
        });
    }

    private loadSpriteAtlasFrames(
        bundle: AssetManager.Bundle,
        path: string,
        filter: TextureFilterMode,
        onLoaded: (frames: SpriteFrame[]) => void,
    ): void {
        const finish = (atlases: SpriteAtlas[]): void => {
            const frames: SpriteFrame[] = [];
            atlases.forEach(atlas => {
                const atlasFrames = atlas.getSpriteFrames();
                atlasFrames.forEach(frame => {
                    const configured = this.configureSpriteFrame(frame, filter);
                    if (configured) frames.push(configured);
                });
            });
            onLoaded(this.sortSpriteFrames(frames));
        };

        this.safeLoadDir(bundle, path, SpriteAtlas, (dirErr, atlases) => {
            if (!dirErr && atlases && atlases.length > 0) {
                finish(atlases);
                return;
            }

            const dirName = path.substring(path.lastIndexOf('/') + 1);
            this.safeLoadAsset(bundle, `${path}/${dirName}_atlas`, SpriteAtlas, (assetErr, atlas) => {
                if (!assetErr && atlas) {
                    finish([atlas]);
                    return;
                }
                onLoaded([]);
            });
        });
    }

    private loadResolvedJson(
        resolved: BundlePathResolution,
        onLoaded: (asset: JsonAsset | null, bundleName: string) => void,
    ): void {
        this.attemptBundleLoad(resolved, (bundle, bundleName, tryFallback) => {
            if (!bundle) {
                if (tryFallback()) return;
                onLoaded(null, bundleName);
                return;
            }
            this.safeLoadAsset(bundle, resolved.path, JsonAsset, (err, asset) => {
                const result = !err && asset ? asset : null;
                if (!result && tryFallback()) return;
                onLoaded(result, bundleName);
            });
        });
    }

    private loadResolvedAudio(
        resolved: BundlePathResolution,
        onLoaded: (clip: AudioClip | null, bundleName: string) => void,
    ): void {
        this.attemptBundleLoad(resolved, (bundle, bundleName, tryFallback) => {
            if (!bundle) {
                if (tryFallback()) return;
                onLoaded(null, bundleName);
                return;
            }
            this.safeLoadAsset(bundle, resolved.path, AudioClip, (err, clip) => {
                const result = !err && clip ? clip : null;
                if (!result && tryFallback()) return;
                onLoaded(result, bundleName);
            });
        });
    }

    private loadSpriteFrameUncached(bundle: AssetManager.Bundle, path: string, filter: TextureFilterMode, onLoaded: (frame: SpriteFrame | null) => void): void {
        this.safeLoadAsset(bundle, `${path}/spriteFrame`, SpriteFrame, (spriteErr, spriteFrame) => {
            if (!spriteErr && spriteFrame) {
                onLoaded(spriteFrame);
                return;
            }

            this.safeLoadAsset(bundle, `${path}/texture`, Texture2D, (textureErr, texture) => {
                if (!textureErr && texture) {
                    onLoaded(this.createSpriteFrame(texture, path.substring(path.lastIndexOf('/') + 1), filter));
                    return;
                }

                this.safeLoadAsset(bundle, path, SpriteFrame, (directSpriteErr, directSpriteFrame) => {
                    if (!directSpriteErr && directSpriteFrame) {
                        onLoaded(directSpriteFrame);
                        return;
                    }

                    this.safeLoadAsset(bundle, path, Texture2D, (directTextureErr, directTexture) => {
                        if (!directTextureErr && directTexture) {
                            onLoaded(this.createSpriteFrame(directTexture, path.substring(path.lastIndexOf('/') + 1), filter));
                            return;
                        }
                        onLoaded(null);
                    });
                });
            });
        });
    }

    private resolveBundlePath(path: string): BundlePathResolution {
        if (this.isRemoteBundlePath(path)) {
            if (this.shouldUseBootstrap(path)) {
                return { bundleName: BOOTSTRAP_BUNDLE_NAME, path, fallbackBundleName: REMOTE_BUNDLE_NAME };
            }
            return { bundleName: REMOTE_BUNDLE_NAME, path };
        }
        return { bundleName: 'resources', path };
    }

    private isRemoteBundlePath(path: string): boolean {
        return path.startsWith('audio/')
            || path.startsWith('configs/')
            || path.startsWith('images/')
            || path.startsWith('characters/')
            || path.startsWith('guide/')
            || path.startsWith('effects/')
            || path.startsWith('balloon_atlas');
    }

    private shouldUseBootstrap(path: string): boolean {
        return BOOTSTRAP_ASSET_PATHS.has(path) || BOOTSTRAP_DIR_PATHS.has(path);
    }

    private attemptBundleLoad(
        resolved: BundlePathResolution,
        onAttempt: (
            bundle: AssetManager.Bundle | null,
            bundleName: string,
            tryFallback: () => boolean,
        ) => void,
    ): void {
        let fallbackStarted = false;
        const attempt = (bundleName: string): void => {
            this.withBundle(bundleName, bundle => {
                const tryFallback = (): boolean => {
                    if (fallbackStarted || !resolved.fallbackBundleName || bundleName === resolved.fallbackBundleName) {
                        return false;
                    }
                    fallbackStarted = true;
                    attempt(resolved.fallbackBundleName);
                    return true;
                };
                onAttempt(bundle, bundleName, tryFallback);
            });
        };
        attempt(resolved.bundleName);
    }

    private withBundle(bundleName: string, onReady: (bundle: AssetManager.Bundle | null) => void): void {
        const cached = this.getLoadedBundle(bundleName);
        if (cached) {
            this.bundleCache[bundleName] = cached;
            PerfDebug.mark('bundle ready cache hit', { bundleName });
            onReady(cached);
            return;
        }

        if (bundleName === 'resources') {
            console.error('[AssetService] resources bundle is not available');
            onReady(null);
            return;
        }

        if (!this.bundleCallbacks[bundleName]) {
            this.bundleCallbacks[bundleName] = [];
        }
        this.bundleCallbacks[bundleName].push(onReady);
        if (this.bundleLoading[bundleName]) return;

        this.bundleLoading[bundleName] = true;
        const trace = this.nextTrace(`bundle load ${bundleName}`);
        PerfDebug.begin(trace);
        try {
            assetManager.loadBundle(bundleName, (err, bundle) => {
                this.bundleLoading[bundleName] = false;
                const loadedBundle = !err && bundle ? bundle : null;
                if (loadedBundle) {
                    this.bundleCache[bundleName] = loadedBundle;
                } else {
                    delete this.bundleCache[bundleName];
                }
                PerfDebug.end(trace, { ok: !!loadedBundle, loadError: !!err });
                if (err) {
                    console.error(`[AssetService] load ${bundleName} bundle failed`, err);
                } else if (!loadedBundle) {
                    console.error(`[AssetService] load ${bundleName} bundle returned no bundle`);
                }
                const callbacks = this.bundleCallbacks[bundleName] || [];
                this.bundleCallbacks[bundleName] = [];
                callbacks.forEach(callback => callback(loadedBundle));
            });
        } catch (err) {
            this.bundleLoading[bundleName] = false;
            delete this.bundleCache[bundleName];
            PerfDebug.end(trace, { ok: false, threw: true });
            console.error(`[AssetService] load ${bundleName} bundle threw`, err);
            const callbacks = this.bundleCallbacks[bundleName] || [];
            this.bundleCallbacks[bundleName] = [];
            callbacks.forEach(callback => callback(null));
        }
    }

    private getLoadedBundle(bundleName: string): AssetManager.Bundle | null {
        if (bundleName === 'resources') {
            return this.getResourcesBundle();
        }
        return assetManager.getBundle(bundleName) || this.bundleCache[bundleName] || null;
    }

    private getResourcesBundle(): AssetManager.Bundle | null {
        const registered = assetManager.getBundle('resources') || this.bundleCache.resources || null;
        if (registered) return registered;
        return this.isUsableBundle(cocosResources) ? cocosResources : null;
    }

    private isUsableBundle(bundle: AssetManager.Bundle | null | undefined): bundle is AssetManager.Bundle {
        return !!bundle && typeof bundle.load === 'function' && typeof bundle.loadDir === 'function';
    }

    private safeLoadAsset(bundle: AssetManager.Bundle, path: string, type: any, onLoaded: (err: Error | null, asset: any) => void): void {
        try {
            bundle.load(path, type, (err: Error | null, asset: any) => {
                onLoaded(err || null, asset || null);
            });
        } catch (err) {
            console.error(`[AssetService] load asset threw: ${path}`, err);
            onLoaded(err as Error, null);
        }
    }

    private safeLoadDir(bundle: AssetManager.Bundle, path: string, type: any, onLoaded: (err: Error | null, assets: any[]) => void): void {
        try {
            bundle.loadDir(path, type, (err: Error | null, assets: any[]) => {
                onLoaded(err || null, assets || []);
            });
        } catch (err) {
            console.error(`[AssetService] load asset dir threw: ${path}`, err);
            onLoaded(err as Error, []);
        }
    }

    private createSpriteFrame(texture: Texture2D, name: string, filter: TextureFilterMode): SpriteFrame {
        this.configureTexture(texture, filter);
        const frame = new SpriteFrame();
        frame.texture = texture;
        frame.name = name;
        return frame;
    }

    private createSpriteFrameFromImage(image: ImageAsset, name: string, filter: TextureFilterMode): SpriteFrame {
        const texture = new Texture2D();
        texture.image = image;
        return this.createSpriteFrame(texture, name, filter);
    }

    private finishSpriteLoad(key: string, frame: SpriteFrame | null): void {
        this.spriteLoading[key] = false;
        const callbacks = this.spriteCallbacks[key] || [];
        this.spriteCallbacks[key] = [];
        callbacks.forEach(callback => callback(frame));
    }

    private finishSpriteDirLoad(key: string, frames: SpriteFrame[]): void {
        this.spriteDirLoading[key] = false;
        const callbacks = this.spriteDirCallbacks[key] || [];
        this.spriteDirCallbacks[key] = [];
        callbacks.forEach(callback => callback(frames));
    }

    private finishJsonLoad(path: string, asset: JsonAsset | null): void {
        this.jsonLoading[path] = false;
        const callbacks = this.jsonCallbacks[path] || [];
        this.jsonCallbacks[path] = [];
        callbacks.forEach(callback => callback(asset));
    }

    private finishAudioLoad(path: string, clip: AudioClip | null): void {
        this.audioLoading[path] = false;
        const callbacks = this.audioCallbacks[path] || [];
        this.audioCallbacks[path] = [];
        callbacks.forEach(callback => callback(clip));
    }

    private nextTrace(label: string): string {
        this.traceSeq++;
        return `${label} #${this.traceSeq}`;
    }

    private configureSpriteFrame<T extends SpriteFrame | null | undefined>(frame: T, filter: TextureFilterMode): T {
        if (!frame) return frame;
        this.configureTexture(frame.texture as Texture2D | null, filter);
        return frame;
    }

    private configureTexture(texture: Texture2D | null | undefined, filter: TextureFilterMode): void {
        if (!texture) return;
        texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
        texture.setFilters(filter === 'pixel' ? Texture2D.Filter.NEAREST : Texture2D.Filter.LINEAR, filter === 'pixel' ? Texture2D.Filter.NEAREST : Texture2D.Filter.LINEAR);
        texture.setMipFilter(Texture2D.Filter.NONE);
        texture.setAnisotropy(0);
    }
}

export default new AssetService();
