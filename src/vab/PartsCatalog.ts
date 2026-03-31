/**
 * Parts Catalog
 *
 * Defines all available rocket parts for the modular VAB.
 * Each part has physical properties, cost, and category.
 */

// ============================================================================
// Part Type Definitions
// ============================================================================

export type PartCategory = 'engine' | 'tank' | 'avionics' | 'fairing' | 'decoupler' | 'srb';

export interface RocketPart {
    id: string;
    name: string;
    category: PartCategory;
    mass: number; // Dry mass in kg
    height: number; // Height in pixels for rendering
    width: number; // Width in pixels for rendering
    cost: number; // Credits
    description: string;

    // Engine-specific properties
    thrust?: number; // Max thrust in Newtons
    ispVac?: number; // Specific impulse in vacuum (seconds)
    ispSL?: number; // Specific impulse at sea level (seconds)
    gimbalRange?: number; // Gimbal range in radians
    throttleable?: boolean; // Can throttle (SRBs cannot)
    restarts?: number; // Max restart count

    // Tank-specific properties
    fuelCapacity?: number; // Fuel capacity in kg

    // Avionics-specific properties
    sasCapable?: boolean; // Has reaction wheel for SAS
    rcsThrust?: number; // RCS thrust in Newtons

    // SRB-specific properties
    burnTime?: number; // Burn time in seconds (for SRBs)
}

export interface PartInstance {
    part: RocketPart;
    instanceId: string; // Unique instance ID
    stageIndex: number; // Which stage this belongs to
}

// ============================================================================
// Engine Parts
// ============================================================================

export const ENGINE_MERLIN_1D: RocketPart = {
    id: 'engine-merlin-1d',
    name: 'Merlin 1D',
    category: 'engine',
    mass: 470,
    height: 25,
    width: 30,
    cost: 1000,
    description: 'High-thrust kerolox engine, sea-level optimized',
    thrust: 845000,
    ispVac: 311,
    ispSL: 282,
    gimbalRange: 0.087, // 5 degrees
    throttleable: true,
    restarts: 3
};

export const ENGINE_MERLIN_VAC: RocketPart = {
    id: 'engine-merlin-vac',
    name: 'Merlin 1D Vacuum',
    category: 'engine',
    mass: 500,
    height: 30,
    width: 35,
    cost: 1200,
    description: 'Vacuum-optimized variant with extended nozzle',
    thrust: 934000,
    ispVac: 348,
    ispSL: 100, // Poor at sea level
    gimbalRange: 0.087,
    throttleable: true,
    restarts: 4
};

export const ENGINE_RAPTOR: RocketPart = {
    id: 'engine-raptor',
    name: 'Raptor 2',
    category: 'engine',
    mass: 1600,
    height: 35,
    width: 40,
    cost: 2500,
    description: 'Full-flow staged combustion methalox engine',
    thrust: 2300000,
    ispVac: 380,
    ispSL: 350,
    gimbalRange: 0.105, // 6 degrees
    throttleable: true,
    restarts: 10
};

export const ENGINE_RL10: RocketPart = {
    id: 'engine-rl10',
    name: 'RL-10',
    category: 'engine',
    mass: 190,
    height: 20,
    width: 25,
    cost: 1500,
    description: 'Efficient hydrolox upper stage engine',
    thrust: 110000,
    ispVac: 465,
    ispSL: 50,
    gimbalRange: 0.07, // 4 degrees
    throttleable: true,
    restarts: 15
};

// ============================================================================
// Tank Parts
// ============================================================================

export const TANK_SMALL: RocketPart = {
    id: 'tank-small',
    name: 'Small Fuel Tank',
    category: 'tank',
    mass: 500,
    height: 30,
    width: 40,
    cost: 200,
    description: '5 tons propellant capacity',
    fuelCapacity: 5000
};

export const TANK_MEDIUM: RocketPart = {
    id: 'tank-medium',
    name: 'Medium Fuel Tank',
    category: 'tank',
    mass: 1500,
    height: 50,
    width: 40,
    cost: 500,
    description: '15 tons propellant capacity',
    fuelCapacity: 15000
};

export const TANK_LARGE: RocketPart = {
    id: 'tank-large',
    name: 'Large Fuel Tank',
    category: 'tank',
    mass: 3000,
    height: 70,
    width: 40,
    cost: 800,
    description: '30 tons propellant capacity',
    fuelCapacity: 30000
};

