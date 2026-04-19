/**
 * Game
 *
 * Main game controller class.
 * Manages game loop, physics updates, rendering, and subsystems.
 */

import { CameraMode, MissionState, IVessel, PhysicsEvent, FlightComputerStatusDTO } from '../types';
import { VehicleBlueprint } from '../vab/VehicleBlueprint';
import {
    PIXELS_PER_METER,
    R_EARTH,
    getAtmosphericDensity,
    VISUAL_CORRIDOR_WIDTH_BASE,
    VISUAL_CORRIDOR_WIDTH_EXPANSION,
    VISUAL_CORRIDOR_TARGET_ALTITUDE,
    VISUAL_CORRIDOR_DRAW_STEP,
    WIND_COLORS,
    WIND_DRAW_STEP
} from '../config/Constants';
import { predictOrbitPath } from '../physics/OrbitalMechanics';
import { state, updateDimensions, setAssetLoader, addParticle, clearParticles } from './State';
import { InputManager } from './InputManager';
import { AudioEngine } from '../utils/AudioEngine';
import { AssetLoader } from '../utils/AssetLoader';
import { SAS } from '../utils/SAS';
import { MathUtils } from '../utils/MathUtils';
import { MissionLog } from '../ui/MissionLog';
import { Navball } from '../ui/Navball';
import { TelemetrySystem } from '../ui/Telemetry';
import { Particle } from '../physics/Particle';
import { Booster, UpperStage } from '../physics/RocketComponents';
import { BlackBoxRecorder } from '../telemetry/BlackBoxRecorder';
import { EnvironmentSystem, EnvironmentState } from '../physics/Environment';
import { setWindVelocity, setDensityMultiplier } from './State';
import { ManeuverPlanner } from '../ui/ManeuverPlanner';
import { MissionControl } from '../ui/MissionControl';
import { FlightTerminationSystem } from '../safety/FlightTermination';
import { LaunchChecklist } from '../safety/LaunchChecklist';
import { FaultInjector } from '../safety/FaultInjector';
import { PhysicsProxy } from './PhysicsProxy';
import { TelemetryTransmitter } from '../telemetry/TelemetryTransmitter';
import { ParticleSystem } from '../physics/ParticleSystem';
import { HUDManager } from '../ui/HUDManager';

export class Game {
    // Canvas and rendering
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private width: number;
    private height: number;
    public groundY: number;

    // Subsystems
    public input: InputManager;
    public audio: AudioEngine;
    public assets: AssetLoader;
    public navball: Navball;
    public telemetry: TelemetrySystem;
    public missionLog: MissionLog;
    public sas: SAS;
    public blackBox: BlackBoxRecorder;
    public environment: EnvironmentSystem;
    public maneuverPlanner: ManeuverPlanner;
    public missionControl: MissionControl;
    public fts: FlightTerminationSystem;
    public checklist: LaunchChecklist;
    public faultInjector: FaultInjector;
    public transmitter: TelemetryTransmitter;
    public hudManager: HUDManager;

    // Game state
    public entities: IVessel[] = [];
    private nextOrbitUpdateIndex: number = 0;
    private cameraY: number = 0;
    private cameraMode: CameraMode = 'ROCKET';
    private cameraShakeX: number = 0;
    private cameraShakeY: number = 0;
    private timeScale: number = 1.0;

    // Tracked vessels
    public trackedEntity: IVessel | null = null;
    public mainStack: IVessel | null = null;
    public booster: Booster | null = null;
    public upperStage: UpperStage | null = null;

    // Command state (User Input)
    public commandThrottle: number = 0;
    public stagingCommand: boolean = false;
    private readonly ZOOM: number = 1.2;

    // Mission state
    private missionState: MissionState = {
        liftoff: false,
        supersonic: false,
        maxq: false
    };

    // Timing
    private lastTime: number = 0;
    private accumulator: number = 0;
    private readonly FIXED_DT: number = 1 / 60;
    public missionTime: number = 0;
    private lastStageTime: number = 0;

    // Environment state for HUD (latest physics update)
    private lastEnvState: EnvironmentState | null = null;

