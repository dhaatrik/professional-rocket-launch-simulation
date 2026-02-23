
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ManeuverPlanner } from '../src/ui/ManeuverPlanner';
import { Game } from '../src/core/Game';

// Mock dependencies
vi.mock('../src/physics/OrbitalMechanics', async (importOriginal) => {
    const mod = await importOriginal<typeof import('../src/physics/OrbitalMechanics')>();
    return {
        ...mod,
        calculateOrbitalElements: vi.fn().mockReturnValue({
             apoapsis: 200000,
             periapsis: 150000,
             period: 5400,
             eccentricity: 0.01,
             semiMajorAxis: 6571000
        }),
        calculateCircularizationFromElements: vi.fn().mockReturnValue({
            deltaV: 100,
            burnTime: 10,
            description: "Circularize",
            targetOrbit: { apoapsis: 200000, periapsis: 200000 }
        }),
        calculateHohmannTransfer: vi.fn().mockReturnValue({
             transferTime: 3000,
             deltaV1: 50,
             burnTime1: 5,
             deltaV2: 50,
             burnTime2: 5
        }),
    };
});

describe('ManeuverPlanner Accessibility', () => {
    let container: HTMLElement;
    let mockGame: Game;
    let planner: ManeuverPlanner;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = '';
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);

        // Mock Game
        mockGame = {
            groundY: 1000, // Ground is at Y=1000
            mainStack: {
                x: 0,
                y: 0, // Vessel is at Y=0 (Altitude = 1000/10 = 100m)
                h: 0,
                vx: 7500,
                vy: 0,
                mass: 1000,
                maxThrust: 10000
            }
        } as unknown as Game;

        planner = new ManeuverPlanner(mockGame);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should have proper ARIA attributes on the modal', () => {
        planner.show();
        const modal = document.getElementById('maneuver-planner-modal');
        const modalContent = modal?.querySelector('.maneuver-planner-content');

        expect(modalContent).not.toBeNull();
        expect(modalContent?.getAttribute('role')).toBe('dialog');
        expect(modalContent?.getAttribute('aria-modal')).toBe('true');
        expect(modalContent?.hasAttribute('aria-labelledby')).toBe(true);

        const labelId = modalContent?.getAttribute('aria-labelledby');
        const title = document.getElementById(labelId || '');
        expect(title).not.toBeNull();
        expect(title?.tagName).toBe('H2');
        expect(title?.textContent).toBe('Orbital Maneuver Planner');
    });

    it('should have an accessible close button', () => {
        planner.show();
        const closeBtn = document.getElementById('planner-close-btn');
        expect(closeBtn).not.toBeNull();
        expect(closeBtn?.getAttribute('aria-label')).toBe('Close Maneuver Planner');
    });

    it('should have aria-live region for results', () => {
        planner.show();
        const results = document.getElementById('planner-results');
        expect(results).not.toBeNull();
        expect(results?.getAttribute('aria-live')).toBe('polite');
    });
});
