import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScriptEditor } from '../src/ui/ScriptEditor';
import { Game } from '../src/core/Game';

describe('ScriptEditor Accessibility Enhancements', () => {
    let editor: ScriptEditor;
    let mockGame: Game;

    beforeEach(() => {
        // Mock Game
        mockGame = {
            addPhysicsEventListener: vi.fn(),
            command: vi.fn(),
        } as unknown as Game;

        // Clean up DOM
        document.body.innerHTML = '';

        // Instantiate editor
        editor = new ScriptEditor(mockGame);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should have ARIA attributes for accessibility', () => {
        const textarea = document.getElementById('script-textarea') as HTMLTextAreaElement;
        const helpText = document.querySelector('.script-syntax-help');
        const errorContainer = document.getElementById('script-errors');

        expect(textarea).toBeTruthy();
        expect(helpText).toBeTruthy();
        expect(errorContainer).toBeTruthy();

        // Check for id on help text
        expect(helpText?.id).toBe('script-syntax-help');

        // Check for aria-describedby on textarea
        expect(textarea.getAttribute('aria-describedby')).toBe('script-syntax-help');

        // Check for aria-live on error container
        expect(errorContainer?.getAttribute('aria-live')).toBe('polite');
    });

    it('should update ARIA attributes on error', () => {
        const textarea = document.getElementById('script-textarea') as HTMLTextAreaElement;
        const errorContainer = document.getElementById('script-errors');

        // Trigger an error (invalid syntax)
        textarea.value = 'INVALID SYNTAX';
        editor.validate();

        // Check if error is displayed
        expect(errorContainer?.textContent).toContain('Line 1: Invalid syntax');

        // Check for role="alert" on error container
        expect(errorContainer?.getAttribute('role')).toBe('alert');

        // Check for aria-invalid on textarea
        expect(textarea.getAttribute('aria-invalid')).toBe('true');
    });

    it('should clear ARIA attributes on success', () => {
        const textarea = document.getElementById('script-textarea') as HTMLTextAreaElement;
        const errorContainer = document.getElementById('script-errors');

        // Trigger an error first
        textarea.value = 'INVALID SYNTAX';
        editor.validate();

        // Now correct the syntax
        textarea.value = 'WHEN ALTITUDE > 1000 THEN PITCH 80';
        editor.validate();

        // Check success message
        expect(errorContainer?.textContent).toContain('Valid script');

        // Check that role="alert" is removed or changed
        expect(errorContainer?.hasAttribute('role')).toBe(false);

        // Check for aria-invalid on textarea
        expect(textarea.getAttribute('aria-invalid')).toBe('false');
    });
});
