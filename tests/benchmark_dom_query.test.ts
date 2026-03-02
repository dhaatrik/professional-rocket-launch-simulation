import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

describe('DOM Query Benchmark', () => {
    it('should measure execution time of getElementById inside and outside loop', () => {
        const dom = new JSDOM('<!DOCTYPE html><html><body><button id="fc-btn">FC</button></body></html>');
        const document = dom.window.document;

        const iterations = 100000;

        // Warmup
        for (let i = 0; i < 1000; i++) {
            const el = document.getElementById('fc-btn');
            if (el) el.classList.toggle('enabled', false);
        }

        // Without Cache
        const startNoCache = performance.now();
        for (let i = 0; i < iterations; i++) {
            const fcBtn = document.getElementById('fc-btn');
            if (fcBtn) {
                fcBtn.classList.toggle('enabled', false);
            }
        }
        const endNoCache = performance.now();
        const noCacheTime = endNoCache - startNoCache;

        // With Cache
        const cachedFcBtn = document.getElementById('fc-btn');
        const startCache = performance.now();
        for (let i = 0; i < iterations; i++) {
            if (cachedFcBtn) {
                cachedFcBtn.classList.toggle('enabled', false);
            }
        }
        const endCache = performance.now();
        const cacheTime = endCache - startCache;

        console.log(`[Baseline] Without cache: ${noCacheTime.toFixed(4)} ms`);
        console.log(`[Optimized] With cache: ${cacheTime.toFixed(4)} ms`);
        console.log(`Speedup: ${(noCacheTime / cacheTime).toFixed(2)}x`);

        expect(cacheTime).toBeLessThan(noCacheTime);
    });
});
