import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { VABEditor } from '../src/ui/VABEditor';

describe('VABEditor Core Functionality', () => {
    let dom: JSDOM;
    let container: HTMLElement;

    beforeEach(() => {
        // Setup JSDOM
        dom = new JSDOM('<!DOCTYPE html><div id="vab-container"></div>');
        global.document = dom.window.document;
        global.window = dom.window as any;
        global.HTMLElement = dom.window.HTMLElement;
        global.HTMLInputElement = dom.window.HTMLInputElement;

        // Mock localStorage
        const localStorageMock = (() => {
            let store: Record<string, string> = {};
            return {
                getItem: (key: string) => store[key] || null,
                setItem: (key: string, value: string) => {
                    store[key] = value.toString();
                },
                clear: () => {
                    store = {};
                },
                removeItem: (key: string) => {
                    delete store[key];
                }
            };
        })();
        global.localStorage = localStorageMock as any;

        // Mock alert
        global.alert = vi.fn();

        container = document.getElementById('vab-container')!;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize correctly with a container and onLaunch callback', () => {
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);

        expect(editor).toBeDefined();
        // The container should have content after initialization
        expect(container.innerHTML).toContain('Vehicle Assembly Building');
    });

    it('should throw an error if the container is not found', () => {
        const onLaunch = vi.fn();
        expect(() => {
            new VABEditor('non-existent-container', onLaunch);
        }).toThrow('Container non-existent-container not found');
    });

    it('should show the editor by changing display style', () => {
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);

        editor.show();
        expect(container.style.display).toBe('flex');
    });

    it('should hide the editor by changing display style', () => {
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);

        // First show it, then hide it
        editor.show();
        editor.hide();
        expect(container.style.display).toBe('none');
    });

    it('should return a valid vehicle blueprint', () => {
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);

        const blueprint = editor.getBlueprint();
        expect(blueprint).toBeDefined();
        expect(blueprint.id).toBeDefined();
        expect(blueprint.name).toBeDefined();
        expect(Array.isArray(blueprint.stages)).toBe(true);
    });

    it('should render main UI components', () => {
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);

        // Core UI sections
        expect(container.querySelector('.vab-header')).toBeTruthy();
        expect(container.querySelector('.vab-parts-panel')).toBeTruthy();
        expect(container.querySelector('.vab-preview-panel')).toBeTruthy();
        expect(container.querySelector('.vab-stages-panel')).toBeTruthy();
        expect(container.querySelector('.vab-stats-bar')).toBeTruthy();
        expect(container.querySelector('.vab-actions')).toBeTruthy();

        // Specific interactive elements
        expect(container.querySelector('.vab-name-input')).toBeTruthy();
        expect(container.querySelector('.vab-launch-btn')).toBeTruthy();
    });

    it('should trigger onLaunch callback when launch button is clicked and vehicle is ready', () => {
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);

        // The default preset (Falcon 9) should be ready to launch
        const launchBtn = container.querySelector('.vab-launch-btn') as HTMLElement;
        expect(launchBtn).toBeTruthy();

        launchBtn.click();

        expect(onLaunch).toHaveBeenCalledTimes(1);
        const blueprintArg = onLaunch.mock.calls[0][0];
        expect(blueprintArg).toBeDefined();
        expect(blueprintArg.stages.length).toBeGreaterThan(0);

        // Editor should be hidden after successful launch
        expect(container.style.display).toBe('none');
    });

    it('should show alert and not trigger onLaunch if vehicle has no stages', () => {
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);

        // Empty the blueprint stages
        (editor as any).blueprint.stages = [];
        (editor as any).render();

        const launchBtn = container.querySelector('.vab-launch-btn') as HTMLElement;
        launchBtn.click();

        expect(global.alert).toHaveBeenCalledWith('Vehicle not ready! Ensure you have stages and TWR > 1.0');
        expect(onLaunch).not.toHaveBeenCalled();
    });
});
