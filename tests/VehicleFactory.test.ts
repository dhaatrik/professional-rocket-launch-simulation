import { describe, it, expect } from 'vitest';
import { getInitialVesselState, getStageSeparationData, VehicleSpec, StageProperties } from '../src/vab/VehicleFactory';

describe('VehicleFactory', () => {
    describe('getInitialVesselState', () => {
        it('should return default values when spec has no stages', () => {
            const spec: VehicleSpec = {
                name: 'Empty',
                stages: [],
                totalHeight: 0,
                width: 0
            };
            const state = getInitialVesselState(spec);
            expect(state).toEqual({
                mass: 1000,
                fuel: 0,
                maxFuel: 0,
                thrust: 0,
                ispVac: 300,
                ispSL: 250,
                gimbalRange: 0.1,
                height: 100,
                width: 40
            });
        });

        it('should correctly calculate state for a single stage vehicle', () => {
            const stage: StageProperties = {
                dryMass: 1000,
                fuelCapacity: 5000,
                thrust: 100000,
                ispVac: 300,
                ispSL: 280,
                gimbalRange: 0.1,
                throttleable: true,
                restarts: 1,
                height: 20,
                hasSAS: true,
                hasFairing: false,
                parts: []
            };
            const spec: VehicleSpec = {
                name: 'Single Stage',
                stages: [stage],
                totalHeight: 20,
                width: 3
            };
            const state = getInitialVesselState(spec);
            expect(state).toEqual({
                mass: 6000,
                fuel: 5000,
                maxFuel: 5000,
                thrust: 100000,
                ispVac: 300,
                ispSL: 280,
                gimbalRange: 0.1,
                height: 20,
                width: 3
            });
        });

        it('should correctly aggregate mass and fuel for a multi-stage vehicle and use stage 0 for thrust', () => {
            const stage0: StageProperties = {
                dryMass: 2000,
                fuelCapacity: 10000,
                thrust: 200000,
                ispVac: 290,
                ispSL: 270,
                gimbalRange: 0.1,
                throttleable: true,
                restarts: 1,
                height: 30,
                hasSAS: true,
                hasFairing: false,
                parts: []
            };
            const stage1: StageProperties = {
                dryMass: 1000,
                fuelCapacity: 4000,
                thrust: 50000,
                ispVac: 340,
                ispSL: 200,
                gimbalRange: 0.05,
                throttleable: true,
                restarts: 3,
                height: 10,
                hasSAS: true,
                hasFairing: true,
                parts: []
            };
            const spec: VehicleSpec = {
                name: 'Multi Stage',
                stages: [stage0, stage1],
                totalHeight: 40,
                width: 3
            };
            const state = getInitialVesselState(spec);
            expect(state).toEqual({
                mass: 17000, // 2000 + 10000 + 1000 + 4000
                fuel: 14000, // 10000 + 4000
                maxFuel: 14000,
                thrust: 200000, // from stage 0
                ispVac: 290, // from stage 0
                ispSL: 270, // from stage 0
                gimbalRange: 0.1, // from stage 0
                height: 40, // from spec
                width: 3 // from spec
            });
        });
    });

    describe('getStageSeparationData', () => {
        const stage0: StageProperties = {
            dryMass: 2000,
            fuelCapacity: 10000,
            thrust: 200000,
            ispVac: 290,
            ispSL: 270,
            gimbalRange: 0.1,
            throttleable: true,
            restarts: 1,
            height: 30,
            hasSAS: true,
            hasFairing: false,
            parts: []
        };
        const stage1: StageProperties = {
            dryMass: 1000,
            fuelCapacity: 4000,
            thrust: 50000,
            ispVac: 340,
            ispSL: 200,
            gimbalRange: 0.05,
            throttleable: true,
            restarts: 3,
            height: 10,
            hasSAS: true,
            hasFairing: true,
            parts: []
        };
        const spec: VehicleSpec = {
            name: 'Multi Stage',
            stages: [stage0, stage1],
            totalHeight: 40,
            width: 3
        };

        it('should return zeroes and hasNextStage false if currentStage is >= stages.length - 1', () => {
            const data = getStageSeparationData(spec, 1);
            expect(data).toEqual({
                separatedMass: 0,
                separatedHeight: 0,
                nextStageThrust: 0,
                nextStageIsp: 0,
                hasNextStage: false
            });
        });

        it('should return zeroes if spec.stages[currentStage] is undefined', () => {
            // Force an undefined stage by using a sparse array
            const sparseSpec: VehicleSpec = {
                name: 'Sparse',
                stages: [undefined as any, stage1],
                totalHeight: 40,
                width: 3
            };
            const data = getStageSeparationData(sparseSpec, 0);
            expect(data).toEqual({
                separatedMass: 0,
                separatedHeight: 0,
                nextStageThrust: 0,
                nextStageIsp: 0,
                hasNextStage: false
            });
        });

        it('should return separated stats and hasNextStage false if spec.stages[currentStage + 1] is undefined', () => {
             // Create a spec where currentStage < length - 1, but next stage is undefined
             const sparseSpec: VehicleSpec = {
                 name: 'Sparse',
                 stages: [stage0, undefined as any],
                 totalHeight: 40,
                 width: 3
             };
             // Even though length is 2, and currentStage is 0, the next stage is undefined
             const data = getStageSeparationData(sparseSpec, 0);
             expect(data).toEqual({
                 separatedMass: 2000,
                 separatedHeight: 30,
                 nextStageThrust: 0,
                 nextStageIsp: 0,
                 hasNextStage: false
             });
        });

        it('should return correct separation data when normal separation occurs', () => {
            const data = getStageSeparationData(spec, 0);
            expect(data).toEqual({
                separatedMass: 2000,
                separatedHeight: 30,
                nextStageThrust: 50000,
                nextStageIsp: 340,
                hasNextStage: true
            });
        });
    });
});
