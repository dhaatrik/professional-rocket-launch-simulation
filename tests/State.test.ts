import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    store,
    state,
    currentWindVelocity,
    currentDensityMultiplier,
    setWindVelocity,
    setDensityMultiplier,
    resetState,
    updateDimensions,
    addEntity,
    removeEntity,
    setAudioEngine,
    setMissionLog,
    setAssetLoader,
    addParticle,
    clearParticles
} from '../src/core/State';
import { IVessel, IParticle, IAudioEngine, IMissionLog, IAssetLoader } from '../src/types';

describe('Global State Container (Legacy)', () => {
    beforeEach(() => {
        // Reset the store to default state to ensure clean tests
        store.dispatch({ type: 'RESET' });
        // Reset local state manually since it's an exported mutable object
        state.particles = [];
        state.audio = null;
        state.missionLog = null;
        state.assets = undefined;
    });

    it('should initialize with correct default values and sync with store', () => {
        expect(state.groundY).toBe(1000);
        expect(state.width).toBe(1920);
        expect(state.height).toBe(1080);
        expect(state.entities).toEqual([]);
        expect(state.autopilotEnabled).toBe(false);
        expect(state.timeScale).toBe(1.0);
        expect(state.paused).toBe(false);
        expect(state.missionTime).toBe(0);
        expect(state.liftoff).toBe(false);
        expect(state.stageNumber).toBe(0);
        expect(state.activeVesselId).toBeNull();
        expect(currentWindVelocity).toEqual({ x: 0, y: 0 });
        expect(currentDensityMultiplier).toBe(1.0);
    });

    describe('Action Dispatchers (Legacy Setters)', () => {
        it('setWindVelocity should update store and sync to currentWindVelocity', () => {
            const newWind = { x: 10, y: -5 };
            setWindVelocity(newWind);
            expect(store.getState().windVelocity).toEqual(newWind);
            // Verify sync
            expect(currentWindVelocity).toEqual(newWind);
        });

        it('setDensityMultiplier should update store and sync to currentDensityMultiplier', () => {
            setDensityMultiplier(0.5);
            expect(store.getState().atmosphericDensityMultiplier).toBe(0.5);
            expect(currentDensityMultiplier).toBe(0.5);
        });

        it('setDensityMultiplier should dispatch correct action to store', () => {
            const dispatchSpy = vi.spyOn(store, 'dispatch');
            const multiplier = 0.75;
            setDensityMultiplier(multiplier);
            expect(dispatchSpy).toHaveBeenCalledWith({
                type: 'SET_DENSITY_MULTIPLIER',
                multiplier: multiplier
            });
            dispatchSpy.mockRestore();
        });

        it('resetState should dispatch RESET and clear particles', () => {
            state.particles = [{ x: 0, y: 0 } as IParticle];

            // Dispatch some state change to test reset
            store.dispatch({ type: 'LIFTOFF' });

            resetState();

            expect(store.getState().liftoff).toBe(false);
            expect(state.liftoff).toBe(false);
            expect(state.particles).toEqual([]);
        });

        it('updateDimensions should update dimensions in store and sync', () => {
            updateDimensions(800, 600, 100);
            expect(store.getState().width).toBe(800);
            expect(store.getState().height).toBe(600);
            expect(store.getState().groundY).toBe(100);

            expect(state.width).toBe(800);
            expect(state.height).toBe(600);
            expect(state.groundY).toBe(100);
        });

        it('addEntity and removeEntity should update entities in store and sync', () => {
            const mockVessel = { id: 'v1' } as IVessel;

            addEntity(mockVessel);
            expect(store.getState().entities).toContain(mockVessel);
            expect(state.entities).toContain(mockVessel);

            removeEntity(mockVessel);
            expect(store.getState().entities).not.toContain(mockVessel);
            expect(state.entities).not.toContain(mockVessel);
        });
    });

    describe('Service Setters (Non-Store)', () => {
        it('setAudioEngine should update local state audio', () => {
            const mockAudio = {} as IAudioEngine;
            setAudioEngine(mockAudio);
            expect(state.audio).toBe(mockAudio);
        });

        it('setMissionLog should update local state missionLog', () => {
            const mockLog = {} as IMissionLog;
            setMissionLog(mockLog);
            expect(state.missionLog).toBe(mockLog);
        });

        it('setAssetLoader should update local state assets', () => {
            const mockLoader = {} as IAssetLoader;
            setAssetLoader(mockLoader);
            expect(state.assets).toBe(mockLoader);
        });

        it('addParticle should append particle to local state', () => {
            const particle1 = { x: 1, y: 1 } as IParticle;
            const particle2 = { x: 2, y: 2 } as IParticle;

            addParticle(particle1);
            addParticle(particle2);

            expect(state.particles).toHaveLength(2);
            expect(state.particles[0]).toBe(particle1);
            expect(state.particles[1]).toBe(particle2);
        });

        it('clearParticles should empty the particles array in local state', () => {
            state.particles = [{ x: 1, y: 1 } as IParticle];
            clearParticles();
            expect(state.particles).toEqual([]);
        });
    });
});
