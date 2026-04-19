## 2026-04-16 - Mutating State in High-Frequency Physics Loops
**Learning:** Functions like `updateThermalState` and `updateGusts` that use object spread (`{ ...state }`) or return new objects (`vec2(0,0)`) create significant GC pressure when called multiple times per frame (e.g., inside RK4 integration loops).
**Action:** Refactor these hot-path functions to mutate the `currentState` object inline and return it, and use direct property assignments (`obj.x = ...`) instead of factory functions for vectors to eliminate unnecessary allocations. Update associated tests to cache initial state values before assertions.
## 2026-04-19 - FlightComputer Update Loop Iterator Allocation Optimization
**Learning:** The `update` method in `FlightComputer` is called every frame. Iterating over the `commands` array with a `for...of` loop creates an iterator object each frame, causing unnecessary garbage collection pressure and potentially leading to micro-stutters.
**Action:** Replaced the `for...of` iterator with a traditional indexed `for` loop, caching the array length. This optimization prevents the per-tick allocation overhead in high-frequency update loops.
