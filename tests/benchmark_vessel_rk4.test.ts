
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Vessel } from '../src/physics/Vessel';
import { EntityType } from '../src/core/PhysicsBuffer';

// Mock dependencies
vi.mock('../src/core/State', () => ({
    state: {
        groundY: 1000,
        missionLog: { log: vi.fn() },
        audio: { playExplosion: vi.fn() }
    },
    currentWindVelocity: { x: 0, y: 0 },
    currentDensityMultiplier: 1.0,
    addParticle: vi.fn()
}));

vi.mock('../src/physics/Particle', () => ({
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

describe('Vessel RK4 Performance Benchmark', () => {
    let vessel: TestVessel;

    beforeEach(() => {
        vi.clearAllMocks();
        vessel = new TestVessel(500, 500); // 500m altitude roughly
    });

    it('benchmarks updatePhysics performance', () => {
        const ITERATIONS = 100000;
        const dt = 0.016; // 60 FPS

        // Warmup
        for (let i = 0; i < 1000; i++) {
            vessel.runUpdatePhysics(dt);
        }

        const start = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            vessel.runUpdatePhysics(dt);
        }
        const end = performance.now();
        const duration = end - start;

        console.log(`Vessel.updatePhysics x ${ITERATIONS}: ${duration.toFixed(2)}ms`);
        console.log(`Average per call: ${(duration / ITERATIONS).toFixed(4)}ms`);

        // Ensure it ran
        expect(duration).toBeGreaterThan(0);
    });
});
