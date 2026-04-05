import { performance } from 'perf_hooks';

// Generate a large catalog for benchmark
const FAULT_CATALOG: any[] = [];
const categories = ['propulsion', 'avionics', 'structure'];
for (let i = 0; i < 1000; i++) {
    FAULT_CATALOG.push({
        id: `fault-${i}`,
        category: categories[i % categories.length],
        label: `Fault ${i}`,
        description: `Description ${i}`
    });
}

function processBaseline() {
    let count = 0;
    const categoryEls = categories.map((cat) => {
        const faults = FAULT_CATALOG.filter((f) => f.category === cat);
        const faultEls = faults.map((fault) => {
            count++;
        });
    });
    return count;
}

const faultsByCategory = new Map<string, any[]>();
for (const cat of categories) {
    faultsByCategory.set(cat, []);
}
for (const fault of FAULT_CATALOG) {
    const catArray = faultsByCategory.get(fault.category);
    if (catArray) {
        catArray.push(fault);
    }
}

function processOptimized() {
    let count = 0;
    const categoryEls = categories.map((cat) => {
        const faults = faultsByCategory.get(cat) || [];
        const faultEls = faults.map((fault) => {
            count++;
        });
    });
    return count;
}

const ITERATIONS = 100000;

// Warmup
for (let i = 0; i < 100; i++) {
    processBaseline();
    processOptimized();
}

const startBaseline = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    processBaseline();
}
const endBaseline = performance.now();

const startOptimized = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    processOptimized();
}
const endOptimized = performance.now();

const baselineTime = endBaseline - startBaseline;
const optimizedTime = endOptimized - startOptimized;

console.log(`Baseline: ${baselineTime.toFixed(2)}ms`);
console.log(`Optimized: ${optimizedTime.toFixed(2)}ms`);
console.log(`Improvement: ${(((baselineTime - optimizedTime) / baselineTime) * 100).toFixed(2)}%`);
