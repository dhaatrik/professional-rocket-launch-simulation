import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PhysicsProxy } from '../src/core/PhysicsProxy';
import {
    BUFFER_SIZE,
    HEADER_SIZE,
    ENTITY_STRIDE,
    HeaderOffset,
    EntityOffset,
    EntityType,
    EngineStateCode
} from '../src/core/PhysicsBuffer';

// Mock Worker
class MockWorker {
    onmessage: ((e: any) => void) | null = null;
    onerror: ((e: any) => void) | null = null;

    postMessage = vi.fn();
    terminate = vi.fn();

    constructor(stringUrl: string, options?: any) {
        // Dummy constructor
    }
}

describe('PhysicsProxy', () => {
    let originalWorker: any;
    let originalSharedArrayBuffer: any;

    beforeEach(() => {
        // Save originals
        originalWorker = global.Worker;
        originalSharedArrayBuffer = global.SharedArrayBuffer;

        // Mock globals
        vi.stubGlobal('Worker', MockWorker);
        vi.stubGlobal('SharedArrayBuffer', class MockSharedArrayBuffer extends ArrayBuffer {
            constructor(length: number) {
                super(length);
            }
        });
    });

    afterEach(() => {
        // Restore globals
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize Worker and SharedArrayBuffer', () => {
            const proxy = new PhysicsProxy();
            expect(proxy).toBeDefined();
            // We can't easily check the private worker directly without casting,
            // but we know it didn't throw and instantiated successfully.
        });

        it('should throw an error if SharedArrayBuffer is not supported', () => {
            // Remove the mock for this specific test
            vi.stubGlobal('SharedArrayBuffer', undefined);

            expect(() => new PhysicsProxy()).toThrow(/SharedArrayBuffer not supported! Ensure COOP\/COEP headers are set/);
        });

        it('should catch and rethrow the exact error from SharedArrayBuffer instantiation', () => {
            const dummyError = new Error('Dummy SharedArrayBuffer error');
            vi.stubGlobal('SharedArrayBuffer', class ThrowingSharedArrayBuffer {
                constructor() {
                    throw dummyError;
                }
            });

            expect(() => new PhysicsProxy()).toThrow(/SharedArrayBuffer not supported! Ensure COOP\/COEP headers are set.*Dummy SharedArrayBuffer error/);

            vi.unstubAllGlobals(); // Restore globals so subsequent tests don't fail

            // Re-apply the mock that the describe block expects for all tests
            vi.stubGlobal('SharedArrayBuffer', class MockSharedArrayBuffer extends ArrayBuffer {
                constructor(length: number) {
                    super(length);
                }
            });
        });

        it('should send INIT message to worker on init()', () => {
            const proxy = new PhysicsProxy();
            const config = { someConfig: true } as any;

            proxy.init(config);

            const worker = (proxy as any).worker as MockWorker;
            expect(worker.postMessage).toHaveBeenCalledWith({
                type: 'INIT',
                payload: {
                    ...config,
                    sharedBuffer: expect.any(global.SharedArrayBuffer)
                }
            });
        });
    });

    describe('Message Passing', () => {
        it('should send STEP message to worker', () => {
            const proxy = new PhysicsProxy();
            const dt = 0.016;
            const inputs = { thrust: 1 };

            proxy.step(dt, inputs);

            const worker = (proxy as any).worker as MockWorker;
            expect(worker.postMessage).toHaveBeenCalledWith({
                type: 'STEP',
                payload: { dt, ...inputs }
            });
        });

        it('should send COMMAND message to worker', () => {
            const proxy = new PhysicsProxy();

            proxy.command('ABORT', { reason: 'test' });

            const worker = (proxy as any).worker as MockWorker;
            expect(worker.postMessage).toHaveBeenCalledWith({
                type: 'COMMAND',
                payload: { type: 'ABORT', reason: 'test' }
            });
        });
    });

    describe('Event Handling', () => {
        it('should handle STATE message from worker', () => {
            const proxy = new PhysicsProxy();
            const worker = (proxy as any).worker as MockWorker;

            const statePayload = {
                missionTime: 10,
                trackedIndex: 1,
                fts: { state: 'ARMED' },
                fc: { status: 'FC: ACTIVE' }
            };

            // Simulate worker message
            if (worker.onmessage) {
                worker.onmessage({ data: { type: 'STATE', payload: statePayload } });
            }

            expect(proxy.getTrackedIndex()).toBe(1);
            expect(proxy.getFTSStatus()).toEqual({ state: 'ARMED' });
            expect(proxy.getFlightComputerStatus()).toEqual({ status: 'FC: ACTIVE' });
        });

        it('should trigger event listeners on EVENT message', () => {
            const proxy = new PhysicsProxy();
            const worker = (proxy as any).worker as MockWorker;

            const eventCallback = vi.fn();
            proxy.onEvent(eventCallback);

            const eventPayload = { eventType: 'EXPLOSION', entityId: 5 };

            // Simulate worker message
            if (worker.onmessage) {
                worker.onmessage({ data: { type: 'EVENT', payload: eventPayload } });
            }

            expect(eventCallback).toHaveBeenCalledWith(eventPayload);
        });
    });

    describe('State Retrieval (Buffer)', () => {
        it('should return default values when buffer is empty', () => {
            const proxy = new PhysicsProxy();
            expect(proxy.getMissionTime()).toBe(0);

            const envState = proxy.getEnvironmentState();
            expect(envState).toMatchObject({
                windVelocity: { x: 0, y: 0 },
                densityMultiplier: 1,
                surfaceWindSpeed: 0,
                surfaceWindDirection: 0
            });
        });

        it('should return populated values from shared view', () => {
            const proxy = new PhysicsProxy();
            const sharedView = (proxy as any).sharedView as Float64Array;

            // Populate header manually
            sharedView[HeaderOffset.TIMESTAMP] = 123.45;
            sharedView[HeaderOffset.WIND_X] = 10;
            sharedView[HeaderOffset.WIND_Y] = 0;
            sharedView[HeaderOffset.DENSITY_MULT] = 1.2;

            expect(proxy.getMissionTime()).toBe(123.45);

            const envState = proxy.getEnvironmentState();
            expect(envState).toMatchObject({
                windVelocity: { x: 10, y: 0 },
                densityMultiplier: 1.2,
                surfaceWindSpeed: 10,
                surfaceWindDirection: 0
            });
        });
    });

    describe('syncView and Interpolation', () => {
        it('should sync view entities from buffer', () => {
            const proxy = new PhysicsProxy();
            const sharedView = (proxy as any).sharedView as Float64Array;

            // Setup buffer
            sharedView[HeaderOffset.TIMESTAMP] = 10.0;
            sharedView[HeaderOffset.ENTITY_COUNT] = 1;

            const base = HEADER_SIZE; // First entity
            sharedView[base + EntityOffset.TYPE] = EntityType.BOOSTER;
            sharedView[base + EntityOffset.X] = 100;
            sharedView[base + EntityOffset.Y] = 200;
            sharedView[base + EntityOffset.ENGINE_STATE] = EngineStateCode.RUNNING;

            proxy.syncView(0.016, 1.0);

            const entities = proxy.getEntities();
            expect(entities.length).toBe(1);

            const booster = entities[0]!;
            expect(booster.type).toBe(EntityType.BOOSTER);
            expect(booster.x).toBe(100);
            expect(booster.y).toBe(200);
            expect((booster as any).engineState).toBe(EngineStateCode.RUNNING);
        });

        it('should resize entities array if count drops', () => {
            const proxy = new PhysicsProxy();
            const sharedView = (proxy as any).sharedView as Float64Array;

            // Setup 2 entities
            sharedView[HeaderOffset.TIMESTAMP] = 1.0;
            sharedView[HeaderOffset.ENTITY_COUNT] = 2;
            sharedView[HEADER_SIZE + EntityOffset.TYPE] = EntityType.BOOSTER;
            sharedView[HEADER_SIZE + ENTITY_STRIDE + EntityOffset.TYPE] = EntityType.PAYLOAD;

            proxy.syncView(0.016, 1.0);
            expect(proxy.getEntities().length).toBe(2);

            // Drop to 1 entity
            sharedView[HeaderOffset.TIMESTAMP] = 2.0;
            sharedView[HeaderOffset.ENTITY_COUNT] = 1;

            proxy.syncView(0.016, 1.0);
            expect(proxy.getEntities().length).toBe(1);
            expect(proxy.getEntities()[0]!.type).toBe(EntityType.BOOSTER);
        });

        it('should calculate interpolation alpha correctly', () => {
            const proxy = new PhysicsProxy();
            const sharedView = (proxy as any).sharedView as Float64Array;

            // Mock the time explicitly since PhysicsProxy uses localRenderTime etc.
            (proxy as any).previousPhysicsTime = 10.0;
            (proxy as any).currentPhysicsTime = 11.0;
            (proxy as any).localRenderTime = 10.5;

            const alpha = proxy.getInterpolationAlpha();
            // (10.5 - 10) / (11 - 10) = 0.5
            expect(alpha).toBeCloseTo(0.5);
        });

        it('should clamp interpolation alpha between 0 and 1', () => {
            const proxy = new PhysicsProxy();

            // Over clamping
            (proxy as any).previousPhysicsTime = 10.0;
            (proxy as any).currentPhysicsTime = 11.0;
            (proxy as any).localRenderTime = 12.0;

            expect(proxy.getInterpolationAlpha()).toBeCloseTo(1.0); // Clamped to 1

            // Under clamping
            (proxy as any).previousPhysicsTime = 10.0;
            (proxy as any).currentPhysicsTime = 11.0;
            (proxy as any).localRenderTime = 9.0;

            expect(proxy.getInterpolationAlpha()).toBeCloseTo(0.0); // Clamped to 0
        });
    });

    describe('Termination', () => {
        it('should terminate the worker', () => {
            const proxy = new PhysicsProxy();
            const worker = (proxy as any).worker as MockWorker;

            proxy.terminate();

            expect(worker.terminate).toHaveBeenCalled();
        });
    });
});
