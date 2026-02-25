/**
 * Flight Termination System (FTS)
 *
 * Independent safety system that monitors rocket trajectory and provides
 * both automatic and manual destruct capability for Range Safety.
 *
 * FTS States: SAFE → WARNING → ARM → DESTRUCT
 */

import { IVessel } from '../types';
import { PIXELS_PER_METER } from '../config/Constants';
import { state } from '../core/State';

// ============================================================================
// Types
// ============================================================================

export type FTSState = 'SAFE' | 'WARNING' | 'ARM' | 'DESTRUCT';

export type FTSViolation = 'CORRIDOR_BREACH' | 'TRAJECTORY_DEVIATION' | 'TUMBLE' | 'NONE';

export interface FTSConfig {
    /** Max lateral deviation from launch site (meters) */
    corridorWidthM: number;
    /** Max allowed altitude (meters) */
    corridorMaxAltM: number;
    /** Max flight path angle deviation from nominal (degrees) */
    maxDeviationAngleDeg: number;
    /** Max angular rate before tumble detection (degrees/second) */
    maxTumbleRateDeg: number;
    /** Duration of WARNING state before auto-ARM (seconds) */
    warningDurationS: number;
    /** Duration of ARM state before auto-DESTRUCT (seconds) */
    armDurationS: number;
    /** Whether auto-destruct is enabled */
    autoDestructEnabled: boolean;
    /** Corridor warning threshold (fraction of corridor width to start warning) */
    warningThreshold: number;
}

export interface FTSStatus {
    state: FTSState;
    armed: boolean;
    violation: FTSViolation;
    violationMessage: string;
    warningTimer: number;
    armTimer: number;
    corridorFraction: number; // 0-1, how close to corridor edge
}

// ============================================================================
// Defaults
// ============================================================================

export const DEFAULT_FTS_CONFIG: FTSConfig = {
    corridorWidthM: 50000, // 50km lateral corridor
    corridorMaxAltM: 500000, // 500km max altitude
    maxDeviationAngleDeg: 45, // 45° max deviation
    maxTumbleRateDeg: 90, // 90°/s tumble threshold
    warningDurationS: 3.0, // 3s warning before ARM
    armDurationS: 3.0, // 3s ARM before auto-destruct
    autoDestructEnabled: true,
    warningThreshold: 0.75 // Warning at 75% of corridor
};

// ============================================================================
// Flight Termination System
// ============================================================================

export class FlightTerminationSystem {
    public config: FTSConfig;
    private _state: FTSState = 'SAFE';
    private _armed: boolean = false;
    private _violation: FTSViolation = 'NONE';
    private _violationMessage: string = '';
    private _warningTimer: number = 0;
    private _armTimer: number = 0;
    private _corridorFraction: number = 0;
    private _lastAngle: number = 0;
    private _angularRate: number = 0;
    private _launchX: number = 0;
    private _destructTriggered: boolean = false;

    constructor(config: FTSConfig = DEFAULT_FTS_CONFIG) {
        this.config = config;
    }

    /** Get current FTS status snapshot */
    getStatus(): FTSStatus {
        return {
            state: this._state,
            armed: this._armed,
            violation: this._violation,
            violationMessage: this._violationMessage,
            warningTimer: this._warningTimer,
            armTimer: this._armTimer,
            corridorFraction: this._corridorFraction
        };
    }

    /**
     * Update an existing FTSStatus object in place to avoid allocation
     */
    writeStatus(out: FTSStatus): void {
        out.state = this._state;
        out.armed = this._armed;
        out.violation = this._violation;
        out.violationMessage = this._violationMessage;
        out.warningTimer = this._warningTimer;
        out.armTimer = this._armTimer;
        out.corridorFraction = this._corridorFraction;
    }

    /** Set launch site X position for corridor calculations */
    setLaunchPosition(x: number): void {
        this._launchX = x;
    }

    /** Arm the FTS (required before manual destruct) */
    arm(): void {
        if (this._state !== 'DESTRUCT') {
            this._armed = true;
            if (state.missionLog) {
                state.missionLog.log('FTS: SYSTEM ARMED', 'warn');
            }
        }
    }

    /** Disarm the FTS */
    disarm(): void {
        if (this._state === 'SAFE' || this._state === 'WARNING') {
            this._armed = false;
            if (state.missionLog) {
                state.missionLog.log('FTS: SYSTEM DISARMED', 'info');
            }
        }
    }

    /** Toggle arm state */
    toggleArm(): void {
        if (this._armed) {
            this.disarm();
        } else {
            this.arm();
        }
    }

    /** Manual destruct command from RSO */
    triggerManualDestruct(vessel: IVessel): boolean {
        if (!this._armed) {
            if (state.missionLog) {
                state.missionLog.log('FTS: DESTRUCT DENIED — System not armed', 'warn');
            }
            return false;
        }

        this._state = 'DESTRUCT';
        this._violation = 'NONE';
        this._violationMessage = 'MANUAL DESTRUCT BY RSO';
        this._destructTriggered = true;

        if (state.missionLog) {
            state.missionLog.log('FTS: ████ MANUAL DESTRUCT ████', 'warn');
        }

        vessel.explode();
        return true;
    }

