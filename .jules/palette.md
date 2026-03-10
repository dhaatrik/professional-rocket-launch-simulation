## 2024-03-01 - [Interactive Elements Need Focus Rings]
**Learning:** [a11y: Users navigating with keyboards need visible focus indicators to know which element is currently active. The application had interactive elements but lacked global `:focus-visible` styles, making keyboard navigation difficult.]
**Action:** [Added a global `:focus-visible` style rule to `public/style.css` using the existing `--color-primary` variable to provide a consistent and visible focus outline for all interactive elements like buttons and inputs. Also ensured that dynamic UI elements like the Mission Log toggle button update their `aria-expanded` state for screen reader users.]

## 2024-03-04 - [Dynamic Lists Need ARIA Live Regions]
**Learning:** [a11y: Dynamic lists that append content (like a Mission Log) will not announce updates to screen readers unless they are marked as ARIA live regions.]
**Action:** [Always add `aria-live="polite"` and `aria-relevant="additions"` to lists that receive real-time UI updates (like appending `<li>` tags) so visually impaired users don't miss important mission status updates.]
## 2024-03-05 - [Dynamic Status Indicators Need ARIA Live Regions]
**Learning:** [a11y: Dynamic status indicators that change text content (like Flight Computer mode or Black Box recording status) will not announce updates to screen readers unless they are marked as ARIA live regions with `aria-live="polite"` and `aria-atomic="true"`.]
**Action:** [Always add `aria-live="polite"` and `aria-atomic="true"` to dynamic text indicators (like `div` or `span` tags representing status) that receive real-time UI updates, so visually impaired users are aware of crucial state changes without needing to navigate to the element.]

## 2025-03-10 - Add Keyboard Navigation for Dialogs
**Learning:** Custom UI dialogs in this application (e.g. VABEditor, ManeuverPlanner) often lacked consistent keyboard accessibility, specifically dismissing with the Escape key, unlike the ScriptEditor which correctly implemented it. Using `role='dialog'` visually implies modal behavior, but keyboard handlers must be added manually.
**Action:** Always check custom dialog/modal components for `Escape` key close handlers to ensure keyboard navigability parity across the interface.
