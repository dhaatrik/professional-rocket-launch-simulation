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
});
