/**
 * Maneuver Planner UI
 *
 * Interface for planning orbital maneuvers.
 * Allows users to calculate burns for circularization and Hohmann transfers.
 */

import { Game } from '../core/Game';
import {
    calculateOrbitalElements,
    calculateCircularizationFromElements,
    calculateHohmannTransfer,
    KeplerianElements,
    ManeuverPlan
} from '../physics/OrbitalMechanics';
import { vec2, IVessel } from '../types';
import { PIXELS_PER_METER, R_EARTH } from '../config/Constants';

export class ManeuverPlanner {
    private game: Game;
    private modal: HTMLElement | null = null;
    private contentDiv: HTMLElement | null = null;
    private isVisible: boolean = false;
    private updateInterval: number | null = null;

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
        modal.innerHTML = `
            <div class="script-editor-content maneuver-planner-content" role="dialog" aria-modal="true" aria-labelledby="planner-title">
                <div class="script-editor-header">
                    <h2 id="planner-title">Orbital Maneuver Planner</h2>
                    <button id="planner-close-btn" class="script-close-btn" aria-label="Close Maneuver Planner">×</button>
                </div>
                
                <div class="script-editor-body maneuver-planner-body">
                    <div class="maneuver-section">
                        <h3>Current Orbit</h3>
                        <div id="planner-orbit-stats" class="stats-grid">
                            <div><strong>Apoapsis:</strong> <span id="planner-stat-apo">--</span> km</div>
                            <div><strong>Periapsis:</strong> <span id="planner-stat-peri">--</span> km</div>
                            <div><strong>Period:</strong> <span id="planner-stat-period">--</span> min</div>
                            <div><strong>Eccentricity:</strong> <span id="planner-stat-ecc">--</span></div>
                        </div>
                    </div>

                    <div class="maneuver-section">
                        <h3>Select Maneuver</h3>
                        <select id="maneuver-type-select" class="script-select maneuver-select">
                            <option value="circularize-apo">Circularize at Apoapsis</option>
                            <option value="circularize-peri">Circularize at Periapsis</option>
                            <option value="hohmann">Hohmann Transfer</option>
                        </select>

                        <div id="hohmann-inputs" class="maneuver-input-group" style="display: none;">
                            <label class="maneuver-label">Target Altitude (km):</label>
                            <input type="number" id="target-alt-input" class="script-name-input maneuver-input"
                                value="500">
                        </div>
                    </div>

                    <div class="maneuver-section">
                        <h3>Maneuver Plan</h3>
                        <div id="planner-results" class="maneuver-results" aria-live="polite">
                            Select a maneuver to calculate...
                        </div>
                    </div>
                </div>
                
                <div class="script-editor-footer">
                    <button id="planner-refresh-btn" class="script-btn">Refresh</button>
                    <!-- Future: Load to flight computer -->
                    <!-- <button id="planner-program-btn" class="script-btn script-btn-primary">Program Flight Computer</button> -->
                </div>
            </div>
        `;

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
        if (this.modal) {
            this.modal.style.display = 'flex';
            this.modal.classList.add('visible');
            this.isVisible = true;
            this.updateOrbitStats();
            this.calculateManeuver();

            // Auto-update every second
            this.updateInterval = window.setInterval(() => {
                if (this.isVisible) this.updateOrbitStats();
            }, 1000);
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
        }
    }

    /**
     * Toggle visibility
     */
    toggle(): void {
        if (this.isVisible) this.hide();
        else this.show();
    }

    private getCurrentOrbitalElements(vessel: IVessel): KeplerianElements {
        const altitude = (this.game.groundY - vessel.y - vessel.h) / PIXELS_PER_METER;
        const r = R_EARTH + altitude;
        const rVec = vec2(0, r);
        const vVec = vec2(vessel.vx, -vessel.vy);
        return calculateOrbitalElements(rVec, vVec);
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
        // the game uses 2D flat earth approximation for "x" but "y" is radial gravity...
        // Wait, the game *does* use radial gravity:
        // Game.ts: const pG = 9.8 * Math.pow(R_EARTH / pRad, 2);
        // Vessel.ts: const dist = R_EARTH + (this.groundY - this.y - this.h) / PIXELS_PER_METER;

        // So 'y' is effectively the radial distance axis, and 'x' is tangential?
        // Let's verify Vessel.ts gravity application.
        // Vessel.ts:
        // const g = 9.8 * Math.pow(R_EARTH/dist, 2);
        // derivatives.dvy += g; (which implies g acts downwards in +y)
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

        const elements = this.getCurrentOrbitalElements(vessel);

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
        const elements = this.getCurrentOrbitalElements(vessel);

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
            resultDiv.innerHTML = '';

            let plan: ManeuverPlan | null = null;

            if (type === 'circularize-apo') {
                plan = calculateCircularizationFromElements(elements, true, thrust, mass);
                this.renderManeuverPlan(plan, resultDiv);
            } else if (type === 'circularize-peri') {
                plan = calculateCircularizationFromElements(elements, false, thrust, mass);
                this.renderManeuverPlan(plan, resultDiv);
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

                this.renderHohmannPlan(hResult, targetAltKm, resultDiv);
            }
        } catch (e: any) {
            resultDiv.innerHTML = '';
            const errorSpan = document.createElement('span');
            errorSpan.className = 'maneuver-error';
            errorSpan.textContent = `Error: ${e.message}`;
            resultDiv.appendChild(errorSpan);
        }
    }

    private renderManeuverPlan(plan: ManeuverPlan, container: HTMLElement): void {
        const strong = document.createElement('strong');
        strong.textContent = plan.description;
        container.appendChild(strong);

        container.appendChild(document.createElement('br'));

        const hr = document.createElement('hr');
        hr.className = 'maneuver-separator';
        container.appendChild(hr);

        const targetDiv = document.createElement('div');
        targetDiv.textContent = `Target Orbit: ${(plan.targetOrbit.apoapsis / 1000).toFixed(0)} x ${(plan.targetOrbit.periapsis / 1000).toFixed(0)} km`;
        container.appendChild(targetDiv);

        const dvDiv = document.createElement('div');
        dvDiv.className = 'maneuver-dv-container';
        const dvSpan = document.createElement('span');
        dvSpan.className = 'maneuver-dv-value';
        dvSpan.textContent = `ΔV: ${plan.deltaV.toFixed(1)} m/s`;
        dvDiv.appendChild(dvSpan);
        container.appendChild(dvDiv);

        const burnDiv = document.createElement('div');
        burnDiv.textContent = `Burn Duration: ${plan.burnTime.toFixed(1)} s`;
        container.appendChild(burnDiv);

        const waitDiv = document.createElement('div');
        waitDiv.className = 'maneuver-wait-text';
        waitDiv.textContent = `Wait for ${plan.description.includes('Apoapsis') ? 'Apoapsis' : 'Periapsis'} to execute.`;
        container.appendChild(waitDiv);
    }

    private renderHohmannPlan(hResult: any, targetAltKm: number, container: HTMLElement): void {
        const strong = document.createElement('strong');
        strong.textContent = `Hohmann Transfer to ${targetAltKm} km`;
        container.appendChild(strong);

        container.appendChild(document.createElement('br'));

        const hr = document.createElement('hr');
        hr.className = 'maneuver-separator';
        container.appendChild(hr);

        const timeDiv = document.createElement('div');
        timeDiv.textContent = `Transfer Time: ${(hResult.transferTime / 60).toFixed(1)} min`;
        container.appendChild(timeDiv);

        const burn1Header = document.createElement('div');
        burn1Header.className = 'maneuver-burn-header';
        burn1Header.textContent = 'Burn 1 (Departure):';
        container.appendChild(burn1Header);

        const dv1Div = document.createElement('div');
        dv1Div.textContent = `ΔV: ${hResult.deltaV1.toFixed(1)} m/s`;
        container.appendChild(dv1Div);

        const dur1Div = document.createElement('div');
        dur1Div.textContent = `Duration: ${hResult.burnTime1.toFixed(1)} s`;
        container.appendChild(dur1Div);

        const burn2Header = document.createElement('div');
        burn2Header.className = 'maneuver-burn-header';
        burn2Header.textContent = 'Burn 2 (Arrival):';
        container.appendChild(burn2Header);

        const dv2Div = document.createElement('div');
        dv2Div.textContent = `ΔV: ${hResult.deltaV2.toFixed(1)} m/s`;
        container.appendChild(dv2Div);

        const totalDvDiv = document.createElement('div');
        totalDvDiv.textContent = `Total ΔV: ${(hResult.deltaV1 + hResult.deltaV2).toFixed(1)} m/s`;
        container.appendChild(totalDvDiv);
    }
}
