import { describe, it, expect } from 'vitest';
import { UI_COLORS } from '../src/ui/UIConstants';

describe('UIConstants', () => {
    describe('UI_COLORS', () => {
        it('should be defined as an object', () => {
            expect(UI_COLORS).toBeDefined();
            expect(typeof UI_COLORS).toBe('object');
        });

        it('should contain the expected color constants', () => {
            expect(UI_COLORS.GREEN).toBe('#2ecc71');
            expect(UI_COLORS.YELLOW).toBe('#f1c40f');
            expect(UI_COLORS.ORANGE).toBe('#e67e22');
            expect(UI_COLORS.RED).toBe('#e74c3c');
            expect(UI_COLORS.GRAY).toBe('#95a5a6');
            expect(UI_COLORS.WHITE).toBe('#ffffff');
        });

        it('should have exactly 6 color properties', () => {
            expect(Object.keys(UI_COLORS).length).toBe(6);
        });
    });
});
