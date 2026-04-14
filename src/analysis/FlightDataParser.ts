/**
 * Flight Data Parser
 *
 * Handles parsing of CSV and JSON flight logs.
 */

export interface FlightFrame {
    timestamp: number;
    missionTime: number;
    altitude: number;
    velocity: number;
    fuel: number;
    throttle: number;
    q: number;
    gForce: number;
    angle: number;
    posX: number;
    posY: number;
    event?: string;
}

export class FlightDataParser {
    public static parseCSV(csvContent: string): FlightFrame[] {
        try {
            const lines = (csvContent || '').trim().split('\n');
            if (lines.length < 2) return [];

            const headers = (lines[0] || '').split(',').map((h) => h.trim());
            const frames: FlightFrame[] = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (!line) continue;
                const values = line.split(',');
                if (values.length !== headers.length) {
                    throw new Error(`Line ${i + 1} has ${values.length} columns, expected ${headers.length}`);
                }

                const frame: Partial<FlightFrame> = {};

                // Performance Optimization: Standard for loop avoids closure allocation overhead per line parsed
                for (let index = 0; index < headers.length; index++) {
                    const header = headers[index];
                    const val = values[index]?.trim();
                    if (val !== undefined) {
                        let parsedVal: number;
                        switch (header) {
                            case 'timestamp':
                                parsedVal = parseInt(val);
                                if (isNaN(parsedVal)) throw new Error(`Invalid number format for timestamp: ${val}`);
                                frame.timestamp = parsedVal;
                                break;
                            case 'missionTime':
                                parsedVal = parseFloat(val);
                                if (isNaN(parsedVal)) throw new Error(`Invalid number format for missionTime: ${val}`);
                                frame.missionTime = parsedVal;
                                break;
                            case 'altitude':
                                parsedVal = parseFloat(val);
                                if (isNaN(parsedVal)) throw new Error(`Invalid number format for altitude: ${val}`);
                                frame.altitude = parsedVal;
                                break;
                            case 'velocity':
                                parsedVal = parseFloat(val);
                                if (isNaN(parsedVal)) throw new Error(`Invalid number format for velocity: ${val}`);
                                frame.velocity = parsedVal;
                                break;
                            case 'fuel':
                                parsedVal = parseFloat(val);
                                if (isNaN(parsedVal)) throw new Error(`Invalid number format for fuel: ${val}`);
                                frame.fuel = parsedVal;
                                break;
                            case 'throttle':
                                parsedVal = parseFloat(val);
                                if (isNaN(parsedVal)) throw new Error(`Invalid number format for throttle: ${val}`);
                                frame.throttle = parsedVal;
                                break;
                            case 'q':
                                parsedVal = parseFloat(val);
                                if (isNaN(parsedVal)) throw new Error(`Invalid number format for q: ${val}`);
                                frame.q = parsedVal;
                                break;
                            case 'gForce':
                                parsedVal = parseFloat(val);
                                if (isNaN(parsedVal)) throw new Error(`Invalid number format for gForce: ${val}`);
                                frame.gForce = parsedVal;
                                break;
                            case 'angle':
                                parsedVal = parseFloat(val);
                                if (isNaN(parsedVal)) throw new Error(`Invalid number format for angle: ${val}`);
                                frame.angle = parsedVal;
                                break;
                            case 'posX':
                                parsedVal = parseFloat(val);
                                if (isNaN(parsedVal)) throw new Error(`Invalid number format for posX: ${val}`);
                                frame.posX = parsedVal;
                                break;
                            case 'posY':
                                parsedVal = parseFloat(val);
                                if (isNaN(parsedVal)) throw new Error(`Invalid number format for posY: ${val}`);
                                frame.posY = parsedVal;
                                break;
                            case 'event':
                                frame.event = val;
                                break;
                        }
                    }
                }

                // Ensure essential fields exist
                if (frame.missionTime !== undefined) {
                    frames.push(frame as FlightFrame);
                }
            }

            return frames;
        } catch (e) {
            throw new Error(`Failed to parse flight data CSV: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    public static parseJSON(jsonContent: string): FlightFrame[] {
        try {
            const data = JSON.parse(jsonContent) as unknown;
            if (!data || typeof data !== 'object') {
                return [];
            }

            let rawFrames: unknown[] = [];
            if (Array.isArray(data)) {
                rawFrames = data;
            } else if ('frames' in data) {
                const record = data as Record<string, unknown>;
                if (Array.isArray(record.frames)) {
                    rawFrames = record.frames;
                }
            }

            const validFrames: FlightFrame[] = [];
            const numFields = [
                'timestamp',
                'altitude',
                'velocity',
                'fuel',
                'throttle',
                'q',
                'gForce',
                'angle',
                'posX',
                'posY'
            ];

            for (const item of rawFrames) {
                if (
                    item &&
                    typeof item === 'object' &&
                    typeof (item as Record<string, unknown>).missionTime === 'number'
                ) {
                    const recordItem = item as Record<string, unknown>;
                    const frame: Partial<FlightFrame> = { missionTime: recordItem.missionTime as number };
                    for (const field of numFields) {
                        if (typeof recordItem[field] === 'number')
                            (frame as Record<string, unknown>)[field] = recordItem[field];
                    }
                    if (typeof recordItem.event === 'string') frame.event = recordItem.event;
                    validFrames.push(frame as FlightFrame);
                }
            }

            return validFrames;
        } catch (e) {
            throw new Error(`Failed to parse flight data JSON: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}
