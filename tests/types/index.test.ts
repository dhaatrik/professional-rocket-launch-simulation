import { describe, it, expect } from 'vitest';
import { vec2, Vec2 } from '../../src/types/index.ts';

describe('src/types/index.ts Vector Operations', () => {
    describe('vec2()', () => {
        it('should create a new Vector2D object', () => {
            const v = vec2(3, 4);
            expect(v).toEqual({ x: 3, y: 4 });
        });
    });

    describe('Vec2 object', () => {
        it('should correctly add two vectors', () => {
            const a = vec2(1, 2);
            const b = vec2(3, 4);
            expect(Vec2.add(a, b)).toEqual({ x: 4, y: 6 });
        });

        it('should correctly subtract two vectors', () => {
            const a = vec2(5, 7);
            const b = vec2(2, 3);
            expect(Vec2.sub(a, b)).toEqual({ x: 3, y: 4 });
        });

        it('should correctly scale a vector', () => {
            const v = vec2(2, 3);
            expect(Vec2.scale(v, 2)).toEqual({ x: 4, y: 6 });
        });

        it('should correctly calculate the magnitude of a vector', () => {
            const v = vec2(3, 4);
            expect(Vec2.magnitude(v)).toBe(5);

            const v2 = vec2(-3, -4);
            expect(Vec2.magnitude(v2)).toBe(5);
        });

        it('should correctly normalize a vector', () => {
            const v = vec2(3, 4);
            const normalized = Vec2.normalize(v);
            expect(normalized.x).toBeCloseTo(0.6);
            expect(normalized.y).toBeCloseTo(0.8);
            expect(Vec2.magnitude(normalized)).toBeCloseTo(1);
        });

        it('should return a zero vector when normalizing a zero vector', () => {
            const v = vec2(0, 0);
            expect(Vec2.normalize(v)).toEqual({ x: 0, y: 0 });
        });

        it('should correctly calculate the dot product of two vectors', () => {
            const a = vec2(1, 2);
            const b = vec2(3, 4);
            expect(Vec2.dot(a, b)).toBe(11);
        });

        it('should correctly calculate the angle of a vector', () => {
            // angle = Math.atan2(x, -y)
            const v1 = vec2(0, -1); // y is down, so -y is up (1). atan2(0, 1) = 0
            expect(Vec2.angle(v1)).toBe(0);

            const v2 = vec2(1, 0); // x is right, -y is 0. atan2(1, 0) = PI/2
            expect(Vec2.angle(v2)).toBeCloseTo(Math.PI / 2);

            const v3 = vec2(0, 1); // y is up, -y is -1. atan2(0, -1) = PI (or -PI)
            expect(Math.abs(Vec2.angle(v3))).toBeCloseTo(Math.PI);

            const v4 = vec2(-1, 0); // x is left, -y is 0. atan2(-1, 0) = -PI/2
            expect(Vec2.angle(v4)).toBeCloseTo(-Math.PI / 2);
        });

        it('should correctly create a vector from an angle and magnitude', () => {
            // fromAngle: x = Math.sin(angle)*mag, y = -Math.cos(angle)*mag
            const v1 = Vec2.fromAngle(0, 5);
            expect(v1.x).toBeCloseTo(0);
            expect(v1.y).toBeCloseTo(-5);

            const v2 = Vec2.fromAngle(Math.PI / 2, 2);
            expect(v2.x).toBeCloseTo(2);
            expect(v2.y).toBeCloseTo(0);
        });

        it('should use default magnitude of 1 in fromAngle', () => {
            const v = Vec2.fromAngle(Math.PI);
            expect(v.x).toBeCloseTo(0);
            expect(v.y).toBeCloseTo(1);
        });

        it('should correctly return a zero vector', () => {
            expect(Vec2.zero()).toEqual({ x: 0, y: 0 });
        });
    });
});
