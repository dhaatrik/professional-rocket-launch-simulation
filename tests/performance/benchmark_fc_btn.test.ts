import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Flight Computer Button Query Optimization Benchmark', () => {
    let dom: JSDOM;

    beforeEach(() => {
        dom = new JSDOM(`<!DOCTYPE html><html><body><div id="fc-btn"></div></body></html>`);
        (global as any).document = dom.window.document;
        (global as any).window = dom.window;
    });

    afterEach(() => {
        delete (global as any).document;
        delete (global as any).window;
    });

    it('should measure the speed difference between querying DOM element repeatedly vs caching', () => {
        const ITERATIONS = 10_000;

        // 1. Baseline: Querying DOM repeatedly
        const startOld = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            const fcBtn = document.getElementById('fc-btn');
            if (fcBtn) {
                fcBtn.classList.toggle('enabled', true);
            }
        }
        const timeOld = performance.now() - startOld;

        // 2. Optimized: Caching DOM element
        const fcBtnCached = document.getElementById('fc-btn');
        const startNew = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            if (fcBtnCached) {
                fcBtnCached.classList.toggle('enabled', true);
            }
        }
        const timeNew = performance.now() - startNew;

        const speedup = timeOld / timeNew;

        console.log(`\nBenchmark Results (FC Button Query, ${ITERATIONS} ops):`);
        console.log(`Repeated Query: ${timeOld.toFixed(2)}ms`);
        console.log(`Cached Query: ${timeNew.toFixed(2)}ms`);
        console.log(`Speedup: ${speedup.toFixed(2)}x\n`);

        // Ensure we ran
        expect(timeNew).toBeDefined();
    });
});
