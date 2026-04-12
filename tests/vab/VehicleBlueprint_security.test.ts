import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadBlueprints, saveBlueprints } from '../../src/vab/VehicleBlueprint';

describe('VehicleBlueprint Security', () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
        mockStorage = {};
        vi.stubGlobal('localStorage', {
            getItem: vi.fn((key: string) => mockStorage[key] || null),
            setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
            removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
            clear: vi.fn(() => { mockStorage = {}; })
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should throw an error when stored data contains non-string elements', () => {
        mockStorage['vab-blueprints'] = JSON.stringify(['valid_string_blueprint', { evil: 'object' }, 123]);

        expect(() => {
            loadBlueprints();
        }).toThrow('Stored blueprints data contains non-string items');
    });

    it('should successfully load valid string blueprints array', () => {
        // Need a valid blueprint JSON structure
        const validBlueprint = {
            name: 'Test Blueprint',
            id: 'test-id',
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            stages: []
        };
        mockStorage['vab-blueprints'] = JSON.stringify([JSON.stringify(validBlueprint)]);

        const blueprints = loadBlueprints();
        expect(blueprints).toHaveLength(1);
        expect(blueprints[0]?.name).toBe('Test Blueprint');
    });
});