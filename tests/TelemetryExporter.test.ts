import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    framesToCSV,
    framesToJSON,
    exportToCSV,
    exportToJSON,
    exportFlightData
} from '../src/telemetry/TelemetryExporter';
import { FlightDataFrame, FlightSummary } from '../src/telemetry/BlackBoxRecorder';
import { EngineStateCode } from '../src/core/PhysicsBuffer';

describe('TelemetryExporter', () => {
    const mockSummary: FlightSummary = {
        missionName: 'Test Mission Space',
        startTime: new Date('2023-01-01T12:00:00Z'),
        endTime: new Date('2023-01-01T12:05:00Z'),
        duration: 300,
        maxAltitude: 10000,
        maxVelocity: 500,
        maxGForce: 3,
        maxQ: 50000,
        maxMach: 1.5,
        finalState: 'landed',
        frameCount: 2,
        sampleRate: 20
    };

    const mockFrames: FlightDataFrame[] = [
        {
            t: 0,
            alt: 0,
            vx: 0,
            vy: 0,
            speed: 0,
            accelX: 0,
            accelY: 0,
            gForce: 1,
            angle: 90,
            gimbal: 0,
            throttle: 1,
            mass: 1000,
            fuel: 1,
            q: 0,
            mach: 0,
            aoa: 0,
            skinTemp: 300,
            engineState: EngineStateCode.RUNNING,
            apogee: 0
        },
        {
            t: 1,
            alt: 10,
            vx: 0,
            vy: 10,
            speed: 10,
            accelX: 0,
            accelY: 10,
            gForce: 2,
            angle: 90,
            gimbal: 0,
            throttle: 1,
            mass: 990,
            fuel: 0.9,
            q: 10,
            mach: 0.03,
            aoa: 0,
            skinTemp: 305,
            engineState: EngineStateCode.RUNNING,
            apogee: 15
        }
    ];

    beforeEach(() => {
        // Mock URL.createObjectURL and URL.revokeObjectURL
        vi.stubGlobal('URL', {
            createObjectURL: vi.fn(() => 'blob:test-url'),
            revokeObjectURL: vi.fn()
        });

        // Mock document.createElement to intercept anchor creation
        const mockLink = {
            href: '',
            download: '',
            style: { display: '' },
            click: vi.fn()
        };
        vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
            if (tagName === 'a') return mockLink as any;
            return document.createElement(tagName);
        });

        vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
        vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);

        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('framesToCSV', () => {
        it('should return empty string for empty frames', () => {
            expect(framesToCSV([])).toBe('');
        });

        it('should correctly format headers and data rows', () => {
            const csv = framesToCSV(mockFrames);
            const lines = csv.split('\n');

            expect(lines.length).toBe(3); // 1 header + 2 data rows

            // Check headers
            expect(lines[0]).toContain('Time(s),Altitude(m),VelX(m/s),VelY(m/s),Speed(m/s)');

            // Check first row (t=0)
            const firstRow = lines[1]!;
            const firstRowParts = firstRow.split(',');
            expect(firstRowParts[0]).toBe('0.000'); // Time
            expect(firstRowParts[1]).toBe('0.00'); // Altitude
            expect(firstRowParts[17]).toBe('"RUNNING"'); // Engine state

            // Check second row (t=1)
            const secondRow = lines[2]!;
            const secondRowParts = secondRow.split(',');
            expect(secondRowParts[0]).toBe('1.000'); // Time
            expect(secondRowParts[1]).toBe('10.00'); // Altitude
            expect(secondRowParts[17]).toBe('"RUNNING"'); // Engine state
        });

        it('should handle unknown engine states', () => {
            const frameWithUnknownState = {
                ...mockFrames[0],
                engineState: 99 as EngineStateCode // Out of bounds
            };
            const csv = framesToCSV([frameWithUnknownState as FlightDataFrame]);
            const lines = csv.split('\n');
            expect(lines[1]).toContain('"UNKNOWN"');
        });
    });

    describe('framesToJSON', () => {
        it('should generate correct JSON structure', () => {
            const result = framesToJSON(mockFrames, mockSummary);

            expect(result.metadata.version).toBe('1.6.0');
            expect(result.metadata.exportedAt).toBeDefined();
            expect(result.metadata.summary).toEqual(mockSummary);
            expect(result.frames).toEqual(mockFrames);
        });
    });

    describe('export functions', () => {
        it('exportToCSV should trigger download', () => {
            exportToCSV(mockFrames, mockSummary);

            expect(URL.createObjectURL).toHaveBeenCalled();
            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(document.body.appendChild).toHaveBeenCalled();
            expect(document.body.removeChild).toHaveBeenCalled();
        });

        it('exportToJSON should trigger download', () => {
            exportToJSON(mockFrames, mockSummary);

            expect(URL.createObjectURL).toHaveBeenCalled();
            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(document.body.appendChild).toHaveBeenCalled();
            expect(document.body.removeChild).toHaveBeenCalled();
        });

        it('should clean up object URL after a delay', () => {
            exportToCSV(mockFrames, mockSummary);

            expect(URL.revokeObjectURL).not.toHaveBeenCalled();

            vi.runAllTimers();

            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
        });
    });

    describe('exportFlightData', () => {
        it('should return false if no frames', () => {
            const result = exportFlightData([], mockSummary, 'csv');

            expect(result).toBe(false);
            expect(URL.createObjectURL).not.toHaveBeenCalled();
        });

        it('should call exportToCSV and return true when format is csv', () => {
            const result = exportFlightData(mockFrames, mockSummary, 'csv');
            expect(result).toBe(true);
            expect(URL.createObjectURL).toHaveBeenCalled();
        });

        it('should call exportToJSON and return true when format is json', () => {
            const result = exportFlightData(mockFrames, mockSummary, 'json');
            expect(result).toBe(true);
            expect(URL.createObjectURL).toHaveBeenCalled();
        });
    });
});