import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TelemetryTransmitter, TelemetryPacket } from '../src/telemetry/TelemetryTransmitter';

describe('TelemetryTransmitter', () => {
    let mockChannel: any;

    beforeEach(() => {
        // Mock BroadcastChannel
        mockChannel = {
            postMessage: vi.fn(),
            close: vi.fn()
        };

        // Use a standard function for the mock implementation to allow 'new'
        const MockBroadcastChannel = vi.fn(function() {
            return mockChannel;
        });
        vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

        // Mock performance.now
        vi.spyOn(performance, 'now').mockReturnValue(0);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize with correct channel name', () => {
        new TelemetryTransmitter();
        expect(BroadcastChannel).toHaveBeenCalledWith('telemetry_channel');
    });

    it('should broadcast data when enough time has passed', () => {
        const transmitter = new TelemetryTransmitter();
        const packet: TelemetryPacket = {
            timestamp: 1234567890,
            missionTime: 10,
            altitude: 500,
            velocity: 100,
            fuel: 900,
            throttle: 1,
            position: { x: 0, y: 500 },
            velocityVector: { x: 0, y: 100 },
            stage: 1,
            liftoff: true,
            apogee: 550,
            status: 'FLYING'
        };

        // Ensure first broadcast passes (time >= 100)
        vi.spyOn(performance, 'now').mockReturnValue(1000);

        transmitter.broadcast(packet);

        expect(mockChannel.postMessage).toHaveBeenCalledWith({
            type: 'TELEMETRY_UPDATE',
            payload: packet
        });
    });

    it('should respect rate limit', () => {
        const transmitter = new TelemetryTransmitter();
        const packet: TelemetryPacket = {
            timestamp: 1234567890,
            missionTime: 10,
            altitude: 500,
            velocity: 100,
            fuel: 900,
            throttle: 1,
            position: { x: 0, y: 500 },
            velocityVector: { x: 0, y: 100 },
            stage: 1,
            liftoff: true,
            apogee: 550,
            status: 'FLYING'
        };

        // First broadcast (t=1000)
        vi.spyOn(performance, 'now').mockReturnValue(1000);
        transmitter.broadcast(packet);
        expect(mockChannel.postMessage).toHaveBeenCalledTimes(1);

        // Immediate subsequent broadcast (t=1050)
        vi.spyOn(performance, 'now').mockReturnValue(1050);
        transmitter.broadcast(packet);
        expect(mockChannel.postMessage).toHaveBeenCalledTimes(1); // Should not increase

        // After rate limit (t=1100)
        vi.spyOn(performance, 'now').mockReturnValue(1100);
        transmitter.broadcast(packet);
        expect(mockChannel.postMessage).toHaveBeenCalledTimes(2);
    });

    it('should close the channel', () => {
        const transmitter = new TelemetryTransmitter();
        transmitter.close();
        expect(mockChannel.close).toHaveBeenCalled();
    });
});
