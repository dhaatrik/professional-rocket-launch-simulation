/**
 * Rocket Components
 *
 * Concrete vessel implementations for different rocket stages.
 * Each extends the base Vessel class with specific properties and rendering.
 */

import { Vessel } from './Vessel';
import { EntityType } from '../core/PhysicsBuffer';
import { CONFIG, PIXELS_PER_METER, ISP_TO_VELOCITY } from '../config/Constants';
import { state } from '../core/State';
import { PIDController } from '../utils/PIDController';
import { StageSeparation } from '../types';
import { DEFAULT_AERO_CONFIG, BOOSTER_AERO_CONFIG, UPPER_STAGE_AERO_CONFIG, PAYLOAD_AERO_CONFIG } from './Aerodynamics';
import {
    DEFAULT_TPS_CONFIG,
    BOOSTER_TPS_CONFIG,
    UPPER_STAGE_TPS_CONFIG,
    PAYLOAD_TPS_CONFIG
} from './ThermalProtection';
import {
    FULLSTACK_PROP_CONFIG,
    BOOSTER_PROP_CONFIG,
    UPPER_STAGE_PROP_CONFIG,
    PAYLOAD_PROP_CONFIG,
    createInitialPropulsionState
} from './Propulsion';

/**
 * Full Stack - Complete rocket before staging
 * First stage booster + second stage + payload fairing
 */
export class FullStack extends Vessel {
    public override readonly type = EntityType.FULLSTACK;

    constructor(x: number, y: number) {
        super(x, y);
        this.h = 160;
        this.mass = CONFIG.MASS_BOOSTER + CONFIG.MASS_UPPER + CONFIG.FUEL_MASS;
        this.maxThrust = CONFIG.MAX_THRUST_BOOSTER;
        this.ispVac = CONFIG.ISP_VAC_BOOSTER;
        this.ispSL = CONFIG.ISP_SL_BOOSTER;

        // Reliability: Brand new engines, generally reliable but infant mortality risk
        this.reliabilityConfig = {
            mtbfEngine: 1200, // Good reliability
            mtbfStructure: 10000, // Sturdy
            mtbfElectronics: 3000,
            ignitionReliability: 0.98,
            wearFactor: 1.0
        };

        // Full stack has good stability with fins at the base
        this.aeroConfig = DEFAULT_AERO_CONFIG;
        // Standard aluminum skin, moderate thermal tolerance
        this.tpsConfig = DEFAULT_TPS_CONFIG;
        // Merlin-like first stage propulsion
        this.propConfig = FULLSTACK_PROP_CONFIG;
        this.propState = createInitialPropulsionState(FULLSTACK_PROP_CONFIG);
        this.ignitersRemaining = FULLSTACK_PROP_CONFIG.igniterCount;
    }

    draw(ctx: CanvasRenderingContext2D, camY: number, alpha: number): void {
        if (this.crashed) return;

        // Interpolate position and angle
        const rX = this.prevX + (this.x - this.prevX) * alpha;
        const rY = this.prevY + (this.y - this.prevY) * alpha;
        const rAngle = this.prevAngle + (this.angle - this.prevAngle) * alpha;

        ctx.save();
        ctx.translate(rX, rY - camY);
        ctx.rotate(rAngle);

        this.drawPlasma(ctx);
        this.drawShockwave(ctx);

        // === NOSE CONE (Ogive shape with highlight) ===
        const noseGrad = ctx.createLinearGradient(-18, 0, 18, 0);
        noseGrad.addColorStop(0, '#c0c5c9');
        noseGrad.addColorStop(0.35, '#f5f6f7');
        noseGrad.addColorStop(0.5, '#ffffff');
        noseGrad.addColorStop(0.65, '#f0f1f2');
        noseGrad.addColorStop(1, '#a0a5a9');
        ctx.fillStyle = noseGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-3, 8, -14, 30, -18, 55);
        ctx.lineTo(18, 55);
        ctx.bezierCurveTo(14, 30, 3, 8, 0, 0);
        ctx.fill();

