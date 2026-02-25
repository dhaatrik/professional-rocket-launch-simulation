import { describe, it } from 'vitest';

describe('PhysicsWorker Allocation Benchmark', () => {
    // Mock data structures matching PhysicsWorker usage
    const missionTime = 123.45;
    const trackedIndex = 0;
    const ftsStatusSource = {
        state: 'SAFE',
        armed: false,
        violation: 'NONE',
        violationMessage: '',
        warningTimer: 0,
        armTimer: 0,
        corridorFraction: 0.1
    };
    const fcStatusSource = {
        status: 'FC: ACTIVE',
        command: 'PITCH 90'
    };

    // Baseline: Create new objects every time
    it('baseline: fresh object allocation', () => {
        const start = performance.now();
        const iterations = 1000000;

        let lastMsg;
        for (let i = 0; i < iterations; i++) {
            const msg = {
                type: 'STATE',
                payload: {
                    missionTime: missionTime + i,
                    trackedIndex,
                    fts: { ...ftsStatusSource }, // Simulate fts.getStatus() creating new object
                    fc: {
                        status: fcStatusSource.status,
                        command: fcStatusSource.command
                    }
                }
            };
            lastMsg = msg;
        }

        const end = performance.now();
        console.log(`Baseline (1M allocs): ${(end - start).toFixed(2)}ms`);
    });

    // Optimized: Reuse object structure
    it('optimized: object reuse', () => {
        const start = performance.now();
        const iterations = 1000000;

        // Reusable containers
        const ftsStatus = {
            state: 'SAFE',
            armed: false,
            violation: 'NONE',
            violationMessage: '',
            warningTimer: 0,
            armTimer: 0,
            corridorFraction: 0
        };
        const fcStatus = {
            status: '',
            command: ''
        };
        const payload = {
            missionTime: 0,
            trackedIndex: 0,
            fts: ftsStatus,
            fc: fcStatus
        };
        const msg = {
            type: 'STATE',
            payload: payload
        };

        let lastMsg;
        for (let i = 0; i < iterations; i++) {
            // Update payload properties
            payload.missionTime = missionTime + i;
            payload.trackedIndex = trackedIndex;

            // Update FTS status in place (simulating fts.writeStatus)
            ftsStatus.state = ftsStatusSource.state;
            ftsStatus.armed = ftsStatusSource.armed;
            ftsStatus.violation = ftsStatusSource.violation;
            ftsStatus.violationMessage = ftsStatusSource.violationMessage;
            ftsStatus.warningTimer = ftsStatusSource.warningTimer;
            ftsStatus.armTimer = ftsStatusSource.armTimer;
            ftsStatus.corridorFraction = ftsStatusSource.corridorFraction;

            // Update FC status in place
            fcStatus.status = fcStatusSource.status;
            fcStatus.command = fcStatusSource.command;

            lastMsg = msg;
        }

        const end = performance.now();
        console.log(`Optimized (1M reuses): ${(end - start).toFixed(2)}ms`);
    });
});
