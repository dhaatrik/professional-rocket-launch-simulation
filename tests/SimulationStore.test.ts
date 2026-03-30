import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimulationStore } from '../src/core/SimulationStore';
import { IVessel } from '../src/types';

describe('SimulationStore', () => {
    let store: SimulationStore;

    beforeEach(() => {
        store = new SimulationStore();
    });

    it('should initialize with correct default values', () => {
        const state = store.getState();
        expect(state.width).toBe(1920);
        expect(state.height).toBe(1080);
        expect(state.groundY).toBe(1000);
        expect(state.entities).toEqual([]);
        expect(state.activeVesselId).toBeNull();
        expect(state.missionTime).toBe(0);
        expect(state.liftoff).toBe(false);
        expect(state.stageNumber).toBe(0);
        expect(state.windVelocity).toEqual({ x: 0, y: 0 });
        expect(state.atmosphericDensityMultiplier).toBe(1.0);
        expect(state.paused).toBe(false);
        expect(state.timeScale).toBe(1.0);
        expect(state.autopilotEnabled).toBe(false);
    });

    describe('dispatch', () => {
        it('SET_DIMENSIONS should update dimensions', () => {
            store.dispatch({ type: 'SET_DIMENSIONS', width: 800, height: 600, groundY: 500 });
            const state = store.getState();
            expect(state.width).toBe(800);
            expect(state.height).toBe(600);
            expect(state.groundY).toBe(500);
        });

        it('ADD_ENTITY should add a vessel', () => {
            const mockVessel = { id: 'v1' } as IVessel;
            store.dispatch({ type: 'ADD_ENTITY', entity: mockVessel });
            expect(store.getState().entities).toContain(mockVessel);
        });

        it('REMOVE_ENTITY should remove a vessel', () => {
            const mockVessel = { id: 'v1' } as IVessel;
            store.dispatch({ type: 'ADD_ENTITY', entity: mockVessel });
            store.dispatch({ type: 'REMOVE_ENTITY', entity: mockVessel });
            expect(store.getState().entities).not.toContain(mockVessel);
        });

        it('SET_ACTIVE_VESSEL should update activeVesselId', () => {
            store.dispatch({ type: 'SET_ACTIVE_VESSEL', id: 'v1' });
            expect(store.getState().activeVesselId).toBe('v1');
        });

        it('UPDATE_PHYSICS should update missionTime', () => {
            store.dispatch({ type: 'UPDATE_PHYSICS', time: 123.45, entities: [] });
            expect(store.getState().missionTime).toBe(123.45);
        });

        it('SET_WIND should update windVelocity', () => {
            store.dispatch({ type: 'SET_WIND', velocity: { x: 5, y: -2 } });
            expect(store.getState().windVelocity).toEqual({ x: 5, y: -2 });
        });

        it('SET_DENSITY_MULTIPLIER should update atmosphericDensityMultiplier', () => {
            store.dispatch({ type: 'SET_DENSITY_MULTIPLIER', multiplier: 0.5 });
            expect(store.getState().atmosphericDensityMultiplier).toBe(0.5);
        });

        it('SET_AUTOPILOT should update autopilotEnabled', () => {
            store.dispatch({ type: 'SET_AUTOPILOT', enabled: true });
            expect(store.getState().autopilotEnabled).toBe(true);
        });

        it('SET_PAUSED should update paused', () => {
            store.dispatch({ type: 'SET_PAUSED', paused: true });
            expect(store.getState().paused).toBe(true);
        });

        it('SET_TIME_SCALE should update timeScale', () => {
            store.dispatch({ type: 'SET_TIME_SCALE', scale: 2.0 });
            expect(store.getState().timeScale).toBe(2.0);
        });

        it('LIFTOFF should set liftoff to true', () => {
            store.dispatch({ type: 'LIFTOFF' });
            expect(store.getState().liftoff).toBe(true);
        });

        it('STAGE_SEPARATION should increment stageNumber', () => {
            store.dispatch({ type: 'STAGE_SEPARATION' });
            expect(store.getState().stageNumber).toBe(1);
            store.dispatch({ type: 'STAGE_SEPARATION' });
            expect(store.getState().stageNumber).toBe(2);
        });

        it('RESET should reset state but preserve dimensions', () => {
            store.dispatch({ type: 'SET_DIMENSIONS', width: 800, height: 600, groundY: 500 });
            store.dispatch({ type: 'LIFTOFF' });
            store.dispatch({ type: 'STAGE_SEPARATION' });

            store.dispatch({ type: 'RESET' });

            const state = store.getState();
            expect(state.width).toBe(800);
            expect(state.height).toBe(600);
            expect(state.groundY).toBe(500);
            expect(state.liftoff).toBe(false);
            expect(state.stageNumber).toBe(0);
        });
    });

    describe('Subscription', () => {
        it('should notify listeners on dispatch', () => {
            const listener = vi.fn();
            store.subscribe(listener);

            store.dispatch({ type: 'LIFTOFF' });
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should return an unsubscribe function', () => {
            const listener = vi.fn();
            const unsubscribe = store.subscribe(listener);

            unsubscribe();
            store.dispatch({ type: 'LIFTOFF' });
            expect(listener).not.toHaveBeenCalled();
        });
    });
});