        // Nose tip accent
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        // === PAYLOAD SECTION (with fairing seam) ===
        const fairingGrad = ctx.createLinearGradient(-18, 0, 18, 0);
        fairingGrad.addColorStop(0, '#d5d8dc');
        fairingGrad.addColorStop(0.3, '#ecf0f1');
        fairingGrad.addColorStop(0.5, '#ffffff');
        fairingGrad.addColorStop(0.7, '#ecf0f1');
        fairingGrad.addColorStop(1, '#bdc3c7');
        ctx.fillStyle = fairingGrad;
        ctx.fillRect(-18, 55, 36, 15);

        // Fairing vertical seam line
        ctx.strokeStyle = 'rgba(127, 140, 141, 0.4)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.lineTo(0, 70);
        ctx.stroke();

        // === INTERSTAGE RING ===
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(-19, 70, 38, 3);

        // === UPPER STAGE TANK ===
        const upperGrad = ctx.createLinearGradient(-18, 0, 18, 0);
        upperGrad.addColorStop(0, '#bfc9ca');
        upperGrad.addColorStop(0.35, '#ebedef');
        upperGrad.addColorStop(0.5, '#f8f9f9');
        upperGrad.addColorStop(0.65, '#ebedef');
        upperGrad.addColorStop(1, '#aab7b8');
        ctx.fillStyle = upperGrad;
        ctx.fillRect(-18, 73, 36, 22);

        // === STAGE SEPARATION RING ===
        const sepGrad = ctx.createLinearGradient(-20, 0, 20, 0);
        sepGrad.addColorStop(0, '#1a252f');
        sepGrad.addColorStop(0.5, '#4a6274');
        sepGrad.addColorStop(1, '#1a252f');
        ctx.fillStyle = sepGrad;
        ctx.fillRect(-20, 95, 40, 4);

        // === BOOSTER TANK (first stage) ===
        const boosterGrad = ctx.createLinearGradient(-18, 0, 18, 0);
        boosterGrad.addColorStop(0, '#b0b8ba');
        boosterGrad.addColorStop(0.3, '#dde1e3');
        boosterGrad.addColorStop(0.5, '#f2f3f4');
        boosterGrad.addColorStop(0.7, '#dde1e3');
        boosterGrad.addColorStop(1, '#99a3a4');
        ctx.fillStyle = boosterGrad;
        ctx.fillRect(-18, 99, 36, 50);

        // LOX/RP-1 demarcation line
        ctx.strokeStyle = 'rgba(52, 73, 94, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-18, 125);
        ctx.lineTo(18, 125);
        ctx.stroke();

        // === GRID FINS ===
        ctx.save();
        ctx.fillStyle = '#34495e';
        // Left fin
        ctx.fillRect(-24, 100, 6, 2);
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1;
        ctx.strokeRect(-24, 100, 6, 12);
        // Fin grid pattern
        ctx.beginPath();
        ctx.moveTo(-21, 100);
        ctx.lineTo(-21, 112);
        ctx.moveTo(-24, 104);
        ctx.lineTo(-18, 104);
        ctx.moveTo(-24, 108);
        ctx.lineTo(-18, 108);
        ctx.stroke();
        // Right fin
        ctx.fillRect(18, 100, 6, 2);
        ctx.strokeRect(18, 100, 6, 12);
        ctx.beginPath();
        ctx.moveTo(21, 100);
        ctx.lineTo(21, 112);
        ctx.moveTo(18, 104);
        ctx.lineTo(24, 104);
        ctx.moveTo(18, 108);
        ctx.lineTo(24, 108);
        ctx.stroke();
        ctx.restore();

        // === BOOSTER SKIRT ===
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(-18, 149);
        ctx.lineTo(-20, 155);
        ctx.lineTo(20, 155);
        ctx.lineTo(18, 149);
        ctx.fill();

        // === ENGINE CLUSTER (Gimbaled) ===
        ctx.save();
        ctx.translate(0, 155);
        ctx.rotate(this.gimbalAngle);

        // Engine mounting plate
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(-14, 0, 28, 3);

