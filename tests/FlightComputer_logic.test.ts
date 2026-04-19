import { describe, it, expect } from 'vitest';
import { ScriptExecutor } from '../src/guidance/ScriptExecutor';
import type { ScriptCondition, ConditionVariable } from '../src/guidance/FlightScript';

// Helper to access evaluateCondition
function evaluateCondition(executor: ScriptExecutor, condition: ScriptCondition, telemetry: Record<ConditionVariable, number>): boolean {
    return executor.evaluateCondition(condition, telemetry);
}

// Helper to create simple condition clause
function createClause(variable: ConditionVariable, operator: any, value: number) {
    return { variable, operator, value };
}

describe('ScriptExecutor Logic', () => {
    const executor = new ScriptExecutor();
    const telemetry: Record<ConditionVariable, number> = {
        ALTITUDE: 1000,
        VELOCITY: 500,
        VERTICAL_VEL: 100,
        HORIZONTAL_VEL: 490,
        APOGEE: 2000,
        FUEL: 0.8,
        TIME: 60,
        THROTTLE: 1.0,
        DYNAMIC_PRESSURE: 10
    };

    describe('evaluateCondition - Simple Comparisons', () => {
        it('should handle GREATER_THAN (>)', () => {
            const condition: ScriptCondition = {
                clauses: [createClause('ALTITUDE', '>', 500)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(true);

            const conditionFalse: ScriptCondition = {
                clauses: [createClause('ALTITUDE', '>', 2000)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, conditionFalse, telemetry)).toBe(false);
        });

        it('should handle LESS_THAN (<)', () => {
            const condition: ScriptCondition = {
                clauses: [createClause('VELOCITY', '<', 1000)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(true);

            const conditionFalse: ScriptCondition = {
                clauses: [createClause('VELOCITY', '<', 100)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, conditionFalse, telemetry)).toBe(false);
        });

        it('should handle GREATER_THAN_OR_EQUAL (>=)', () => {
             const condition: ScriptCondition = {
                clauses: [createClause('ALTITUDE', '>=', 1000)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(true);

             const conditionGt: ScriptCondition = {
                clauses: [createClause('ALTITUDE', '>=', 500)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, conditionGt, telemetry)).toBe(true);

            const conditionFalse: ScriptCondition = {
                clauses: [createClause('ALTITUDE', '>=', 2000)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, conditionFalse, telemetry)).toBe(false);
        });

        it('should handle LESS_THAN_OR_EQUAL (<=)', () => {
             const condition: ScriptCondition = {
                clauses: [createClause('VELOCITY', '<=', 500)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(true);

            const conditionLt: ScriptCondition = {
                clauses: [createClause('VELOCITY', '<=', 1000)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, conditionLt, telemetry)).toBe(true);

            const conditionFalse: ScriptCondition = {
                clauses: [createClause('VELOCITY', '<=', 100)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, conditionFalse, telemetry)).toBe(false);
        });

        it('should handle EQUAL (==) with tolerance', () => {
            // value is 500
             const condition: ScriptCondition = {
                clauses: [createClause('VELOCITY', '==', 500)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(true); // Exact match (with float point potentially)

            // Tolerance check (epsilon 0.001)
            const conditionClose: ScriptCondition = {
                clauses: [createClause('VELOCITY', '==', 500.0009)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, conditionClose, telemetry)).toBe(true);

             const conditionFar: ScriptCondition = {
                clauses: [createClause('VELOCITY', '==', 500.002)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, conditionFar, telemetry)).toBe(false);
        });

        it('should handle NOT_EQUAL (!=) with tolerance', () => {
            // value is 500
             const condition: ScriptCondition = {
                clauses: [createClause('VELOCITY', '!=', 600)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(true);

            const conditionEqual: ScriptCondition = {
                clauses: [createClause('VELOCITY', '!=', 500)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, conditionEqual, telemetry)).toBe(false);

            // Close enough to equal -> result false
            const conditionClose: ScriptCondition = {
                clauses: [createClause('VELOCITY', '!=', 500.0009)],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, conditionClose, telemetry)).toBe(false);
        });
    });

    describe('evaluateCondition - Logical Operators', () => {
        // A (True) AND B (True) -> True
        it('should handle AND logic (True AND True)', () => {
            const condition: ScriptCondition = {
                clauses: [
                    createClause('ALTITUDE', '>', 500), // True
                    createClause('VELOCITY', '<', 1000) // True
                ],
                logicalOperators: ['AND']
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(true);
        });

        // A (True) AND B (False) -> False
        it('should handle AND logic (True AND False)', () => {
            const condition: ScriptCondition = {
                clauses: [
                    createClause('ALTITUDE', '>', 500), // True
                    createClause('VELOCITY', '>', 1000) // False
                ],
                logicalOperators: ['AND']
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(false);
        });

        // A (False) AND B (True) -> False
        it('should handle AND logic (False AND True)', () => {
            const condition: ScriptCondition = {
                clauses: [
                    createClause('ALTITUDE', '<', 500), // False
                    createClause('VELOCITY', '<', 1000) // True
                ],
                logicalOperators: ['AND']
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(false);
        });

        // A (True) OR B (False) -> True
        it('should handle OR logic (True OR False)', () => {
            const condition: ScriptCondition = {
                clauses: [
                    createClause('ALTITUDE', '>', 500), // True
                    createClause('VELOCITY', '>', 1000) // False
                ],
                logicalOperators: ['OR']
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(true);
        });

        // A (False) OR B (True) -> True
        it('should handle OR logic (False OR True)', () => {
            const condition: ScriptCondition = {
                clauses: [
                    createClause('ALTITUDE', '<', 500), // False
                    createClause('VELOCITY', '<', 1000) // True
                ],
                logicalOperators: ['OR']
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(true);
        });

        // A (False) OR B (False) -> False
        it('should handle OR logic (False OR False)', () => {
            const condition: ScriptCondition = {
                clauses: [
                    createClause('ALTITUDE', '<', 500), // False
                    createClause('VELOCITY', '>', 1000) // False
                ],
                logicalOperators: ['OR']
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(false);
        });
    });

    describe('evaluateCondition - Mixed Operators (Precedence)', () => {
        // Current implementation evaluates left-to-right.
        // A AND B OR C
        // (A && B) || C

        it('should evaluate A AND B OR C as (A && B) || C', () => {
            // Case 1: A=True, B=False, C=True
            // (T && F) || T -> F || T -> T
            // Standard Precedence: T && F || T -> F || T -> T (Same result here)
            // Let's try to find a case where they differ.
            // A OR B AND C
            // Left-to-right: (A || B) && C
            // Standard: A || (B && C)

            // Case: A=True, B=False, C=False
            // Left-to-right: (T || F) && F -> T && F -> False
            // Standard: T || (F && F) -> T || F -> True

            const condition: ScriptCondition = {
                clauses: [
                    createClause('ALTITUDE', '>', 500),  // A: True (1000 > 500)
                    createClause('VELOCITY', '>', 1000), // B: False (500 > 1000)
                    createClause('FUEL', '<', 0.1)       // C: False (0.8 < 0.1)
                ],
                logicalOperators: ['OR', 'AND']
            };
            // Expectation based on current code: False
            expect(evaluateCondition(executor, condition, telemetry)).toBe(false);
        });

        it('should evaluate A OR B AND C where C is True', () => {
            // A=True, B=False, C=True
            // Left-to-right: (T || F) && T -> T && T -> True
            // Standard: T || (F && T) -> T || F -> True
            // Both True here.

            const condition: ScriptCondition = {
                clauses: [
                    createClause('ALTITUDE', '>', 500),  // A: True
                    createClause('VELOCITY', '>', 1000), // B: False
                    createClause('FUEL', '>', 0.1)       // C: True
                ],
                logicalOperators: ['OR', 'AND']
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(true);
        });
    });

    describe('evaluateCondition - Edge Cases', () => {
        it('should return false for empty clauses', () => {
            const condition: ScriptCondition = {
                clauses: [],
                logicalOperators: []
            };
            expect(evaluateCondition(executor, condition, telemetry)).toBe(false);
        });
    });
});
