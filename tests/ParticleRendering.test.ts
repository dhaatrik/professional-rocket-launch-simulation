
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Particle } from '../src/physics/Particle';
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

describe('Particle Rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should batch particles of same type and life', () => {
        const p1 = Particle.create(10, 10, 'smoke', 0, 0);
        p1.life = 0.5; // Same life bucket
        const p2 = Particle.create(20, 20, 'smoke', 0, 0);
        p2.life = 0.5; // Same life bucket

        const particles = [p1, p2];
        Particle.drawParticles(mockCtx, particles);

        // Expect 1 batch -> 1 fill call
        expect(mockCtx.fill).toHaveBeenCalledTimes(1);
        expect(mockCtx.beginPath).toHaveBeenCalledTimes(1);

        // Smoke uses arc
        expect(mockCtx.arc).toHaveBeenCalledTimes(2);
    });

    it('should separate particles of different types', () => {
        const p1 = Particle.create(10, 10, 'smoke', 0, 0);
        p1.life = 0.5;
        const p2 = Particle.create(20, 20, 'fire', 0, 0);
        p2.life = 0.5;

        const particles = [p1, p2];
        Particle.drawParticles(mockCtx, particles);

        // Expect 2 batches -> 2 fill calls
        expect(mockCtx.fill).toHaveBeenCalledTimes(2);
    });

    it('should separate particles of same type but different life buckets', () => {
        const p1 = Particle.create(10, 10, 'smoke', 0, 0);
        p1.life = 0.1; // Bucket ~2
        const p2 = Particle.create(20, 20, 'smoke', 0, 0);
        p2.life = 0.9; // Bucket ~18

        const particles = [p1, p2];
        Particle.drawParticles(mockCtx, particles);

        // Expect 2 batches -> 2 fill calls
        expect(mockCtx.fill).toHaveBeenCalledTimes(2);
    });

    it('should apply correct fillStyle for smoke', () => {
        const p1 = Particle.create(10, 10, 'smoke', 0, 0);
        p1.life = 0.5; // quantization index 10. life for calc = 10.5/20 = 0.525
        // smoke: color=200, alpha=0.5. Result alpha = 0.5 * 0.525 = 0.2625

        const particles = [p1];
        Particle.drawParticles(mockCtx, particles);

        // We can't easily check exact string match due to quantization, but we can check format
        expect(mockCtx.fillStyle).toMatch(/rgba\(200,200,200,0\.26\d+\)/);
    });

    it('should use rect for sparks and debris', () => {
        const p1 = Particle.create(10, 10, 'spark', 0, 0);
        p1.life = 0.5;

        const particles = [p1];
        Particle.drawParticles(mockCtx, particles);

        expect(mockCtx.rect).toHaveBeenCalledTimes(1);
        expect(mockCtx.arc).not.toHaveBeenCalled();
    });
});
