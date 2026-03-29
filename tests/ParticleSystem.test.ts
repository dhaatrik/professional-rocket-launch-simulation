import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ParticleSystem } from '../src/physics/ParticleSystem';
import { IVessel } from '../src/types';
import { state, addParticle } from '../src/core/State';
import { Particle } from '../src/physics/Particle';
import { PIXELS_PER_METER } from '../src/config/Constants';
import { MathUtils } from '../src/utils/MathUtils';

// Mock State module
vi.mock('../src/core/State', () => ({
    state: {
        groundY: 1000
    },
    addParticle: vi.fn()
}));

// Mock Particle class
vi.mock('../src/physics/Particle', () => {
    const MockParticle = vi.fn().mockImplementation(function (this: any, x, y, type, vx, vy) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.vx = vx;
        this.vy = vy;
        this.size = 5;
        this.decay = 0.1;
    });

    // Add static create method
    (MockParticle as any).create = vi.fn().mockImplementation((x, y, type, vx, vy) => {
        return new MockParticle(x, y, type, vx, vy);
    });

    return {
        Particle: MockParticle
    };
});

describe('ParticleSystem', () => {
    let mockVessel: IVessel;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock vessel
        mockVessel = {
            x: 500,
            y: 500,
            vx: 0,
            vy: -10, // Moving up
            angle: 0, // Upright
            h: 100,
            w: 40,
            throttle: 1.0,
            fuel: 1.0,
            crashed: false,
            // ... other props not needed for spawnExhaust
        } as unknown as IVessel;

        // Reset MathUtils.secureRandom spy
        vi.spyOn(MathUtils, 'secureRandom').mockReturnValue(0.5);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should spawn exhaust particles when active', () => {
        // Random 0.5 -> smoke check: 0.5 > 0.5 is false. No smoke.
        vi.spyOn(MathUtils, 'secureRandom').mockReturnValue(0.4);
        ParticleSystem.spawnExhaust(mockVessel, 1.0);

        // Expected count: ceil(throttle * 5 * timeScale) = ceil(1.0 * 5 * 1.0) = 5
        expect(addParticle).toHaveBeenCalledTimes(5);
        expect(Particle.create).toHaveBeenCalledTimes(5);
    });

    it('should not spawn particles if throttle is 0', () => {
        mockVessel.throttle = 0;
        ParticleSystem.spawnExhaust(mockVessel, 1.0);
        expect(addParticle).not.toHaveBeenCalled();
    });

    it('should not spawn particles if fuel is 0', () => {
        mockVessel.fuel = 0;
        ParticleSystem.spawnExhaust(mockVessel, 1.0);
        expect(addParticle).not.toHaveBeenCalled();
    });

    it('should not spawn particles if crashed', () => {
        mockVessel.crashed = true;
        ParticleSystem.spawnExhaust(mockVessel, 1.0);
        expect(addParticle).not.toHaveBeenCalled();
    });

    it('should clamp particle count at max', () => {
        vi.spyOn(MathUtils, 'secureRandom').mockReturnValue(0.4); // No smoke
        mockVessel.throttle = 10.0; // Artificial high throttle -> 50 particles
        // Max is 20
        ParticleSystem.spawnExhaust(mockVessel, 1.0);

        expect(addParticle).toHaveBeenCalledTimes(20);
        expect(Particle.create).toHaveBeenCalledTimes(20);
    });

    it('should add smoke particles at low altitude', () => {
        // Mock random to trigger smoke (random > 0.5)
        vi.spyOn(MathUtils, 'secureRandom').mockReturnValue(0.6);

        // Low altitude (already 500px, ground 1000px, so 500px altitude = 50m)
        // Vacuum factor will be low
        ParticleSystem.spawnExhaust(mockVessel, 1.0);

        // Should spawn 5 fire particles + 5 smoke particles = 10
        expect(addParticle).toHaveBeenCalledTimes(10);
        expect(Particle.create).toHaveBeenCalledTimes(10);
    });
});
