import { describe, it, expect, vi } from 'vitest';
import { FlightDataParser } from '../src/analysis/FlightDataParser';

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

        it('should throw an error for mismatched column counts', () => {
            const csv = `missionTime,altitude
40.5,2000.5
50.5`; // Missing altitude

            expect(() => FlightDataParser.parseCSV(csv)).toThrowError(
                /Failed to parse flight data CSV: Line 3 has 1 columns, expected 2/
            );
        });

        it('should throw an error for invalid number formats', () => {
            const csv = `missionTime,altitude
abc,def`;

            expect(() => FlightDataParser.parseCSV(csv)).toThrowError(
                /Failed to parse flight data CSV: Invalid number format for missionTime: abc/
            );
        });

        it('should throw an error when an error occurs during CSV parsing', () => {
            const splitSpy = vi.spyOn(String.prototype, 'split').mockImplementation(() => {
                throw new Error('Split error');
            });

            expect(() => FlightDataParser.parseCSV('any,csv')).toThrowError('Failed to parse flight data CSV: Split error');

            splitSpy.mockRestore();
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

        it('should throw an error for invalid JSON syntax', () => {
            const json = `{ "missionTime": 10.5 `; // Missing closing brace
            expect(() => FlightDataParser.parseJSON(json)).toThrowError(/Failed to parse flight data JSON:/);
        });

        it('should return empty array for valid JSON but invalid structure', () => {
            const json = `{ "some": "object" }`;
            const frames = FlightDataParser.parseJSON(json);

            expect(frames).toEqual([]);
        });

        it('should safely handle null JSON', () => {
            expect(FlightDataParser.parseJSON('null')).toEqual([]);
        });

        it('should safely handle primitive JSON types', () => {
            expect(FlightDataParser.parseJSON('"string"')).toEqual([]);
            expect(FlightDataParser.parseJSON('123')).toEqual([]);
            expect(FlightDataParser.parseJSON('true')).toEqual([]);
        });

        it('should throw an error when JSON.parse throws an error', () => {
            const json = `{"valid": "json"}`;
            const mockError = new Error('Mock JSON parse error');
            const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation(() => {
                throw mockError;
            });

            try {
                expect(() => FlightDataParser.parseJSON(json)).toThrowError('Failed to parse flight data JSON: Mock JSON parse error');
            } finally {
                parseSpy.mockRestore();
            }
        });
    });
});