    // Sky Gradient Cache
    private skyGradientCache = {
        lastHeight: -1,
        lastStep: -1,
        gradient: null as CanvasGradient | null
    };

    // Pre-allocated buffers for wind rendering to avoid GC
    private _windLowBatch: number[] = [];
    private _windMedBatch: number[] = [];
    private _windHighBatch: number[] = [];
    private _windTextStrings: string[] = [];
    private _windTextX: number[] = [];
    private _windTextY: number[] = [];

    // Cached state to reduce redundant calculations
    private _cachedVelocity: number = 0;

    private physics: PhysicsProxy;

    constructor() {
        this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;

        // Initialize physics proxy
        this.physics = new PhysicsProxy();
        this.physics.onEvent(this.handlePhysicsEvent.bind(this));

        this.width = window.innerWidth;
        this.height = window.innerHeight;
        updateDimensions(this.width, this.height, this.height - 100);
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.groundY = this.height - 100;

        // Initialize subsystems
        this.input = new InputManager();
        this.audio = new AudioEngine();
        this.assets = new AssetLoader();
        setAssetLoader(this.assets);
        this.navball = new Navball();
        this.telemetry = new TelemetrySystem();
        this.missionLog = new MissionLog();
        this.sas = new SAS();
        this.blackBox = new BlackBoxRecorder(this.groundY);
        this.environment = new EnvironmentSystem();
        this.maneuverPlanner = new ManeuverPlanner(this);
        this.missionControl = new MissionControl(this);
        this.fts = new FlightTerminationSystem();
        this.checklist = new LaunchChecklist('checklist-panel');
        this.faultInjector = new FaultInjector('fis-panel');
        this.transmitter = new TelemetryTransmitter();
        this.hudManager = new HUDManager();

        window.PIXELS_PER_METER = PIXELS_PER_METER;
        window.R_EARTH = R_EARTH;
        window.navball = this.navball;
        window.missionLog = this.missionLog;
        window.audio = this.audio;
    }

    /**
     * Initialize game
     */
    async init(): Promise<void> {
        // Audio requires user interaction
        document.addEventListener(
            'click',
            () => {
                this.audio.resume();
                this.audio.init();
            },
            { once: true }
        );

        document.addEventListener(
            'touchstart',
            () => {
                this.audio.resume();
                this.audio.init();
            },
            { once: true }
        );

        // Toggle Maneuver Planner with 'O'
        window.addEventListener('keydown', (e) => {
            if (e.key === 'o' || e.key === 'O') {
                this.maneuverPlanner.toggle();
            }
        });

        // Load assets
        await this.assets.loadAll();

        // Reset game state
        this.reset();

        // Start game loop
        this.animate(0);
    }

    /**
     * Reset to initial state
     */
    reset(): void {
        this.entities = [];
        clearParticles();
        this.cameraY = 0;
        this.timeScale = 1;
        this.missionState = { liftoff: false, supersonic: false, maxq: false };
        this.commandThrottle = 0;
        this.stagingCommand = false;

        // Reset safety systems
        // FTS reset handled by worker init
        this.checklist.reset(); // UI only
        // FaultInjector reset handled by worker init

        // Initialize physics worker
        this.physics.init({
            width: this.width,
            height: this.height,
            groundY: this.groundY
        });

        // Legacy globals (will be synced next frame)
        window.mainStack = null;
        window.trackedEntity = null;
    }

    /**
     * Spawn a new vessel from a blueprint
     */
    spawnVessel(_blueprint: VehicleBlueprint): void {
        // For now, reset which triggers worker init to spawn default rocket
        this.reset();
    }

    /**
     * Launch logic
     */
    public launch(): void {
        if (this.missionState.liftoff) {
            this.missionLog.log('Already launched!', 'info');
            return;
        }

        this.commandThrottle = 1.0;

        // Optimistic update for immediate feedback
        if (this.mainStack) {
            this.mainStack.active = true;
            this.mainStack.throttle = 1.0;
        }

        this.missionLog.log('IGNITION SEQUENCE START', 'warn');
        this.audio.speak('Ignition');
    }

    /**
     * Set explicit throttle command (0.0 to 1.0)
     */
    public setThrottle(val: number): void {
        this.commandThrottle = Math.max(0, Math.min(1, val));
    }

