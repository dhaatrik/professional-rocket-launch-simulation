
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Vessel } from '../src/physics/Vessel';
import { state } from '../src/core/State';
import { IMissionLog } from '../src/types';

// Mock State module to control missionLog and simulate time
vi.mock('../src/core/State', async () => {
    const original = await vi.importActual('../src/core/State');
    return {
        ...original,
        state: {
            groundY: 1000,
            missionLog: null,
            missionTime: 0,
            audio: {
                playExplosion: vi.fn(),
                playStaging: vi.fn(),
                setThrust: vi.fn()
            }
        },
        addParticle: vi.fn(),
        currentWindVelocity: { x: 0, y: 0 },
        currentDensityMultiplier: 1.0
    };
});

// Mock ThermalProtection to force critical state
vi.mock('../src/physics/ThermalProtection', async () => {
    const original = await vi.importActual('../src/physics/ThermalProtection');
    return {
        ...original,
        updateThermalState: vi.fn().mockImplementation((config, currentState, velocity, altitude, aoa, dt) => {
            // Fluctuate temp slightly to defeat duplicate message check
            const temp = 2000 + Math.random();
            return {
                skinTemp: temp,
                heatShieldRemaining: 0.5,
                heatFlux: 10000,
                netHeatingRate: 1000,
                isAblating: true,
                isCritical: true, // Force critical
                thermalDamage: 10
            };
        }),
        getThermalDamageRate: vi.fn().mockReturnValue(10) // Force damage to trigger logging block
    };
});

// Mock Particle to avoid canvas issues
vi.mock('../src/physics/Particle', () => {
    const MockParticle = vi.fn().mockImplementation(function (this: any, x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
    });
    (MockParticle as any).create = vi.fn().mockImplementation((x, y, type) => new MockParticle(x, y, type));
    (MockParticle as any).release = vi.fn();
    return { Particle: MockParticle };
});

describe('Vessel Thermal Logging Benchmark', () => {
    let vessel: Vessel;
    let mockLog: IMissionLog;

    beforeEach(() => {
        vi.clearAllMocks();

        // Reset missionTime
        state.missionTime = 0;

        // Setup mock log
        mockLog = {
            log: vi.fn(),
            clear: vi.fn()
        };
        state.missionLog = mockLog;

        // Create vessel
        vessel = new Vessel(500, 500);
        vessel.active = true;
    });

    it('should throttle thermal warning logging', () => {
        const dt = 1/60;
        // Run for 60 frames = 1 second
        for (let i = 0; i < 60; i++) {
            vessel.applyPhysics(dt, {});
            state.missionTime += dt;
        }

        // Should log only once (initially)
        expect(mockLog.log).toHaveBeenCalledTimes(1);

        // Run for another 2 seconds (120 frames)
        for (let i = 0; i < 120; i++) {
            // Heal vessel to prevent structural failure log
            vessel.health = 100;
            vessel.applyPhysics(dt, {});
            state.missionTime += dt;
        }

        // We expect it to log once initially, then again after 2 seconds.
        // It's possible that setting health to 100 doesn't perfectly prevent the
        // structural failure from triggering later if other things occur, or
        // if another error log triggers. But thermal warning should trigger exactly
        // one more time.

        // Count just the thermal warnings
        const thermalWarnings = mockLog.log.mock.calls.filter(call => call[0].includes('THERMAL WARNING'));
        expect(thermalWarnings.length).toBe(2);
    });
});
