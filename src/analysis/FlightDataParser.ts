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
        const lines = csvContent.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = (lines[0] || '').split(',').map((h) => h.trim());
        const frames: FlightFrame[] = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const values = line.split(',');
            if (values.length !== headers.length) continue;

            const frame: any = {};

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
    }

    public static parseJSON(jsonContent: string): FlightFrame[] | null {
        try {
            const data = JSON.parse(jsonContent);
            if (Array.isArray(data)) {
                return data as FlightFrame[];
            } else if (data.frames && Array.isArray(data.frames)) {
                return data.frames as FlightFrame[];
            }
            return [];
        } catch (e) {
            console.error('Failed to parse flight data JSON:', e);
            return null;
        }
    }
}
