import { ReliabilitySystem, DEFAULT_RELIABILITY_CONFIG } from '../src/physics/Reliability';
import { vi, describe, it, expect } from 'vitest';

describe('Reliability activeFailures Benchmark', () => {
    it('benchmark activeFailures update (optimized)', () => {
        const reliability = new ReliabilitySystem();

        // Add a few failures
        reliability.triggerFailure('ENGINE_FLAME_OUT');
        reliability.triggerFailure('SENSOR_GLITCH');
        reliability.triggerFailure('STRUCTURAL_FATIGUE');

        const N = 1000000;

        // We will mock Math.random to not trigger new failures
        vi.spyOn(Math, 'random').mockReturnValue(1.0);

        const start = performance.now();
        for (let i = 0; i < N; i++) {
            reliability.update(0.01, 1.0);

            // Re-add SENSOR_GLITCH so it can be updated and deleted over and over
            if (i % 100 === 0) {
                 reliability.triggerFailure('SENSOR_GLITCH');
            }
        }

        const end = performance.now();
        console.log(`[Benchmark] Optimized activeFailures update took ${(end - start).toFixed(2)}ms for ${N} iterations`);
        expect(end - start).toBeGreaterThan(0);
    }, 10000);
});
