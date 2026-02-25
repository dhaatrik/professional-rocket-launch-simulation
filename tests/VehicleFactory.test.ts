import { describe, it, expect } from 'vitest';
import { createVehicleSpec, VehicleSpec, StageProperties } from '../src/vab/VehicleFactory';
import { VehicleBlueprint, VehicleStage } from '../src/vab/VehicleBlueprint';
import { RocketPart, PartInstance } from '../src/vab/PartsCatalog';

// Mock Parts
const MOCK_ENGINE: RocketPart = {
    id: 'mock-engine',
    name: 'Mock Engine',
    category: 'engine',
    mass: 500,
    height: 30,
    width: 20,
    cost: 1000,
    description: 'A mock engine',
    thrust: 100000,
    ispVac: 300,
    ispSL: 250,
    gimbalRange: 0.1,
    throttleable: true,
    restarts: 3
};

const MOCK_TANK: RocketPart = {
    id: 'mock-tank',
    name: 'Mock Tank',
    category: 'tank',
    mass: 200,
    height: 40,
    width: 25,
    cost: 500,
    description: 'A mock tank',
    fuelCapacity: 1000
};

const MOCK_AVIONICS: RocketPart = {
    id: 'mock-avionics',
    name: 'Mock Avionics',
    category: 'avionics',
    mass: 50,
    height: 10,
    width: 25,
    cost: 200,
    description: 'Mock avionics',
    sasCapable: true
};

const MOCK_FAIRING: RocketPart = {
    id: 'mock-fairing',
    name: 'Mock Fairing',
    category: 'fairing',
    mass: 100,
    height: 50,
    width: 30,
    cost: 300,
    description: 'Mock fairing'
};

const MOCK_WIDE_PART: RocketPart = {
    id: 'mock-wide',
    name: 'Mock Wide Part',
    category: 'tank',
    mass: 100,
    height: 10,
    width: 100, // Very wide
    cost: 100,
    description: 'A wide part'
};

// Helper to create a part instance
function createInstance(part: RocketPart, stageIndex: number): PartInstance {
    return {
        part,
        instanceId: `${part.id}-${Math.random()}`,
        stageIndex
    };
}

// Helper to create a blueprint
function createMockBlueprint(stages: VehicleStage[]): VehicleBlueprint {
    return {
        name: 'Test Vehicle',
        id: 'test-blueprint',
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        stages
    };
}

