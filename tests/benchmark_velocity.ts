const iterations = 1000000;

class MockGame {
    trackedEntity = { vx: 100.5, vy: 200.5 };
    _cachedVelocity = 0;

    // Inefficient approach: Math.sqrt called multiple times per frame
    updatePhysics_Inefficient() {
        if (!this.trackedEntity) return;
        const vel = Math.sqrt(this.trackedEntity.vx ** 2 + this.trackedEntity.vy ** 2);
        // Do something with vel
    }

    updateFlightDataHUD_Inefficient() {
        if (!this.trackedEntity) return;
        const vel = Math.sqrt(this.trackedEntity.vx ** 2 + this.trackedEntity.vy ** 2);
        // Do something with vel
    }

    animate_Inefficient() {
        if (!this.trackedEntity) return;
        const vel = Math.sqrt(this.trackedEntity.vx ** 2 + this.trackedEntity.vy ** 2);
        // Do something with vel
    }

    runInefficientFrame() {
        this.updatePhysics_Inefficient();
        this.updateFlightDataHUD_Inefficient();
        this.animate_Inefficient();
    }

    // Optimized approach: calculate once
    preCalculateVelocity() {
        if (this.trackedEntity) {
            this._cachedVelocity = Math.sqrt(this.trackedEntity.vx ** 2 + this.trackedEntity.vy ** 2);
        } else {
            this._cachedVelocity = 0;
        }
    }

    updatePhysics_Optimized() {
        if (!this.trackedEntity) return;
        const vel = this._cachedVelocity;
        // Do something with vel
    }

    updateFlightDataHUD_Optimized() {
        if (!this.trackedEntity) return;
        const vel = this._cachedVelocity;
        // Do something with vel
    }

    animate_Optimized() {
        if (!this.trackedEntity) return;
        const vel = this._cachedVelocity;
        // Do something with vel
    }

    runOptimizedFrame() {
        this.preCalculateVelocity();
        this.updatePhysics_Optimized();
        this.updateFlightDataHUD_Optimized();
        this.animate_Optimized();
    }
}

const game = new MockGame();

console.log(`Running benchmark with ${iterations} iterations...`);

const startInefficient = performance.now();
for (let i = 0; i < iterations; i++) {
    game.trackedEntity.vx += 0.01;
    game.runInefficientFrame();
}
const endInefficient = performance.now();

const startOptimized = performance.now();
for (let i = 0; i < iterations; i++) {
    game.trackedEntity.vx += 0.01;
    game.runOptimizedFrame();
}
const endOptimized = performance.now();

const timeInefficient = endInefficient - startInefficient;
const timeOptimized = endOptimized - startOptimized;

console.log(`Inefficient: ${timeInefficient.toFixed(2)}ms`);
console.log(`Optimized:   ${timeOptimized.toFixed(2)}ms`);
console.log(`Improvement: ${(timeInefficient / timeOptimized).toFixed(2)}x faster`);
