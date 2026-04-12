import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AnalysisApp } from '../src/analysis/AnalysisApp';
import { JSDOM } from 'jsdom';

describe('AnalysisApp Chart Rendering Optimization Benchmark', () => {
    let dom: JSDOM;
    let getContextCallCount = 0;
    let clearRectCallCount = 0;
    let strokeCallCount = 0;
    let putImageDataCount = 0;
    let mockContext: any;

    beforeEach(() => {
        dom = new JSDOM(`<!DOCTYPE html>
<html>
<body>
    <input type="range" id="time-scrubber" />
    <span id="disp-time"></span>
    <span id="disp-alt"></span>
    <span id="disp-vel"></span>
    <div id="duration-label"></div>
    <button id="btn-play"></button>
    <div id="visualizer"><canvas id="visualizer-canvas" width="400" height="400"></canvas></div>
    <div><canvas id="chart-alt" width="400" height="200"></canvas></div>
    <div><canvas id="chart-vel" width="400" height="200"></canvas></div>
    <div><canvas id="chart-throttle" width="400" height="200"></canvas></div>
    <div><canvas id="chart-q" width="400" height="200"></canvas></div>
</body>
</html>`);
        (global as any).document = dom.window.document;
        (global as any).window = dom.window;
        (global as any).HTMLCanvasElement = dom.window.HTMLCanvasElement;

        getContextCallCount = 0;
        clearRectCallCount = 0;
        strokeCallCount = 0;
        putImageDataCount = 0;

        mockContext = {
            clearRect: () => { clearRectCallCount++; },
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            stroke: () => { strokeCallCount++; },
            fillRect: () => {},
            save: () => {},
            restore: () => {},
            translate: () => {},
            rotate: () => {},
            fill: () => {},
            setLineDash: () => {},
            getImageData: () => ({ data: new Uint8ClampedArray(4) }),
            putImageData: () => { putImageDataCount++; },
        };
        (HTMLCanvasElement.prototype as any).getContext = () => {
            getContextCallCount++;
            return mockContext;
        };
        Object.defineProperty(HTMLCanvasElement.prototype, 'width', { value: 400 });
        Object.defineProperty(HTMLCanvasElement.prototype, 'height', { value: 200 });
    });

    afterEach(() => {
        delete (global as any).document;
        delete (global as any).window;
        delete (global as any).HTMLCanvasElement;
    });

    it('should measure unoptimized vs optimized chart redraws', () => {
        const app = new AnalysisApp();

        // Mock data
        const frames = Array.from({ length: 1000 }, (_, i) => ({
            timestamp: i,
            missionTime: i,
            altitude: i * 10,
            velocity: i,
            acceleration: i / 10,
            throttle: 1,
            q: i * 5,
            mass: 1000,
            event: null,
            posX: 0,
            posY: i * 10,
            vx: 0,
            vy: i,
            angle: 0
        }));
        (app as any).frames = frames;

        // 1. Measure Baseline Redrawing (simulating old behavior)
        clearRectCallCount = 0;
        strokeCallCount = 0;

        const startOld = performance.now();
        for (let i = 0; i < 100; i++) {
            (app as any).renderCharts();
        }
        const timeOld = performance.now() - startOld;

        // 2. Measure Optimized Cursors
        clearRectCallCount = 0;
        strokeCallCount = 0;
        putImageDataCount = 0;

        // Populate cache once
        (app as any).renderCharts();

        const startNew = performance.now();
        for (let i = 0; i < 100; i++) {
            (app as any).drawChartCursors(i);
        }
        const timeNew = performance.now() - startNew;

        console.log(`\nBenchmark Results (Chart Cursors, 100 ops):`);
        console.log(`Full Re-render (Old): ${timeOld.toFixed(2)}ms`);
        console.log(`ImageData Restore (New): ${timeNew.toFixed(2)}ms`);
        console.log(`Speedup: ${(timeOld / timeNew).toFixed(2)}x\n`);

        expect(timeNew).toBeDefined();
    });
});
