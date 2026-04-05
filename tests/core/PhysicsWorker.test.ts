import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('PhysicsWorker', () => {
    let workerOnMessage: ((e: MessageEvent) => void) | null = null;
    let postMessageSpy: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        postMessageSpy = vi.fn();

        // Mock self environment for Web Worker
        vi.stubGlobal('self', {
            onmessage: null,
            postMessage: postMessageSpy
        });

        // Load the worker, caching its self.onmessage listener
        await import('../../src/core/PhysicsWorker');
        workerOnMessage = (globalThis as any).self.onmessage;
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it('should initialize successfully', () => {
        expect(workerOnMessage).toBeDefined();

        workerOnMessage!({
            data: {
                type: 'INIT',
                payload: {
                    width: 1920,
                    height: 1080,
                    groundY: 1000,
                }
            }
        } as MessageEvent);

        expect(postMessageSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'STATE',
            payload: expect.any(Object)
        }));
    });

    it('should perform a step', () => {
        workerOnMessage!({
            data: {
                type: 'INIT',
                payload: {}
            }
        } as MessageEvent);
        postMessageSpy.mockClear();

        workerOnMessage!({
            data: {
                type: 'STEP',
                payload: { dt: 0.02, timeScale: 1, controls: { throttle: 1, ignition: true } }
            }
        } as MessageEvent);

        expect(postMessageSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'STATE',
        }));
    });

    it('should handle COMMAND STAGE', () => {
        workerOnMessage!({
            data: {
                type: 'INIT',
                payload: {}
            }
        } as MessageEvent);
        postMessageSpy.mockClear();

        workerOnMessage!({
            data: {
                type: 'COMMAND',
                payload: { type: 'STAGE' }
            }
        } as MessageEvent);

        expect(postMessageSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'EVENT',
            payload: expect.objectContaining({
                name: 'STAGING_S1'
            })
        }));
    });

    it('should handle FC_LOAD_SCRIPT command', () => {
        workerOnMessage!({
            data: {
                type: 'INIT',
                payload: {}
            }
        } as MessageEvent);
        postMessageSpy.mockClear();

        workerOnMessage!({
            data: {
                type: 'COMMAND',
                payload: { type: 'FC_LOAD_SCRIPT', script: 'WHEN ALTITUDE > 1000 THEN PITCH 45' }
            }
        } as MessageEvent);

        expect(postMessageSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'EVENT',
            payload: expect.objectContaining({
                name: 'FC_SCRIPT_LOADED'
            })
        }));
    });
});
