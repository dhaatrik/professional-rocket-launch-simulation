import { describe, it, expect } from 'vitest';
import { Units, asMeters, asNewtons, asKilograms, asRadians, asSeconds } from '../src/types/units';

describe('Units', () => {
    describe('Distance conversions', () => {
        it('metersToKilometers', () => {
            const m = Units.meters(1500);
            expect(Units.metersToKilometers(m)).toBe(1.5);
        });

        it('kilometersToMeters', () => {
            const km = Units.kilometers(2.5);
            expect(Units.kilometersToMeters(km)).toBe(2500);
        });

        it('metersToPixels', () => {
            const m = Units.meters(10);
            expect(Units.metersToPixels(m, 5)).toBe(50);
        });

        it('pixelsToMeters', () => {
            const px = Units.pixels(100);
            expect(Units.pixelsToMeters(px, 5)).toBe(20);
        });
    });

    describe('Angle conversions', () => {
        it('radiansToDesgrees', () => {
            const rad = Units.radians(Math.PI);
            expect(Units.radiansToDesgrees(rad)).toBe(180);
        });

        it('degreesToRadians', () => {
            const deg = Units.degrees(180);
            expect(Units.degreesToRadians(deg)).toBe(Math.PI);
        });
    });

    describe('Time conversions', () => {
        it('secondsToMilliseconds', () => {
            const s = Units.seconds(2.5);
            expect(Units.secondsToMilliseconds(s)).toBe(2500);
        });

        it('millisecondsToSeconds', () => {
            const ms = 3500 as any; // Cast as any because there is no milliseconds branded creation utility in Units
            expect(Units.millisecondsToSeconds(ms)).toBe(3.5);
        });
    });

    describe('Creation utilities', () => {
        it('should correctly cast numbers to branded types', () => {
            expect(Units.meters(10)).toBe(10);
            expect(Units.kilometers(10)).toBe(10);
            expect(Units.pixels(10)).toBe(10);
            expect(Units.seconds(10)).toBe(10);
            expect(Units.newtons(10)).toBe(10);
            expect(Units.kilograms(10)).toBe(10);
            expect(Units.radians(10)).toBe(10);
            expect(Units.degrees(10)).toBe(10);
            expect(Units.metersPerSecond(10)).toBe(10);
            expect(Units.kgPerCubicMeter(10)).toBe(10);
            expect(Units.isp(10)).toBe(10);
        });
    });
});

describe('Type Guards', () => {
    it('asMeters', () => {
        expect(asMeters(100)).toBe(100);
    });

    it('asNewtons', () => {
        expect(asNewtons(100)).toBe(100);
    });

    it('asKilograms', () => {
        expect(asKilograms(100)).toBe(100);
    });

    it('asRadians', () => {
        expect(asRadians(100)).toBe(100);
    });

    it('asSeconds', () => {
        expect(asSeconds(100)).toBe(100);
    });
});
