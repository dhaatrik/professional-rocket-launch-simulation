/**
 * Vessel Base Class
 *
 * Abstract base for all rocket stages and debris.
 * Implements RK4 integration for accurate orbital mechanics.
 *
 * Physics model includes:
 * - Thrust with pressure-dependent Isp
 * - Atmospheric drag with transonic effects
 * - Inverse-square gravity
 * - Centrifugal acceleration for orbital motion
 */

import { IVessel, PhysicsState, Derivatives, OrbitalElements } from '../types';
import { EntityType } from '../core/PhysicsBuffer';
import {
    CONFIG,
    PIXELS_PER_METER,
    getAtmosphericDensity,
    SPEED_OF_SOUND,
    RHO_SL,
    R_EARTH,
    getGravity,
    getDynamicPressure,
    getMachNumber,
    DT
} from '../config/Constants';
import { state, currentWindVelocity, currentDensityMultiplier } from '../core/State';
import { addParticle } from '../core/State';
import { Particle } from './Particle';
import {
    AerodynamicsConfig,
    AerodynamicState,
    AerodynamicForces,
    DEFAULT_AERO_CONFIG,
    calculateAerodynamicState,
    calculateAerodynamicForces,
    calculateAerodynamicDamageRate
} from './Aerodynamics';
import {
    TPSConfig,
    ThermalState,
    DEFAULT_TPS_CONFIG,
    updateThermalState,
    getThermalDamageRate,
    createInitialThermalState
} from './ThermalProtection';
import {
    PropulsionConfig,
    PropulsionState,
    EngineState,
    FULLSTACK_PROP_CONFIG,
    createInitialPropulsionState,
    updatePropulsionState,
    attemptIgnition,
    commandShutdown,
    getIgnitionFailureMessage
} from './Propulsion';
import { ReliabilitySystem, ReliabilityConfig, DEFAULT_RELIABILITY_CONFIG } from './Reliability';
import { ParticleSystem } from './ParticleSystem';

export class Vessel implements IVessel {
    // Position (pixels)
    public x: number;
    public y: number;

    // Velocity (m/s)
    public vx: number = 0;
    public vy: number = 0;

    // Orientation (radians)
    public angle: number = 0;
    public gimbalAngle: number = 0;

    // Interpolation state
    public prevX: number = 0;
    public prevY: number = 0;
    public prevAngle: number = 0;

    // Physical properties
    public readonly type: number = EntityType.UNKNOWN;
    public mass: number = 1000;
    public w: number = 40; // Width (pixels)
    public h: number = 100; // Height (pixels)

    // Engine state
    public throttle: number = 0;
    public fuel: number = 1.0; // 0-1 normalized
    public active: boolean = true;
    public maxThrust: number = 100000;

    // Aerodynamics (legacy)
    public cd: number = CONFIG.DRAG_COEFF;
    public q: number = 0; // Dynamic pressure

    // Advanced Aerodynamics
    public aeroConfig: AerodynamicsConfig = DEFAULT_AERO_CONFIG;
    public aeroState: AerodynamicState | null = null;
    public aoa: number = 0; // Angle of Attack (radians)
    public stabilityMargin: number = 0; // (CP - CoM) / length
    public isAeroStable: boolean = true; // CP behind CoM
    public liftForce: number = 0; // Current lift force (N)
    public dragForce: number = 0; // Current drag force (N)

    // Propulsion
    public ispVac: number = 300;
    public ispSL: number = 280;

    // State
    public crashed: boolean = false;
    public health: number = 100;
    public apogee: number = 0;

    // Thermal Protection System
    public tpsConfig: TPSConfig = DEFAULT_TPS_CONFIG;
    public thermalState: ThermalState = createInitialThermalState();
    public skinTemp: number = 293; // Skin temperature (K)
    public heatShieldRemaining: number = 1.0; // Heat shield fraction (0-1)
    public isAblating: boolean = false; // Currently ablating
    public isThermalCritical: boolean = false; // Temperature critical
    private lastThermalLogTime: number = -10; // Last time thermal warning was logged (allow immediate logging)

