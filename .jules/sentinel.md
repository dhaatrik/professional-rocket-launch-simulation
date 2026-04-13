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
