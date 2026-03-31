import { performance } from 'perf_hooks';

interface ChecklistItem {
    id: string;
    status: string;
}

// Setup
const count = 100;
const iterations = 10000;
const items: ChecklistItem[] = [];
for (let i = 0; i < count; i++) {
    items.push({ id: `item-${i}`, status: 'pending' });
}

const itemMap = new Map<string, ChecklistItem>();
for (const item of items) {
    itemMap.set(item.id, item);
}

// Test Array.find
let start = performance.now();
for (let i = 0; i < iterations; i++) {
    for (let j = 0; j < count; j++) {
        const id = `item-${j}`;
        const item = items.find((x) => x.id === id);
        if (item) item.status = 'go';
    }
}
let end = performance.now();
const arrayTime = end - start;
console.log(`Array.find time: ${arrayTime.toFixed(2)} ms`);

// Test Map.get
start = performance.now();
for (let i = 0; i < iterations; i++) {
    for (let j = 0; j < count; j++) {
        const id = `item-${j}`;
        const item = itemMap.get(id);
        if (item) item.status = 'go';
    }
}
end = performance.now();
const mapTime = end - start;
console.log(`Map.get time: ${mapTime.toFixed(2)} ms`);
console.log(`Improvement: ${(arrayTime / mapTime).toFixed(2)}x faster`);