export const TANK_JUMBO: RocketPart = {
    id: 'tank-jumbo',
    name: 'Jumbo Fuel Tank',
    category: 'tank',
    mass: 5000,
    height: 100,
    width: 40,
    cost: 1200,
    description: '50 tons propellant capacity',
    fuelCapacity: 50000
};

// ============================================================================
// Avionics Parts
// ============================================================================

export const AVIONICS_BASIC: RocketPart = {
    id: 'avionics-basic',
    name: 'Basic Avionics',
    category: 'avionics',
    mass: 100,
    height: 10,
    width: 40,
    cost: 300,
    description: 'Guidance computer with SAS',
    sasCapable: true
};

export const AVIONICS_ADVANCED: RocketPart = {
    id: 'avionics-advanced',
    name: 'Advanced Avionics',
    category: 'avionics',
    mass: 150,
    height: 12,
    width: 40,
    cost: 600,
    description: 'Enhanced guidance with RCS capability',
    sasCapable: true,
    rcsThrust: 1000
};

// ============================================================================
// Structural Parts
// ============================================================================

export const FAIRING_SMALL: RocketPart = {
    id: 'fairing-small',
    name: 'Payload Fairing (S)',
    category: 'fairing',
    mass: 200,
    height: 40,
    width: 40,
    cost: 150,
    description: 'Protects payload during ascent'
};

export const FAIRING_LARGE: RocketPart = {
    id: 'fairing-large',
    name: 'Payload Fairing (L)',
    category: 'fairing',
    mass: 400,
    height: 60,
    width: 50,
    cost: 250,
    description: 'Large payload fairing'
};

export const DECOUPLER: RocketPart = {
    id: 'decoupler',
    name: 'Stage Decoupler',
    category: 'decoupler',
    mass: 50,
    height: 5,
    width: 40,
    cost: 100,
    description: 'Separates stages with pyrotechnic bolts'
};

// ============================================================================
// Solid Rocket Boosters
// ============================================================================

export const SRB_SMALL: RocketPart = {
    id: 'srb-small',
    name: 'Small SRB',
    category: 'srb',
    mass: 2000,
    height: 60,
    width: 20,
    cost: 400,
    description: 'Small solid rocket booster',
    thrust: 500000,
    ispVac: 250,
    ispSL: 235,
    throttleable: false,
    fuelCapacity: 4000,
    burnTime: 30
};

export const SRB_LARGE: RocketPart = {
    id: 'srb-large',
    name: 'Large SRB',
    category: 'srb',
    mass: 8000,
    height: 120,
    width: 30,
    cost: 800,
    description: 'Large solid rocket booster',
    thrust: 1500000,
    ispVac: 268,
    ispSL: 250,
    throttleable: false,
    fuelCapacity: 15000,
    burnTime: 60
};

// ============================================================================
// Parts Catalog
// ============================================================================

export const PARTS_CATALOG: RocketPart[] = [
    // Engines
    ENGINE_MERLIN_1D,
    ENGINE_MERLIN_VAC,
    ENGINE_RAPTOR,
    ENGINE_RL10,
    // Tanks
    TANK_SMALL,
    TANK_MEDIUM,
    TANK_LARGE,
    TANK_JUMBO,
    // Avionics
    AVIONICS_BASIC,
    AVIONICS_ADVANCED,
    // Structural
    FAIRING_SMALL,
    FAIRING_LARGE,
    DECOUPLER,
    // SRBs
    SRB_SMALL,
    SRB_LARGE
];

export const PARTS_MAP = new Map<string, RocketPart>();
for (const part of PARTS_CATALOG) {
    PARTS_MAP.set(part.id, part);
}

/**
 * Get a part by ID
 */
export function getPartById(id: string): RocketPart | undefined {
    return PARTS_MAP.get(id);
}

/**
 * Get all parts in a category
 */
export function getPartsByCategory(category: PartCategory): RocketPart[] {
    return PARTS_CATALOG.filter((p) => p.category === category);
}

/**
 * Create a new part instance
 */
let instanceCounter = 0;
export function createPartInstance(part: RocketPart, stageIndex: number = 0): PartInstance {
    return {
        part,
        instanceId: `${part.id}-${++instanceCounter}`,
        stageIndex
    };
}
