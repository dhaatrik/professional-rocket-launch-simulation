import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import {
    saveBlueprints,
    loadBlueprints,
    deserializeBlueprint,
    serializeBlueprint,
    createBlueprint,
    addStage,
    addPartToStage,
    removePartFromStage,
    removeStage,
    calculateStats,
    createFalconPreset,
    createSimplePreset
} from '../src/vab/VehicleBlueprint';
import {
    ENGINE_MERLIN_1D,
    TANK_LARGE,
    TANK_MEDIUM,
    AVIONICS_BASIC,
    FAIRING_SMALL,
    ENGINE_MERLIN_VAC
} from '../src/vab/PartsCatalog';

describe('VehicleBlueprint Functional Logic', () => {
    describe('Stage Manipulation', () => {
        it('should correctly remove a part from a stage by instanceId', () => {
            let bp = createBlueprint('Test Rocket');
            bp = addStage(bp);
            bp = addPartToStage(bp, 0, ENGINE_MERLIN_1D);
            bp = addPartToStage(bp, 0, TANK_MEDIUM);

            expect(bp.stages[0]!.parts.length).toBe(2);
            const partToRemove = bp.stages[0]!.parts[0]!.instanceId;

            bp = removePartFromStage(bp, 0, partToRemove);
            expect(bp.stages[0]!.parts.length).toBe(1);
            expect(bp.stages[0]!.parts[0]!.part.id).toBe(TANK_MEDIUM.id);
        });

        it('should return blueprint unmodified if trying to remove a part from an invalid stage', () => {
            let bp = createBlueprint('Test Rocket');
            bp = addStage(bp);
            bp = addPartToStage(bp, 0, ENGINE_MERLIN_1D);

            const partId = bp.stages[0]!.parts[0]!.instanceId;
            const originalBp = bp;

            bp = removePartFromStage(bp, 1, partId); // Stage 1 does not exist
            expect(bp).toBe(originalBp);
        });

        it('should correctly remove a stage and renumber remaining stages', () => {
            let bp = createBlueprint('Test Rocket');
            bp = addStage(bp); // 0
            bp = addStage(bp); // 1
            bp = addStage(bp); // 2

            expect(bp.stages.length).toBe(3);

            bp = removeStage(bp, 1);

            expect(bp.stages.length).toBe(2);
            expect(bp.stages[0]!.stageNumber).toBe(0);
            expect(bp.stages[1]!.stageNumber).toBe(1);
        });

        it('should return blueprint unmodified if trying to remove an out of bounds stage', () => {
            let bp = createBlueprint('Test Rocket');
            bp = addStage(bp);

            const originalBp = bp;
            bp = removeStage(bp, 1); // Invalid index
            expect(bp).toBe(originalBp);

            bp = removeStage(bp, -1); // Invalid index
            expect(bp).toBe(originalBp);
        });
    });

    describe('calculateStats', () => {
        it('should correctly calculate statistics for a multi-stage rocket', () => {
            let bp = createBlueprint('Stats Test');
            bp = addStage(bp); // Stage 0
            bp = addPartToStage(bp, 0, ENGINE_MERLIN_1D);
            bp = addPartToStage(bp, 0, TANK_LARGE);

            bp = addStage(bp); // Stage 1
            bp.stages[1]!.hasDecoupler = true; // Add decoupler to stage 1
            bp = addPartToStage(bp, 1, ENGINE_MERLIN_VAC);
            bp = addPartToStage(bp, 1, TANK_MEDIUM);
            bp = addPartToStage(bp, 1, AVIONICS_BASIC);
            bp = addPartToStage(bp, 1, FAIRING_SMALL);

            const stats = calculateStats(bp);

            // Verify boolean flags
            expect(stats.hasAvionics).toBe(true);
            expect(stats.hasFairing).toBe(true);

            // Verify basic mass logic
            expect(stats.dryMass).toBeGreaterThan(0);
            expect(stats.fuelMass).toBeGreaterThan(0);
            expect(stats.wetMass).toBe(stats.dryMass + stats.fuelMass);
            expect(stats.totalCost).toBeGreaterThan(0);
            expect(stats.totalHeight).toBeGreaterThan(0);

            // Verify multi-stage logic (2 stages)
            expect(stats.stageDeltaV.length).toBe(2);
            expect(stats.stageTWR.length).toBe(2);

            // Decoupler mass + cost + height penalty checks implicitly verified by the numbers
            // totalDeltaV should be the sum of stageDeltaVs
            expect(stats.totalDeltaV).toBeCloseTo(stats.stageDeltaV[0]! + stats.stageDeltaV[1]!, 5);
        });

        it('should correctly handle stages with zero thrust', () => {
            let bp = createBlueprint('No Thrust');
            bp = addStage(bp);
            bp = addPartToStage(bp, 0, TANK_LARGE);

            const stats = calculateStats(bp);
            expect(stats.stageTWR[0]).toBe(0);
            expect(stats.stageDeltaV[0]).toBe(0);
        });
    });

    describe('Presets', () => {
        it('should correctly create Falcon Preset', () => {
            const bp = createFalconPreset();
            expect(bp.name).toBe('Falcon 9');
            expect(bp.stages.length).toBe(2);

            // First stage parts
            const stage0 = bp.stages[0]!;
            expect(stage0.parts.some((p) => p.part.id === ENGINE_MERLIN_1D.id)).toBe(true);
            expect(stage0.parts.some((p) => p.part.id === TANK_LARGE.id)).toBe(true);

            // Second stage parts
            const stage1 = bp.stages[1]!;
            expect(stage1.parts.some((p) => p.part.id === ENGINE_MERLIN_VAC.id)).toBe(true);
            expect(stage1.parts.some((p) => p.part.id === FAIRING_SMALL.id)).toBe(true);
            expect(stage1.parts.some((p) => p.part.id === AVIONICS_BASIC.id)).toBe(true);
        });

        it('should correctly create Simple Preset', () => {
            const bp = createSimplePreset();
            expect(bp.name).toBe('Simple Rocket');
            expect(bp.stages.length).toBe(1);

            const stage0 = bp.stages[0]!;
            expect(stage0.parts.some((p) => p.part.id === ENGINE_MERLIN_1D.id)).toBe(true);
            expect(stage0.parts.some((p) => p.part.id === TANK_MEDIUM.id)).toBe(true);
            expect(stage0.parts.some((p) => p.part.id === AVIONICS_BASIC.id)).toBe(true);
        });
    });
});