    /**
     * Physics Event Listeners
     */
    private physicsEventListeners: ((e: PhysicsEvent) => void)[] = [];

    public addPhysicsEventListener(callback: (e: PhysicsEvent) => void): void {
        this.physicsEventListeners.push(callback);
    }

    /**
     * Send a command to the physics worker (e.g. Flight Computer)
     */
    public command(type: string, payload: unknown): void {
        this.physics.command(type, payload);
    }

    /**
     * Get Flight Computer status from Physics Worker
     */
    public getFlightComputerStatus(): FlightComputerStatusDTO {
        return this.physics.getFlightComputerStatus();
    }

    /**
     * Handle events from physics worker
     */
    private handlePhysicsEvent(e: PhysicsEvent): void {
        // Dispatch to listeners
        for (const cb of this.physicsEventListeners) {
            cb(e);
        }

        if (e.name === 'STAGING_S1') {
            this.missionLog.log('STAGING: S1 SEP', 'warn');
            this.audio.playStaging();

            // Create staging particles (Visual only)
            for (let i = 0; i < 30; i++) {
                addParticle(
                    Particle.create(
                        (e.x ?? 0) + (MathUtils.secureRandom() - 0.5) * 20,
                        (e.y ?? 0) + 80,
                        'smoke',
                        0, // velocity handled by particle logic?
                        0
                    )
                );
            }
        } else if (e.name === 'FAIRING_SEP') {
            this.missionLog.log('FAIRING SEP', 'info');
            this.audio.playStaging();
        } else if (e.name === 'PAYLOAD_SEP') {
            this.missionLog.log('PAYLOAD DEP', 'success');
            this.audio.playStaging();
        }
    }

    public performStaging(): void {
        if (Date.now() - this.lastStageTime < 1000) return;
        this.lastStageTime = Date.now();
        this.stagingCommand = true;

        // Send command to worker
        this.physics.command('STAGE', {});
    }

    private processTimeWarpAndCamera(): void {
        // Time warp controls
        if (this.input.actions.TIME_WARP_UP && this.timeScale < 100) {
            this.timeScale *= 1.1;
        }
        if (this.input.actions.TIME_WARP_DOWN && this.timeScale > 1) {
            this.timeScale *= 0.9;
        }

        // Map mode toggle
        if (this.input.actions.MAP_MODE) {
            this.cameraMode = this.cameraMode === 'MAP' ? 'ROCKET' : 'MAP';
            this.input.actions.MAP_MODE = false;
        }
    }

    private gatherControls(dt: number) {
        // Collect inputs
        let throttle = this.commandThrottle;
        let gimbalAngle = 0;
        const stage = this.stagingCommand;
        const abort = false;
        this.stagingCommand = false; // Reset one-shot command

        if (this.mainStack) {
            gimbalAngle = this.mainStack.gimbalAngle;

            // Manual steering
            const steer = this.input.getSteering();

            if (Math.abs(steer) > 0.1) {
                gimbalAngle = steer * 0.4;
            } else if (this.sas.isActive()) {
                const sasOut = this.sas.update(this.mainStack, dt * this.timeScale);
                gimbalAngle = sasOut;
            } else {
                gimbalAngle = 0;
            }

            // Manual Throttle Overrides (updates command state)
            if (this.input.actions.THROTTLE_UP) this.setThrottle(this.commandThrottle + 0.02);
            if (this.input.actions.THROTTLE_DOWN) this.setThrottle(this.commandThrottle - 0.02);
            if (this.input.actions.CUT_ENGINE) this.setThrottle(0);

            // Re-read throttle in case it changed
            throttle = this.commandThrottle;
        }

        return {
            throttle,
            gimbalAngle,
            stage,
            abort,
            // Explicitly signal active state change
            ignition: this.commandThrottle > 0,
            cutoff: this.commandThrottle === 0
        };
    }

