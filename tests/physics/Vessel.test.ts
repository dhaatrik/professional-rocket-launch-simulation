
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Vessel } from '../../src/physics/Vessel';

// Mock dependencies
vi.mock('../../src/core/State', () => ({
    state: {
        groundY: 1000,
        missionLog: { log: vi.fn() },
        audio: { playExplosion: vi.fn() }
    },
    currentWindVelocity: { x: 0, y: 0 },
    currentDensityMultiplier: 1.0,
    addParticle: vi.fn()
}));

vi.mock('../../src/physics/Particle', () => ({
    Particle: {
        create: vi.fn()
    }
}));

// Subclass to access protected method
class TestVessel extends Vessel {
    constructor(x: number, y: number) {
        super(x, y);
        this.mass = 1000;
        this.fuel = 1000;
    }

    public runUpdatePhysics(dt: number) {
        this.updatePhysics(dt);
    }
}

describe('Vessel Physics', () => {
    let vessel: TestVessel;

    beforeEach(() => {
        vi.clearAllMocks();
        // 500m altitude roughly (assuming groundY=1000 and PIXELS_PER_METER=10)
        // altitude = (1000 - 500 - 100) / 10 = 40m.
        vessel = new TestVessel(500, 500);
    });

    it('should update position based on velocity', () => {
        vessel.vx = 10;
        vessel.vy = 0;

        const initialX = vessel.x;

        // Run update for 1 second
        vessel.runUpdatePhysics(1.0);

        // Should move horizontally
        expect(vessel.x).not.toBe(initialX);
        expect(vessel.x).toBeGreaterThan(initialX);
    });

    it('should apply drag forces', () => {
        // High velocity to generate significant drag
        vessel.vx = 200;
        vessel.vy = 0;

        const initialVx = vessel.vx;

        // Run update for small step
        vessel.runUpdatePhysics(0.1);

        // Drag should slow it down (vx decreases)
        expect(vessel.vx).toBeLessThan(initialVx);
    });

    it('should apply gravity', () => {
        vessel.vx = 0;
        vessel.vy = 0;

        const initialVy = vessel.vy;

        // Run update
        vessel.runUpdatePhysics(0.1);

        // Gravity pulls down (positive vy in this coordinate system where Y increases downwards)
        expect(vessel.vy).toBeGreaterThan(initialVy);
    });
});
