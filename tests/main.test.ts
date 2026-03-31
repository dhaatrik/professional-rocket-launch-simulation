import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create minimal mock versions of external dependencies imported in main.ts
vi.mock('../src/telemetry/TelemetryExporter', () => ({
    exportFlightData: vi.fn(),
}));

vi.mock('../src/ui/VABEditor', () => ({
    VABEditor: class {
        init() {}
    },
}));

vi.mock('../src/ui/FlightComputerHUD', () => ({
    updateFlightComputerHUD: vi.fn(),
}));

describe('main.ts error handling', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.restoreAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(window, 'alert').mockImplementation(() => {});

        // Mock document elements needed by main.ts
        document.body.innerHTML = `
            <div id="camera-panel">
                <button data-cam="1"></button>
                <button data-cam="2"></button>
                <button data-cam="3"></button>
            </div>
            <button id="maneuver-btn"></button>
            <button id="mission-control-btn"></button>
            <button id="checklist-btn"></button>
            <button id="fts-destruct-btn"></button>
            <div id="fis-panel"></div>
            <button id="telemetry-btn"></button>
            <button id="export-btn"></button>
        `;
    });

    it('should catch synchronous Game constructor errors', async () => {
        vi.doMock('../src/core/Game', () => {
            return {
                Game: class {
                    constructor() {
                        throw new Error('Test SAB Error');
                    }
                }
            };
        });

        await expect(import('../src/main.ts')).rejects.toThrow('Test SAB Error');
        expect(console.error).toHaveBeenCalledWith('Game constructor failed:', expect.any(Error));
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Critical Error: Test SAB Error'));
    });

    it('should catch asynchronous Game init errors', async () => {
        // Mock UI components that rely on game
        vi.doMock('../src/ui/ScriptEditor', () => ({
            ScriptEditor: class {
                constructor() {}
            }
        }));
        vi.doMock('../src/ui/VABEditor', () => ({
            VABEditor: class {
                constructor() {}
                init() {}
            }
        }));

        vi.doMock('../src/core/Game', () => {
            return {
                Game: class {
                    constructor() {}
                    async init() {
                        throw new Error('Test Init Error');
                    }
                    // Add stubs for methods called by main.ts
                    audio = { toggleMute: () => false };
                    sas = { setMode: () => {} };
                    input = { cameraMode: 1 };
                    missionLog = { log: () => {} };
                    maneuverPlanner = { toggle: () => {} };
                    missionControl = { toggle: () => {} };
                    checklist = { toggle: () => {} };
                    fts = { triggerManualDestruct: () => false };
                    faultInjector = { toggleFault: () => {} };
                    blackBox = { toggle: () => {}, getStatusString: () => '', isRecording: () => false, getFrames: () => [] };
                    getFlightComputerStatus = () => ({ status: 'FC: OFF' });
                }
            };
        });

        // Dynamic import to trigger main.ts evaluation
        await import('../src/main.ts');

        // Let promises resolve
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(console.error).toHaveBeenCalledWith('Game initialization failed:', expect.any(Error));
        expect(window.alert).toHaveBeenCalledWith('Game Init Error: Test Init Error');
    });
});