    private updateEnvironmentView(dt: number): void {
        // Update Environment (View)
        // Worker sends wind/density via buffer; other env fields come from main-thread EnvironmentSystem
        this.environment.update(dt * this.timeScale);
        const envState = this.physics.getEnvironmentState();
        if (envState) {
            // Merge environment data not available in the shared buffer
            const localEnv = this.environment.getState(0);
            envState.timeOfDay = localEnv.timeOfDay;
            envState.isLaunchSafe = localEnv.isLaunchSafe;
            envState.maxQWindWarning = localEnv.maxQWindWarning;

            if (envState.windVelocity) setWindVelocity(envState.windVelocity);
            if (envState.densityMultiplier !== undefined) setDensityMultiplier(envState.densityMultiplier);
            this.lastEnvState = envState as EnvironmentState;
        } else {
            this.lastEnvState = this.environment.getState(0);
        }
    }

    private processMissionEvents(): void {
        // Mission events
        if (this.trackedEntity) {
            const alt = (this.groundY - this.trackedEntity.y - this.trackedEntity.h) / PIXELS_PER_METER;

            // Audio update
            const vel = this._cachedVelocity;
            const rho = getAtmosphericDensity(alt);
            this.audio.setThrust(this.trackedEntity.throttle, rho, vel);

            if (!this.missionState.liftoff && alt > 20) {
                this.missionState.liftoff = true;
                this.missionLog.log('LIFTOFF', 'warn');
                this.audio.speak('Liftoff');
                if (this.blackBox.getState() === 'idle') {
                    this.blackBox.start('Flight');
                }
            }

            // Blackbox
            if (this.missionState.liftoff) {
                this.blackBox.record(this.trackedEntity, this.missionTime);
            }

            if (this.trackedEntity.crashed && this.blackBox.isRecording()) {
                this.blackBox.stop('crashed');
            }
        }
    }

    private updateParticles(): void {
        // Particle System Update (Zero-allocation loop)
        // 1. Spawn exhaust for all entities with throttle > 0
        // Optimized: standard for loop avoids closure allocation of forEach
        for (let i = 0; i < this.entities.length; i++) {
            const entity = this.entities[i];
            if (entity) {
                ParticleSystem.spawnExhaust(entity, this.timeScale);
            }
        }

        // 2. Update and prune particles
        const particles = state.particles;
        let activeCount = 0;
        const len = particles.length;

        for (let i = 0; i < len; i++) {
            const p = particles[i];
            if (!p) continue;

            p.update(this.groundY, this.timeScale);
            if (p.life > 0) {
                if (i !== activeCount) {
                    particles[activeCount] = p;
                }
                activeCount++;
            } else if (p instanceof Particle) {
                Particle.release(p);
            }
        }
        // Truncate array to remove dead particles without allocation
        if (activeCount < len) {
            particles.length = activeCount;
        }
    }

    /**
     * Physics update
     */
    private updatePhysics(dt: number): void {
        this.processTimeWarpAndCamera();
        const controls = this.gatherControls(dt);

        // Step Physics logic in Worker
        this.physics.step(dt, { timeScale: this.timeScale, controls });

        // Update references
        const trackedIdx = this.physics.getTrackedIndex();
        this.trackedEntity = this.entities[trackedIdx] || null;
        this.mainStack = this.trackedEntity; // Simplified assumption

        // Sync globals for legacy/UI
        state.entities = this.entities;
        window.trackedEntity = this.trackedEntity;
        window.mainStack = this.mainStack;

        this.updateEnvironmentView(dt);

        // Update Mission Control
        this.missionControl.update(dt * this.timeScale, this.missionTime);

        this.processMissionEvents();

        // Sync globals
        window.trackedEntity = this.trackedEntity;
        window.mainStack = this.mainStack;

        this.updateParticles();
    }

