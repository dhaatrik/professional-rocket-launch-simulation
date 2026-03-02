import { describe, it, expect } from 'vitest';
import { createPartInstance, RocketPart } from '../src/vab/PartsCatalog';

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
});
