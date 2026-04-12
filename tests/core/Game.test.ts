/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Game } from '../../src/core/Game';
import { R_EARTH, PIXELS_PER_METER } from '../../src/config/Constants';

vi.mock('../../src/utils/AudioEngine', () => {
    return {
        AudioEngine: class {
            init = vi.fn();
            resume = vi.fn();
            playStaging = vi.fn();
            speak = vi.fn();
        }
    };
});

describe('Game', () => {
    let game: Game;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup DOM environment expected by Game
        document.body.innerHTML = `
            <canvas id="canvas" width="1920" height="1080"></canvas>
            <canvas id="navball" width="200" height="200"></canvas>
            <div id="mission-log"></div>
            <div id="checklist-panel"></div>
            <div id="fis-panel"></div>
            <div id="telemetry-panel"></div>
            <div id="gauge-fuel"></div>
            <div id="gauge-thrust"></div>
            <div id="fuel-gauge-container"></div>
            <div id="thrust-gauge-container"></div>
            <div id="hud-aoa"></div>
            <div id="hud-stability"></div>
            <div id="hud-skin-temp"></div>
            <div id="hud-tps-status"></div>
            <div id="hud-engine-status"></div>
            <div id="hud-igniters"></div>
            <div id="hud-fts-state"></div>
            <div id="mission-control-panel"></div>
            <div id="maneuver-planner"></div>
            <div id="time-warp-display"></div>
            <div id="notification-container"></div>
            <div id="telemetry-connection-status"></div>
            <div id="telemetry-rate"></div>
            <div id="telemetry-buffer"></div>
        `;

        // Mock canvas context
        const canvas = document.getElementById('canvas') as HTMLCanvasElement;
        const navball = document.getElementById('navball') as HTMLCanvasElement;

        const mockCtx = {
            clearRect: vi.fn(),
            save: vi.fn(),
            translate: vi.fn(),
            rotate: vi.fn(),
            fillRect: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            arc: vi.fn(),
            clip: vi.fn(),
            createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
            fillText: vi.fn(),
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1
        };

        canvas.getContext = vi.fn().mockReturnValue(mockCtx);
        navball.getContext = vi.fn().mockReturnValue(mockCtx);

        vi.stubGlobal('Worker', class {
            postMessage = vi.fn();
            onmessage = null;
            terminate = vi.fn();
            addEventListener = vi.fn();
        });

        // Mock requestAnimationFrame
        vi.stubGlobal('requestAnimationFrame', vi.fn((cb: any) => setTimeout(cb, 16)));

        // Mock global constants
        window.PIXELS_PER_METER = PIXELS_PER_METER;
        window.R_EARTH = R_EARTH;

        game = new Game();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('should initialize Game successfully', () => {
        expect(game).toBeDefined();
        expect(game.input).toBeDefined();
        expect(game.audio).toBeDefined();
        expect(game.assets).toBeDefined();
    });

    it('should set and process throttle correctly', () => {
        game.setThrottle(0.5);
        expect(game.commandThrottle).toBe(0.5);

        game.setThrottle(1.5);
        expect(game.commandThrottle).toBe(1.0); // clamped to 1.0

        game.setThrottle(-0.5);
        expect(game.commandThrottle).toBe(0.0); // clamped to 0.0
    });

    it('should reset state correctly', () => {
        game.commandThrottle = 0.8;
        game.stagingCommand = true;
        game.entities = [{ id: 1 } as any];

        game.reset();

        expect(game.entities.length).toBe(0);
        expect(game.commandThrottle).toBe(0);
        expect(game.stagingCommand).toBe(false);
    });

    it('should perform launch correctly', () => {
        game.launch();

        expect(game.commandThrottle).toBe(1.0);
    });

    it('should ignore duplicate launch command', () => {
        // Set mission state directly via any bypass since it's private
        (game as any).missionState.liftoff = true;
        game.commandThrottle = 0;

        game.launch();

        expect(game.commandThrottle).toBe(0); // Should not change
    });

    it('should handle physics events correctly', () => {
        const cb = vi.fn();
        game.addPhysicsEventListener(cb);

        (game as any).handlePhysicsEvent({ name: 'STAGING_S1' });

        expect(cb).toHaveBeenCalled();
        expect(game.audio.playStaging).toHaveBeenCalled();
    });

    it('should perform staging correctly', () => {
        (game as any).lastStageTime = 0; // force passing time check
        const spy = vi.spyOn((game as any).physics, 'command');

        game.performStaging();

        expect(game.stagingCommand).toBe(true);
        expect(spy).toHaveBeenCalledWith('STAGE', {});
    });

    it('should forward command to physics proxy', () => {
        const spy = vi.spyOn((game as any).physics, 'command');
        game.command('TEST_CMD', { foo: 'bar' });
        expect(spy).toHaveBeenCalledWith('TEST_CMD', { foo: 'bar' });
    });

    it('should query flight computer status from physics proxy', () => {
        const status = { active: true, script: null, pc: 0 };
        vi.spyOn((game as any).physics, 'getFlightComputerStatus').mockReturnValue(status);

        const result = game.getFlightComputerStatus();
        expect(result).toBe(status);
    });
});
