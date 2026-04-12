/**
 * Realistic Propulsion Physics
 *
 * Models engine constraints including:
 * - Ullage simulation (fuel settling requirement)
 * - Spool-up/down times (turbo-machinery lag)
 * - Restart limits (igniter cartridges)
 * - Engine state machine
 */

import { EngineStateCode } from '../core/PhysicsBuffer';

// ============================================================================
// Types
// ============================================================================

/** Engine operational states */
export type EngineState = EngineStateCode;

/**
 * Propulsion system configuration
 */
export interface PropulsionConfig {
    /** Time to reach full thrust from ignition (seconds) */
    spoolUpTime: number;

    /** Time to shutdown from running (seconds) */
    spoolDownTime: number;

    /** Number of igniter cartridges (TEA/TEB) */
    igniterCount: number;

    /** Minimum acceleration for fuel settling (m/s²) */
    minUllageAccel: number;

    /** Time of thrust needed to settle fuel (seconds) */
    ullageSettleTime: number;

    /** Whether this component has an engine */
    hasEngine: boolean;
}

/**
 * Current propulsion system state
 */
export interface PropulsionState {
    /** Current engine state */
    engineState: EngineState;

    /** Actual throttle output (lagged behind commanded) */
    actualThrottle: number;

    /** User commanded throttle */
    commandedThrottle: number;

    /** Remaining igniter cartridges */
    ignitersRemaining: number;

    /** Whether fuel is settled (ullage satisfied) */
    ullageSettled: boolean;

    /** Time fuel has been settling (seconds) */
    ullageTimer: number;

    /** Spool-up progress during startup (0-1) */
    spoolProgress: number;

    /** Total burn time for this engine */
    totalBurnTime: number;

