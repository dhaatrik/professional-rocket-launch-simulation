import { describe, it, expect } from 'vitest';
import {
    calculateHeatFlux,
    calculateRadiativeCooling,
    updateThermalState,
    getThermalDamageRate,
    createInitialThermalState,
    tempToCelsius,
    getTempStatusColor,
    STEFAN_BOLTZMANN,
    AMBIENT_TEMP,
    SPACE_TEMP,
    DEFAULT_TPS_CONFIG,
    PAYLOAD_TPS_CONFIG
} from '../../src/physics/ThermalProtection';

describe('Thermal Protection Module', () => {
    describe('calculateHeatFlux', () => {
        it('should return 0 when density is very low (vacuum)', () => {
            // Altitude 250km should have rho < 1e-10
            expect(calculateHeatFlux(5000, 250000, 0.5)).toBe(0);
        });

        it('should return 0 at low speeds', () => {
            expect(calculateHeatFlux(50, 10000, 0.5)).toBe(0);
        });

        it('should increase with velocity cubed', () => {
            const h1 = calculateHeatFlux(1000, 20000, 0.5);
            const h2 = calculateHeatFlux(2000, 20000, 0.5);
            // 2000^3 / 1000^3 = 8
            expect(h2).toBeCloseTo(h1 * 8, 2);
        });

        it('should decrease with larger nose radius', () => {
            const h1 = calculateHeatFlux(2000, 20000, 0.1);
            const h2 = calculateHeatFlux(2000, 20000, 0.4);
            // sqrt(1/0.4) / sqrt(1/0.1) = sqrt(0.25) = 0.5
            expect(h2).toBeCloseTo(h1 * 0.5, 2);
        });

        it('should increase with angle of attack', () => {
            const h0 = calculateHeatFlux(2000, 20000, 0.5, 0);
            const hAoA = calculateHeatFlux(2000, 20000, 0.5, Math.PI / 6); // 30 deg
            // Factor = 1 + sin(30) * 0.5 = 1 + 0.5 * 0.5 = 1.25
            expect(hAoA).toBeCloseTo(h0 * 1.25, 2);
        });
    });

    describe('calculateRadiativeCooling', () => {
        it('should increase with temperature following T^4', () => {
            const c1 = calculateRadiativeCooling(500, 0.8, 1.0, 0);
            const c2 = calculateRadiativeCooling(1000, 0.8, 1.0, 0);
            // (1000^4 - 293^4) / (500^4 - 293^4)
            const ratio = (Math.pow(1000, 4) - Math.pow(293, 4)) / (Math.pow(500, 4) - Math.pow(293, 4));
            expect(c2).toBeCloseTo(c1 * ratio, 2);
        });

        it('should use space temperature at high altitudes', () => {
            const area = 1.0;
            const emissivity = 1.0;
            const temp = 1000;
            const cooling = calculateRadiativeCooling(temp, emissivity, area, 150000);

            const expected = STEFAN_BOLTZMANN * area * emissivity * (Math.pow(temp, 4) - Math.pow(SPACE_TEMP, 4));
            expect(cooling).toBeCloseTo(expected, 2);
        });
    });

    describe('updateThermalState', () => {
        it('should increase temperature when net heating is positive', () => {
            const config = DEFAULT_TPS_CONFIG;
            const state = createInitialThermalState();
            const dt = 1.0;

            // At high speed/low altitude
            const nextState = updateThermalState(config, state, 2000, 10000, 0, dt);
            expect(nextState.skinTemp).toBeGreaterThan(state.skinTemp);
            expect(nextState.heatFlux).toBeGreaterThan(0);
        });

        it('should activate ablation above ablation temperature', () => {
            const config = PAYLOAD_TPS_CONFIG; // ablationTemp: 1000, heatShieldMass: 100
            const state = {
                ...createInitialThermalState(),
                skinTemp: 1200
            };
            const dt = 1.0;

            const nextState = updateThermalState(config, state, 1000, 20000, 0, dt);
            expect(nextState.isAblating).toBe(true);
            expect(nextState.heatShieldRemaining).toBeLessThan(1.0);
        });

        it('should accumulate thermal damage above maxTemp', () => {
            const config = DEFAULT_TPS_CONFIG; // maxTemp: 1800
            const state = {
                ...createInitialThermalState(),
                skinTemp: 2000
            };
            const dt = 1.0;

            const nextState = updateThermalState(config, state, 0, 0, 0, dt);
            expect(nextState.thermalDamage).toBeGreaterThan(0);
        });

        it('should set isCritical flag near maxTemp', () => {
            const config = DEFAULT_TPS_CONFIG; // maxTemp: 1800
            // 0.85 * 1800 = 1530
            const stateLow = { ...createInitialThermalState(), skinTemp: 1500 };
            const stateHigh = { ...createInitialThermalState(), skinTemp: 1600 };

            const nextLow = updateThermalState(config, stateLow, 0, 0, 0, 0.1);
            const nextHigh = updateThermalState(config, stateHigh, 0, 0, 0, 0.1);

            expect(nextLow.isCritical).toBe(false);
            expect(nextHigh.isCritical).toBe(true);
        });
    });

    describe('getThermalDamageRate', () => {
        it('should return 0 for nominal temperatures', () => {
            const state = { ...createInitialThermalState(), skinTemp: 300 };
            expect(getThermalDamageRate(state, DEFAULT_TPS_CONFIG)).toBe(0);
        });

        it('should return severe damage above maxTemp', () => {
            const state = { ...createInitialThermalState(), skinTemp: 2000 };
            const config = DEFAULT_TPS_CONFIG; // maxTemp 1800
            const rate = getThermalDamageRate(state, config);
            expect(rate).toBeGreaterThan(0);

            const tempRatio = 2000 / 1800;
            const expected = Math.pow(tempRatio - 1, 2) * 200;
            expect(rate).toBeCloseTo(expected, 2);
        });
    });

    describe('Helpers', () => {
        it('should convert Kelvin to Celsius', () => {
            expect(tempToCelsius(273.15)).toBe(0);
            expect(tempToCelsius(373.15)).toBe(100);
        });

        it('should return correct status colors', () => {
            const maxTemp = 1000;
            expect(getTempStatusColor(300, maxTemp)).toBe('#2ecc71'); // Nominal
            expect(getTempStatusColor(600, maxTemp)).toBe('#f1c40f'); // Elevated (>0.5)
            expect(getTempStatusColor(800, maxTemp)).toBe('#e67e22'); // Warning (>0.7)
            expect(getTempStatusColor(950, maxTemp)).toBe('#e74c3c'); // Critical (>0.9)
        });

        it('should create correct initial state', () => {
            const state = createInitialThermalState();
            expect(state.skinTemp).toBe(AMBIENT_TEMP);
            expect(state.heatShieldRemaining).toBe(1.0);
            expect(state.thermalDamage).toBe(0);
        });
    });
});
