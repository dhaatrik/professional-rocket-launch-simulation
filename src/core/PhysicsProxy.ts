/**
 * Physics Proxy
 *
 * Main thread interface to the Physics Worker.
 * Handles:
 * - Worker instantiation
 * - Message passing (commands -> worker, state <- worker)
 * - State synchronization (keeping main thread entities in sync)
 */

import { Vessel } from '../physics/Vessel';
// We need the classes to instantiate "view" copies
import { FullStack, Booster, UpperStage, Fairing, Payload } from '../physics/RocketComponents';
import {
    BUFFER_SIZE,
    HEADER_SIZE,
    ENTITY_STRIDE,
    HeaderOffset,
    EntityOffset,
    EntityType,
    EngineStateCode
} from './PhysicsBuffer';

export interface PhysicsState {
    missionTime: number; // From Payload or Buffer
    trackedIndex: number;
    fts?: any;
    // entities removed from payload
}

export interface PhysicsProxyConfig {
    width?: number;
    height?: number;
    groundY?: number;
}

export class PhysicsProxy {
    private worker: Worker;
    private latestState: PhysicsState | null = null;

    // Shared Memory
    private sharedBuffer: SharedArrayBuffer;
    private sharedView: Float64Array;

    // Mapping from index/ID to local view instance
    private viewEntities: Vessel[] = [];

    private eventListeners: ((event: any) => void)[] = [];

    // Interpolation state
    private currentPhysicsTime: number = 0;
    private previousPhysicsTime: number = 0;
    private localRenderTime: number = 0;
    private firstSync: boolean = true;