        // Engine nozzle with metallic gradient
        const engGrad = ctx.createLinearGradient(-12, 0, 12, 0);
        engGrad.addColorStop(0, '#1a252f');
        engGrad.addColorStop(0.3, '#566573');
        engGrad.addColorStop(0.5, '#85929e');
        engGrad.addColorStop(0.7, '#566573');
        engGrad.addColorStop(1, '#1a252f');
        ctx.fillStyle = engGrad;
        ctx.beginPath();
        ctx.moveTo(-8, 3);
        ctx.bezierCurveTo(-10, 8, -14, 18, -16, 25);
        ctx.lineTo(16, 25);
        ctx.bezierCurveTo(14, 18, 10, 8, 8, 3);
        ctx.fill();

        // Nozzle interior glow hint
        ctx.fillStyle = 'rgba(52, 73, 94, 0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 25, 10, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        ctx.restore();
    }
}

/**
 * Booster - First stage after separation
 * Capable of propulsive landing with autopilot
 */
export class Booster extends Vessel {
    public override readonly type = EntityType.BOOSTER;

    /** Stage separation config */
    public nextStage: StageSeparation;

    /** PID controller for tilt stabilization */
    private pidTilt: PIDController;

    /** PID controller for throttle during landing */
    private pidThrottle: PIDController;

    constructor(x: number, y: number, vx: number = 0, vy: number = 0) {
        super(x, y);
        this.vx = vx;
        this.vy = vy;
        this.h = 100;
        this.mass = CONFIG.MASS_BOOSTER;
        this.maxThrust = CONFIG.MAX_THRUST_BOOSTER;
        this.fuel = 0.3; // Remaining fuel after staging
        this.ispVac = CONFIG.ISP_VAC_BOOSTER;
        this.ispSL = CONFIG.ISP_SL_BOOSTER;
        this.active = true;

        // Reliability: Reuse adds wear
        this.reliabilityConfig = {
            mtbfEngine: 800, // Slightly degraded from reuse/stress
            mtbfStructure: 8000,
            mtbfElectronics: 2000,
            ignitionReliability: 0.95, // Relight is harder
            wearFactor: 1.5 // Wears out faster
        };

        // PID controllers for landing
        // Negative Kp because positive angle needs negative correction
        this.pidTilt = new PIDController(-5.0, 0.0, -50.0);
        this.pidThrottle = new PIDController(0.1, 0.001, 0.5);

        // Booster has grid fins for stability during descent
        this.aeroConfig = BOOSTER_AERO_CONFIG;
        // Grid fins and re-entry capable with some TPS coating
        this.tpsConfig = BOOSTER_TPS_CONFIG;
        // Landing-capable with multiple restarts
        this.propConfig = BOOSTER_PROP_CONFIG;
        this.propState = createInitialPropulsionState(BOOSTER_PROP_CONFIG);
        this.ignitersRemaining = BOOSTER_PROP_CONFIG.igniterCount;

        this.nextStage = {
            type: 'UpperStage',
            separationVelocity: 3,
            offsetY: -20
        };
    }

    applyPhysics(dt: number, keys: Record<string, boolean>): void {
        if (state.autopilotEnabled && this.active && !this.crashed) {
            this.runAutopilot(dt);
        }
        super.applyPhysics(dt, keys);
    }

    protected override runAutopilot(dt: number): void {
        const alt = (state.groundY - this.y - this.h) / PIXELS_PER_METER;

        // 1. Angle control - keep vertical
        const tiltOutput = this.pidTilt.update(this.angle, dt);
        this.gimbalAngle = Math.max(-0.4, Math.min(0.4, tiltOutput));

        // 2. Suicide burn calculation
        const g = 9.8;
        const maxAccel = this.maxThrust / this.mass - g;
        // v² = 2ad → d = v² / 2a
        const stopDist = (this.vy * this.vy) / (2 * maxAccel);

        // Start burn when altitude approaches stopping distance
        if (this.vy > 0 && alt < stopDist + 100) {
            this.throttle = 1.0;

            // Terminal precision control
            if (alt < 50) {
                const targetVel = alt * 0.2;
                const err = this.vy - targetVel;
                this.throttle = Math.min(1, Math.max(0, 0.5 + err * 0.2));
            }
        } else {
            this.throttle = 0;
        }

        // Cut engines at touchdown
        if (alt < 1) {
            this.throttle = 0;
        }
    }

