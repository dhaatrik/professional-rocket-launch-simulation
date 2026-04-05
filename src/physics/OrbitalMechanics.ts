/**
 * Orbital Mechanics Module
 *
 * Provides physics calculations for orbital maneuvers and trajectory planning.
 * Includes Keplerian element calculation, Vis-Viva equation, and maneuver planning algorithms.
 */

import type { Vector2D } from '../types/index';
import { Vec2 } from '../types/index';
import { R_EARTH, GRAVITY } from '../config/Constants';

// Standard gravitational parameter for Earth (mu = GM)
// G = 6.67430e-11, M = 5.972e24 => mu ≈ 3.986e14 m^3/s^2
// Using simulated values from constants for consistency:
// R_EARTH = 6371000m, GRAVITY = 9.8m/s^2 (at surface)
// mu = g0 * R^2
export const MU = GRAVITY * R_EARTH * R_EARTH;

/**
 * Launch Site Configuration
 */
export const LAUNCH_SITE = {
    name: 'Cape Canaveral',
    lat: 28.5 * (Math.PI / 180), // Radians
    lon: -80.5 * (Math.PI / 180), // Radians
    azimuth: 90 * (Math.PI / 180) // Radians (Due East)
};

/**
 * Calculated orbital elements from state vector
 */
export interface KeplerianElements {
    /** Semi-major axis (meters) - negative for hyperbolas */
    semiMajorAxis: number;
    /** Eccentricity (dimensionless) */
    eccentricity: number;
    /** Apoapsis altitude (meters) */
    apoapsis: number;
    /** Periapsis altitude (meters) */
    periapsis: number;
    /** True anomaly (radians) */
    trueAnomaly: number;
    /** Period (seconds) */
    period: number;
    /** Specific orbital energy (J/kg) */
    specificEnergy: number;
}

/**
 * Maneuver plan result
 */
export interface ManeuverPlan {
    /** Required Delta-V (m/s) */
    deltaV: number;
    /** Estimated burn time (seconds) */
    burnTime: number;
    /** Description of the maneuver */
    description: string;
    /** Target orbit parameters */
    targetOrbit: {
        apoapsis: number;
        periapsis: number;
    };
}

/**
 * Calculate orbital elements from state vectors
 * @param r Position vector relative to center of Earth (meters)
 * @param v Velocity vector (m/s)
 */
export function calculateOrbitalElements(r: Vector2D, v: Vector2D): KeplerianElements {
    const rMag = Vec2.magnitude(r);
    const vMag = Vec2.magnitude(v); // Speed relative to Earth center

    // 1. Specific Angular Momentum (h = r x v) in 2D
    //For 2D, we treat as scalar h = x*vy - y*vx
    const h = r.x * v.y - r.y * v.x;

    // 2. Specific Orbital Energy (E = v^2/2 - mu/r)
    const E = (vMag * vMag) / 2 - MU / rMag;

    // 3. Semi-major axis (a = -mu / 2E)
    // For parabolas (E=0), a is infinite
    const a = Math.abs(E) < 1e-10 ? Infinity : -MU / (2 * E);

    // 4. Eccentricity vector (e_vec = (v x h)/mu - r/r)
    // Simplified for magnitude: e = sqrt(1 + 2Eh^2/mu^2)
    let e: number;
    if (a !== Infinity) {
        e = Math.sqrt(Math.max(0, 1 + (2 * E * h * h) / (MU * MU)));
    } else {
        e = 1; // Parabolic
    }

    // 5. Apoapsis and Periapsis radii
    const rp = a === Infinity ? (h * h) / (2 * MU) : a * (1 - e);
    const ra = a === Infinity ? Infinity : a * (1 + e);

    // Altitudes (subtract Earth radius)
    const periapsisAlt = rp - R_EARTH;
    const apoapsisAlt = ra === Infinity ? Infinity : ra - R_EARTH;

    // 6. True Anomaly (angle from periapsis)
    // difficult in 2D without argument of periapsis. Simplified:
    // angle between e_vec and r_vec.
    // For now, return angle of position vector relative to some reference if needed
    // or calc via: cos(nu) = (a(1-e^2)/r - 1) / e
    let trueAnomaly = 0;
    if (e > 1e-6) {
        const cosNu = ((a * (1 - e * e)) / rMag - 1) / e;
        // Clamp to [-1, 1] for acos
        trueAnomaly = Math.acos(Math.max(-1, Math.min(1, cosNu)));
        // Check sign using flight path angle (v dot r)
        if (Vec2.dot(r, v) < 0) {
            trueAnomaly = 2 * Math.PI - trueAnomaly;
        }
    }

    // 7. Period (T = 2*pi*sqrt(a^3/mu))
    const period = calculateOrbitalPeriod(a);

    return {
        semiMajorAxis: a,
        eccentricity: e,
        apoapsis: apoapsisAlt,
        periapsis: periapsisAlt,
        trueAnomaly,
        period,
        specificEnergy: E
    };
}

