/**
 * Global State Container
 *
 * Legacy compatibility layer for global state access.
 * Now backed by SimulationStore for strict state management.
 */

import { GameState, IVessel, IParticle, IAudioEngine, IMissionLog, IAssetLoader, Vector2D, vec2 } from '../types';
import { SimulationStore } from './SimulationStore';

// Initialize the store
export const store = new SimulationStore();

/**
 * Global simulation state
 * Kept in sync with store for backward compatibility.
 * Consumers should treat this as read-only and use actions/setters to modify.
 */
export const state: GameState = {
    // Synced from Store
    groundY: 1000,
    width: 1920,
    height: 1080,
    entities: [],
    autopilotEnabled: false,
    timeScale: 1.0,
    paused: false,
    missionTime: 0,
    liftoff: false,
    stageNumber: 0,
    activeVesselId: null,

    // Local / Non-synced (Services & FX)
    particles: [],
    audio: null,
    missionLog: null,
    assets: undefined

    // Store properties not originally in GameState but present in Store State
    // (We only map what GameState interface defines)
    // GameState defined in types.ts must be compatible.
    // ... we rely on interface matching.
};

/**
 * Current wind velocity - updated by store subscription
 */
export let currentWindVelocity: Vector2D = vec2(0, 0);
export let currentDensityMultiplier: number = 1.0;

// Sync state with store
store.subscribe(() => {
    const s = store.getState();

    // Sync simulation properties
    state.width = s.width;
    state.height = s.height;
    state.groundY = s.groundY;
    state.entities = s.entities;
    state.autopilotEnabled = s.autopilotEnabled;
    state.timeScale = s.timeScale;
    state.paused = s.paused;
    state.missionTime = s.missionTime;
    state.liftoff = s.liftoff;
    state.stageNumber = s.stageNumber;
    state.activeVesselId = s.activeVesselId;

    // Sync individual exports
    currentWindVelocity = s.windVelocity;
    currentDensityMultiplier = s.atmosphericDensityMultiplier;

    // Note: particles, audio, missionLog remain local
});

// ============================================================================
// Action Dispatchers (Legacy Setters)
// ============================================================================

export function setWindVelocity(wind: Vector2D): void {
    store.dispatch({ type: 'SET_WIND', velocity: wind });
}

export function setDensityMultiplier(mult: number): void {
    store.dispatch({ type: 'SET_DENSITY_MULTIPLIER', multiplier: mult });
}

export function resetState(): void {
    store.dispatch({ type: 'RESET' });
    // Clear local particles
    state.particles = [];
}

export function updateDimensions(width: number, height: number, groundY: number): void {
    store.dispatch({ type: 'SET_DIMENSIONS', width, height, groundY });
}

export function addEntity(entity: IVessel): void {
    store.dispatch({ type: 'ADD_ENTITY', entity });
}

export function removeEntity(entity: IVessel): void {
    store.dispatch({ type: 'REMOVE_ENTITY', entity });
}

// ============================================================================
// Service Setters (Non-Store)
// ============================================================================

export function setAudioEngine(audio: IAudioEngine): void {
    state.audio = audio;
}

export function setMissionLog(log: IMissionLog): void {
    state.missionLog = log;
}

export function setAssetLoader(loader: IAssetLoader): void {
    state.assets = loader;
}

export function addParticle(particle: IParticle): void {
    state.particles.push(particle);
}

export function clearParticles(): void {
    state.particles = [];
}