    constructor() {
        // Initialize Shared Buffer
        // 8 bytes per float
        try {
            this.sharedBuffer = new SharedArrayBuffer(BUFFER_SIZE * 8);
        } catch (e) {
            console.error('SharedArrayBuffer not supported! Ensure COOP/COEP headers are set.');
            throw e;
        }
        this.sharedView = new Float64Array(this.sharedBuffer);

        // Use ES module worker syntax
        this.worker = new Worker(new URL('./physics.worker.js', import.meta.url), { type: 'module' });

        this.worker.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'STATE') {
                this.latestState = payload;
                // syncView is now called by Game.ts
            } else if (type === 'EVENT') {
                this.handleEvent(payload);
            }
        };

        this.worker.onerror = (e) => {
            console.error('Physics Worker Error:', e);
        };
    }

    init(config: PhysicsProxyConfig) {
        // Send buffer to worker
        this.worker.postMessage({
            type: 'INIT',
            payload: {
                ...config,
                sharedBuffer: this.sharedBuffer
            }
        });
    }

    step(dt: number, inputs: any) {
        this.worker.postMessage({ type: 'STEP', payload: { dt, ...inputs } });
    }

    command(type: string, payload: any) {
        this.worker.postMessage({ type: 'COMMAND', payload: { type, ...payload } });
    }

    getEntities(): Vessel[] {
        return this.viewEntities;
    }

    getMissionTime(): number {
        return this.sharedView ? this.sharedView[HeaderOffset.TIMESTAMP] || 0 : 0;
    }

    getTrackedIndex(): number {
        return this.latestState ? this.latestState.trackedIndex : 0;
    }

    getFTSStatus(): any {
        return this.latestState ? this.latestState.fts : { state: 'SAFE', armTime: 0, enabled: true };
    }

    getEnvironmentState(): any {
        if (!this.sharedView) return null;

        // Construct from buffer
        const wx = this.sharedView[HeaderOffset.WIND_X] || 0;
        const wy = this.sharedView[HeaderOffset.WIND_Y] || 0;

        return {
            windVelocity: {
                x: wx,
                y: wy
            },
            densityMultiplier: this.sharedView[HeaderOffset.DENSITY_MULT] || 1,
            // Other fields might be missing if relying solely on buffer,
            // but these are the critical ones for per-frame physics visualization
            surfaceWindSpeed: Math.sqrt(wx * wx + wy * wy),
            surfaceWindDirection: Math.atan2(wy, wx),
            timeOfDay: 0, // Not in buffer yet, acceptable fallback
            isLaunchSafe: true,
            maxQWindWarning: false
        };
    }

    getFlightComputerStatus(): any {
        return (this.latestState as any)?.fc || { status: 'FC: ---', command: '' };
    }

    onEvent(callback: (event: any) => void) {
        this.eventListeners.push(callback);
    }

    private handleEvent(event: any) {
        this.eventListeners.forEach((cb) => cb(event));
    }

    public syncView(dt: number, timeScale: number) {
        if (!this.sharedView) return;

        if (!this.firstSync) {
            this.localRenderTime += dt * timeScale;
        }

        const workerTime = this.sharedView[HeaderOffset.TIMESTAMP] || 0;

        if (workerTime > this.currentPhysicsTime || this.firstSync) {
            this.firstSync = false;
            this.previousPhysicsTime = this.currentPhysicsTime;
            this.currentPhysicsTime = workerTime;

            if (this.localRenderTime < this.previousPhysicsTime || this.localRenderTime > this.currentPhysicsTime) {
                this.localRenderTime = this.previousPhysicsTime;
            }

            const entityCount = this.sharedView[HeaderOffset.ENTITY_COUNT] || 0;

            // Resize view array
            while (this.viewEntities.length > entityCount) {
                this.viewEntities.pop();
            }

            for (let i = 0; i < entityCount; i++) {
                const base = HEADER_SIZE + i * ENTITY_STRIDE;
                const typeCode = this.sharedView[base + EntityOffset.TYPE] || 0;

                let view = this.viewEntities[i];

                // Check if view exists and matches type
                if (!view || view.type !== typeCode) {
                    view = this.createViewEntity(typeCode, 0, 0);
                    view.prevX = this.sharedView[base + EntityOffset.X] || 0;
                    view.prevY = this.sharedView[base + EntityOffset.Y] || 0;
                    view.prevAngle = this.sharedView[base + EntityOffset.ANGLE] || 0;
                    this.viewEntities[i] = view;
                } else {
                    view.prevX = view.x;
                    view.prevY = view.y;
                    view.prevAngle = view.angle;
                }

                // Sync properties
                view.x = this.sharedView[base + EntityOffset.X] || 0;
                view.y = this.sharedView[base + EntityOffset.Y] || 0;
                view.vx = this.sharedView[base + EntityOffset.VX] || 0;
                view.vy = this.sharedView[base + EntityOffset.VY] || 0;
                view.angle = this.sharedView[base + EntityOffset.ANGLE] || 0;
                view.throttle = this.sharedView[base + EntityOffset.THROTTLE] || 0;
                view.gimbalAngle = this.sharedView[base + EntityOffset.GIMBAL] || 0;
                view.fuel = this.sharedView[base + EntityOffset.FUEL] || 0;
                view.active = this.sharedView[base + EntityOffset.ACTIVE] === 1;

                view.w = this.sharedView[base + EntityOffset.WIDTH] || 0;
                view.h = this.sharedView[base + EntityOffset.HEIGHT] || 0;
                view.crashed = this.sharedView[base + EntityOffset.CRASHED] === 1;
                view.mass = this.sharedView[base + EntityOffset.MASS] || 0;
                view.apogee = this.sharedView[base + EntityOffset.APOGEE] || 0;

                // Specifics
                view.skinTemp = this.sharedView[base + EntityOffset.SKIN_TEMP] || 0;
                view.heatShieldRemaining = this.sharedView[base + EntityOffset.HEAT_SHIELD] || 0;
                view.isAblating = this.sharedView[base + EntityOffset.ABLATING] === 1;
                view.aoa = this.sharedView[base + EntityOffset.AOA] || 0;
                view.stabilityMargin = this.sharedView[base + EntityOffset.STABILITY_MARGIN] || 0;
                view.isAeroStable = this.sharedView[base + EntityOffset.IS_AERO_STABLE] === 1;

                if (typeCode === EntityType.UPPER_STAGE) {
                    (view as any).fairingsDeployed = this.sharedView[base + EntityOffset.FAIRING_DEP] === 1;
                }

                const engStateCode = this.sharedView[base + EntityOffset.ENGINE_STATE] || 0;
                (view as any).engineState = this.mapEngineStateCode(engStateCode);
                (view as any).ignitersRemaining = this.sharedView[base + EntityOffset.IGNITERS] || 0;
            }
        }
    }

    public getInterpolationAlpha(): number {
        if (this.currentPhysicsTime === this.previousPhysicsTime) return 1.0;
        const alpha =
            (this.localRenderTime - this.previousPhysicsTime) / (this.currentPhysicsTime - this.previousPhysicsTime);
        return Math.max(0, Math.min(1, alpha));
    }

    private mapEngineStateCode(code: number): string {
        switch (code) {
            case EngineStateCode.STARTING:
                return 'starting';
            case EngineStateCode.RUNNING:
                return 'running';
            case EngineStateCode.FLAMEOUT:
                return 'flameout';
            default:
                return 'off';
        }
    }

    private createViewEntity(typeCode: number, x: number, y: number): Vessel {
        switch (typeCode) {
            case EntityType.FULLSTACK:
                return new FullStack(x, y);
            case EntityType.BOOSTER:
                return new Booster(x, y);
            case EntityType.UPPER_STAGE:
                return new UpperStage(x, y);
            case EntityType.FAIRING:
                return new Fairing(x, y);
            case EntityType.PAYLOAD:
                return new Payload(x, y);
            default:
                return new FullStack(x, y);
        }
    }

    terminate() {
        this.worker.terminate();
    }
}
