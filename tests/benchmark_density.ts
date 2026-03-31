
import { getAtmosphericDensity, RHO_SL } from '../src/config/Constants';

const ITERATIONS = 10000000;
const SCALE_HEIGHT = 7000;

// --- ORIGINAL IMPLEMENTATION (Baseline) ---
function getAtmosphericDensityOriginal(altitude: number): number {
    const safeAlt = Math.max(0, altitude);
    return RHO_SL * Math.exp(-safeAlt / SCALE_HEIGHT);
}

// Compare accuracy
console.log("Checking accuracy (Optimized vs Original)...");
let maxError = 0;
let maxRelError = 0;
for (let h = 0; h < 200000; h += 37) {
    const exact = getAtmosphericDensityOriginal(h);
    const approx = getAtmosphericDensity(h);
    const err = Math.abs(exact - approx);
    if (err > maxError) maxError = err;
    if (exact > 1e-10) {
        const rel = err / exact;
        if (rel > maxRelError) maxRelError = rel;
    }
}
console.log(`Max Abs Error: ${maxError}`);
console.log(`Max Rel Error: ${maxRelError}`);


console.log(`Benchmarking Atmospheric Density (${ITERATIONS} iterations)`);

// Warmup
let warmupSum = 0;
for (let i = 0; i < 1000; i++) {
    warmupSum += getAtmosphericDensityOriginal(i * 100);
    warmupSum += getAtmosphericDensity(i * 100);
}

// Baseline (Original)
const startBase = performance.now();
let sumBase = 0;
for (let i = 0; i < ITERATIONS; i++) {
    const alt = i % 100000; // Varying input
    sumBase += getAtmosphericDensityOriginal(alt);
}
const timeBase = performance.now() - startBase;

// Optimized (Current Implementation)
const startOpt = performance.now();
let sumOpt = 0;
for (let i = 0; i < ITERATIONS; i++) {
    const alt = i % 100000; // Varying input
    sumOpt += getAtmosphericDensity(alt);
}
const timeOpt = performance.now() - startOpt;

console.log(`Baseline Time (Math.exp): ${timeBase.toFixed(4)}ms`);
console.log(`Optimized Time (LUT):     ${timeOpt.toFixed(4)}ms`);
console.log(`Speedup: ${(timeBase / timeOpt).toFixed(2)}x`);

export {};
