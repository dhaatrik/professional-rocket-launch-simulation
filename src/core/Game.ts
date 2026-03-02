/**
 * Game
 *
 * Main game controller class.
 * Manages game loop, physics updates, rendering, and subsystems.
 */

import { CameraMode, MissionState, OrbitalElements, IVessel } from '../types';
import { VehicleBlueprint } from '../vab/VehicleBlueprint';
import {
    CONFIG,
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
import { MU } from '../physics/OrbitalMechanics';
import {
    state,
    updateDimensions,
    setAudioEngine,
    setMissionLog,
    setAssetLoader,
    addParticle,
    clearParticles
} from './State';
import { InputManager } from './InputManager';
import { AudioEngine } from '../utils/AudioEngine';
import { AssetLoader } from '../utils/AssetLoader';
import { SAS, SASModes } from '../utils/SAS';
import { MissionLog } from '../ui/MissionLog';
import { Navball } from '../ui/Navball';
import { TelemetrySystem } from '../ui/Telemetry';
import { Particle } from '../physics/Particle';
import { FullStack, Booster, UpperStage, Payload, Fairing } from '../physics/RocketComponents';
import { BlackBoxRecorder } from '../telemetry/BlackBoxRecorder';
import { EnvironmentSystem, EnvironmentState, formatTimeOfDay, getWindDirectionString } from '../physics/Environment';
import { setWindVelocity, setDensityMultiplier } from './State';
import { ManeuverPlanner } from '../ui/ManeuverPlanner';
import { MissionControl } from '../ui/MissionControl';
import { UI_COLORS } from '../ui/UIConstants';
import { FlightTerminationSystem } from '../safety/FlightTermination';
import { LaunchChecklist } from '../safety/LaunchChecklist';
import { FaultInjector } from '../safety/FaultInjector';
import { Vessel } from '../physics/Vessel';
import { PhysicsProxy } from './PhysicsProxy';
import { TelemetryTransmitter } from '../telemetry/TelemetryTransmitter';
import { ParticleSystem } from '../physics/ParticleSystem';

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

    // HUD state cache for minimizing DOM updates
    private lastHUDState = {
        // Environment
        windSpeed: -1,
        windDir: '',
        timeOfDay: '',
        launchStatus: '',
        maxQWarning: false,

        // Telemetry
        alt: '',
        vel: '',
        apogee: '',
        fuelPct: -1,
        thrustPct: -1,

        // Flight Data
        aoa: '',
        aoaColor: '',
        stability: '',
        stabilityColor: '',

        // TPS & Engine
        skinTemp: '',
        skinTempColor: '',
        tpsStatus: '',
        tpsStatusColor: '',
        engineStatus: '',
        engineStatusColor: '',
        igniters: -1,
        ignitersColor: '',

        // FTS
        ftsState: '',
        ftsStateColor: ''
    };

    // Sky Gradient Cache
    private skyGradientCache = {
        lastHeight: -1,
        lastStep: -1,
        gradient: null as CanvasGradient | null
    };

    // HUD element cache
    private hudWindSpeed: HTMLElement | null = null;
    private hudWindDir: HTMLElement | null = null;
    private hudTimeOfDay: HTMLElement | null = null;
    private hudLaunchStatus: HTMLElement | null = null;
    private hudMaxQ: HTMLElement | null = null;
    private hudAlt: HTMLElement | null = null;
    private hudVel: HTMLElement | null = null;
    private hudApogee: HTMLElement | null = null;
    private gaugeFuel: HTMLElement | null = null;
    private gaugeThrust: HTMLElement | null = null;
    private hudAoa: HTMLElement | null = null;
    private hudStability: HTMLElement | null = null;
    private hudSkinTemp: HTMLElement | null = null;
    private hudTpsStatus: HTMLElement | null = null;
    private hudEngineStatus: HTMLElement | null = null;
    private hudIgniters: HTMLElement | null = null;
    private hudFtsState: HTMLElement | null = null;

    // Pre-allocated buffers for wind rendering to avoid GC
    private _windLowBatch: number[] = [];
    private _windMedBatch: number[] = [];
    private _windHighBatch: number[] = [];
    private _windTextStrings: string[] = [];
    private _windTextX: number[] = [];
    private _windTextY: number[] = [];

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

        window.PIXELS_PER_METER = PIXELS_PER_METER;
        window.R_EARTH = R_EARTH;
        window.navball = this.navball;
        window.missionLog = this.missionLog;
        window.audio = this.audio;

        this.initHUDCache();
    }

    /**
     * Initialize HUD element cache
     */
    private initHUDCache(): void {
        this.hudWindSpeed = document.getElementById('hud-wind-speed');
        this.hudWindDir = document.getElementById('hud-wind-dir');
        this.hudTimeOfDay = document.getElementById('hud-time-of-day');
        this.hudLaunchStatus = document.getElementById('hud-launch-status');
        this.hudMaxQ = document.getElementById('hud-maxq-warning');
        this.hudAlt = document.getElementById('hud-alt');
        this.hudVel = document.getElementById('hud-vel');
        this.hudApogee = document.getElementById('hud-apogee');
        this.gaugeFuel = document.getElementById('gauge-fuel');
        this.gaugeThrust = document.getElementById('gauge-thrust');
        this.hudAoa = document.getElementById('hud-aoa');
        this.hudStability = document.getElementById('hud-stability');
        this.hudSkinTemp = document.getElementById('hud-skin-temp');
        this.hudTpsStatus = document.getElementById('hud-tps-status');
        this.hudEngineStatus = document.getElementById('hud-engine-status');
        this.hudIgniters = document.getElementById('hud-igniters');
        this.hudFtsState = document.getElementById('hud-fts-state');
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
    spawnVessel(blueprint: VehicleBlueprint): void {
        console.log('Spawning blueprint:', blueprint?.name);
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
    private physicsEventListeners: ((e: any) => void)[] = [];

    public addPhysicsEventListener(callback: (e: any) => void): void {
        this.physicsEventListeners.push(callback);
    }

    /**
     * Send a command to the physics worker (e.g. Flight Computer)
     */
    public command(type: string, payload: any): void {
        this.physics.command(type, payload);
    }

    /**
     * Get Flight Computer status from Physics Worker
     */
    public getFlightComputerStatus(): any {
        return this.physics.getFlightComputerStatus();
    }

    /**
     * Handle events from physics worker
     */
    private handlePhysicsEvent(e: any): void {
        // Dispatch to listeners
        this.physicsEventListeners.forEach((cb) => cb(e));

        if (e.name === 'STAGING_S1') {
            this.missionLog.log('STAGING: S1 SEP', 'warn');
            this.audio.playStaging();

            // Create staging particles (Visual only)
            for (let i = 0; i < 30; i++) {
                addParticle(
                    Particle.create(
                        e.x + (Math.random() - 0.5) * 20,
                        e.y + 80,
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

    /**
     * Physics update
     */
    private updatePhysics(dt: number): void {
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

        const controls = {
            throttle,
            gimbalAngle,
            stage,
            abort,
            // Explicitly signal active state change
            ignition: this.commandThrottle > 0,
            cutoff: this.commandThrottle === 0
        };

        // Step Physics logic in Worker
        this.physics.step(dt, { timeScale: this.timeScale, controls });

        // Update references
        const trackedIdx = this.physics.getTrackedIndex();
        this.trackedEntity = this.entities[trackedIdx] || null;
        this.mainStack = this.trackedEntity; // Simplified assumption

        // Sync globals for legacy/UI
        state.entities = this.entities as any;
        window.trackedEntity = this.trackedEntity;
        window.mainStack = this.mainStack;

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

            setWindVelocity(envState.windVelocity);
            setDensityMultiplier(envState.densityMultiplier);
            this.lastEnvState = envState;
        } else {
            this.lastEnvState = this.environment.getState(0);
        }

        // Update Mission Control
        this.missionControl.update(dt * this.timeScale, this.missionTime);

        // Mission events
        if (this.trackedEntity) {
            const alt = (this.groundY - this.trackedEntity.y - this.trackedEntity.h) / PIXELS_PER_METER;

            // Audio update
            const vel = Math.sqrt(this.trackedEntity.vx ** 2 + this.trackedEntity.vy ** 2);
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

        // Sync globals
        window.trackedEntity = this.trackedEntity;
        window.mainStack = this.mainStack;

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

                let pathIdx = 0;
                const path = e.orbitPath;
                e.lastOrbitUpdate = now;

                // Initial State for RK4
                const r0 = R_EARTH + alt;
                // phi is x / R_EARTH (radians around earth)
                const phi0 = e.x / R_EARTH;

                // State vector: [r, phi, vr, vphi]
                // vr = radial velocity (positive up) = -e.vy
                // vphi = tangential velocity = e.vx
                let r = r0;
                let phi = phi0;
                let vr = -e.vy;
                let vphi = e.vx;

                const dtPred = 5.0; // 5s steps (Optimized from 1s)
                const maxSteps = 400; // 2000s prediction horizon (400 * 5)

                // Store start point
                if (pathIdx < path.length) {
                    const p = path[pathIdx]!;
                    p.phi = phi;
                    p.r = r;
                    p.relX = Math.sin(phi) * r;
                    p.relY = -Math.cos(phi) * r;
                } else {
                    path.push({
                        phi: phi,
                        r: r,
                        relX: Math.sin(phi) * r,
                        relY: -Math.cos(phi) * r
                    });
                }
                pathIdx++;

                const dtHalf = dtPred * 0.5;
                const dtSixth = dtPred / 6.0;

                // Optimized RK4 Integrator - Inlined to avoid object allocation
                // Further optimized with algebraic simplification to reduce divisions
                for (let j = 0; j < maxSteps; j++) {
                    // k1
                    const inv_r = 1.0 / r;
                    const k1_dphi = vphi * inv_r;
                    const g1 = MU * inv_r * inv_r;
                    const k1_dvr = vphi * k1_dphi - g1;
                    const k1_dvphi = -vr * k1_dphi;
                    const k1_dr = vr;

                    // k2
                    const r_k2 = r + k1_dr * dtHalf;
                    const inv_r_k2 = 1.0 / r_k2;
                    const vr_k2 = vr + k1_dvr * dtHalf;
                    const vphi_k2 = vphi + k1_dvphi * dtHalf;

                    const k2_dphi = vphi_k2 * inv_r_k2;
                    const g2 = MU * inv_r_k2 * inv_r_k2;
                    const k2_dvr = vphi_k2 * k2_dphi - g2;
                    const k2_dvphi = -vr_k2 * k2_dphi;
                    const k2_dr = vr_k2;

                    // k3
                    const r_k3 = r + k2_dr * dtHalf;
                    const inv_r_k3 = 1.0 / r_k3;
                    const vr_k3 = vr + k2_dvr * dtHalf;
                    const vphi_k3 = vphi + k2_dvphi * dtHalf;

                    const k3_dphi = vphi_k3 * inv_r_k3;
                    const g3 = MU * inv_r_k3 * inv_r_k3;
                    const k3_dvr = vphi_k3 * k3_dphi - g3;
                    const k3_dvphi = -vr_k3 * k3_dphi;
                    const k3_dr = vr_k3;

                    // k4
                    const r_k4 = r + k3_dr * dtPred;
                    const inv_r_k4 = 1.0 / r_k4;
                    const vr_k4 = vr + k3_dvr * dtPred;
                    const vphi_k4 = vphi + k3_dvphi * dtPred;

                    const k4_dphi = vphi_k4 * inv_r_k4;
                    const g4 = MU * inv_r_k4 * inv_r_k4;
                    const k4_dvr = vphi_k4 * k4_dphi - g4;
                    const k4_dvphi = -vr_k4 * k4_dphi;
                    const k4_dr = vr_k4;

                    // Update State
                    r += (k1_dr + 2 * k2_dr + 2 * k3_dr + k4_dr) * dtSixth;
                    phi += (k1_dphi + 2 * k2_dphi + 2 * k3_dphi + k4_dphi) * dtSixth;
                    vr += (k1_dvr + 2 * k2_dvr + 2 * k3_dvr + k4_dvr) * dtSixth;
                    vphi += (k1_dvphi + 2 * k2_dvphi + 2 * k3_dvphi + k4_dvphi) * dtSixth;

                    // Stop if hit ground
                    if (r <= R_EARTH) {
                        break;
                    }

                    // Store point (sparse) - Every 2 steps (10s)
                    if (j % 2 === 0) {
                        if (pathIdx < path.length) {
                            const p = path[pathIdx]!;
                            p.phi = phi;
                            p.r = r;
                            p.relX = Math.sin(phi) * r;
                            p.relY = -Math.cos(phi) * r;
                        } else {
                            path.push({
                                phi: phi,
                                r: r,
                                relX: Math.sin(phi) * r,
                                relY: -Math.cos(phi) * r
                            });
                        }
                        pathIdx++;
                    }
                }
                // Ensure final point is added
                if (pathIdx < path.length) {
                    const p = path[pathIdx]!;
                    p.phi = phi;
                    p.r = r;
                    p.relX = Math.sin(phi) * r;
                    p.relY = -Math.cos(phi) * r;
                } else {
                    path.push({
                        phi: phi,
                        r: r,
                        relX: Math.sin(phi) * r,
                        relY: -Math.cos(phi) * r
                    });
                }
                pathIdx++;

                // Trim excess points
                if (pathIdx < path.length) {
                    path.length = pathIdx;
                }
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

        // Batches for each color category (stores vertices)
        // Format: [x1, y1, x2, y2, ...]
        this._windLowBatch.length = 0;
        this._windMedBatch.length = 0;
        this._windHighBatch.length = 0;

        // Text batch: [speed, x, y] (SoA)
        this._windTextStrings.length = 0;
        this._windTextX.length = 0;
        this._windTextY.length = 0;

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
                    if (speed < 10) this._windLowBatch.push(tx, ty);
                    else if (speed < 30) this._windMedBatch.push(tx, ty);
                    else this._windHighBatch.push(tx, ty);
                }

                // Add text info (offset by 10, 15 relative to arrow center)
                this._windTextStrings.push(`${speed.toFixed(0)} m/s`);
                this._windTextX.push(screenX + 10);
                this._windTextY.push(screenY + 15);
            }
        }

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
            this.cameraShakeX = (Math.random() - 0.5) * shake;
            this.cameraShakeY = (Math.random() - 0.5) * shake;
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
            const minCamY = this.groundY - (this.height - 50) / this.ZOOM;

            // Interpolate
            const diff = targetCamY - this.cameraY;
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
        this.updateEnvironmentHUD();

        if (!this.trackedEntity) return;

        const velAngle = Math.atan2(this.trackedEntity.vx, -this.trackedEntity.vy);
        this.navball.draw(this.trackedEntity.angle, velAngle);

        this.updateFlightDataHUD();
        this.updateThermalHUD();
        this.updatePropulsionHUD();
        this.updateFTSHUD();
    }

    private updateEnvironmentHUD(): void {
        const envState = this.lastEnvState;
        const last = this.lastHUDState;

        if (envState) {
            const hudWindSpeed = this.hudWindSpeed;
            if (hudWindSpeed) {
                const speed = Math.round(envState.surfaceWindSpeed);
                if (last.windSpeed !== speed) {
                    last.windSpeed = speed;
                    hudWindSpeed.textContent = speed + ' m/s';

                    // Color coding based on wind limits
                    if (speed > 15) {
                        hudWindSpeed.style.color = UI_COLORS.RED;
                    } else if (speed > 10) {
                        hudWindSpeed.style.color = UI_COLORS.YELLOW;
                    } else {
                        hudWindSpeed.style.color = UI_COLORS.GREEN;
                    }
                }
            }

            const hudWindDir = this.hudWindDir;
            if (hudWindDir) {
                const dirStr = getWindDirectionString(envState.surfaceWindDirection);
                if (last.windDir !== dirStr) {
                    last.windDir = dirStr;
                    hudWindDir.textContent = dirStr;
                }
            }

            const hudTimeOfDay = this.hudTimeOfDay;
            if (hudTimeOfDay) {
                const timeStr = formatTimeOfDay(envState.timeOfDay);
                if (last.timeOfDay !== timeStr) {
                    last.timeOfDay = timeStr;
                    hudTimeOfDay.textContent = timeStr;
                }
            }

            const hudLaunchStatus = this.hudLaunchStatus;
            if (hudLaunchStatus) {
                const statusStr = envState.isLaunchSafe ? 'GO' : 'NO GO';

                if (last.launchStatus !== statusStr) {
                    last.launchStatus = statusStr;
                    hudLaunchStatus.textContent = statusStr;

                    if (envState.isLaunchSafe) {
                        hudLaunchStatus.style.color = UI_COLORS.GREEN;
                        hudLaunchStatus.className = 'go-status';
                    } else {
                        hudLaunchStatus.style.color = UI_COLORS.RED;
                        hudLaunchStatus.className = 'no-go-status';
                    }
                }

                // Add Max-Q warning
                if (envState.maxQWindWarning !== last.maxQWarning) {
                    last.maxQWarning = envState.maxQWindWarning;
                    const hudMaxQ = this.hudMaxQ;
                    if (hudMaxQ) {
                        if (envState.maxQWindWarning) {
                            hudMaxQ.textContent = '⚠ HIGH WIND SHEAR';
                            hudMaxQ.style.display = 'block';
                        } else {
                            hudMaxQ.style.display = 'none';
                        }
                    }
                }
            }
        }
    }

    private updateFlightDataHUD(): void {
        if (!this.trackedEntity) return;
        const last = this.lastHUDState;

        const alt = (this.groundY - this.trackedEntity.y - this.trackedEntity.h) / PIXELS_PER_METER;
        const vel = Math.sqrt(this.trackedEntity.vx ** 2 + this.trackedEntity.vy ** 2);

        // Apogee estimate
        const g = 9.8;
        const apogeeEst = alt + (this.trackedEntity.vy < 0 ? this.trackedEntity.vy ** 2 / (2 * g) : 0);

        // Update DOM HUD
        const hudAlt = this.hudAlt;
        const hudVel = this.hudVel;
        const hudApogee = this.hudApogee;
        const gaugeFuel = this.gaugeFuel;
        const gaugeThrust = this.gaugeThrust;
        const hudAoa = this.hudAoa;
        const hudStability = this.hudStability;

        if (hudAlt) {
            const altStr = (alt / 1000).toFixed(1);
            if (last.alt !== altStr) {
                last.alt = altStr;
                hudAlt.textContent = altStr;
            }
        }

        if (hudVel) {
            const velStr = Math.floor(vel).toString();
            if (last.vel !== velStr) {
                last.vel = velStr;
                hudVel.textContent = velStr;
            }
        }

        if (hudApogee) {
            const apStr = (Math.max(alt, apogeeEst) / 1000).toFixed(1);
            if (last.apogee !== apStr) {
                last.apogee = apStr;
                hudApogee.textContent = apStr;
            }
        }

        if (gaugeFuel) {
            const fuelPct = this.trackedEntity.fuel;
            // Only update if changed by more than 0.001
            if (Math.abs(last.fuelPct - fuelPct) > 0.001) {
                last.fuelPct = fuelPct;
                gaugeFuel.style.height = fuelPct * 100 + '%';
            }
        }

        if (gaugeThrust) {
            const thrustPct = this.trackedEntity.throttle;
            if (Math.abs(last.thrustPct - thrustPct) > 0.001) {
                last.thrustPct = thrustPct;
                gaugeThrust.style.height = thrustPct * 100 + '%';
            }
        }

        // Aerodynamic stability display
        if (hudAoa) {
            const aoaDeg = Math.abs((this.trackedEntity.aoa * 180) / Math.PI);
            const aoaStr = aoaDeg.toFixed(1) + '°';

            if (last.aoa !== aoaStr) {
                last.aoa = aoaStr;
                hudAoa.textContent = aoaStr;

                // Color coding: green < 5°, yellow 5-15°, red > 15°
                let color = UI_COLORS.GREEN;
                if (aoaDeg > 15) {
                    color = UI_COLORS.RED;
                } else if (aoaDeg > 5) {
                    color = UI_COLORS.YELLOW;
                }

                if (last.aoaColor !== color) {
                    last.aoaColor = color;
                    hudAoa.style.color = color;
                }
            }
        }

        if (hudStability) {
            const margin = this.trackedEntity.stabilityMargin;
            let stabStr: string;
            let color: string;

            if (this.trackedEntity.isAeroStable) {
                stabStr = (margin * 100).toFixed(1) + '%';
                color = UI_COLORS.GREEN;
            } else {
                stabStr = 'UNSTABLE';
                color = UI_COLORS.RED;
            }

            if (last.stability !== stabStr) {
                last.stability = stabStr;
                hudStability.textContent = stabStr;
            }

            if (last.stabilityColor !== color) {
                last.stabilityColor = color;
                hudStability.style.color = color;
            }
        }
    }

    private updateThermalHUD(): void {
        if (!this.trackedEntity) return;
        const last = this.lastHUDState;

        // Thermal protection system display
        const hudSkinTemp = this.hudSkinTemp;
        const hudTpsStatus = this.hudTpsStatus;

        if (hudSkinTemp) {
            // Convert from Kelvin to Celsius
            const tempC = Math.round(this.trackedEntity.skinTemp - 273.15);
            const tempStr = tempC + '°C';

            if (last.skinTemp !== tempStr) {
                last.skinTemp = tempStr;
                hudSkinTemp.textContent = tempStr;

                let color = UI_COLORS.GREEN;
                // Color coding based on temperature ratio to max
                if (this.trackedEntity.isThermalCritical) {
                    color = UI_COLORS.RED; // Red - critical
                } else if (tempC > 400) {
                    color = UI_COLORS.ORANGE; // Orange - warning
                } else if (tempC > 200) {
                    color = UI_COLORS.YELLOW; // Yellow - elevated
                }

                if (last.skinTempColor !== color) {
                    last.skinTempColor = color;
                    hudSkinTemp.style.color = color;
                }
            }
        }

        if (hudTpsStatus) {
            const shieldPct = Math.round(this.trackedEntity.heatShieldRemaining * 100);
            let statusStr: string;
            let color: string;

            if (shieldPct > 0) {
                statusStr = shieldPct + '%';
                if (this.trackedEntity.isAblating) {
                    color = UI_COLORS.ORANGE; // Orange when ablating
                } else if (shieldPct < 30) {
                    color = UI_COLORS.RED; // Red when low
                } else {
                    color = UI_COLORS.GREEN; // Green
                }
            } else {
                statusStr = 'N/A';
                color = UI_COLORS.GRAY; // Gray when no TPS
            }

            if (last.tpsStatus !== statusStr) {
                last.tpsStatus = statusStr;
                hudTpsStatus.textContent = statusStr;
            }

            if (last.tpsStatusColor !== color) {
                last.tpsStatusColor = color;
                hudTpsStatus.style.color = color;
            }
        }
    }

    private updatePropulsionHUD(): void {
        if (!this.trackedEntity) return;
        const last = this.lastHUDState;

        // Propulsion system display
        const hudEngineStatus = this.hudEngineStatus;
        const hudIgniters = this.hudIgniters;

        if (hudEngineStatus) {
            const state = this.trackedEntity.engineState;
            let statusStr: string;
            let color: string;

            switch (state) {
                case 'off':
                    statusStr = 'OFF';
                    color = UI_COLORS.GRAY;
                    break;
                case 'starting':
                    statusStr = 'SPOOL';
                    color = UI_COLORS.YELLOW;
                    break;
                case 'running':
                    statusStr = 'RUN';
                    color = UI_COLORS.GREEN;
                    break;
                case 'shutdown':
                    statusStr = 'STOP';
                    color = UI_COLORS.ORANGE;
                    break;
            }

            if (last.engineStatus !== statusStr) {
                last.engineStatus = statusStr;
                hudEngineStatus.textContent = statusStr;
            }

            if (last.engineStatusColor !== color) {
                last.engineStatusColor = color;
                hudEngineStatus.style.color = color;
            }
        }

        if (hudIgniters) {
            const count = this.trackedEntity.ignitersRemaining;
            if (last.igniters !== count) {
                last.igniters = count;
                hudIgniters.textContent = count.toString();

                let color: string;
                if (count === 0) {
                    color = UI_COLORS.RED; // Red - no restarts
                } else if (count === 1) {
                    color = UI_COLORS.ORANGE; // Orange - last one
                } else {
                    color = UI_COLORS.GREEN; // Green
                }

                if (last.ignitersColor !== color) {
                    last.ignitersColor = color;
                    hudIgniters.style.color = color;
                }
            }
        }
    }

    private updateFTSHUD(): void {
        const last = this.lastHUDState;

        // FTS Status display
        const hudFtsState = this.hudFtsState;
        if (hudFtsState) {
            const ftsStatus = this.fts.getStatus();
            let ftsStr: string = ftsStatus.state;
            let ftsColor = '';

            switch (ftsStatus.state) {
                case 'SAFE':
                    ftsColor = UI_COLORS.GREEN;
                    break;
                case 'WARNING':
                    ftsStr = `WARN ${(this.fts.config.warningDurationS - ftsStatus.warningTimer).toFixed(0)}s`;
                    ftsColor = UI_COLORS.YELLOW;
                    break;
                case 'ARM':
                    ftsStr = ftsStatus.armed ? 'ARMED' : 'ARM';
                    ftsColor = UI_COLORS.ORANGE;
                    break;
                case 'DESTRUCT':
                    ftsStr = 'DESTRUCT';
                    ftsColor = UI_COLORS.RED;
                    break;
            }

            if (last.ftsState !== ftsStr) {
                last.ftsState = ftsStr;
                hudFtsState.textContent = ftsStr;
            }

            if (last.ftsStateColor !== ftsColor) {
                last.ftsStateColor = ftsColor;
                hudFtsState.style.color = ftsColor;
            }
        }
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
                velocity: Math.sqrt(this.trackedEntity.vx ** 2 + this.trackedEntity.vy ** 2),
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
