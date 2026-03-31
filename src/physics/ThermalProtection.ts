/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Thermal Protection System (TPS) & Ablation
 *
 * Models aerodynamic heating, skin temperature, heat shield ablation,
 * and thermal damage for re-entry and high-speed flight.
 */

import { getAtmosphericDensity, DT } from '../config/Constants';

// ============================================================================
// Constants
// ============================================================================

/** Stefan-Boltzmann constant (W/(m²·K⁴)) */
export const STEFAN_BOLTZMANN = 5.67e-8;

/** Ambient temperature at sea level (K) */
export const AMBIENT_TEMP = 293;

/** Space temperature (K) - for high altitude radiative cooling */
export const SPACE_TEMP = 3;

/** Sutton-Graves heating coefficient */
export const SUTTON_GRAVES_K = 1.83e-4;

/** Heat of ablation for typical ablative materials (J/kg) */
export const ABLATION_HEAT = 2.0e6;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Thermal Protection System configuration
 */
export interface TPSConfig {
    /** Nose radius for stagnation heating (m) */
    noseRadius: number;

    /** Initial heat shield mass (kg) - 0 for non-ablative */
    heatShieldMass: number;

    /** Temperature at which ablation begins (K) */
    ablationTemp: number;

    /** Maximum survivable temperature (K) - structural failure above this */
    maxTemp: number;

    /** Surface emissivity for radiative cooling (0-1) */
    emissivity: number;

    /** Thermal mass / heat capacity (J/K) - higher = slower heating */
    thermalMass: number;

    /** Reference area for heating (m²) */
    referenceArea: number;

    /** Ablation efficiency - kg ablated per MJ of heat absorbed */
    ablationRate: number;
}

/**
 * Current thermal state of the vehicle
 */
export interface ThermalState {
    /** Current skin temperature (K) */
    skinTemp: number;

    /** Heat shield remaining (0-1 fraction) */
    heatShieldRemaining: number;

    /** Current heat flux (W/m²) */
    heatFlux: number;

    /** Net heating rate after radiative cooling (W) */
    netHeatingRate: number;

    /** Whether actively ablating */
    isAblating: boolean;

    /** Whether temperature is critical */
    isCritical: boolean;

