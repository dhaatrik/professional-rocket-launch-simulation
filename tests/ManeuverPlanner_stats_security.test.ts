
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ManeuverPlanner } from '../src/ui/ManeuverPlanner';
import { Game } from '../src/core/Game';
import * as OrbitalMechanics from '../src/physics/OrbitalMechanics';

// Mock dependencies
vi.mock('../src/physics/OrbitalMechanics', async (importOriginal) => {
    const mod = await importOriginal<typeof import('../src/physics/OrbitalMechanics')>();
    return {
        ...mod,
        calculateOrbitalElements: vi.fn(),
    };
});

describe('ManeuverPlanner Stats Security', () => {
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
            groundY: 1000,
            mainStack: {
                x: 0,
                y: 0,
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

    it('should render orbit stats correctly without using innerHTML for dynamic values', () => {
        // Mock calculateOrbitalElements to return known values
        vi.spyOn(OrbitalMechanics, 'calculateOrbitalElements').mockReturnValue({
             apoapsis: 200000, // 200 km
             periapsis: 150000, // 150 km
             period: 5400, // 90 min
             eccentricity: 0.01,
             semiMajorAxis: 6571000,
             trueAnomaly: 0,
             specificEnergy: -30000000
        });

        planner.show();

        const statsDiv = document.getElementById('planner-orbit-stats');
        expect(statsDiv).not.toBeNull();

        // Check content
        const text = statsDiv?.textContent;
        expect(text).toContain('Apoapsis: 200.0 km');
        expect(text).toContain('Periapsis: 150.0 km');
        expect(text).toContain('Period: 90.0 min');
        expect(text).toContain('Eccentricity: 0.010');

        // Check structure (optional, but good to verify it's not just a big blob of text)
        const divs = statsDiv?.querySelectorAll('div');
        expect(divs?.length).toBe(4);

        // Verify specific elements exist
        expect(statsDiv?.querySelector('#planner-stat-apo')).not.toBeNull();
        expect(statsDiv?.querySelector('#planner-stat-peri')).not.toBeNull();
        expect(statsDiv?.querySelector('#planner-stat-period')).not.toBeNull();
        expect(statsDiv?.querySelector('#planner-stat-ecc')).not.toBeNull();
    });

    it('should handle potential malicious input gracefully if types were compromised', () => {
        // This test simulates if 'apoapsis' somehow became a string with HTML.
        // In the current implementation (using innerHTML), this WOULD render the HTML (XSS).
        // After refactor (using textContent), it should render the text literal.

        // We force cast the return value to any to bypass TS checks
        vi.spyOn(OrbitalMechanics, 'calculateOrbitalElements').mockReturnValue({
             apoapsis: '<img src=x onerror=alert(1)>' as any,
             periapsis: 150000,
             period: 5400,
             eccentricity: 0.01,
             semiMajorAxis: 6571000,
             trueAnomaly: 0,
             specificEnergy: -30000000
        });

        planner.show();

        const statsDiv = document.getElementById('planner-orbit-stats');

        // Current behavior (before fix): The number division/toFixed might fail or produce NaN
        // But if we passed it directly, innerHTML would execute.
        // Since the code does `(elements.apoapsis / 1000).toFixed(1)`,
        // passing a string like '<img...>' results in NaN because division by 1000 returns NaN.
        // So the attack is neutralized by arithmetic operations.
        // However, we still want to ensure we don't use innerHTML.

        // Let's verify that we see 'NaN' or similar, and definitely NO image tag.
        expect(statsDiv?.querySelector('img')).toBeNull();

        // The text content should likely contain 'NaN'
        expect(statsDiv?.textContent).toContain('Apoapsis: NaN km');
    });
});
