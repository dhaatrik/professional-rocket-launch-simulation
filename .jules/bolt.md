## 2024-05-24 - Pre-Allocate Vectors Per Usage Context
**Learning:** When refactoring to reduce GC pressure by caching output objects as class properties, assigning a single shared instance across the class causes state mutation bugs during nested method calls (e.g., `getState` calls `isLaunchSafe` which would overwrite the shared output object before `getState` finished using it).
**Action:** Assign distinct pre-allocated properties per method or specific usage context to ensure state safety during nested calls while maintaining zero-allocation performance in hot paths.
