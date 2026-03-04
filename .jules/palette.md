## 2024-03-01 - [Interactive Elements Need Focus Rings]
**Learning:** [a11y: Users navigating with keyboards need visible focus indicators to know which element is currently active. The application had interactive elements but lacked global `:focus-visible` styles, making keyboard navigation difficult.]
**Action:** [Added a global `:focus-visible` style rule to `public/style.css` using the existing `--color-primary` variable to provide a consistent and visible focus outline for all interactive elements like buttons and inputs. Also ensured that dynamic UI elements like the Mission Log toggle button update their `aria-expanded` state for screen reader users.]

## 2024-03-04 - [Dynamic Lists Need ARIA Live Regions]
**Learning:** [a11y: Dynamic lists that append content (like a Mission Log) will not announce updates to screen readers unless they are marked as ARIA live regions.]
**Action:** [Always add `aria-live="polite"` and `aria-relevant="additions"` to lists that receive real-time UI updates (like appending `<li>` tags) so visually impaired users don't miss important mission status updates.]