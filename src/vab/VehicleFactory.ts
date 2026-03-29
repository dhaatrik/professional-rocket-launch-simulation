/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Vehicle Factory
 *
 * Converts VehicleBlueprint into playable ModularVessel instances.
 */

import { VehicleBlueprint, VehicleStage, calculateStats } from './VehicleBlueprint';
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
 * Calculate aggregated properties for a single stage
 */
function calculateStageProperties(stage: VehicleStage): StageProperties {
    let dryMass = 0;
    let fuelCapacity = 0;
    let thrust = 0;
    let ispVacSum = 0;
    let ispSLSum = 0;
    let gimbalRange = 0;
    let throttleable = true;
    let restarts = 0;
    let height = 0;
    let hasSAS = false;
    let hasFairing = false;
    let engineCount = 0;
    const parts: RocketPart[] = [];

    for (const inst of stage.parts) {
        const part = inst.part;
        parts.push(part);

        dryMass += part.mass;
        height += part.height;

        if (part.fuelCapacity) {
            fuelCapacity += part.fuelCapacity;
        }

        if (part.thrust) {
            thrust += part.thrust;
            ispVacSum += part.ispVac || 0;
            ispSLSum += part.ispSL || 0;
            gimbalRange = Math.max(gimbalRange, part.gimbalRange || 0);
            if (part.throttleable === false) throttleable = false;
            restarts = Math.max(restarts, part.restarts || 0);
            engineCount++;
        }

        if (part.sasCapable) hasSAS = true;
        if (part.category === 'fairing') hasFairing = true;
    }

    // Add decoupler mass if present
    if (stage.hasDecoupler) {
        dryMass += 50;
        height += 5;
    }

    // Average Isp across engines
    const ispVac = engineCount > 0 ? ispVacSum / engineCount : 0;
    const ispSL = engineCount > 0 ? ispSLSum / engineCount : 0;

    return {
        dryMass,
        fuelCapacity,
        thrust,
        ispVac,
        ispSL,
        gimbalRange,
        throttleable,
        restarts,
        height,
        hasSAS,
        hasFairing,
        parts
    };
}

/**
 * Convert a VehicleBlueprint to a VehicleSpec for physics
 */
export function createVehicleSpec(blueprint: VehicleBlueprint): VehicleSpec {
    const stages = blueprint.stages.map(calculateStageProperties);
    const totalHeight = stages.reduce((sum, s) => sum + s.height, 0);

    // Use max width from any part
    let width = 40; // default
    for (const stage of blueprint.stages) {
        for (const inst of stage.parts) {
            width = Math.max(width, inst.part.width);
        }
    }

    return {
        name: blueprint.name,
        stages,
        totalHeight,
        width
    };
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
