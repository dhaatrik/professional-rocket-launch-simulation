
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Particle, createParticles } from '../src/physics/Particle';
import { ParticleType } from '../src/types/index';

// Mock Canvas Context
const mockCtx = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    createLinearGradient: () => ({ addColorStop: () => { } }),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    setLineDash: vi.fn(),
    scale: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: ''
} as unknown as CanvasRenderingContext2D;

describe('Particle Batching Performance', () => {
    let particles: Particle[] = [];

    beforeEach(() => {
        // Reset pool and create a fresh batch of particles
        // We can't easily reset the private pool, but we can just create new particles
        particles = [];

        // Create 2000 particles with mixed types and lifetimes
        const types: ParticleType[] = ['smoke', 'fire', 'spark', 'debris'];

        for (let i = 0; i < 2000; i++) {
            const type = types[i % 4] as ParticleType;
            const p = Particle.create(0, 0, type, 0, 0);
            // Randomize life to ensure they fall into different buckets
            p.life = Math.random();
            particles.push(p);
        }
    });

    it('should measure execution time of drawParticles', { timeout: 10000 }, () => {
        // Warmup
        for (let i = 0; i < 100; i++) {
            Particle.drawParticles(mockCtx, particles);
        }

        const iterations = 1000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            Particle.drawParticles(mockCtx, particles);
        }

        const end = performance.now();
        const totalTime = end - start;
        const avgTime = totalTime / iterations;

        console.log(`[Baseline] drawParticles: ${avgTime.toFixed(4)} ms/frame for ${particles.length} particles`);

        // Basic sanity check
        expect(mockCtx.fill).toHaveBeenCalled();
    }, 10000); // Increased timeout to 10s
});
