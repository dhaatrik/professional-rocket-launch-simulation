## 2024-05-23 - DOM Construction XSS Vulnerability
**Vulnerability:** Constructing DOM nodes using `innerHTML` with string interpolation can lead to Cross-Site Scripting (XSS).
**Learning:** Found string-based DOM construction in `LaunchChecklist.ts` and `FaultInjector.ts` using `.innerHTML = html`.
**Prevention:** Replaced `innerHTML` usage with safer DOM construction utility `createElement` from `src/ui/DOMUtils.ts` to ensure attributes and text content are safely handled.

## 2024-05-23 - Insecure Deserialization Vulnerability
**Vulnerability:** Directly casting untrusted JSON data to interfaces bypassing validation.
**Learning:** Found insecure parsing in `FlightDataParser.ts` where returning `data as FlightFrame[]` allowed potentially untrusted structures.
**Prevention:** Ensured the code validates arrays through the field-by-field manual object reconstruction loop.

## 2024-06-05 - Insecure Deserialization in FlightScript
**Vulnerability:** Deserializing `MissionScript` from JSON returned the parsed object directly using `as unknown as MissionScript`, which could allow untrusted or malicious properties, including prototype pollution.
**Learning:** Found insecure parsing in `FlightScript.ts` where returning the parsed object directly bypasses structural integrity.
**Prevention:** Ensured the code validates and manually reconstructs the `MissionScript` object, its `commands`, `condition`, and `action` structures.

## 2024-06-06 - Reverse Tabnabbing Vulnerability
**Vulnerability:** Using window.open() without noopener and noreferrer features exposes the application to reverse tabnabbing vulnerabilities, where the newly opened tab can control the original window.
**Learning:** Found a window.open call in src/main.ts that lacked the necessary security features.
**Prevention:** Always append 'noopener,noreferrer' to the features string when calling window.open() to open untrusted or even trusted but potentially compromised URLs.
## 2026-04-13 - [Insecure Origin Validation Bypass]
**Vulnerability:** A BroadcastChannel/postMessage origin check used `if (event.origin && event.origin !== window.location.origin)`, which allowed an attacker to bypass the validation if `event.origin` evaluated to a falsy value (e.g., an empty string from a `data:` or `file:` context).
**Learning:** Checking for truthiness of `event.origin` before checking the strict match allows untrusted/null origins to silently bypass origin restrictions, as the entire condition becomes false and the listener proceeds.
**Prevention:** Always use a direct strict equality check `if (event.origin !== expectedOrigin)` for origin validation to fail safely and block all unverified or missing origins.
## 2026-04-16 - Insecure Array Deserialization Bypass
**Vulnerability:** Deserializing JSON data allowed arrays to bypass generic object type checks (typeof === 'object'), enabling potential array structure abuse downstream.
**Learning:** In JavaScript, `typeof []` evaluates to `'object'`. If JSON parsing logic expects a standard object but receives an array, it may pass the `typeof` check but fail later during property accesses or cause unexpected behavior if properties are iterated or accessed blindly.
**Prevention:** When deserializing generic JSON data to an object, always explicitly check `!Array.isArray(data)` in addition to `typeof data === 'object'` to prevent array inputs from bypassing property validation logic.
## 2026-04-18 - Missing Input Length Limits (DoS Risk)
**Vulnerability:** Dynamically created text inputs and textareas lacked `maxLength` properties, which could allow users or automated scripts to paste excessively large strings, potentially causing a Denial of Service (DoS) due to memory exhaustion or parsing overhead on the client.
**Learning:** Found several UI editor inputs (e.g., in `ScriptEditor.ts` and `VABEditor.ts`) constructed via `createElement` that omitted explicit length constraints.
**Prevention:** Always enforce `maxLength` attributes when dynamically generating text input elements to ensure safe upper bounds on payload size.
## 2024-05-24 - Unsafe Math.random Usage in Particles
**Vulnerability:** Predictable random number generation used in `src/physics/Particle.ts` via `Math.random()`.
**Learning:** Even visual particle behaviors can trigger security linters that strictly ban predictable PRNGs. Mocking rules change when updating code - replacing global `Math.random` requires also updating test files to properly mock `MathUtils.secureRandom`.
**Prevention:** Consistently use the project's secure random generation utilities (like `MathUtils.secureRandom()`) everywhere instead of global `Math.random()`.
