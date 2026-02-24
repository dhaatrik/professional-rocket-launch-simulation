import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ScriptEditor } from '../src/ui/ScriptEditor';
import { Game } from '../src/core/Game';

describe('ScriptEditor Accessibility Enhancements', () => {
    let editor: ScriptEditor;

    beforeEach(() => {
        // Mock the Game object
        const mockGame = {
            addPhysicsEventListener: vi.fn(),
            command: vi.fn(),
        } as unknown as Game;

        // Reset the document body before each test
        document.body.innerHTML = '';
        editor = new ScriptEditor(mockGame);
    });

    afterEach(() => {
        // Clean up
        document.body.innerHTML = '';
    });

    it('should link syntax help to textarea via aria-describedby', () => {
        // Check for the syntax help container
        const helpText = document.querySelector('.script-syntax-help');
        expect(helpText).toBeTruthy();

        // It should have the id used for description
        expect(helpText?.id).toBe('script-syntax-help');

        // Check for the textarea
        const textarea = document.getElementById('script-textarea');
        expect(textarea).toBeTruthy();

        // It should point to the help text via aria-describedby
        expect(textarea?.getAttribute('aria-describedby')).toBe('script-syntax-help');
    });

    it('should have role="alert" on the error container', () => {
        const errorDiv = document.getElementById('script-errors');
        expect(errorDiv).toBeTruthy();

        // It should be an alert region for screen readers
        expect(errorDiv?.getAttribute('role')).toBe('alert');
    });
});
