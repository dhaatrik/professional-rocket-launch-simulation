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

## 2024-03-12 - Destructive Action Protection in VAB
**Learning:** [UX: Loading presets or starting a "New Rocket" in the Vehicle Assembly Building completely overwrites the user's current vehicle design without warning, leading to potential data loss and frustration.]
**Action:** [Added a `window.confirm` dialog to the preset loading logic in `VABEditor.ts` to ensure users explicitly acknowledge that their current work will be overwritten before proceeding.]

## 2025-03-12 - Destructive Action Protection in ScriptEditor
**Learning:** [UX: Loading presets or saved scripts in the ScriptEditor completely overwrites the user's current script without warning, leading to potential data loss and frustration. This was similar to the issue found in the VABEditor preset loading.]
**Action:** [Added `window.confirm` dialogs to the preset and saved scripts loading logic in `ScriptEditor.ts` to ensure users explicitly acknowledge that their current work will be overwritten before proceeding.]

## 2025-03-22 - Important Form Inputs Missing Required State
**Learning:** [a11y: Important form inputs inside custom UI editors (like `script-name-input`, `vab-name-input`, and `target-alt-input`) lacked the `required` and `aria-required` attributes. This meant screen readers would not announce that filling out these fields is mandatory for the form to be valid or the action to succeed.]
**Action:** [Always include `required: true` and `aria-required: "true"` properties when instantiating mandatory input elements via `DOMUtils.createElement` to ensure correct screen reader accessibility.]

## 2024-03-24 - Buttons that open Modals Need ARIA HasPopup
**Learning:** [a11y: Buttons that open custom modal dialogs (like the VAB Editor, Script Editor, or Maneuver Planner) should inform screen reader users of this behavior beforehand. Without `aria-haspopup="dialog"`, users might expect an immediate action or navigation rather than a context shift to a modal.]
**Action:** [Always add `aria-haspopup="dialog"` to buttons whose primary action is opening a `role="dialog"` modal to set correct interaction expectations for assistive technologies.]

## 2025-03-30 - Prevent User Errors with Dynamic Action Buttons
**Learning:** [UX/a11y: Relying on reactive `alert` messages when a user clicks a button (e.g., launching an incomplete vehicle) creates friction and a poor experience. Furthermore, users using screen readers or navigating visually do not know the action is invalid until they attempt it.]
**Action:** [Dynamically disable primary action buttons (like the VAB "GO FOR LAUNCH" button) when the prerequisite conditions are not met. Always provide visual feedback (e.g., muted colors, `cursor: not-allowed`), `aria-disabled="true"`, and a descriptive `title` attribute explaining why the action is unavailable.]

## 2025-04-10 - String Booleans for DOMUtils ARIA Attributes
**Learning:** [a11y: When using `DOMUtils.createElement` to set ARIA attributes like `aria-pressed`, boolean values (`true` / `false`) were being incorrectly translated to empty strings `""` or completely omitted. This broke screen reader semantics for toggle buttons.]
**Action:** [Always explicitly pass string equivalents (`"true"` or `"false"`) when evaluating conditions for ARIA attributes in `DOMUtils.createElement` to ensure they are rendered correctly in the DOM.]
## 2024-10-24 - Dynamic ARIA Attributes in Game Loop
**Learning:** Adding dynamic ARIA attributes (like `aria-valuenow`) to UI elements that are updated inside the high-frequency game rendering loop (`src/core/Game.ts`) can break existing unit tests if the test suite uses simplified DOM mock objects that lack the `setAttribute` method.
**Action:** When adding DOM manipulation methods (like `setAttribute`) to game loop logic, always inspect the corresponding performance or comprehensive unit tests (e.g., `tests/Performance.test.ts`, `tests/HUD_comprehensive.test.ts`) and ensure the mock DOM elements are updated to include spy functions for those methods (e.g., `setAttribute: vi.fn()`).
## 2025-05-14 - Use aria-keyshortcuts for Keyboard Hints
**Learning:** [a11y: Screen readers do not reliably announce keyboard shortcuts when they are only included within `title` attributes. Users navigating with assistive technologies may miss these crucial interaction hints.]
**Action:** [Always add `aria-keyshortcuts` to buttons that have defined hotkeys so that screen readers can natively announce them to the user (e.g., `aria-keyshortcuts="Space"`, `aria-keyshortcuts="Alt+T"`).]
## 2026-04-11 - Added Escape Shortcut Hints to Modals
**Learning:** Users who heavily rely on keyboards or screen readers might not realize that modals (ScriptEditor, VABEditor, ManeuverPlanner) can be closed using the Escape key since the shortcut was implemented globally without visual or semantic hints.
**Action:** Add `aria-keyshortcuts='Escape'` to modal close buttons and append `[Esc]` to their `title` attributes to explicitly surface keyboard shortcuts to screen readers and mouse hover interactions.
