import { describe, it, expect } from 'vitest';
import { Vessel } from '../src/physics/Vessel';
import { FullStack, UpperStage, Booster, Payload, Fairing } from '../src/physics/RocketComponents';
import { EntityType } from '../src/core/PhysicsBuffer';

describe('Performance Benchmark: Type Check vs instanceof (Mixed Array)', () => {
    it('should measure the speed difference between type property access and instanceof', () => {
        const count = 1000;
        const iterations = 10_000;

        // Create a mixed array of entities
        const entities: Vessel[] = [];
        for (let i = 0; i < count; i++) {
            const r = Math.random();
            if (r < 0.2) entities.push(new FullStack(0, 0));
            else if (r < 0.4) entities.push(new UpperStage(0, 0));
            else if (r < 0.6) entities.push(new Booster(0, 0));
            else if (r < 0.8) entities.push(new Payload(0, 0));
            else entities.push(new Fairing(0, 0, 0, 0, 1));
        }

        // Measure instanceof
        const startInstanceof = performance.now();
        let countInstanceof = 0;
        for (let j = 0; j < iterations; j++) {
            for (let i = 0; i < count; i++) {
                const e = entities[i];
                if (e instanceof FullStack) countInstanceof++;
                else if (e instanceof UpperStage) countInstanceof++;
                else if (e instanceof Booster) countInstanceof++;
                else if (e instanceof Payload) countInstanceof++;
                else if (e instanceof Fairing) countInstanceof++;
            }
        }
        const endInstanceof = performance.now();
        const timeInstanceof = endInstanceof - startInstanceof;

        // Measure type property access
        const startType = performance.now();
        let countType = 0;
        for (let j = 0; j < iterations; j++) {
            for (let i = 0; i < count; i++) {
                const e = entities[i];
                const t = e.type;
                if (t === EntityType.FULLSTACK) countType++;
                else if (t === EntityType.UPPER_STAGE) countType++;
                else if (t === EntityType.BOOSTER) countType++;
                else if (t === EntityType.PAYLOAD) countType++;
                else if (t === EntityType.FAIRING) countType++;
            }
        }
        const endType = performance.now();
        const timeType = endType - startType;

        console.log(`\nBenchmark Results (Mixed Array, ${iterations} x ${count} ops):`);
        console.log(`instanceof chain: ${timeInstanceof.toFixed(2)}ms`);
        console.log(`type property switch: ${timeType.toFixed(2)}ms`);
        console.log(`Speedup: ${(timeInstanceof / timeType).toFixed(2)}x\n`);
    });
});
