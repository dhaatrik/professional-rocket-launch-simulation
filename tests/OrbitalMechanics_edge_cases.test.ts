import { describe, it, expect } from 'vitest';
import { calculateOrbitalElements, MU } from '../src/physics/OrbitalMechanics';
import { R_EARTH } from '../src/config/Constants';
import { vec2 } from '../src/types';

describe('OrbitalMechanics Edge Cases', () => {
    describe('Hyperbolic Orbits (e > 1)', () => {
        it('should correctly calculate elements for hyperbolic trajectory', () => {
            const rMag = R_EARTH + 400000;
            // Escape velocity at this altitude: sqrt(2 * MU / r)
            const vEsc = Math.sqrt(2 * MU / rMag);
            // set velocity to 1.5x escape velocity
            const vHyper = vEsc * 1.5;

            // Tangential velocity for simplicity (perpendicular to radius)
            const r = vec2(rMag, 0);
            const v = vec2(0, vHyper);

            const elements = calculateOrbitalElements(r, v);

            expect(elements.eccentricity).toBeGreaterThan(1);
            expect(elements.semiMajorAxis).toBeLessThan(0); // Hyperbolic a is negative
            expect(elements.specificEnergy).toBeGreaterThan(0); // Hyperbolic energy is positive
            expect(elements.periapsis).toBeCloseTo(400000, 1);

            // For hyperbolic orbit, apoapsis is mathematically defined but physically virtual (negative)
            // The current implementation returns a large negative number
            expect(elements.apoapsis).toBeLessThan(0);
        });
    });

    describe('Parabolic Orbits (e = 1)', () => {
        it('should handle parabolic trajectory', () => {
            const rMag = R_EARTH + 400000;
            const vEsc = Math.sqrt(2 * MU / rMag);

            const r = vec2(rMag, 0);
            const v = vec2(0, vEsc);

            const elements = calculateOrbitalElements(r, v);

            expect(elements.eccentricity).toBeCloseTo(1, 5);
            expect(elements.semiMajorAxis).toBe(Infinity);
            expect(elements.specificEnergy).toBeCloseTo(0, 5);

            // Current limitation: trueAnomaly calculation results in NaN for parabolic orbits
            // This test documents the behavior. Fixing it would require algorithm adjustment.
            expect(elements.trueAnomaly).toBeNaN();
        });
    });

    describe('Singularity (r=0)', () => {
        it('should handle zero radius without crashing', () => {
            const r = vec2(0, 0);
            const v = vec2(0, 0);

            const elements = calculateOrbitalElements(r, v);

            // Expect specific energy to be -Infinity (KE=0, PE=-Inf)
            expect(elements.specificEnergy).toBe(-Infinity);

            // Expect semi-major axis to be 0 (-MU / -Inf)
            expect(elements.semiMajorAxis).toBe(0);

            // Expect eccentricity to be NaN (singularity)
            expect(elements.eccentricity).toBeNaN();
        });
    });
});
