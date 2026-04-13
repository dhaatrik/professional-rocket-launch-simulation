import { describe, it, expect, vi, afterEach } from 'vitest';
import { secureRandom } from '../src/utils/Security';

describe('Security Utils', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('secureRandom', () => {
        it('should return a number between 0 (inclusive) and 1 (exclusive)', () => {
            const val = secureRandom();
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThan(1);
        });

        it('should use globalThis.crypto.getRandomValues', () => {
            const mockGetRandomValues = vi.fn((array: Uint32Array) => {
                array[0] = 2147483648; // 2^31, which is half of 2^32 (4294967296)
                return array;
            });

            vi.stubGlobal('crypto', { getRandomValues: mockGetRandomValues });

            const val = secureRandom();

            expect(mockGetRandomValues).toHaveBeenCalledTimes(1);
            expect(mockGetRandomValues).toHaveBeenCalledWith(expect.any(Uint32Array));

            const callArg = mockGetRandomValues.mock.calls[0]![0] as Uint32Array;
            expect(callArg.length).toBe(1);

            // 2147483648 / 4294967296 = 0.5
            expect(val).toBe(0.5);
        });

        it('should return 0 when getRandomValues sets the array value to 0', () => {
            vi.stubGlobal('crypto', {
                getRandomValues: (array: Uint32Array) => {
                    array[0] = 0;
                    return array;
                }
            });
            expect(secureRandom()).toBe(0);
        });

        it('should return a value approaching 1 when getRandomValues sets the array value to max uint32', () => {
            vi.stubGlobal('crypto', {
                getRandomValues: (array: Uint32Array) => {
                    array[0] = 4294967295; // 2^32 - 1
                    return array;
                }
            });
            const val = secureRandom();
            expect(val).toBeLessThan(1);
            expect(val).toBeGreaterThan(0.999999999);
        });
    });
});
