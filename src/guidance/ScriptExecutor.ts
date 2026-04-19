import { SASMode } from '../types/index';
import {
    type ScriptCondition,
    type ScriptAction,
    type ComparisonOperator,
    type ConditionVariable,
    type SASModeValue,
    type MissionScript
} from './FlightScript';
import type { FlightComputerState, FlightComputerOutput } from './FlightComputer';

export class ScriptExecutor {
    /** Callback for staging */
    public onStage: (() => void) | null = null;

    /** Callback for SAS mode change */
    public onSASChange: ((mode: SASMode) => void) | null = null;

    /**
     * Update flight computer state and get output commands based on the active script
     */
    public execute(
        script: MissionScript,
        telemetryCache: Record<ConditionVariable, number>,
        state: FlightComputerState
    ): FlightComputerOutput {
        const output: FlightComputerOutput = {
            pitchAngle: null,
            throttle: null,
            stage: false,
            sasMode: null,
            abort: false
        };

        for (const command of script.commands) {
            // Skip completed one-shot commands
            if (command.state === 'completed' && command.oneShot) {
                continue;
            }

            // Evaluate condition
            const conditionMet = this.evaluateCondition(command.condition, telemetryCache);

            if (conditionMet) {
                // Execute action
                const actionResult = this.executeAction(command.action);

                // Merge into output
                if (actionResult.pitchAngle !== null) {
                    output.pitchAngle = actionResult.pitchAngle;
                    state.targetPitch = (actionResult.pitchAngle * 180) / Math.PI;
                }
                if (actionResult.throttle !== null) {
                    output.throttle = actionResult.throttle;
                    state.targetThrottle = actionResult.throttle;
                }
                if (actionResult.stage) output.stage = true;
                if (actionResult.sasMode !== null) output.sasMode = actionResult.sasMode;
                if (actionResult.abort) output.abort = true;

                // Update command state
                if (command.oneShot) {
                    command.state = 'completed';
                    state.lastTriggeredCommand = command.rawText;
                } else {
                    command.state = 'active';
                }
            } else if (!command.oneShot && command.state === 'active') {
                // Continuous command no longer satisfied
                command.state = 'pending';
            }
        }

        return output;
    }

    /**
     * Evaluate a condition against telemetry values
     */
    public evaluateCondition(condition: ScriptCondition, telemetry: Record<ConditionVariable, number>): boolean {
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
}
