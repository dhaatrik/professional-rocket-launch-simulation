import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Vessel } from '../../src/physics/Vessel';
import { state } from '../../src/core/State';
import * as ThermalProtection from '../../src/physics/ThermalProtection';
import { Particle } from '../../src/physics/Particle';

// Concrete implementation for abstract Vessel class
class TestVessel extends Vessel {
    constructor(x: number, y: number) {
        super(x, y);
    }
    draw(ctx: CanvasRenderingContext2D, camY: number, alpha: number): void {}
}

// Mock ThermalProtection module
vi.mock('../../src/physics/ThermalProtection', async (importOriginal) => {
    const actual = await importOriginal<typeof ThermalProtection>();
    return {
        ...actual,
        updateThermalState: vi.fn(),
        getThermalDamageRate: vi.fn(),
        // Keep createInitialThermalState functional as it's used in constructor
        createInitialThermalState: vi.fn(() => ({
            skinTemp: 293,
            heatShieldRemaining: 1.0,
            heatFlux: 0,
            netHeatingRate: 0,
            isAblating: false,
            isCritical: false,
            thermalDamage: 0
        })),
    };
});

// Mock Particle class static methods
vi.mock('../../src/physics/Particle', () => {
    return {
        Particle: {
            create: vi.fn(() => ({})), // Return dummy object
            release: vi.fn()
        }
    };
});

describe('Vessel Thermal Integration', () => {
    let vessel: TestVessel;
    let mockMissionLog: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup State mocks
        mockMissionLog = { log: vi.fn() };
        state.missionLog = mockMissionLog;
        state.missionTime = 100;
        state.groundY = 0; // Ensure we are above ground so altitude is positive
        state.audio = null; // Ensure no audio calls unless mocked

        // Create vessel instance
        vessel = new TestVessel(0, 1000); // y=1000, groundY=0 -> altitude is negative? Wait.
        // Vessel uses: altitude = (state.groundY - s.y * PIXELS_PER_METER - this.h) / PIXELS_PER_METER;
        // Let's adjust state.groundY or vessel.y.
        // If groundY=2000, vessel.y=1000 -> altitude > 0.
        state.groundY = 2000;

        // Default mock implementation for updateThermalState
        vi.mocked(ThermalProtection.updateThermalState).mockReturnValue({
            skinTemp: 300,
            heatShieldRemaining: 1.0,
            heatFlux: 0,
            netHeatingRate: 0,
            isAblating: false,
            isCritical: false,
            thermalDamage: 0
        });

        // Default mock implementation for getThermalDamageRate
        vi.mocked(ThermalProtection.getThermalDamageRate).mockReturnValue(0);
    });

    it('should initialize with default thermal state', () => {
        expect(vessel.thermalState).toBeDefined();
        expect(vessel.skinTemp).toBe(293);
        expect(ThermalProtection.createInitialThermalState).toHaveBeenCalled();
    });

    it('should update thermal state during physics update', () => {
        const dt = 0.1;
        vessel.vy = -100; // Moving up

        // We need to call updatePhysics. It's protected, so cast to any.
        (vessel as any).updatePhysics(dt);

        expect(ThermalProtection.updateThermalState).toHaveBeenCalled();

        // specific args check: config, current state, velocity, altitude, aoa, dt
        const args = vi.mocked(ThermalProtection.updateThermalState).mock.calls[0];
        expect(args[0]).toBe(vessel.tpsConfig);
        // args[1] is previous state
        expect(args[5]).toBe(dt);

        // Check if vessel properties were updated from the mocked return
        expect(vessel.skinTemp).toBe(300);
    });

    it('should apply thermal damage to health', () => {
        const dt = 0.1;
        const damageRate = 10;
        vi.mocked(ThermalProtection.getThermalDamageRate).mockReturnValue(damageRate);

        const initialHealth = vessel.health;

        (vessel as any).updatePhysics(dt);

        // Expected health = initial - damageRate * dt
        expect(vessel.health).toBeCloseTo(initialHealth - damageRate * dt);

        // Verify getThermalDamageRate was called with updated state
        expect(ThermalProtection.getThermalDamageRate).toHaveBeenCalled();
    });

    it('should log thermal warning when critical', () => {
        // Setup critical state return
        vi.mocked(ThermalProtection.updateThermalState).mockReturnValue({
            skinTemp: 2000,
            heatShieldRemaining: 0.5,
            heatFlux: 1000,
            netHeatingRate: 100,
            isAblating: true,
            isCritical: true, // Trigger warning condition
            thermalDamage: 10
        });

        // Logging only happens if damage is being taken
        vi.mocked(ThermalProtection.getThermalDamageRate).mockReturnValue(1);

        // Ensure enough time has passed since last log (default is 0)
        // Vessel.ts: if (state.missionTime - this.lastThermalLogTime > 2.0)
        // We set state.missionTime = 100 in beforeEach.
        // lastThermalLogTime is undefined/0 initially?
        // Let's verify initial state of lastThermalLogTime. It's likely undefined on the instance, so effectively 0 or NaN.
        // Safest is to set it explicitly if needed, but default 0 works against 100.

        (vessel as any).updatePhysics(0.1);

        expect(vessel.isThermalCritical).toBe(true);
        expect(state.missionLog.log).toHaveBeenCalledWith(
            expect.stringContaining('THERMAL WARNING'),
            'warn'
        );

        // Verify throttle: call again immediately
        state.missionLog.log.mockClear();
        (vessel as any).updatePhysics(0.1);
        expect(state.missionLog.log).not.toHaveBeenCalled();

        // Advance time and call again
        state.missionTime += 3.0;
        (vessel as any).updatePhysics(0.1);
        expect(state.missionLog.log).toHaveBeenCalled();
    });

    it('should explode on structural failure due to thermal overload', () => {
        vessel.health = 0.1; // Near death
        vi.mocked(ThermalProtection.getThermalDamageRate).mockReturnValue(100); // Kill it this frame

        // Return state with high thermal damage > 50
        vi.mocked(ThermalProtection.updateThermalState).mockReturnValue({
            skinTemp: 3000,
            heatShieldRemaining: 0,
            heatFlux: 5000,
            netHeatingRate: 500,
            isAblating: false,
            isCritical: true,
            thermalDamage: 60 // > 50 triggers check
        });

        const explodeSpy = vi.spyOn(vessel, 'explode');

        (vessel as any).updatePhysics(0.1);

        expect(vessel.health).toBeLessThanOrEqual(0);
        expect(explodeSpy).toHaveBeenCalled();
        expect(state.missionLog.log).toHaveBeenCalledWith(
            'STRUCTURAL FAILURE: THERMAL OVERLOAD',
            'warn'
        );
        expect(vessel.crashed).toBe(true);
    });
});