describe('VehicleFactory', () => {
    describe('createVehicleSpec', () => {
        it('should handle an empty blueprint', () => {
            const blueprint = createMockBlueprint([]);
            const spec = createVehicleSpec(blueprint);

            expect(spec.name).toBe('Test Vehicle');
            expect(spec.stages).toHaveLength(0);
            expect(spec.totalHeight).toBe(0);
            expect(spec.width).toBe(40); // Default width
        });

        it('should calculate properties for a single stage', () => {
            const stage0: VehicleStage = {
                stageNumber: 0,
                hasDecoupler: false,
                parts: [
                    createInstance(MOCK_ENGINE, 0),
                    createInstance(MOCK_TANK, 0)
                ]
            };
            const blueprint = createMockBlueprint([stage0]);
            const spec = createVehicleSpec(blueprint);

            expect(spec.stages).toHaveLength(1);
            const stageProps = spec.stages[0];

            expect(stageProps.dryMass).toBe(MOCK_ENGINE.mass + MOCK_TANK.mass);
            expect(stageProps.fuelCapacity).toBe(MOCK_TANK.fuelCapacity);
            expect(stageProps.thrust).toBe(MOCK_ENGINE.thrust);
            expect(stageProps.ispVac).toBe(MOCK_ENGINE.ispVac);
            expect(stageProps.ispSL).toBe(MOCK_ENGINE.ispSL);
            expect(stageProps.height).toBe(MOCK_ENGINE.height + MOCK_TANK.height);
            expect(stageProps.parts).toHaveLength(2);
        });

        it('should handle multi-stage vehicles', () => {
            const stage0: VehicleStage = {
                stageNumber: 0,
                hasDecoupler: false,
                parts: [createInstance(MOCK_ENGINE, 0)]
            };
            const stage1: VehicleStage = {
                stageNumber: 1,
                hasDecoupler: true, // Should add decoupler mass/height
                parts: [createInstance(MOCK_AVIONICS, 1)]
            };
            const blueprint = createMockBlueprint([stage0, stage1]);
            const spec = createVehicleSpec(blueprint);

            expect(spec.stages).toHaveLength(2);

            // Stage 0 (Bottom)
            expect(spec.stages[0].dryMass).toBe(MOCK_ENGINE.mass);
            expect(spec.stages[0].height).toBe(MOCK_ENGINE.height);

            // Stage 1 (Top)
            // Decoupler adds 50kg mass and 5px height (hardcoded in VehicleFactory)
            const decouplerMass = 50;
            const decouplerHeight = 5;
            expect(spec.stages[1].dryMass).toBe(MOCK_AVIONICS.mass + decouplerMass);
            expect(spec.stages[1].height).toBe(MOCK_AVIONICS.height + decouplerHeight);
            expect(spec.stages[1].hasSAS).toBe(true);
        });

        it('should calculate average ISP for multiple engines', () => {
            const engine1 = { ...MOCK_ENGINE, ispVac: 300, ispSL: 200, thrust: 1000 };
            const engine2 = { ...MOCK_ENGINE, ispVac: 400, ispSL: 300, thrust: 2000 };

            const stage0: VehicleStage = {
                stageNumber: 0,
                hasDecoupler: false,
                parts: [
                    createInstance(engine1, 0),
                    createInstance(engine2, 0)
                ]
            };
            const blueprint = createMockBlueprint([stage0]);
            const spec = createVehicleSpec(blueprint);

            const stageProps = spec.stages[0];
            expect(stageProps.thrust).toBe(3000);
            expect(stageProps.ispVac).toBe(350); // (300 + 400) / 2
            expect(stageProps.ispSL).toBe(250);  // (200 + 300) / 2
        });

        it('should determine max width correctly', () => {
            const stage0: VehicleStage = {
                stageNumber: 0,
                hasDecoupler: false,
                parts: [createInstance(MOCK_TANK, 0)] // Width 25
            };
            const stage1: VehicleStage = {
                stageNumber: 1,
                hasDecoupler: false,
                parts: [createInstance(MOCK_WIDE_PART, 1)] // Width 100
            };
            const blueprint = createMockBlueprint([stage0, stage1]);
            const spec = createVehicleSpec(blueprint);

            expect(spec.width).toBe(100);
        });

        it('should correctly identify special capabilities (SAS, Fairing)', () => {
            const stage0: VehicleStage = {
                stageNumber: 0,
                hasDecoupler: false,
                parts: [
                    createInstance(MOCK_AVIONICS, 0),
                    createInstance(MOCK_FAIRING, 0)
                ]
            };
            const blueprint = createMockBlueprint([stage0]);
            const spec = createVehicleSpec(blueprint);

            expect(spec.stages[0].hasSAS).toBe(true);
            expect(spec.stages[0].hasFairing).toBe(true);
        });

        it('should handle zero thrust stages correctly', () => {
             const stage0: VehicleStage = {
                stageNumber: 0,
                hasDecoupler: false,
                parts: [createInstance(MOCK_TANK, 0)]
            };
            const blueprint = createMockBlueprint([stage0]);
            const spec = createVehicleSpec(blueprint);

            const stageProps = spec.stages[0];
            expect(stageProps.thrust).toBe(0);
            expect(stageProps.ispVac).toBe(0);
            expect(stageProps.ispSL).toBe(0);
        });

        it('should calculate total height correctly', () => {
             const stage0: VehicleStage = {
                stageNumber: 0,
                hasDecoupler: false,
                parts: [createInstance(MOCK_TANK, 0)] // Height 40
            };
            const stage1: VehicleStage = {
                stageNumber: 1,
                hasDecoupler: true, // Height 5
                parts: [createInstance(MOCK_AVIONICS, 1)] // Height 10
            };

            const blueprint = createMockBlueprint([stage0, stage1]);
            const spec = createVehicleSpec(blueprint);

            // Stage 0: 40
            // Stage 1: 10 + 5 = 15
            // Total: 55
            expect(spec.totalHeight).toBe(55);
        });
    });
});
