import { Particle } from './src/physics/Particle.ts';

// Mock Canvas Context
class MockCtx {
    fillStyle = '';
    beginPath() {}
    rect() {}
    moveTo() {}
    arc() {}
    fill() {}
}

const ctx = new MockCtx() as any;

// Generate particles
const particles: Particle[] = [];
for (let i = 0; i < 10000; i++) {
    const type = ['smoke', 'fire', 'spark', 'debris'][i % 4] as any;
    particles.push(new Particle(100, 100, type, 1, 1));
}

// Warmup
for (let i = 0; i < 100; i++) {
    Particle.drawParticles(ctx, particles);
}

// Measure
const start = performance.now();
for (let i = 0; i < 1000; i++) {
    Particle.drawParticles(ctx, particles);
}
const end = performance.now();

console.log(`Time taken: ${(end - start).toFixed(2)}ms`);
