## 2026-02-13 - Keyboard Shortcuts & Safety
**Learning:** Resolving keyboard shortcut conflicts (e.g., FTS Arm vs SAS Toggle) is critical for UX, especially when the conflicting action is destructive (Arming Self-Destruct). Chorded shortcuts (e.g., `Alt+T`) add a safety layer for such actions and free up single keys for frequent non-destructive toggles.
**Action:** Always verify existing shortcuts (grep) and consider safety implications of single-key bindings for critical systems.

## 2026-02-14 - InnerHTML Updates vs Accessibility
**Learning:** Frequent UI updates using `innerHTML` (as seen in `ManeuverPlanner`) destroy the DOM and cause loss of focus/context for screen readers, especially in "live" dashboards.
**Action:** Prefer creating static HTML structures once and updating dynamic values via `textContent` or `innerText` on specific elements (IDs/Classes) to maintain DOM stability and accessibility.
