const voices = [
    { name: 'Microsoft David Desktop - English (United States)' },
    { name: 'Microsoft Zira Desktop - English (United States)' },
    { name: 'Google US English' },
    { name: 'Samantha' },
    { name: 'Alex' },
    { name: 'Daniel' }
];

function testCurrent() {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
        const preferred = voices.find((v) => v.name.includes('Google US English') || v.name.includes('Samantha'));
    }
    return performance.now() - start;
}

let cachedVoice = null;
function testCached() {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
        let preferred = cachedVoice;
        if (!preferred) {
            preferred = voices.find((v) => v.name.includes('Google US English') || v.name.includes('Samantha'));
            cachedVoice = preferred;
        }
    }
    return performance.now() - start;
}

const currentTime = testCurrent();
const cachedTime = testCached();

console.log(`Current: ${currentTime}ms`);
console.log(`Cached: ${cachedTime}ms`);
console.log(`Speedup: ${(currentTime / cachedTime).toFixed(2)}x`);
