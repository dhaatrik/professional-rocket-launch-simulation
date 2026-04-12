/**
 * Environment Module
 *
 * Simulates atmospheric and environmental hazards for realistic launch conditions.
 *
 * Features:
 * - Wind Shear: Altitude-layered wind profiles
 * - Gusts: Random turbulence using simplified Dryden model
 * - Day/Night Cycle: Time progression affecting atmospheric density
 * - Go/No-Go Launch Conditions: Wind limit evaluation
 */

import { Vec2 } from '../types/index';
import type { Vector2D } from '../types/index';
import { secureRandom } from '../utils/Security';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Wind layer definition for altitude-based wind profiles
 */
export interface WindLayer {
    /** Minimum altitude for this layer (meters) */
    altitudeMin: number;
    /** Maximum altitude for this layer (meters) */
    altitudeMax: number;
    /** Base wind speed (m/s) */
    windSpeed: number;
    /** Wind direction (radians, 0 = from East, π/2 = from South) */
    windDirection: number;
}

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
    /** Wind layers from surface to high altitude */
    windLayers: WindLayer[];
    /** Maximum gust speed (m/s) */
    maxGustSpeed: number;
    /** Gust frequency - how often gusts change (Hz) */
    gustFrequency: number;
    /** Maximum wind speed for safe launch (m/s) */
    launchWindLimit: number;
    /** Real minutes per simulation day */
    dayCycleMinutes: number;
    /** Enable day/night density variation */
    enableDayNightCycle: boolean;
}

/**
 * Current environmental state
 */
export interface EnvironmentState {
    /** Total wind velocity at current altitude (m/s) */
    windVelocity: Vector2D;
    /** Gust/turbulence component (m/s) */
    gustVelocity: Vector2D;
    /** Current time of day (0-24 hours) */
    timeOfDay: number;
    /** Atmospheric density multiplier from day/night (0.97-1.03) */
    densityMultiplier: number;
    /** Is launch safe based on wind conditions */
    isLaunchSafe: boolean;
    /** Current wind speed magnitude at surface (m/s) */
    surfaceWindSpeed: number;
    /** Current wind direction at surface (radians) */
    surfaceWindDirection: number;
    /** Max Q altitude wind shear warning */
    maxQWindWarning: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default wind layers based on typical launch site conditions
 * Inspired by Cape Canaveral wind profiles
 */
export const DEFAULT_WIND_LAYERS: WindLayer[] = [
    // Surface layer - light winds
    { altitudeMin: 0, altitudeMax: 1000, windSpeed: 5, windDirection: Math.PI / 4 },
    // Low altitude - moderate winds
    { altitudeMin: 1000, altitudeMax: 5000, windSpeed: 12, windDirection: Math.PI / 3 },
    // Max-Q zone (~10-15km) - strong wind shear
    { altitudeMin: 5000, altitudeMax: 15000, windSpeed: 25, windDirection: Math.PI / 2 },
    // Upper troposphere - jet stream influence
    { altitudeMin: 15000, altitudeMax: 30000, windSpeed: 40, windDirection: Math.PI * 0.6 },
    // Stratosphere - decreasing winds
    { altitudeMin: 30000, altitudeMax: 50000, windSpeed: 15, windDirection: Math.PI / 2 },
    // Upper atmosphere - negligible winds
    { altitudeMin: 50000, altitudeMax: Infinity, windSpeed: 2, windDirection: 0 }
];

/**
 * Default environment configuration
 */
export const DEFAULT_ENVIRONMENT_CONFIG: EnvironmentConfig = {
    windLayers: DEFAULT_WIND_LAYERS,
    maxGustSpeed: 8,
    gustFrequency: 0.5,
    launchWindLimit: 15,
    dayCycleMinutes: 10,
    enableDayNightCycle: true
};

// ============================================================================
// Environment System Class
// ============================================================================

/**
 * Environment simulation system
 *
 * Manages wind, gusts, and day/night cycle for realistic launch conditions.
 */
export class EnvironmentSystem {
    private config: EnvironmentConfig;
    private simulationTime: number = 0;
    private gustPhaseX: number = secureRandom() * Math.PI * 2;
    private gustPhaseY: number = secureRandom() * Math.PI * 2;
    private currentGust: Vector2D = { x: 0, y: 0 };
    private gustUpdateTimer: number = 0;

    // Pre-allocated objects to prevent garbage collection in hot paths
    private _windPolarResult = { speed: 0, direction: 0 };

    constructor(config: EnvironmentConfig = DEFAULT_ENVIRONMENT_CONFIG) {
        this.config = { ...config };
        // Ensure layers are sorted for optimization
        this.sortLayers();
    }

