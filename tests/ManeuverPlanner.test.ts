
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ManeuverPlanner } from '../src/ui/ManeuverPlanner';
import { Game } from '../src/core/Game';
import * as OrbitalMechanics from '../src/physics/OrbitalMechanics';

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

describe('ManeuverPlanner Logic', () => {
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

    it('should calculate orbit stats when shown', () => {
        planner.show();

        const statsDiv = document.getElementById('planner-orbit-stats');
        expect(statsDiv).not.toBeNull();
        expect(statsDiv?.textContent).toContain('Apoapsis');

        expect(OrbitalMechanics.calculateOrbitalElements).toHaveBeenCalled();
    });

    it('should calculate circularization maneuver', () => {
        planner.show();
        const select = document.getElementById('maneuver-type-select') as HTMLSelectElement;
        select.value = 'circularize-apo';

        // This causes this.calculateManeuver() to be called inside ManeuverPlanner.ts
        select.dispatchEvent(new Event('change'));

        const resultDiv = document.getElementById('planner-results');
        expect(resultDiv?.textContent).toContain('Circularize');

        expect(OrbitalMechanics.calculateCircularizationFromElements).toHaveBeenCalled();
    });

    it('should calculate hohmann transfer', () => {
        planner.show();
        const select = document.getElementById('maneuver-type-select') as HTMLSelectElement;
        select.value = 'hohmann';
        select.dispatchEvent(new Event('change'));

        const resultDiv = document.getElementById('planner-results');
        expect(resultDiv?.textContent).toContain('Hohmann Transfer');

        expect(OrbitalMechanics.calculateHohmannTransfer).toHaveBeenCalled();
    });

    it('should display an error message if calculation fails', () => {
        // Mock calculateCircularizationFromElements so it throws an error on subsequent calls
        vi.mocked(OrbitalMechanics.calculateCircularizationFromElements).mockImplementation(() => {
            throw new Error('Test Error');
        });

        // Initialize planner
        planner.show();

        const select = document.getElementById('maneuver-type-select') as HTMLSelectElement;
        select.value = 'circularize-apo';
        select.dispatchEvent(new Event('change'));

        const resultDiv = document.getElementById('planner-results');

        const errorEl = resultDiv?.querySelector('.maneuver-error');

        expect(errorEl).not.toBeNull();
        expect(errorEl?.textContent).toContain('Error: Test Error');
    });
});
