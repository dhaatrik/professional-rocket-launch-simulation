/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Vehicle Factory
 *
 * Converts VehicleBlueprint into playable ModularVessel instances.
 */

import { VehicleBlueprint, calculateStats } from './VehicleBlueprint';
import { RocketPart } from './PartsCatalog';

/**
 * Aggregated stage properties for physics simulation
 */
export interface StageProperties {
    /** Dry mass of this stage in kg */
    dryMass: number;
    /** Fuel capacity in kg */
    fuelCapacity: number;
    /** Total thrust in Newtons */
    thrust: number;
    /** Vacuum Isp (averaged if multiple engines) */
    ispVac: number;
    /** Sea-level Isp (averaged if multiple engines) */
    ispSL: number;
    /** Max gimbal range in radians */
    gimbalRange: number;
    /** Can throttle engines */
    throttleable: boolean;
    /** Max engine restarts */
    restarts: number;
    /** Height in pixels */
    height: number;
    /** Has SAS capability */
    hasSAS: boolean;
    /** Has fairing */
    hasFairing: boolean;
    /** Parts list for rendering */
    parts: RocketPart[];
}

/**
 * Complete vehicle spec for physics engine
 */
export interface VehicleSpec {
    /** Vehicle name */
    name: string;
    /** Stages from bottom (0) to top */
    stages: StageProperties[];
    /** Total height in pixels */
    totalHeight: number;
    /** Width in pixels */
    width: number;
}

/**
 * Get initial physics values for a modular vessel
 */
export function getInitialVesselState(spec: VehicleSpec): {
    mass: number;
    fuel: number;
    maxFuel: number;
    thrust: number;
    ispVac: number;
    ispSL: number;
    gimbalRange: number;
    height: number;
    width: number;
} {
    // Start with first stage active (stage 0)
    const activeStage = spec.stages[0];
    if (!activeStage) {
        return {
            mass: 1000,
            fuel: 0,
            maxFuel: 0,
            thrust: 0,
            ispVac: 300,
            ispSL: 250,
            gimbalRange: 0.1,
            height: 100,
            width: 40
        };
    }

    // Calculate total mass (all stages)
    let totalMass = 0;
    let totalFuel = 0;
    for (const stage of spec.stages) {
        totalMass += stage.dryMass + stage.fuelCapacity;
        totalFuel += stage.fuelCapacity;
    }

    return {
        mass: totalMass,
        fuel: totalFuel,
        maxFuel: totalFuel,
        thrust: activeStage.thrust,
        ispVac: activeStage.ispVac,
        ispSL: activeStage.ispSL,
        gimbalRange: activeStage.gimbalRange,
        height: spec.totalHeight,
        width: spec.width
    };
}

/**
 * Get stage separation data
 */
export function getStageSeparationData(
    spec: VehicleSpec,
    currentStage: number
): {
    separatedMass: number;
    separatedHeight: number;
    nextStageThrust: number;
    nextStageIsp: number;
    hasNextStage: boolean;
} {
    if (currentStage >= spec.stages.length - 1) {
        return {
            separatedMass: 0,
            separatedHeight: 0,
            nextStageThrust: 0,
            nextStageIsp: 0,
            hasNextStage: false
        };
    }

    const current = spec.stages[currentStage];
    if (!current) {
        return {
            separatedMass: 0,
            separatedHeight: 0,
            nextStageThrust: 0,
            nextStageIsp: 0,
            hasNextStage: false
        };
    }
    const next = spec.stages[currentStage + 1];
    if (!next) {
        return {
            separatedMass: current.dryMass,
            separatedHeight: current.height,
            nextStageThrust: 0,
            nextStageIsp: 0,
            hasNextStage: false
        };
    }

    return {
        separatedMass: current.dryMass,
        separatedHeight: current.height,
        nextStageThrust: next.thrust,
        nextStageIsp: next.ispVac,
        hasNextStage: true
    };
}
