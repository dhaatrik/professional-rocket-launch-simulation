/**
 * Physics Memory Layout
 *
 * Defines the structure of the SharedArrayBuffer used for
 * zero-copy communication between the Physics Worker and Main Thread.
 */

// Configuration
export const MAX_ENTITIES = 1000;
export const ENTITY_STRIDE = 32; // Floats per entity
export const HEADER_SIZE = 16; // Floats reserved for header

// Total buffer size (in Float64 components)
export const BUFFER_SIZE = HEADER_SIZE + MAX_ENTITIES * ENTITY_STRIDE;
// Total bytes = BUFFER_SIZE * 8 bytes/float

// Header Indices
export enum HeaderOffset {
    TIMESTAMP = 0, // Current mission time
    ENTITY_COUNT = 1, // Number of active entities
    FRAME_ID = 2, // Incrementing frame counter
    WIND_X = 3, // Environmental wind X
    WIND_Y = 4, // Environmental wind Y
    DENSITY_MULT = 5 // Air density multiplier
}

// Entity Data Offsets (relative to entity start)
export enum EntityOffset {
    TYPE = 0, // EntityType enum
    X = 1, // Position X
    Y = 2, // Position Y
    VX = 3, // Velocity X
    VY = 4, // Velocity Y
    ANGLE = 5, // Angle (radians)
    THROTTLE = 6, // Throttle (0-1)
    GIMBAL = 7, // Gimbal angle
    FUEL = 8, // Fuel (0-1)
    ACTIVE = 9, // Active state (0 or 1)
    ENGINE_STATE = 10, // EngineState enum
    IGNITERS = 11, // Igniters remaining
    WIDTH = 12, // Width (pixels)
    HEIGHT = 13, // Height (pixels)
    CRASHED = 14, // Crashed state (0 or 1)
    SKIN_TEMP = 15, // Skin temperature (K)
    HEAT_SHIELD = 16, // Heatshield remaining (0-1)
    ABLATING = 17, // Is ablating (0 or 1)
    FAIRING_DEP = 18, // Fairings deployed (0 or 1)
    MASS = 19, // Current Mass (kg)
    APOGEE = 20, // Apogee (m)
    ID = 21, // Unique ID (numeric part)
    AOA = 22, // Angle of Attack (radians)
    STABILITY_MARGIN = 23, // Stability margin (0-1)
    IS_AERO_STABLE = 24 // Aerodynamically stable (0 or 1)
}

// Entity Types
export enum EntityType {
    UNKNOWN = 0,
    FULLSTACK = 1,
    BOOSTER = 2,
    UPPER_STAGE = 3,
    FAIRING = 4,
    PAYLOAD = 5,
    DEBRIS = 6
}

// Engine States
export enum EngineStateCode {
    OFF = 0,
    STARTING = 1,
    RUNNING = 2,
    FLAMEOUT = 3
}

/**
 * Get the buffer index for a specific entity and property
 */
export function getEntityOffset(index: number, property: EntityOffset): number {
    return HEADER_SIZE + index * ENTITY_STRIDE + property;
}
