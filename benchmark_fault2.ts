import { performance } from 'perf_hooks';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><div id="fault-container"></div>');
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;

// Simplified DOMUtils to run benchmark
function createElement(tag: string, props: any = {}, children: any[] = []) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    for (const child of children) {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else {
            el.appendChild(child);
        }
    }
    return el;
}

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

const activeFaults = [
    { definition: FAULT_CATALOG[10], status: 'armed' },
    { definition: FAULT_CATALOG[20], status: 'injected' }
];

function renderBaseline() {
    const categoryLabels: Record<string, string> = {
        propulsion: '🔥 PROPULSION',
        avionics: '📡 AVIONICS',
        structure: '🏗️ STRUCTURE'
    };

    const containerEl = document.getElementById('fault-container')!;
    containerEl.textContent = '';

    const activeFaultsMap = new Map<string, any>(activeFaults.map((f) => [f.definition.id, f]));

    const categoryEls = categories.map((cat) => {
        const faults = FAULT_CATALOG.filter((f) => f.category === cat);
        const faultEls = faults.map((fault) => {
            const active = activeFaultsMap.get(fault.id);
            const statusClass =
                active?.status === 'injected' ? 'injected' : active?.status === 'armed' ? 'armed' : '';
            const statusLabel =
                active?.status === 'injected' ? '⚡ ACTIVE' : active?.status === 'armed' ? '🔴 ARMED' : '';

            const buttonChildren = [
                createElement('span', { className: 'fis-fault-name', textContent: fault.label })
            ];

            if (statusLabel) {
                buttonChildren.push(
                    createElement('span', { className: 'fis-fault-status', textContent: statusLabel })
                );
            }

            return createElement(
                'button',
                {
                    className: `fis-fault-btn ${statusClass}`,
                    'data-fault': fault.id,
                    title: fault.description,
                    'aria-pressed': active ? 'true' : 'false'
                },
                buttonChildren
            );
        });

        return createElement('div', { className: 'fis-category' }, [
            createElement('div', { className: 'fis-category-label', textContent: categoryLabels[cat] }),
            createElement('div', { className: 'fis-fault-grid' }, faultEls)
        ]);
    });
}

// Group faults by category once
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

function renderOptimized() {
    const categoryLabels: Record<string, string> = {
        propulsion: '🔥 PROPULSION',
        avionics: '📡 AVIONICS',
        structure: '🏗️ STRUCTURE'
    };

    const containerEl = document.getElementById('fault-container')!;
    containerEl.textContent = '';

    const activeFaultsMap = new Map<string, any>(activeFaults.map((f) => [f.definition.id, f]));

    const categoryEls = categories.map((cat) => {
        const faults = faultsByCategory.get(cat) || [];
        const faultEls = faults.map((fault) => {
            const active = activeFaultsMap.get(fault.id);
            const statusClass =
                active?.status === 'injected' ? 'injected' : active?.status === 'armed' ? 'armed' : '';
            const statusLabel =
                active?.status === 'injected' ? '⚡ ACTIVE' : active?.status === 'armed' ? '🔴 ARMED' : '';

            const buttonChildren = [
                createElement('span', { className: 'fis-fault-name', textContent: fault.label })
            ];

            if (statusLabel) {
                buttonChildren.push(
                    createElement('span', { className: 'fis-fault-status', textContent: statusLabel })
                );
            }

            return createElement(
                'button',
                {
                    className: `fis-fault-btn ${statusClass}`,
                    'data-fault': fault.id,
                    title: fault.description,
                    'aria-pressed': active ? 'true' : 'false'
                },
                buttonChildren
            );
        });

        return createElement('div', { className: 'fis-category' }, [
            createElement('div', { className: 'fis-category-label', textContent: categoryLabels[cat] }),
            createElement('div', { className: 'fis-fault-grid' }, faultEls)
        ]);
    });
}

const ITERATIONS = 1000;

// Warmup
for (let i = 0; i < 100; i++) {
    renderBaseline();
    renderOptimized();
}

const startBaseline = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    renderBaseline();
}
const endBaseline = performance.now();

const startOptimized = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    renderOptimized();
}
const endOptimized = performance.now();

const baselineTime = endBaseline - startBaseline;
const optimizedTime = endOptimized - startOptimized;

console.log(`Baseline: ${baselineTime.toFixed(2)}ms`);
console.log(`Optimized: ${optimizedTime.toFixed(2)}ms`);
console.log(`Improvement: ${(((baselineTime - optimizedTime) / baselineTime) * 100).toFixed(2)}%`);
