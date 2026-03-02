import { describe, it, expect } from 'vitest';
import { FlightComputer } from '../src/guidance/FlightComputer';
import { MissionScript, ScriptCommand } from '../src/guidance/FlightScript';

describe('FlightComputer getCompletedCount benchmark', () => {
    it('measures performance of getCompletedCount', () => {
        const fc = new FlightComputer(0);
        const commands: ScriptCommand[] = [];
        for (let i = 0; i < 10000; i++) {
            commands.push({
                type: 'ACTION',
                condition: { clauses: [], logicalOperators: [] },
                action: { type: 'PITCH', value: 0 },
                state: i % 2 === 0 ? 'completed' : 'pending',
                oneShot: true,
                rawText: ''
            } as any);
        }
        const script: MissionScript = {
            name: 'Test Script',
            commands
        };
        // Avoid loadParsedScript as it resets the script commands to pending
        fc.state.script = script;

        const start = performance.now();
        let total = 0;
        for (let i = 0; i < 10000; i++) {
            total += fc.getCompletedCount();
        }
        const end = performance.now();

        console.log(`Execution time: ${end - start} ms`);
        expect(total).toBe(5000 * 10000);
    });
});
