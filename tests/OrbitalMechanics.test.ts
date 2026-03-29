import { describe, it, expect } from 'vitest';
import {
    calculateOrbitalElements,
    calculateVisViva,
    calculateCircularVelocity,
    calculateHohmannTransfer,
    calculateCircularizationFromElements,
    calculateGroundTrack,
    LAUNCH_SITE,
    MU
} from '../src/physics/OrbitalMechanics';
import { R_EARTH } from '../src/config/Constants';
import { vec2 } from '../src/types';

describe('OrbitalMechanics', () => {
    describe('Orbital Elements', () => {
        it('should calculate circular orbit correctly', () => {
            const rMag = R_EARTH + 400000;
            const vMag = calculateCircularVelocity(rMag);
            const elements = calculateOrbitalElements(vec2(rMag, 0), vec2(0, vMag));

            expect(elements.eccentricity).toBeCloseTo(0, 5);
            expect(elements.semiMajorAxis).toBeCloseTo(rMag, 0);
        });

        it('should calculate elliptical orbit correctly', () => {
            const altitude = 400000;
            const rMag = R_EARTH + altitude;
            const vMag = calculateCircularVelocity(rMag) * 1.1;
            const elements = calculateOrbitalElements(vec2(rMag, 0), vec2(0, vMag));

            expect(elements.eccentricity).toBeGreaterThan(0);
            expect(elements.eccentricity).toBeLessThan(1);
            expect(elements.periapsis).toBeCloseTo(altitude, 0);
        });
    });

    describe('Vis-Viva Equation', () => {
        it('should match circular velocity formula', () => {
            const r = R_EARTH + 500000;
            const v = calculateVisViva(r, r); // a=r
            const expected = calculateCircularVelocity(r);
            expect(v).toBeCloseTo(expected, 5);
        });
    });

    describe('Hohmann Transfer', () => {
        it('should derive correct delta-v', () => {
            const r1 = R_EARTH + 300000;
            const r2 = R_EARTH + 35786000;
            const plan = calculateHohmannTransfer(r1, r2, 100000, 5000);

            const aTransfer = (r1 + r2) / 2;
            const v1 = calculateCircularVelocity(r1);
            const vTp = calculateVisViva(r1, aTransfer);
            const expectedDV1 = Math.abs(vTp - v1);

            expect(plan.deltaV1).toBeCloseTo(expectedDV1, 3);
            expect(plan.burnTime1).toBeGreaterThan(0);
        });
    });

    describe('Ground Track', () => {
        it('should start at launch site', () => {
            const pos = calculateGroundTrack(0, 0);
            expect(pos.lat).toBeCloseTo(LAUNCH_SITE.lat, 5);
            expect(pos.lon).toBeCloseTo(LAUNCH_SITE.lon, 5);
        });

        it('should wrap full circle', () => {
            const circumference = 2 * Math.PI * R_EARTH;
            const pos = calculateGroundTrack(circumference, 0);
            expect(pos.lat).toBeCloseTo(LAUNCH_SITE.lat, 3);
            expect(pos.lon).toBeCloseTo(LAUNCH_SITE.lon, 3);
        });

        it('should account for earth rotation', () => {
            const oneHour = 3600;
            const pos = calculateGroundTrack(0, oneHour);
            // Earth rotates East, point should drift West (negative long)
            expect(pos.lon).toBeLessThan(LAUNCH_SITE.lon);
        });
    });
});
