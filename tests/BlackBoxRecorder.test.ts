import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BlackBoxRecorder } from '../src/telemetry/BlackBoxRecorder';
import { IVessel, EngineState } from '../src/types';
import { PIXELS_PER_METER, GRAVITY } from '../src/config/Constants';

describe('BlackBoxRecorder', () => {
    let recorder: BlackBoxRecorder;
    const groundY = 1000;

    // Mock vessel
    const mockVessel: IVessel = {
        x: 0,
        y: 900, // 100 pixels above ground (10m)
        vx: 10,
        vy: -20, // Moving up (negative Y is up in canvas)
        angle: 0,
        gimbalAngle: 0,
        mass: 1000,
        w: 10,
        h: 10,
        throttle: 1,
        fuel: 0.8,
        active: true,
        maxThrust: 20000,
        crashed: false,
        cd: 0.5,
        q: 100,
        apogee: 2000,
        health: 100,
        orbitPath: [],
        lastOrbitUpdate: 0,
        aoa: 0.1,
        stabilityMargin: 1,
        isAeroStable: true,
        liftForce: 50,
        dragForce: 10,
        skinTemp: 300,
        heatShieldRemaining: 1,
        isAblating: false,
        isThermalCritical: false,
        engineState: 'ACTIVE' as unknown as EngineState,
        ignitersRemaining: 1,
        ullageSettled: true,
        actualThrottle: 1,
        prevX: 0,
        prevY: 900,
        prevAngle: 0,
        type: 0,
        applyPhysics: vi.fn(),
        spawnExhaust: vi.fn(),
        draw: vi.fn(),
        explode: vi.fn()
    };

    beforeEach(() => {
        recorder = new BlackBoxRecorder(groundY);
    });

    describe('Initialization', () => {
        it('should initialize in idle state', () => {
            expect(recorder.getState()).toBe('idle');
            expect(recorder.isRecording()).toBe(false);
        });

        it('should have empty frames initially', () => {
            expect(recorder.getFrameCount()).toBe(0);
            expect(recorder.getFrames()).toEqual([]);
        });

        it('should initialize summary with default values', () => {
            const summary = recorder.getSummary();
            expect(summary.missionName).toBe('Mission');
            expect(summary.frameCount).toBe(0);
            expect(summary.maxAltitude).toBe(0);
        });
    });

    describe('State Transitions', () => {
        it('should start recording', () => {
            recorder.start('Test Mission');
            expect(recorder.getState()).toBe('recording');
            expect(recorder.isRecording()).toBe(true);
            expect(recorder.getSummary().missionName).toBe('Test Mission');
            expect(recorder.getSummary().startTime).toBeDefined();
        });

        it('should pause and resume recording', () => {
            recorder.start();
            recorder.pause();
            expect(recorder.getState()).toBe('paused');
            expect(recorder.isRecording()).toBe(false);

            recorder.resume();
            expect(recorder.getState()).toBe('recording');
            expect(recorder.isRecording()).toBe(true);
        });

        it('should stop recording', () => {
            recorder.start();
            recorder.record(mockVessel, 1.0);
            recorder.stop('landed');

            expect(recorder.getState()).toBe('stopped');
            expect(recorder.getSummary().endTime).toBeDefined();
            expect(recorder.getSummary().finalState).toBe('landed');
            expect(recorder.getSummary().duration).toBe(1.0);
        });

        it('should toggle states correctly', () => {
            // Idle -> Start
            recorder.toggle();
            expect(recorder.getState()).toBe('recording');

            // Recording -> Pause
            recorder.toggle();
            expect(recorder.getState()).toBe('paused');

            // Paused -> Resume
            recorder.toggle();
            expect(recorder.getState()).toBe('recording');

            // Stop manually
            recorder.stop();
            expect(recorder.getState()).toBe('stopped');

            // Stopped -> Start (Reset)
            recorder.toggle();
            expect(recorder.getState()).toBe('recording');
            expect(recorder.getFrameCount()).toBe(0); // Should be cleared
        });
    });

    describe('Data Recording', () => {
        beforeEach(() => {
            recorder.start();
        });

        it('should record a frame when recording', () => {
            const missionTime = 1.0;
            recorder.record(mockVessel, missionTime);

            expect(recorder.getFrameCount()).toBe(1);
            const frame = recorder.getFrames()[0]!;

            expect(frame.t).toBe(missionTime);
            // Calculate expected altitude: (groundY - y - h) / PIXELS_PER_METER
            // (1000 - 900 - 10) / PIXELS_PER_METER = 90 / PIXELS_PER_METER
            expect(frame.alt).toBeCloseTo(90 / PIXELS_PER_METER);
            expect(frame.vx).toBe(mockVessel.vx);
            expect(frame.vy).toBe(mockVessel.vy);
            expect(frame.mass).toBe(mockVessel.mass);
        });

        it('should respect sampling rate (20Hz)', () => {
            // First sample
            recorder.record(mockVessel, 1.0);
            expect(recorder.getFrameCount()).toBe(1);

            // Too soon (less than 0.05s)
            recorder.record(mockVessel, 1.02);
            expect(recorder.getFrameCount()).toBe(1);

            // Enough time passed (0.05s)
            recorder.record(mockVessel, 1.06);
            expect(recorder.getFrameCount()).toBe(2);
        });

        it('should not record when paused or stopped', () => {
            recorder.pause();
            recorder.record(mockVessel, 1.0);
            expect(recorder.getFrameCount()).toBe(0);

            recorder.stop();
            recorder.record(mockVessel, 2.0);
            expect(recorder.getFrameCount()).toBe(0);
        });

        it('should calculate derived values correctly', () => {
            // Record two frames to calculate acceleration
            const t1 = 1.0;
            const t2 = 1.1; // 0.1s delta

            // Frame 1
            const v1 = { ...mockVessel, vx: 0, vy: 0 };
            recorder.record(v1, t1);

            // Frame 2: Velocity increased by 10 m/s in 0.1s => Accel = 100 m/s^2
            const v2 = { ...mockVessel, vx: 10, vy: 0 };
            recorder.record(v2, t2);

            const frames = recorder.getFrames();
            expect(frames).toHaveLength(2);

            const frame2 = frames[1]!;
            expect(frame2.accelX).toBeCloseTo(100);
            expect(frame2.accelY).toBeCloseTo(0);

            // G-Force: Proper acceleration includes gravity counteraction (-9.81 in Y)
            // sqrt(100^2 + (-9.81)^2) / 9.81
            const expectedGForce = Math.sqrt(100 * 100 + 9.81 * 9.81) / 9.81;
            expect(frame2.gForce).toBeCloseTo(expectedGForce);
        });

        it('should update summary statistics', () => {
            // Frame 1: Low values
            recorder.record({ ...mockVessel, vx: 10, vy: 10, q: 100 }, 1.0);

            // Frame 2: High values
            // Altitude calculation: (1000 - 0 - 10) / PIXELS_PER_METER = 99m (using y=0 for higher alt)
            const highVessel = {
                ...mockVessel,
                y: 0,
                vx: 100,
                vy: 100,
                q: 500
            };
            recorder.record(highVessel, 1.1);

            const summary = recorder.getSummary();
            expect(summary.maxAltitude).toBeCloseTo(990 / PIXELS_PER_METER);
            expect(summary.maxVelocity).toBeCloseTo(Math.sqrt(100 * 100 + 100 * 100));
            expect(summary.maxQ).toBe(500);
        });
    });

    describe('Utilities', () => {
        it('should clear data', () => {
            recorder.start();
            recorder.record(mockVessel, 1.0);
            recorder.stop();

            expect(recorder.getFrameCount()).toBe(1);

            recorder.clear();
            expect(recorder.getState()).toBe('idle');
            expect(recorder.getFrameCount()).toBe(0);
            expect(recorder.getSummary().frameCount).toBe(0);
        });

        it('should return correct status string', () => {
            expect(recorder.getStatusString()).toBe('');

            recorder.start();
            expect(recorder.getStatusString()).toContain('● REC');

            recorder.pause();
            expect(recorder.getStatusString()).toContain('⏸ PAUSED');

            recorder.stop();
            expect(recorder.getStatusString()).toContain('■');
        });

        it('should return 0 duration if no frames', () => {
            expect(recorder.getDuration()).toBe(0);
        });
    });
});
