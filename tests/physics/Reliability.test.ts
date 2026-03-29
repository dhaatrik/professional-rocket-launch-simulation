import { ReliabilitySystem, DEFAULT_RELIABILITY_CONFIG, ReliabilityConfig } from '../../src/physics/Reliability';
import { state } from '../../src/core/State';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('ReliabilitySystem', () => {
    let reliability: ReliabilitySystem;
    const mockLog = { log: vi.fn() };

    beforeEach(() => {
        // Mock state.missionLog
        // We cast to any because the actual interface is complex but we only use log() here
        state.missionLog = mockLog as any;

        reliability = new ReliabilitySystem();
        vi.spyOn(Math, 'random');
    });

    afterEach(() => {
        state.missionLog = null;
        vi.restoreAllMocks();
    });

    it('should initialize with default configuration', () => {
        expect(reliability.config).toEqual(DEFAULT_RELIABILITY_CONFIG);
        expect(reliability.activeFailures.size).toBe(0);
    });

    describe('attemptIgnition', () => {
        it('should succeed when random value is below reliability threshold', () => {
            // ignitionReliability is typically 0.99
            // Success condition: Math.random() <= ignitionReliability
            // Wait, code says: if (Math.random() > this.config.ignitionReliability) { fail }
            // So if random is 0.5, 0.5 > 0.99 is false -> Success

            vi.mocked(Math.random).mockReturnValue(0.5);

            const result = reliability.attemptIgnition();
            expect(result).toBe(true);
            expect(reliability.activeFailures).not.toContain('ENGINE_FLAME_OUT');
        });

        it('should fail when random value is above reliability threshold', () => {
            // Failure condition: Math.random() > 0.99
            vi.mocked(Math.random).mockReturnValue(0.999);

            const result = reliability.attemptIgnition();
            expect(result).toBe(false);
            expect(reliability.activeFailures).toContain('ENGINE_FLAME_OUT');
            expect(mockLog.log).toHaveBeenCalledWith(expect.stringContaining('Engine Flameout'), 'warn');
        });
    });

    describe('update', () => {
        it('should not trigger failures when random values are high (safe)', () => {
            // Force random to return 1.0 (safe for all checks as they usually check random < prob)
            vi.mocked(Math.random).mockReturnValue(1.0);

            const failures = reliability.update(1.0, 1.0); // dt=1, stress=1
            expect(failures).toHaveLength(0);
            expect(reliability.activeFailures.size).toBe(0);
        });

        it('should trigger engine flameout on failure', () => {
            // Config specific for testing
            const testConfig: ReliabilityConfig = {
                ...DEFAULT_RELIABILITY_CONFIG,
                mtbfEngine: 100, // High failure rate
            };
            reliability = new ReliabilitySystem(testConfig);

            // mocking sequence for update()
            // 1. Engine failure check: needs to return < pEngineFail.
            //    pEngineFail = (1/100) * wear * dt. Approx 0.01.
            //    Return 0.001 to trigger failure check.
            // 2. Explosion check: needs to return >= 0.05 to trigger FLAME_OUT (else EXPLOSION).
            //    Return 0.1 to trigger FLAME_OUT.
            // 3. Structure failure check: Return 1.0 (safe).
            // 4. Sensor failure check: Return 1.0 (safe).

            vi.mocked(Math.random)
                .mockReturnValueOnce(0.001) // Engine fail check
                .mockReturnValueOnce(0.1)   // Explosion check (0.1 > 0.05 -> Flameout)
                .mockReturnValueOnce(1.0)   // Structure
                .mockReturnValueOnce(1.0);  // Sensor

            const failures = reliability.update(1.0, 1.0); // dt=1, stress=1 (engine active)

            expect(failures).toContain('ENGINE_FLAME_OUT');
            expect(reliability.activeFailures).toContain('ENGINE_FLAME_OUT');
        });

        it('should trigger engine explosion on catastrophic failure', () => {
            const testConfig: ReliabilityConfig = {
                ...DEFAULT_RELIABILITY_CONFIG,
                mtbfEngine: 100,
            };
            reliability = new ReliabilitySystem(testConfig);

            // Sequence:
            // 1. Engine fail check: < pEngineFail -> 0.001
            // 2. Explosion check: < 0.05 -> 0.01 (Explosion!)
            // 3. Structure: 1.0
            // 4. Sensor: 1.0

            vi.mocked(Math.random)
                .mockReturnValueOnce(0.001)
                .mockReturnValueOnce(0.01)
                .mockReturnValueOnce(1.0)
                .mockReturnValueOnce(1.0);

            const failures = reliability.update(1.0, 1.0);

            expect(failures).toContain('ENGINE_EXPLOSION');
            expect(reliability.activeFailures).toContain('ENGINE_EXPLOSION');
            expect(mockLog.log).toHaveBeenCalledWith(expect.stringContaining('Catastrophic'), 'warn');
        });

        it('should trigger structural fatigue under high stress', () => {
             // Config
             const testConfig: ReliabilityConfig = {
                ...DEFAULT_RELIABILITY_CONFIG,
            };
            reliability = new ReliabilitySystem(testConfig);

            // Accumulate stress. update() adds (stress - 1.0) * dt to accumulator if stress > 1.2
            // Let's call update with high stress first to build up accumulator.
            // We need accumulator to be high enough so pStructFail > random.
            // pStructFail = (accumulator / 100) * dt * 0.01

            // Step 1: Accumulate stress. Pass random=1.0 to avoid any failures during accumulation.
            vi.mocked(Math.random).mockReturnValue(1.0);
            reliability.update(100.0, 2.0); // dt=100, stress=2.0. Accum += (1.0)*100 = 100.

            // Now accumulator is 100.
            // pStructFail = (100 / 100) * 1.0 * 0.01 = 0.01.

            // Step 2: Trigger failure
            // Sequence:
            // 1. Engine: 1.0 (safe)
            // 2. Structure: < 0.01 -> 0.005 (Fail!)
            // 3. Sensor: 1.0 (safe)

            vi.mocked(Math.random)
                .mockReturnValueOnce(1.0)   // Engine
                .mockReturnValueOnce(0.005) // Structure
                .mockReturnValueOnce(1.0);  // Sensor

            const failures = reliability.update(1.0, 1.0);

            expect(failures).toContain('STRUCTURAL_FATIGUE');
            expect(reliability.activeFailures).toContain('STRUCTURAL_FATIGUE');
        });

        it('should trigger sensor glitch and handle transient duration', () => {
             const testConfig: ReliabilityConfig = {
                ...DEFAULT_RELIABILITY_CONFIG,
                mtbfElectronics: 100, // High failure rate
                sensorGlitchDuration: 2.0
            };
            reliability = new ReliabilitySystem(testConfig);

            // pSensorFail = (1/100) * 1.0 = 0.01

            // Trigger failure
            // Sequence with stress=0 (Engine check skipped):
            // 1. Structure: 1.0
            // 2. Sensor: < 0.01 -> 0.005 (Fail!)

            vi.mocked(Math.random)
                .mockReturnValueOnce(1.0)
                .mockReturnValueOnce(0.001);

            // First update: dt=0.5.
            // Trigger adds duration 2.0.
            // Loop decrements 0.5 -> 1.5 remaining.
            let failures = reliability.update(0.5, 0);

            expect(failures).toContain('SENSOR_GLITCH');
            expect(reliability.activeFailures).toContain('SENSOR_GLITCH');

            // Update 2: dt=1.0.
            // Loop decrements 1.0 -> 0.5 remaining.
            // It should still be active.
            vi.mocked(Math.random).mockReturnValue(1.0); // No new failures
            failures = reliability.update(1.0, 0);
            expect(reliability.activeFailures).toContain('SENSOR_GLITCH');

            // Update 3: dt=1.0.
            // Loop decrements 1.0 -> -0.5.
            // It should be removed.
            vi.mocked(Math.random).mockReturnValue(1.0);
            failures = reliability.update(1.0, 0);
            expect(reliability.activeFailures).not.toContain('SENSOR_GLITCH');
        });
    });
});
