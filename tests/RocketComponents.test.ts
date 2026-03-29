import { describe, it, expect, beforeEach } from 'vitest';
import { FullStack, Booster, UpperStage, Payload, Fairing } from '../src/physics/RocketComponents';
import { state } from '../src/core/State';
import { EngineStateCode } from '../src/core/PhysicsBuffer';

describe('RocketComponents', () => {
    describe('Initialization', () => {
        it('FullStack should have mass and engine off', () => {
            const fs = new FullStack(0, 0);
            expect(fs.mass).toBeGreaterThan(0);
            expect(fs.propState.engineState).toBe(EngineStateCode.OFF);
        });

        it('Booster should have mass and fuel', () => {
            const b = new Booster(0, 0);
            expect(b.mass).toBeGreaterThan(0);
            expect(b.fuel).toBeGreaterThan(0);
        });

        it('UpperStage should have mass with undeployed fairings', () => {
            const us = new UpperStage(0, 0);
            expect(us.mass).toBeGreaterThan(0);
            expect(us.fairingsDeployed).toBe(false);
        });

        it('Payload should have mass and no igniters', () => {
            const p = new Payload(0, 0);
            expect(p.mass).toBeGreaterThan(0);
            expect(p.ignitersRemaining).toBe(0);
        });

        it('Fairing should be inactive', () => {
            const f = new Fairing(0, 0);
            expect(f.active).toBe(false);
        });
    });

    describe('Booster Autopilot (Suicide Burn)', () => {
        beforeEach(() => {
            state.groundY = 5000;
            state.autopilotEnabled = true;
        });

        it('should not burn at high altitude', () => {
            const b = new Booster(0, 0);
            b.active = true;
            b.crashed = false;
            b.fuel = 1.0;
            b.vy = 50;
            b.applyPhysics(0.1, {});
            expect(b.throttle).toBe(0);
        });

        it('should burn when approaching stop distance', () => {
            const b = new Booster(0, 0);
            b.active = true;
            b.crashed = false;
            b.fuel = 1.0;
            b.y = 3700;
            b.vy = 100;
            b.applyPhysics(0.1, {});
            expect(b.throttle).toBe(1.0);
        });

        it('should modulate throttle for precision landing', () => {
            const b = new Booster(0, 0);
            b.active = true;
            b.crashed = false;
            b.fuel = 1.0;
            b.y = 4500;
            b.vy = 10;
            b.applyPhysics(0.1, {});
            expect(b.throttle).toBeGreaterThan(0.5);
            expect(b.throttle).toBeLessThan(1.0);
        });

        it('should cut throttle at touchdown', () => {
            const b = new Booster(0, 0);
            b.active = true;
            b.crashed = false;
            b.fuel = 1.0;
            b.y = 4895;
            b.applyPhysics(0.1, {});
            expect(b.throttle).toBe(0);
        });
    });

    describe('Booster Tilt Control', () => {
        beforeEach(() => {
            state.autopilotEnabled = true;
        });

        it('should deflect gimbal positive for positive tilt', () => {
            const b = new Booster(0, 0);
            b.active = true;
            b.angle = 0.1;
            b.applyPhysics(0.1, {});
            expect(b.gimbalAngle).toBeGreaterThan(0);
            expect(b.gimbalAngle).toBeCloseTo(0.4, 2);
        });

        it('should deflect gimbal negative for negative tilt', () => {
            const b = new Booster(0, 0);
            b.active = true;
            b.angle = -0.1;
            b.applyPhysics(0.1, {});
            expect(b.gimbalAngle).toBeLessThan(0);
        });
    });
});
