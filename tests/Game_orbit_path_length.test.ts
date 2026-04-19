
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Game } from '../src/core/Game';
import { R_EARTH, PIXELS_PER_METER } from '../src/config/Constants';

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
    addEventListener: vi.fn(),
    PIXELS_PER_METER: PIXELS_PER_METER,
    R_EARTH: R_EARTH
};

vi.stubGlobal('document', mockDocument);
vi.stubGlobal('window', mockWindow);
vi.stubGlobal('Worker', class {
    postMessage() { }
    onmessage() { }
    terminate() { }
    addEventListener() { }
});

vi.stubGlobal('requestAnimationFrame', (cb: any) => setTimeout(cb, 16));

class TestGame extends Game {
    public updateOrbitPathsPublic(now: number) {
        (this as any).updateOrbitPaths(now);
    }
    public addEntity(e: any) {
        this.entities.push(e);
    }
}

describe('Orbit Path Length', () => {
    afterEach(() => {
        vi.clearAllMocks();
        mockElements.clear();
    });

    it('should generate approximately 200 points for orbit path', () => {
        const game = new TestGame();

        const alt = 200000;
        const groundY = (game as any).groundY;
        const y = groundY - alt * PIXELS_PER_METER - 10;

        const vessel = {
            x: 0,
            y: y,
            h: 10,
            vx: 7800,
            vy: 0,
            throttle: 0,
            active: true,
            crashed: false,
            orbitPath: [],
            lastOrbitUpdate: 0,
            // Mock other props
            mass: 1000, angle: 0, gimbalAngle: 0, w: 5, fuel: 1, type: 0,
            applyPhysics: () => {}, spawnExhaust: () => {}, draw: () => {}, explode: () => {}
        };

        game.addEntity(vessel);

        const now = 2000;
        game.updateOrbitPathsPublic(now);

        expect(vessel.orbitPath).toBeDefined();
        const len = vessel.orbitPath.length;
        console.log(`Path length: ${len}`);

        // Original: 2000 steps, every 10th -> 200 points. Plus maybe 1 endpoint.
        // New: 400 steps, every 2nd -> 200 points.
        expect(len).toBeGreaterThanOrEqual(199);
        expect(len).toBeLessThanOrEqual(202);
    });
});