    /** Accumulated thermal damage (0-100) */
    thermalDamage: number;
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default TPS for full stack (ascending configuration)
 * Standard aluminum skin, no ablative shield
 */
export const DEFAULT_TPS_CONFIG: TPSConfig = {
    noseRadius: 0.5,
    heatShieldMass: 0,
    ablationTemp: 1500,
    maxTemp: 1800, // Aluminum structural limit
    emissivity: 0.3, // Polished aluminum
    thermalMass: 50000, // High thermal inertia
    referenceArea: 2.0,
    ablationRate: 0.5
};

/**
 * Booster TPS config (grid fins, higher thermal tolerance)
 */
export const BOOSTER_TPS_CONFIG: TPSConfig = {
    noseRadius: 0.3,
    heatShieldMass: 50, // Some ablative coating
    ablationTemp: 1200,
    maxTemp: 1600,
    emissivity: 0.8, // Carbon-coated fins
    thermalMass: 30000,
    referenceArea: 1.5,
    ablationRate: 0.4
};

/**
 * Upper stage TPS config (fairing provides initial protection)
 */
export const UPPER_STAGE_TPS_CONFIG: TPSConfig = {
    noseRadius: 0.4,
    heatShieldMass: 20,
    ablationTemp: 1400,
    maxTemp: 1700,
    emissivity: 0.5,
    thermalMass: 15000,
    referenceArea: 1.0,
    ablationRate: 0.5
};

/**
 * Payload TPS config (re-entry capable with heat shield)
 */
export const PAYLOAD_TPS_CONFIG: TPSConfig = {
    noseRadius: 0.2,
    heatShieldMass: 100, // Full ablative shield for re-entry
    ablationTemp: 1000, // Ablator activates early
    maxTemp: 2500, // High temp capable
    emissivity: 0.9, // Dark ablative material
    thermalMass: 5000, // Lower thermal inertia
    referenceArea: 0.5,
    ablationRate: 0.8 // Efficient ablation
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Calculate radiative cooling rate
 *
 * q_rad = ε × σ × A × (T⁴ - T_amb⁴)
 *
 * @param skinTemp - Current skin temperature (K)
 * @param emissivity - Surface emissivity (0-1)
 * @param area - Radiating surface area (m²)
 * @param altitude - Altitude (m) - affects ambient temp
 * @returns Radiative cooling power (W)
 */
export function calculateRadiativeCooling(
    skinTemp: number,
    emissivity: number,
    area: number,
    altitude: number
): number {
    // Ambient temperature decreases with altitude
    // At high altitude, we radiate to space (~3K)
    const altKm = altitude / 1000;
    const ambientTemp = altKm > 100 ? SPACE_TEMP : AMBIENT_TEMP - altKm * 2; // ~2K per km decrease

    // Stefan-Boltzmann radiative cooling
    const t4_skin = skinTemp * skinTemp * skinTemp * skinTemp;
    const t4_ambient = ambientTemp * ambientTemp * ambientTemp * ambientTemp;

    return emissivity * STEFAN_BOLTZMANN * area * (t4_skin - t4_ambient);
}

/**
 * Update thermal state for this timestep
 *
 * @param config - TPS configuration
 * @param currentState - Current thermal state
 * @param velocity - Vehicle velocity (m/s)
 * @param altitude - Altitude (m)
 * @param aoa - Angle of attack (radians)
 * @param dt - Time step (seconds)
 * @returns Updated thermal state
 */
export function updateThermalState(
    config: TPSConfig,
    currentState: ThermalState,
    velocity: number,
    altitude: number,
    aoa: number,
    dt: number
): ThermalState {
    // Calculate heat flux inline
    const rho = getAtmosphericDensity(altitude);
    let heatFlux = 0;

    if (rho >= 1e-10 && velocity >= 100) {
        const sqrtRhoOverR = Math.sqrt(rho / Math.max(config.noseRadius, 0.01));
        const vCubed = velocity * velocity * velocity;
        heatFlux = SUTTON_GRAVES_K * sqrtRhoOverR * vCubed;
        const aoaFactor = 1 + Math.sin(Math.abs(aoa)) * 0.5;
        heatFlux *= aoaFactor;
    }

    // Total heating power (W)
    const heatingPower = heatFlux * config.referenceArea;

    // Radiative cooling power
    const coolingPower = calculateRadiativeCooling(
        currentState.skinTemp,
        config.emissivity,
        config.referenceArea * 2, // Radiate from larger area
        altitude
    );

    // Net heating rate
    let netHeatingRate = heatingPower - coolingPower;

    // Ablation removes heat when above ablation temperature
    let isAblating = false;
    let heatShieldRemaining = currentState.heatShieldRemaining;

    if (currentState.skinTemp > config.ablationTemp && heatShieldRemaining > 0 && config.heatShieldMass > 0) {
        isAblating = true;

        // Heat absorbed by ablation (prevents temperature rise)
        const excessTemp = currentState.skinTemp - config.ablationTemp;
        const ablationHeatAbsorption = excessTemp * config.thermalMass * 0.1;

        // Mass ablated this timestep
        const massAblated = (ablationHeatAbsorption / ABLATION_HEAT) * config.ablationRate * dt;

        // Update shield remaining
        const massLost = Math.min(massAblated, heatShieldRemaining * config.heatShieldMass);
        heatShieldRemaining -= massLost / config.heatShieldMass;
        heatShieldRemaining = Math.max(0, heatShieldRemaining);

        // Ablation absorbs heat, reducing net heating
        netHeatingRate -= ablationHeatAbsorption;
    }

    // Temperature change: dT = (Q * dt) / thermal_mass
    const dTemp = (netHeatingRate * dt) / config.thermalMass;
    let newSkinTemp = currentState.skinTemp + dTemp;

    // Clamp to reasonable values
    newSkinTemp = Math.max(AMBIENT_TEMP * 0.8, newSkinTemp);
    newSkinTemp = Math.min(config.maxTemp * 1.5, newSkinTemp); // Allow some overshoot

    // Thermal damage accumulation
    let thermalDamage = currentState.thermalDamage;
    if (newSkinTemp > config.maxTemp) {
        // Exponential damage above max temp
        const overTemp = newSkinTemp - config.maxTemp;
        const damageRate = (overTemp / 100) * (overTemp / 100) * 10; // damage/s
        thermalDamage += damageRate * dt;
    } else if (newSkinTemp > config.maxTemp * 0.9) {
        // Slow damage near max temp
        thermalDamage += 0.5 * dt;
    }

    thermalDamage = Math.min(100, thermalDamage);

    return {
        skinTemp: newSkinTemp,
        heatShieldRemaining,
        heatFlux,
        netHeatingRate,
        isAblating,
        isCritical: newSkinTemp > config.maxTemp * 0.85,
        thermalDamage
    };
}

/**
 * Get thermal damage rate for integration with vessel health
 *
 * @param state - Current thermal state
 * @param config - TPS configuration
 * @returns Damage rate (health points per second)
 */
export function getThermalDamageRate(state: ThermalState, config: TPSConfig): number {
    if (state.skinTemp < config.maxTemp * 0.9) {
        return 0;
    }

    // Damage scales exponentially above max temp
    const tempRatio = state.skinTemp / config.maxTemp;

    if (tempRatio > 1.0) {
        // Severe damage
        return Math.pow(tempRatio - 1, 2) * 200;
    } else if (tempRatio > 0.9) {
        // Minor damage
        return (tempRatio - 0.9) * 10;
    }

    return 0;
}

/**
 * Create initial thermal state
 */
export function createInitialThermalState(): ThermalState {
    return {
        skinTemp: AMBIENT_TEMP,
        heatShieldRemaining: 1.0,
        heatFlux: 0,
        netHeatingRate: 0,
        isAblating: false,
        isCritical: false,
        thermalDamage: 0
    };
}

/**
 * Convert temperature to display Celsius
 */
export function tempToCelsius(tempK: number): number {
    return tempK - 273.15;
}

/**
 * Get temperature status color for HUD
 */
export function getTempStatusColor(skinTemp: number, maxTemp: number): string {
    const ratio = skinTemp / maxTemp;

    if (ratio > 0.9) return '#e74c3c'; // Red - critical
    if (ratio > 0.7) return '#e67e22'; // Orange - warning
    if (ratio > 0.5) return '#f1c40f'; // Yellow - elevated
    return '#2ecc71'; // Green - nominal
}
