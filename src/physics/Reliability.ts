/**
 * Component Reliability & Failure Modes System
 *
 * Implements probabilistic failure logic using "Bathtub Curve" reliability engineering principles.
 */

import { state } from '../core/State';
import { secureRandom } from '../utils/Security';

export type FailureType =
    | 'ENGINE_FLAME_OUT' // Engine shuts down unexpectedly
    | 'ENGINE_EXPLOSION' // Catastrophic engine failure
    | 'STRUCTURAL_FATIGUE' // Airframe failure due to stress
    | 'SENSOR_GLITCH' // Transient telemetry noise
    | 'GIMBAL_LOCK'; // TVC stuck in one position

export interface FailureMode {
    type: FailureType;
    severity: 'warn' | 'critical';
    label: string;
}

export interface ReliabilityConfig {
    mtbfEngine: number; // Mean Time Between Failures (seconds)
    mtbfStructure: number; // Mean Time Between Failures (seconds)
    mtbfElectronics: number; // Mean Time Between Failures (seconds)
    ignitionReliability: number; // 0-1 probability of successful start (1.0 = 100%)
    wearFactor: number; // Multiplier for wear-out phase (e.g. 2.0 = 2x faster wear)
    sensorGlitchDuration?: number; // Duration of sensor glitches in seconds (default: 5.0)
}

export const DEFAULT_RELIABILITY_CONFIG: ReliabilityConfig = {
    mtbfEngine: 1000, // On average fails every 1000s (~16 mins)
    mtbfStructure: 5000, // Very reliable structure
    mtbfElectronics: 200, // Occasional sensor glitches (more frequent for visibility)
    ignitionReliability: 0.99, // 1% chance of ignition failure
    wearFactor: 1.0,
    sensorGlitchDuration: 5.0
};

export class ReliabilitySystem {
    public config: ReliabilityConfig;
    private age: number = 0; // Time since activation (seconds)
    private stressAccumulator: number = 0; // Integrated G-force stress

    // Active failures
    public activeFailures: FailureType[] = [];

    // Internal reuse buffer for new failures
    private _newFailures: FailureType[] = [];

    // Track duration of transient failures (time remaining in seconds)
    private transientFailures: Map<FailureType, number> = new Map();

    constructor(config: ReliabilityConfig = DEFAULT_RELIABILITY_CONFIG) {
        this.config = config;
    }

    /**
     * Check for ignition failure
     * @returns true if ignition failed
     */
    attemptIgnition(): boolean {
        // Simple distinct check for ignition
        if (secureRandom() > this.config.ignitionReliability) {
            this.triggerFailure('ENGINE_FLAME_OUT');
            return false; // Failed to ignite
        }
        return true; // Success
    }

    /**
     * Update reliability state
     * @param dt Time step (seconds)
     * @param stressLevel Normalized stress/load factor (0-1, or >1 for overstress)
     * @returns Array of new failures that occurred this frame
     */
    update(dt: number, stressLevel: number = 1.0): FailureType[] {
        this.age += dt;

        // Reset reusable buffer
        this._newFailures.length = 0;

        // Accumulate fatigue (stress * time)
        // High-G maneuvers increase fatigue faster
        if (stressLevel > 1.2) {
            this.stressAccumulator += (stressLevel - 1.0) * dt;
        }

        const newFailures = this._newFailures;

        // 1. Engine Reliability (Bathtub Curve)
        // Hazard function h(t) = lambda
        // P(fail) = 1 - e^(-lambda * dt) approx lambda * dt

        // Wear-out phase: Failure rate increases with age
        const engineWearMultiplier = 1 + (this.age / 300) * this.config.wearFactor;

        // Base failure probability per second
        const lambdaEngine = 1 / this.config.mtbfEngine;

        // Probability of failure in this time step
        const pEngineFail = lambdaEngine * engineWearMultiplier * dt * (stressLevel > 0 ? 1 : 0); // Only checking active engines logic outside

        // We only roll for engine failure if we passed in a positive stress level (implying engine usage)
        if (stressLevel > 0.1 && secureRandom() < pEngineFail) {
            if (secureRandom() < 0.05) {
                // 5% chance of explosion if engine fails
                if (this.triggerFailure('ENGINE_EXPLOSION')) newFailures.push('ENGINE_EXPLOSION');
            } else {
                if (this.triggerFailure('ENGINE_FLAME_OUT')) newFailures.push('ENGINE_FLAME_OUT');
            }
        }

        // 2. Structural Fatigue
        // Failure probability scales with accumulated stress
        const fatigueLimit = 100; // Arbitrary fatigue unit limit
        // Probability increases as we approach limit
        const pStructFail = (this.stressAccumulator / fatigueLimit) * dt * 0.01;

        if (secureRandom() < pStructFail) {
            if (this.triggerFailure('STRUCTURAL_FATIGUE')) newFailures.push('STRUCTURAL_FATIGUE');
        }

        // 3. Sensor/Electronics Reliability (Random constant rate)
        const pSensorFail = (1 / this.config.mtbfElectronics) * dt;
        if (secureRandom() < pSensorFail) {
            // Sensors glitches are transient, so we handle them with duration tracking
            if (this.triggerFailure('SENSOR_GLITCH')) newFailures.push('SENSOR_GLITCH');
        }

        // Update transient failures (decrement duration)
        for (const [type, duration] of this.transientFailures.entries()) {
            const newDuration = duration - dt;
            if (newDuration <= 0) {
                this.transientFailures.delete(type);

                // Remove from active failures list
                const index = this.activeFailures.indexOf(type);
                if (index > -1) {
                    this.activeFailures.splice(index, 1);
                }
            } else {
                this.transientFailures.set(type, newDuration);
            }
        }

        return newFailures;
    }

    public triggerFailure(type: FailureType): boolean {
        // Handle transient failures (currently only SENSOR_GLITCH)
        if (type === 'SENSOR_GLITCH') {
            // Reset/Extend duration
            const duration = this.config.sensorGlitchDuration ?? 5.0;
            this.transientFailures.set(type, duration);

            // If already active, don't re-log or re-add
            if (this.activeFailures.includes(type)) {
                return false;
            }
        } else {
            // Prevent duplicate permanent failures
            if (this.activeFailures.includes(type)) {
                return false;
            }
        }

        this.activeFailures.push(type);

        // Log it
        if (state.missionLog) {
            let msg = '';
            let severity: 'info' | 'warn' | 'success' = 'warn';

            switch (type) {
                case 'ENGINE_FLAME_OUT':
                    msg = 'ALERT: Engine Flameout Detected!';
                    break;
                case 'ENGINE_EXPLOSION':
                    msg = 'CRITICAL: Catastrophic Engine Failure!';
                    break;
                case 'STRUCTURAL_FATIGUE':
                    msg = 'CRITICAL: Structural Integrity Failed!';
                    break;
                case 'SENSOR_GLITCH':
                    msg = 'WARN: Telemetry Sensor Glitch';
                    severity = 'info';
                    break;
                case 'GIMBAL_LOCK':
                    msg = 'WARN: TVC Actuator Stuck';
                    break;
            }
            if (msg) state.missionLog.log(msg, severity);
        }
        return true;
    }
}
