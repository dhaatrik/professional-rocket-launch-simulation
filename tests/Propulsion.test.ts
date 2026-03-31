import { describe, it, expect } from 'vitest';
import { EngineStateCode } from '../src/core/PhysicsBuffer';
import {
    createInitialPropulsionState,
    updatePropulsionState,
    updateUllageStatus,
    attemptIgnition,
    commandShutdown,
    FULLSTACK_PROP_CONFIG,
    PAYLOAD_PROP_CONFIG,
    getEngineStateDisplay,
    getIgnitionFailureMessage,
    getEngineStateColor
} from '../src/physics/Propulsion';

describe('Propulsion System', () => {
    describe('Initialization', () => {
        it('should start with correct initial state', () => {
            const state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
            expect(state.engineState).toBe(EngineStateCode.OFF);
            expect(state.ignitersRemaining).toBe(FULLSTACK_PROP_CONFIG.igniterCount);
            expect(state.ullageSettled).toBe(true);
        });
    });

    describe('Engine Shutdown', () => {
        it('should transition from running to shutdown and set commandedThrottle to 0', () => {
            const state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
            state.engineState = EngineStateCode.RUNNING;
            state.commandedThrottle = 1.0;

            const newState = commandShutdown(state);
            expect(newState.engineState).toBe(EngineStateCode.SHUTDOWN);
            expect(newState.commandedThrottle).toBe(0);
        });

        it('should abort startup, transition from starting to off, and reset spool/throttle', () => {
            const state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
            state.engineState = EngineStateCode.STARTING;
            state.spoolProgress = 0.5;
            state.actualThrottle = 0.5;

            const newState = commandShutdown(state);
            expect(newState.engineState).toBe(EngineStateCode.OFF);
            expect(newState.spoolProgress).toBe(0);
            expect(newState.actualThrottle).toBe(0);
        });

        it('should do nothing if already off', () => {
            const state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
            state.engineState = EngineStateCode.OFF;
            state.commandedThrottle = 1.0;

            const newState = commandShutdown(state);
            expect(newState.engineState).toBe(EngineStateCode.OFF);
            expect(newState.commandedThrottle).toBe(1.0);
            expect(newState).not.toBe(state); // Ensure it returns a new object
        });

        it('should do nothing if already shutdown', () => {
            const state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
            state.engineState = EngineStateCode.SHUTDOWN;
            state.commandedThrottle = 1.0;

            const newState = commandShutdown(state);
            expect(newState.engineState).toBe(EngineStateCode.SHUTDOWN);
            expect(newState.commandedThrottle).toBe(1.0);
            expect(newState).not.toBe(state); // Ensure it returns a new object
        });
    });

    describe('Ullage Logic', () => {
        it('should unsettle immediately in freefall if timer was 0', () => {
            let state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
            state = updateUllageStatus(state, FULLSTACK_PROP_CONFIG, 0, 0.1);
            expect(state.ullageSettled).toBe(false);
        });

        it('should settle after sufficient time under acceleration', () => {
            let state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
            state.ullageSettled = false;

            for (let i = 0; i < 5; i++) {
                state = updateUllageStatus(state, FULLSTACK_PROP_CONFIG, 1.0, 0.1);
            }
            expect(state.ullageSettled).toBe(true);
        });

        it('should remain settled for a grace period in freefall', () => {
            let state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
            // Charge up the timer first
            for (let i = 0; i < 5; i++) {
                state = updateUllageStatus(state, FULLSTACK_PROP_CONFIG, 1.0, 0.1);
            }
            // Freefall
            state = updateUllageStatus(state, FULLSTACK_PROP_CONFIG, 0, 0.1);
            expect(state.ullageSettled).toBe(true);
        });
    });

    describe('Ignition Logic', () => {
        it('should not ignite without fuel', () => {
            const state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
            const result = attemptIgnition(state, FULLSTACK_PROP_CONFIG, false);
            expect(result.engineState).toBe(EngineStateCode.OFF);
            expect(result.lastIgnitionResult).toBe('no_fuel');
        });

        it('should not ignite without ullage', () => {
            const state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
            state.ullageSettled = false;
            const result = attemptIgnition(state, FULLSTACK_PROP_CONFIG, true);
            expect(result.engineState).toBe(EngineStateCode.OFF);
            expect(result.lastIgnitionResult).toBe('no_ullage');
        });

        it('should not ignite without igniters', () => {
            const state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
            state.ignitersRemaining = 0;
            const result = attemptIgnition(state, FULLSTACK_PROP_CONFIG, true);
            expect(result.engineState).toBe(EngineStateCode.OFF);
            expect(result.lastIgnitionResult).toBe('no_igniters');
        });

        it('should ignite when conditions met', () => {
            const state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
            const result = attemptIgnition(state, FULLSTACK_PROP_CONFIG, true);
            expect(result.engineState).toBe(EngineStateCode.STARTING);
            expect(result.ignitersRemaining).toBe(FULLSTACK_PROP_CONFIG.igniterCount - 1);
            expect(result.lastIgnitionResult).toBe('success');
        });
    });

    describe('State Transitions (Full Cycle)', () => {
        it('should transition through OFF -> STARTING -> RUNNING -> SHUTDOWN -> OFF', () => {
            let state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
            const dt = 0.1;

            // OFF -> STARTING
            state = updatePropulsionState(state, FULLSTACK_PROP_CONFIG, 1.0, true, 1.0, dt);
            expect(state.engineState).toBe(EngineStateCode.STARTING);

            // STARTING -> RUNNING
            // Fast forward spool up
            for (let i = 0; i < 30; i++) {
                state = updatePropulsionState(state, FULLSTACK_PROP_CONFIG, 1.0, true, 1.0, dt);
                if (state.engineState === EngineStateCode.RUNNING) break;
            }
            expect(state.engineState).toBe(EngineStateCode.RUNNING);
            expect(state.actualThrottle).toBeGreaterThan(0.9);

            // RUNNING -> SHUTDOWN
            state = updatePropulsionState(state, FULLSTACK_PROP_CONFIG, 0, true, 1.0, dt);
            expect(state.engineState).toBe(EngineStateCode.SHUTDOWN);

            // SHUTDOWN -> OFF
            for (let i = 0; i < 10; i++) {
                state = updatePropulsionState(state, FULLSTACK_PROP_CONFIG, 0, true, 1.0, dt);
                if (state.engineState === EngineStateCode.OFF) break;
            }
            expect(state.engineState).toBe(EngineStateCode.OFF);
            expect(state.actualThrottle).toBe(0);
        });
    });

    describe('Display Helpers', () => {
        it('should return correct display strings and colors', () => {
            const state = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);

            state.engineState = EngineStateCode.RUNNING;
            expect(getEngineStateDisplay(state)).toBe('RUNNING');
            expect(getEngineStateColor(state)).toBe('#2ecc71');

            state.engineState = EngineStateCode.SHUTDOWN;
            expect(getEngineStateColor(state)).toBe('#e67e22');

            state.engineState = EngineStateCode.STARTING;
            expect(getEngineStateColor(state)).toBe('#f1c40f');
        });

        it('should handle payload configuration', () => {
            const state = createInitialPropulsionState(PAYLOAD_PROP_CONFIG);
            expect(state.engineState).toBe(EngineStateCode.OFF);
            const result = attemptIgnition(state, PAYLOAD_PROP_CONFIG, true);
            expect(result.engineState).toBe(EngineStateCode.OFF);
        });
    });
});
