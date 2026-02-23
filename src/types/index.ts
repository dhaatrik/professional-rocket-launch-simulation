/**
 * Core Type Definitions for Rocket Simulation
 *
 * These interfaces define the data structures used throughout the physics
 * simulation, ensuring type safety and preventing unit mixing errors.
 */

// Re-export aerodynamics types for convenience
export type { AerodynamicsConfig, AerodynamicState, AerodynamicForces } from '../physics/Aerodynamics.ts';

// Re-export TPS types for convenience
export type { TPSConfig, ThermalState } from '../physics/ThermalProtection.ts';

// Re-export propulsion types for convenience
import type { PropulsionConfig, PropulsionState, EngineState } from '../physics/Propulsion.ts';

// Re-export propulsion types for convenience
export type { PropulsionConfig, PropulsionState, EngineState };

// Re-export reliability types for convenience
import type { FailureType, FailureMode, ReliabilityConfig } from '../physics/Reliability.ts';

export type { FailureType, FailureMode, ReliabilityConfig };

// Re-export environment types for convenience
export type { WindLayer, EnvironmentConfig, EnvironmentState } from '../physics/Environment.ts';

// ============================================================================
// Vector Types
// ============================================================================

/**
 * 2D Vector for position, velocity, and force calculations
 */
export interface Vector2D {
    x: number;
    y: number;
}

/**
 * Creates a new Vector2D
 */
export function vec2(x: number, y: number): Vector2D {
    return { x, y };
}

/**
 * Vector operations
 */
export const Vec2 = {
    add: (a: Vector2D, b: Vector2D): Vector2D => ({ x: a.x + b.x, y: a.y + b.y }),
    sub: (a: Vector2D, b: Vector2D): Vector2D => ({ x: a.x - b.x, y: a.y - b.y }),
    scale: (v: Vector2D, s: number): Vector2D => ({ x: v.x * s, y: v.y * s }),
    magnitude: (v: Vector2D): number => Math.sqrt(v.x * v.x + v.y * v.y),
    normalize: (v: Vector2D): Vector2D => {
        const mag = Vec2.magnitude(v);
        return mag > 0 ? Vec2.scale(v, 1 / mag) : { x: 0, y: 0 };
    },
    dot: (a: Vector2D, b: Vector2D): number => a.x * b.x + a.y * b.y,
    angle: (v: Vector2D): number => Math.atan2(v.x, -v.y),
    fromAngle: (angle: number, magnitude: number = 1): Vector2D => ({
        x: Math.sin(angle) * magnitude,
        y: -Math.cos(angle) * magnitude
    }),
    zero: (): Vector2D => ({ x: 0, y: 0 })
};

// ============================================================================
// Physics State Types
// ============================================================================

/**
 * State dictionary for RK4 integration
 */
export interface PhysicsState {
    x: number; // Position X (meters)
    y: number; // Position Y (meters)
    vx: number; // Velocity X (m/s)
    vy: number; // Velocity Y (m/s)
    mass: number; // Mass (kg)
}

/**
 * Derivatives for RK4 integration
 */
export interface Derivatives {
    dx: number; // dPosition/dt = velocity
    dy: number;
    dvx: number; // dVelocity/dt = acceleration
    dvy: number;
    dmass: number; // dMass/dt = -fuel flow rate
}

/**
 * Orbital elements for trajectory prediction
 */
export interface OrbitalElements {
    phi: number; // Angular position (radians)
    r: number; // Radius from Earth center (meters)
    relX?: number; // Relative X coordinate for map view (meters)
    relY?: number; // Relative Y coordinate for map view (meters)
}

// ============================================================================
// Vessel Configuration
// ============================================================================

/**
 * Configuration for physics simulation constants
 */
export interface PhysicsConfig {
    MAX_THRUST_BOOSTER: number; // Newtons
    MAX_THRUST_UPPER: number; // Newtons
    MASS_BOOSTER: number; // kg (dry mass)
    MASS_UPPER: number; // kg (dry mass)
    FUEL_MASS: number; // kg
    DRAG_COEFF: number; // Dimensionless
    ISP_VAC_BOOSTER: number; // seconds (specific impulse vacuum)
    ISP_SL_BOOSTER: number; // seconds (specific impulse sea level)
    ISP_VAC_UPPER: number; // seconds
    ISP_SL_UPPER: number; // seconds
}

/**
 * Stage separation configuration
 */
export interface StageSeparation {
    type: VesselType;
    separationVelocity: number; // m/s
    offsetY: number; // pixels
}

/**
 * All possible vessel types in the simulation
 */
export type VesselType = 'FullStack' | 'Booster' | 'UpperStage' | 'Payload' | 'Fairing';

/**
 * Particle effect types
 */
export type ParticleType = 'smoke' | 'fire' | 'spark' | 'debris';

// ============================================================================
// Game State Types
// ============================================================================

