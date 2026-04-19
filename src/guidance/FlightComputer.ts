/**
 * FlightComputer - Autonomous Guidance & Navigation System
 *
 * Executes mission scripts to control the rocket autonomously.
 * Evaluates conditions against current telemetry and executes actions.
 *
 * Usage:
 *   const fc = new FlightComputer();
 *   fc.loadScript(scriptText);
 *   fc.activate();
 *   // In game loop:
 *   fc.update(vessel, dt);
 */

import { type IVessel, SASMode } from '../types/index';
import { PIXELS_PER_METER, getAtmosphericDensity, getDynamicPressure } from '../config/Constants';
import {
    type MissionScript,
    type ConditionVariable,
    parseMissionScript,
    resetScript
} from './FlightScript';
import { ScriptExecutor } from './ScriptExecutor';

// ============================================================================
// Flight Computer Modes
// ============================================================================

export type FlightComputerMode = 'OFF' | 'STANDBY' | 'RUNNING' | 'PAUSED' | 'COMPLETE';

// ============================================================================
// Execution State
// ============================================================================

export interface FlightComputerState {
    mode: FlightComputerMode;
    script: MissionScript | null;
    activeCommandIndex: number;
    elapsedTime: number; // Seconds since activation
    lastTriggeredCommand: string | null;
    targetPitch: number | null; // Current pitch target (degrees)
    targetThrottle: number | null; // Current throttle target (0-1)
}

// ============================================================================
// Output Commands
// ============================================================================

export interface FlightComputerOutput {
    pitchAngle: number | null; // Desired pitch in radians (from vertical)
    throttle: number | null; // Desired throttle (0-1)
    stage: boolean; // Should trigger staging
    sasMode: SASMode | null; // SAS mode to set
    abort: boolean; // Emergency abort
}

// ============================================================================
// Flight Computer Class
// ============================================================================

export class FlightComputer {
    /** Current state */
    public state: FlightComputerState;

    /** Ground level Y position for altitude calculation */
    private groundY: number;

    /** Telemetry cache to avoid garbage collection */
    private telemetryCache: Record<ConditionVariable, number>;

    /** Script executor instance */
    private scriptExecutor: ScriptExecutor;

    /**
     * Create a new Flight Computer
     */
    constructor(groundY: number) {
        this.groundY = groundY;
        this.state = this.createInitialState();
        this.scriptExecutor = new ScriptExecutor();
        this.telemetryCache = {
            ALTITUDE: 0,
            VELOCITY: 0,
            VERTICAL_VEL: 0,
            HORIZONTAL_VEL: 0,
            APOGEE: 0,
            FUEL: 0,
            TIME: 0,
            THROTTLE: 0,
            DYNAMIC_PRESSURE: 0
        };
    }

    /**
     * Create initial state
     */
    private createInitialState(): FlightComputerState {
        return {
            mode: 'OFF',
            script: null,
            activeCommandIndex: -1,
            elapsedTime: 0,
            lastTriggeredCommand: null,
            targetPitch: null,
            targetThrottle: null
        };
    }

    /**
     * Load and parse a mission script
     */
    loadScript(scriptText: string, name: string = 'Mission Script'): { success: boolean; errors: string[] } {
        const result = parseMissionScript(scriptText, name);

        if (result.success && result.script) {
            this.state.script = result.script;
            this.state.mode = 'STANDBY';
            this.state.activeCommandIndex = -1;
            this.state.elapsedTime = 0;
            return { success: true, errors: [] };
        }

        const errors = result.errors.map((e) => `Line ${e.line}: ${e.error}`);
        return { success: false, errors };
    }

    /**
     * Load a pre-parsed script
     */
    loadParsedScript(script: MissionScript): void {
        resetScript(script);
        this.state.script = script;
        this.state.mode = 'STANDBY';
        this.state.activeCommandIndex = -1;
        this.state.elapsedTime = 0;
    }

    /**
     * Activate the flight computer
     */
    activate(): void {
        if (this.state.script && this.state.script.commands.length > 0) {
            this.state.mode = 'RUNNING';
            this.state.elapsedTime = 0;
            resetScript(this.state.script);
        }
    }

    /**
     * Deactivate the flight computer
     */
    deactivate(): void {
        this.state.mode = 'OFF';
        this.state.targetPitch = null;
        this.state.targetThrottle = null;
    }

    /**
     * Pause/resume the flight computer
     */
    togglePause(): void {
        if (this.state.mode === 'RUNNING') {
            this.state.mode = 'PAUSED';
        } else if (this.state.mode === 'PAUSED') {
            this.state.mode = 'RUNNING';
        }
    }

    /**
     * Toggle flight computer on/off
     */
    toggle(): void {
        if (this.state.mode === 'OFF' || this.state.mode === 'STANDBY') {
            this.activate();
        } else {
            this.deactivate();
        }
    }

    /**
     * Check if flight computer is active
     */
    isActive(): boolean {
        return this.state.mode === 'RUNNING';
    }

    /**
     * Get current status string for HUD display
     */
    getStatusString(): string {
        switch (this.state.mode) {
            case 'OFF':
                return 'FC: OFF';
            case 'STANDBY':
                return 'FC: READY';
            case 'RUNNING':
                return 'FC: ACTIVE';
            case 'PAUSED':
                return 'FC: PAUSED';
            case 'COMPLETE':
                return 'FC: DONE';
            default:
                return 'FC: ---';
        }
    }

    /**
     * Get active command text for HUD display
     */
    getActiveCommandText(): string {
        if (!this.state.script || this.state.mode !== 'RUNNING') {
            return '';
        }

        // Find the most recently triggered command
        // Optimized: iterate backwards to avoid array allocation
        const commands = this.state.script.commands;
        for (let i = commands.length - 1; i >= 0; i--) {
            const cmd = commands[i]!;
            if (cmd.state === 'active' || cmd.state === 'completed') {
                return cmd.rawText.substring(0, 40) + (cmd.rawText.length > 40 ? '...' : '');
            }
        }

        return 'Waiting...';
    }

