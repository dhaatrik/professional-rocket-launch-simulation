import { describe, it, expect } from 'vitest';
import { FaultInjector } from '../src/safety/FaultInjector';
import { FAULT_CATALOG } from '../src/safety/FaultInjector';
import { ReliabilitySystem } from '../src/physics/Reliability';
import { performance } from 'perf_hooks';

describe('FaultInjector lookup performance', () => {
    it('should measure the performance of injectFault lookup', () => {
        const injector = new FaultInjector();

        // Arm ALL faults
        for (const fault of FAULT_CATALOG) {
            injector.armFault(fault.id);
        }

        const v = {
            active: true,
            throttle: 1.0,
            fuel: 1000,
            x: 0, y: 0, vx: 0, vy: 0, angle: 0, h: 40, width: 10,
            thrust: 0, dryMass: 100, wetMass: 1000,
            crashed: false
        } as any;
        const reliability = new ReliabilitySystem();

        const ITERATIONS = 1000000;

        const start = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            injector.injectFault('fuel-leak', v, reliability);
            injector.injectFault('non-existent', v, reliability);
        }
        const end = performance.now();

        const totalTime = end - start;
        console.log(`FaultInjector.injectFault() lookup ${ITERATIONS} times: ${totalTime.toFixed(2)}ms`);

        expect(totalTime).toBeGreaterThan(0);
    });
});
