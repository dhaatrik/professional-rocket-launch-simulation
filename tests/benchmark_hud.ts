// import { performance } from 'perf_hooks'; // Removed for browser compatibility
const perf = performance;

export { }; // Make this a module

// Mock HTMLElement
class MockHTMLElement {
    textContent: string = '';
    style: any = { color: '', display: '', className: '' }; // Relaxed type
    className: string = '';
}

// Mock document
const mockDocument = {
    elements: new Map<string, MockHTMLElement>(),
    getElementById: (id: string) => {
        if (!mockDocument.elements.has(id)) {
            mockDocument.elements.set(id, new MockHTMLElement());
        }
        return mockDocument.elements.get(id);
    }
};

// Global override (simulated for the test scope)
(globalThis as any).document = mockDocument;

// Mock Game class subset
class HUDUpdater {
    // Cache
    hudWindSpeed: any = null; // Use any to bypass strict HTMLElement checks for benchmarks
    hudWindDir: any = null;
    hudTimeOfDay: any = null;
    hudLaunchStatus: any = null;
    hudMaxQ: any = null;

    lastHUDState = {
        windSpeed: -1,
        windDir: '',
        timeOfDay: '',
        launchStatus: '',
        maxQWarning: false
    };

    constructor() {
        this.initHUDCache();
    }

    initHUDCache() {
        this.hudWindSpeed = document.getElementById('hud-wind-speed');
        this.hudWindDir = document.getElementById('hud-wind-dir');
        this.hudTimeOfDay = document.getElementById('hud-time-of-day');
        this.hudLaunchStatus = document.getElementById('hud-launch-status');
        this.hudMaxQ = document.getElementById('hud-maxq-warning');
    }

    // Inefficient method (Simulating unoptimized behavior)
    updateInefficient(envState: any) {
        const hudWindSpeed = document.getElementById('hud-wind-speed');
        const hudWindDir = document.getElementById('hud-wind-dir');
        const hudTimeOfDay = document.getElementById('hud-time-of-day');
        const hudLaunchStatus = document.getElementById('hud-launch-status');

        const hudMaxQ = this.hudMaxQ;

        const last = this.lastHUDState;

        if (hudWindSpeed) {
            const speed = Math.round(envState.surfaceWindSpeed);
            if (last.windSpeed !== speed) {
                last.windSpeed = speed;
                hudWindSpeed.textContent = speed + ' m/s';
            }
        }

        // Logic for MaxQ (inefficient)
        if (envState.maxQWindWarning !== last.maxQWarning) {
             last.maxQWarning = envState.maxQWindWarning;
             if (hudMaxQ) {
                 if (envState.maxQWindWarning) {
                     hudMaxQ.textContent = '⚠ HIGH WIND SHEAR';
                     hudMaxQ.style.display = 'block';
                 } else {
                     hudMaxQ.style.display = 'none';
                 }
             }
        }
    }

    // Optimized method (Proposed implementation with fix)
    updateOptimized(envState: any) {
        const hudWindSpeed = this.hudWindSpeed;
        const hudWindDir = this.hudWindDir;
        const hudTimeOfDay = this.hudTimeOfDay;
        const hudLaunchStatus = this.hudLaunchStatus;
        const last = this.lastHUDState;

        if (hudWindSpeed) {
            const speed = Math.round(envState.surfaceWindSpeed);
            if (last.windSpeed !== speed) {
                last.windSpeed = speed;
                hudWindSpeed.textContent = speed + ' m/s';
            }
        }

        // Logic for MaxQ (optimized)
        if (envState.maxQWindWarning !== last.maxQWarning) {
            last.maxQWarning = envState.maxQWindWarning;
            const hudMaxQ = this.hudMaxQ;
            if (hudMaxQ) {
                if (envState.maxQWindWarning) {
                    hudMaxQ.textContent = '⚠ HIGH WIND SHEAR';
                    hudMaxQ.style.display = 'block';
                } else {
                    hudMaxQ.style.display = 'none';
                }
            }
        }
    }
}

// Benchmark
const iterations = 1000000;
const updater = new HUDUpdater();
const envState = { surfaceWindSpeed: 10, surfaceWindDirection: 0, timeOfDay: 0, isLaunchSafe: true, maxQWindWarning: false };

console.log(`Running benchmark with ${iterations} iterations...`);

// Test Inefficient
const startInefficient = performance.now();
for (let i = 0; i < iterations; i++) {
    // Toggle value to force update
    envState.surfaceWindSpeed = i % 20;
    envState.maxQWindWarning = (i % 100) < 50; // Toggle periodically
    updater.updateInefficient(envState);
}
const endInefficient = performance.now();
const timeInefficient = endInefficient - startInefficient;

// Reset state
updater.lastHUDState.maxQWarning = false;

// Test Optimized
const startOptimized = performance.now();
for (let i = 0; i < iterations; i++) {
    // Toggle value to force update
    envState.surfaceWindSpeed = i % 20;
    envState.maxQWindWarning = (i % 100) < 50; // Toggle periodically
    updater.updateOptimized(envState);
}
const endOptimized = performance.now();
const timeOptimized = endOptimized - startOptimized;

console.log(`Inefficient: ${timeInefficient.toFixed(2)}ms`);
console.log(`Optimized:   ${timeOptimized.toFixed(2)}ms`);
console.log(`Improvement: ${(timeInefficient / timeOptimized).toFixed(2)}x faster`);