/**
 * Calculate velocity required at a given radius for a specific semi-major axis
 * Vis-Viva Equation: v^2 = GM * (2/r - 1/a)
 * @param r Current radius from center of Earth (m)
 * @param a Target semi-major axis (m)
 * @returns Velocity (m/s)
 */
export function calculateVisViva(r: number, a: number): number {
    return Math.sqrt(MU * (2 / r - 1 / a));
}

/**
 * Calculate velocity for a circular orbit at specific radius
 * @param r Radius from center of Earth (m)
 */
export function calculateCircularVelocity(r: number): number {
    return Math.sqrt(MU / r);
}

/**
 * Calculate orbital period for a given semi-major axis
 * @param a Semi-major axis (m)
 */
export function calculateOrbitalPeriod(a: number): number {
    return 2 * Math.PI * Math.sqrt(Math.max(0, Math.pow(a, 3)) / MU);
}

/**
 * Calculate Hohmann Transfer parameters
 * @param r1 Radius of initial circular orbit
 * @param r2 Radius of target circular orbit
 * @returns Maneuver plan including both burns
 */
export function calculateHohmannTransfer(
    r1: number,
    r2: number,
    thrust: number,
    mass: number
): { deltaV1: number; deltaV2: number; transferTime: number; burnTime1: number } {
    // 1. Semi-major axis of transfer orbit
    const aTransfer = (r1 + r2) / 2;

    // 2. Initial velocity (v1) for circular orbit at r1
    const v1 = calculateCircularVelocity(r1);

    // 3. Transfer velocity (vTransfer1) at periapsis/apoapsis (at r1)
    const vTransfer1 = calculateVisViva(r1, aTransfer);

    // 4. First Burn Delta-V
    const deltaV1 = Math.abs(vTransfer1 - v1);

    // 5. Final velocity (v2) for circular orbit at r2
    const v2 = calculateCircularVelocity(r2);

    // 6. Transfer velocity (vTransfer2) at arrival (at r2)
    const vTransfer2 = calculateVisViva(r2, aTransfer);

    // 7. Second Burn Delta-V
    const deltaV2 = Math.abs(v2 - vTransfer2);

    // 8. Transfer Time (half period)
    // T = 2*pi * sqrt(a^3 / mu)
    const transferTime = calculateOrbitalPeriod(aTransfer) / 2;

    // 9. Estimate initial burn time
    const burnTime1 = (deltaV1 * mass) / Math.max(1, thrust);

    return { deltaV1, deltaV2, transferTime, burnTime1 };
}

/**
 * Calculate Circularization Burn from known orbital elements
 * @param elements Keplerian elements
 * @param atApoapsis True to circularize at apoapsis (raise periapsis), False for periapsis (lower apoapsis)
 * @param thrust Force (N)
 * @param mass Vehicle mass (kg)
 */
