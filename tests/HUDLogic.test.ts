
import { describe, it, expect, vi } from 'vitest';

// Mock dependencies BEFORE import
const mockCanvas = {
    getContext: vi.fn(() => ({})),
    width: 0,
    height: 0,
    addEventListener: vi.fn(),
};
const mockElement = {
    style: { display: 'none', color: '' },
    textContent: '',
    className: '',
    addEventListener: vi.fn(),
    getContext: vi.fn(() => ({})), // Add getContext here too just in case
};

vi.stubGlobal('document', {
    getElementById: vi.fn((id) => {
        if (id === 'canvas' || id === 'navball' || id === 'graph-canvas' || id.includes('canvas')) return { ...mockCanvas };
        // All other IDs return a mock element with addEventListener
        return {
            ...mockElement,
            id,
            addEventListener: vi.fn(),
            style: { display: 'none', color: '' } // Ensure fresh style object
        };
    }),
    createElement: vi.fn(() => ({
        getContext: () => ({}),
        width: 0,
        height: 0,
        addEventListener: vi.fn(),
        setAttribute: vi.fn(),
        style: {},
        appendChild: vi.fn()
    })),
    addEventListener: vi.fn(),
});
vi.stubGlobal('window', {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
});
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

// Import Game
import { Game } from '../src/core/Game';

describe('Game HUD Logic', () => {
    it('should toggle MaxQ warning correctly', () => {
        const game = new Game();

        // Setup initial state
        const hudMaxQ = { style: { display: 'none' }, textContent: '' };
        (game as any).hudMaxQ = hudMaxQ;
        (game as any).lastHUDState.maxQWarning = false;

        // Create dummy envState
        const envState = {
            windVelocity: { x: 0, y: 0 },
            densityMultiplier: 1,
            surfaceWindSpeed: 0,
            surfaceWindDirection: 0,
            timeOfDay: 0,
            isLaunchSafe: true,
            maxQWindWarning: false
        };

        // 1. Trigger Warning
        envState.maxQWindWarning = true;
        (game as any).lastEnvState = envState;
        (game as any).drawHUD();

        expect(hudMaxQ.style.display).toBe('block');
        expect(hudMaxQ.textContent).toContain('HIGH WIND SHEAR');
        expect((game as any).lastHUDState.maxQWarning).toBe(true);

        // 2. Clear Warning
        envState.maxQWindWarning = false;
        (game as any).lastEnvState = envState;
        (game as any).drawHUD();

        expect(hudMaxQ.style.display).toBe('none');
        expect((game as any).lastHUDState.maxQWarning).toBe(false);
    });
});
