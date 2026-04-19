import { IVessel, vec2 } from '../types';
import { KeplerianElements, calculateOrbitalElements } from './OrbitalMechanics';
import { PIXELS_PER_METER, R_EARTH } from '../config/Constants';

export function getCurrentOrbitalElements(vessel: IVessel, groundY: number): KeplerianElements {
    const altitude = (groundY - vessel.y - vessel.h) / PIXELS_PER_METER;
    const r = R_EARTH + altitude;
    const rVec = vec2(0, r);
    const vVec = vec2(vessel.vx, -vessel.vy);
    return calculateOrbitalElements(rVec, vVec);
}
