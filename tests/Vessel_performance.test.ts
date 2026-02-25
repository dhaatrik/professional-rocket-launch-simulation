import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Vessel } from '../src/physics/Vessel';
import { setMissionLog, state } from '../src/core/State';
import { AerodynamicState } from '../src/physics/Aerodynamics';

// Concrete class for testing abstract Vessel
class TestVessel extends Vessel {
    constructor(x: number, y: number) {
        super(x, y);
    }
}

describe('Vessel Performance Optimization', () => {
    let vessel: TestVessel;
    const logMock = {
        log: vi.fn(),
        clear: vi.fn(),
    };

    beforeEach(() => {
        vessel = new TestVessel(0, 0);
        setMissionLog(logMock);
        logMock.log.mockClear();
    });

    it('should log instability warning only once per instability event', () => {
        // Setup conditions
        vessel.q = 6000;
        vessel.isAeroStable = false;
        vessel.aoa = 0.5;
        vessel.stabilityMargin = -0.1;

        // Mock aeroState
        vessel.aeroState = {
            aoa: 0.5,
            sideslip: 0,
            cp: 0,
            com: 0,
            stabilityMargin: -0.1,
            isStable: false
        } as AerodynamicState;

        // Simulate 10 frames of instability
        for (let i = 0; i < 10; i++) {
            (vessel as any).checkAerodynamicStress(100, 1000);
        }

        // Optimized behavior: logs only once
        expect(logMock.log).toHaveBeenCalledTimes(1);
    });

    it('should re-enable logging after stabilizing', () => {
        // 1. Initial Instability
        vessel.q = 6000;
        vessel.isAeroStable = false;
        vessel.aoa = 0.5;
        vessel.stabilityMargin = -0.1;
        vessel.aeroState = {
            aoa: 0.5,
            sideslip: 0,
            cp: 0,
            com: 0,
            stabilityMargin: -0.1,
            isStable: false
        } as AerodynamicState;

        (vessel as any).checkAerodynamicStress(100, 1000);
        expect(logMock.log).toHaveBeenCalledTimes(1);

        // 2. Stabilize
        vessel.isAeroStable = true;
        vessel.aeroState = {
            ...vessel.aeroState,
            isStable: true,
            stabilityMargin: 0.1
        };
        (vessel as any).checkAerodynamicStress(100, 1000); // Should reset flag

        // 3. Destabilize again
        vessel.isAeroStable = false;
        vessel.aeroState = {
            ...vessel.aeroState,
            isStable: false,
            stabilityMargin: -0.1
        };
        (vessel as any).checkAerodynamicStress(100, 1000);

        // Should have logged a second time
        expect(logMock.log).toHaveBeenCalledTimes(2);
    });
});
