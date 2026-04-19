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

// Mock requestAnimationFrame
vi.stubGlobal('requestAnimationFrame', (cb: any) => setTimeout(cb, 16));

// Mock Game to access private updateOrbitPaths
class TestGame extends Game {
    public updateOrbitPathsPublic(now: number) {
        (this as any).updateOrbitPaths(now);
    }
    public addEntity(e: any) {
        this.entities.push(e);
    }
}

describe('Orbit Optimization', () => {
    afterEach(() => {
        vi.clearAllMocks();
        mockElements.clear();
        getElementByIdCalls = 0;
    });

    it('should calculate orbit path and verify object reuse', () => {
        const game = new TestGame();

        // Setup a mock vessel
        // x=0 means phi=0 (at top of circle in game coordinates maybe? phi=x/R_EARTH)
        // y=groundY-alt*pixels_per_meter
        // Let's just put it at 200km altitude
        const alt = 200000;
        const groundY = (game as any).groundY;
        const y = groundY - alt * PIXELS_PER_METER - 10; // -10 for height

        const vessel = {
            x: 0,
            y: y,
            h: 10,
            vx: 7800, // Approx orbital velocity
            vy: 0,
            throttle: 0,
            active: true,
            crashed: false,
            orbitPath: [],
            lastOrbitUpdate: 0,

            // Other required props
            mass: 1000,
            angle: 0,
            gimbalAngle: 0,
            w: 5,
            fuel: 1,
            maxThrust: 1000,
            cd: 0.5,
            q: 0,
            apogee: 0,
            health: 1,
            aoa: 0,
            stabilityMargin: 0,
            isAeroStable: true,
            liftForce: 0,
            dragForce: 0,
            skinTemp: 300,
            heatShieldRemaining: 1,
            isAblating: false,
            isThermalCritical: false,
            engineState: 'off',
            ignitersRemaining: 2,
            ullageSettled: true,
            actualThrottle: 0,
            prevX: 0,
            prevY: y,
            prevAngle: 0,
            type: 0,
            applyPhysics: () => {},
            spawnExhaust: () => {},
            draw: () => {},
            explode: () => {}
        };

        game.addEntity(vessel);

        // First update
        // We need to advance time enough to trigger update (throttle is 100ms)
        // Also force update by ensuring now - lastOrbitUpdate > 1000
        const now1 = 1100;
        game.updateOrbitPathsPublic(now1);

        expect(vessel.orbitPath).toBeDefined();
        if (!vessel.orbitPath) throw new Error("orbitPath is null");

        const pathLength1 = vessel.orbitPath.length;
        expect(pathLength1).toBeGreaterThan(0);

        // Capture object references
        const firstPathObjects = [...vessel.orbitPath];
        const firstPoint = firstPathObjects[0];

        // Second update
        // Must be > 1000ms later to force update (check logic: if now - last > 1000 needsUpdate=true)
        // Actually the logic is:
        // if (now - e.lastOrbitUpdate < 100) continue;
        // needsUpdate = ...
        // if (now - e.lastOrbitUpdate > 1000) needsUpdate = true;

        const now2 = now1 + 2000;
        game.updateOrbitPathsPublic(now2);

        const pathLength2 = vessel.orbitPath.length;
        expect(pathLength2).toBeGreaterThan(0);

        // Verify reuse
        // With optimization, this should be true. Without, it will fail.
        // Currently (before optimization), this expectation will FAIL.
        // I will comment it out or expect it to NOT be reused initially if I wanted to prove failure,
        // but here I'm writing the test for the DESIRED behavior.

        // So I expect this test to FAIL initially.
        expect(vessel.orbitPath[0]).toBe(firstPoint);

        // However, I want to modify the code first, so I can pass the test.
    });
});
