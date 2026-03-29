import { describe, it } from 'vitest';
import { ReliabilitySystem, ReliabilityConfig, DEFAULT_RELIABILITY_CONFIG, FailureType } from '../src/physics/Reliability';

describe('ReliabilitySystem activeFailures Set performance', () => {
    it('measures performance of checking activeFailures', () => {
        const config: ReliabilityConfig = {
            ...DEFAULT_RELIABILITY_CONFIG,
            mtbfEngine: 1, // High failure rate
            mtbfElectronics: 1,
            mtbfStructure: 1
        };
        const reliability = new ReliabilitySystem(config);

        const types: FailureType[] = [
            'ENGINE_FLAME_OUT', 'ENGINE_EXPLOSION', 'STRUCTURAL_FATIGUE', 'SENSOR_GLITCH', 'GIMBAL_LOCK'
        ];

        types.forEach(type => reliability.triggerFailure(type));

        // Baseline: Emulate old Array behavior
        const oldArrayFailures: FailureType[] = Array.from(reliability.activeFailures);

        const startBaseline = performance.now();
        const iterations = 10_000_000;

        // Emulate old triggerFailure check behavior (includes)
        let includeCount = 0;
        for (let i = 0; i < iterations; i++) {
            if (oldArrayFailures.includes(types[i % types.length])) {
                includeCount++;
            }
        }
        const endBaseline = performance.now();

        // Emulate optimized triggerFailure check behavior (has on Set)
        const startOptimized = performance.now();
        let hasCount = 0;
        for (let i = 0; i < iterations; i++) {
            if (reliability.activeFailures.has(types[i % types.length])) {
                hasCount++;
            }
        }
        const endOptimized = performance.now();

        console.log(`\nBenchmark Results (activeFailures includes vs Set.has, ${iterations} ops):`);
        console.log(`Array.includes (baseline): ${(endBaseline - startBaseline).toFixed(2)}ms`);
        console.log(`Set.has (optimized): ${(endOptimized - startOptimized).toFixed(2)}ms`);

        const speedup = (endBaseline - startBaseline) / (endOptimized - startOptimized);
        console.log(`Speedup: ${speedup.toFixed(2)}x\n`);
    });
});
