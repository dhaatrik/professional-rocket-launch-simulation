## 2024-05-24 - Zero-Allocation Physics Loop
**Learning:** `forEach` and object literals `{}` inside hot loops (like physics integration running at 60-100Hz per entity) create unnecessary garbage collection pressure. While V8 optimizes `forEach`, the closure allocation adds up when running 1000s of times per frame (e.g., during time warp).
**Action:** Replace `forEach` with standard `for` loops in critical paths. Use `Object.freeze({})` for reused, empty, read-only configuration objects passed to update methods. Implement object pooling or reuse buffers (like `_newFailures` array) for methods that return collections frequently to avoid array allocation per call.
## 2024-05-24 - Zero-Allocation Environment Wind
**Learning:** Returning object literals `{}` inside hot loops from functions that compute math (like `vec2()`) creates unnecessary garbage collection pressure. This is especially true for math utility functions that are called in high frequency simulation loops.
**Action:** Replace `vec2(x,y)` with an optional `out?: Vector2D` parameter in functions like `getWindAtAltitude`. Use pre-allocated class properties (e.g., `this._windVelocityResult`) to return the result if `out` is not provided, allowing callers to completely avoid allocations.

## 2025-03-02 - FlightComputer.getCompletedCount Intermediate Array Allocation
**Learning:** `Array.prototype.filter().length` creates a hidden intermediate array allocation, which can become a significant performance bottleneck in functions that are queried frequently or on large collections (like script commands). Replacing it with a standard `for...of` loop and a local counter integer significantly decreases garbage collection overhead and execution time.
**Action:** When counting matching items in a collection, prefer explicit looping and counting over `.filter().length` in any performance-sensitive path or high-frequency update loops.

## 2025-03-02 - LaunchChecklist.getCompletionCount Array Reduce Overhead
**Learning:** Using `Array.prototype.reduce()` creates closure overhead and allocates a new accumulator object (or constantly mutates an object within a callback) which puts pressure on garbage collection when called frequently.
**Action:** When calculating statistics from arrays in hot paths or frequently updated UI components, prefer a standard `for` loop with local primitive counters over `.reduce()` to minimize object allocation.
