import { describe, it, expect } from 'vitest';
import { EnvironmentSystem, type WindLayer, formatTimeOfDay, DEFAULT_ENVIRONMENT_CONFIG } from '../src/physics/Environment';
import { Vec2 } from '../src/types/index';

describe('DEFAULT_ENVIRONMENT_CONFIG', () => {
    it('should be defined', () => {
        expect(DEFAULT_ENVIRONMENT_CONFIG).toBeDefined();
    });

    it('should have the correct structure and default values', () => {
        expect(DEFAULT_ENVIRONMENT_CONFIG.maxGustSpeed).toBe(8);
        expect(DEFAULT_ENVIRONMENT_CONFIG.gustFrequency).toBe(0.5);
        expect(DEFAULT_ENVIRONMENT_CONFIG.launchWindLimit).toBe(15);
        expect(DEFAULT_ENVIRONMENT_CONFIG.dayCycleMinutes).toBe(10);
        expect(DEFAULT_ENVIRONMENT_CONFIG.enableDayNightCycle).toBe(true);
    });

    it('should contain default wind layers', () => {
        expect(DEFAULT_ENVIRONMENT_CONFIG.windLayers).toBeDefined();
        expect(Array.isArray(DEFAULT_ENVIRONMENT_CONFIG.windLayers)).toBe(true);
        expect(DEFAULT_ENVIRONMENT_CONFIG.windLayers.length).toBeGreaterThan(0);

        // Verify the first layer as a sample
        const firstLayer = DEFAULT_ENVIRONMENT_CONFIG.windLayers[0]!;
        expect(firstLayer.altitudeMin).toBe(0);
        expect(firstLayer.altitudeMax).toBe(1000);
        expect(firstLayer.windSpeed).toBe(5);
        expect(firstLayer.windDirection).toBeCloseTo(Math.PI / 4);
    });
});

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

describe('DEFAULT_WIND_LAYERS', () => {
    it('should be an array of wind layers with 6 entries', () => {
        expect(Array.isArray(DEFAULT_WIND_LAYERS)).toBe(true);
        expect(DEFAULT_WIND_LAYERS.length).toBe(6);
    });

    it('should cover altitudes continuously from 0 to Infinity', () => {
        expect(DEFAULT_WIND_LAYERS[0]?.altitudeMin).toBe(0);
        expect(DEFAULT_WIND_LAYERS[DEFAULT_WIND_LAYERS.length - 1]?.altitudeMax).toBe(Infinity);

        for (let i = 0; i < DEFAULT_WIND_LAYERS.length - 1; i++) {
            const currentLayer = DEFAULT_WIND_LAYERS[i];
            const nextLayer = DEFAULT_WIND_LAYERS[i + 1];
            expect(currentLayer?.altitudeMax).toBe(nextLayer?.altitudeMin);
        }
    });

    it('should have specific properties for key layers', () => {
        // Surface layer
        expect(DEFAULT_WIND_LAYERS[0]?.windSpeed).toBe(5);
        expect(DEFAULT_WIND_LAYERS[0]?.windDirection).toBe(Math.PI / 4);

        // Max-Q zone
        const maxQLayer = DEFAULT_WIND_LAYERS[2];
        expect(maxQLayer?.altitudeMin).toBe(5000);
        expect(maxQLayer?.windSpeed).toBe(25);

        // Upper atmosphere
        const upperAtmosphereLayer = DEFAULT_WIND_LAYERS[5];
        expect(upperAtmosphereLayer?.windSpeed).toBe(2);
        expect(upperAtmosphereLayer?.windDirection).toBe(0);
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
