import { performance } from 'perf_hooks';
import { JSDOM } from 'jsdom';
import { VABEditor } from './src/ui/VABEditor';

const dom = new JSDOM('<!DOCTYPE html><div id="vab-container"></div>');
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;

// Simplified setup
const editor = new VABEditor('vab-container', () => {});

const ITERATIONS = 1000;

// Warmup
for (let i = 0; i < 100; i++) {
    (editor as any).render();
}

const start = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    (editor as any).render();
}
const end = performance.now();

console.log(`Render time for ${ITERATIONS} iterations: ${(end - start).toFixed(2)}ms`);
