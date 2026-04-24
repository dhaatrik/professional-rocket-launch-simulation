# Tech Stack: DeltaV Lab

## Language
- **TypeScript:** Strict typing for mathematically precise calculations and maintainability across the complex simulation logic.

## Architecture & Frontend
- **Vanilla DOM & Web Workers:** Hyper-responsive interface bypassing heavy framework overhead. Physics computations (RK4 integration, atmospheric density models) are isolated within Web Workers running fixed time-steps off the main thread.

## Build & Tooling
- **esbuild:** Extremely fast bundling for TypeScript compilation and worker scripts.
- **Vitest:** Fast, native ES module testing framework for verifying complex orbital calculations and physics engine reliability.