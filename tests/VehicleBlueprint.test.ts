import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deserializeBlueprint, loadBlueprints } from '../src/vab/VehicleBlueprint';

describe('VehicleBlueprint', () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
        // Suppress console.error in tests to avoid cluttering the output,
        // but allow us to assert that it was called.
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('deserializeBlueprint', () => {
        it('returns null and logs error when JSON is invalid', () => {
            const invalidJson = 'this is not valid json';
            const result = deserializeBlueprint(invalidJson);

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.any(SyntaxError)
            );
        });

        it('returns null and logs error when an unknown part ID is used', () => {
            const invalidData = {
                stages: [{
                    parts: [{ partId: 'NON_EXISTENT_PART_ID', instanceId: '1', stageIndex: 0 }]
                }]
            };

            const result = deserializeBlueprint(JSON.stringify(invalidData));

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.any(Error)
            );
            // Verify the exact error message
            const errorArg = consoleErrorSpy.mock.calls[0][1];
            expect(errorArg.message).toBe('Unknown part: NON_EXISTENT_PART_ID');
        });
    });

    describe('loadBlueprints', () => {
        it('returns empty array and logs error when localStorage data is invalid JSON', () => {
            // Mock Storage.prototype.getItem to return invalid JSON
            const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('invalid json data');

            const result = loadBlueprints();

            expect(result).toEqual([]);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to load blueprints:',
                expect.any(SyntaxError)
            );

            getItemSpy.mockRestore();
        });
    });
});