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
    type ScriptCondition,
    type ScriptAction,
    type ComparisonOperator,
    type ConditionVariable,
    parseMissionScript,
    resetScript,
    type SASModeValue
} from './FlightScript';

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

    /** Callback for staging */
    public onStage: (() => void) | null = null;

    /** Callback for SAS mode change */
    public onSASChange: ((mode: SASMode) => void) | null = null;

    /** Telemetry cache to avoid garbage collection */
    private telemetryCache: Record<ConditionVariable, number>;

    /**
     * Create a new Flight Computer
     */
    constructor(groundY: number) {
        this.groundY = groundY;
        this.state = this.createInitialState();
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

    /**
     * Update flight computer and get output commands
     */
    update(vessel: IVessel, dt: number): FlightComputerOutput {
        const output: FlightComputerOutput = {
            pitchAngle: null,
            throttle: null,
            stage: false,
            sasMode: null,
            abort: false
        };

        // Only process when running
        if (this.state.mode !== 'RUNNING' || !this.state.script) {
            return output;
        }

        // Update elapsed time
        this.state.elapsedTime += dt;

        // Calculate telemetry values
        this.calculateTelemetry(vessel);

        // Evaluate each command
        for (const command of this.state.script.commands) {
            // Skip completed one-shot commands
            if (command.state === 'completed' && command.oneShot) {
                continue;
            }

            // Evaluate condition
            const conditionMet = this.evaluateCondition(command.condition, this.telemetryCache);

            if (conditionMet) {
                // Execute action
                const actionResult = this.executeAction(command.action);

                // Merge into output
                if (actionResult.pitchAngle !== null) {
                    output.pitchAngle = actionResult.pitchAngle;
                    this.state.targetPitch = (actionResult.pitchAngle * 180) / Math.PI;
                }
                if (actionResult.throttle !== null) {
                    output.throttle = actionResult.throttle;
                    this.state.targetThrottle = actionResult.throttle;
                }
                if (actionResult.stage) output.stage = true;
                if (actionResult.sasMode !== null) output.sasMode = actionResult.sasMode;
                if (actionResult.abort) output.abort = true;

                // Update command state
                if (command.oneShot) {
                    command.state = 'completed';
                    this.state.lastTriggeredCommand = command.rawText;
                } else {
                    command.state = 'active';
                }
            } else if (!command.oneShot && command.state === 'active') {
                // Continuous command no longer satisfied
                command.state = 'pending';
            }
        }

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
     * Evaluate a condition against telemetry values
     */
    private evaluateCondition(condition: ScriptCondition, telemetry: Record<ConditionVariable, number>): boolean {
        // Optimized: direct boolean computation without array allocation
        if (condition.clauses.length === 0) return false;

        const firstClause = condition.clauses[0]!;
        const val0 = telemetry[firstClause.variable];
        let combined = this.evaluateComparison(val0, firstClause.operator, firstClause.value);

        for (let i = 1; i < condition.clauses.length; i++) {
            const clause = condition.clauses[i]!;
            const val = telemetry[clause.variable];
            const result = this.evaluateComparison(val, clause.operator, clause.value);

            const op = condition.logicalOperators[i - 1]!;
            if (op === 'AND') {
                combined = combined && result;
            } else if (op === 'OR') {
                combined = combined || result;
            }
        }

        return combined;
    }

    /**
     * Evaluate a single comparison
     */
    private evaluateComparison(actual: number, operator: ComparisonOperator, expected: number): boolean {
        switch (operator) {
            case '>':
                return actual > expected;
            case '<':
                return actual < expected;
            case '>=':
                return actual >= expected;
            case '<=':
                return actual <= expected;
            case '==':
                return Math.abs(actual - expected) < 0.001;
            case '!=':
                return Math.abs(actual - expected) >= 0.001;
            default:
                return false;
        }
    }

    /**
     * Execute an action and return the output
     */
    private executeAction(action: ScriptAction): FlightComputerOutput {
        const output: FlightComputerOutput = {
            pitchAngle: null,
            throttle: null,
            stage: false,
            sasMode: null,
            abort: false
        };

        switch (action.type) {
            case 'PITCH': {
                // Convert degrees to radians
                const pitchDeg = action.value as number;
                output.pitchAngle = (pitchDeg * Math.PI) / 180;
                break;
            }

            case 'THROTTLE':
                output.throttle = action.value as number;
                break;

            case 'STAGE':
                output.stage = true;
                if (this.onStage) this.onStage();
                break;

            case 'SAS': {
                const sasValue = action.value as SASModeValue;
                output.sasMode = SASMode[sasValue];
                if (this.onSASChange) this.onSASChange(output.sasMode);
                break;
            }

            case 'ABORT':
                output.abort = true;
                output.throttle = 0;
                break;
        }

        return output;
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
        for (const c of this.state.script.commands) {
            if (c.state === 'completed') count++;
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
