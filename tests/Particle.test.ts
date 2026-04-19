import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Particle, createParticles } from '../src/physics/Particle';
import { MathUtils } from '../src/utils/MathUtils';

describe('Particle Class', () => {
    let mockCtx: CanvasRenderingContext2D;

    beforeEach(() => {
        mockCtx = {
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            arc: vi.fn(),
            rect: vi.fn(),
            fill: vi.fn(),
            fillStyle: '',
            save: vi.fn(),
            restore: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn()
        } as unknown as CanvasRenderingContext2D;

        vi.spyOn(Math, 'random').mockReturnValue(0.5); // Predictable random
        vi.spyOn(MathUtils, 'secureRandom').mockReturnValue(0.5); // Predictable secure random
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Constructor', () => {
        it('should initialize with correct properties', () => {
            const p = new Particle(100, 200, 'smoke', 10, -10);

            expect(p.x).toBe(100);
            expect(p.y).toBe(200);
            expect(p.type).toBe('smoke');
            expect(p.life).toBe(1.0);
            // With Math.random() fixed at 0.5:
            // spread = 2 (smoke)
            // vx = 10 + (0.5 - 0.5) * 4 = 10
            // vy = -10 + (0.5 - 0.5) * 4 = -10
            expect(p.vx).toBe(10);
            expect(p.vy).toBe(-10);

            // size = (15) + (0.5 - 0.5) * 5 = 15
            expect(p.size).toBe(15);
        });

        it('should handle debris specific velocity logic', () => {
            const p = new Particle(0, 0, 'debris');
            // Debris: vx = (0.5 - 0.5) * 20 = 0
            expect(p.vx).toBe(0);
            expect(p.vy).toBe(0);
        });
    });

    describe('Update', () => {
        it('should update position based on velocity', () => {
            const p = new Particle(0, 0, 'smoke', 10, 10);
            // With random=0.5, vx=10, vy=10

            p.update(0, 1.0); // 1 sec

            // x += vx * 1.0
            // but vx is decayed first: vx *= drag^timeScale
            // drag = 1.0 - 0.05 = 0.95
            // vx = 10 * 0.95 = 9.5
            // x = 0 + 9.5 = 9.5
            expect(p.x).toBeCloseTo(9.5);
            expect(p.y).toBeCloseTo(9.5);
        });

        it('should apply drag', () => {
            const p = new Particle(0, 0, 'smoke', 100, 0);
            const initialVx = p.vx;

            p.update(0, 1.0);

            expect(p.vx).toBeLessThan(initialVx);
        });

        it('should decrease life', () => {
            const p = new Particle(0, 0, 'smoke');
            const initialLife = p.life;

            p.update(0, 1.0);

            expect(p.life).toBeLessThan(initialLife);
        });

        it('should grow smoke particles', () => {
            const p = new Particle(0, 0, 'smoke');
            const initialSize = p.size;

            p.update(0, 1.0);

            expect(p.size).toBeGreaterThan(initialSize);
        });

        it('should identify dead particles', () => {
            const p = new Particle(0, 0, 'smoke');
            p.life = 0;
            expect(p.isDead()).toBe(true);

            p.life = -0.1;
            expect(p.isDead()).toBe(true);

            p.life = 0.1;
            expect(p.isDead()).toBe(false);
        });
    });

    describe('Drawing', () => {
        it('should batch render particles', () => {
            const particles = [
                new Particle(0, 0, 'smoke'),
                new Particle(10, 10, 'spark')
            ];

            Particle.drawParticles(mockCtx, particles);

            // Smoke uses arc
            expect(mockCtx.arc).toHaveBeenCalled();
            // Spark uses rect
            expect(mockCtx.rect).toHaveBeenCalled();
        });
    });

    describe('createParticles Helper', () => {
        it('should create multiple particles', () => {
            const particles = createParticles(5, 0, 0, 'fire');
            expect(particles).toHaveLength(5);
            expect(particles[0]!).toBeInstanceOf(Particle);
            expect(particles[0]!.type).toBe('fire');
        });
    });
});
