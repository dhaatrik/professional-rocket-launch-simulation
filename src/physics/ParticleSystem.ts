/**
 * Particle System
 *
 * Centralized system for managing particle effects like exhaust, explosions, and debris.
 * Extracts logic from entity classes to improve maintainability.
 */

import { IVessel } from '../types';
import { state, addParticle } from '../core/State';
import { Particle } from './Particle';
import { PIXELS_PER_METER, DT } from '../config/Constants';
import { MathUtils } from '../utils/MathUtils';

export class ParticleSystem {
    /**
     * Spawn exhaust particles for a vessel based on its current state
     *
     * @param vessel - The vessel to spawn exhaust for
     * @param timeScale - Time warp multiplier
     */
    static spawnExhaust(vessel: IVessel, timeScale: number): void {
        if (vessel.throttle <= 0 || vessel.fuel <= 0 || vessel.crashed) return;

        const rawCount = Math.ceil(vessel.throttle * 5 * timeScale);

        // Clamp particle count to prevent performance issues during time warp
        const MAX_PARTICLES = 20;
        let count = rawCount;
        let sizeScale = 1.0;

        if (count > MAX_PARTICLES) {
            count = MAX_PARTICLES;
            // Scale size by sqrt of count reduction to maintain visual mass (area)
            sizeScale = Math.sqrt(rawCount / count);
        }

        const altitude = (state.groundY - vessel.y - vessel.h) / PIXELS_PER_METER;
        const vacuumFactor = Math.min(Math.max(0, altitude) / 30000, 1.0);

        // Exhaust spreads more in vacuum
        const spreadBase = 0.1 + vacuumFactor * 1.5;

        // Exhaust position (engine nozzle)
        const exX = vessel.x - Math.sin(vessel.angle) * vessel.h;
        const exY = vessel.y + Math.cos(vessel.angle) * vessel.h;
        const ejectionSpeed = 30 + vessel.throttle * 20;

        for (let i = 0; i < count; i++) {
            const particleAngle = vessel.angle + Math.PI + (MathUtils.secureRandom() - 0.5) * spreadBase;
            const ejectVx = Math.sin(particleAngle) * ejectionSpeed;
            const ejectVy = -Math.cos(particleAngle) * ejectionSpeed;

            // Convert rocket velocity from m/s to pixels/frame
            const rocketVxPx = vessel.vx * PIXELS_PER_METER * DT;
            const rocketVyPx = vessel.vy * PIXELS_PER_METER * DT;

            const p = Particle.create(exX, exY, 'fire', rocketVxPx + ejectVx, rocketVyPx + ejectVy);

            // Apply visual scaling
            if (sizeScale > 1.0) {
                p.size *= sizeScale;
            }

            if (vacuumFactor > 0.8) {
                p.decay *= 0.5; // Particles last longer in vacuum
            }
            addParticle(p);

            // Add smoke at lower altitudes
            if (MathUtils.secureRandom() > 0.5 && vacuumFactor < 0.5) {
                const s = Particle.create(exX, exY, 'smoke', rocketVxPx + ejectVx, rocketVyPx + ejectVy);
                if (sizeScale > 1.0) {
                    s.size *= sizeScale;
                }
                addParticle(s);
            }
        }
    }
}
