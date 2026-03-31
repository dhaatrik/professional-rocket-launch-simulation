import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MathUtils } from '../src/utils/MathUtils';

describe('MathUtils', () => {
    describe('secureRandom', () => {
        let originalCrypto: any;
        let originalWindow: any;
        let originalMathRandom: typeof Math.random;

        beforeEach(() => {
            originalCrypto = globalThis.crypto;
            originalWindow = globalThis.window;
            originalMathRandom = Math.random;
        });

        afterEach(() => {
            vi.unstubAllGlobals();
            Math.random = originalMathRandom;
            vi.restoreAllMocks();
        });

        it('should return a number between 0 (inclusive) and 1 (exclusive)', () => {
            // Use default environment (Node.js crypto is usually available in vitest)
            const val = MathUtils.secureRandom();
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThan(1);
        });

        it('should use global crypto.getRandomValues if available', () => {
            const mockGetRandomValues = vi.fn((array: Uint32Array) => {
                array[0] = 2147483648; // exactly half of max uint32
                return array;
            });

            vi.stubGlobal('crypto', { getRandomValues: mockGetRandomValues });

            const val = MathUtils.secureRandom();
            expect(mockGetRandomValues).toHaveBeenCalledTimes(1);
            expect(val).toBeCloseTo(0.5);
        });

        it('should use window.crypto.getRandomValues if global crypto is undefined', () => {
            vi.stubGlobal('crypto', undefined);

            const mockGetRandomValues = vi.fn((array: Uint32Array) => {
                array[0] = 1073741824; // exactly quarter of max uint32
                return array;
            });

            vi.stubGlobal('window', { crypto: { getRandomValues: mockGetRandomValues } });

            const val = MathUtils.secureRandom();
            expect(mockGetRandomValues).toHaveBeenCalledTimes(1);
            expect(val).toBeCloseTo(0.25);
        });

        it('should fallback to Math.random if no crypto API is available', () => {
            vi.stubGlobal('crypto', undefined);
            vi.stubGlobal('window', undefined);

            Math.random = vi.fn(() => 0.75);

            const val = MathUtils.secureRandom();
            expect(Math.random).toHaveBeenCalledTimes(1);
            expect(val).toBe(0.75);
        });
    });
});