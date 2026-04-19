## 2026-04-16 - Mutating State in High-Frequency Physics Loops
**Learning:** Functions like `updateThermalState` and `updateGusts` that use object spread (`{ ...state }`) or return new objects (`vec2(0,0)`) create significant GC pressure when called multiple times per frame (e.g., inside RK4 integration loops).
**Action:** Refactor these hot-path functions to mutate the `currentState` object inline and return it, and use direct property assignments (`obj.x = ...`) instead of factory functions for vectors to eliminate unnecessary allocations. Update associated tests to cache initial state values before assertions.
## 2024-05-30 - Caching window.speechSynthesis.getVoices()
**Learning:** `window.speechSynthesis.getVoices()` is asynchronous and may return an empty array initially. Caching it too early without checking its length can result in a permanent cache miss.
**Action:** Always verify `voices.length > 0` before storing the result in a cache to ensure voices are actually loaded.