    /**
     * Update orbit prediction paths
     * Uses RK4 integration for accurate trajectory prediction
     */
    private updateOrbitPaths(now: number): void {
        const totalEntities = this.entities.length;
        if (totalEntities === 0) return;

        // Spread updates over ~6 frames (assuming 60fps) or 100ms
        const updateBudget = Math.max(1, Math.ceil(totalEntities / 6));

        for (let i = 0; i < updateBudget; i++) {
            const index = (this.nextOrbitUpdateIndex + i) % totalEntities;
            const e = this.entities[index];

            if (!e || e.crashed) continue;

            // Throttle: minimum 100ms between updates
            if (now - e.lastOrbitUpdate < 100) continue;

            const alt = (this.groundY - e.y - e.h) / PIXELS_PER_METER;
            let needsUpdate = false;

            if (e.throttle > 0) needsUpdate = true;
            if (alt < 140000) needsUpdate = true;
            if (now - e.lastOrbitUpdate > 1000) needsUpdate = true;
            if (!e.orbitPath) needsUpdate = true;

            if (needsUpdate) {
                if (!e.orbitPath) {
                    e.orbitPath = [];
                }

                const path = e.orbitPath;
                e.lastOrbitUpdate = now;

                // Initial State for RK4
                const r0 = R_EARTH + alt;
                // phi is x / R_EARTH (radians around earth)
                const phi0 = e.x / R_EARTH;

                // State vector: [r, phi, vr, vphi]
                // vr = radial velocity (positive up) = -e.vy
                // vphi = tangential velocity = e.vx
                const r = r0;
                const phi = phi0;
                const vr = -e.vy;
                const vphi = e.vx;

                predictOrbitPath(path, r, phi, vr, vphi, 5.0, 400);
            }
        }

        this.nextOrbitUpdateIndex = (this.nextOrbitUpdateIndex + updateBudget) % totalEntities;
    }