export function calculateCircularizationFromElements(
    elements: KeplerianElements,
    atApoapsis: boolean,
    thrust: number,
    mass: number
): ManeuverPlan {
    // Current orbital radii
    // Be careful with valid numbers if orbit is hyperbolic
    const ra = elements.apoapsis + R_EARTH;
    const rp = elements.periapsis + R_EARTH;
    const a = elements.semiMajorAxis;

    // Radius where burn occurs
    const rBurn = atApoapsis ? ra : rp;

    // Velocity at that point in CURRENT orbit
    const vCurrent = calculateVisViva(rBurn, a);

    // Target velocity for CIRCULAR orbit at that radius
    const vTarget = calculateCircularVelocity(rBurn);

    // Delta-V required
    const deltaV = Math.abs(vTarget - vCurrent);

    // Estimate burn time: t = (m * dv) / F
    const burnTime = (deltaV * mass) / Math.max(1, thrust);

    const label = atApoapsis ? 'Circularize at Apoapsis' : 'Circularize at Periapsis';
    // Target altitude is the altitude of the burn point (since we circularize there)
    const targetAlt = rBurn - R_EARTH;

    return {
        deltaV,
        burnTime,
        description: label,
        targetOrbit: {
            apoapsis: targetAlt,
            periapsis: targetAlt
        }
    };
}

/**
 * Calculate Ground Track (Latitude/Longitude)
 *
 * Uses spherical trigonometry to project downrange distance onto Earth's surface.
 * Accounts for Earth's rotation (Coriolis/inertial frame offset).
 *
 * @param downrange Downrange distance from launch site (meters) (x coordinate in sim)
 * @param time Mission elapsed time (seconds)
 * @returns { lat: number, lon: number } (Radians)
 */
export function calculateGroundTrack(downrange: number, time: number): { lat: number; lon: number } {
    const lat0 = LAUNCH_SITE.lat;
    const lon0 = LAUNCH_SITE.lon;
    const az = LAUNCH_SITE.azimuth; // Launch azimuth

    // Angular distance traveled along great circle
    const c = downrange / R_EARTH;

    // Spherical Law of Cosines for Latitude
    // sin(lat) = sin(lat0)*cos(c) + cos(lat0)*sin(c)*cos(az)
    const sinLat = Math.sin(lat0) * Math.cos(c) + Math.cos(lat0) * Math.sin(c) * Math.cos(az);
    const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)));

    // Longitude difference (delta lambda)
    // tan(dLon) = (sin(c)*sin(az)) / (cos(lat0)*cos(c) - sin(lat0)*sin(c)*cos(az))
    // Or simplified using known lat:
    // sin(dLon) = sin(az) * sin(c) / cos(lat) -- problematic at poles
    // Let's use `atan2` form for robustness
    const y = Math.sin(c) * Math.sin(az);
    const x = Math.cos(lat0) * Math.cos(c) - Math.sin(lat0) * Math.sin(c) * Math.cos(az);
    const dLon = Math.atan2(y, x);

    // Earth rotation (Omega_Earth ~ 7.2921e-5 rad/s)
    const OMEGA_EARTH = 7.2921159e-5;
    const rotOffset = OMEGA_EARTH * time;

    // Final longitude
    let lon = lon0 + dLon - rotOffset;

    // Normalize to -PI to PI
    lon = ((lon + Math.PI) % (2 * Math.PI)) - Math.PI;

    return { lat, lon };
}

/**
 * Predict orbit path using RK4 integration
 * @param path Array to store the path points
 * @param r0 Initial radius
 * @param phi0 Initial angle
 * @param vr0 Initial radial velocity
 * @param vphi0 Initial tangential velocity
 * @param dtPred Time step (s)
 * @param maxSteps Maximum integration steps
 */
export function predictOrbitPath(
    path: { phi: number; r: number; relX?: number; relY?: number }[],
    r0: number,
    phi0: number,
    vr0: number,
    vphi0: number,
    dtPred: number = 5.0,
    maxSteps: number = 400
): void {
    let r = r0;
    let phi = phi0;
    let vr = vr0;
    let vphi = vphi0;

    const dtHalf = dtPred * 0.5;
    const dtSixth = dtPred / 6.0;

    let pathIdx = 0;

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
