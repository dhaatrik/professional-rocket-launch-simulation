import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputManager } from '../src/core/InputManager';

describe('InputManager', () => {
    let inputManager: InputManager;
    let joystickZone: HTMLElement;
    let joystickKnob: HTMLElement;
    let throttleZone: HTMLElement;
    let throttleHandle: HTMLElement;

    beforeEach(() => {
        // Setup simple DOM for tests
        document.body.innerHTML = `
            <div id="joystick-zone" style="width: 100px; height: 100px; position: absolute; left: 0px; top: 0px;"></div>
            <div id="joystick-knob"></div>
            <div id="throttle-zone" style="width: 50px; height: 200px; position: absolute; left: 200px; top: 0px;"></div>
            <div id="throttle-handle"></div>
        `;

        joystickZone = document.getElementById('joystick-zone')!;
        joystickKnob = document.getElementById('joystick-knob')!;
        throttleZone = document.getElementById('throttle-zone')!;
        throttleHandle = document.getElementById('throttle-handle')!;

        // Mock getBoundingClientRect
        vi.spyOn(joystickZone, 'getBoundingClientRect').mockReturnValue({
            left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => {}
        });
        vi.spyOn(throttleZone, 'getBoundingClientRect').mockReturnValue({
            left: 200, top: 0, width: 50, height: 200, right: 250, bottom: 200, x: 200, y: 0, toJSON: () => {}
        });

        // Instantiate AFTER DOM is setup so that touch controls can attach to DOM elements
        inputManager = new InputManager();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('should initialize with default values', () => {
        expect(inputManager.cameraMode).toBe(1);
        expect(inputManager.getAction('THROTTLE_UP')).toBe(false);
        expect(inputManager.getSteering()).toBe(0);
        expect(inputManager.getThrottleCommand()).toBe(0);
        expect(inputManager.getTouchThrottle()).toBe(null);
    });

    describe('Keyboard Interactions', () => {
        const fireKeyEvent = (type: 'keydown' | 'keyup', key: string) => {
            const event = new KeyboardEvent(type, { key });
            window.dispatchEvent(event);
        };

        it('should update throttle command via Shift and Control', () => {
            fireKeyEvent('keydown', 'Shift');
            expect(inputManager.getAction('THROTTLE_UP')).toBe(true);
            expect(inputManager.getThrottleCommand()).toBe(1);

            fireKeyEvent('keyup', 'Shift');
            expect(inputManager.getAction('THROTTLE_UP')).toBe(false);
            expect(inputManager.getThrottleCommand()).toBe(0);

            fireKeyEvent('keydown', 'Control');
            expect(inputManager.getAction('THROTTLE_DOWN')).toBe(true);
            expect(inputManager.getThrottleCommand()).toBe(-1);

            fireKeyEvent('keyup', 'Control');
            expect(inputManager.getThrottleCommand()).toBe(0);
        });

        it('should update steering via ArrowLeft and ArrowRight', () => {
            fireKeyEvent('keydown', 'ArrowLeft');
            expect(inputManager.getAction('YAW_LEFT')).toBe(true);
            expect(inputManager.getSteering()).toBe(-1);

            fireKeyEvent('keyup', 'ArrowLeft');
            fireKeyEvent('keydown', 'ArrowRight');
            expect(inputManager.getAction('YAW_RIGHT')).toBe(true);
            expect(inputManager.getSteering()).toBe(1);

            fireKeyEvent('keyup', 'ArrowRight');
            expect(inputManager.getSteering()).toBe(0);
        });

        it('should toggle map mode with M key', () => {
            expect(inputManager.getAction('MAP_MODE')).toBe(false);

            fireKeyEvent('keydown', 'M');
            expect(inputManager.getAction('MAP_MODE')).toBe(true);

            fireKeyEvent('keyup', 'M');
            expect(inputManager.getAction('MAP_MODE')).toBe(true); // one-shot

            fireKeyEvent('keydown', 'm'); // test lowercase
            expect(inputManager.getAction('MAP_MODE')).toBe(false);
        });

        it('should toggle SAS with T key', () => {
            expect(inputManager.getAction('SAS_TOGGLE')).toBe(false);

            fireKeyEvent('keydown', 'T');
            expect(inputManager.getAction('SAS_TOGGLE')).toBe(true);

            fireKeyEvent('keyup', 'T');
            expect(inputManager.getAction('SAS_TOGGLE')).toBe(false); // SAS turns off on keyup

            fireKeyEvent('keydown', 't');
            expect(inputManager.getAction('SAS_TOGGLE')).toBe(true);
            fireKeyEvent('keyup', 't');
        });

        it('should update other actions like CUT_ENGINE and TIME_WARP', () => {
            fireKeyEvent('keydown', 'X');
            expect(inputManager.getAction('CUT_ENGINE')).toBe(true);
            fireKeyEvent('keyup', 'X');
            expect(inputManager.getAction('CUT_ENGINE')).toBe(false);

            fireKeyEvent('keydown', '.');
            expect(inputManager.getAction('TIME_WARP_UP')).toBe(true);
            fireKeyEvent('keyup', '.');

            fireKeyEvent('keydown', '<');
            expect(inputManager.getAction('TIME_WARP_DOWN')).toBe(true);
            fireKeyEvent('keyup', '<');
        });

        it('should check if a specific key is pressed', () => {
            fireKeyEvent('keydown', 'Space');
            expect(inputManager.isKeyPressed('Space')).toBe(true);
            fireKeyEvent('keyup', 'Space');
            expect(inputManager.isKeyPressed('Space')).toBe(false);
            expect(inputManager.isKeyPressed('NonExistent')).toBe(false);
        });
    });

    describe('Touch Controls (Joystick)', () => {
        const createTouchEvent = (type: string, clientX: number, clientY: number): TouchEvent => {
            const touch = {
                clientX,
                clientY,
                identifier: 0,
                target: joystickZone,
                pageX: clientX,
                pageY: clientY,
                screenX: clientX,
                screenY: clientY,
                radiusX: 1,
                radiusY: 1,
                rotationAngle: 0,
                force: 1
            } as any;

            return new TouchEvent(type, {
                touches: [touch],
                changedTouches: [touch],
                targetTouches: [touch],
                cancelable: true
            });
        };

        it('should handle joystick touchstart and touchmove', () => {
            // center is 50, 50. maxDist is 50.
            joystickZone.dispatchEvent(createTouchEvent('touchstart', 75, 50)); // dx=25, dy=0

            expect(inputManager.getSteering()).toBe(0.5); // 25 / 50
            expect(joystickKnob.style.transform).toBe('translate(25px, 0px)');

            joystickZone.dispatchEvent(createTouchEvent('touchmove', 100, 50)); // dx=50, dy=0
            expect(inputManager.getSteering()).toBe(1);
            expect(joystickKnob.style.transform).toBe('translate(50px, 0px)');
        });

        it('should clamp joystick movement to max radius', () => {
            // center is 50, 50. maxDist is 50.
            joystickZone.dispatchEvent(createTouchEvent('touchmove', 150, 50)); // dx=100, dy=0 (outside maxDist)

            // Should be clamped to maxDist (dx=50)
            expect(inputManager.getSteering()).toBe(1);
            expect(joystickKnob.style.transform).toBe('translate(50px, 0px)');
        });

        it('should reset joystick on touchend', () => {
            joystickZone.dispatchEvent(createTouchEvent('touchstart', 75, 50));
            expect(inputManager.getSteering()).toBe(0.5);

            joystickZone.dispatchEvent(new TouchEvent('touchend'));

            expect(inputManager.getSteering()).toBe(0);
            expect(joystickKnob.style.transform).toBe('translate(0px, 0px)');
        });
    });

    describe('Touch Controls (Throttle)', () => {
        const createTouchEvent = (type: string, clientX: number, clientY: number): TouchEvent => {
            const touch = {
                clientX,
                clientY,
                identifier: 0,
                target: throttleZone,
                pageX: clientX,
                pageY: clientY,
                screenX: clientX,
                screenY: clientY,
                radiusX: 1,
                radiusY: 1,
                rotationAngle: 0,
                force: 1
            } as any;

            return new TouchEvent(type, {
                touches: [touch],
                changedTouches: [touch],
                targetTouches: [touch],
                cancelable: true
            });
        };

        it('should handle throttle touchstart and touchmove', () => {
            // rect: left 200, top 0, width 50, height 200
            // clientY of 100 is middle. Inverted: 1 - (100 / 200) = 0.5
            throttleZone.dispatchEvent(createTouchEvent('touchstart', 225, 100));

            expect(inputManager.getTouchThrottle()).toBe(0.5);
            expect(throttleHandle.style.bottom).toBe('50%');

            // clientY of 0 is top. Inverted: 1 - (0 / 200) = 1
            throttleZone.dispatchEvent(createTouchEvent('touchmove', 225, 0));
            expect(inputManager.getTouchThrottle()).toBe(1);
            expect(throttleHandle.style.bottom).toBe('100%');

            // clientY of 200 is bottom. Inverted: 1 - (200 / 200) = 0
            throttleZone.dispatchEvent(createTouchEvent('touchmove', 225, 200));
            expect(inputManager.getTouchThrottle()).toBe(0);
            expect(throttleHandle.style.bottom).toBe('0%');
        });

        it('should clamp throttle movement', () => {
            // clientY of 250 is below bottom. Inverted: clamped to 0
            throttleZone.dispatchEvent(createTouchEvent('touchmove', 225, 250));
            expect(inputManager.getTouchThrottle()).toBe(0);
            expect(throttleHandle.style.bottom).toBe('0%');

            // clientY of -50 is above top. Inverted: clamped to 1
            throttleZone.dispatchEvent(createTouchEvent('touchmove', 225, -50));
            expect(inputManager.getTouchThrottle()).toBe(1);
            expect(throttleHandle.style.bottom).toBe('100%');
        });

        it('should deactivate throttle on touchend', () => {
            throttleZone.dispatchEvent(createTouchEvent('touchstart', 225, 100));
            expect(inputManager.getTouchThrottle()).toBe(0.5);

            throttleZone.dispatchEvent(new TouchEvent('touchend'));

            expect(inputManager.getTouchThrottle()).toBe(null);
            // Handle position remains visually but internal state is inactive
        });
    });
});