    // Propulsion State Machine
    public propConfig: PropulsionConfig = FULLSTACK_PROP_CONFIG;
    public propState: PropulsionState = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
    public engineState: EngineState = 'off'; // Current engine state
    public ignitersRemaining: number = 3; // Remaining igniter cartridges
    public ullageSettled: boolean = true; // Fuel settled for ignition
    public actualThrottle: number = 0; // Lagged throttle output

    // Reliability System
    public reliability: ReliabilitySystem = new ReliabilitySystem();
    public reliabilityConfig: ReliabilityConfig = DEFAULT_RELIABILITY_CONFIG;

    // Orbit prediction cache
    public orbitPath: OrbitalElements[] | null = null;
    public lastOrbitUpdate: number = 0;

    // Logging state
    public lastThermalLogTime: number = -100; // Allow immediate logging
    public instabilityWarningLogged: boolean = false;

    // Reusable objects for RK4 to avoid garbage collection
    private _rk4State: PhysicsState = { x: 0, y: 0, vx: 0, vy: 0, mass: 0 };
    private _tempState: PhysicsState = { x: 0, y: 0, vx: 0, vy: 0, mass: 0 };
    private _k1: Derivatives = { dx: 0, dy: 0, dvx: 0, dvy: 0, dmass: 0 };
    private _k2: Derivatives = { dx: 0, dy: 0, dvx: 0, dvy: 0, dmass: 0 };
    private _k3: Derivatives = { dx: 0, dy: 0, dvx: 0, dvy: 0, dmass: 0 };
    private _k4: Derivatives = { dx: 0, dy: 0, dvx: 0, dvy: 0, dmass: 0 };

