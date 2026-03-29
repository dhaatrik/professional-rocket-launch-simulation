import { describe, it, expect } from 'vitest';
import { EnvironmentSystem, type WindLayer, formatTimeOfDay } from '../src/physics/Environment';
import { Vec2 } from '../src/types/index';

describe('formatTimeOfDay', () => {
    it('should format midnight correctly', () => {
        expect(formatTimeOfDay(0)).toBe('00:00');
    });

    it('should format noon correctly', () => {
        expect(formatTimeOfDay(12)).toBe('12:00');
    });

    it('should format exact hours with single digits', () => {
        expect(formatTimeOfDay(9)).toBe('09:00');
    });

    it('should format fractional hours (half hour)', () => {
        expect(formatTimeOfDay(9.5)).toBe('09:30');
    });

    it('should format fractional hours (quarter hour)', () => {
        expect(formatTimeOfDay(14.25)).toBe('14:15');
    });

    it('should wrap around after 24 hours', () => {
        expect(formatTimeOfDay(25)).toBe('01:00');
        expect(formatTimeOfDay(25.5)).toBe('01:30');
        expect(formatTimeOfDay(48)).toBe('00:00');
    });

    it('should handle almost midnight correctly', () => {
        // 23 hours and 59 minutes = 23 + 59/60 = 23.98333...
        expect(formatTimeOfDay(23 + 59 / 60)).toBe('23:59');
    });

    it('should handle precision edge cases gracefully', () => {
        // Just slightly over 0 minutes, should still floor to 00
        expect(formatTimeOfDay(12.00000001)).toBe('12:00');
        // Just slightly under 60 minutes, should floor to 59
        expect(formatTimeOfDay(12.99999999)).toBe('12:59');
    });
});

describe('EnvironmentSystem', () => {
    describe('Wind Lookup', () => {
        it('should return surface wind correctly', () => {
            const env = new EnvironmentSystem();
            const wind = env.getWindAtAltitude(0);
            const speed = Vec2.magnitude(wind);
            expect(speed).toBeCloseTo(5, 3);
        });

        it('should interpolate between layers', () => {
            const env = new EnvironmentSystem();
            // Layer 0: 5 m/s (0-1000m)
            // Layer 1: 12 m/s (1000m-5000m)
            // At 500m (midpoint 0-1000), expecting average? 
            // Wait, existing test said (5+12)/2 = 8.5.
            const wind = env.getWindAtAltitude(500);
            const speed = Vec2.magnitude(wind);
            expect(speed).toBeCloseTo(8.5, 3);
        });

        it('should match start of next layer', () => {
            const env = new EnvironmentSystem();
            const wind = env.getWindAtAltitude(1000);
            const speed = Vec2.magnitude(wind);
            expect(speed).toBeCloseTo(12, 3);
        });

        it('should clamp negative altitude', () => {
            const env = new EnvironmentSystem();
            const wind = env.getWindAtAltitude(-100);
            expect(Vec2.magnitude(wind)).toBeCloseTo(5, 3);
        });

        it('should handle constant high altitude wind', () => {
            const env = new EnvironmentSystem();
            const wind = env.getWindAtAltitude(60000); // > 50km
            expect(Vec2.magnitude(wind)).toBeCloseTo(2, 3);
        });
    });

    describe('Custom Layers', () => {
        it('should use custom wind layers', () => {
            const env = new EnvironmentSystem();
            const layers: WindLayer[] = [
                { altitudeMin: 0, altitudeMax: 100, windSpeed: 10, windDirection: 0 },
                { altitudeMin: 100, altitudeMax: 200, windSpeed: 20, windDirection: 0 }
            ];
            env.setWindLayers(layers);

            const wind = env.getWindAtAltitude(50); // Midpoint
            expect(Vec2.magnitude(wind)).toBeCloseTo(15, 3);
        });

        it('should handle unsorted layers', () => {
            const env = new EnvironmentSystem();
            const layers: WindLayer[] = [
                { altitudeMin: 100, altitudeMax: 200, windSpeed: 20, windDirection: 0 },
                { altitudeMin: 0, altitudeMax: 100, windSpeed: 10, windDirection: 0 }
            ];
            env.setWindLayers(layers);

            const wind = env.getWindAtAltitude(50);
            expect(Vec2.magnitude(wind)).toBeCloseTo(15, 3);
        });
    });
});
