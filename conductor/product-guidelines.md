# Product Guidelines: DeltaV Lab

## Design Principles
- **Clarity Over Clutter:** The interface must prioritize mission-critical data over aesthetic embellishments. Telemetry and key flight stats must be instantly legible.
- **Scientific Accuracy First:** All calculations and visualizations must be rooted in verified physics and engineering principles. Avoid "arcade" physics simplifications unless strictly necessary for performance.
- **Responsive & Performant:** As an in-browser simulation relying on intense calculations, the UI should remain responsive, offloading heavy lifting to Web Workers.

## Branding & Voice
- **Tone:** Professional, precise, and educational. The language used should mirror that of actual mission control environments.
- **Terminology:** Use standard aerospace terminology (e.g., Delta-V, TWR, Apogee, Perigee, Specific Impulse) consistently.
- **Visual Style:** Clean, high-contrast themes suitable for analytical tools. Consider a "dark mode" default to match the context of space and mission control screens.

## User Experience (UX)
- **Accessibility:** Ensure high contrast for text and clear indicators for critical alerts (e.g., fuel depletion, anomalous temperature).
- **Progressive Disclosure:** Reveal complex features gradually. The Vehicle Assembly Building (VAB) should offer basic snapping first, with advanced tweaking available on demand.
- **Feedback & Feedback Loops:** Provide immediate visual and data-driven feedback for user inputs, especially during active flight phases.