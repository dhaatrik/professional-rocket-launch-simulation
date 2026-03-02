import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MissionControl } from '../src/ui/MissionControl';
import { Game } from '../src/core/Game';
import * as OrbitalMechanics from '../src/physics/OrbitalMechanics';

// Mock OrbitalMechanics
vi.mock('../src/physics/OrbitalMechanics', () => {
    return {
        calculateGroundTrack: vi.fn().mockImplementation((x, time) => {
            return { lat: 0.1, lon: 0.2 };
        }),
        LAUNCH_SITE: { lat: 28.56, lon: -80.57 } // Cape Canaveral
    };
});

describe('MissionControl', () => {
    let mockGame: Game;
    let container: HTMLElement;
    let overlay: HTMLElement;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = '';
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);

        overlay = document.createElement('div');
        overlay.id = 'mission-control-overlay';
        overlay.style.display = 'none';
        container.appendChild(overlay);

        // Mock Game
        mockGame = {
            trackedEntity: {
                x: 1000,
                y: 50000,
                vx: 100,
                vy: 200,
                h: 10
            },
            missionTime: 0
        } as unknown as Game;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should pre-fill path with launch site in constructor', () => {
        const mc = new MissionControl(mockGame);
        const pathPoints = (mc as any).pathPoints;
        expect(pathPoints).toHaveLength(1);
        expect(pathPoints[0].lat).toBe(28.56);
        expect(pathPoints[0].lon).toBe(-80.57);
    });

    it('should toggle visibility and update DOM', () => {
        const mc = new MissionControl(mockGame);

        expect((mc as any).isVisible).toBe(false);
        expect(overlay.style.display).toBe('none');

        mc.toggle();
        expect((mc as any).isVisible).toBe(true);
        expect(overlay.style.display).toBe('block');

        mc.toggle();
        expect((mc as any).isVisible).toBe(false);
        expect(overlay.style.display).toBe('none');
    });

    it('should not update path if time difference is less than 1.0', () => {
        const mc = new MissionControl(mockGame);
        const initialLength = (mc as any).pathPoints.length;

        mc.update(0.1, 0.5); // dt, time
        expect((mc as any).pathPoints).toHaveLength(initialLength);
        expect(OrbitalMechanics.calculateGroundTrack).not.toHaveBeenCalled();
    });

    it('should update path if time difference is greater than 1.0', () => {
        const mc = new MissionControl(mockGame);
        const initialLength = (mc as any).pathPoints.length;

        mc.update(0.1, 1.5); // time = 1.5, lastPathUpdate = 0
        expect((mc as any).pathPoints).toHaveLength(initialLength + 1);
        expect(OrbitalMechanics.calculateGroundTrack).toHaveBeenCalledWith(1000, 1.5);

        const newPoint = (mc as any).pathPoints[1];
        expect(newPoint.lat).toBe(0.1);
        expect(newPoint.lon).toBe(0.2);
    });

    it('should limit path length to 3600 to prevent memory leaks', () => {
        const mc = new MissionControl(mockGame);

        // Fill pathPoints to 3600
        for (let i = 0; i < 3599; i++) {
            (mc as any).addPathPoint(0, 0);
        }
        expect((mc as any).pathPoints).toHaveLength(3600);

        // Update to add one more point (should trigger shift)
        mc.update(0.1, 1.5);

        expect((mc as any).pathPoints).toHaveLength(3600);
        const lastPoint = (mc as any).pathPoints[3599];
        expect(lastPoint.lat).toBe(0.1);
        expect(lastPoint.lon).toBe(0.2);
    });

    it('should not draw anything if not visible', () => {
        const mc = new MissionControl(mockGame);
        const mockCtx = {
            fillRect: vi.fn(),
        } as unknown as CanvasRenderingContext2D;

        mc.draw(mockCtx, 1000, 1000);
        expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should draw grid, points, and background when visible', () => {
        const mc = new MissionControl(mockGame);
        mc.toggle(); // Set visible

        const mockCtx = {
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 0,
            font: '',
            fillRect: vi.fn(),
            strokeRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
            arc: vi.fn(),
            fillText: vi.fn(),
        } as unknown as CanvasRenderingContext2D;

        mc.draw(mockCtx, 1000, 1000);

        // Background
        expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 1000, 1000);

        // Map Grid Rect
        expect(mockCtx.strokeRect).toHaveBeenCalled();

        // Launch Site
        expect(mockCtx.fillText).toHaveBeenCalledWith('CAPE', expect.any(Number), expect.any(Number));

        // Overlay Text
        expect(mockCtx.fillText).toHaveBeenCalledWith('MISSION CONTROL - GROUND TRACK', expect.any(Number), expect.any(Number));
    });
});
