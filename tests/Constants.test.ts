import { describe, it, expect } from 'vitest';
import {
    getMachNumber,
    getAtmosphericDensity,
    getGravity,
    getDynamicPressure,
    SPEED_OF_SOUND,
    RHO_SL,
    GRAVITY,
    R_EARTH
} from '../src/config/Constants';

describe('Constants Physics Functions', () => {
    describe('getMachNumber', () => {
        it('should return 0 when velocity is 0', () => {
            expect(getMachNumber(0)).toBe(0);
        });

        it('should return 1 when velocity equals SPEED_OF_SOUND', () => {
            expect(getMachNumber(SPEED_OF_SOUND)).toBe(1);
        });

        it('should return 2 when velocity is twice SPEED_OF_SOUND', () => {
            expect(getMachNumber(SPEED_OF_SOUND * 2)).toBe(2);
        });

        it('should handle negative velocity', () => {
            expect(getMachNumber(-SPEED_OF_SOUND)).toBe(-1);
        });
    });

    describe('getDynamicPressure', () => {
        it('should calculate dynamic pressure correctly', () => {
            const density = 1.225;
            const velocity = 100;
            // q = 0.5 * rho * v^2 = 0.5 * 1.225 * 10000 = 6125
            expect(getDynamicPressure(density, velocity)).toBeCloseTo(6125);
        });

        it('should return 0 when velocity is 0', () => {
            expect(getDynamicPressure(1.225, 0)).toBe(0);
        });

        it('should return 0 when density is 0', () => {
            expect(getDynamicPressure(0, 100)).toBe(0);
        });
    });

    describe('getGravity', () => {
        it('should return GRAVITY at sea level', () => {
            expect(getGravity(0)).toBeCloseTo(GRAVITY);
        });

        it('should return 1/4 of GRAVITY at an altitude of one Earth radius', () => {
            // g = g0 * (R / (R + h))^2
            // if h = R, g = g0 * (R / 2R)^2 = g0 * (1/2)^2 = g0 * 0.25
            expect(getGravity(R_EARTH)).toBeCloseTo(GRAVITY * 0.25);
        });

        it('should handle negative altitude by clamping to sea level', () => {
            expect(getGravity(-1000)).toBeCloseTo(GRAVITY);
        });
    });

    describe('getAtmosphericDensity', () => {
        it('should return RHO_SL at sea level', () => {
            expect(getAtmosphericDensity(0)).toBeCloseTo(RHO_SL);
        });

        it('should return 0 at the LUT maximum altitude (200km)', () => {
            expect(getAtmosphericDensity(200000)).toBe(0);
        });

        it('should return 0 above the LUT maximum altitude', () => {
            expect(getAtmosphericDensity(250000)).toBe(0);
        });

        it('should handle negative altitude by clamping to sea level', () => {
            expect(getAtmosphericDensity(-500)).toBeCloseTo(RHO_SL);
        });

        it('should interpolate values correctly (at half SCALE_HEIGHT)', () => {
            // This is a bit more complex due to LUT, but let's check it's reasonable
            // rho = RHO_SL * exp(-alt / SCALE_HEIGHT)
            // at alt = 7000, expect approx RHO_SL * exp(-1)
            const SCALE_HEIGHT = 7000; // Hardcoded for expectation check
            const densityAtScaleHeight = getAtmosphericDensity(SCALE_HEIGHT);
            expect(densityAtScaleHeight).toBeCloseTo(RHO_SL * Math.exp(-1), 4);
        });
    });
});
