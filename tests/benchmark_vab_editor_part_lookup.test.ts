import { describe, it } from 'vitest';
import { PARTS_CATALOG } from '../src/vab/PartsCatalog';

describe('VABEditor Part Lookup Benchmark', () => {
    it('benchmarks array find vs object lookup', () => {
        const ITERATIONS = 1000000;
        const partToFind = PARTS_CATALOG[PARTS_CATALOG.length - 1].id;

        // Baseline: Array.prototype.find
        const startBaseline = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            const part = PARTS_CATALOG.find(p => p.id === partToFind);
            if (!part) throw new Error('Part not found');
        }
        const endBaseline = performance.now();
        const timeBaseline = endBaseline - startBaseline;

        // Setup optimization: Map lookup
        const partMap = new Map(PARTS_CATALOG.map(p => [p.id, p]));

        // Optimized: Map.prototype.get
        const startOptimized = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            const part = partMap.get(partToFind);
            if (!part) throw new Error('Part not found');
        }
        const endOptimized = performance.now();
        const timeOptimized = endOptimized - startOptimized;

        console.log(`Array find(): ${timeBaseline.toFixed(2)}ms`);
        console.log(`Map get(): ${timeOptimized.toFixed(2)}ms`);
        console.log(`Speedup: ${(timeBaseline / timeOptimized).toFixed(2)}x`);
    });
});
