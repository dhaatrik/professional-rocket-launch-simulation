/**
 * Vehicle Blueprint
 *
 * Data structures for user-designed rockets.
 * Blueprints can be saved/loaded and converted to playable vehicles.
 */

import { RocketPart, PartInstance, getPartById, createPartInstance } from './PartsCatalog';

// ============================================================================
// Blueprint Types
// ============================================================================

/**
 * A single stage of the vehicle
 */
export interface VehicleStage {
    /** Stage number (0 = first to fire, like a real rocket) */
    stageNumber: number;
    /** Parts in this stage (bottom to top) */
    parts: PartInstance[];
    /** Whether this stage has a decoupler at the top */
    hasDecoupler: boolean;
}

/**
 * Complete vehicle blueprint
 */
export interface VehicleBlueprint {
    /** User-assigned name */
    name: string;
    /** Unique ID for localStorage */
    id: string;
    /** Creation timestamp */
    createdAt: number;
    /** Last modified timestamp */
    modifiedAt: number;
    /** Stages from bottom (first stage) to top (payload) */
    stages: VehicleStage[];
}

/**
 * Calculated vehicle statistics
 */
export interface VehicleStats {
    /** Total dry mass in kg */
    dryMass: number;
    /** Total fuel mass in kg */
    fuelMass: number;
    /** Total wet mass (dry + fuel) in kg */
    wetMass: number;
    /** Total height in pixels */
    totalHeight: number;
    /** Total cost in credits */
    totalCost: number;
    /** Per-stage delta-V in m/s */
    stageDeltaV: number[];
    /** Total delta-V in m/s */
    totalDeltaV: number;
    /** Per-stage TWR at ignition */
    stageTWR: number[];
    /** Has avionics for control */
    hasAvionics: boolean;
    /** Has fairing for payload */
    hasFairing: boolean;
}

// ============================================================================
// Blueprint Factory
// ============================================================================

let blueprintCounter = 0;

/**
 * Create a new empty blueprint
 */
export function createBlueprint(name: string = 'New Rocket'): VehicleBlueprint {
    const now = Date.now();
    return {
        name,
        id: `blueprint-${++blueprintCounter}-${now}`,
        createdAt: now,
        modifiedAt: now,
        stages: []
    };
}

/**
 * Add a new empty stage to blueprint
 */
export function addStage(blueprint: VehicleBlueprint): VehicleBlueprint {
    const newStage: VehicleStage = {
        stageNumber: blueprint.stages.length,
        parts: [],
        hasDecoupler: blueprint.stages.length > 0 // All stages except first have decouplers
    };
    return {
        ...blueprint,
        stages: [...blueprint.stages, newStage],
        modifiedAt: Date.now()
    };
}

/**
 * Add a part to a stage
 */
export function addPartToStage(blueprint: VehicleBlueprint, stageIndex: number, part: RocketPart): VehicleBlueprint {
    const stages = [...blueprint.stages];
    const stage = stages[stageIndex];
    if (!stage) return blueprint;

    const instance = createPartInstance(part, stageIndex);
    stages[stageIndex] = {
        ...stage,
        parts: [...stage.parts, instance]
    };

    return {
        ...blueprint,
        stages,
        modifiedAt: Date.now()
    };
}

/**
 * Remove a part from a stage
 */
export function removePartFromStage(
    blueprint: VehicleBlueprint,
    stageIndex: number,
    instanceId: string
): VehicleBlueprint {
    const stages = [...blueprint.stages];
    const stage = stages[stageIndex];
    if (!stage) return blueprint;

    stages[stageIndex] = {
        ...stage,
        parts: stage.parts.filter((p) => p.instanceId !== instanceId)
    };

    return {
        ...blueprint,
        stages,
        modifiedAt: Date.now()
    };
}

/**
 * Remove a stage (and all its parts)
 */