/**
 * Mission event log entry
 */
export interface LogEvent {
    time: string;
    msg: string;
    type: LogEventType;
}

export type LogEventType = 'info' | 'warn' | 'success';

/**
 * Mission milestones tracking
 */
export interface MissionState {
    liftoff: boolean;
    supersonic: boolean;
    maxq: boolean;
}

/**
 * Camera modes
 */
export type CameraMode = 'ROCKET' | 'MAP';

/**
 * SAS (Stability Assist System) modes
 */
export const SASMode = {
    OFF: 'OFF',
    STABILITY: 'STABILITY',
    PROGRADE: 'PROGRADE',
    RETROGRADE: 'RETROGRADE'
} as const;

export type SASMode = (typeof SASMode)[keyof typeof SASMode];

/**
 * Input action states
 */
export interface InputActions {
    THROTTLE_UP: boolean;
    THROTTLE_DOWN: boolean;
    YAW_LEFT: boolean;
    YAW_RIGHT: boolean;
    MAP_MODE: boolean;
    TIME_WARP_UP: boolean;
    TIME_WARP_DOWN: boolean;
    CUT_ENGINE: boolean;
    SAS_TOGGLE: boolean;
}

/**
 * Joystick state for touch controls
 */
export interface JoystickState {
    active: boolean;
    x: number; // -1 to 1
    y: number; // -1 to 1
}

/**
 * Throttle touch control state
 */
export interface ThrottleTouchState {
    active: boolean;
    value: number; // 0 to 1
}

// ============================================================================
// Global State Interface
// ============================================================================

/**
 * Global game state (legacy compatibility)
 */
export interface GameState {
    groundY: number;
    width: number;
    height: number;
    entities: IVessel[];
    particles: IParticle[];
    audio: IAudioEngine | null;
    missionLog: IMissionLog | null;
    autopilotEnabled: boolean;
    assets?: IAssetLoader;

    // Simulation state
    timeScale: number;
    paused: boolean;
    missionTime: number;
    liftoff: boolean;
    stageNumber: number;
    activeVesselId: string | null;
}

// ============================================================================
// Component Interfaces (for loose coupling)
// ============================================================================

/**
 * Vessel interface for type-safe references
 */
export interface IVessel {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    gimbalAngle: number;
    mass: number;
    w: number;
    h: number;
    throttle: number;
    fuel: number;
    active: boolean;
    maxThrust: number;
    crashed: boolean;
    cd: number;
    q: number;
    apogee: number;
    health: number;
    orbitPath: OrbitalElements[] | null;
    lastOrbitUpdate: number;

    // Aerodynamic state for stability analysis
    aoa: number; // Angle of Attack (radians)
    stabilityMargin: number; // (CP - CoM) / length, positive = stable
    isAeroStable: boolean; // CP behind CoM
    liftForce: number; // Current lift force (N)
    dragForce: number; // Current drag force (N)

    // Thermal protection state
    skinTemp: number; // Skin temperature (K)
    heatShieldRemaining: number; // Heat shield fraction (0-1)
    isAblating: boolean; // Currently ablating
    isThermalCritical: boolean; // Temperature critical

    // Propulsion state
    engineState: EngineState; // Current engine state
    ignitersRemaining: number; // Remaining igniter cartridges
    ullageSettled: boolean; // Fuel settled for ignition
    actualThrottle: number; // Lagged throttle (vs commanded)

    // Interpolation state
    prevX: number;
    prevY: number;
    prevAngle: number;

    // Optimized Type Identification
    type: number;

    applyPhysics(dt: number, keys: Record<string, boolean>): void;
    spawnExhaust(timeScale: number): void;
    draw(ctx: CanvasRenderingContext2D, camY: number, alpha: number): void;
    explode(): void;
}

/**
 * Particle interface
 */
export interface IParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: ParticleType;
    typeId: number;
    life: number;
    size: number;
    decay: number;

    update(groundLevel: number, timeScale: number): void;
    draw(ctx: CanvasRenderingContext2D): void;
}

/**
 * Audio engine interface
 */
export interface IAudioEngine {
    initialized: boolean;
    muted: boolean;

    init(): void;
    setThrust(throttle: number, density: number, velocity: number): void;
    playExplosion(): void;
    playStaging(): void;
    toggleMute(): boolean;
    speak(text: string): void;
}

/**
 * Mission log interface
 */
export interface IMissionLog {
    log(message: string, type?: LogEventType): void;
    clear(): void;
}

/**
 * Asset loader interface
 */
export interface IAssetLoader {
    get(key: string): HTMLImageElement | undefined;
    loadAll(): Promise<void>;
}

/**
 * Telemetry data point
 */
export interface TelemetryDataPoint {
    t: number; // Time (seconds)
    alt: number; // Altitude (meters)
    vel: number; // Velocity (m/s)
}