    /** Update FTS state — call every physics tick */
    update(vessel: IVessel, groundY: number, dt: number): void {
        if (this._destructTriggered || vessel.crashed) return;

        // Calculate vessel metrics
        const alt = (groundY - vessel.y - vessel.h) / PIXELS_PER_METER;
        const lateralDistance = Math.abs(vessel.x - this._launchX) / PIXELS_PER_METER;

        // Angular rate detection
        const angleDeg = vessel.angle * (180 / Math.PI);
        this._angularRate = Math.abs(angleDeg - this._lastAngle) / dt;
        this._lastAngle = angleDeg;

        // Flight path angle
        const vel = Math.sqrt(vessel.vx * vessel.vx + vessel.vy * vessel.vy);
        const flightPathAngle = vel > 1 ? Math.atan2(vessel.vx, -vessel.vy) * (180 / Math.PI) : 0;

        // Corridor fraction (0 = center, 1 = edge)
        this._corridorFraction = Math.max(
            lateralDistance / this.config.corridorWidthM,
            alt / this.config.corridorMaxAltM
        );

        // Only check violations if above ground
        if (alt < 10) {
            this._state = 'SAFE';
            this._violation = 'NONE';
            this._violationMessage = '';
            this._warningTimer = 0;
            this._armTimer = 0;
            return;
        }

        // Check violations in priority order
        let currentViolation: FTSViolation = 'NONE';
        let violationMsg = '';

        // 1. Tumble detection (highest priority)
        if (this._angularRate > this.config.maxTumbleRateDeg) {
            currentViolation = 'TUMBLE';
            violationMsg = `TUMBLE: ${this._angularRate.toFixed(0)}°/s > ${this.config.maxTumbleRateDeg}°/s limit`;
        }

        // 2. Corridor breach
        if (lateralDistance > this.config.corridorWidthM) {
            currentViolation = 'CORRIDOR_BREACH';
            violationMsg = `CORRIDOR BREACH: ${(lateralDistance / 1000).toFixed(1)}km lateral (limit: ${(this.config.corridorWidthM / 1000).toFixed(0)}km)`;
        } else if (alt > this.config.corridorMaxAltM) {
            currentViolation = 'CORRIDOR_BREACH';
            violationMsg = `ALTITUDE BREACH: ${(alt / 1000).toFixed(1)}km (limit: ${(this.config.corridorMaxAltM / 1000).toFixed(0)}km)`;
        }

        // 3. Trajectory deviation
        if (Math.abs(flightPathAngle) > this.config.maxDeviationAngleDeg && vel > 50) {
            currentViolation = 'TRAJECTORY_DEVIATION';
            violationMsg = `TRAJECTORY DEV: ${Math.abs(flightPathAngle).toFixed(1)}° (limit: ${this.config.maxDeviationAngleDeg}°)`;
        }

        this._violation = currentViolation;
        this._violationMessage = violationMsg;

        // State machine
        switch (this._state) {
            case 'SAFE':
                if (currentViolation !== 'NONE') {
                    this._state = 'WARNING';
                    this._warningTimer = 0;
                    if (state.missionLog) {
                        state.missionLog.log(`FTS WARNING: ${violationMsg}`, 'warn');
                    }
                } else if (this._corridorFraction > this.config.warningThreshold) {
                    // Pre-warning: approaching corridor edge
                    if (state.missionLog && Math.random() < 0.01) {
                        state.missionLog.log(
                            `FTS: Corridor ${(this._corridorFraction * 100).toFixed(0)}% — approaching limit`,
                            'info'
                        );
                    }
                }
                break;

            case 'WARNING':
                if (currentViolation === 'NONE') {
                    // Violation cleared
                    this._state = 'SAFE';
                    this._warningTimer = 0;
                    if (state.missionLog) {
                        state.missionLog.log('FTS: Violation cleared — returning to SAFE', 'info');
                    }
                } else {
                    this._warningTimer += dt;
                    if (this._warningTimer >= this.config.warningDurationS) {
                        this._state = 'ARM';
                        this._armed = true;
                        this._armTimer = 0;
                        if (state.missionLog) {
                            state.missionLog.log('FTS: AUTO-ARM — Violation persisted', 'warn');
                        }
                    }
                }
                break;

            case 'ARM':
                if (currentViolation === 'NONE') {
                    // Violation cleared while armed — go back to safe
                    this._state = 'SAFE';
                    this._armTimer = 0;
                    if (state.missionLog) {
                        state.missionLog.log('FTS: Violation cleared — returning to SAFE', 'info');
                    }
                } else if (this.config.autoDestructEnabled) {
                    this._armTimer += dt;
                    if (this._armTimer >= this.config.armDurationS) {
                        // Auto-destruct
                        this._state = 'DESTRUCT';
                        this._destructTriggered = true;
                        if (state.missionLog) {
                            state.missionLog.log('FTS: ████ AUTO-DESTRUCT ████', 'warn');
                        }
                        vessel.explode();
                    }
                }
                break;

            case 'DESTRUCT':
                // Terminal state — nothing to do
                break;
        }
    }

    /** Reset FTS to initial state */
    reset(): void {
        this._state = 'SAFE';
        this._armed = false;
        this._violation = 'NONE';
        this._violationMessage = '';
        this._warningTimer = 0;
        this._armTimer = 0;
        this._corridorFraction = 0;
        this._lastAngle = 0;
        this._angularRate = 0;
        this._destructTriggered = false;
    }
}
