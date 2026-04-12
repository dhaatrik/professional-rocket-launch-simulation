import { describe, it } from 'vitest';

type PhysicsEvent = any;

class MockPhysicsProxy {
    private eventListeners: ((event: PhysicsEvent) => void)[] = [];

    onEvent(callback: (event: PhysicsEvent) => void) {
        this.eventListeners.push(callback);
    }

    // Original handleEvent
    handleEventOriginal(event: PhysicsEvent) {
        this.eventListeners.forEach((cb) => cb(event));
    }

    // Optimized handleEvent
    handleEventOptimized(event: PhysicsEvent) {
        for (let i = 0; i < this.eventListeners.length; i++) {
            this.eventListeners[i](event);
        }
    }
}

describe('PhysicsProxy handleEvent Benchmark', () => {
    it('benchmark: handleEvent original vs optimized memory', () => {
        const proxy = new MockPhysicsProxy();

        // Add a few dummy listeners to simulate typical usage
        for (let i = 0; i < 5; i++) {
            proxy.onEvent((e) => {
                // Do something trivial
                let a = e.type;
            });
        }

        const dummyEvent = { type: 'TEST_EVENT', data: 123 };
        const iterations = 5000000;

        // Warmup
        for (let i = 0; i < 1000; i++) {
            proxy.handleEventOriginal(dummyEvent);
            proxy.handleEventOptimized(dummyEvent);
        }

        const startMem1 = process.memoryUsage().heapUsed;
        const startOriginal = performance.now();
        for (let i = 0; i < iterations; i++) {
            proxy.handleEventOriginal(dummyEvent);
        }
        const endOriginal = performance.now();
        const endMem1 = process.memoryUsage().heapUsed;
        const originalTime = endOriginal - startOriginal;

        // Garbage collection is tricky to force, but we can measure time which
        // usually is a good proxy for GC pressure in tight loops.

        const startMem2 = process.memoryUsage().heapUsed;
        const startOptimized = performance.now();
        for (let i = 0; i < iterations; i++) {
            proxy.handleEventOptimized(dummyEvent);
        }
        const endOptimized = performance.now();
        const endMem2 = process.memoryUsage().heapUsed;
        const optimizedTime = endOptimized - startOptimized;

        console.log(`Original (5M calls): Time: ${originalTime.toFixed(2)}ms`);
        console.log(`Optimized (5M calls): Time: ${optimizedTime.toFixed(2)}ms`);
        console.log(`Improvement: ${(((originalTime - optimizedTime) / originalTime) * 100).toFixed(2)}%`);
    });
});