    /**
     * Draw the Safe Flight Corridor (Launch corridor)
     */
    private drawSafeFlightCorridor(startAlt: number, endAlt: number): void {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
        this.ctx.lineWidth = 2 / this.ZOOM; // Maintain line width
        this.ctx.setLineDash([20 / this.ZOOM, 20 / this.ZOOM]);

        this.ctx.beginPath();
        // Left boundary
        for (let alt = startAlt; alt <= endAlt; alt += VISUAL_CORRIDOR_DRAW_STEP) {
            const width =
                VISUAL_CORRIDOR_WIDTH_BASE + (alt / VISUAL_CORRIDOR_TARGET_ALTITUDE) * VISUAL_CORRIDOR_WIDTH_EXPANSION;
            const y = this.groundY - alt * PIXELS_PER_METER;
            const x = this.width / 2 - width * PIXELS_PER_METER;
            if (alt === startAlt) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();

        this.ctx.beginPath();
        // Right boundary
        for (let alt = startAlt; alt <= endAlt; alt += VISUAL_CORRIDOR_DRAW_STEP) {
            const width =
                VISUAL_CORRIDOR_WIDTH_BASE + (alt / VISUAL_CORRIDOR_TARGET_ALTITUDE) * VISUAL_CORRIDOR_WIDTH_EXPANSION;
            const y = this.groundY - alt * PIXELS_PER_METER;
            const x = this.width / 2 + width * PIXELS_PER_METER;
            if (alt === startAlt) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
        this.ctx.restore();
    }

    /**
     * Draw Wind Vectors
     * Batched drawing by color to reduce draw calls and state changes
     */
    private drawWindVectors(camY: number): void {
        this.ctx.save();
        const step = WIND_DRAW_STEP; // pixels
        const startY = Math.floor(camY / step) * step;
        const tempWind = { speed: 0, direction: 0 };
        const screenX = 50 / this.ZOOM; // Draw on left side (scaled)

        let lowIdx = 0;
        let medIdx = 0;
        let highIdx = 0;
        let textIdx = 0;

        for (let y = startY; y < camY + this.height / this.ZOOM; y += step) {
            const alt = (this.groundY - y) / PIXELS_PER_METER;
            if (alt < 0) continue;

            this.environment.getWindPolar(alt, tempWind);
            const { speed, direction } = tempWind;

            if (speed > 1) {
                const screenY = y;

                // Pre-calculate rotation
                const angle = direction + Math.PI;
                const c = Math.cos(angle);
                const s = Math.sin(angle);

                // Arrow shape vertices (relative to origin)
                const len = Math.min(50, speed * 2);
                const vertices = [0, -2, len - 5, -2, len - 5, -5, len, 0, len - 5, 5, len - 5, 2, 0, 2];

                // Transform vertices
                for (let i = 0; i < vertices.length; i += 2) {
                    const vx = vertices[i]!;
                    const vy = vertices[i + 1]!;
                    // Rotate and translate
                    const tx = vx * c - vy * s + screenX;
                    const ty = vx * s + vy * c + screenY;

                    // Add to appropriate batch
                    if (speed < 10) {
                        this._windLowBatch[lowIdx++] = tx;
                        this._windLowBatch[lowIdx++] = ty;
                    } else if (speed < 30) {
                        this._windMedBatch[medIdx++] = tx;
                        this._windMedBatch[medIdx++] = ty;
                    } else {
                        this._windHighBatch[highIdx++] = tx;
                        this._windHighBatch[highIdx++] = ty;
                    }
                }

                // Add text info (offset by 10, 15 relative to arrow center)
                this._windTextStrings[textIdx] = `${speed.toFixed(0)} m/s`;
                this._windTextX[textIdx] = screenX + 10;
                this._windTextY[textIdx] = screenY + 15;
                textIdx++;
            }
        }

        this._windLowBatch.length = lowIdx;
        this._windMedBatch.length = medIdx;
        this._windHighBatch.length = highIdx;
        this._windTextStrings.length = textIdx;
        this._windTextX.length = textIdx;
        this._windTextY.length = textIdx;

        // Render batches
        const drawBatch = (points: number[], color: string) => {
            if (points.length === 0) return;
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            for (let i = 0; i < points.length; i += 14) {
                // 7 vertices * 2 coords
                this.ctx.moveTo(points[i]!, points[i + 1]!);
                for (let j = 2; j < 14; j += 2) {
                    this.ctx.lineTo(points[i + j]!, points[i + j + 1]!);
                }
            }
            this.ctx.fill();
        };

        drawBatch(this._windLowBatch, WIND_COLORS[0]!);
        drawBatch(this._windMedBatch, WIND_COLORS[1]!);
        drawBatch(this._windHighBatch, WIND_COLORS[2]!);

        // Draw text
        if (this._windTextStrings.length > 0) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.font = `${10 / this.ZOOM}px monospace`;
            const len = this._windTextStrings.length;
            for (let i = 0; i < len; i++) {
                this.ctx.fillText(this._windTextStrings[i]!, this._windTextX[i]!, this._windTextY[i]!);
            }
        }

        this.ctx.restore();
    }

    /**
     * Draw environmental visuals (wind, corridors)
     */
    private drawEnvironment(camY: number): void {
        const startAlt = Math.max(0, (this.groundY - (camY + this.height / this.ZOOM)) / PIXELS_PER_METER);
        const endAlt = (this.groundY - camY) / PIXELS_PER_METER;

        // 1. Draw Safe Flight Corridor (Launch corridor)
        this.drawSafeFlightCorridor(startAlt, endAlt);

        // 2. Draw Wind Vectors
        this.drawWindVectors(camY);
    }

    /**
     * Draw the scene
     */
    private draw(alpha: number): void {
        if (this.cameraMode === 'MAP') {
            this.drawMapView();
        } else {
            this.drawRocketView(alpha);
        }

        // Draw Mission Control Overlay
        this.missionControl.draw(this.ctx, this.width, this.height);
    }

    /**
     * Draw orbital map view
     */
    private drawMapView(): void {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);

        const cx = this.width / 2;
        const cy = this.height / 2;
        const scale = 0.00005;

        // Draw Earth
        const rEarthPx = R_EARTH * scale;
        this.ctx.fillStyle = '#3498db';
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, rEarthPx, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw vessels and orbits
        for (let j = 0; j < this.entities.length; j++) {
            const e = this.entities[j];
            if (!e || e.crashed) continue;

            const alt = (this.groundY - e.y - e.h) / PIXELS_PER_METER;
            const r = R_EARTH + alt;
            const phi = e.x / R_EARTH;

            // Optimized: Use identities cos(x-pi/2) = sin(x) and sin(x-pi/2) = -cos(x)
            const ox = cx + Math.sin(phi) * r * scale;
            const oy = cy - Math.cos(phi) * r * scale;

            // Vessel dot
            this.ctx.fillStyle = e === this.trackedEntity ? '#f1c40f' : '#aaa';
            this.ctx.beginPath();
            this.ctx.arc(ox, oy, 3, 0, Math.PI * 2);
            this.ctx.fill();

            // Orbit path
            if (e.orbitPath) {
                this.ctx.strokeStyle = this.ctx.fillStyle;
                this.ctx.beginPath();
                for (let i = 0; i < e.orbitPath.length; i++) {
                    const p = e.orbitPath[i];
                    if (!p) continue;
                    // Optimized: Use pre-calculated relative coordinates if available
                    const px = cx + (p.relX ?? Math.sin(p.phi) * p.r) * scale;
                    const py = cy + (p.relY ?? -Math.cos(p.phi) * p.r) * scale;
                    if (i === 0) {
                        this.ctx.moveTo(px, py);
                    } else {
                        this.ctx.lineTo(px, py);
                    }
                }
                this.ctx.stroke();
            }
        }

        // Label
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px monospace';
        this.ctx.fillText('MAP MODE', 20, 40);
    }

