import { describe, it, expect } from 'vitest';
import {
    createPartInstance,
    RocketPart,
    getPartById,
    getPartsByCategory,
    PARTS_CATALOG
} from '../src/vab/PartsCatalog';

describe('PartsCatalog', () => {
    describe('createPartInstance', () => {
        const mockPart: RocketPart = {
            id: 'mock-part-id',
            name: 'Mock Part',
            category: 'engine',
            mass: 100,
            height: 10,
            width: 10,
            cost: 50,
            description: 'A mock part for testing',
        };

        it('should correctly create an instance object', () => {
            const instance = createPartInstance(mockPart);
            expect(instance).toBeDefined();
            expect(instance.part).toBe(mockPart);
            expect(typeof instance.instanceId).toBe('string');
            expect(instance.instanceId).toMatch(/^mock-part-id-\d+$/);
        });

        it('should increment the instanceId counter for each call', () => {
            const instance1 = createPartInstance(mockPart);
            const instance2 = createPartInstance(mockPart);
            const instance3 = createPartInstance(mockPart);

            const id1 = parseInt(instance1.instanceId.split('-').pop() || '0');
            const id2 = parseInt(instance2.instanceId.split('-').pop() || '0');
            const id3 = parseInt(instance3.instanceId.split('-').pop() || '0');

            expect(id2).toBe(id1 + 1);
            expect(id3).toBe(id2 + 1);
        });

        it('should set the stageIndex appropriately', () => {
            const instance = createPartInstance(mockPart, 3);
            expect(instance.stageIndex).toBe(3);
        });

        it('should fallback to 0 for stageIndex if not provided', () => {
            const instance = createPartInstance(mockPart);
            expect(instance.stageIndex).toBe(0);
        });

        it('should retain the properties of the original part', () => {
            const instance = createPartInstance(mockPart);
            expect(instance.part.id).toBe('mock-part-id');
            expect(instance.part.name).toBe('Mock Part');
            expect(instance.part.mass).toBe(100);
        });
    });

    describe('getPartById', () => {
        it('should return the correct part for a valid ID', () => {
            const part = getPartById('engine-merlin-1d');
            expect(part).toBeDefined();
            expect(part?.id).toBe('engine-merlin-1d');
            expect(part?.name).toBe('Merlin 1D');
        });

        it('should return undefined for a non-existent ID', () => {
            const part = getPartById('non-existent-part');
            expect(part).toBeUndefined();
        });

        it('should find all parts from the PARTS_CATALOG in the map', () => {
            for (const part of PARTS_CATALOG) {
                const found = getPartById(part.id);
                expect(found).toBeDefined();
                expect(found).toBe(part);
            }
        });
    });

    describe('getPartsByCategory', () => {
        it('should return parts for a valid category', () => {
            const engines = getPartsByCategory('engine');
            expect(engines.length).toBeGreaterThan(0);
            expect(engines.every(p => p.category === 'engine')).toBe(true);
        });

        it('should return an empty array for an unknown category', () => {
            // @ts-expect-error - Testing invalid category input
            const parts = getPartsByCategory('invalid-category');
            expect(parts).toEqual([]);
        });

        it('should contain all parts from the catalog in their respective categories', () => {
            const categories = new Set(PARTS_CATALOG.map(p => p.category));
            for (const cat of categories) {
                const partsInCategory = getPartsByCategory(cat);
                const expectedParts = PARTS_CATALOG.filter(p => p.category === cat);
                expect(partsInCategory.length).toBe(expectedParts.length);
                for (const p of expectedParts) {
                    expect(partsInCategory).toContain(p);
                }
            }
        });
    });
});
