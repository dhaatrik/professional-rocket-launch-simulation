import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadBlueprints, deserializeBlueprint } from '../src/vab/VehicleBlueprint';

describe('VehicleBlueprint Security', () => {
    let consoleErrorSpy: any;
    let consoleWarnSpy: any;

    beforeEach(() => {
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
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('loadBlueprints', () => {
        it('should handle non-string elements in the stored array', () => {
            localStorage.setItem('vab-blueprints', JSON.stringify([123, "not-a-json"]));
            const result = loadBlueprints();
            // Should skip the non-string element
            expect(result).toEqual([]);
            expect(consoleWarnSpy).toHaveBeenCalledWith('Skipping non-string blueprint entry');
        });
    });

    describe('deserializeBlueprint', () => {
        it('should fail if name is not a string', () => {
            const badData = JSON.stringify({ name: 123, id: 'id', createdAt: 1, modifiedAt: 1, stages: [] });
            expect(deserializeBlueprint(badData)).toBeNull();
        });

        it('should fail if id is not a string', () => {
            const badData = JSON.stringify({ name: 'name', id: 123, createdAt: 1, modifiedAt: 1, stages: [] });
            expect(deserializeBlueprint(badData)).toBeNull();
        });

        it('should fail if createdAt is not a number', () => {
            const badData = JSON.stringify({ name: 'name', id: 'id', createdAt: 'now', modifiedAt: 1, stages: [] });
            expect(deserializeBlueprint(badData)).toBeNull();
        });

        it('should fail if modifiedAt is not a number', () => {
            const badData = JSON.stringify({ name: 'name', id: 'id', createdAt: 1, modifiedAt: 'now', stages: [] });
            expect(deserializeBlueprint(badData)).toBeNull();
        });

        it('should fail if stageNumber is not a number', () => {
            const badData = JSON.stringify({
                name: 'Rocket', id: 'id-1', createdAt: 1000, modifiedAt: 2000,
                stages: [{ stageNumber: 'zero', hasDecoupler: false, parts: [] }]
            });
            expect(deserializeBlueprint(badData)).toBeNull();
        });

        it('should fail if hasDecoupler is not a boolean', () => {
            const badData = JSON.stringify({
                name: 'Rocket', id: 'id-1', createdAt: 1000, modifiedAt: 2000,
                stages: [{ stageNumber: 0, hasDecoupler: 'yes', parts: [] }]
            });
            expect(deserializeBlueprint(badData)).toBeNull();
        });

        it('should fail if instanceId is not a string', () => {
             const badData = JSON.stringify({
                name: 'Rocket', id: 'id-1', createdAt: 1000, modifiedAt: 2000,
                stages: [{
                    stageNumber: 0, hasDecoupler: false,
                    parts: [{ partId: 'engine-merlin-1d', instanceId: 123, stageIndex: 0 }]
                }]
            });
            expect(deserializeBlueprint(badData)).toBeNull();
        });

        it('should fail if stageIndex is not a number', () => {
             const badData = JSON.stringify({
                name: 'Rocket', id: 'id-1', createdAt: 1000, modifiedAt: 2000,
                stages: [{
                    stageNumber: 0, hasDecoupler: false,
                    parts: [{ partId: 'engine-merlin-1d', instanceId: 'inst-1', stageIndex: 'zero' }]
                }]
            });
            expect(deserializeBlueprint(badData)).toBeNull();
        });

        it('should not pass through unexpected properties (mass assignment/prototype pollution)', () => {
            const maliciousData = JSON.stringify({
                name: 'Rocket',
                id: 'id-1',
                createdAt: 1000,
                modifiedAt: 2000,
                stages: [],
                polluted: 'yes',
                __proto__: { admin: true }
            });
            const result = deserializeBlueprint(maliciousData) as any;
            expect(result).not.toBeNull();
            expect(result.polluted).toBeUndefined();
            expect(result.admin).toBeUndefined();
            expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        });

        it('should strictly validate stage properties and not pass through extras', () => {
             const dataWithExtraStageProps = JSON.stringify({
                name: 'Rocket',
                id: 'id-1',
                createdAt: 1000,
                modifiedAt: 2000,
                stages: [{
                    stageNumber: 0,
                    hasDecoupler: false,
                    parts: [],
                    extra: 'property'
                }]
            });
            const result = deserializeBlueprint(dataWithExtraStageProps);
            expect(result).not.toBeNull();
            expect((result?.stages[0] as any).extra).toBeUndefined();
        });
    });
});
