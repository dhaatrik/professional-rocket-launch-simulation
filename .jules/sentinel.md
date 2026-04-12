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

## 2025-02-14 - Unvalidated JSON Parsing of Storage Data
**Vulnerability:** The `loadBlueprints` function parsed `localStorage` data directly using an `as string[]` type assertion and only checked `Array.isArray()`, allowing an attacker to inject objects or non-string elements which could break `deserializeBlueprint` assumptions.
**Learning:** Data retrieved from untrusted sources like `localStorage` must have every element of its parsed array strictly type-checked at runtime before being processed.
**Prevention:** Use `unknown` type for parsed JSON and apply runtime element-wise validation (e.g., `every(item => typeof item === 'string')`) instead of blindly trusting type assertions on array items.