export function removeStage(blueprint: VehicleBlueprint, stageIndex: number): VehicleBlueprint {
    if (stageIndex < 0 || stageIndex >= blueprint.stages.length) return blueprint;

    const stages = blueprint.stages
        .filter((_, i) => i !== stageIndex)
        .map((stage, i) => ({ ...stage, stageNumber: i }));

    return {
        ...blueprint,
        stages,
        modifiedAt: Date.now()
    };
}

// ============================================================================
// Statistics Calculator
// ============================================================================

const G = 9.81; // Standard gravity

/**
 * Calculate vehicle statistics from blueprint
 */
export function calculateStats(blueprint: VehicleBlueprint): VehicleStats {
    let dryMass = 0;
    let fuelMass = 0;
    let totalHeight = 0;
    let totalCost = 0;
    let hasAvionics = false;
    let hasFairing = false;

    const stageDeltaV: number[] = [];
    const stageTWR: number[] = [];

    // Calculate totals
    for (const stage of blueprint.stages) {
        for (const inst of stage.parts) {
            const part = inst.part;
            dryMass += part.mass;
            totalHeight += part.height;
            totalCost += part.cost;

            if (part.fuelCapacity) {
                fuelMass += part.fuelCapacity;
            }
            if (part.sasCapable) {
                hasAvionics = true;
            }
            if (part.category === 'fairing') {
                hasFairing = true;
            }
        }

        // Add decoupler mass
        if (stage.hasDecoupler) {
            dryMass += 50;
            totalHeight += 5;
            totalCost += 100;
        }
    }

    const wetMass = dryMass + fuelMass;

    // Calculate per-stage delta-V (Tsiolkovsky rocket equation)
    // Process stages in reverse (top to bottom for delta-V calculation)
    let remainingMass = wetMass;

    for (let i = blueprint.stages.length - 1; i >= 0; i--) {
        const stage = blueprint.stages[i];
        if (!stage) continue;

        // Get stage propulsion
        let stageThrust = 0;
        let stageIsp = 0;
        let stageFuel = 0;
        let stageDry = 0;
        let engineCount = 0;

        for (const inst of stage.parts) {
            const part = inst.part;
            stageDry += part.mass;

            if (part.thrust && part.ispVac) {
                stageThrust += part.thrust;
                stageIsp += part.ispVac;
                engineCount++;
            }
            if (part.fuelCapacity) {
                stageFuel += part.fuelCapacity;
            }
        }

        // Average Isp for multiple engines
        if (engineCount > 0) {
            stageIsp /= engineCount;
        }

        // Calculate stage delta-V
        const m0 = remainingMass;
        const mf = remainingMass - stageFuel;

        if (stageIsp > 0 && mf > 0 && m0 > mf) {
            const dv = stageIsp * G * Math.log(m0 / mf);
            stageDeltaV.unshift(dv);
        } else {
            stageDeltaV.unshift(0);
        }

        // Calculate TWR at stage ignition
        if (stageThrust > 0 && remainingMass > 0) {
            const twr = stageThrust / (remainingMass * G);
            stageTWR.unshift(twr);
        } else {
            stageTWR.unshift(0);
        }

        // Subtract this stage's mass for next iteration
        remainingMass -= stageDry + stageFuel;
        if (stage.hasDecoupler) {
            remainingMass -= 50;
        }
    }

    const totalDeltaV = stageDeltaV.reduce((sum, dv) => sum + dv, 0);

    return {
        dryMass,
        fuelMass,
        wetMass,
        totalHeight,
        totalCost,
        stageDeltaV,
        totalDeltaV,
        stageTWR,
        hasAvionics,
        hasFairing
    };
}

// ============================================================================
// Preset Blueprints
// ============================================================================

import {
    ENGINE_MERLIN_1D,
    ENGINE_MERLIN_VAC,
    TANK_LARGE,
    TANK_MEDIUM,
    AVIONICS_BASIC,
    FAIRING_SMALL,
    DECOUPLER
} from './PartsCatalog';

/**
 * Create a preset Falcon-like two-stage rocket
 */
