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
                if (values.length !== headers.length) continue;

                const frame: Partial<FlightFrame> = {};

                headers.forEach((header, index) => {
                    const val = values[index]?.trim();
                    if (val !== undefined) {
                        switch (header) {
                            case 'timestamp':
                                frame.timestamp = parseInt(val);
                                break;
                            case 'missionTime':
                                frame.missionTime = parseFloat(val);
                                break;
                            case 'altitude':
                                frame.altitude = parseFloat(val);
                                break;
                            case 'velocity':
                                frame.velocity = parseFloat(val);
                                break;
                            case 'fuel':
                                frame.fuel = parseFloat(val);
                                break;
                            case 'throttle':
                                frame.throttle = parseFloat(val);
                                break;
                            case 'q':
                                frame.q = parseFloat(val);
                                break;
                            case 'gForce':
                                frame.gForce = parseFloat(val);
                                break;
                            case 'angle':
                                frame.angle = parseFloat(val);
                                break;
                            case 'posX':
                                frame.posX = parseFloat(val);
                                break;
                            case 'posY':
                                frame.posY = parseFloat(val);
                                break;
                            case 'event':
                                frame.event = val;
                                break;
                        }
                    }
                });

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

            const rawFrames: unknown[] = [];
            if (Array.isArray(data)) {
                return data as FlightFrame[];
            } else if ('frames' in data) {
                const record = data as Record<string, unknown>;
                if (Array.isArray(record.frames)) {
                    return record.frames as FlightFrame[];
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
