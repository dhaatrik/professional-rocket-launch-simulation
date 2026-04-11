## 2024-04-11 - Add aria-keyshortcuts to modals
**Learning:** Many modals in the application listen for the 'Escape' key globally (in `src/main.ts` or explicitly on document listeners), but the UI elements that act as visual close buttons (`×`) lack the `aria-keyshortcuts` attribute, meaning screen reader users are not informed of this standard capability.
**Action:** Always add `aria-keyshortcuts="Escape"` to modal or dialog close buttons that are backed by global or document-level Escape key event listeners to ensure accessibility alignment with the functional behavior.