export function createFalconPreset(): VehicleBlueprint {
    let blueprint = createBlueprint('Falcon 9');

    // Stage 0: First stage (bottom)
    blueprint = addStage(blueprint);
    blueprint = addPartToStage(blueprint, 0, ENGINE_MERLIN_1D);
    blueprint = addPartToStage(blueprint, 0, TANK_LARGE);
    blueprint = addPartToStage(blueprint, 0, TANK_LARGE);

    // Stage 1: Second stage
    blueprint = addStage(blueprint);
    blueprint = addPartToStage(blueprint, 1, ENGINE_MERLIN_VAC);
    blueprint = addPartToStage(blueprint, 1, TANK_MEDIUM);
    blueprint = addPartToStage(blueprint, 1, AVIONICS_BASIC);
    blueprint = addPartToStage(blueprint, 1, FAIRING_SMALL);

    return blueprint;
}

/**
 * Create a simple single-stage rocket
 */
export function createSimplePreset(): VehicleBlueprint {
    let blueprint = createBlueprint('Simple Rocket');

    blueprint = addStage(blueprint);
    blueprint = addPartToStage(blueprint, 0, ENGINE_MERLIN_1D);
    blueprint = addPartToStage(blueprint, 0, TANK_MEDIUM);
    blueprint = addPartToStage(blueprint, 0, AVIONICS_BASIC);

    return blueprint;
}

// ============================================================================
// Serialization for localStorage
// ============================================================================

/**
 * Serialize blueprint to JSON string
 */
export function serializeBlueprint(blueprint: VehicleBlueprint): string {
    // Convert to a format that only stores part IDs
    const serializable = {
        ...blueprint,
        stages: blueprint.stages.map((stage) => ({
            ...stage,
            parts: stage.parts.map((inst) => ({
                partId: inst.part.id,
                instanceId: inst.instanceId,
                stageIndex: inst.stageIndex
            }))
        }))
    };
    return JSON.stringify(serializable);
}

/**
 * Deserialize blueprint from JSON string
 */
export function deserializeBlueprint(json: string): VehicleBlueprint | null {
    try {
        const data = JSON.parse(json);

        if (!data || typeof data !== 'object') {
            throw new Error('Invalid blueprint format: not an object');
        }

        if (!Array.isArray(data.stages)) {
            throw new Error('Invalid blueprint format: stages is not an array');
        }

        // Reconstruct part instances from IDs
        const stages: VehicleStage[] = data.stages.map((stage: any) => {
            if (!stage || typeof stage !== 'object') {
                throw new Error('Invalid stage format: not an object');
            }

            if (!Array.isArray(stage.parts)) {
                throw new Error('Invalid stage format: parts is not an array');
            }

            return {
                ...stage,
                parts: stage.parts.map((inst: any) => {
                    if (!inst || typeof inst !== 'object') {
                        throw new Error('Invalid part instance format: not an object');
                    }
                    if (typeof inst.partId !== 'string') {
                        throw new Error('Invalid part instance format: partId is not a string');
                    }

                    const part = getPartById(inst.partId);
                    if (!part) throw new Error(`Unknown part: ${inst.partId}`);
                    return {
                        part,
                        instanceId: inst.instanceId,
                        stageIndex: inst.stageIndex
                    };
                })
            };
        });

        return {
            ...data,
            stages
        };
    } catch (e) {
        console.error('Failed to deserialize blueprint:', e);
        return null;
    }
}

/**
 * Save blueprints to localStorage
 */
export function saveBlueprints(blueprints: VehicleBlueprint[]): void {
    const data = blueprints.map(serializeBlueprint);
    localStorage.setItem('vab-blueprints', JSON.stringify(data));
}

/**
 * Load blueprints from localStorage
 */
export function loadBlueprints(): VehicleBlueprint[] {
    const data = localStorage.getItem('vab-blueprints');
    if (!data) return [];

    try {
        const jsons = JSON.parse(data) as string[];
        if (!Array.isArray(jsons)) {
            throw new Error('Stored blueprints data is not an array');
        }
        return jsons.map(deserializeBlueprint).filter((b): b is VehicleBlueprint => b !== null);
    } catch (e) {
        console.error('Failed to load blueprints:', e);
        return [];
    }
}