    /**
     * Create a new vessel
     *
     * @param x - Initial X position (pixels)
     * @param y - Initial Y position (pixels)
     */
    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.prevAngle = 0;
    }

    /**
     * Calculate physics derivatives for RK4 integration
     *
     * @param s - Current state
     * @param t - Current time (unused, for interface)
     * @param dt - Time step
     * @param out - Optional output object to avoid allocation
     * @returns Derivatives for integration
     */
    protected getDerivatives(s: PhysicsState, t: number, dt: number, out?: Derivatives): Derivatives {
        const altitude = (state.groundY - s.y * PIXELS_PER_METER - this.h) / PIXELS_PER_METER;
        const safeAlt = Math.max(0, altitude);

        // Atmospheric density
        const rho = getAtmosphericDensity(safeAlt);

        // Velocity magnitude (relative to wind for aerodynamic calculations)
        const relVx = s.vx - currentWindVelocity.x;
        const relVy = s.vy - currentWindVelocity.y;
        const vSq = relVx * relVx + relVy * relVy;
        const v = Math.sqrt(vSq);
        const q = getDynamicPressure(rho * currentDensityMultiplier, v);
        const mach = getMachNumber(v);

        // Calculate aerodynamic state using relative velocity (AoA, CP, CoM, stability)
        const vehicleLengthM = this.h / PIXELS_PER_METER;
        const fuelFraction = this.fuel; // 0-1 normalized fuel level

        const aeroState = calculateAerodynamicState(
            this.aeroConfig,
            relVx,
            relVy,
            this.angle,
            fuelFraction,
            vehicleLengthM,
            mach
        );

        // Calculate aerodynamic forces using relative velocity (lift and drag)
        const aeroForces = calculateAerodynamicForces(this.aeroConfig, aeroState, safeAlt, v, relVx, relVy, mach);

        // Gravity (inverse square law)
        const realRad = safeAlt + R_EARTH;
        const g = getGravity(safeAlt);

        // Initialize forces
        let fx = 0;
        let fy = s.mass * g; // Weight (positive = downward in our coordinate system)

        // Centrifugal acceleration (for orbital motion)
        const f_cent = (s.mass * s.vx * s.vx) / realRad;
        fy -= f_cent;

        // Add aerodynamic forces (lift and drag combined)
        fx += aeroForces.forceX;
        fy += aeroForces.forceY;

        // Thrust (uses propulsion state machine for realistic spool-up)
        let flowRate = 0;
        if (this.active && this.actualThrottle > 0 && this.fuel > 0) {
            // Pressure-dependent Isp
            const pRatio = rho / RHO_SL;
            const isp = this.ispVac + (this.ispSL - this.ispVac) * pRatio;
            const thrust = this.actualThrottle * this.maxThrust * (isp / this.ispVac);

            // Thrust direction based on vessel angle
            fx += Math.sin(this.angle) * thrust;
            fy -= Math.cos(this.angle) * thrust;

            // Fuel consumption rate (kg/s)
            flowRate = (this.actualThrottle * this.maxThrust) / (9.8 * this.ispVac);
        }

        // Store aerodynamic state for telemetry (will be updated after integration)
        this.aoa = aeroState.aoa;
        this.stabilityMargin = aeroState.stabilityMargin;
        this.isAeroStable = aeroState.isStable;
        this.liftForce = aeroForces.lift;
        this.dragForce = aeroForces.drag;
        this.aeroState = aeroState;

        const result = out || { dx: 0, dy: 0, dvx: 0, dvy: 0, dmass: 0 };
        result.dx = s.vx;
        result.dy = s.vy;
        result.dvx = fx / s.mass;
        result.dvy = fy / s.mass;
        result.dmass = -flowRate;

        return result;
    }

    /**
     * Apply physics update using RK4 integration
     *
     * @param dt - Time step (seconds)
     * @param keys - Input keys (legacy compatibility)
     */
    applyPhysics(dt: number, keys: Record<string, boolean>): void {
        if (this.crashed) return;

        // Apply control input
        const isBooster = this.constructor.name === 'Booster';
        this.control(dt, keys, isBooster);

        // Store previous state for interpolation BEFORE integration
        this.prevX = this.x;
        this.prevY = this.y;
        this.prevAngle = this.angle;

        // Run physics integration
        this.updatePhysics(dt);
    }

    /**
     * Control input handling (can be overridden by subclasses)
     */
    protected control(dt: number, keys: Record<string, boolean>, isBooster: boolean): void {
        if (state.autopilotEnabled && isBooster) {
            this.runAutopilot(dt);
        } else {
            let targetGimbal = 0;
            if (keys['ArrowLeft']) targetGimbal = 0.2;
            else if (keys['ArrowRight']) targetGimbal = -0.2;

            this.gimbalAngle += (targetGimbal - this.gimbalAngle) * 10 * dt;

            if (Math.abs(this.gimbalAngle) > 0.001) {
                this.angle -= this.gimbalAngle * 2.0 * dt;
            }
        }
    }

    /**
     * Autopilot (can be overridden by subclasses like Booster)
     */
    protected runAutopilot(dt: number): void {
        // Default: no autopilot
    }

    /**
     * RK4 evaluation helper using reusable objects
     */
    private _evaluateRK4(
        baseState: PhysicsState,
        dt: number,
        dtStep: number,
        d: Derivatives | null,
        out: Derivatives
    ): void {
        this._tempState.x = baseState.x + (d ? d.dx * dtStep : 0);
        this._tempState.y = baseState.y + (d ? d.dy * dtStep : 0);
        this._tempState.vx = baseState.vx + (d ? d.dvx * dtStep : 0);
        this._tempState.vy = baseState.vy + (d ? d.dvy * dtStep : 0);
        this._tempState.mass = baseState.mass;

        this.getDerivatives(this._tempState, 0, dt, out);
    }

    /**
     * RK4 integration step
     */
    protected updatePhysics(dt: number): void {
        if (this.crashed) return;

        // Populate reusable state object (convert to meters)
        this._rk4State.x = this.x / PIXELS_PER_METER;
        this._rk4State.y = this.y / PIXELS_PER_METER;
        this._rk4State.vx = this.vx;
        this._rk4State.vy = this.vy;
        this._rk4State.mass = this.mass;

        // RK4 integration using private helper method
        this._evaluateRK4(this._rk4State, dt, 0, null, this._k1);
        this._evaluateRK4(this._rk4State, dt, dt * 0.5, this._k1, this._k2);
        this._evaluateRK4(this._rk4State, dt, dt * 0.5, this._k2, this._k3);
        this._evaluateRK4(this._rk4State, dt, dt, this._k3, this._k4);

        // Weighted average
        const dxdt = (this._k1.dx + 2 * this._k2.dx + 2 * this._k3.dx + this._k4.dx) / 6;
        const dydt = (this._k1.dy + 2 * this._k2.dy + 2 * this._k3.dy + this._k4.dy) / 6;
        const dvxdt = (this._k1.dvx + 2 * this._k2.dvx + 2 * this._k3.dvx + this._k4.dvx) / 6;
        const dvydt = (this._k1.dvy + 2 * this._k2.dvy + 2 * this._k3.dvy + this._k4.dvy) / 6;

        // Apply integration result
        this.vx += dvxdt * dt;
        this.vy += dvydt * dt;
        this.x += dxdt * dt * PIXELS_PER_METER;
        this.y += dydt * dt * PIXELS_PER_METER;

        // Fuel consumption (uses actual throttle, not commanded)
        if (this.actualThrottle > 0 && this.fuel > 0) {
            const flowRate = (this.actualThrottle * this.maxThrust) / (9.8 * this.ispVac);
            this.fuel -= (flowRate / CONFIG.FUEL_MASS) * dt;
            this.mass -= flowRate * dt;
        }

        // Update dynamic pressure
        const altitude = (state.groundY - this.y - this.h) / PIXELS_PER_METER;
        const rho = getAtmosphericDensity(altitude);
        const v = Math.sqrt(this.vx ** 2 + this.vy ** 2);
        this.q = getDynamicPressure(rho, v);

        // Update propulsion state (spool-up/down, ullage, igniters)
        this.updatePropulsionState(v, altitude, dt);

        // Update thermal state
        this.updateThermalState(v, Math.max(0, altitude), dt);

        // Update reliability state
        this.updateReliability(dt);

        // Aerodynamic stress damage
        this.checkAerodynamicStress(v, altitude);

        // Ground collision
        this.checkGroundCollision();
    }

    /**
     * Update thermal protection system state
     */
    private updateThermalState(velocity: number, altitude: number, dt: number): void {
        // Update thermal state using TPS module
        this.thermalState = updateThermalState(this.tpsConfig, this.thermalState, velocity, altitude, this.aoa, dt);

        // Update public properties for HUD display
        this.skinTemp = this.thermalState.skinTemp;
        this.heatShieldRemaining = this.thermalState.heatShieldRemaining;
        this.isAblating = this.thermalState.isAblating;
        this.isThermalCritical = this.thermalState.isCritical;

        // Apply thermal damage to health
        const thermalDamageRate = getThermalDamageRate(this.thermalState, this.tpsConfig);
        if (thermalDamageRate > 0) {
            this.health -= thermalDamageRate * dt;

            // Spawn debris when taking thermal damage
            if (Math.random() > 0.9) {
                addParticle(Particle.create(this.x, this.y + this.h / 2, 'debris'));
            }

            // Log thermal warning
            if (this.isThermalCritical && state.missionLog) {
                if (state.missionTime - this.lastThermalLogTime > 2.0) {
                    state.missionLog.log(`THERMAL WARNING: Skin temp ${Math.round(this.skinTemp - 273)}°C`, 'warn');
                    this.lastThermalLogTime = state.missionTime;
                }
            }
        }

        // Structural failure from thermal overload
        if (this.health <= 0 && this.thermalState.thermalDamage > 50) {
            if (state.missionLog) {
                state.missionLog.log('STRUCTURAL FAILURE: THERMAL OVERLOAD', 'warn');
            }
            this.explode();
        }
    }

    /**
     * Update propulsion state machine
     * Handles engine spool-up/down, ullage, and igniter management
     */
    private updatePropulsionState(velocity: number, altitude: number, dt: number): void {
        // Calculate current acceleration for ullage check
        const g = getGravity(Math.max(0, altitude));
        const currentAccel = this.actualThrottle > 0 ? (this.actualThrottle * this.maxThrust) / this.mass - g : g; // On ground, gravity settles fuel

        // Update propulsion state
        this.propState = updatePropulsionState(
            this.propState,
            this.propConfig,
            this.throttle, // commanded throttle
            this.fuel > 0,
            Math.abs(currentAccel),
            dt
        );

        // Copy state to public properties for HUD display
        this.engineState = this.propState.engineState;
        this.ignitersRemaining = this.propState.ignitersRemaining;
        this.ullageSettled = this.propState.ullageSettled;
        this.actualThrottle = this.propState.actualThrottle;

        // Log ignition failures
        const failureMsg = getIgnitionFailureMessage(this.propState);
        if (failureMsg && state.missionLog) {
            state.missionLog.log(failureMsg, 'warn');
            // Reset the failure message after logging
            this.propState.lastIgnitionResult = 'none';
        }
    }

    /**
     * Check for aerodynamic overstress using advanced stability analysis
     */
    private checkAerodynamicStress(velocity: number, altitude: number): void {
        // Use the aerodynamic state if available for advanced damage calculation
        if (this.aeroState) {
            // Reset warning flag when stable
            if (this.isAeroStable) {
                this.instabilityWarningLogged = false;
            }

            const damageRate = calculateAerodynamicDamageRate(this.aeroState, this.q);

            if (damageRate > 0) {
                // Apply damage based on rate (per second, scaled to frame time)
                this.health -= damageRate * (1 / 60); // Assuming 60 FPS

                // Spawn debris particles when taking damage
                if (Math.random() > 0.8) {
                    addParticle(Particle.create(this.x, this.y + this.h / 2, 'debris'));
                }

                // Log instability warning once when stability margin goes negative
                if (!this.isAeroStable && this.q > 5000 && state.missionLog && !this.instabilityWarningLogged) {
                    state.missionLog.log(
                        `STABILITY WARNING: AoA=${((Math.abs(this.aoa) * 180) / Math.PI).toFixed(1)}° Margin=${(this.stabilityMargin * 100).toFixed(1)}%`,
                        'warn'
                    );
                    this.instabilityWarningLogged = true;
                }
            }
        } else {
            // Fallback to legacy damage calculation
            let alpha = 0;
            if (velocity > 10) {
                const velAngle = Math.atan2(this.vx, -this.vy);
                alpha = Math.abs(this.angle - velAngle);
                if (alpha > Math.PI) alpha = Math.PI * 2 - alpha;
            }

            if (this.q > 5000 && alpha > 0.2) {
                this.health -= 100 * (1 / 60);
                if (Math.random() > 0.8) {
                    addParticle(Particle.create(this.x, this.y + this.h / 2, 'debris'));
                }
            }
        }

        if (this.health <= 0) {
            if (state.missionLog) {
                state.missionLog.log('STRUCTURAL FAILURE DUE TO AERO FORCES', 'warn');
            }
            this.explode();
        }
    }

    /**
     * Check for ground collision
     */
    private checkGroundCollision(): void {
        if (this.y + this.h > state.groundY) {
            this.y = state.groundY - this.h;

            // Check landing velocity and angle
            if (this.vy > 15 || Math.abs(this.angle) > 0.3) {
                this.explode();
            } else {
                // Successful landing
                this.vy = 0;
                this.vx = 0;

                // Only cut throttle if not trying to launch
                if (this.engineState !== 'starting' && this.engineState !== 'running') {
                    this.throttle = 0;
                }
            }
        }
    }

    /**
     * Explode the vessel
     */
    explode(): void {
        if (this.crashed) return;

        this.crashed = true;
        this.active = false;
        this.throttle = 0;

        if (state.audio) {
            state.audio.playExplosion();
        }

        // Spawn explosion particles
        for (let i = 0; i < 30; i++) {
            addParticle(
                Particle.create(this.x + Math.random() * 20 - 10, this.y + this.h - Math.random() * 20, 'fire')
            );
            addParticle(Particle.create(this.x, this.y + this.h / 2, 'debris'));
        }
    }

    /**
     * Update reliability system
     */
    private updateReliability(dt: number): void {
        if (!this.active || this.crashed) return;

        // Calculate stress factor
        // Base stress is 1.0 when active
        // High Q or high G adds stress
        let stress = 0;

        if (this.actualThrottle > 0) {
            stress = 1.0;

            // Add stress from dynamic pressure
            if (this.q > 10000) stress += 0.5;

            // Add stress from high angle of attack
            if (Math.abs(this.aoa) > 0.1) stress += 0.5;
        }

        const failures = this.reliability.update(dt, stress);

        // Handle new failures
        for (const failure of failures) {
            switch (failure) {
                case 'ENGINE_FLAME_OUT':
                    this.active = false;
                    this.throttle = 0;
                    this.actualThrottle = 0; // Immediate cut
                    break;

                case 'ENGINE_EXPLOSION':
                    this.explode();
                    break;

                case 'STRUCTURAL_FATIGUE':
                    // Immediate structural failure
                    this.health = 0;
                    this.explode();
                    break;

                case 'GIMBAL_LOCK':
                    // Gimbal stuck - disable control
                    // This is handled in control() by checking failures
                    break;
            }
        }
    }

    /**
     * Spawn exhaust particles
     *
     * @param timeScale - Time warp multiplier
     */
    spawnExhaust(timeScale: number): void {
        ParticleSystem.spawnExhaust(this, timeScale);
    }

    /**
     * Draw plasma heating effects based on skin temperature
     */
    protected drawPlasma(ctx: CanvasRenderingContext2D): void {
        // Start showing plasma effects above 500K (227°C)
        const plasmaThreshold = 500;

        if (this.skinTemp > plasmaThreshold) {
            // Intensity based on temperature (500K to 2000K range)
            const tempRange = this.skinTemp - plasmaThreshold;
            const intensity = Math.min(tempRange / 1500, 0.9);

            ctx.save();
            ctx.globalCompositeOperation = 'screen';

            // Color shifts from orange to white with temperature
            const r = 255;
            const g = Math.floor(100 + intensity * 155); // 100 -> 255
            const b = Math.floor(50 + intensity * 200); // 50 -> 250

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${intensity})`;
            ctx.beginPath();
            ctx.arc(0, this.h, 20 + Math.random() * 10 * intensity, 0, Math.PI * 2);
            ctx.fill();

            // Nose cone glow
            if (intensity > 0.3) {
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${intensity * 0.6})`;
                ctx.beginPath();
                ctx.arc(0, -10, 15 + Math.random() * 5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Body streamers at high temps
            if (intensity > 0.2) {
                ctx.fillStyle = `rgba(255, 200, 100, ${intensity * 0.4})`;
                ctx.fillRect(-this.w / 2 - 5, 20, this.w + 10, this.h - 20);
            }

            // Ablation particles when shield is active
            if (this.isAblating && Math.random() > 0.7) {
                ctx.fillStyle = `rgba(255, 255, 200, 0.8)`;
                const sparkX = (Math.random() - 0.5) * this.w;
                const sparkY = Math.random() * this.h;
                ctx.beginPath();
                ctx.arc(sparkX, sparkY, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    /**
     * Draw shockwave effects
     */
    protected drawShockwave(ctx: CanvasRenderingContext2D): void {
        if (this.q > 5000 && this.vy < -50) {
            const intensity = Math.min((this.q - 5000) / 10000, 0.5);
            ctx.save();
            ctx.strokeStyle = `rgba(255, 255, 255, ${intensity})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-50, 40);
            ctx.quadraticCurveTo(0, -80, 50, 40);
            ctx.stroke();
            ctx.restore();
        }
    }

    /**
     * Draw the vessel (to be overridden by subclasses)
     */
    draw(ctx: CanvasRenderingContext2D, camY: number, alpha: number): void {
        if (this.crashed) return;

        // Interpolate position and angle
        const rX = this.prevX + (this.x - this.prevX) * alpha;
        const rY = this.prevY + (this.y - this.prevY) * alpha;
        const rAngle = this.prevAngle + (this.angle - this.prevAngle) * alpha;

        ctx.save();
        ctx.translate(rX, rY - camY);
        ctx.rotate(rAngle);

        this.drawParts(ctx);

        ctx.restore();
    }

    /**
     * Draw specific vessel parts (to be overridden by subclasses)
     */
    protected drawParts(ctx: CanvasRenderingContext2D): void {
        // Base implementation does nothing
        // Subclasses implement specific rendering
    }
}
