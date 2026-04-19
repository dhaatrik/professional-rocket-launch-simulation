import { readFileSync } from 'fs';
const content = readFileSync('tests/benchmark_thermal_logging.test.ts', 'utf8');
const lines = content.split('\n');
console.log(lines[107]);
