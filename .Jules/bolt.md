## 2024-05-23 - Entity Serialization Optimization
**Learning:** The physics engine uses a SharedArrayBuffer for zero-copy communication, but the serialization/deserialization step (`postState` in worker, `syncView` in proxy) was using extensive `instanceof` checks to map class instances to integer IDs. This O(N) type checking (where N is number of subclasses) in a hot loop (every frame * every entity) adds up.
**Action:** Implemented a `readonly type` property (enum) on the base `Vessel` class and overrode it in subclasses. This replaces the `instanceof` chain with a single property access, significantly reducing overhead in the serialization hot path. Future entity types should follow this pattern.

## 2024-05-24 - Entity Type Check Optimization Verification
**Learning:** Verified the "type property vs instanceof" optimization in `PhysicsWorker`. Benchmarks showed a 1.12x speedup in a mixed-entity scenario. While V8 optimizes `instanceof` well for monomorphic sites, the polymorphic nature of the entity loop makes property access consistently faster and architecturally cleaner (avoiding prototype chain walks).
**Action:** Replaced remaining `instanceof` checks in `PhysicsWorker.ts` (specifically in `performStaging` and `postState`) with `EntityType` checks.
