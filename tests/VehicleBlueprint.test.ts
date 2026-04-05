import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadBlueprints, deserializeBlueprint, serializeBlueprint, createBlueprint, addStage, addPartToStage } from '../src/vab/VehicleBlueprint';
import { ENGINE_MERLIN_1D } from '../src/vab/PartsCatalog';

describe('VehicleBlueprint Error Paths', () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
        // Mock localStorage
        const store: Record<string, string> = {};
        const localStorageMock = {
            getItem: vi.fn((key: string) => store[key] || null),
            setItem: vi.fn((key: string, value: string) => {
                store[key] = value;
            }),
            clear: vi.fn(() => {
                for (const key in store) {
                    delete store[key];
                }
            })
        };
        vi.stubGlobal('localStorage', localStorageMock);

        // Spy on console.error
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('deserializeBlueprint', () => {
        it('should return null and log error when parsing invalid JSON', () => {
            const result = deserializeBlueprint('invalid json');
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to deserialize blueprint:', expect.any(SyntaxError));
        });

        it('should return null and log error when parsed JSON is not an object', () => {
            const result = deserializeBlueprint(JSON.stringify("just a string"));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid blueprint format: not an object' })
            );
        });

        it('should return null and log error when stages is missing or not an array', () => {
            const badData = { name: 'Bad Rocket', id: 'bad-1' };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid blueprint format: stages is not an array' })
            );
        });

        it('should return null and log error when a stage is not an object', () => {
            const badData = { stages: [ "not a stage object" ] };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid stage format: not an object' })
            );
        });

        it('should return null and log error when parts is not an array', () => {
            const badData = { stages: [ { stageNumber: 0, parts: "not an array" } ] };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid stage format: parts is not an array' })
            );
        });

        it('should return null and log error when a part instance is not an object', () => {
            const badData = { stages: [ { parts: [ "not an object" ] } ] };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid part instance format: not an object' })
            );
        });

        it('should return null and log error when partId is not a string', () => {
            const badData = { stages: [ { parts: [ { partId: 123 } ] } ] };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid part instance format: partId is not a string' })
            );
        });

        it('should return null and log error when an unexpected error occurs during mapping', () => {
            const validData = {
                stages: []
            };

            const originalMap = Array.prototype.map;
            let result;
            try {
                // Force an unexpected error inside the map operation
                Array.prototype.map = vi.fn().mockImplementation(() => {
                    throw new Error('Unexpected mapping error');
                });

                result = deserializeBlueprint(JSON.stringify(validData));
            } finally {
                // Restore map immediately before running expectations
                // so we don't break Vitest's internal use of map during assertions.
                Array.prototype.map = originalMap;
            }

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Unexpected mapping error' })
            );
        });

        it('should return null and log error when part ID is unknown', () => {
            // Create a valid JSON structure but with a bad part ID
            const badData = {
                name: 'Bad Rocket',
                id: 'bad-1',
                createdAt: 123,
                modifiedAt: 123,
                stages: [{
                    stageNumber: 0,
                    hasDecoupler: false,
                    parts: [{
                        partId: 'non-existent-part-id',
                        instanceId: 'inst-1',
                        stageIndex: 0
                    }]
                }]
            };

            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            // The error object thrown is an Error, so we can test its message
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Unknown part: non-existent-part-id' })
            );
        });
    });

    describe('loadBlueprints', () => {
        it('should throw an error when localStorage contains a non-array JSON structure', () => {
            localStorage.setItem('vab-blueprints', JSON.stringify({ not: 'an array' }));
            expect(() => loadBlueprints()).toThrow(/Failed to load blueprints: Stored blueprints data is not an array/);
        });

        it('should return empty array when localStorage is empty', () => {
            const result = loadBlueprints();
            expect(result).toEqual([]);
        });

        it('should throw an error when localStorage contains invalid JSON', () => {
            // This is the core test for the catch block in loadBlueprints.
            // When localStorage.getItem('vab-blueprints') returns a string that fails JSON.parse(data),
            // it triggers the catch block.
            localStorage.setItem('vab-blueprints', 'invalid json');

            expect(() => loadBlueprints()).toThrow(/Failed to load blueprints:/);
        });

        it('should throw an error when localStorage contains a non-array JSON', () => {
            localStorage.setItem('vab-blueprints', '{"some": "object"}');

            expect(() => loadBlueprints()).toThrow(/Failed to load blueprints: Stored blueprints data is not an array/);
        });

        it('should handle native JSON.parse errors gracefully by throwing', () => {
            localStorage.setItem('vab-blueprints', '{ invalid ]');

            expect(() => loadBlueprints()).toThrow(/Failed to load blueprints:/);
        });

        it('should successfully load valid blueprints and filter out invalid ones', () => {
            // Create a valid blueprint
            let bp1 = createBlueprint('Good Rocket');
            bp1 = addStage(bp1);
            bp1 = addPartToStage(bp1, 0, ENGINE_MERLIN_1D);

            // Serialize valid blueprint
            const validJson = serializeBlueprint(bp1);

            // Create invalid blueprint JSON
            const badData = {
                name: 'Bad Rocket',
                id: 'bad-1',
                createdAt: 123,
                modifiedAt: 123,
                stages: [{
                    stageNumber: 0,
                    hasDecoupler: false,
                    parts: [{
                        partId: 'non-existent-part-id', // This will fail deserialization
                        instanceId: 'inst-1',
                        stageIndex: 0
                    }]
                }]
            };
            const invalidJson = JSON.stringify(badData);

            // Set localStorage to an array containing both valid and invalid JSON strings
            localStorage.setItem('vab-blueprints', JSON.stringify([validJson, invalidJson]));

            // Load blueprints
            const result = loadBlueprints();

            // Should only contain the valid blueprint
            expect(result.length).toBe(1);
            expect(result[0]!.name).toBe('Good Rocket');

            // And should have logged an error for the invalid one from deserializeBlueprint
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Unknown part: non-existent-part-id' })
            );
        });
    });
});