    /**
     * Draw rocket flight view
     */
    /**
     * Draw rocket flight view
     */
    private drawRocketView(alpha: number): void {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Sky gradient
        const alt = -this.cameraY;
        let step = (alt / 600) | 0;
        if (step < 0) step = 0;
        else if (step > 100) step = 100;

        // Optimized: Reuse gradient if parameters haven't changed
        if (
            this.skyGradientCache.gradient &&
            this.skyGradientCache.lastHeight === this.height &&
            this.skyGradientCache.lastStep === step
        ) {
            this.ctx.fillStyle = this.skyGradientCache.gradient;
        } else {
            const spaceRatio = step / 100;
            const invRatio = 1 - spaceRatio;

            const rBot = (135 * invRatio) | 0;
            const gBot = (206 * invRatio) | 0;
            const bBot = (235 * invRatio) | 0;
            const bTop = (20 * invRatio) | 0;

            const grd = this.ctx.createLinearGradient(0, 0, 0, this.height);
            grd.addColorStop(0, `rgb(0, 0, ${bTop})`);
            grd.addColorStop(1, `rgb(${rBot}, ${gBot}, ${bBot})`);
            this.ctx.fillStyle = grd;

            // Update cache
            this.skyGradientCache.gradient = grd;
            this.skyGradientCache.lastHeight = this.height;
            this.skyGradientCache.lastStep = step;
        }

        this.ctx.fillRect(0, 0, this.width, this.height);

        // Camera follow
        if (this.trackedEntity) {
            let targetY = this.trackedEntity.y - (this.height * 0.6) / this.ZOOM;
            if (this.cameraMode === 'ROCKET') {
                targetY = this.trackedEntity.y - this.height / 2 / this.ZOOM;
            }

            if (targetY < 0) {
                this.cameraY += (targetY - this.cameraY) * 0.1;
            } else {
                this.cameraY += (0 - this.cameraY) * 0.1;
            }

            // Camera shake from dynamic pressure
            const q = this.trackedEntity.q ?? 0;
            const shake = Math.min(q / 200, 10);
            this.cameraShakeX = (MathUtils.secureRandom() - 0.5) * shake;
            this.cameraShakeY = (MathUtils.secureRandom() - 0.5) * shake;
        }

        this.ctx.save();

        // Simplified Camera Transform
        // 1. Scale everything
        this.ctx.scale(this.ZOOM, this.ZOOM);

        // 2. Translate "Camera"
        // We want the rocket to be at:
        // Screen X: width/2
        // Screen Y: height * 0.6 (slightly below center)
        //
        // Logic: ScreenPos = (WorldPos - CamPos) * Zoom
        // width/2 = (RocketX - CamX) * Zoom  =>  CamX = RocketX - (width/2)/Zoom
        // height*0.6 = (RocketY - CamY) * Zoom => CamY = RocketY - (height*0.6)/Zoom

        let camX = 0; // Default center
        if (this.trackedEntity) {
            // Interpolate tracked entity position for camera tracking
            const trackedX = this.trackedEntity.prevX + (this.trackedEntity.x - this.trackedEntity.prevX) * alpha;
            const trackedY = this.trackedEntity.prevY + (this.trackedEntity.y - this.trackedEntity.prevY) * alpha;

            // Calculate desired camera position to keep rocket centered
            camX = trackedX - this.width / 2 / this.ZOOM;

            // Smoothly update cameraY (altitude tracking)
            // We want RocketY - CamY to be constant-ish
            const targetCamY = trackedY - (this.height * 0.5) / this.ZOOM;

            // Clamp camera: Don't show below ground too much
            // Ground is at this.groundY.
            // If we want ground at bottom of screen: CamY = groundY - height/Zoom

            // Interpolate
            this.cameraY = targetCamY;

            // Hard clamp to not show under-ground void
            // Actually, allowed for crash debris, but let's keep it reasonable
        }

        // Apply shake
        const shakeX = this.cameraShakeX / this.ZOOM;
        const shakeY = this.cameraShakeY / this.ZOOM;

        // Apply translation
        // Note: this.cameraY is already being tracked in the class
        this.ctx.translate(-camX + shakeX, -this.cameraY + shakeY);

        // Ground
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.fillRect(-50000, this.groundY, 100000, 500);

        // Particles
        Particle.drawParticles(this.ctx, state.particles as Particle[]);

        // Entities
        for (let i = 0; i < this.entities.length; i++) {
            const e = this.entities[i];
            if (e) {
                e.draw(this.ctx, 0, alpha);
            }
        }

        // Draw environmental overlays
        this.drawEnvironment(this.cameraY);

        this.ctx.restore();

        // HUD
        this.drawHUD();
    }

