import { FlightDataParser, FlightFrame } from './FlightDataParser';

export class DataLoader {
    public loadFile(file: File): Promise<FlightFrame[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const target = e.target;
                if (!target) {
                    reject(new Error('FileReader target is null'));
                    return;
                }
                const content = target.result as string;
                try {
                    let frames: FlightFrame[] = [];
                    if (file.name.endsWith('.csv')) {
                        frames = FlightDataParser.parseCSV(content);
                    } else if (file.name.endsWith('.json')) {
                        frames = FlightDataParser.parseJSON(content);
                    } else {
                        reject(new Error('Unsupported file type'));
                        return;
                    }
                    resolve(frames);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            reader.readAsText(file);
        });
    }
}