    /** Last ignition attempt result */
    lastIgnitionResult: 'none' | 'success' | 'no_ullage' | 'no_igniters' | 'no_fuel';
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Full Stack propulsion config (Merlin-like first stage)
 */
export const FULLSTACK_PROP_CONFIG: PropulsionConfig = {
    spoolUpTime: 2.0,
    spoolDownTime: 0.5,
    igniterCount: 3,
    minUllageAccel: 0.1,
    ullageSettleTime: 0.5,
    hasEngine: true
};

/**
 * Booster propulsion config (landing capable)
 */
export const BOOSTER_PROP_CONFIG: PropulsionConfig = {
    spoolUpTime: 1.5,
    spoolDownTime: 0.3,
    igniterCount: 5, // Multiple landing burns
    minUllageAccel: 0.1,
    ullageSettleTime: 0.3,
    hasEngine: true
};

/**
 * Upper Stage propulsion config (vacuum Merlin)
 */
export const UPPER_STAGE_PROP_CONFIG: PropulsionConfig = {
    spoolUpTime: 3.0, // Slower vacuum engine
    spoolDownTime: 1.0,
    igniterCount: 4,
    minUllageAccel: 0.05, // Lower requirement in space
    ullageSettleTime: 1.0,
    hasEngine: true
};

/**
 * Payload propulsion config (no engine)
 */
export const PAYLOAD_PROP_CONFIG: PropulsionConfig = {
    spoolUpTime: 0,
    spoolDownTime: 0,
    igniterCount: 0,
    minUllageAccel: 0,
    ullageSettleTime: 0,
    hasEngine: false
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Create initial propulsion state
 */
export function createInitialPropulsionState(config: PropulsionConfig): PropulsionState {
    return {
        engineState: EngineStateCode.OFF,
        actualThrottle: 0,
        commandedThrottle: 0,
        ignitersRemaining: config.igniterCount,
        ullageSettled: true, // Settled on ground
        ullageTimer: 0,
        spoolProgress: 0,
        totalBurnTime: 0,
        lastIgnitionResult: 'none'
    };
}

/**
 * Check if ullage requirements are satisfied
 * Fuel settles when under acceleration (gravity or thrust)
 */
export function updateUllageStatus(
    state: PropulsionState,
    config: PropulsionConfig,
    currentAcceleration: number,
    dt: number
): PropulsionState {
    const newState = { ...state };

    // If we have sufficient acceleration, fuel is settling
    if (currentAcceleration >= config.minUllageAccel) {
        newState.ullageTimer += dt;
        if (newState.ullageTimer >= config.ullageSettleTime) {
            newState.ullageSettled = true;
        }
    } else {
        // Fuel unsettles quickly in microgravity
        newState.ullageTimer = Math.max(0, newState.ullageTimer - dt * 2);
        if (newState.ullageTimer <= 0) {
            newState.ullageSettled = false;
        }
    }

    return newState;
}

/**
 * Attempt to ignite the engine
 * Returns updated state with ignition result
 */
export function attemptIgnition(state: PropulsionState, config: PropulsionConfig, hasFuel: boolean): PropulsionState {
    const newState = { ...state };

    // Already running or starting
    if (state.engineState === EngineStateCode.RUNNING || state.engineState === EngineStateCode.STARTING) {
        return newState;
    }

    // No engine
    if (!config.hasEngine) {
        newState.lastIgnitionResult = 'none';
        return newState;
    }

    // Check fuel
    if (!hasFuel) {
        newState.lastIgnitionResult = 'no_fuel';
        return newState;
    }

    // Check ullage
    if (!state.ullageSettled) {
        newState.lastIgnitionResult = 'no_ullage';
        return newState;
    }

    // Check igniters
    if (state.ignitersRemaining <= 0) {
        newState.lastIgnitionResult = 'no_igniters';
        return newState;
    }

    // Success! Start the engine
    newState.engineState = EngineStateCode.STARTING;
    newState.ignitersRemaining--;
    newState.spoolProgress = 0;
    newState.lastIgnitionResult = 'success';

    return newState;
}

/**
 * Command engine shutdown
 */
export function commandShutdown(state: PropulsionState): PropulsionState {
    const newState = { ...state };

    if (state.engineState === EngineStateCode.RUNNING) {
        newState.engineState = EngineStateCode.SHUTDOWN;
        newState.commandedThrottle = 0;
    } else if (state.engineState === EngineStateCode.STARTING) {
        // Abort startup
        newState.engineState = EngineStateCode.OFF;
        newState.spoolProgress = 0;
        newState.actualThrottle = 0;
    }

    return newState;
}

/**
 * Update propulsion state for this timestep
 * Handles spool-up/down, throttle lag, and state transitions
 */
export function updatePropulsionState(
    state: PropulsionState,
    config: PropulsionConfig,
    commandedThrottle: number,
    hasFuel: boolean,
    currentAcceleration: number,
    dt: number
): PropulsionState {
    let newState = { ...state };
    newState.commandedThrottle = commandedThrottle;

    // Update ullage status
    newState = updateUllageStatus(newState, config, currentAcceleration, dt);

    // State machine
    switch (state.engineState) {
        case EngineStateCode.OFF:
            newState.actualThrottle = 0;
            newState.spoolProgress = 0;

            // Auto-attempt ignition when throttle commanded
            if (commandedThrottle > 0) {
                newState = attemptIgnition(newState, config, hasFuel);
            }
            break;

        case EngineStateCode.STARTING: {
            // Spool up
            const spoolRate = 1 / config.spoolUpTime;
            newState.spoolProgress = Math.min(1, state.spoolProgress + spoolRate * dt);

            // Throttle ramps up with spool progress
            newState.actualThrottle = commandedThrottle * newState.spoolProgress;

            // Transition to running when spooled up
            if (newState.spoolProgress >= 1) {
                newState.engineState = EngineStateCode.RUNNING;
            }

            // Abort if throttle zeroed
            if (commandedThrottle <= 0) {
                newState = commandShutdown(newState);
            }
            break;
        }

        case EngineStateCode.RUNNING: {
            // Track burn time
            if (state.actualThrottle > 0) {
                newState.totalBurnTime += dt;
            }

            // Throttle follows command with small lag
            const throttleLag = 0.1; // 100ms response
            const throttleDelta = commandedThrottle - state.actualThrottle;
            newState.actualThrottle += throttleDelta * Math.min(1, dt / throttleLag);

            // Clamp
            newState.actualThrottle = Math.max(0, Math.min(1, newState.actualThrottle));

            // Shutdown if throttle zeroed
            if (commandedThrottle <= 0) {
                newState = commandShutdown(newState);
            }

            // Flame out if fuel exhausted
            if (!hasFuel) {
                newState.engineState = EngineStateCode.OFF;
                newState.actualThrottle = 0;
            }
            break;
        }

        case EngineStateCode.SHUTDOWN: {
            // Spool down
            const shutdownRate = 1 / config.spoolDownTime;
            newState.actualThrottle = Math.max(0, state.actualThrottle - shutdownRate * dt);

            // Transition to off when spooled down
            if (newState.actualThrottle <= 0) {
                newState.engineState = EngineStateCode.OFF;
                newState.spoolProgress = 0;
            }
            break;
        }
    }

    return newState;
}

/**
 * Get color for engine state display
 */
export function getEngineStateColor(state: PropulsionState): string {
    switch (state.engineState) {
        case EngineStateCode.OFF:
            return '#95a5a6'; // Gray
        case EngineStateCode.STARTING:
            return '#f1c40f'; // Yellow
        case EngineStateCode.RUNNING:
            return '#2ecc71'; // Green
        case EngineStateCode.SHUTDOWN:
            return '#e67e22'; // Orange
        case EngineStateCode.FLAMEOUT:
            return '#e74c3c'; // Red
        default:
            return '#ffffff';
    }
}

/**
 * Get ignition failure message
 */
export function getIgnitionFailureMessage(state: PropulsionState): string | null {
    switch (state.lastIgnitionResult) {
        case 'no_ullage':
            return 'IGNITION FAILED: Fuel not settled (need ullage thrust)';
        case 'no_igniters':
            return 'IGNITION FAILED: No igniter cartridges remaining';
        case 'no_fuel':
            return 'IGNITION FAILED: No fuel';
        default:
            return null;
    }
}
