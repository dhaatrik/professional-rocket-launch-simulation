import { IVessel, Vector2D } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface GameState {
    // Dimensions
    width: number;
    height: number;
    groundY: number;

    // Entities
    entities: IVessel[];
    activeVesselId: string | null;

    // Mission State
    missionTime: number;
    liftoff: boolean;
    stageNumber: number;

    // Environment
    windVelocity: Vector2D;
    atmosphericDensityMultiplier: number;

    // System State
    paused: boolean;
    timeScale: number;
    autopilotEnabled: boolean;
}

export type Action =
    | { type: 'SET_DIMENSIONS'; width: number; height: number; groundY: number }
    | { type: 'ADD_ENTITY'; entity: IVessel }
    | { type: 'REMOVE_ENTITY'; entity: IVessel }
    | { type: 'SET_ACTIVE_VESSEL'; id: string }
    | { type: 'UPDATE_PHYSICS'; time: number; entities: IVessel[] } // Bulk update
    | { type: 'SET_WIND'; velocity: Vector2D }
    | { type: 'SET_DENSITY_MULTIPLIER'; multiplier: number }
    | { type: 'SET_AUTOPILOT'; enabled: boolean }
    | { type: 'SET_PAUSED'; paused: boolean }
    | { type: 'SET_TIME_SCALE'; scale: number }
    | { type: 'LIFTOFF' }
    | { type: 'STAGE_SEPARATION' }
    | { type: 'RESET' };

type Listener = () => void;

// ============================================================================
// Simulation Store
// ============================================================================

export class SimulationStore {
    private state: GameState;
    private listeners: (Listener | null)[] = [];

    // Initial state matching the existing global state defaults
    private static readonly INITIAL_STATE: GameState = {
        width: 1920,
        height: 1080,
        groundY: 1000,
        entities: [],
        activeVesselId: null,
        missionTime: 0,
        liftoff: false,
        stageNumber: 0,
        windVelocity: { x: 0, y: 0 },
        atmosphericDensityMultiplier: 1.0,
        paused: false,
        timeScale: 1.0,
        autopilotEnabled: false
    };

    constructor() {
        this.state = { ...SimulationStore.INITIAL_STATE };
    }

    /**
     * Component-Entity-System style retrieval
     * But for now, just basic state access to replace global object.
     */

    getState(): Readonly<GameState> {
        return this.state;
    }

    dispatch(action: Action): void {
        switch (action.type) {
            case 'SET_DIMENSIONS':
                this.state.width = action.width;
                this.state.height = action.height;
                this.state.groundY = action.groundY;
                break;
            case 'ADD_ENTITY':
                this.state.entities.push(action.entity);
                break;
            case 'REMOVE_ENTITY':
                this.state.entities = this.state.entities.filter((e) => e !== action.entity);
                break;
            case 'SET_ACTIVE_VESSEL':
                this.state.activeVesselId = action.id;
                break;
            case 'UPDATE_PHYSICS':
                this.state.missionTime = action.time;
                // Entities updated by reference usually in physics loop,
                // but if we were strictly immutable we'd replace them.
                // For performance/hybrid approach, we might just trigger listeners.
                break;
            case 'SET_WIND':
                this.state.windVelocity = action.velocity;
                break;
            case 'SET_DENSITY_MULTIPLIER':
                this.state.atmosphericDensityMultiplier = action.multiplier;
                break;
            case 'SET_AUTOPILOT':
                this.state.autopilotEnabled = action.enabled;
                break;
            case 'SET_PAUSED':
                this.state.paused = action.paused;
                break;
            case 'SET_TIME_SCALE':
                this.state.timeScale = action.scale;
                break;
            case 'LIFTOFF':
                this.state.liftoff = true;
                break;
            case 'STAGE_SEPARATION':
                this.state.stageNumber++;
                break;
            case 'RESET': {
                // Reset but keep dimensions might be desired, but strict reset goes to initial.
                const { width, height, groundY } = this.state;
                this.state = {
                    ...SimulationStore.INITIAL_STATE,
                    width,
                    height,
                    groundY // Preserve window dimensions
                };
                break;
            }
        }

        this.notify();
    }

    subscribe(listener: Listener): () => void {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                // Nullify to prevent shifting array during notify loops
                this.listeners[index] = null;
            }
        };
    }

    private notify(): void {
        let activeCount = 0;
        const len = this.listeners.length;

        for (let i = 0; i < len; i++) {
            const listener = this.listeners[i];
            if (listener) {
                listener();
                // Compaction
                if (i !== activeCount) {
                    this.listeners[activeCount] = listener;
                }
                activeCount++;
            }
        }

        // Truncate array to remove trailing nulls without allocating new array
        if (activeCount < len) {
            this.listeners.length = activeCount;
        }
    }
}
