/**
 * Asset Loader
 *
 * Asynchronous image loader for rocket sprites and visual assets.
 * Handles graceful fallback when assets fail to load.
 */

import { IAssetLoader } from '../types';

interface AssetDefinition {
    key: string;
    src: string;
}

export class AssetLoader implements IAssetLoader {
    /** Loaded image cache */
    private images: Map<string, HTMLImageElement> = new Map();

    /** Asset definitions */
    private readonly assets: AssetDefinition[] = [];

    /**
     * Load all assets asynchronously
     * @returns Promise that resolves when all assets are loaded (or failed gracefully)
     */
    async loadAll(): Promise<void> {
        const loadPromises = this.assets.map((asset) => this.loadImage(asset));
        await Promise.all(loadPromises);
    }

    /**
     * Load a single image asset
     */
    private loadImage(asset: AssetDefinition): Promise<void> {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = asset.src;

            img.onload = () => {
                this.images.set(asset.key, img);
                resolve();
            };

            img.onerror = () => {
                console.warn(`Failed to load asset: ${asset.src}`);
                // Resolve anyway to continue game loading
                resolve();
            };
        });
    }

    /**
     * Get a loaded image by key
     * @param key - Asset key
     * @returns Loaded HTMLImageElement or undefined if not found
     */
    get(key: string): HTMLImageElement | undefined {
        return this.images.get(key);
    }

    /**
     * Check if an asset is loaded
     */
    has(key: string): boolean {
        return this.images.has(key);
    }

    /**
     * Get all loaded asset keys
     */
    getLoadedKeys(): string[] {
        return Array.from(this.images.keys());
    }
}
