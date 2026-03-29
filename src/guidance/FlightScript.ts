/**
 * FlightScript - Mission Script Types and Parser
 *
 * Defines the domain-specific language (DSL) for autonomous rocket guidance.
 * Scripts use a WHEN <condition> THEN <action> syntax.
 *
 * Example:
 *   WHEN ALTITUDE > 10000 THEN PITCH 80
 *   WHEN VELOCITY > 2000 AND ALTITUDE > 50000 THEN STAGE
 */

// ============================================================================
// Condition Types
// ============================================================================

/**
 * Comparison operators for conditions
 */
export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

/**
 * Variables that can be used in conditions
 */
export type ConditionVariable =
    | 'ALTITUDE' // meters above ground
    | 'VELOCITY' // m/s total speed
    | 'VERTICAL_VEL' // m/s vertical (negative = up)
    | 'HORIZONTAL_VEL' // m/s horizontal
    | 'APOGEE' // meters predicted apogee
    | 'FUEL' // 0-1 fraction
    | 'TIME' // seconds since launch
    | 'THROTTLE' // 0-1 current throttle
    | 'DYNAMIC_PRESSURE'; // Q in kPa

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = 'AND' | 'OR';

/**
 * A single condition clause
 */
export interface ConditionClause {
    variable: ConditionVariable;
    operator: ComparisonOperator;
    value: number;
}

/**
 * A complete condition with optional logical combinations
 */
export interface ScriptCondition {
    clauses: ConditionClause[];
    logicalOperators: LogicalOperator[]; // Between clauses
}

// ============================================================================
// Action Types
// ============================================================================

/**
 * Types of actions that can be executed
 */
export type ActionType =
    | 'PITCH' // Set pitch angle (degrees from vertical)
    | 'THROTTLE' // Set throttle (0-100 or 0-1)
    | 'STAGE' // Trigger staging
    | 'SAS' // Set SAS mode
    | 'ABORT'; // Emergency abort (cut engine)

/**
 * SAS mode values for SAS action
 */
export type SASModeValue = 'OFF' | 'STABILITY' | 'PROGRADE' | 'RETROGRADE';

/**
 * A script action to execute
 */
export interface ScriptAction {
    type: ActionType;
    value?: number | SASModeValue; // Value for PITCH, THROTTLE, SAS
}

// ============================================================================
// Command Types
// ============================================================================

/**
 * Execution state of a command
 */
export type CommandState =
    | 'pending' // Not yet triggered
    | 'active' // Currently executing
    | 'completed'; // Already triggered (one-shot commands)

/**
 * A complete script command: WHEN condition THEN action
 */
export interface ScriptCommand {
    id: number;
    condition: ScriptCondition;
    action: ScriptAction;
    state: CommandState;
    oneShot: boolean; // If true, only executes once
    rawText: string; // Original script line
}

/**
 * A complete mission script
 */
export interface MissionScript {
    name: string;
    commands: ScriptCommand[];
    createdAt: number;
}

// ============================================================================
// Parser Types
// ============================================================================

/**
 * Result of parsing a script line
 */
export interface ParseResult {
    success: boolean;
    command?: ScriptCommand;
    error?: string;
    line?: number;
}

/**
 * Result of parsing an entire script
 */
export interface ScriptParseResult {
    success: boolean;
    script?: MissionScript;
    errors: ParseResult[];
}

// ============================================================================
// Parser Implementation
// ============================================================================

/**
 * Parse a condition variable from string
 */
function parseVariable(str: string): ConditionVariable | null {
    const valid: ConditionVariable[] = [
        'ALTITUDE',
        'VELOCITY',
        'VERTICAL_VEL',
        'HORIZONTAL_VEL',
        'APOGEE',
        'FUEL',
        'TIME',
        'THROTTLE',
        'DYNAMIC_PRESSURE'
    ];
    const upper = str.toUpperCase().trim();
    return valid.includes(upper as ConditionVariable) ? (upper as ConditionVariable) : null;
}

/**
 * Parse a comparison operator from string
 */
function parseOperator(str: string): ComparisonOperator | null {
    const operators: ComparisonOperator[] = ['>=', '<=', '==', '!=', '>', '<'];
    const trimmed = str.trim();
    return operators.includes(trimmed as ComparisonOperator) ? (trimmed as ComparisonOperator) : null;
}

/**
 * Parse a single condition clause like "ALTITUDE > 10000"
 */
function parseConditionClause(str: string): ConditionClause | null {
    // Match pattern: VARIABLE OPERATOR VALUE
    const match = str.match(/^\s*(\w+)\s*(>=|<=|==|!=|>|<)\s*(-?\d+\.?\d*)\s*$/);
    if (!match || !match[1] || !match[2] || !match[3]) return null;

    const variable = parseVariable(match[1]);
    const operator = parseOperator(match[2]);
    const value = parseFloat(match[3]);

    if (!variable || !operator || isNaN(value)) return null;

    return { variable, operator, value };
}

/**
 * Parse a complete condition with AND/OR operators
 */
