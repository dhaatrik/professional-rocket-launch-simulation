import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReliabilitySystem, DEFAULT_RELIABILITY_CONFIG } from '../../src/physics/Reliability';
import { secureRandom } from '../../src/utils/Security';
import { state } from '../../src/core/State';

vi.mock('../../src/utils/Security', () => ({
    secureRandom: vi.fn()
}));

vi.mock('../../src/core/State', () => ({
    state: {
        missionLog: {
            log: vi.fn()
        }
    }
}));

describe('ReliabilitySystem', () => {
    let reliability: ReliabilitySystem;

    beforeEach(() => {
        vi.clearAllMocks();
        reliability = new ReliabilitySystem();
    });

    it('should initialize with default config', () => {
        expect(reliability.config).toEqual(DEFAULT_RELIABILITY_CONFIG);
        expect(reliability.activeFailures.size).toBe(0);
    });

    it('attemptIgnition should fail based on ignition reliability', () => {
        vi.mocked(secureRandom).mockReturnValue(0.995);
        expect(reliability.attemptIgnition()).toBe(false);
        expect(reliability.activeFailures.has('ENGINE_FLAME_OUT')).toBe(true);

        vi.clearAllMocks();
        reliability = new ReliabilitySystem();
        vi.mocked(secureRandom).mockReturnValue(0.5);
        expect(reliability.attemptIgnition()).toBe(true);
        expect(reliability.activeFailures.has('ENGINE_FLAME_OUT')).toBe(false);
    });

    describe('update', () => {
        it('should accumulate stress and trigger structural fatigue', () => {
            vi.mocked(secureRandom).mockReturnValue(0.999);
            reliability.update(10, 2.0);

            vi.mocked(secureRandom).mockReturnValue(0.0001);
            const failures = reliability.update(1, 1.0);

            expect(failures).toContain('STRUCTURAL_FATIGUE');
            expect(reliability.activeFailures.has('STRUCTURAL_FATIGUE')).toBe(true);
        });

        it('should trigger engine flame out when random is below pEngineFail and stress > 0.1', () => {
            vi.mocked(secureRandom)
                .mockReturnValueOnce(0.0005)
                .mockReturnValueOnce(0.1);

            const failures = reliability.update(1, 1.0);
            expect(failures).toContain('ENGINE_FLAME_OUT');
            expect(reliability.activeFailures.has('ENGINE_FLAME_OUT')).toBe(true);
        });

        it('should trigger engine explosion when random is below pEngineFail and random < 0.05', () => {
            vi.mocked(secureRandom)
                .mockReturnValueOnce(0.0005)
                .mockReturnValueOnce(0.02);

            const failures = reliability.update(1, 1.0);
            expect(failures).toContain('ENGINE_EXPLOSION');
            expect(reliability.activeFailures.has('ENGINE_EXPLOSION')).toBe(true);
        });

        it('should trigger sensor glitch based on electronics reliability', () => {
            vi.mocked(secureRandom)
                .mockReturnValueOnce(0.99)
                .mockReturnValueOnce(0.99)
                .mockReturnValueOnce(0.001);

            const failures = reliability.update(1, 1.0);
            expect(failures).toContain('SENSOR_GLITCH');
            expect(reliability.activeFailures.has('SENSOR_GLITCH')).toBe(true);
        });

        it('should handle transient failures like SENSOR_GLITCH and remove them after duration', () => {
            vi.mocked(secureRandom).mockReturnValue(0.999);

            reliability.triggerFailure('SENSOR_GLITCH');
            expect(reliability.activeFailures.has('SENSOR_GLITCH')).toBe(true);

            reliability.update(4.0, 1.0);
            expect(reliability.activeFailures.has('SENSOR_GLITCH')).toBe(true);

            reliability.update(1.0, 1.0);
            expect(reliability.activeFailures.has('SENSOR_GLITCH')).toBe(false);
        });

        it('should not roll for engine failure if stress is <= 0.1', () => {
            vi.mocked(secureRandom).mockReturnValue(0.0001);
            const failures = reliability.update(1, 0.0);
            expect(failures).not.toContain('ENGINE_FLAME_OUT');
            expect(failures).not.toContain('ENGINE_EXPLOSION');
        });

        it('should trigger multiple failures at once if conditions are met', () => {
            vi.mocked(secureRandom).mockReturnValue(0.9999);
            reliability.update(100, 3.0);

            vi.mocked(secureRandom).mockImplementation(() => {
                return 0.0001;
            });

            const failures = reliability.update(1, 2.0);
            const failuresCopy = [...failures];

            expect(failuresCopy).toContain('ENGINE_EXPLOSION');
            expect(failuresCopy).toContain('SENSOR_GLITCH');
        });

        it('should not push failure if triggerFailure returns false', () => {
             vi.spyOn(reliability, 'triggerFailure').mockReturnValue(false);
             vi.mocked(secureRandom)
                .mockReturnValueOnce(0.0001)
                .mockReturnValueOnce(0.1);

             const failures = reliability.update(1, 1.0);
             expect(failures).not.toContain('ENGINE_FLAME_OUT');
        });
    });

    describe('triggerFailure', () => {
        it('should add failure to active failures and log', () => {
            const result = reliability.triggerFailure('GIMBAL_LOCK');
            expect(result).toBe(true);
            expect(reliability.activeFailures.has('GIMBAL_LOCK')).toBe(true);
            expect(state.missionLog.log).toHaveBeenCalledWith('WARN: TVC Actuator Stuck', 'warn');
        });

        it('should return false if failure is already active (except transient)', () => {
            reliability.triggerFailure('ENGINE_EXPLOSION');
            const result = reliability.triggerFailure('ENGINE_EXPLOSION');
            expect(result).toBe(false);
        });

        it('should return false if transient failure is already active', () => {
            reliability.triggerFailure('SENSOR_GLITCH');
            const result = reliability.triggerFailure('SENSOR_GLITCH');
            expect(result).toBe(false);
        });

        it('should extend duration if SENSOR_GLITCH is triggered again but not active (handled by map)', () => {
            vi.mocked(secureRandom).mockReturnValue(0.999);

            reliability.triggerFailure('SENSOR_GLITCH');
            expect(reliability.activeFailures.has('SENSOR_GLITCH')).toBe(true);

            reliability.update(5.0, 1.0);
            expect(reliability.activeFailures.has('SENSOR_GLITCH')).toBe(false);

            const result = reliability.triggerFailure('SENSOR_GLITCH');
            expect(result).toBe(true);
        });

        it('should use default duration of 5.0 for SENSOR_GLITCH if not provided in config', () => {
            vi.mocked(secureRandom).mockReturnValue(0.999);

            const configWithoutDuration = { ...DEFAULT_RELIABILITY_CONFIG, sensorGlitchDuration: undefined };
            const r2 = new ReliabilitySystem(configWithoutDuration);
            r2.triggerFailure('SENSOR_GLITCH');
            expect(r2.activeFailures.has('SENSOR_GLITCH')).toBe(true);

            r2.update(4.9, 1.0);
            expect(r2.activeFailures.has('SENSOR_GLITCH')).toBe(true);
            r2.update(0.1, 1.0);
            expect(r2.activeFailures.has('SENSOR_GLITCH')).toBe(false);
        });

        it('should correctly log different severity messages', () => {
            reliability.triggerFailure('ENGINE_FLAME_OUT');
            expect(state.missionLog.log).toHaveBeenCalledWith('ALERT: Engine Flameout Detected!', 'warn');

            reliability.triggerFailure('STRUCTURAL_FATIGUE');
            expect(state.missionLog.log).toHaveBeenCalledWith('CRITICAL: Structural Integrity Failed!', 'warn');

            reliability.triggerFailure('SENSOR_GLITCH');
            expect(state.missionLog.log).toHaveBeenCalledWith('WARN: Telemetry Sensor Glitch', 'info');
        });

        it('should not log if state.missionLog is not set', () => {
            const originalLog = state.missionLog;
            state.missionLog = null as any;

            expect(() => {
                reliability.triggerFailure('ENGINE_EXPLOSION');
            }).not.toThrow();

            state.missionLog = originalLog;
        });

        it('should not log if msg is empty (unknown type)', () => {
            const originalLog = state.missionLog;
            state.missionLog = { log: vi.fn() } as any;

            reliability.triggerFailure('UNKNOWN_TYPE' as any);
            expect(state.missionLog.log).not.toHaveBeenCalled();

            state.missionLog = originalLog;
        });
    });
});
