import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('main.ts Error Handling', () => {
    let consoleErrorSpy: any;
    let alertSpy: any;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        vi.resetModules();

        // Mock UI components that do a lot of DOM manipulation
        vi.doMock('../src/ui/ScriptEditor', () => ({
            ScriptEditor: class {}
        }));

        vi.doMock('../src/ui/VABEditor', () => ({
            VABEditor: class {}
        }));

        vi.doMock('../src/ui/FlightComputerHUD', () => ({
            updateFlightComputerHUD: vi.fn()
        }));

        vi.doMock('../src/telemetry/TelemetryExporter', () => ({
            exportFlightData: vi.fn()
        }));

        vi.doMock('../src/ui/MissionControl', () => ({
            MissionControl: class {
                render() {}
                show() {}
                hide() {}
                isVisible() { return false; }
            }
        }));

        vi.doMock('../src/ui/ManeuverPlanner', () => ({
            ManeuverPlanner: class {
                render() {}
            }
        }));

        // Basic DOM mock
        vi.stubGlobal('document', {
            getElementById: vi.fn(() => ({
                addEventListener: vi.fn(),
                style: {},
                classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), contains: vi.fn() },
                querySelector: vi.fn(() => ({ addEventListener: vi.fn() })),
                querySelectorAll: vi.fn(() => []),
                setAttribute: vi.fn(),
                removeAttribute: vi.fn(),
                textContent: '',
            })),
            querySelector: vi.fn(() => ({
                addEventListener: vi.fn(),
                classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() }
            })),
            querySelectorAll: vi.fn(() => []),
            createElement: vi.fn(() => ({
                addEventListener: vi.fn(),
                style: {},
                classList: { add: vi.fn(), remove: vi.fn() }
            }))
        });

        vi.stubGlobal('window', {
            ...window,
            addEventListener: vi.fn(),
            alert: alertSpy,
            location: { reload: vi.fn() }
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('handles Game constructor failure correctly', async () => {
        vi.doMock('../src/core/Game', () => {
            return {
                Game: class {
                    constructor() {
                        throw new Error('Mocked Constructor Error');
                    }
                }
            };
        });

        await expect(import('../src/main')).rejects.toThrow('Mocked Constructor Error');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Game constructor failed:', expect.any(Error));
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Critical Error: Mocked Constructor Error'));
    });

    it('handles Game init failure correctly', async () => {
        vi.doMock('../src/core/Game', () => {
            return {
                Game: class {
                    addPhysicsEventListener = vi.fn();
                    addEventListener = vi.fn();
                    async init() {
                        throw new Error('Mocked Init Error');
                    }
                }
            };
        });

        await import('../src/main');

        // Allow async init error to be caught
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(consoleErrorSpy).toHaveBeenCalledWith('Game initialization failed:', expect.any(Error));
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Game Init Error: Mocked Init Error'));
    });

    it('handles Game constructor failure with non-Error correctly', async () => {
        vi.doMock('../src/core/Game', () => {
            return {
                Game: class {
                    constructor() {
                        throw 'Mocked Constructor String Error';
                    }
                }
            };
        });

        await expect(import('../src/main')).rejects.toThrow('Mocked Constructor String Error');
        expect(consoleErrorSpy).toHaveBeenCalledWith('Game constructor failed:', 'Mocked Constructor String Error');
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Critical Error: Mocked Constructor String Error'));
    });

    it('handles Game init failure with non-Error correctly', async () => {
        vi.doMock('../src/core/Game', () => {
            return {
                Game: class {
                    addPhysicsEventListener = vi.fn();
                    addEventListener = vi.fn();
                    async init() {
                        throw 'Mocked Init String Error';
                    }
                }
            };
        });

        await import('../src/main');

        // Allow async init error to be caught
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(consoleErrorSpy).toHaveBeenCalledWith('Game initialization failed:', 'Mocked Init String Error');
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Game Init Error: Mocked Init String Error'));
    });
});
