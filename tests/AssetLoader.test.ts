import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssetLoader } from '../src/utils/AssetLoader';

describe('AssetLoader', () => {
    let loader: AssetLoader;
    let originalImage: typeof Image;

    beforeEach(() => {
        loader = new AssetLoader();
        originalImage = global.Image;
    });

    afterEach(() => {
        global.Image = originalImage;
        vi.restoreAllMocks();
    });

    it('should initialize successfully', () => {
        expect(loader).toBeInstanceOf(AssetLoader);
        expect(loader.getLoadedKeys()).toEqual([]);
        expect(loader.has('nonexistent')).toBe(false);
        expect(loader.get('nonexistent')).toBeUndefined();
    });

    it('should resolve loadAll immediately if there are no assets', async () => {
        await expect(loader.loadAll()).resolves.toBeUndefined();
    });

    it('should successfully load an image and store it in cache', async () => {
        const mockImages: any[] = [];
        global.Image = class {
            onload: any;
            onerror: any;
            src: string = '';
            constructor() {
                mockImages.push(this);
            }
        } as any;

        // Add dummy asset
        (loader as any).assets.push({ key: 'testKey', src: 'test.png' });

        const loadPromise = loader.loadAll();

        // Check that an image was created
        expect(mockImages.length).toBe(1);

        // Simulate successful load
        mockImages[0].onload();

        await loadPromise;

        expect(loader.has('testKey')).toBe(true);
        expect(loader.get('testKey')).toBe(mockImages[0]);
        expect(loader.getLoadedKeys()).toContain('testKey');
    });

    it('should gracefully handle image load failure and log a warning', async () => {
        const mockImages: any[] = [];
        global.Image = class {
            onload: any;
            onerror: any;
            src: string = '';
            constructor() {
                mockImages.push(this);
            }
        } as any;

        const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        (loader as any).assets.push({ key: 'failKey', src: 'fail.png' });

        const loadPromise = loader.loadAll();

        expect(mockImages.length).toBe(1);

        // Simulate failed load
        mockImages[0].onerror();

        await loadPromise;

        // The image shouldn't be in the cache
        expect(loader.has('failKey')).toBe(false);
        expect(loader.get('failKey')).toBeUndefined();
        expect(loader.getLoadedKeys()).not.toContain('failKey');

        // It should have logged a warning
        expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to load asset: fail.png');
    });
});
