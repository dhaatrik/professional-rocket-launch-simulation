import { performance } from 'perf_hooks';
import { JSDOM } from 'jsdom';
import { FaultInjector } from './src/safety/FaultInjector';

const dom = new JSDOM('<!DOCTYPE html><div id="fault-injector"></div><div id="launch-checklist"></div>');
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.CustomEvent = dom.window.CustomEvent as any;

const injector = new FaultInjector('fault-injector');
injector.armFault('engine-flameout'); // populate something

const ITERATIONS = 1000;

// Warmup
for (let i = 0; i < 100; i++) {
    injector.render();
}

const start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    injector.render();
}
const end = performance.now();

console.log(`Render time for ${ITERATIONS} iterations: ${(end - start).toFixed(2)}ms`);
