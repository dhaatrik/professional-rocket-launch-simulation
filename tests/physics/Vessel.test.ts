import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Vessel } from '../../src/physics/Vessel';
import { state } from '../../src/core/State';
import * as ThermalProtection from '../../src/physics/ThermalProtection';
import { Particle } from '../../src/physics/Particle';
import { EngineStateCode } from '../../src/core/PhysicsBuffer';

// Concrete implementation for abstract Vessel class
class TestVessel extends Vessel {
    constructor(x: number, y: number) {
        super(x, y);
    }
    draw(ctx: CanvasRenderingContext2D, camY: number, alpha: number): void { }
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
        const args = vi.mocked(ThermalProtection.updateThermalState).mock.calls[0]!;
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
        expect(state.missionLog!.log).toHaveBeenCalledWith(
            expect.stringContaining('THERMAL WARNING'),
            'warn'
        );

        // Verify throttle: call again immediately
        mockMissionLog.log.mockClear();
        (vessel as any).updatePhysics(0.1);
        expect(state.missionLog!.log).not.toHaveBeenCalled();

        // Advance time and call again
        state.missionTime += 3.0;
        (vessel as any).updatePhysics(0.1);
        expect(state.missionLog!.log).toHaveBeenCalled();
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
        expect(state.missionLog!.log).toHaveBeenCalledWith(
            'STRUCTURAL FAILURE: THERMAL OVERLOAD',
            'warn'
        );
        expect(vessel.crashed).toBe(true);
    });
});

describe('Vessel Ground Collision Validation', () => {
    let vessel: TestVessel;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup State mocks
        state.missionLog = { log: vi.fn() } as any;
        state.groundY = 1000;
        state.audio = null;

        // Create vessel instance
        vessel = new TestVessel(0, 0); // Start at y=0, above groundY=1000
    });

    it('should not collide if vessel is above ground', () => {
        vessel.y = 500; // y + h (500 + 100) = 600, which is < 1000 (groundY)
        vessel.vy = 10;
        vessel.throttle = 1;

        const explodeSpy = vi.spyOn(vessel, 'explode');

        // Test checkGroundCollision directly to isolate from updatePhysics RK4 gravity modifications
        (vessel as any).checkGroundCollision();

        expect(explodeSpy).not.toHaveBeenCalled();
        expect(vessel.y).toBe(500);
        expect(vessel.vy).toBe(10);
        expect(vessel.throttle).toBe(1);
    });

    it('should land successfully at low velocity and safe angle', () => {
        vessel.y = 950; // y + h (950 + 100) = 1050, which is > 1000 (groundY)
        vessel.vy = 10; // Safe velocity (<= 15)
        vessel.vx = 5;
        vessel.angle = 0.1; // Safe angle (<= 0.3)
        vessel.engineState = EngineStateCode.OFF;
        vessel.throttle = 1; // Should be cut to 0

        const explodeSpy = vi.spyOn(vessel, 'explode');

        (vessel as any).checkGroundCollision();

        expect(explodeSpy).not.toHaveBeenCalled();
        expect(vessel.y).toBe(state.groundY - vessel.h); // Snapped to ground
        expect(vessel.vy).toBe(0);
        expect(vessel.vx).toBe(0);
        expect(vessel.throttle).toBe(0); // Throttle is cut
    });

    it('should explode if landing velocity is too high', () => {
        vessel.y = 950; // y + h > groundY
        vessel.vy = 20; // Unsafe velocity (> 15)
        vessel.angle = 0;

        const explodeSpy = vi.spyOn(vessel, 'explode');

        (vessel as any).checkGroundCollision();

        expect(explodeSpy).toHaveBeenCalled();
        expect(vessel.y).toBe(state.groundY - vessel.h);
    });

    it('should explode if landing angle is too high', () => {
        vessel.y = 950; // y + h > groundY
        vessel.vy = 5; // Safe velocity
        vessel.angle = 0.5; // Unsafe angle (> 0.3)

        const explodeSpy = vi.spyOn(vessel, 'explode');

        (vessel as any).checkGroundCollision();

        expect(explodeSpy).toHaveBeenCalled();
        expect(vessel.y).toBe(state.groundY - vessel.h);
    });

    it('should land successfully but not cut throttle if engine is starting or running', () => {
        vessel.y = 950; // y + h > groundY
        vessel.vy = 5; // Safe velocity
        vessel.angle = 0; // Safe angle
        vessel.throttle = 0.8;
        vessel.engineState = EngineStateCode.RUNNING;

        const explodeSpy = vi.spyOn(vessel, 'explode');

        (vessel as any).checkGroundCollision();

        expect(explodeSpy).not.toHaveBeenCalled();
        expect(vessel.y).toBe(state.groundY - vessel.h);
        expect(vessel.vy).toBe(0);
        expect(vessel.vx).toBe(0);
        expect(vessel.throttle).toBe(0.8); // Throttle is NOT cut
    });
});
