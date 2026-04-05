import { describe, it, expect } from 'vitest';
import { calculateStats, createBlueprint, addStage, addPartToStage } from '../../src/vab/VehicleBlueprint';
import { ENGINE_MERLIN_1D, TANK_LARGE, TANK_MEDIUM, AVIONICS_BASIC, FAIRING_SMALL } from '../../src/vab/PartsCatalog';
import { performance } from 'perf_hooks';

describe('calculateStats Benchmark', () => {
    it('benchmarks calculateStats performance', () => {
        // Create a massive blueprint for testing
        let blueprint = createBlueprint('Mega Rocket');

        // Add 100 stages, each with 10 parts
        for (let i = 0; i < 100; i++) {
            blueprint = addStage(blueprint);
            blueprint = addPartToStage(blueprint, i, ENGINE_MERLIN_1D);
            blueprint = addPartToStage(blueprint, i, TANK_LARGE);
            blueprint = addPartToStage(blueprint, i, TANK_LARGE);
            blueprint = addPartToStage(blueprint, i, TANK_LARGE);
            blueprint = addPartToStage(blueprint, i, TANK_LARGE);
            blueprint = addPartToStage(blueprint, i, TANK_LARGE);
            blueprint = addPartToStage(blueprint, i, TANK_LARGE);
            blueprint = addPartToStage(blueprint, i, TANK_LARGE);
            blueprint = addPartToStage(blueprint, i, TANK_LARGE);
            blueprint = addPartToStage(blueprint, i, AVIONICS_BASIC);
        }

        const iterations = 1000;

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            calculateStats(blueprint);
        }
        const end = performance.now();

        const duration = end - start;
        console.log(`[Benchmark] calculateStats took ${duration.toFixed(2)}ms for ${iterations} iterations`);
        expect(duration).toBeGreaterThan(0);
    });
});
