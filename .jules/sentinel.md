## 2024-05-23 - DOM Construction XSS Vulnerability
**Vulnerability:** Constructing DOM nodes using `innerHTML` with string interpolation can lead to Cross-Site Scripting (XSS).
**Learning:** Found string-based DOM construction in `LaunchChecklist.ts` and `FaultInjector.ts` using `.innerHTML = html`.
**Prevention:** Replaced `innerHTML` usage with safer DOM construction utility `createElement` from `src/ui/DOMUtils.ts` to ensure attributes and text content are safely handled.
