/**
 * TelemetryExporter - Export Flight Data to CSV/JSON
 *
 * Provides utilities to export recorded flight data in various formats
 * for post-flight analysis in spreadsheets or data analysis tools.
 */

import { FlightDataFrame, FlightSummary } from './BlackBoxRecorder';

// ============================================================================
// Export Types
// ============================================================================

export type ExportFormat = 'csv' | 'json';

/**
 * JSON export structure
 */
export interface FlightDataExport {
    metadata: {
        version: string;
        exportedAt: string;
        summary: FlightSummary;
    };
    frames: FlightDataFrame[];
}

// ============================================================================
// CSV Export
// ============================================================================

const engineStateLabels = ['OFF', 'STARTING', 'RUNNING', 'FLAMEOUT', 'SHUTDOWN'];

/**
 * Convert frames to CSV string
 */
export function framesToCSV(frames: readonly FlightDataFrame[]): string {
    if (frames.length === 0) return '';

    // Headers
    const headers = [
        'Time(s)',
        'Altitude(m)',
        'VelX(m/s)',
        'VelY(m/s)',
        'Speed(m/s)',
        'AccelX(m/s2)',
        'AccelY(m/s2)',
        'G-Force(g)',
        'Pitch(deg)',
        'Gimbal(deg)',
        'Throttle',
        'Mass(kg)',
        'Fuel',
        'DynPressure(Pa)',
        'Mach',
        'AoA(deg)',
        'SkinTemp(K)',
        'EngineState',
        'Apogee(m)'
    ];

    const lines: string[] = [headers.join(',')];

    // Data rows
    for (const frame of frames) {
        const row = [
            frame.t.toFixed(3),
            frame.alt.toFixed(2),
            frame.vx.toFixed(2),
            frame.vy.toFixed(2),
            frame.speed.toFixed(2),
            frame.accelX.toFixed(3),
            frame.accelY.toFixed(3),
            frame.gForce.toFixed(3),
            frame.angle.toFixed(2),
            frame.gimbal.toFixed(3),
            frame.throttle.toFixed(3),
            frame.mass.toFixed(1),
            frame.fuel.toFixed(4),
            frame.q.toFixed(1),
            frame.mach.toFixed(3),
            frame.aoa.toFixed(2),
            frame.skinTemp.toFixed(1),
            `"${engineStateLabels[frame.engineState] || 'UNKNOWN'}"`,
            frame.apogee.toFixed(0)
        ];
        lines.push(row.join(','));
    }

    return lines.join('\n');
}

/**
 * Export frames to CSV and trigger download
 */
export function exportToCSV(frames: readonly FlightDataFrame[], summary: FlightSummary): void {
    const csv = framesToCSV(frames);
    const filename = generateFilename(summary.missionName, 'csv');
    downloadFile(csv, filename, 'text/csv');
}

// ============================================================================
// JSON Export
// ============================================================================

/**
 * Convert frames to JSON export object
 */
export function framesToJSON(frames: readonly FlightDataFrame[], summary: FlightSummary): FlightDataExport {
    return {
        metadata: {
            version: '1.6.0',
            exportedAt: new Date().toISOString(),
            summary: summary
        },
        frames: [...frames]
    };
}

/**
 * Export frames to JSON and trigger download
 */
export function exportToJSON(frames: readonly FlightDataFrame[], summary: FlightSummary): void {
    const data = framesToJSON(frames, summary);
    const json = JSON.stringify(data, null, 2);
    const filename = generateFilename(summary.missionName, 'json');
    downloadFile(json, filename, 'application/json');
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate a filename with timestamp
 */
function generateFilename(missionName: string, extension: string): string {
    const sanitized = missionName.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${sanitized}_${timestamp}.${extension}`;
}

/**
 * Trigger file download in browser
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Export flight data in specified format
 */
export function exportFlightData(
    frames: readonly FlightDataFrame[],
    summary: FlightSummary,
    format: ExportFormat
): void {
    if (frames.length === 0) {
        console.warn('No flight data to export');
        return;
    }

    switch (format) {
        case 'csv':
            exportToCSV(frames, summary);
            break;
        case 'json':
            exportToJSON(frames, summary);
            break;
    }
}
