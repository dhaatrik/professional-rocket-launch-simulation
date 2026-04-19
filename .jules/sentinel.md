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
## 2026-04-19 - Replacing weak PRNG in visual effects
**Vulnerability:** Weak PRNG `Math.random()` used in visual canvas rendering.
**Learning:** Even though it was for visual jitter on a canvas, replacing it ensures strict adherence to security rules and avoids potential linter flags or side-channel concerns if PRNG states bleed.
**Prevention:** Use `MathUtils.secureRandom()` consistently throughout the codebase for all randomness, including visual effects.