    private sortLayers(): void {
        this.config.windLayers = [...this.config.windLayers].sort((a, b) => a.altitudeMin - b.altitudeMin);
    }

    /**
     * Update the environment simulation
     * @param dt - Delta time in seconds
     */
    update(dt: number): void {
        this.simulationTime += dt;
        this.updateGusts(dt);
    }

    /**
     * Update gust/turbulence values using simplified Dryden model
     */
    private updateGusts(dt: number): void {
        this.gustUpdateTimer += dt;

        // Update gusts at specified frequency
        const gustPeriod = 1 / this.config.gustFrequency;
        if (this.gustUpdateTimer >= gustPeriod) {
            this.gustUpdateTimer = 0;

            // Perlin-like noise using sinusoidal combination
            const t = this.simulationTime;
            this.gustPhaseX += (secureRandom() - 0.5) * 0.5;
            this.gustPhaseY += (secureRandom() - 0.5) * 0.5;

            // Generate smooth random gusts
            const gustMagnitude = this.config.maxGustSpeed;
            const gustX = Math.sin(t * 0.7 + this.gustPhaseX) * Math.cos(t * 0.3) * gustMagnitude;
            const gustY = Math.cos(t * 0.5 + this.gustPhaseY) * Math.sin(t * 0.4) * gustMagnitude;

            // Apply damping for smooth transitions
            this.currentGust = { x: this.currentGust.x * 0.7 + gustX * 0.3, y: this.currentGust.y * 0.7 + gustY * 0.3 };
        }
    }

