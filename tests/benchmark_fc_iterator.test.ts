import { describe, it, expect } from 'vitest';
import { FlightComputer } from '../src/guidance/FlightComputer';
import type { IVessel } from '../src/types/index';

function createMockVessel(): IVessel {
    return {
        x: 0, y: 0, vx: 0, vy: 0, angle: 0, gimbalAngle: 0,
        mass: 1000, w: 10, h: 40, throttle: 0, fuel: 1000,
        active: true, maxThrust: 100000, crashed: false,
        cd: 0.5, q: 0, apogee: 0, health: 100, orbitPath: null,
        lastOrbitUpdate: 0, aoa: 0, stabilityMargin: 0, isAeroStable: true,
        liftForce: 0, dragForce: 0, skinTemp: 300, heatShieldRemaining: 1,
        isAblating: false, isThermalCritical: false, engineState: 'off',
        ignitersRemaining: 2, ullageSettled: true, actualThrottle: 0,
        applyPhysics: () => { }, spawnExhaust: () => { }, draw: () => { }, explode: () => { }
    } as IVessel;
}

describe('FlightComputer Iterator Optimization Benchmark', () => {
    it('should measure execution time of update loop', () => {
        const fc = new FlightComputer(0);
        // Create a script with many commands to amplify the effect
        let script = '';
        for (let i = 0; i < 100; i++) {
            script += `WHEN ALTITUDE > ${i * 10} THEN PITCH ${i}\n`;
        }
        fc.loadScript(script);
        fc.activate();

        const v = createMockVessel();

        const ITERATIONS = 10000;

        const start = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            fc.update(v, 0.016);
        }
        const end = performance.now();
        const duration = end - start;

        console.log(`[Benchmark] FlightComputer.update took ${duration.toFixed(2)}ms for ${ITERATIONS} iterations with 100 commands`);

        expect(duration).toBeGreaterThan(0);
    });
});
