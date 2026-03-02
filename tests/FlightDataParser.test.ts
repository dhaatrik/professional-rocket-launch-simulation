import { describe, it, expect, vi } from 'vitest';
import { FlightDataParser, FlightFrame } from '../src/analysis/FlightDataParser';

describe('FlightDataParser', () => {
    describe('parseCSV', () => {
        it('should parse valid CSV content with all fields', () => {
            const csv = `timestamp,missionTime,altitude,velocity,fuel,throttle,q,gForce,angle,posX,posY,event
1000,10.5,500.2,100.1,90.5,1.0,0.5,1.2,45.0,10.0,20.0,StageSeparation`;

            const frames = FlightDataParser.parseCSV(csv);

            expect(frames).toHaveLength(1);
            const frame = frames[0]!;
            expect(frame.timestamp).toBe(1000);
            expect(frame.missionTime).toBe(10.5);
            expect(frame.altitude).toBe(500.2);
            expect(frame.velocity).toBe(100.1);
            expect(frame.fuel).toBe(90.5);
            expect(frame.throttle).toBe(1.0);
            expect(frame.q).toBe(0.5);
            expect(frame.gForce).toBe(1.2);
            expect(frame.angle).toBe(45.0);
            expect(frame.posX).toBe(10.0);
            expect(frame.posY).toBe(20.0);
            expect(frame.event).toBe('StageSeparation');
        });

        it('should handle missing optional fields', () => {
            const csv = `missionTime,altitude
20.5,1000.5`;
            const frames = FlightDataParser.parseCSV(csv);

            expect(frames).toHaveLength(1);
            expect(frames[0]!.missionTime).toBe(20.5);
            expect(frames[0]!.altitude).toBe(1000.5);
            expect(frames[0]!.timestamp).toBeUndefined();
        });

        it('should handle extra whitespace', () => {
            const csv = ` missionTime , altitude
 30.5 , 1500.5 `;
            const frames = FlightDataParser.parseCSV(csv);

            expect(frames).toHaveLength(1);
            expect(frames[0]!.missionTime).toBe(30.5);
            expect(frames[0]!.altitude).toBe(1500.5);
        });

        it('should return empty array for empty or invalid CSV', () => {
            expect(FlightDataParser.parseCSV('')).toEqual([]);
            expect(FlightDataParser.parseCSV('headerOnly')).toEqual([]);
        });

        it('should skip lines with mismatched column counts', () => {
            const csv = `missionTime,altitude
40.5,2000.5
50.5`; // Missing altitude
            const frames = FlightDataParser.parseCSV(csv);

            expect(frames).toHaveLength(1);
            expect(frames[0]!.missionTime).toBe(40.5);
        });

        it('should parse non-numeric values as NaN', () => {
            const csv = `missionTime,altitude
abc,def`;
            const frames = FlightDataParser.parseCSV(csv);

            expect(frames).toHaveLength(1);
            expect(frames[0]!.missionTime).toBeNaN();
            expect(frames[0]!.altitude).toBeNaN();
        });
    });

    describe('parseJSON', () => {
        it('should parse valid JSON array', () => {
            const json = `[
                { "missionTime": 10.5, "altitude": 500.2 },
                { "missionTime": 11.5, "altitude": 510.2 }
            ]`;
            const frames = FlightDataParser.parseJSON(json);

            expect(frames).toHaveLength(2);
            expect(frames[0]!.missionTime).toBe(10.5);
            expect(frames[1]!.altitude).toBe(510.2);
        });

        it('should parse JSON object with frames property', () => {
            const json = `{
                "meta": "data",
                "frames": [
                    { "missionTime": 10.5, "altitude": 500.2 }
                ]
            }`;
            const frames = FlightDataParser.parseJSON(json);

            expect(frames).toHaveLength(1);
            expect(frames[0]!.missionTime).toBe(10.5);
        });

        it('should return null for invalid JSON syntax', () => {
            const json = `{ "missionTime": 10.5 `; // Missing closing brace
            // Silence console.error for this test as it's expected
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const frames = FlightDataParser.parseJSON(json);

            expect(frames).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('should return empty array for valid JSON but invalid structure', () => {
            const json = `{ "some": "object" }`;
            const frames = FlightDataParser.parseJSON(json);

            expect(frames).toEqual([]);
        });

        it('should return null when JSON.parse throws an error', () => {
            const json = `{"valid": "json"}`;
            const mockError = new Error('Mock JSON parse error');
            const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation(() => {
                throw mockError;
            });
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            try {
                const frames = FlightDataParser.parseJSON(json);

                expect(frames).toBeNull();
                expect(consoleSpy).toHaveBeenCalledWith('Failed to parse flight data JSON:', mockError);
            } finally {
                parseSpy.mockRestore();
                consoleSpy.mockRestore();
            }
        });
    });
});