    /**
     * Get wind polar coordinates at a given altitude (optimized)
     * Uses binary search for O(log n) lookup instead of O(n)
     * @param altitude - Altitude in meters
     * @param out - Optional object to store results (avoids allocation)
     * @returns Object with speed (m/s) and direction (radians)
     */
    getWindPolar(altitude: number, out?: { speed: number; direction: number }): { speed: number; direction: number } {
        const safeAlt = Math.max(0, altitude);
        const layers = this.config.windLayers;
        const result = out || { speed: 0, direction: 0 };

        // Binary search for the appropriate wind layer
        // Optimization: layers are sorted by altitudeMin in constructor
        let low = 0;
        let high = layers.length - 1;
        let layerIndex = -1;

        while (low <= high) {
            const mid = (low + high) >>> 1;
            const layer = layers[mid]!;

            if (safeAlt >= layer.altitudeMin && safeAlt < layer.altitudeMax) {
                layerIndex = mid;
                break;
            } else if (safeAlt < layer.altitudeMin) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        if (layerIndex === -1) {
            result.speed = 0;
            result.direction = 0;
            return result;
        }

        const layer = layers[layerIndex]!;

        // Interpolate within the layer for smooth transitions
        const layerProgress =
            layer.altitudeMax === layer.altitudeMin
                ? 0
                : (safeAlt - layer.altitudeMin) / (layer.altitudeMax - layer.altitudeMin);

        // Find next layer for interpolation
        // Since layers are sorted, the next layer is simply at index + 1
        const nextLayer = layers[layerIndex + 1];

        let speed = layer.windSpeed;
        let direction = layer.windDirection;

        // Only interpolate if the next layer is contiguous
        if (nextLayer && nextLayer.altitudeMin === layer.altitudeMax) {
            // Smooth interpolation between layers
            speed = layer.windSpeed + (nextLayer.windSpeed - layer.windSpeed) * layerProgress;
            direction = this.interpolateAngle(layer.windDirection, nextLayer.windDirection, layerProgress);
        }

        result.speed = speed;
        result.direction = direction;
        return result;
    }

    /**
     * Get current gust vector
     */
    getCurrentGust(): Vector2D {
        return this.currentGust;
    }

    /**
     * Get wind velocity at a given altitude
     * @param altitude - Altitude in meters
     * @returns Wind velocity vector (m/s)
     */
    getWindAtAltitude(altitude: number, out?: Vector2D): Vector2D {
        this.getWindPolar(altitude, this._windPolarResult);
        const { speed, direction } = this._windPolarResult;

        // Convert to velocity vector
        // Wind direction is where wind comes FROM, so we negate for force direction
        const vx = -Math.cos(direction) * speed;
        const vy = -Math.sin(direction) * speed;

        if (out) {
            out.x = vx;
            out.y = vy;
            return out;
        }

        return { x: vx, y: vy };
    }

    /**
     * Interpolate between two angles, handling wraparound
     */
    private interpolateAngle(a: number, b: number, t: number): number {
        const diff = b - a;
        const shortDiff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
        return a + shortDiff * t;
    }

    /**
     * Get time of day (0-24 hours)
     */
    getTimeOfDay(): number {
        if (!this.config.enableDayNightCycle) {
            return 12; // Always noon
        }

        const cycleDuration = this.config.dayCycleMinutes * 60; // seconds
        const dayProgress = (this.simulationTime % cycleDuration) / cycleDuration;
        return dayProgress * 24;
    }

    /**
     * Get atmospheric density multiplier based on time of day
     *
     * Night air is denser (colder), day air is less dense (warmer).
     * Variation is approximately 1-3%.
     */
    getDensityMultiplier(): number {
        if (!this.config.enableDayNightCycle) {
            return 1.0;
        }

        const timeOfDay = this.getTimeOfDay();
        // Sinusoidal variation: minimum at 2pm (14:00), maximum at 2am
        const phase = ((timeOfDay - 14) / 24) * Math.PI * 2;
        const variation = Math.cos(phase) * 0.02; // ±2% variation
        return 1.0 + variation;
    }

    /**
     * Check if launch conditions are safe
     * @param altitude - Check altitude (usually 0 for surface)
     */
    isLaunchSafe(altitude: number = 0): boolean {
        const surfaceWind = this.getWindAtAltitude(altitude, { x: 0, y: 0 });
        const gustMag = Vec2.magnitude(this.currentGust);
        const totalWindSpeed = Vec2.magnitude(surfaceWind) + gustMag;
        return totalWindSpeed < this.config.launchWindLimit;
    }

    /**
     * Check for dangerous wind shear in Max-Q region
     */
    hasMaxQWindWarning(): boolean {
        // Check wind speed at typical Max-Q altitudes (10-14km)
        const wind10k = Vec2.magnitude(this.getWindAtAltitude(10000, { x: 0, y: 0 }));
        const wind14k = Vec2.magnitude(this.getWindAtAltitude(14000, { x: 0, y: 0 }));
        // Warning if wind exceeds 30 m/s at Max-Q altitude
        return wind10k > 30 || wind14k > 30;
    }

    /**
     * Get complete environment state at given altitude
     * @param altitude - Altitude in meters
     */
    getState(altitude: number): EnvironmentState {
        // Since we need to return this state and baseWind/surfaceWind are distinct,
        // we can allocate here as it's not a hot loop (only called on HUD updates).
        const baseWind = this.getWindAtAltitude(altitude, { x: 0, y: 0 });
        const surfaceWind = this.getWindAtAltitude(0, { x: 0, y: 0 });
        const surfaceSpeed = Vec2.magnitude(surfaceWind);

        // Gusts diminish with altitude (more stable upper atmosphere)
        const gustScale = Math.max(0, 1 - altitude / 30000);
        const scaledGust = Vec2.scale(this.currentGust, gustScale);

        return {
            windVelocity: Vec2.add(baseWind, scaledGust),
            gustVelocity: scaledGust,
            timeOfDay: this.getTimeOfDay(),
            densityMultiplier: this.getDensityMultiplier(),
            isLaunchSafe: this.isLaunchSafe(),
            surfaceWindSpeed: surfaceSpeed,
            surfaceWindDirection: Math.atan2(-surfaceWind.y, -surfaceWind.x),
            maxQWindWarning: this.hasMaxQWindWarning()
        };
    }

    /**
     * Get current simulation time
     */
    getSimulationTime(): number {
        return this.simulationTime;
    }

    /**
     * Reset the environment to initial conditions
     */
    reset(): void {
        this.simulationTime = 0;
        this.gustPhaseX = secureRandom() * Math.PI * 2;
        this.gustPhaseY = secureRandom() * Math.PI * 2;
        this.currentGust = { x: 0, y: 0 };
        this.gustUpdateTimer = 0;
    }

    /**
     * Set custom wind layers
     */
    setWindLayers(layers: WindLayer[]): void {
        this.config.windLayers = [...layers];
        this.sortLayers();
    }

    /**
     * Get current configuration
     */
    getConfig(): EnvironmentConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<EnvironmentConfig>): void {
        this.config = { ...this.config, ...config };
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format time of day as HH:MM string
 */
export function formatTimeOfDay(hours: number): string {
    const h = Math.floor(hours) % 24;
    const m = Math.floor((hours % 1) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Get wind direction as compass string
 */
export function getWindDirectionString(radians: number): string {
    // Convert to degrees (0-360, where 0 is East in our system)
    let degrees = ((radians * 180) / Math.PI + 360) % 360;

    // Convert to compass bearing (0 is North)
    degrees = (90 - degrees + 360) % 360;

    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index] ?? 'N';
}
