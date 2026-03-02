// Physics Worker
// Handles the physics simulation loop

import { FullStack, Booster, UpperStage, Fairing, Payload } from '../physics/RocketComponents';
import { Vessel } from '../physics/Vessel';
import { EnvironmentSystem } from '../physics/Environment';
import { FlightTerminationSystem, FTSStatus } from '../safety/FlightTermination';
import { FaultInjector } from '../safety/FaultInjector';
import { FlightComputer } from '../guidance/FlightComputer';
import { STAGING_CONFIG } from '../config/Constants';
import { HEADER_SIZE, ENTITY_STRIDE, HeaderOffset, EntityOffset, EngineStateCode, EntityType } from './PhysicsBuffer';
import { state, setWindVelocity, setDensityMultiplier, updateDimensions } from './State';

// State
let entities: Vessel[] = [];
let missionTime = 0;
const fts = new FlightTerminationSystem();
const environment = new EnvironmentSystem();
const faultInjector = new FaultInjector();
let flightComputer: FlightComputer;
let groundY = 1000;

// Active vessel tracking (index or ref)
let trackedIndex = 0;

// Shared Memory
let sharedView: Float64Array | null = null;

// Debounce state for staging
let prevStageInput = false;

// Reusable state objects to prevent allocation
const ftsStatus: FTSStatus = {
    state: 'SAFE',
    armed: false,
    violation: 'NONE',
    violationMessage: '',
    warningTimer: 0,
    armTimer: 0,
    corridorFraction: 0
};
const fcStatus = {
    status: 'FC: ---',
    command: ''
};
const statePayload = {
    missionTime: 0,
    trackedIndex: 0,
    fts: ftsStatus,
    fc: fcStatus
};
const stateMessage = {
    type: 'STATE',
    payload: statePayload
};

// Constants
const FIXED_DT = 0.02;
const EMPTY_KEYS = Object.freeze({});

export interface PhysicsWorkerConfig {
    width?: number;
    height?: number;
    groundY?: number;
    sharedBuffer?: SharedArrayBuffer;
}

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT':
            init(payload || {});
            break;
        case 'STEP':
            step(payload);
            break;
        case 'COMMAND':
            handleCommand(payload);
            break;
    }
};

function init(config: PhysicsWorkerConfig) {
    entities = [];
    missionTime = 0;
    trackedIndex = 0;

    const width = config.width || 1920;
    groundY = config.groundY || 1000;
    updateDimensions(config.width || 1920, config.height || 1080, groundY);

    // Initialize Shared Buffer View
    if (config.sharedBuffer) {
        sharedView = new Float64Array(config.sharedBuffer);
    } else {
        console.warn('Worker received no SharedArrayBuffer!');
    }

    // Init Logic Systems
    flightComputer = new FlightComputer(groundY);

    // Hook up FC callbacks
    flightComputer.onStage = () => {
        performStaging();
    };

    // Create initial rocket
    const rocket = new FullStack(width / 2, groundY - 160);
    entities.push(rocket);

    fts.reset();
    fts.setLaunchPosition(rocket.x);
    environment.reset();
    faultInjector.reset();

    postState();
}