    /** Callback setter for staging */
    set onStage(callback: (() => void) | null) {
        this.scriptExecutor.onStage = callback;
    }

    get onStage(): (() => void) | null {
        return this.scriptExecutor.onStage;
    }

    /** Callback setter for SAS mode change */
    set onSASChange(callback: ((mode: SASMode) => void) | null) {
        this.scriptExecutor.onSASChange = callback;
    }

    get onSASChange(): ((mode: SASMode) => void) | null {
        return this.scriptExecutor.onSASChange;
    }

    /**
     * Update flight computer and get output commands
     */
    update(vessel: IVessel, dt: number): FlightComputerOutput {
        // Only process when running
        if (this.state.mode !== 'RUNNING' || !this.state.script) {
            return {
                pitchAngle: null,
                throttle: null,
                stage: false,
                sasMode: null,
                abort: false
            };
        }

        // Update elapsed time
        this.state.elapsedTime += dt;

        // Calculate telemetry values
        this.calculateTelemetry(vessel);

        // Execute script commands
        const output = this.scriptExecutor.execute(
            this.state.script,
            this.telemetryCache,
            this.state
        );

        // Apply stored targets if no new commands
        if (output.pitchAngle === null && this.state.targetPitch !== null) {
            output.pitchAngle = (this.state.targetPitch * Math.PI) / 180;
        }
        if (output.throttle === null && this.state.targetThrottle !== null) {
            output.throttle = this.state.targetThrottle;
        }

        // Check if all commands are complete
        const allComplete = this.state.script.commands.every(
            (cmd) => cmd.state === 'completed' || (!cmd.oneShot && cmd.state !== 'pending')
        );
        if (allComplete && this.state.script.commands.length > 0) {
            // Keep running but mark as complete for display
            // this.state.mode = 'COMPLETE';
        }

        return output;
    }

    /**
     * Calculate telemetry values from vessel state
     */
    private calculateTelemetry(vessel: IVessel): void {
        const alt = (this.groundY - vessel.y - vessel.h) / PIXELS_PER_METER;
        const vx = vessel.vx;
        const vy = vessel.vy;
        const speed = Math.sqrt(vx * vx + vy * vy);

        // Estimate apogee (simple ballistic calculation)
        const g = 9.8;
        const apogee = alt + (vy < 0 ? (vy * vy) / (2 * g) : 0);

        // Dynamic pressure
        const rho = getAtmosphericDensity(alt);
        const q = getDynamicPressure(rho, speed) / 1000; // kPa

        // Update cache
        this.telemetryCache.ALTITUDE = alt;
        this.telemetryCache.VELOCITY = speed;
        this.telemetryCache.VERTICAL_VEL = -vy; // Positive = up
        this.telemetryCache.HORIZONTAL_VEL = Math.abs(vx);
        this.telemetryCache.APOGEE = apogee;
        this.telemetryCache.FUEL = vessel.fuel;
        this.telemetryCache.TIME = this.state.elapsedTime;
        this.telemetryCache.THROTTLE = vessel.throttle;
        this.telemetryCache.DYNAMIC_PRESSURE = q;
    }

    /**
     * Get script command count
     */
    getCommandCount(): number {
        return this.state.script?.commands.length ?? 0;
    }

    /**
     * Get completed command count
     */
    getCompletedCount(): number {
        if (!this.state.script) return 0;
        let count = 0;
        const commands = this.state.script.commands;
        const len = commands.length;
        for (let i = 0; i < len; i++) {
            if (commands[i]!.state === 'completed') count++;
        }
        return count;
    }
}

// ============================================================================
// Preset Mission Scripts
// ============================================================================

export const PRESET_SCRIPTS = {
    'Gravity Turn to 100km': `# Gravity Turn to 100km Orbit
# Standard ascent profile

WHEN ALTITUDE > 100 THEN PITCH 85
WHEN ALTITUDE > 1000 THEN PITCH 80
WHEN ALTITUDE > 3000 THEN PITCH 75
WHEN ALTITUDE > 5000 THEN PITCH 70
WHEN ALTITUDE > 8000 THEN PITCH 65
WHEN ALTITUDE > 12000 THEN PITCH 60
WHEN ALTITUDE > 18000 THEN PITCH 55
WHEN ALTITUDE > 25000 THEN PITCH 50
WHEN ALTITUDE > 35000 THEN PITCH 45
WHEN ALTITUDE > 50000 THEN PITCH 30
WHEN ALTITUDE > 70000 THEN PITCH 10
WHEN APOGEE > 100000 THEN THROTTLE 0
`,

    'Suborbital Hop': `# Suborbital Hop
# Simple up and down trajectory

WHEN ALTITUDE > 100 THEN PITCH 90
WHEN ALTITUDE > 30000 THEN THROTTLE 50
WHEN ALTITUDE > 50000 THEN THROTTLE 0
WHEN VERTICAL_VEL < -100 THEN SAS RETROGRADE
`,

    'Booster Return': `# Booster Return Profile
# For first stage recovery

WHEN ALTITUDE > 100 THEN PITCH 85
WHEN ALTITUDE > 5000 THEN PITCH 70
WHEN ALTITUDE > 15000 THEN PITCH 45
WHEN FUEL < 0.3 THEN STAGE
WHEN VERTICAL_VEL < -50 THEN SAS RETROGRADE
WHEN ALTITUDE < 5000 AND VERTICAL_VEL < -100 THEN THROTTLE 100
`
};
