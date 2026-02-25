/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { MissionLog } from '../src/ui/MissionLog';

describe('MissionLog Memory Leak Check', () => {
    it('should limit the number of stored events', () => {
        // Setup DOM
        document.body.innerHTML = '<ul id="log-list"></ul>';

        const missionLog = new MissionLog();
        const iterations = 1000;

        // Log many events
        for (let i = 0; i < iterations; i++) {
            missionLog.log(`Event ${i}`, 'info');
        }

        // Access private events array
        const events = (missionLog as any).events;

        // This should now be capped at 100 (maxHistory)
        expect(events.length).toBeLessThanOrEqual(100);
        expect(events.length).toBe(100);

        // Verify the content is the most recent ones
        expect(events[99].msg).toBe(`Event ${iterations - 1}`);
        expect(events[0].msg).toBe(`Event ${iterations - 100}`);
    });
});
