
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { VABEditor } from '../src/ui/VABEditor';

describe('VABEditor Accessibility', () => {
    let dom: any;
    let container: HTMLElement;

    beforeEach(() => {
        // Setup JSDOM
        dom = new JSDOM('<!DOCTYPE html><div id="vab-container"></div>');
        global.document = dom.window.document;
        global.window = dom.window;
        global.HTMLElement = dom.window.HTMLElement;

        container = document.getElementById('vab-container')!;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should have accessible labels on remove buttons', () => {
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);

        // Force render
        (editor as any).render();

        // There should be remove buttons if there are parts
        // Default blueprint has parts? VABEditor initializes with createFalconPreset()

        const removePartButtons = container.querySelectorAll('.remove-part');
        expect(removePartButtons.length).toBeGreaterThan(0);

        removePartButtons.forEach(btn => {
            expect(btn.hasAttribute('aria-label')).toBe(true);
            expect(btn.getAttribute('title')).toBeTruthy();
        });

        const removeStageButtons = container.querySelectorAll('.remove-stage');
        // Falcon preset has multiple stages
        if (removeStageButtons.length > 0) {
            removeStageButtons.forEach(btn => {
                expect(btn.hasAttribute('aria-label')).toBe(true);
                expect(btn.getAttribute('title')).toBeTruthy();
            });
        }
    });

    it('should display part icons in the catalog', () => {
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);
        (editor as any).render();

        const partIcons = container.querySelectorAll('.vab-part-icon');
        expect(partIcons.length).toBeGreaterThan(0);

        // Check if icons are not empty
        partIcons.forEach(icon => {
            expect(icon.textContent?.trim()).not.toBe('');
        });
    });

    it('should have an accessible label for the rocket name input', () => {
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);
        (editor as any).render();

        const input = container.querySelector('.vab-name-input');
        expect(input).not.toBeNull();
        expect(input?.hasAttribute('aria-label')).toBe(true);
        expect(input?.getAttribute('aria-label')).toBe('Rocket Name');
    });

    it('should display friendly empty state for stages', () => {
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);
        // Empty the blueprint
        (editor as any).blueprint.stages = [];
        (editor as any).render();

        const noStages = container.querySelector('.vab-no-stages');
        expect(noStages).not.toBeNull();
        expect(noStages?.textContent).toContain('🚀');
    });

    it('should have helpful tooltips on stats', () => {
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);
        (editor as any).render();

        const stats = container.querySelectorAll('.vab-stat');
        expect(stats.length).toBeGreaterThan(0);

        // Check a few critical stats for titles
        const dvStat = Array.from(stats).find(el => el.textContent?.includes('Total ΔV'));
        expect(dvStat?.getAttribute('title')).toContain('change in velocity');

        const twrStat = Array.from(stats).find(el => el.textContent?.includes('TWR'));
        expect(twrStat?.getAttribute('title')).toContain('Thrust-to-Weight Ratio');

        // Check indicators
        const avionics = container.querySelector('.vab-stat-indicator');
        expect(avionics?.getAttribute('title')).toBeTruthy();
    });
});
