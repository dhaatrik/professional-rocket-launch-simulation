import { describe, it, expect } from 'vitest';
import {
    PARTS_CATALOG,
    getPartById,
    getPartsByCategory,
    createPartInstance,
    RocketPart,
    PartCategory
} from '../src/vab/PartsCatalog';

describe('PartsCatalog', () => {

    describe('PARTS_CATALOG', () => {
        it('should have unique IDs for all parts', () => {
            const ids = PARTS_CATALOG.map(p => p.id);
            const uniqueIds = new Set(ids);
            expect(ids.length).toBe(uniqueIds.size);
        });

        it('should have basic required properties for all parts', () => {
            for (const part of PARTS_CATALOG) {
                expect(part.id).toBeDefined();
                expect(typeof part.id).toBe('string');
                expect(part.name).toBeDefined();
                expect(typeof part.name).toBe('string');
                expect(part.category).toBeDefined();
                expect(typeof part.mass).toBe('number');
                expect(typeof part.height).toBe('number');
                expect(typeof part.width).toBe('number');
                expect(typeof part.cost).toBe('number');
                expect(typeof part.description).toBe('string');
            }
        });
    });

    describe('getPartById', () => {
        it('should return the correct part for a valid ID', () => {
            // Test with a known engine ID
            const part = getPartById('engine-merlin-1d');
            expect(part).toBeDefined();
            expect(part?.id).toBe('engine-merlin-1d');
            expect(part?.name).toBe('Merlin 1D');
            expect(part?.category).toBe('engine');
        });

        it('should return undefined for an invalid ID', () => {
            const part = getPartById('invalid-part-id');
            expect(part).toBeUndefined();
        });
    });

    describe('getPartsByCategory', () => {
        it('should return correct parts for each category', () => {
            const categories: PartCategory[] = ['engine', 'tank', 'avionics', 'fairing', 'decoupler', 'srb'];

            for (const category of categories) {
                const parts = getPartsByCategory(category);
                expect(parts.length).toBeGreaterThan(0); // Assuming at least one part per category
                for (const part of parts) {
                    expect(part.category).toBe(category);
                }
            }
        });

        it('should return an empty array for an unknown category', () => {
            // @ts-expect-error Testing invalid category cast
            const parts = getPartsByCategory('unknown-category' as PartCategory);
            expect(parts).toEqual([]);
        });
    });

    describe('createPartInstance', () => {
        const mockPart: RocketPart = {
            id: 'mock-part',
            name: 'Mock Part',
            category: 'tank',
            mass: 100,
            height: 10,
            width: 10,
            cost: 100,
            description: 'A mock part'
        };

        it('should return a valid PartInstance with the correct stageIndex', () => {
            const stageIndex = 2;
            const instance = createPartInstance(mockPart, stageIndex);

            expect(instance.part).toEqual(mockPart);
            expect(instance.stageIndex).toBe(stageIndex);
            expect(typeof instance.instanceId).toBe('string');
            expect(instance.instanceId).toContain('mock-part-');
        });

        it('should use default stageIndex 0 if not provided', () => {
            const instance = createPartInstance(mockPart);

            expect(instance.part).toEqual(mockPart);
            expect(instance.stageIndex).toBe(0);
        });

        it('should increment the instance counter for unique IDs', () => {
            const instance1 = createPartInstance(mockPart);
            const instance2 = createPartInstance(mockPart);

            expect(instance1.instanceId).not.toBe(instance2.instanceId);

            // Extract the counter numbers
            const num1 = parseInt(instance1.instanceId.split('-').pop() || '0');
            const num2 = parseInt(instance2.instanceId.split('-').pop() || '0');

            expect(num2).toBeGreaterThan(num1);
        });
    });

});
