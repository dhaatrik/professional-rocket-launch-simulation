import { describe, it, expect, beforeEach } from 'vitest';
import { FlightTerminationSystem } from '../../src/safety/FlightTermination';
import type { IVessel } from '../../src/types/index';

function createMockVessel(overrides: Partial<IVessel> = {}): IVessel {
    const vessel = {
        x: 0, y: 0, vx: 0, vy: 0, angle: 0, h: 40,
        active: true, crashed: false,
        ...overrides
    } as IVessel;

    if (!vessel.explode) {
        vessel.explode = () => { vessel.active = false; };
    }

    return vessel;
}

describe('FlightTerminationSystem', () => {
    let fts: FlightTerminationSystem;
    const dt = 0.1;

    beforeEach(() => {
        fts = new FlightTerminationSystem();
        fts.setLaunchPosition(0);
    });

    it('should initialize to SAFE state', () => {
        const status = fts.getStatus();
        expect(status.state).toBe('SAFE');
        expect(status.armed).toBe(false);
    });

    it('should toggle arm state', () => {
        fts.toggleArm();
        expect(fts.getStatus().armed).toBe(true);

        fts.toggleArm();
        expect(fts.getStatus().armed).toBe(false);
    });

    it('should trigger manual destruct only when armed', () => {
        const v = createMockVessel();
        v.explode = () => { v.active = false; };

        // Safe mode - ignore destruct
        const resultSafe = fts.triggerManualDestruct(v);
        expect(resultSafe).toBe(false);
        expect(v.active).toBe(true);

        // Armed mode - execute destruct
        fts.arm();
        const resultArmed = fts.triggerManualDestruct(v);
        expect(resultArmed).toBe(true);
        expect(fts.getStatus().state).toBe('DESTRUCT');
    });

    it('should detect corridor breach (Safe -> Warning)', () => {
        // v.y = -200 means alt = (0 - (-200) - 40) / 10 = 16m > 10m. FTS active.
        const v = createMockVessel({ x: 5000, y: -200 });

        // Huge deviation > 50km. PPM=10. 50km = 500,000px.
        v.x = 600000; // 60km (600,000 px)
        fts.update(v, 0, dt); // groundY=0

        expect(fts.getStatus().state).toBe('WARNING');
        expect(fts.getStatus().violation).toBe('CORRIDOR_BREACH');
    });

    it('should auto-arm after warning timeout', () => {
        const v = createMockVessel({ x: 600000, y: -200 });

        // Enforce warning state
        fts.update(v, 0, dt);
        expect(fts.getStatus().state).toBe('WARNING');

        // Fast forward > warningDurationS (3.0s)
        for (let i = 0; i < 35; i++) {
            fts.update(v, 0, 0.1);
        }

        expect(fts.getStatus().state).toBe('ARM');
    });

    it('should auto-destruct when ARM timer expires', () => {
        const v = createMockVessel({ x: 600000, y: -200 });
        let exploded = false;
        v.explode = () => { exploded = true; };

        // Transition to WARNING
        fts.update(v, 0, dt);

        // Fast forward to ARM state (>3s)
        for (let i = 0; i < 35; i++) {
            fts.update(v, 0, 0.1);
        }
        expect(fts.getStatus().state).toBe('ARM');

        // Fast forward to DESTRUCT state (>3s in ARM)
        for (let i = 0; i < 35; i++) {
            fts.update(v, 0, 0.1);
        }

        expect(fts.getStatus().state).toBe('DESTRUCT');
        expect(exploded).toBe(true);

        // Further updates shouldn't do anything because destructTriggered is true
        let initialWarningTimer = fts.getStatus().warningTimer;
        fts.update(v, 0, 0.1);
        expect(fts.getStatus().warningTimer).toBe(initialWarningTimer);
    });

    it('should write status to an existing object', () => {
        const outStatus = {
            state: 'DESTRUCT' as any,
            armed: true,
            violation: 'TUMBLE' as any,
            violationMessage: 'test',
            warningTimer: 10,
            armTimer: 10,
            corridorFraction: 1
        };
        fts.writeStatus(outStatus);

        expect(outStatus.state).toBe('SAFE');
        expect(outStatus.armed).toBe(false);
        expect(outStatus.violation).toBe('NONE');
        expect(outStatus.violationMessage).toBe('');
        expect(outStatus.warningTimer).toBe(0);
        expect(outStatus.armTimer).toBe(0);
        expect(outStatus.corridorFraction).toBe(0);
    });

    it('should do nothing if vessel is crashed', () => {
        const v = createMockVessel({ crashed: true, y: -200 });
        fts.update(v, 0, dt);
        expect(fts.getStatus().corridorFraction).toBe(0);
    });

    it('should return to SAFE and reset timers if alt < 10m', () => {
        const v = createMockVessel({ y: -200, x: 600000 }); // Trigger warning initially
        fts.update(v, 0, dt);
        expect(fts.getStatus().state).toBe('WARNING');

        // Drop back below 10m altitude (v.y = 0 means alt = (0 - 0 - 40)/10 = -4m)
        v.y = 0;
        fts.update(v, 0, dt);

        const status = fts.getStatus();
        expect(status.state).toBe('SAFE');
        expect(status.violation).toBe('NONE');
        expect(status.warningTimer).toBe(0);
    });

    it('should detect TUMBLE violation based on angular rate', () => {
        const v = createMockVessel({ y: -200, angle: 0 });
        fts.update(v, 0, dt); // First update sets lastAngle

        // dt is 0.1, maxTumbleRate is 90 deg/s. 10 degrees in 0.1s is 100 deg/s
        v.angle = 10 * (Math.PI / 180);
        fts.update(v, 0, dt);

        expect(fts.getStatus().violation).toBe('TUMBLE');
        expect(fts.getStatus().state).toBe('WARNING');
    });

    it('should detect ALTITUDE breach', () => {
        // maxAlt is 500,000m. 500,001m requires y = -(500001 * 10 + 40) = -5000050
        const v = createMockVessel({ y: -5000050 });
        fts.update(v, 0, dt);

        expect(fts.getStatus().violation).toBe('CORRIDOR_BREACH');
        expect(fts.getStatus().violationMessage).toContain('ALTITUDE');
    });

    it('should detect TRAJECTORY_DEVIATION', () => {
        // High velocity > 50 and high deviation angle.
        // maxDeviation is 45 degrees.
        // vx=50, vy=50 -> 45 deg angle exactly.
        // vx=100, vy=0 -> 90 deg deviation (horizontal)
        const v = createMockVessel({ y: -200, vx: 100, vy: 0 });
        fts.update(v, 0, dt);

        expect(fts.getStatus().violation).toBe('TRAJECTORY_DEVIATION');
        expect(fts.getStatus().state).toBe('WARNING');
    });

    it('should trigger WARNING pre-warning log (coverage for random logic)', async () => {
         // Use dynamic import instead of require
         const { state } = await import('../../src/core/State');
         const mockLog = { log: () => {} };
         state.missionLog = mockLog as any;

         // Corridor fraction > 0.75 without triggering full breach
         // 50km width. 75% is 37.5km. Let's do 40km (400,000px)
         const v = createMockVessel({ x: 400000, y: -200 });
         fts.update(v, 0, dt);

         expect(fts.getStatus().state).toBe('SAFE');
    });

    it('should clear violation from WARNING state and return to SAFE', () => {
        const v = createMockVessel({ x: 600000, y: -200 }); // Trigger warning
        fts.update(v, 0, dt);
        expect(fts.getStatus().state).toBe('WARNING');

        // Move back into corridor
        v.x = 0;
        fts.update(v, 0, dt);
        expect(fts.getStatus().state).toBe('SAFE');
        expect(fts.getStatus().warningTimer).toBe(0);
    });

    it('should clear violation from ARM state and return to SAFE', () => {
        const v = createMockVessel({ x: 600000, y: -200 }); // Trigger warning
        fts.update(v, 0, dt);

        // Advance to ARM
        for (let i = 0; i < 35; i++) {
            fts.update(v, 0, 0.1);
        }
        expect(fts.getStatus().state).toBe('ARM');

        // Move back into corridor
        v.x = 0;
        fts.update(v, 0, dt);
        expect(fts.getStatus().state).toBe('SAFE');
        expect(fts.getStatus().armTimer).toBe(0);
    });

    it('should reset fully when reset() is called', () => {
        const v = createMockVessel({ x: 600000, y: -200 }); // Trigger warning
        fts.update(v, 0, dt);
        fts.arm();

        fts.reset();
        const status = fts.getStatus();
        expect(status.state).toBe('SAFE');
        expect(status.armed).toBe(false);
        expect(status.violation).toBe('NONE');
        expect(status.warningTimer).toBe(0);
        expect(status.armTimer).toBe(0);
        expect(status.corridorFraction).toBe(0);
    });

    it('should disarm manually if in SAFE or WARNING state', () => {
         fts.arm();
         expect(fts.getStatus().armed).toBe(true);
         fts.disarm();
         expect(fts.getStatus().armed).toBe(false);

         const v = createMockVessel({ x: 600000, y: -200 }); // Trigger warning
         fts.update(v, 0, dt);
         expect(fts.getStatus().state).toBe('WARNING');
         fts.arm();
         fts.disarm();
         expect(fts.getStatus().armed).toBe(false);
    });
});
