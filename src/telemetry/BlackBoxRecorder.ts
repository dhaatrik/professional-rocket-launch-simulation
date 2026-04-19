/**
 * BlackBoxRecorder - Flight Data Recorder
 *
 * Records all flight variables at 20Hz for post-flight analysis.
 * Provides export functionality to CSV and JSON formats.
 */

import { IVessel } from '../types';
import { PIXELS_PER_METER, getMachNumber } from '../config/Constants';
import { EngineStateCode } from '../core/PhysicsBuffer';

// ============================================================================
// Types
// ============================================================================

/**
 * A single frame of flight data
 */
export interface FlightDataFrame {
    t: number; // Mission time (seconds)
    alt: number; // Altitude (meters)
    vx: number; // Velocity X (m/s)
    vy: number; // Velocity Y (m/s)
    speed: number; // Total speed (m/s)
    accelX: number; // Acceleration X (m/s²)
    accelY: number; // Acceleration Y (m/s²)
    gForce: number; // G-force (g)
    angle: number; // Pitch angle (degrees)
    gimbal: number; // Gimbal angle (degrees)
    throttle: number; // Throttle (0-1)
    mass: number; // Total mass (kg)
    fuel: number; // Fuel fraction (0-1)
    q: number; // Dynamic pressure (Pa)
    mach: number; // Mach number
    aoa: number; // Angle of attack (degrees)
    skinTemp: number; // Skin temperature (K)
    engineState: EngineStateCode; // Engine state
    apogee: number; // Predicted apogee (m)
}

/**
 * Recording state
 */
export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

/**
 * Flight summary metadata
 */
export interface FlightSummary {
    missionName: string;
    startTime: Date;
    endTime: Date | null;
    duration: number; // seconds
    maxAltitude: number; // meters
    maxVelocity: number; // m/s
    maxGForce: number; // g
    maxQ: number; // Pa
    maxMach: number;
    finalState: string; // 'landed' | 'crashed' | 'in-flight'
    frameCount: number;
    sampleRate: number; // Hz
}

// ============================================================================
// BlackBoxRecorder Class
// ============================================================================

export class BlackBoxRecorder {
    /** Recorded data frames */
    private frames: FlightDataFrame[] = [];

    /** Current recording state */
    private state: RecordingState = 'idle';

    /** Mission start time */
    private missionStartTime: number = 0;

    /** Last sample time for rate limiting */
    private lastSampleTime: number = 0;

    /** Sample interval in seconds (20Hz = 0.05s) */
    private readonly sampleInterval: number = 0.05;

    /** Ground Y position for altitude calculation */
    private groundY: number;

    /** Previous velocity for acceleration calculation */
    private prevVx: number = 0;
    private prevVy: number = 0;
    private prevTime: number = 0;

    /** Flight summary statistics */
    private summary: FlightSummary;

    /** Mission name */
    private missionName: string = 'Mission';

    constructor(groundY: number) {
        this.groundY = groundY;
        this.summary = this.createInitialSummary();
    }

    /**
     * Create initial summary
     */
    private createInitialSummary(): FlightSummary {
        return {
            missionName: this.missionName,
            startTime: new Date(),
            endTime: null,
            duration: 0,
            maxAltitude: 0,
            maxVelocity: 0,
            maxGForce: 0,
            maxQ: 0,
            maxMach: 0,
            finalState: 'in-flight',
            frameCount: 0,
            sampleRate: 20
        };
    }

    /**
     * Start recording
     */
    start(missionName: string = 'Mission'): void {
        this.missionName = missionName;
        this.frames = [];
        this.state = 'recording';
        this.missionStartTime = performance.now() / 1000;
        this.lastSampleTime = 0;
        this.prevVx = 0;
        this.prevVy = 0;
        this.prevTime = 0;
        this.summary = this.createInitialSummary();
        this.summary.missionName = missionName;
        this.summary.startTime = new Date();
    }

    /**
     * Stop recording
     */
    stop(finalState: 'landed' | 'crashed' | 'in-flight' = 'in-flight'): void {
        if (this.state === 'recording' || this.state === 'paused') {
            this.state = 'stopped';
            this.summary.endTime = new Date();
            this.summary.finalState = finalState;
            this.summary.frameCount = this.frames.length;

            if (this.frames.length > 0) {
                const lastFrame = this.frames[this.frames.length - 1];
                if (lastFrame) {
                    this.summary.duration = lastFrame.t;
                }
            }
        }
    }

