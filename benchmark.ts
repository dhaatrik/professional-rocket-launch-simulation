import { JSDOM } from 'jsdom';
import { performance } from 'perf_hooks';

const dom = new JSDOM(`
  <html>
    <body>
      <div id="camera-panel">
        <button data-cam="1" class="active" aria-pressed="true">Cam 1</button>
        <button data-cam="2">Cam 2</button>
        <button data-cam="3">Cam 3</button>
      </div>
      <div>
        <button class="sas-btn active" id="sas-off" aria-pressed="true">OFF</button>
        <button class="sas-btn" id="sas-stability">STABILITY</button>
        <button class="sas-btn" id="sas-prograde">PROGRADE</button>
        <button class="sas-btn" id="sas-retrograde">RETROGRADE</button>
      </div>
    </body>
  </html>
`);

const document = dom.window.document;

function runBaselineSAS() {
    const btn = document.getElementById('sas-stability');
    for (let i = 0; i < 10000; i++) {
        document.querySelectorAll('.sas-btn').forEach((b) => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
    }
}

function runOptimizedSAS() {
    const btn = document.getElementById('sas-stability');
    const sasBtns = document.querySelectorAll('.sas-btn');
    for (let i = 0; i < 10000; i++) {
        sasBtns.forEach((b) => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
    }
}

function runBaselineCamera() {
    const btn = document.querySelector('[data-cam="2"]');
    for (let i = 0; i < 10000; i++) {
        document.querySelectorAll('#camera-panel button').forEach((b) => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
    }
}

function runOptimizedCamera() {
    const btn = document.querySelector('[data-cam="2"]');
    const cameraBtns = document.querySelectorAll('#camera-panel button');
    for (let i = 0; i < 10000; i++) {
        cameraBtns.forEach((b) => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
    }
}

// Warmup
runBaselineSAS();
runOptimizedSAS();
runBaselineCamera();
runOptimizedCamera();

// Measure
const iters = 10;
let baselineSASTime = 0;
let optSASTime = 0;
let baselineCamTime = 0;
let optCamTime = 0;

for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    runBaselineSAS();
    const t1 = performance.now();
    runOptimizedSAS();
    const t2 = performance.now();
    runBaselineCamera();
    const t3 = performance.now();
    runOptimizedCamera();
    const t4 = performance.now();

    baselineSASTime += (t1 - t0);
    optSASTime += (t2 - t1);
    baselineCamTime += (t3 - t2);
    optCamTime += (t4 - t3);
}

console.log('--- SAS Benchmark (10000 iterations * 10) ---');
console.log(`Baseline: ${baselineSASTime.toFixed(2)} ms`);
console.log(`Optimized: ${optSASTime.toFixed(2)} ms`);
console.log(`Improvement: ${((baselineSASTime - optSASTime) / baselineSASTime * 100).toFixed(2)}% faster`);

console.log('\\n--- Camera Benchmark (10000 iterations * 10) ---');
console.log(`Baseline: ${baselineCamTime.toFixed(2)} ms`);
console.log(`Optimized: ${optCamTime.toFixed(2)} ms`);
console.log(`Improvement: ${((baselineCamTime - optCamTime) / baselineCamTime * 100).toFixed(2)}% faster`);
