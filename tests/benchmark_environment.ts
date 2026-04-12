
import { EnvironmentSystem, WindLayer, DEFAULT_WIND_LAYERS } from '../src/physics/Environment';
import { vec2 } from '../src/types/index';

// --- OPTIMIZED IMPLEMENTATION ---
class OptimizedEnvironmentSystem extends EnvironmentSystem {
    // Re-implementing with binary search and polar return
    getWindPolar(altitude: number): { speed: number, direction: number } {
        const safeAlt = Math.max(0, altitude);
        // Accessing private config via any for benchmark purpose,
        // in real code it will be part of the class
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layers = (this as any).config.windLayers as WindLayer[];

        // Binary search
        let low = 0;
        let high = layers.length - 1;
        let layerIndex = -1;

        while (low <= high) {
            const mid = (low + high) >>> 1;
            const layer = layers[mid]!;

            if (safeAlt >= layer.altitudeMin && safeAlt < layer.altitudeMax) {
                layerIndex = mid;
                break;
            } else if (safeAlt < layer.altitudeMin) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }

        if (layerIndex === -1) {
            return { speed: 0, direction: 0 };
        }

        const layer = layers[layerIndex]!;

        // Interpolate within the layer for smooth transitions
        const layerProgress =
            layer.altitudeMax === layer.altitudeMin
                ? 0
                : (safeAlt - layer.altitudeMin) / (layer.altitudeMax - layer.altitudeMin);

        // Find next layer for interpolation
        const nextLayer = layers[layerIndex + 1];

        let speed = layer.windSpeed;
        let direction = layer.windDirection;

        // Only interpolate if the next layer is contiguous
        if (nextLayer && nextLayer.altitudeMin === layer.altitudeMax) {
            // Smooth interpolation between layers
            speed = layer.windSpeed + (nextLayer.windSpeed - layer.windSpeed) * layerProgress;

            // Interpolate angle
            const diff = nextLayer.windDirection - layer.windDirection;
            const shortDiff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
            direction = layer.windDirection + shortDiff * layerProgress;
        }

        return { speed, direction };
    }
}

// --- BENCHMARK ---
const ITERATIONS = 100000;
const env = new EnvironmentSystem();
const optEnv = new OptimizedEnvironmentSystem();

// Create more layers to stress test binary search
const manyLayers: WindLayer[] = [];
for (let i = 0; i < 100; i++) {
    manyLayers.push({
        altitudeMin: i * 1000,
        altitudeMax: (i + 1) * 1000,
        windSpeed: 10 + Math.random() * 50,
        windDirection: Math.random() * Math.PI * 2
    });
}
// Set layers (EnvironmentSystem sorts them)
env.setWindLayers(manyLayers);
optEnv.setWindLayers(manyLayers);

console.log(`Benchmarking Wind Lookup (${ITERATIONS} iterations) with ${manyLayers.length} layers`);

const altitudes: number[] = [];
for (let i = 0; i < ITERATIONS; i++) {
    altitudes.push(Math.random() * 100000);
}

// Warmup
for (let i = 0; i < 1000; i++) env.getWindAtAltitude(altitudes[i]!);
for (let i = 0; i < 1000; i++) optEnv.getWindPolar(altitudes[i]!);

const startOrig = performance.now();
let dummy1 = 0;
for (let i = 0; i < ITERATIONS; i++) {
    const v = env.getWindAtAltitude(altitudes[i]!);
    // Simulate Game.ts usage: converting back to speed/angle
    const speed = Math.sqrt(v.x * v.x + v.y * v.y);
    const angle = Math.atan2(v.y, v.x);
    dummy1 += speed + angle;
}
const timeOrig = performance.now() - startOrig;

const startOpt = performance.now();
let dummy2 = 0;
for (let i = 0; i < ITERATIONS; i++) {
    const p = optEnv.getWindPolar(altitudes[i]!);
    // Simulate Game.ts usage: using speed/angle directly
    // Angle needs adjustment to match atan2 result (wind FROM vs WHERE)
    // original: atan2(-sin * speed, -cos * speed)
    // wind vector is (-cos(dir)*speed, -sin(dir)*speed) if dir is from East (0) counter-clockwise?
    // Wait, let's check exact formula in Environment.ts
    // vec2(-Math.cos(direction) * speed, -Math.sin(direction) * speed);
    // atan2(y, x) -> atan2(-sin, -cos) -> direction + PI

    const speed = p.speed;
    const angle = p.direction + Math.PI;
    dummy2 += speed + angle;
}
const timeOpt = performance.now() - startOpt;

console.log(`Original (Linear + Alloc + Trig): ${timeOrig.toFixed(4)}ms`);
console.log(`Optimized (Binary + Direct):      ${timeOpt.toFixed(4)}ms`);
console.log(`Speedup:                          ${(timeOrig / timeOpt).toFixed(2)}x`);
