## 2024-05-23 - DOM Construction XSS Vulnerability
**Vulnerability:** Constructing DOM nodes using `innerHTML` with string interpolation can lead to Cross-Site Scripting (XSS).
**Learning:** Found string-based DOM construction in `LaunchChecklist.ts` and `FaultInjector.ts` using `.innerHTML = html`.
**Prevention:** Replaced `innerHTML` usage with safer DOM construction utility `createElement` from `src/ui/DOMUtils.ts` to ensure attributes and text content are safely handled.

## 2024-05-23 - Insecure Deserialization Vulnerability
**Vulnerability:** Directly casting untrusted JSON data to interfaces bypassing validation.
**Learning:** Found insecure parsing in `FlightDataParser.ts` where returning `data as FlightFrame[]` allowed potentially untrusted structures.
**Prevention:** Ensured the code validates arrays through the field-by-field manual object reconstruction loop.
