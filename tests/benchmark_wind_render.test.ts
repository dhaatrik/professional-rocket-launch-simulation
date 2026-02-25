
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Game } from '../src/core/Game';

// Mock everything needed for Game to instantiate
const mockCanvas = {
    getContext: () => mockCtx,
    width: 1920,
    height: 1080,
    style: {}
};

const mockCtx = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    createLinearGradient: () => ({ addColorStop: () => { } }),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    setLineDash: vi.fn(),
    scale: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: ''
};

const mockDocument = {
    getElementById: (id: string) => {
        if (id === 'canvas' || id === 'navball' || id.includes('canvas')) return mockCanvas;
        return {
            style: {},
            textContent: '',
            classList: { add: () => { }, remove: () => { } },
            addEventListener: () => { }
        };
    },
    createElement: () => ({ style: {} }),
    addEventListener: () => { }
};

vi.stubGlobal('document', mockDocument);
vi.stubGlobal('window', {
    innerWidth: 1920,
    innerHeight: 1080,
    addEventListener: () => { },
    PIXELS_PER_METER: 1,
    R_EARTH: 6371000
});
vi.stubGlobal('Worker', class {
    postMessage() { }
    onmessage() { }
    terminate() { }
    addEventListener() { }
});

class TestGame extends Game {
    public testDrawEnvironment(camY: number) {
        // Access private method
        (this as any).drawEnvironment(camY);
    }
}

describe('Wind Rendering Optimization', () => {
    let game: TestGame;

    beforeEach(() => {
        vi.clearAllMocks();
        game = new TestGame();

        // Mock environment to return some wind
        // We need to mock 'environment' property of game
        // But it's initialized in constructor.
        // We can override getWindPolar on the instance's environment
        game.environment.getWindPolar = vi.fn((alt, out) => {
            if (out) {
                out.speed = 20; // Medium wind
                out.direction = Math.PI / 2;
            }
            return { speed: 20, direction: Math.PI / 2 };
        });

        // Ensure height is set so loop runs
        (game as any).height = 1000;
        (game as any).ZOOM = 1.0;
        (game as any).groundY = 1000;
    });

    it('should verify drawEnvironment uses 0 translate/rotate calls for wind vectors', () => {
        // Run drawEnvironment with camera at 0
        game.testDrawEnvironment(0);

        // Expect 0 calls to translate and rotate
        // The corridor drawing uses moveTo/lineTo (no transforms)
        // The new wind drawing uses manual transform (no ctx transforms)

        expect(mockCtx.translate).toHaveBeenCalledTimes(0);
        expect(mockCtx.rotate).toHaveBeenCalledTimes(0);

        // Should have called fill/stroke
        expect(mockCtx.stroke).toHaveBeenCalled(); // Corridor
        expect(mockCtx.fill).toHaveBeenCalled();   // Wind arrows
    });
});
