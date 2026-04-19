import { describe, it, expect, vi, afterEach } from 'vitest';
import { Game } from '../src/core/Game';

// Mock DOM
const mockElements = new Map<string, any>();
let getElementByIdCalls = 0;

const mockDocument = {
    getElementById: vi.fn((id: string) => {
        getElementByIdCalls++;
        if (!mockElements.has(id)) {
            mockElements.set(id, {
                id,
                textContent: '',
                style: {},
                className: '',
                setAttribute: vi.fn(),
                getContext: () => ({
                    clearRect: () => { },
                    save: () => { },
                    translate: () => { },
                    rotate: () => { },
                    fillRect: () => { },
                    restore: () => { },
                    beginPath: () => { },
                    moveTo: () => { },
                    lineTo: () => { },
                    stroke: () => { },
                    arc: () => { },
                    clip: () => { },
                    createLinearGradient: () => ({ addColorStop: () => { } }),
                    fillText: () => { },
                    fillStyle: '',
                    strokeStyle: '',
                    lineWidth: 1
                }),
                addEventListener: () => { }
            });
        }
        return mockElements.get(id);
    }),
    createElement: vi.fn((tag: string) => ({
        id: tag,
        getContext: () => ({}),
        addEventListener: () => { },
        setAttribute: vi.fn(),
        style: {},
        appendChild: vi.fn()
    })),
    addEventListener: vi.fn()
};

const mockWindow = {
    innerWidth: 1920,
    innerHeight: 1080,
    addEventListener: vi.fn()
};

vi.stubGlobal('document', mockDocument);
vi.stubGlobal('window', mockWindow);
vi.stubGlobal('Worker', class {
    postMessage() { }
    onmessage() { }
    terminate() { }
    addEventListener() { }
});

// Mock Game to access private drawHUD
class TestGame extends Game {
    public testDrawHUD() {
        (this as any).drawHUD();
    }

    public setTrackedEntity(entity: any) {
        this.trackedEntity = entity;
    }
}

describe('Performance', () => {
    afterEach(() => {
        vi.clearAllMocks();
        mockElements.clear();
        getElementByIdCalls = 0;
    });

    it('should NOT query DOM during drawHUD loop', () => {
        const game = new TestGame();

        // Initial setup calls are expected
        const initialCalls = getElementByIdCalls;
        expect(initialCalls).toBeGreaterThan(0);

        const mockVessel = {
            x: 0, y: 1000, vx: 100, vy: -100, h: 50, angle: 0,
            throttle: 1.0, fuel: 0.5, aoa: 0.1, stabilityMargin: 0.2,
            isAeroStable: true, skinTemp: 300, isThermalCritical: false,
            heatShieldRemaining: 0.8, isAblating: false,
            engineState: 'running', ignitersRemaining: 2,
            active: true
        };
        game.setTrackedEntity(mockVessel);

        // Reset counter
        getElementByIdCalls = 0;

        // Run loop
        for (let i = 0; i < 100; i++) {
            game.testDrawHUD();
        }

        expect(getElementByIdCalls).toBe(0);
    });
});
