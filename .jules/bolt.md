## 2026-04-16 - Mutating State in High-Frequency Physics Loops
**Learning:** Functions like `updateThermalState` and `updateGusts` that use object spread (`{ ...state }`) or return new objects (`vec2(0,0)`) create significant GC pressure when called multiple times per frame (e.g., inside RK4 integration loops).
**Action:** Refactor these hot-path functions to mutate the `currentState` object inline and return it, and use direct property assignments (`obj.x = ...`) instead of factory functions for vectors to eliminate unnecessary allocations. Update associated tests to cache initial state values before assertions.
## 2024-05-30 - Caching window.speechSynthesis.getVoices()
**Learning:** `window.speechSynthesis.getVoices()` is asynchronous and may return an empty array initially. Caching it too early without checking its length can result in a permanent cache miss.
**Action:** Always verify `voices.length > 0` before storing the result in a cache to ensure voices are actually loaded.
## 2024-06-25 - Array.push Overhead in Render Loops
**Learning:** In high-frequency rendering loops (e.g., `drawWindVectors` in `Game.ts` which processes hundreds of vertices per frame), `Array.prototype.push()` introduces significant function call overhead compared to direct indexed assignment (`arr[idx++] = val`).
**Action:** Replace `.push()` with direct index assignments when populating batch arrays in performance-critical paths, especially when the arrays are cleared (`length = 0`) and reused every frame.
## 2026-04-22 - O(N) Array Shift in Queues
**Learning:** Using `Array.prototype.shift()` to remove elements from the front of an array-backed queue introduces O(N) overhead because all remaining elements must be shifted in memory, which degrades performance in high-frequency loops.
**Action:** Replace `shift()` operations with a `head` index pointer to track the queue's front, and periodically compact the array using `slice()` when the `head` index exceeds half the array length to prevent infinite memory scaling while maintaining amortized O(1) performance.