    /**
     * Draw heads-up display
     * Optimized: Uses cached DOM elements to avoid expensive getElementById calls every frame.
     * Performance: ~1.74x faster than uncached DOM access (benchmark tests/benchmark_full_hud.ts).
     */
    private drawHUD(): void {
        this.hudManager.update(
            this.trackedEntity,
            this.groundY,
            this._cachedVelocity,
            this.lastEnvState,
            this.fts
        );

        if (!this.trackedEntity) return;

        const velAngle = Math.atan2(this.trackedEntity.vx, -this.trackedEntity.vy);
        this.navball.draw(this.trackedEntity.angle, velAngle);
    }

    /**
     * Main animation loop
     */
    private animate(currentTime: number): void {
        if (!this.lastTime) this.lastTime = currentTime;

        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;
        this.accumulator += deltaTime;

        // Fixed timestep physics
        while (this.accumulator >= this.FIXED_DT) {
            this.updatePhysics(this.FIXED_DT);
            this.accumulator -= this.FIXED_DT;
        }

        // Sync and interpolate states from worker buffer
        this.physics.syncView(deltaTime, this.timeScale);
        this.entities = this.physics.getEntities();
        this.missionTime = this.physics.getMissionTime();

        // Update cached velocity to avoid multiple Math.sqrt calls per frame
        if (this.trackedEntity) {
            this._cachedVelocity = Math.sqrt(this.trackedEntity.vx ** 2 + this.trackedEntity.vy ** 2);
        } else {
            this._cachedVelocity = 0;
        }

        const alpha = this.physics.getInterpolationAlpha();

        if (this.cameraMode === 'MAP') {
            this.updateOrbitPaths(currentTime);
        }

        // Broadcast Telemetry
        if (this.trackedEntity) {
            this.transmitter.broadcast({
                timestamp: Date.now(),
                missionTime: this.missionTime,
                altitude: (this.groundY - this.trackedEntity.y - this.trackedEntity.h) / PIXELS_PER_METER,
                velocity: this._cachedVelocity,
                fuel: this.trackedEntity.fuel,
                throttle: this.trackedEntity.throttle,
                position: { x: this.trackedEntity.x, y: this.trackedEntity.y },
                velocityVector: { x: this.trackedEntity.vx, y: this.trackedEntity.vy },
                stage: 0, // Simplified for now
                liftoff: this.missionState.liftoff,
                apogee: 0, // Calculated in HUD usually, could move logic here
                status: this.missionState.liftoff ? 'FLIGHT' : 'PRELAUNCH'
            });
        }

        this.draw(alpha);

        requestAnimationFrame((t) => this.animate(t));
    }
}
