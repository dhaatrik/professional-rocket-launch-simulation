import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FaultInjector } from '../../src/safety/FaultInjector';
import { ReliabilitySystem } from '../../src/physics/Reliability';
import type { IVessel } from '../../src/types/index';

// Mock DOM
class MockElement {
    tagName: string;
    innerHTML = '';
    textContent = '';
    className = '';
    id = '';
    style = {};
    attributes: Record<string, string> = {};
    children: MockElement[] = [];
    classList = {
        add: vi.fn(),
        remove: vi.fn(),
        toggle: vi.fn(),
        contains: vi.fn(() => false)
    };

    constructor(tagName: string) {
        this.tagName = tagName;
    }

    setAttribute(name: string, value: string) {
        this.attributes[name] = value;
    }

    appendChild(child: MockElement) {
        this.children.push(child);
        this.innerHTML += child.tagName; // Rough approximation for tests
    }

    querySelector() {
        return null;
    }

    querySelectorAll() {
        return [];
    }

    dispatchEvent() {}
    addEventListener() {}
    removeEventListener() {}
}

const mockDoc = {
    getElementById: vi.fn(() => new MockElement('div')),
    createElement: vi.fn((tagName) => new MockElement(tagName)),
    createTextNode: vi.fn((text) => text)
};
vi.stubGlobal('document', mockDoc);

interface IReliableVessel extends IVessel {
    reliability: ReliabilitySystem;
}

function createMockVessel(): IReliableVessel {
    return {
        reliability: new ReliabilitySystem(),
        active: true,
        throttle: 1.0,
        fuel: 1000,
        x: 0, y: 0, vx: 0, vy: 0, angle: 0, h: 40, width: 10,
        thrust: 0, dryMass: 100, wetMass: 1000,
        crashed: false
    } as any;
}

describe('FaultInjector', () => {
    let injector: FaultInjector;

    beforeEach(() => {
        injector = new FaultInjector('panel-id');
    });

    it('should queue faults for execution', () => {
        const v = createMockVessel();
        // 1. Arm fault first
        injector.armFault('engine-flameout');

        // 2. Inject fault
        injector.injectFault('engine-flameout', v, v.reliability);

        // Check reliability system
        expect(v.reliability.activeFailures.has('ENGINE_FLAME_OUT')).toBe(true);
    });

    it('should handle timed faults', () => {
        const v = createMockVessel();
        // Arm with delay
        injector.armFault('gimbal-lock', 'timed', 5);

        // Update 1s - should not trigger
        injector.update(v, v.reliability, 0, 1.0);
        expect(v.reliability.activeFailures.has('GIMBAL_LOCK')).toBe(false);

        // Update 5s more - should trigger
        injector.update(v, v.reliability, 0, 5.0);
        expect(v.reliability.activeFailures.has('GIMBAL_LOCK')).toBe(true);
    });

    it('should handle custom faults (Throttle Stuck)', () => {
        const v = createMockVessel();
        injector.armFault('throttle-stuck');
        injector.injectFault('throttle-stuck', v, v.reliability);

        // Update to apply effect
        v.throttle = 0.5; // Try to change throttle
        injector.update(v, v.reliability, 0, 0.1);

        // Should force throttle to stuck value (1.0 from init)
        expect(v.throttle).toBe(1.0);
    });

    it('should handle custom faults (Fuel Leak)', () => {
        const v = createMockVessel();
        injector.armFault('fuel-leak');
        injector.injectFault('fuel-leak', v, v.reliability);

        // Update to apply effect
        v.fuel = 1000;
        injector.update(v, v.reliability, 0, 1.0);

        expect(v.fuel).toBeLessThan(1000);
        expect(injector.fuelLeakActive).toBe(true);
    });

    it('should toggle faults correctly (arm then inject)', () => {
        const v = createMockVessel();

        // First click arms
        injector.toggleFault('engine-flameout', v, v.reliability);
        expect(v.reliability.activeFailures.has('ENGINE_FLAME_OUT')).toBe(false);

        // Second click injects
        injector.toggleFault('engine-flameout', v, v.reliability);
        expect(v.reliability.activeFailures.has('ENGINE_FLAME_OUT')).toBe(true);
    });

    it('should handle conditional faults', () => {
        const v = createMockVessel();
        const altCondition = (vessel: IVessel, alt: number) => alt > 1000;

        injector.armFault('engine-flameout', 'conditional', 0, altCondition);

        // Ground y is 0, vessel h is 40. PIXELS_PER_METER is 10.
        // alt = (0 - v.y - 40) / 10.
        // At y = -5000: alt = (0 - (-5000) - 40) / 10 = 4960 / 10 = 496. Condition false.
        v.y = -5000;
        injector.update(v, v.reliability, 0, 0.1);
        expect(v.reliability.activeFailures.has('ENGINE_FLAME_OUT')).toBe(false);

        // At y = -15000: alt = (0 - (-15000) - 40) / 10 = 14960 / 10 = 1496. Condition true.
        v.y = -15000;
        injector.update(v, v.reliability, 0, 0.1);
        expect(v.reliability.activeFailures.has('ENGINE_FLAME_OUT')).toBe(true);
    });
});
