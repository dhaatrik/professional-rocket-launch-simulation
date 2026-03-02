## 2026-02-13 - Keyboard Shortcuts & Safety
**Learning:** Resolving keyboard shortcut conflicts (e.g., FTS Arm vs SAS Toggle) is critical for UX, especially when the conflicting action is destructive (Arming Self-Destruct). Chorded shortcuts (e.g., `Alt+T`) add a safety layer for such actions and free up single keys for frequent non-destructive toggles.
**Action:** Always verify existing shortcuts (grep) and consider safety implications of single-key bindings for critical systems.

## 2026-02-14 - InnerHTML Updates vs Accessibility
**Learning:** Frequent UI updates using `innerHTML` (as seen in `ManeuverPlanner`) destroy the DOM and cause loss of focus/context for screen readers, especially in "live" dashboards.
**Action:** Prefer creating static HTML structures once and updating dynamic values via `textContent` or `innerText` on specific elements (IDs/Classes) to maintain DOM stability and accessibility.

## 2026-02-15 - Accessible Error Validation
**Learning:** Custom form validation in `ScriptEditor` displayed errors in plain `div`s, failing to alert screen reader users of issues. This pattern likely exists elsewhere.
**Action:** Ensure all dynamic validation messages use `role="alert"` or `aria-live` and are programmatically linked to their input fields via `aria-describedby` and `aria-invalid`.
## 2026-02-28 - Added missing a11y labels to Maneuver Planner elements
**Learning:** Found that some UI elements in Maneuver Planner lacked explicit `aria-label` for `select` inputs and `for` associations for `label` elements pointing to inputs, leading to poorer screen reader accessibility.
**Action:** Always verify that generic inputs like `select` have descriptive `aria-label`s or are explicitly linked via a `label` `for` attribute.

## 2026-03-02 - Focus Management for Custom Modals
**Learning:** Custom overlay elements like tooltips or onboarding dialogs disrupt keyboard navigation if they don't explicitly trap or direct focus upon opening and closing, forcing users to tab through the entire DOM to reach them.
**Action:** Always add `role="dialog"` and `aria-modal="true"` to such overlays, and use JavaScript to explicitly set focus to the primary action button when shown, and return focus to the invoking element when dismissed.