function parseCondition(str: string): ScriptCondition | null {
    const clauses: ConditionClause[] = [];
    const logicalOperators: LogicalOperator[] = [];

    // Split by AND/OR while preserving the operators
    const parts = str.split(/\s+(AND|OR)\s+/i);

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === undefined) continue;

        if (i % 2 === 0) {
            // This should be a condition clause
            const clause = parseConditionClause(part);
            if (!clause) return null;
            clauses.push(clause);
        } else {
            // This should be a logical operator
            const op = part.toUpperCase() as LogicalOperator;
            if (op !== 'AND' && op !== 'OR') return null;
            logicalOperators.push(op);
        }
    }

    if (clauses.length === 0) return null;

    return { clauses, logicalOperators };
}

/**
 * Parse an action like "PITCH 80" or "STAGE"
 */
function parseAction(str: string): ScriptAction | null {
    const trimmed = str.trim().toUpperCase();

    // STAGE and ABORT have no value
    if (trimmed === 'STAGE') {
        return { type: 'STAGE' };
    }
    if (trimmed === 'ABORT') {
        return { type: 'ABORT' };
    }

    // Parse actions with values
    const pitchMatch = trimmed.match(/^PITCH\s+(-?\d+\.?\d*)$/);
    if (pitchMatch && pitchMatch[1]) {
        return { type: 'PITCH', value: parseFloat(pitchMatch[1]) };
    }

    const throttleMatch = trimmed.match(/^THROTTLE\s+(\d+\.?\d*)$/);
    if (throttleMatch && throttleMatch[1]) {
        let value = parseFloat(throttleMatch[1]);
        // Convert percentage to fraction if > 1
        if (value > 1) value /= 100;
        return { type: 'THROTTLE', value };
    }

    const sasMatch = trimmed.match(/^SAS\s+(OFF|STABILITY|PROGRADE|RETROGRADE)$/);
    if (sasMatch && sasMatch[1]) {
        return { type: 'SAS', value: sasMatch[1] as SASModeValue };
    }

    return null;
}

/**
 * Parse a single script line
 */
export function parseScriptLine(line: string, lineNumber: number): ParseResult {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('#')) {
        return { success: true }; // Valid but no command
    }

    // Match WHEN ... THEN ... pattern
    const match = trimmed.match(/^WHEN\s+(.+?)\s+THEN\s+(.+)$/i);
    if (!match) {
        return {
            success: false,
            error: `Invalid syntax. Expected: WHEN <condition> THEN <action>`,
            line: lineNumber
        };
    }

    const conditionStr = match[1];
    const actionStr = match[2];

    if (!conditionStr || !actionStr) {
        return {
            success: false,
            error: `Invalid syntax. Expected: WHEN <condition> THEN <action>`,
            line: lineNumber
        };
    }

    // Parse condition
    const condition = parseCondition(conditionStr);
    if (!condition) {
        return {
            success: false,
            error: `Invalid condition: "${conditionStr}". Valid variables: ALTITUDE, VELOCITY, APOGEE, FUEL, TIME`,
            line: lineNumber
        };
    }

    // Parse action
    const action = parseAction(actionStr);
    if (!action) {
        return {
            success: false,
            error: `Invalid action: "${actionStr}". Valid actions: PITCH <deg>, THROTTLE <0-100>, STAGE, SAS <mode>`,
            line: lineNumber
        };
    }

    // Determine if one-shot (STAGE is always one-shot)
    const oneShot = action.type === 'STAGE' || action.type === 'ABORT';

    const command: ScriptCommand = {
        id: lineNumber,
        condition,
        action,
        state: 'pending',
        oneShot,
        rawText: trimmed
    };

    return { success: true, command };
}

/**
 * Parse a complete mission script
 */
export function parseMissionScript(scriptText: string, name: string = 'Unnamed Script'): ScriptParseResult {
    const lines = scriptText.split('\n');
    const commands: ScriptCommand[] = [];
    const errors: ParseResult[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;

        const result = parseScriptLine(line, i + 1);

        if (!result.success) {
            errors.push(result);
        } else if (result.command) {
            commands.push(result.command);
        }
    }

    if (errors.length > 0) {
        return { success: false, errors };
    }

    const script: MissionScript = {
        name,
        commands,
        createdAt: Date.now()
    };

    return { success: true, script, errors: [] };
}

/**
 * Reset all commands in a script to pending state
 */
export function resetScript(script: MissionScript): void {
    script.commands.forEach((cmd) => {
        cmd.state = 'pending';
    });
}

/**
 * Serialize a script to string for storage
 */
export function serializeScript(script: MissionScript): string {
    return JSON.stringify(script);
}

/**
 * Deserialize a script from storage
 */
export function deserializeScript(json: string): MissionScript | null {
    try {
        const parsed = JSON.parse(json);

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }

        const script = parsed as Record<string, unknown>;

        if (typeof script.name !== 'string') return null;
        if (!Array.isArray(script.commands)) return null;
        if (typeof script.createdAt !== 'number') return null;

        // Note: For full robustness, we could also recursively validate every
        // command, action, and condition here. For basic type safety of the
        // top-level structure to prevent immediate crashes, this is sufficient.
        return script as unknown as MissionScript;
    } catch {
        return null;
    }
}