    /**
     * Pause recording
     */
    pause(): void {
        if (this.state === 'recording') {
            this.state = 'paused';
        }
    }

    /**
     * Resume recording
     */
    resume(): void {
        if (this.state === 'paused') {
            this.state = 'recording';
        }
    }

    /**
     * Toggle recording state
     */
    toggle(): void {
        switch (this.state) {
            case 'idle':
                this.start();
                break;
            case 'recording':
                this.pause();
                break;
            case 'paused':
                this.resume();
                break;
            case 'stopped':
                this.start();
                break;
        }
    }

    /**
     * Record a frame from vessel state
     */
    record(vessel: IVessel, missionTime: number): void {
        if (this.state !== 'recording') return;

        // Rate limiting - only sample at 20Hz
        if (missionTime - this.lastSampleTime < this.sampleInterval) {
            return;
        }
        this.lastSampleTime = missionTime;

        // Calculate derived values
        const alt = (this.groundY - vessel.y - vessel.h) / PIXELS_PER_METER;
        const speed = Math.sqrt(vessel.vx * vessel.vx + vessel.vy * vessel.vy);
        const mach = getMachNumber(speed);

        // Calculate acceleration
        const dt = missionTime - this.prevTime;
        let accelX = 0;
        let accelY = 0;
        if (dt > 0 && this.prevTime > 0) {
            accelX = (vessel.vx - this.prevVx) / dt;
            accelY = (vessel.vy - this.prevVy) / dt;
        }
        // Proper acceleration includes the normal force counteracting gravity.
        // Gravity accelerates downward at 9.81 m/s², so we subtract 9.81 from accelY.
        const properAccelX = accelX;
        const properAccelY = accelY - 9.81;
        const gForce = Math.sqrt(properAccelX * properAccelX + properAccelY * properAccelY) / 9.81;

        // Create frame
        const frame: FlightDataFrame = {
            t: missionTime,
            alt: alt,
            vx: vessel.vx,
            vy: vessel.vy,
            speed: speed,
            accelX: accelX,
            accelY: accelY,
            gForce: gForce,
            angle: (vessel.angle * 180) / Math.PI,
            gimbal: (vessel.gimbalAngle * 180) / Math.PI,
            throttle: vessel.throttle,
            mass: vessel.mass,
            fuel: vessel.fuel,
            q: vessel.q,
            mach: mach,
            aoa: (vessel.aoa * 180) / Math.PI,
            skinTemp: vessel.skinTemp,
            engineState: vessel.engineState,
            apogee: vessel.apogee
        };

        this.frames.push(frame);

        // Update summary statistics
        this.summary.maxAltitude = Math.max(this.summary.maxAltitude, alt);
        this.summary.maxVelocity = Math.max(this.summary.maxVelocity, speed);
        this.summary.maxGForce = Math.max(this.summary.maxGForce, gForce);
        this.summary.maxQ = Math.max(this.summary.maxQ, vessel.q);
        this.summary.maxMach = Math.max(this.summary.maxMach, mach);

        // Store for next acceleration calculation
        this.prevVx = vessel.vx;
        this.prevVy = vessel.vy;
        this.prevTime = missionTime;
    }

    /**
     * Get current recording state
     */
    getState(): RecordingState {
        return this.state;
    }

    /**
     * Check if recording
     */
    isRecording(): boolean {
        return this.state === 'recording';
    }

    /**
     * Get recorded frames
     */
    getFrames(): readonly FlightDataFrame[] {
        return this.frames;
    }

    /**
     * Get frame count
     */
    getFrameCount(): number {
        return this.frames.length;
    }

    /**
     * Get flight summary
     */
    getSummary(): FlightSummary {
        return { ...this.summary };
    }

    /**
     * Get recording duration in seconds
     */
    getDuration(): number {
        if (this.frames.length === 0) return 0;
        const lastFrame = this.frames[this.frames.length - 1];
        return lastFrame ? lastFrame.t : 0;
    }

    /**
     * Clear all recorded data
     */
    clear(): void {
        this.frames = [];
        this.state = 'idle';
        this.summary = this.createInitialSummary();
    }

    /**
     * Get status string for HUD display
     */
    getStatusString(): string {
        switch (this.state) {
            case 'idle':
                return '';
            case 'recording':
                return `● REC ${this.frames.length}`;
            case 'paused':
                return '⏸ PAUSED';
            case 'stopped':
                return `■ ${this.frames.length} frames`;
        }
    }
}