describe('VehicleBlueprint Error Paths', () => {
    let consoleErrorSpy: MockInstance;

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
            const result = deserializeBlueprint(JSON.stringify('just a string'));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid blueprint format: not an object' })
            );
        });

        it('should return null and log error when stages is missing or not an array', () => {
            const badData = { name: 'Bad Rocket', id: 'bad-1', createdAt: 123, modifiedAt: 123 };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid blueprint format: stages is not an array' })
            );
        });

        it('should return null and log error when name is missing or not a string', () => {
            const badData = { id: '1', createdAt: 1, modifiedAt: 1, stages: [] };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid blueprint format: name is not a string' })
            );
        });

        it('should return null and log error when id is missing or not a string', () => {
            const badData = { name: 'n', createdAt: 1, modifiedAt: 1, stages: [] };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid blueprint format: id is not a string' })
            );
        });

        it('should return null and log error when createdAt is missing or not a number', () => {
            const badData = { name: 'n', id: '1', modifiedAt: 1, stages: [] };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid blueprint format: createdAt is not a number' })
            );
        });

        it('should return null and log error when modifiedAt is missing or not a number', () => {
            const badData = { name: 'n', id: '1', createdAt: 1, stages: [] };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid blueprint format: modifiedAt is not a number' })
            );
        });

        it('should return null and log error when a stage is not an object', () => {
            const badData = { name: 'n', id: '1', createdAt: 1, modifiedAt: 1, stages: ['not a stage object'] };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid stage format: not an object' })
            );
        });

        it('should return null and log error when stageNumber is missing or not a number', () => {
            const badData = {
                name: 'n',
                id: '1',
                createdAt: 1,
                modifiedAt: 1,
                stages: [{ hasDecoupler: false, parts: [] }]
            };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid stage format: stageNumber is not a number' })
            );
        });

        it('should return null and log error when hasDecoupler is missing or not a boolean', () => {
            const badData = {
                name: 'n',
                id: '1',
                createdAt: 1,
                modifiedAt: 1,
                stages: [{ stageNumber: 0, parts: [] }]
            };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid stage format: hasDecoupler is not a boolean' })
            );
        });

        it('should return null and log error when parts is not an array', () => {
            const badData = {
                name: 'n',
                id: '1',
                createdAt: 1,
                modifiedAt: 1,
                stages: [{ stageNumber: 0, hasDecoupler: false, parts: 'not an array' }]
            };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid stage format: parts is not an array' })
            );
        });

        it('should return null and log error when a part instance is not an object', () => {
            const badData = {
                name: 'n',
                id: '1',
                createdAt: 1,
                modifiedAt: 1,
                stages: [{ stageNumber: 0, hasDecoupler: false, parts: ['not an object'] }]
            };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid part instance format: not an object' })
            );
        });

        it('should return null and log error when partId is not a string', () => {
            const badData = {
                name: 'n',
                id: '1',
                createdAt: 1,
                modifiedAt: 1,
                stages: [{ stageNumber: 0, hasDecoupler: false, parts: [{ partId: 123 }] }]
            };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid part instance format: partId is not a string' })
            );
        });

        it('should return null and log error when instanceId is not a string', () => {
            const badData = {
                name: 'n',
                id: '1',
                createdAt: 1,
                modifiedAt: 1,
                stages: [{ stageNumber: 0, hasDecoupler: false, parts: [{ partId: 'id', instanceId: 123 }] }]
            };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid part instance format: instanceId is not a string' })
            );
        });

        it('should return null and log error when stageIndex is not a number', () => {
            const badData = {
                name: 'n',
                id: '1',
                createdAt: 1,
                modifiedAt: 1,
                stages: [
                    {
                        stageNumber: 0,
                        hasDecoupler: false,
                        parts: [{ partId: 'id', instanceId: 'id', stageIndex: '0' }]
                    }
                ]
            };
            const result = deserializeBlueprint(JSON.stringify(badData));
            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Failed to deserialize blueprint:',
                expect.objectContaining({ message: 'Invalid part instance format: stageIndex is not a number' })
            );
        });

        it('should return null and log error when an unexpected error occurs during mapping', () => {
            const validData = {
                name: 'n',
                id: '1',
                createdAt: 1,
                modifiedAt: 1,
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
                stages: [
                    {
                        stageNumber: 0,
                        hasDecoupler: false,
                        parts: [
                            {
                                partId: 'non-existent-part-id',
                                instanceId: 'inst-1',
                                stageIndex: 0
                            }
                        ]
                    }
                ]
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

    describe('saveBlueprints', () => {
        it('should catch and log error when localStorage.setItem throws', () => {
            const blueprint = createBlueprint('Test');

            // Override the setItem mock for this specific test
            localStorage.setItem = vi.fn().mockImplementation(() => {
                throw new Error('Quota exceeded');
            });

            saveBlueprints([blueprint]);

            expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save blueprints:', expect.any(Error));
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

        it('should handle thrown exceptions that are not Error objects', () => {
            localStorage.setItem('vab-blueprints', '[]');
            const originalParse = JSON.parse;
            JSON.parse = vi.fn(() => {
                throw 'String error';
            });

            expect(() => loadBlueprints()).toThrow(/Failed to load blueprints: String error/);

            JSON.parse = originalParse;
        });

        it('should throw an error when localStorage returns a non-array valid JSON string', () => {
            // Rationale: Requires mocking localStorage to return a non-array valid JSON string (e.g., '{"key":"value"}') to trigger the array validation error.
            localStorage.setItem('vab-blueprints', '{"key":"value"}');

            expect(() => loadBlueprints()).toThrow(/Failed to load blueprints: Stored blueprints data is not an array/);
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
                stages: [
                    {
                        stageNumber: 0,
                        hasDecoupler: false,
                        parts: [
                            {
                                partId: 'non-existent-part-id', // This will fail deserialization
                                instanceId: 'inst-1',
                                stageIndex: 0
                            }
                        ]
                    }
                ]
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
