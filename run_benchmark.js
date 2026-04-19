import { performance } from 'perf_hooks';
import { readFileSync } from 'fs';

// Since we cannot run vitest with tracing easily here, we'll write a node benchmark
// that creates arrays and does for-of vs for-loop.
// Actually, vitest output works.
