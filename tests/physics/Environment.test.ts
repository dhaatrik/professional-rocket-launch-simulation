import { describe, it, expect } from 'vitest';
import { getWindDirectionString } from '../../src/physics/Environment';

describe('Environment - getWindDirectionString', () => {
    it('converts radians correctly to compass directions', () => {
        // Test basic cardinal directions
        // East is 0 in our system
        expect(getWindDirectionString(0)).toBe('E');
        // North is pi/2
        expect(getWindDirectionString(Math.PI / 2)).toBe('N');
        // West is pi
        expect(getWindDirectionString(Math.PI)).toBe('W');
        // South is 3pi/2
        expect(getWindDirectionString(3 * Math.PI / 2)).toBe('S');

        // Test ordinal directions
        // North East is pi/4
        expect(getWindDirectionString(Math.PI / 4)).toBe('NE');
        // North West is 3pi/4
        expect(getWindDirectionString(3 * Math.PI / 4)).toBe('NW');
        // South West is 5pi/4
        expect(getWindDirectionString(5 * Math.PI / 4)).toBe('SW');
        // South East is 7pi/4
        expect(getWindDirectionString(7 * Math.PI / 4)).toBe('SE');
    });

    it('handles negative radians correctly', () => {
        // -pi/2 should be South
        expect(getWindDirectionString(-Math.PI / 2)).toBe('S');
        // -pi should be West
        expect(getWindDirectionString(-Math.PI)).toBe('W');
        // -3pi/2 should be North
        expect(getWindDirectionString(-3 * Math.PI / 2)).toBe('N');
    });

    it('handles > 2pi radians correctly', () => {
        // 2pi should be East
        expect(getWindDirectionString(2 * Math.PI)).toBe('E');
        // 5pi/2 should be North
        expect(getWindDirectionString(5 * Math.PI / 2)).toBe('N');
    });

    it('rounds correctly for off-center angles', () => {
        // slightly off East (towards North East)
        expect(getWindDirectionString(Math.PI / 8 - 0.01)).toBe('E');
        expect(getWindDirectionString(Math.PI / 8 + 0.01)).toBe('NE');
    });
});
