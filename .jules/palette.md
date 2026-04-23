## 2026-04-11 - Added Escape Shortcut Hints to Modals
**Learning:** Users who heavily rely on keyboards or screen readers might not realize that modals (ScriptEditor, VABEditor, ManeuverPlanner) can be closed using the Escape key since the shortcut was implemented globally without visual or semantic hints.
**Action:** Add `aria-keyshortcuts='Escape'` to modal close buttons and append `[Esc]` to their `title` attributes to explicitly surface keyboard shortcuts to screen readers and mouse hover interactions.
## 2026-04-14 - Indicate New Window Context Change
**Learning:** [a11y: Buttons that open links in a new window or tab (e.g., using `window.open`) must communicate this context change to screen readers. The `aria-haspopup` attribute does not accept "window" as a valid value according to the WAI-ARIA specification.]
**Action:** [Instead of using an invalid `aria-haspopup="window"`, append a visually hidden text like `(opens in new window)` to the button's content, or explicitly append it to the `title` or `aria-label` attribute to properly notify assistive technologies.]

## 2026-04-14 - Standard Accessibility Attributes for Custom Modals
**Learning:** [a11y: Custom modal overlays created with a `div` element instead of the native `<dialog>` must include standard accessibility attributes to function correctly with screen readers.]
**Action:** [Always ensure custom modal overlays have `role="dialog"`, `aria-modal="true"`, and an `aria-labelledby` attribute pointing to the ID of the modal's title element.]

## 2026-04-20 - Consolidate Event Listeners for ARIA State
**Learning:** When a UI component has multiple event listeners bound to it or its parents that toggle the same visual state (like `.collapsed`), it creates race conditions or canceled actions where the visual state toggles back and forth but the ARIA attributes (like `aria-expanded`) fail to stay in sync.
**Action:** Always ensure that state-toggling logic is centralized in one place (preferably within the component's own file), and bind the listener to the largest possible click target (like an `h3` header) while explicitly maintaining ARIA attributes on the interactive element (like the `<button>`) within that same centralized logic.

## 2026-04-23 - Adding interactive elements to pass-through overlays
**Learning:** [When adding buttons to full-screen UI overlays that use `pointer-events: none` to allow clicks to pass through to an underlying 3D scene, do not toggle `pointer-events: auto` on the entire overlay when it's open. This causes the overlay container to swallow all clicks. Instead, `pointer-events: none` on a parent can be overridden by specific interactive child elements by directly setting `pointer-events: auto` on the child.]
**Action:** [Apply `pointer-events: auto` explicitly to the newly added button (`#mc-close-btn`), not the `#mission-control-overlay`.]