    draw(ctx: CanvasRenderingContext2D, camY: number, alpha: number): void {
        if (this.crashed) return;

        const rX = this.prevX + (this.x - this.prevX) * alpha;
        const rY = this.prevY + (this.y - this.prevY) * alpha;
        const rAngle = this.prevAngle + (this.angle - this.prevAngle) * alpha;

        ctx.save();
        ctx.translate(rX, rY - camY);
        ctx.rotate(rAngle);

        this.drawPlasma(ctx);

        // === BOOSTER BODY with 3D gradient ===
        const bodyGrad = ctx.createLinearGradient(-18, 0, 18, 0);
        bodyGrad.addColorStop(0, '#b0b8ba');
        bodyGrad.addColorStop(0.3, '#dde1e3');
        bodyGrad.addColorStop(0.5, '#f2f3f4');
        bodyGrad.addColorStop(0.7, '#dde1e3');
        bodyGrad.addColorStop(1, '#99a3a4');
        ctx.fillStyle = bodyGrad;
        ctx.fillRect(-18, 0, 36, 85);

        // Soot marks (re-entry charring)
        const sootGrad = ctx.createLinearGradient(0, 0, 0, 85);
        sootGrad.addColorStop(0, 'rgba(30, 30, 30, 0.3)');
        sootGrad.addColorStop(0.4, 'rgba(30, 30, 30, 0.05)');
        sootGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = sootGrad;
        ctx.fillRect(-18, 0, 36, 85);

        // LOX/RP-1 demarcation
        ctx.strokeStyle = 'rgba(52, 73, 94, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-18, 40);
        ctx.lineTo(18, 40);
        ctx.stroke();

        // === GRID FINS ===
        ctx.save();
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1;
        ctx.strokeRect(-24, 8, 6, 12);
        ctx.strokeRect(18, 8, 6, 12);
        ctx.beginPath();
        ctx.moveTo(-21, 8);
        ctx.lineTo(-21, 20);
        ctx.moveTo(-24, 12);
        ctx.lineTo(-18, 12);
        ctx.moveTo(-24, 16);
        ctx.lineTo(-18, 16);
        ctx.moveTo(21, 8);
        ctx.lineTo(21, 20);
        ctx.moveTo(18, 12);
        ctx.lineTo(24, 12);
        ctx.moveTo(18, 16);
        ctx.lineTo(24, 16);
        ctx.stroke();
        ctx.restore();

        // === BOOSTER SKIRT ===
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.moveTo(-18, 85);
        ctx.lineTo(-20, 90);
        ctx.lineTo(20, 90);
        ctx.lineTo(18, 85);
        ctx.fill();

        // === LANDING LEGS ===
        const alt = (state.groundY - this.y - this.h) / PIXELS_PER_METER;
        if (alt < 200) {
            const deploy = Math.min(1, (200 - alt) / 100);
            const legSpread = deploy * 20;
            const legLen = 15 + deploy * 10;
            ctx.strokeStyle = '#1a1a2e';
            ctx.lineWidth = 2;
            // Left leg
            ctx.beginPath();
            ctx.moveTo(-16, 88);
            ctx.lineTo(-16 - legSpread, 88 + legLen);
            ctx.stroke();
            // Left foot pad
            ctx.fillStyle = '#34495e';
            ctx.beginPath();
            ctx.arc(-16 - legSpread, 88 + legLen, 3, 0, Math.PI * 2);
            ctx.fill();
            // Right leg
            ctx.beginPath();
            ctx.moveTo(16, 88);
            ctx.lineTo(16 + legSpread, 88 + legLen);
            ctx.stroke();
            // Right foot pad
            ctx.beginPath();
            ctx.arc(16 + legSpread, 88 + legLen, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // === ENGINE (Gimbaled) ===
        ctx.save();
        ctx.translate(0, 90);
        ctx.rotate(this.gimbalAngle);

        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(-12, 0, 24, 3);

        const engGrad = ctx.createLinearGradient(-10, 0, 10, 0);
        engGrad.addColorStop(0, '#1a252f');
        engGrad.addColorStop(0.3, '#566573');
        engGrad.addColorStop(0.5, '#85929e');
        engGrad.addColorStop(0.7, '#566573');
        engGrad.addColorStop(1, '#1a252f');
        ctx.fillStyle = engGrad;
        ctx.beginPath();
        ctx.moveTo(-7, 3);
        ctx.bezierCurveTo(-9, 8, -12, 16, -14, 22);
        ctx.lineTo(14, 22);
        ctx.bezierCurveTo(12, 16, 9, 8, 7, 3);
        ctx.fill();

        ctx.fillStyle = 'rgba(52, 73, 94, 0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 22, 9, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        ctx.restore();
    }
}

/**
 * Upper Stage - Second stage after booster separation
 * Contains payload fairing
 */
export class UpperStage extends Vessel {
    public override readonly type = EntityType.UPPER_STAGE;

    /** Whether fairings have been jettisoned */
    public fairingsDeployed: boolean = false;

    /** Stage separation config */
    public nextStage: StageSeparation;

    constructor(x: number, y: number, vx: number = 0, vy: number = 0) {
        super(x, y);
        this.vx = vx;
        this.vy = vy;
        this.h = 60;
        this.mass = CONFIG.MASS_UPPER;
        this.maxThrust = CONFIG.MAX_THRUST_UPPER;
        this.active = true;
        this.ispVac = CONFIG.ISP_VAC_UPPER;
        this.ispSL = CONFIG.ISP_SL_UPPER;

        // Reliability: Vacuum engine
        this.reliabilityConfig = {
            mtbfEngine: 2000, // Very reliable vacuum engine
            mtbfStructure: 5000, // Lighter structure, more fragile
            mtbfElectronics: 3000,
            ignitionReliability: 0.99,
            wearFactor: 1.0
        };

        // Upper stage less stable without booster mass below
        this.aeroConfig = UPPER_STAGE_AERO_CONFIG;
        // Fairing provides protection during ascent
        this.tpsConfig = UPPER_STAGE_TPS_CONFIG;
        // Vacuum engine with slower spool-up
        this.propConfig = UPPER_STAGE_PROP_CONFIG;
        this.propState = createInitialPropulsionState(UPPER_STAGE_PROP_CONFIG);
        this.ignitersRemaining = UPPER_STAGE_PROP_CONFIG.igniterCount;

        this.nextStage = {
            type: 'Payload',
            separationVelocity: 2,
            offsetY: -10
        };
    }

    draw(ctx: CanvasRenderingContext2D, camY: number, alpha: number): void {
        if (this.crashed) return;

        const rX = this.prevX + (this.x - this.prevX) * alpha;
        const rY = this.prevY + (this.y - this.prevY) * alpha;
        const rAngle = this.prevAngle + (this.angle - this.prevAngle) * alpha;

        ctx.save();
        ctx.translate(rX, rY - camY);
        ctx.rotate(rAngle);

        this.drawPlasma(ctx);
        this.drawShockwave(ctx);

        // === FAIRING OR EXPOSED PAYLOAD ===
        if (!this.fairingsDeployed) {
            // Fairing nose cone
            const fairGrad = ctx.createLinearGradient(-16, 0, 16, 0);
            fairGrad.addColorStop(0, '#d5d8dc');
            fairGrad.addColorStop(0.35, '#f2f3f4');
            fairGrad.addColorStop(0.5, '#ffffff');
            fairGrad.addColorStop(0.65, '#f2f3f4');
            fairGrad.addColorStop(1, '#c0c5c9');
            ctx.fillStyle = fairGrad;
            ctx.beginPath();
            ctx.moveTo(0, -35);
            ctx.bezierCurveTo(-3, -28, -14, -10, -16, 0);
            ctx.lineTo(16, 0);
            ctx.bezierCurveTo(14, -10, 3, -28, 0, -35);
            ctx.fill();

            // Fairing seam
            ctx.strokeStyle = 'rgba(127, 140, 141, 0.4)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, -35);
            ctx.lineTo(0, 0);
            ctx.stroke();
        } else {
            // Exposed payload
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(-8, -8, 16, 8);
            // Mini solar panels
            ctx.fillStyle = '#2980b9';
            ctx.fillRect(-16, -6, 8, 4);
            ctx.fillRect(8, -6, 8, 4);
        }

        // === UPPER STAGE TANK ===
        const tankGrad = ctx.createLinearGradient(-16, 0, 16, 0);
        tankGrad.addColorStop(0, '#bfc9ca');
        tankGrad.addColorStop(0.3, '#ebedef');
        tankGrad.addColorStop(0.5, '#f8f9f9');
        tankGrad.addColorStop(0.7, '#ebedef');
        tankGrad.addColorStop(1, '#aab7b8');
        ctx.fillStyle = tankGrad;
        ctx.fillRect(-16, 0, 32, 50);

        // Tank markings
        ctx.strokeStyle = 'rgba(52, 73, 94, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-16, 20);
        ctx.lineTo(16, 20);
        ctx.stroke();

        // === VACUUM ENGINE (Wider nozzle) ===
        ctx.save();
        ctx.translate(0, 50);
        ctx.rotate(this.gimbalAngle);

        // Engine bell (wider for vacuum optimization)
        const vacEngGrad = ctx.createLinearGradient(-14, 0, 14, 0);
        vacEngGrad.addColorStop(0, '#1a252f');
        vacEngGrad.addColorStop(0.3, '#4a6274');
        vacEngGrad.addColorStop(0.5, '#7f8c8d');
        vacEngGrad.addColorStop(0.7, '#4a6274');
        vacEngGrad.addColorStop(1, '#1a252f');
        ctx.fillStyle = vacEngGrad;
        ctx.beginPath();
        ctx.moveTo(-6, 0);
        ctx.bezierCurveTo(-8, 5, -16, 18, -18, 25);
        ctx.lineTo(18, 25);
        ctx.bezierCurveTo(16, 18, 8, 5, 6, 0);
        ctx.fill();

        // Nozzle extension rings (vacuum engine characteristic)
        ctx.strokeStyle = 'rgba(127, 140, 141, 0.3)';
        ctx.lineWidth = 0.5;
        for (let r = 8; r <= 20; r += 4) {
            ctx.beginPath();
            ctx.moveTo(-6 - (r - 8) * 0.75, r);
            ctx.lineTo(6 + (r - 8) * 0.75, r);
            ctx.stroke();
        }

        ctx.restore();
        ctx.restore();
    }
}

/**
 * Payload - Satellite or other payload after deployment
 */
export class Payload extends Vessel {
    public override readonly type = EntityType.PAYLOAD;

    /** Visual color */
    public color: string = '#bdc3c7';

    constructor(x: number, y: number, vx: number = 0, vy: number = 0) {
        super(x, y);
        this.vx = vx;
        this.vy = vy;
        this.mass = 1000;
        this.w = 20;
        this.h = 20;
        this.active = true;

        // Payload has neutral stability (satellite shape)
        this.aeroConfig = PAYLOAD_AERO_CONFIG;
        // Full ablative heat shield for re-entry capability
        this.tpsConfig = PAYLOAD_TPS_CONFIG;
        // No main engine (satellite)
        this.propConfig = PAYLOAD_PROP_CONFIG;
        this.propState = createInitialPropulsionState(PAYLOAD_PROP_CONFIG);
        this.ignitersRemaining = 0;
    }

    draw(ctx: CanvasRenderingContext2D, camY: number, alpha: number): void {
        const rX = this.prevX + (this.x - this.prevX) * alpha;
        const rY = this.prevY + (this.y - this.prevY) * alpha;
        const rAngle = this.prevAngle + (this.angle - this.prevAngle) * alpha;

        ctx.save();
        ctx.translate(rX, rY - camY);
        ctx.rotate(rAngle);

        // === SATELLITE BUS (Metallic body) ===
        const busGrad = ctx.createLinearGradient(-10, -10, 10, 10);
        busGrad.addColorStop(0, '#d4ac0d');
        busGrad.addColorStop(0.5, '#f9e154');
        busGrad.addColorStop(1, '#b7950b');
        ctx.fillStyle = busGrad;
        ctx.fillRect(-10, -10, 20, 20);

        // Bus outline
        ctx.strokeStyle = '#7d6608';
        ctx.lineWidth = 1;
        ctx.strokeRect(-10, -10, 20, 20);

        // Antenna dish
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.arc(0, -12, 4, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#95a5a6';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(0, -16);
        ctx.stroke();

        // === SOLAR PANELS (with cell grid) ===
        // Left panel
        const panelGradL = ctx.createLinearGradient(-40, 0, -10, 0);
        panelGradL.addColorStop(0, '#1a5276');
        panelGradL.addColorStop(0.5, '#2e86c1');
        panelGradL.addColorStop(1, '#1a5276');
        ctx.fillStyle = panelGradL;
        ctx.fillRect(-40, -5, 28, 10);
        // Panel frame
        ctx.strokeStyle = '#566573';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-40, -5, 28, 10);
        // Cell grid lines
        ctx.strokeStyle = 'rgba(26, 82, 118, 0.4)';
        for (let i = -33; i < -10; i += 7) {
            ctx.beginPath();
            ctx.moveTo(i, -5);
            ctx.lineTo(i, 5);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.lineTo(-12, 0);
        ctx.stroke();

        // Right panel
        const panelGradR = ctx.createLinearGradient(12, 0, 40, 0);
        panelGradR.addColorStop(0, '#1a5276');
        panelGradR.addColorStop(0.5, '#2e86c1');
        panelGradR.addColorStop(1, '#1a5276');
        ctx.fillStyle = panelGradR;
        ctx.fillRect(12, -5, 28, 10);
        ctx.strokeStyle = '#566573';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(12, -5, 28, 10);
        ctx.strokeStyle = 'rgba(26, 82, 118, 0.4)';
        for (let i = 19; i < 40; i += 7) {
            ctx.beginPath();
            ctx.moveTo(i, -5);
            ctx.lineTo(i, 5);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(40, 0);
        ctx.stroke();

        // Panel hinges
        ctx.fillStyle = '#34495e';
        ctx.fillRect(-12, -2, 2, 4);
        ctx.fillRect(10, -2, 2, 4);

        ctx.restore();
    }
}

/**
 * Fairing - Payload fairing half after separation
 */
export class Fairing extends Vessel {
    public override readonly type = EntityType.FAIRING;

    /** Which side (left=-1, right=1) */
    public side: number;

    constructor(x: number, y: number, vx: number = 0, vy: number = 0, side: number = 1) {
        super(x, y);
        this.vx = vx + side * 5; // Lateral separation velocity
        this.vy = vy;
        this.side = side;
        this.active = false; // No thrust
        this.h = 40;
        this.cd = 2.0; // High drag
    }

    draw(ctx: CanvasRenderingContext2D, camY: number, alpha: number): void {
        const rX = this.prevX + (this.x - this.prevX) * alpha;
        const rY = this.prevY + (this.y - this.prevY) * alpha;
        const rAngle = this.prevAngle + (this.angle - this.prevAngle) * alpha;

        ctx.save();
        ctx.translate(rX, rY - camY);
        ctx.rotate(rAngle);

        this.drawPlasma(ctx);

        // === FAIRING HALF with 3D gradient ===
        const s = this.side;
        const fairGrad = ctx.createLinearGradient(0, 0, s * 20, 0);
        fairGrad.addColorStop(0, '#f2f3f4');
        fairGrad.addColorStop(0.6, '#ebedef');
        fairGrad.addColorStop(1, '#d5d8dc');
        ctx.fillStyle = fairGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(s * 18, 0);
        ctx.bezierCurveTo(s * 16, -12, s * 8, -32, 0, -40);
        ctx.closePath();
        ctx.fill();

        // Edge highlight
        ctx.strokeStyle = 'rgba(127, 140, 141, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -40);
        ctx.stroke();

        // Structural ribs
        ctx.strokeStyle = 'rgba(52, 73, 94, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(s * 5, -30);
        ctx.lineTo(s * 10, 0);
        ctx.moveTo(s * 10, -18);
        ctx.lineTo(s * 15, 0);
        ctx.stroke();

        ctx.restore();
    }
}
