/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
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
    let totalDeltaV = 0;

    let runningMass = 0;

    // Process stages forward (from 0 to length-1).
    // This allows single-pass calculation matching the exact m0 logic of the original reverse pass
    // without needing to pre-calculate total wetMass.
    for (let i = 0; i < blueprint.stages.length; i++) {
        const stage = blueprint.stages[i];
        if (!stage) continue;

        let stageThrust = 0;
        let stageIsp = 0;
        let stageFuel = 0;
        let stageDry = 0;
        let engineCount = 0;

        for (const inst of stage.parts) {
            const part = inst.part;
            stageDry += part.mass;
            totalHeight += part.height;
            totalCost += part.cost;

            if (part.thrust && part.ispVac) {
                stageThrust += part.thrust;
                stageIsp += part.ispVac;
                engineCount++;
            }
            if (part.fuelCapacity) {
                stageFuel += part.fuelCapacity;
            }
            if (part.sasCapable) {
                hasAvionics = true;
            }
            if (part.category === 'fairing') {
                hasFairing = true;
            }
        }

        if (stage.hasDecoupler) {
            stageDry += 50;
            totalHeight += 5;
            totalCost += 100;
        }

        dryMass += stageDry;
        fuelMass += stageFuel;

        if (engineCount > 0) {
            stageIsp /= engineCount;
        }

        const stageTotal = stageDry + stageFuel;
        runningMass += stageTotal;

        const m0 = runningMass;
        const mf = m0 - stageFuel;

        let dv = 0;
        if (stageIsp > 0 && mf > 0 && m0 > mf) {
            dv = stageIsp * G * Math.log(m0 / mf);
        }

        let twr = 0;
        if (stageThrust > 0 && m0 > 0) {
            twr = stageThrust / (m0 * G);
        }

        stageDeltaV.push(dv);
        stageTWR.push(twr);
        totalDeltaV += dv;
    }

    const wetMass = dryMass + fuelMass;

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
    FAIRING_SMALL
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
        const parsed = JSON.parse(json) as unknown;

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Invalid blueprint format: not an object');
        }

        const data = parsed as Record<string, unknown>;

        if (typeof data.name !== 'string') {
            throw new Error('Invalid blueprint format: name is not a string');
        }

        if (typeof data.id !== 'string') {
            throw new Error('Invalid blueprint format: id is not a string');
        }

        if (typeof data.createdAt !== 'number') {
            throw new Error('Invalid blueprint format: createdAt is not a number');
        }

        if (typeof data.modifiedAt !== 'number') {
            throw new Error('Invalid blueprint format: modifiedAt is not a number');
        }

        if (!Array.isArray(data.stages)) {
            throw new Error('Invalid blueprint format: stages is not an array');
        }

        // Reconstruct part instances from IDs
        const stages: VehicleStage[] = data.stages.map((rawStage: unknown) => {
            if (!rawStage || typeof rawStage !== 'object' || Array.isArray(rawStage)) {
                throw new Error('Invalid stage format: not an object');
            }

            const stage = rawStage as Record<string, unknown>;

            if (typeof stage.stageNumber !== 'number') {
                throw new Error('Invalid stage format: stageNumber is not a number');
            }

            if (typeof stage.hasDecoupler !== 'boolean') {
                throw new Error('Invalid stage format: hasDecoupler is not a boolean');
            }

            if (!Array.isArray(stage.parts)) {
                throw new Error('Invalid stage format: parts is not an array');
            }

            return {
                stageNumber: stage.stageNumber,
                hasDecoupler: stage.hasDecoupler,
                parts: stage.parts.map((rawInst: unknown) => {
                    if (!rawInst || typeof rawInst !== 'object' || Array.isArray(rawInst)) {
                        throw new Error('Invalid part instance format: not an object');
                    }

                    const inst = rawInst as Record<string, unknown>;

                    if (typeof inst.partId !== 'string') {
                        throw new Error('Invalid part instance format: partId is not a string');
                    }
                    if (typeof inst.instanceId !== 'string') {
                        throw new Error('Invalid part instance format: instanceId is not a string');
                    }
                    if (typeof inst.stageIndex !== 'number') {
                        throw new Error('Invalid part instance format: stageIndex is not a number');
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
            name: data.name,
            id: data.id,
            createdAt: data.createdAt,
            modifiedAt: data.modifiedAt,
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
    try {
        const data = blueprints.map(serializeBlueprint);
        localStorage.setItem('vab-blueprints', JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save blueprints:', e);
    }
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
        throw new Error(`Failed to load blueprints: ${e instanceof Error ? e.message : String(e)}`);
    }
}
