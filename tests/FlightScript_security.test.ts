import { describe, it, expect } from 'vitest';
import { deserializeScript } from '../src/guidance/FlightScript';

describe('FlightScript Security', () => {
    it('should reject malformed commands', () => {
        const payload = JSON.stringify({
            name: "Test",
            createdAt: 123,
            commands: [ { invalid: "command" } ]
        });
        const result = deserializeScript(payload);
        expect(result).toBeNull();
    });

    it('should reject missing condition fields', () => {
        const payload = JSON.stringify({
            name: "Test",
            createdAt: 123,
            commands: [ { id: 1, rawText: "a", oneShot: true, state: "pending", action: { type: "PITCH" } } ]
        });
        const result = deserializeScript(payload);
        expect(result).toBeNull();
    });

    it('should reject malformed action fields', () => {
        const payload = JSON.stringify({
            name: "Test",
            createdAt: 123,
            commands: [ { id: 1, rawText: "a", oneShot: true, state: "pending", action: { invalid: "invalid" }, condition: { clauses: [], logicalOperators: [] } } ]
        });
        const result = deserializeScript(payload);
        expect(result).toBeNull();
    });

    it('should reject invalid array types', () => {
        const payload = JSON.stringify({
            name: "Test",
            createdAt: 123,
            commands: [ { id: 1, rawText: "a", oneShot: true, state: "pending", action: { type: "PITCH" }, condition: { clauses: "invalid", logicalOperators: [] } } ]
        });
        const result = deserializeScript(payload);
        expect(result).toBeNull();
    });

    it('should reject valid object structure when command fields have incorrect type', () => {
        const payload = JSON.stringify({
            name: "Test",
            createdAt: 123,
            commands: [ { id: "1", rawText: "a", oneShot: true, state: "pending", action: { type: "PITCH" }, condition: { clauses: [], logicalOperators: [] } } ]
        });
        const result = deserializeScript(payload);
        expect(result).toBeNull();
    });
});
