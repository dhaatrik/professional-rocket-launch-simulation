import { describe, it, expect } from 'vitest';
import { FaultInjector } from '../src/safety/FaultInjector';
import { FAULT_CATALOG } from '../src/safety/FaultInjector';
import { performance } from 'perf_hooks';
import { JSDOM } from 'jsdom';

describe('FaultInjector rendering performance', () => {
    it('should measure the performance of render method', () => {
        // Setup mock DOM for rendering
        const dom = new JSDOM('<!DOCTYPE html><html><body><div id="fis-container"></div></body></html>');
        global.document = dom.window.document as any;
        global.HTMLElement = dom.window.HTMLElement as any;
        global.HTMLButtonElement = dom.window.HTMLButtonElement as any;
        global.CustomEvent = dom.window.CustomEvent as any;

        const injector = new FaultInjector('fis-container');

        // Arm ALL faults to populate activeFaults to make N*M bigger
        for (const fault of FAULT_CATALOG) {
            injector.armFault(fault.id);
        }

        const ITERATIONS = 1000;

        const start = performance.now();
        for (let i = 0; i < ITERATIONS; i++) {
            injector.render();
        }
        const end = performance.now();

        const totalTime = end - start;
        console.log(`FaultInjector.render() called ${ITERATIONS} times: ${totalTime.toFixed(2)}ms`);
        console.log(`Average time per render: ${(totalTime / ITERATIONS).toFixed(4)}ms`);

        expect(totalTime).toBeGreaterThan(0);
    });
});