function step(inputs: any) {
    const dt = inputs.dt || FIXED_DT;
    const timeScale = inputs.timeScale || 1;
    const substeps = Math.ceil(timeScale);
    const simDt = (dt * timeScale) / substeps;

    for (let stepIdx = 0; stepIdx < substeps; stepIdx++) {
        // 1. Update Environment
        environment.update(simDt);
        const wind = environment.getWindAtAltitude(0);
        setWindVelocity({ x: wind.x + environment.getCurrentGust().x, y: wind.y + environment.getCurrentGust().y });
        setDensityMultiplier(environment.getDensityMultiplier());

        // 2. Apply Controls
        const v = entities[trackedIndex];
        if (v) {
            // Base manual controls
            if (inputs.controls) {
                v.throttle = inputs.controls.throttle;
                // Gimbal is cumulative or absolute? Game.ts sends absolute gimbalAngle
                v.gimbalAngle = inputs.controls.gimbalAngle;

                if (inputs.controls.ignition) {
                    v.active = true;
                    if (v.engineState === 'off') {
                        v.engineState = 'starting';
                    }
                }
                if (inputs.controls.cutoff) {
                    v.active = false;
                }
                // Only trigger stage on the first substep if commanded
                if (inputs.controls.stage && !prevStageInput && stepIdx === 0) {
                    performStaging();
                }
            }

            // Flight Computer Override
            if (flightComputer && flightComputer.isActive()) {
                const fcOut = flightComputer.update(v, simDt);

                if (fcOut.throttle !== null) v.throttle = fcOut.throttle;
                if (fcOut.pitchAngle !== null) {
                    // Simple P-controller for gimbal to match pitch
                    // In Game.ts it was: gimbal = (target - current) * 2 clamped
                    const err = fcOut.pitchAngle - v.angle;
                    v.gimbalAngle = Math.max(-0.5, Math.min(0.5, err * 2));
                }
                if (fcOut.abort) {
                    v.throttle = 0;
                    v.active = false;
                    self.postMessage({ type: 'EVENT', payload: { name: 'ABORT' } });
                }
                // SAS mode is handled by SAS which FC might use,
                // but for now FC output sasMode is informational or used by SAS utils
            }
        }

        // 3. Physics Integration
        for (let i = 0; i < entities.length; i++) {
            const e = entities[i];
            if (e) {
                e.applyPhysics(simDt, EMPTY_KEYS);
            }
        }

        // 4. Fault Injector
        for (let i = 0; i < entities.length; i++) {
            const vessel = entities[i];
            if (vessel && vessel.reliability) {
                faultInjector.update(vessel, vessel.reliability, groundY, simDt);
            }
        }

        missionTime += simDt;
    }

    if (inputs.controls !== undefined) {
        prevStageInput = !!inputs.controls.stage;
    }

    postState();
}

function handleCommand(cmd: any) {
    switch (cmd.type) {
        case 'STAGE':
            performStaging();
            break;
        case 'FC_LOAD_SCRIPT': {
            const result = flightComputer.loadScript(cmd.script);
            self.postMessage({
                type: 'EVENT',
                payload: {
                    name: 'FC_SCRIPT_LOADED',
                    success: result.success,
                    errors: result.errors
                }
            });
            break;
        }
        case 'FC_START':
            flightComputer.activate();
            break;
        case 'FC_STOP':
            flightComputer.deactivate();
            break;
        case 'FC_PAUSE':
            flightComputer.togglePause();
            break;
    }
}

function performStaging() {
    const tracked = entities[trackedIndex];
    if (!tracked) return;

    if (tracked.type === EntityType.FULLSTACK) {
        // Sep S1
        entities = entities.filter((e) => e !== tracked);

        const booster = new Booster(tracked.x, tracked.y, tracked.vx, tracked.vy);
        booster.angle = tracked.angle;
        booster.fuel = tracked.fuel;
        booster.active = true;

        const upper = new UpperStage(
            tracked.x,
            tracked.y + STAGING_CONFIG.UPPER_STAGE_OFFSET_Y,
            tracked.vx,
            tracked.vy + STAGING_CONFIG.UPPER_STAGE_VELOCITY_Y
        );
        upper.angle = tracked.angle;
        upper.active = true;
        upper.throttle = 1.0;

        entities.push(booster);
        entities.push(upper);

        trackedIndex = entities.length - 1;

        self.postMessage({ type: 'EVENT', payload: { name: 'STAGING_S1', x: tracked.x, y: tracked.y } });
    } else if (tracked.type === EntityType.UPPER_STAGE) {
        const upper = tracked as UpperStage;
        if (!upper.fairingsDeployed) {
            upper.fairingsDeployed = true;

            const fL = new Fairing(
                upper.x - STAGING_CONFIG.FAIRING_OFFSET_X,
                upper.y + STAGING_CONFIG.FAIRING_OFFSET_Y,
                upper.vx - STAGING_CONFIG.FAIRING_VELOCITY_X,
                upper.vy,
                -1
            );
            fL.angle = upper.angle - STAGING_CONFIG.FAIRING_ANGLE_OFFSET;
            entities.push(fL);

            const fR = new Fairing(
                upper.x + STAGING_CONFIG.FAIRING_OFFSET_X,
                upper.y + STAGING_CONFIG.FAIRING_OFFSET_Y,
                upper.vx + STAGING_CONFIG.FAIRING_VELOCITY_X,
                upper.vy,
                1
            );
            fR.angle = upper.angle + STAGING_CONFIG.FAIRING_ANGLE_OFFSET;
            entities.push(fR);

            self.postMessage({ type: 'EVENT', payload: { name: 'FAIRING_SEP' } });
        } else {
            upper.active = false;
            upper.throttle = 0;

            const payload = new Payload(
                upper.x,
                upper.y + STAGING_CONFIG.PAYLOAD_OFFSET_Y,
                upper.vx,
                upper.vy + STAGING_CONFIG.PAYLOAD_VELOCITY_Y
            );
            payload.angle = upper.angle;
            entities.push(payload);

            trackedIndex = entities.length - 1;

            self.postMessage({ type: 'EVENT', payload: { name: 'PAYLOAD_SEP' } });
        }
    }

    postState();
}

