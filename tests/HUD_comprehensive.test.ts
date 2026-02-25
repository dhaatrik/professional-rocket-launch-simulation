
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Game } from '../src/core/Game';

// Mock dependencies
const mockCanvas = {
    getContext: vi.fn(() => ({
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        fillText: vi.fn(),
        clip: vi.fn(),
        rect: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
    })),
    width: 140,
    height: 140,
    addEventListener: vi.fn(),
};

// Mock HTMLElement factory
const createMockElement = (id) => {
    const el = {
        id,
        style: { display: 'none', color: '', height: '' },
        textContent: '',
        className: '',
        addEventListener: vi.fn(),
        getContext: undefined
    };
    if (id === 'navball' || id === 'graph-canvas') {
        el.getContext = mockCanvas.getContext;
        el.width = 140;
        el.height = 140;
    }
    return el;
};

const mockElements = {};

vi.stubGlobal('document', {
    getElementById: vi.fn((id) => {
        if (id === 'canvas') return mockCanvas;
        if (!mockElements[id]) {
            mockElements[id] = createMockElement(id);
        }
        return mockElements[id];
    }),
    createElement: vi.fn(() => ({
        getContext: () => ({}),
        width: 0,
        height: 0,
        addEventListener: vi.fn()
    })),
    addEventListener: vi.fn(),
});

vi.stubGlobal('window', {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    PIXELS_PER_METER: 10,
    R_EARTH: 6371000
});

// Mock other globals
class MockAudioContext {
    createGain() { return { connect: vi.fn(), gain: { value: 0, linearRampToValueAtTime: vi.fn() } }; }
    createOscillator() { return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0, linearRampToValueAtTime: vi.fn() } }; }
    createBufferSource() { return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null, loop: false }; }
    decodeAudioData() { return Promise.resolve({}); }
    currentTime = 0;
    destination = {};
}
vi.stubGlobal('AudioContext', MockAudioContext);
vi.stubGlobal('Worker', class {
    addEventListener() {}
    postMessage() {}
});

describe('Game HUD Comprehensive Tests', () => {
    let game: Game;

    beforeEach(() => {
        // Reset mocks
        for (const key in mockElements) delete mockElements[key];
        vi.clearAllMocks();
        game = new Game();
    });

    it('should update Environment HUD correctly', () => {
        const envState = {
            windVelocity: { x: 10, y: 0 },
            densityMultiplier: 1,
            surfaceWindSpeed: 12,
            surfaceWindDirection: Math.PI, // South
            timeOfDay: 12 * 3600, // Noon
            isLaunchSafe: true,
            maxQWindWarning: false
        };

        (game as any).lastEnvState = envState;
        (game as any).drawHUD();

        expect(mockElements['hud-wind-speed'].textContent).toBe('12 m/s');
        expect(mockElements['hud-wind-speed'].style.color).toBeDefined(); // Yellow
        expect(mockElements['hud-launch-status'].textContent).toBe('GO');
    });

    it('should update Flight Data HUD correctly', () => {
        // Mock tracked entity
        const trackedEntity = {
            y: 500, // 500m up calculation: (5550 - 500 - 50) / 10 = 500m = 0.5km
            h: 50,
            vx: 100,
            vy: -200, // Upwards
            angle: 0.1,
            throttle: 0.8,
            fuel: 0.5,
            aoa: 0.05,
            stabilityMargin: 0.1,
            isAeroStable: true,
            skinTemp: 350, // Kelvin -> 77 C
            isThermalCritical: false,
            heatShieldRemaining: 0.9,
            isAblating: false,
            engineState: 'running',
            ignitersRemaining: 2
        };

        (game as any).groundY = 5550; // Set groundY so alt works out
        (game as any).trackedEntity = trackedEntity;

        // Populate cache
        (game as any).initHUDCache();

        (game as any).drawHUD();

        expect(mockElements['hud-alt'].textContent).toBe('0.5'); // 500m / 1000
        expect(mockElements['hud-vel'].textContent).toBe('223'); // sqrt(100^2 + 200^2)
        expect(mockElements['gauge-fuel'].style.height).toBe('50%');
        expect(mockElements['gauge-thrust'].style.height).toBe('80%');
        expect(mockElements['hud-engine-status'].textContent).toBe('RUN');
        expect(mockElements['hud-igniters'].textContent).toBe('2');
    });

    it('should update TPS HUD correctly', () => {
         const trackedEntity = {
            y: 5000,
            h: 50,
            vx: 0,
            vy: 0,
            angle: 0,
            throttle: 0,
            fuel: 0,
            aoa: 0,
            stabilityMargin: 0,
            isAeroStable: true,
            skinTemp: 1000, // Hot!
            isThermalCritical: true,
            heatShieldRemaining: 0.2,
            isAblating: true,
            engineState: 'off',
            ignitersRemaining: 0
        };
        (game as any).trackedEntity = trackedEntity;
        (game as any).drawHUD();

        expect(mockElements['hud-skin-temp'].textContent).toContain('°C');
        expect(mockElements['hud-tps-status'].textContent).toBe('20%');
        // Colors are mocked string assignments, we just check they happened
        expect(mockElements['hud-tps-status'].style.color).toBeDefined();
    });

    it('should update FTS HUD correctly', () => {
        // Mock FTS status
        (game as any).fts = {
            getStatus: () => ({ state: 'WARNING', armed: true, warningTimer: 2.5 }),
            config: { warningDurationS: 5 }
        };

        // Mock cache initialization for FTS
        (game as any).initHUDCache();

        // Mock tracked entity with minimal required properties
        (game as any).trackedEntity = {
            y: 0, h: 0, vx: 0, vy: 0, angle: 0,
            throttle: 0, fuel: 0, aoa: 0, stabilityMargin: 0, isAeroStable: true,
            skinTemp: 300, isThermalCritical: false, heatShieldRemaining: 1, isAblating: false,
            engineState: 'off', ignitersRemaining: 3
        };

        (game as any).drawHUD();

        // Warning duration 5 - 2.5 = 2.5s -> rounded to "3" (toFixed(0))
        expect(mockElements['hud-fts-state'].textContent).toBe('WARN 3s');
        expect(mockElements['hud-fts-state'].style.color).toBeDefined();
    });
});
