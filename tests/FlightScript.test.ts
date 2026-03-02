import { describe, it, expect } from 'vitest';
import {
    parseScriptLine,
    parseMissionScript,
    resetScript,
    serializeScript,
    deserializeScript,
    type MissionScript
} from '../src/guidance/FlightScript';

describe('FlightScript', () => {
    describe('parseScriptLine', () => {
        it('should parse basic command', () => {
            const result = parseScriptLine('WHEN ALTITUDE > 1000 THEN STAGE', 1);
            expect(result.success).toBe(true);
            expect(result.command!.condition.clauses[0]!.variable).toBe('ALTITUDE');
            expect(result.command!.action.type).toBe('STAGE');
        });

        it('should parse complex conditions (AND)', () => {
            const result = parseScriptLine('WHEN VELOCITY > 2000 AND ALTITUDE > 50000 THEN PITCH 45', 2);
            expect(result.success).toBe(true);
            expect(result.command!.condition.logicalOperators[0]).toBe('AND');
            expect(result.command!.action.type).toBe('PITCH');
        });

        it('should normalize throttle', () => {
            const result = parseScriptLine('WHEN TIME == 10 THEN THROTTLE 100', 4);
            expect(result.command?.action.value).toBe(1);
        });

        it('should handle logic errors in syntax', () => {
            expect(parseScriptLine('INVALID', 1).success).toBe(false);
            expect(parseScriptLine('WHEN ALTITUDE > 100', 1).success).toBe(false); // No action
        });
    });

    describe('parseMissionScript', () => {
        it('should parse multi-line script', () => {
            const script = `
                WHEN ALTITUDE > 1000 THEN PITCH 80
                WHEN FUEL < 0.01 THEN STAGE
            `;
            const result = parseMissionScript(script, 'Test');
            expect(result.success).toBe(true);
            expect(result.script?.commands).toHaveLength(2);
        });

        it('should report line numbers for errors', () => {
            const script = `
                WHEN ALTITUDE > 1000 THEN PITCH 80
                INVALID LINE
            `;
            const result = parseMissionScript(script);
            expect(result.success).toBe(false);
            expect(result.errors![0]!.line).toBe(3); // Line 3 (1-indexed, empty line 1)
        });
    });

    describe('Utility Functions', () => {
        it('should serialize and deserialize correctly', () => {
            const original = parseMissionScript('WHEN ALTITUDE > 1000 THEN STAGE', 'Test').script!;
            const json = serializeScript(original);
            const restored = deserializeScript(json);

            expect(restored).toBeDefined();
            expect(restored!.name).toBe(original.name);
            expect(restored!.commands).toHaveLength(original.commands.length);
            expect(restored!.commands[0]!.rawText).toBe(original.commands[0]!.rawText);
        });

        it('should reset script state', () => {
            const script = parseMissionScript('WHEN ALTITUDE > 1000 THEN STAGE').script!;
            if (script && script.commands.length > 0) {
                script.commands[0]!.state = 'completed';
                resetScript(script);
                expect(script.commands[0]!.state).toBe('pending');
            }
        });

        it('should return null when deserializing invalid JSON', () => {
            const restored = deserializeScript('{ invalid json ');
            expect(restored).toBeNull();
        });
    });
});