function mapEngineState(state: string): number {
    switch (state) {
        case 'starting':
            return EngineStateCode.STARTING;
        case 'running':
            return EngineStateCode.RUNNING;
        case 'flameout':
            return EngineStateCode.FLAMEOUT;
        default:
            return EngineStateCode.OFF;
    }
}

function postState() {
    if (sharedView) {
        // 1. Header
        sharedView[HeaderOffset.TIMESTAMP] = missionTime;
        sharedView[HeaderOffset.ENTITY_COUNT] = entities.length;

        // Environment
        const baseWind = environment.getWindAtAltitude(0);
        const gust = environment.getCurrentGust();
        // At altitude 0, gustScale is 1.0, so total wind is base + gust
        sharedView[HeaderOffset.WIND_X] = baseWind.x + gust.x;
        sharedView[HeaderOffset.WIND_Y] = baseWind.y + gust.y;
        sharedView[HeaderOffset.DENSITY_MULT] = environment.getDensityMultiplier();

        // 2. Entities
        for (let i = 0; i < entities.length; i++) {
            const e = entities[i];
            // Ensure e is defined for safety
            if (!e) continue;

            const base = HEADER_SIZE + i * ENTITY_STRIDE;

            sharedView[base + EntityOffset.TYPE] = e.type;
            sharedView[base + EntityOffset.X] = e.x;
            sharedView[base + EntityOffset.Y] = e.y;
            sharedView[base + EntityOffset.VX] = e.vx;
            sharedView[base + EntityOffset.VY] = e.vy;
            sharedView[base + EntityOffset.ANGLE] = e.angle;
            sharedView[base + EntityOffset.THROTTLE] = e.throttle;
            sharedView[base + EntityOffset.GIMBAL] = e.gimbalAngle;
            sharedView[base + EntityOffset.FUEL] = e.fuel;
            sharedView[base + EntityOffset.ACTIVE] = e.active ? 1 : 0;

            sharedView[base + EntityOffset.ENGINE_STATE] = mapEngineState(e.engineState);
            sharedView[base + EntityOffset.IGNITERS] = e.ignitersRemaining || 0;

            sharedView[base + EntityOffset.WIDTH] = e.w;
            sharedView[base + EntityOffset.HEIGHT] = e.h;
            sharedView[base + EntityOffset.CRASHED] = e.crashed ? 1 : 0;

            sharedView[base + EntityOffset.SKIN_TEMP] = e.skinTemp;
            sharedView[base + EntityOffset.HEAT_SHIELD] = e.heatShieldRemaining;
            sharedView[base + EntityOffset.ABLATING] = e.isAblating ? 1 : 0;
            sharedView[base + EntityOffset.FAIRING_DEP] =
                e.type === EntityType.UPPER_STAGE && (e as UpperStage).fairingsDeployed ? 1 : 0;
            sharedView[base + EntityOffset.MASS] = e.mass;
            sharedView[base + EntityOffset.APOGEE] = e.apogee;
            sharedView[base + EntityOffset.AOA] = e.aoa;
            sharedView[base + EntityOffset.STABILITY_MARGIN] = e.stabilityMargin;
            sharedView[base + EntityOffset.IS_AERO_STABLE] = e.isAeroStable ? 1 : 0;
        }
    }

    // Post simplified state for main thread sync trigger and FTS/FC status
    statePayload.missionTime = missionTime;
    statePayload.trackedIndex = trackedIndex;

    // Update FTS status in place
    fts.writeStatus(ftsStatus);

    // Update FC status in place
    fcStatus.status = flightComputer ? flightComputer.getStatusString() : 'FC: ---';
    fcStatus.command = flightComputer ? flightComputer.getActiveCommandText() : '';

    // Send the reused object (cloned by postMessage)
    self.postMessage(stateMessage);
}
