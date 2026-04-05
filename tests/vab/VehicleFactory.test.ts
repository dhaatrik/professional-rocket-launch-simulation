import { describe, it, expect } from 'vitest';
import { getStageSeparationData, VehicleSpec, StageProperties } from '../../src/vab/VehicleFactory';

describe('VehicleFactory - getStageSeparationData', () => {
    const mockStage = (overrides: Partial<StageProperties> = {}): StageProperties => ({
        dryMass: 1000,
        fuelCapacity: 2000,
        thrust: 300000,
        ispVac: 320,
        ispSL: 280,
        gimbalRange: 0.05,
        throttleable: true,
        restarts: 1,
        height: 10,
        hasSAS: false,
        hasFairing: false,
        parts: [],
        ...overrides
    });

    const spec: VehicleSpec = {
        name: 'Test Rocket',
        totalHeight: 30,
        width: 3,
        stages: [
            mockStage({ dryMass: 2000, height: 15, thrust: 500000, ispVac: 300 }), // Stage 0 (bottom)
            mockStage({ dryMass: 1000, height: 10, thrust: 100000, ispVac: 330 }), // Stage 1
            mockStage({ dryMass: 500, height: 5, thrust: 20000, ispVac: 350 })     // Stage 2 (top)
        ]
    };

    it('should return empty values when current stage is the last stage', () => {
        const result = getStageSeparationData(spec, 2);
        expect(result).toEqual({
            separatedMass: 0,
            separatedHeight: 0,
            nextStageThrust: 0,
            nextStageIsp: 0,
            hasNextStage: false
        });
    });

    it('should return empty values when current stage is past the last stage', () => {
        const result = getStageSeparationData(spec, 3);
        expect(result).toEqual({
            separatedMass: 0,
            separatedHeight: 0,
            nextStageThrust: 0,
            nextStageIsp: 0,
            hasNextStage: false
        });
    });

    it('should return empty values when current stage is undefined', () => {
        const sparseSpec: VehicleSpec = {
            name: 'Sparse Rocket',
            totalHeight: 10,
            width: 2,
            stages: []
        };
        // Explicitly set an undefined slot
        sparseSpec.stages[0] = undefined as any;
        sparseSpec.stages[1] = mockStage();

        const result = getStageSeparationData(sparseSpec, 0);
        expect(result).toEqual({
            separatedMass: 0,
            separatedHeight: 0,
            nextStageThrust: 0,
            nextStageIsp: 0,
            hasNextStage: false
        });
    });

    it('should return separation data with false hasNextStage if next stage is undefined', () => {
        const sparseSpec: VehicleSpec = {
            name: 'Sparse Rocket 2',
            totalHeight: 10,
            width: 2,
            stages: [
                mockStage({ dryMass: 1500, height: 12 }),
                undefined as any
            ]
        };

        const result = getStageSeparationData(sparseSpec, 0);
        expect(result).toEqual({
            separatedMass: 1500,
            separatedHeight: 12,
            nextStageThrust: 0,
            nextStageIsp: 0,
            hasNextStage: false
        });
    });

    it('should return correct separation data and next stage properties for valid stages', () => {
        const result0 = getStageSeparationData(spec, 0);
        expect(result0).toEqual({
            separatedMass: 2000,
            separatedHeight: 15,
            nextStageThrust: 100000,
            nextStageIsp: 330,
            hasNextStage: true
        });

        const result1 = getStageSeparationData(spec, 1);
        expect(result1).toEqual({
            separatedMass: 1000,
            separatedHeight: 10,
            nextStageThrust: 20000,
            nextStageIsp: 350,
            hasNextStage: true
        });
    });
});
