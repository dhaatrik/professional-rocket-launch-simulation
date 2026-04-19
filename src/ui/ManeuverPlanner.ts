/**
 * Maneuver Planner UI
 *
 * Interface for planning orbital maneuvers.
 * Allows users to calculate burns for circularization and Hohmann transfers.
 */

import { Game } from '../core/Game';
import {
    calculateCircularizationFromElements,
    calculateHohmannTransfer,
    KeplerianElements,
    ManeuverPlan
} from '../physics/OrbitalMechanics';
import { R_EARTH } from '../config/Constants';
import { getCurrentOrbitalElements } from '../physics/OrbitPrediction';
import { buildModalStructure, renderManeuverPlan, renderHohmannPlan, renderErrorMessage } from './ManeuverPlannerDOM';

export class ManeuverPlanner {
    private game: Game;
    private modal: HTMLElement | null = null;
    private contentDiv: HTMLElement | null = null;
    private isVisible: boolean = false;
    private updateInterval: number | null = null;
    private escapeHandler: ((e: KeyboardEvent) => void) | null = null;
    private invokingElement: HTMLElement | null = null;

    constructor(game: Game) {
        this.game = game;
        this.createModal();
        this.attachEventListeners();
    }

    /**
     * Create the modal HTML structure
     */
    private createModal(): void {
        if (document.getElementById('maneuver-planner-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'maneuver-planner-modal';
        modal.className = 'script-editor-modal'; // Reuse script editor styling for consistency
        modal.style.display = 'none'; // Hidden by default

        modal.appendChild(buildModalStructure());

        document.body.appendChild(modal);
        this.modal = modal;
        this.contentDiv = document.getElementById('planner-results');
    }

    /**
     * Attach event listeners
     */
    private attachEventListeners(): void {
        document.getElementById('planner-close-btn')?.addEventListener('click', () => this.hide());

        // Maneuver select change
        document.getElementById('maneuver-type-select')?.addEventListener('change', (e) => {
            const select = e.target as HTMLSelectElement;
            const hohmannInputs = document.getElementById('hohmann-inputs');
            if (hohmannInputs) {
                hohmannInputs.style.display = select.value === 'hohmann' ? 'block' : 'none';
            }
            this.calculateManeuver();
        });

        // Target altitude input change
        document.getElementById('target-alt-input')?.addEventListener('change', () => {
            this.calculateManeuver();
        });

        // Refresh button
        document.getElementById('planner-refresh-btn')?.addEventListener('click', () => {
            this.updateOrbitStats();
            this.calculateManeuver();
        });
    }

    /**
     * Show the planner
     */
    show(): void {
        if (!this.isVisible) {
            this.invokingElement = document.activeElement as HTMLElement;
        }
        if (this.modal) {
            this.modal.style.display = 'flex';
            this.modal.classList.add('visible');
            this.isVisible = true;

            // Set focus for accessibility
            document.getElementById('maneuver-type-select')?.focus();

            this.updateOrbitStats();
            this.calculateManeuver();

            // Auto-update every second
            this.updateInterval = window.setInterval(() => {
                if (this.isVisible) this.updateOrbitStats();
            }, 1000);

            this.escapeHandler = (e: KeyboardEvent) => {
                if (e.key === 'Escape' && this.isVisible) {
                    this.hide();
                }
            };
            document.addEventListener('keydown', this.escapeHandler);
        }
    }

    /**
     * Hide the planner
     */
    hide(): void {
        if (this.modal) {
            this.modal.style.display = 'none';
            this.modal.classList.remove('visible');
            this.isVisible = false;

            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }

            if (this.escapeHandler) {
                document.removeEventListener('keydown', this.escapeHandler);
                this.escapeHandler = null;
            }

            // Return focus to invoking element for accessibility
            if (this.invokingElement) {
                this.invokingElement.focus();
                this.invokingElement = null;
            }
        }
    }

    /**
     * Toggle visibility
     */
    toggle(): void {
        if (this.isVisible) this.hide();
        else this.show();
    }

    /**
     * Update current orbit statistics display
     */
    private updateOrbitStats(): KeplerianElements | null {
        const vessel = this.game.mainStack; // Assume main stack for now
        if (!vessel) return null;

        // Position relative to Earth Center
        // Simulation coordinates: y=groundY is surface. Earth center is groundY + R_EARTH
        // But y decreases as we go up.
        // So altitude = (groundY - y - h) / PIXELS_PER_METER
        // r = R_EARTH + altitude
        // Let's rely on calculating elements freshly

        // NOTE: Coordinate system in OrbitMechanics expects standard physics vectors.
        // We need to convert from sim coordinates to meters.

        // 1. Get state in meters relative to Earth Center
        // Sim Origin: Top-Left (0,0)
        // Ground Level: game.groundY
        // Earth Center: (vessel.x, game.groundY + R_EARTH*PPM) - approximate since x is flat
        // Improved approximation:
        // r_vec = (0, R_EARTH + altitude) -- treating current pos as vertical for simplicity?
        // No, we need 2D orbital elements.
        // Let's use the local planet-centered frame:
        // Center = (0, 0)
        // Vessel = (x / 10, -(groundY - y)/10 - R_EARTH) ??
        // Actually, let's just use scalar magnitude for altitude and velocity since
        // the game uses 2D flat earth approximation for "x" but "y" is radial gravity.
        // In this model, 'y' is effectively the radial distance axis, and 'x' is tangential.
        // This is a "Flat Earth with Gravity Gradient" model, NOT a true spherical gravity model.
        // X position does not curve around the planet.
        // This makes "Orbital Mechanics" slightly fake but we can approximate.
        // In this model:
        // r = R_EARTH + altitude
        // v = sqrt(vx^2 + vy^2)
        // We can treat it as a 1D radial problem + tangential velocity?
        // Real orbital elements require a central potential.
        // Since gravity direction is constant (down), specific angular momentum is tricky.
        // BUT, for the purpose of this "Planner", we can pretend we are in a central force field
        // where r = R_EARTH + altitude, and v_tangential = vx, v_radial = -vy.

        const elements = getCurrentOrbitalElements(vessel, this.game.groundY);

        const apoEl = document.getElementById('planner-stat-apo');
        if (apoEl) apoEl.textContent = (elements.apoapsis / 1000).toFixed(1);

        const periEl = document.getElementById('planner-stat-peri');
        if (periEl) periEl.textContent = (elements.periapsis / 1000).toFixed(1);

        const periodEl = document.getElementById('planner-stat-period');
        if (periodEl) periodEl.textContent = (elements.period / 60).toFixed(1);

        const eccEl = document.getElementById('planner-stat-ecc');
        if (eccEl) eccEl.textContent = elements.eccentricity.toFixed(3);

        return elements;
    }

    /**
     * Calculate and display maneuver plan
     */
    private calculateManeuver(): void {
        const vessel = this.game.mainStack;
        if (!vessel) return;

        // Recalculate elements (should ideally cache this)
        const elements = getCurrentOrbitalElements(vessel, this.game.groundY);

        const select = document.getElementById('maneuver-type-select') as HTMLSelectElement;
        const type = select.value;
        const resultDiv = document.getElementById('planner-results');

        if (!resultDiv) return;

        // Current vessel capabilities
        // Estimate thrust (use max thrust for now as we burn at 100%)
        // We need to know which engine is active/available.
        // Simplified: Use current max thrust.
        // For mass, use current mass.
        const thrust = vessel.maxThrust; // N
        const mass = vessel.mass; // kg

        try {
            // Clear previous results
            resultDiv.textContent = '';

            let plan: ManeuverPlan | null = null;

            if (type === 'circularize-apo') {
                plan = calculateCircularizationFromElements(elements, true, thrust, mass);
                renderManeuverPlan(plan, resultDiv);
            } else if (type === 'circularize-peri') {
                plan = calculateCircularizationFromElements(elements, false, thrust, mass);
                renderManeuverPlan(plan, resultDiv);
            } else if (type === 'hohmann') {
                const targetAltKm =
                    parseFloat((document.getElementById('target-alt-input') as HTMLInputElement).value) || 500;
                const targetR = R_EARTH + targetAltKm * 1000;

                // Assume starting from circular orbit at current altitude for simplicity of the planner?
                // Or calculate from current circular orbit radius?
                // Standard Hohmann starts from one circular to another.
                // Let's use current semi-major axis as "r1" approx?
                // No, Hohmann equations provided need r1, r2.
                // Best approximation: r1 = current (r_apo + r_peri)/2, i.e., semi-major axis?
                // Or just current altitude if roughly circular.
                // Let's use current semi-major axis as starting "radius" (mean radius).

                // For proper Hohmann, we assume we are in circular orbit 1 and want to go to circular orbit 2.
                // If we are elliptical, it's more complex (Elliptical Transfer).
                // Simplified: r1 = SemiMajorAxis, r2 = TargetR
                // This gives delta-v between two generic circular orbits.

                const r1 = elements.semiMajorAxis;
                const hResult = calculateHohmannTransfer(r1, targetR, thrust, mass);

                renderHohmannPlan(hResult, targetAltKm, resultDiv);
            }
        } catch (e: unknown) {
            resultDiv.textContent = '';
            renderErrorMessage(`Error: ${e instanceof Error ? e.message : String(e)}`, resultDiv);
        }
    }
}
