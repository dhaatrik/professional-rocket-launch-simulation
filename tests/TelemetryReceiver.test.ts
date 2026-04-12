import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TelemetryPacket } from '../src/telemetry/TelemetryTransmitter';

describe('TelemetryReceiver', () => {
    let mockChannel: any;
    let mockMapCtx: any;
    let mockChartCtx: any;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="connection-status"></div>
            <div id="disp-alt"></div>
            <div id="disp-vel"></div>
            <div id="disp-apogee"></div>
            <div id="disp-throttle"></div>
            <div id="disp-fuel"></div>
            <div style="width: 500px; height: 500px;">
                <canvas id="map-canvas"></canvas>
            </div>
            <div style="width: 300px; height: 200px;">
                <canvas id="alt-graph"></canvas>
            </div>
        `;

        // Mock Canvas Contexts
        mockMapCtx = {
            fillRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            save: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            closePath: vi.fn(),
            fill: vi.fn(),
            restore: vi.fn(),
            fillText: vi.fn()
        };

        mockChartCtx = {
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn()
        };

        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((contextId: string) => {
            if (contextId === '2d') {
                // Return a combined mock that satisfies both contexts' methods
                return Object.assign({}, mockMapCtx, mockChartCtx);
            }
            return null as any;
        });

        // Mock BroadcastChannel
        mockChannel = {
            onmessage: null,
            close: vi.fn(),
            postMessage: vi.fn()
        };

        const MockBroadcastChannel = vi.fn(function() {
            return mockChannel;
        });
        vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('should initialize and attach listeners', async () => {
        await import('../src/telemetry/TelemetryReceiver');
        expect(BroadcastChannel).toHaveBeenCalledWith('telemetry_channel');
        expect(mockChannel.onmessage).toBeInstanceOf(Function);
    });

    it('should handle resize events', async () => {
        const mapCanvas = document.getElementById('map-canvas') as HTMLCanvasElement;

        // Ensure parent has initial size before importing
        if (mapCanvas.parentElement) {
            Object.defineProperty(mapCanvas.parentElement, 'clientWidth', { value: 500, configurable: true });
            Object.defineProperty(mapCanvas.parentElement, 'clientHeight', { value: 500, configurable: true });
        }

        await import('../src/telemetry/TelemetryReceiver');

        // Verify initial resize from constructor
        expect(mapCanvas.width).toBe(500);
        expect(mapCanvas.height).toBe(500);

        // Change parent size and dispatch resize
        if (mapCanvas.parentElement) {
            Object.defineProperty(mapCanvas.parentElement, 'clientWidth', { value: 600, configurable: true });
            Object.defineProperty(mapCanvas.parentElement, 'clientHeight', { value: 400, configurable: true });
        }
        window.dispatchEvent(new Event('resize'));

        expect(mapCanvas.width).toBe(600);
        expect(mapCanvas.height).toBe(400);
    });

    it('should handle TELEMETRY_UPDATE messages and update UI', async () => {
        await import('../src/telemetry/TelemetryReceiver');

        const packet: TelemetryPacket = {
            timestamp: 12345,
            missionTime: 12.34,
            altitude: 1000.5,
            velocity: 150.2,
            fuel: 0.85,
            throttle: 0.9,
            position: { x: 100, y: 1000 },
            velocityVector: { x: 10, y: 150 },
            stage: 1,
            liftoff: true,
            apogee: 1500,
            status: 'FLYING'
        };

        // Trigger message
        mockChannel.onmessage({
            origin: window.location.origin,
            data: {
                type: 'TELEMETRY_UPDATE',
                payload: packet
            },
            origin: window.location.origin
        });

        // Check UI updates
        expect(document.getElementById('disp-alt')?.textContent).toBe('1001');
        expect(document.getElementById('disp-vel')?.textContent).toBe('150');
        expect(document.getElementById('disp-apogee')?.textContent).toBe('1.5');
        expect(document.getElementById('disp-throttle')?.textContent).toBe('90');
        expect(document.getElementById('disp-fuel')?.textContent).toBe('85.0');
        expect(document.getElementById('connection-status')?.textContent).toBe('CONNECTED - T+12.3');
    });

    it('should ignore unknown message types', async () => {
        await import('../src/telemetry/TelemetryReceiver');

        // Set initial values
        const dispAlt = document.getElementById('disp-alt')!;
        dispAlt.textContent = '0';

        // Trigger unknown message
        mockChannel.onmessage({
            data: {
                type: 'UNKNOWN_MSG',
                payload: {}
            },
            origin: window.location.origin
        });

        // Check UI has not updated
        expect(dispAlt.textContent).toBe('0');
    });
});
