
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { VABEditor } from '../src/ui/VABEditor';

describe('VABEditor Security', () => {
    let dom: any;
    let container: any;

    beforeEach(() => {
        // Setup JSDOM
        dom = new JSDOM('<!DOCTYPE html><div id="vab-container"></div>', {
            url: "http://localhost/",
            runScripts: "dangerously",
            resources: "usable"
        });
        (globalThis as any).document = dom.window.document;
        (globalThis as any).window = dom.window;
        (globalThis as any).HTMLElement = dom.window.HTMLElement;
        (globalThis as any).HTMLInputElement = dom.window.HTMLInputElement;

        // Mock localStorage
        const localStorageMock = (function () {
            let store: Record<string, string> = {};
            return {
                getItem: function (key: string) {
                    return store[key] || null;
                },
                setItem: function (key: string, value: string) {
                    store[key] = value.toString();
                },
                clear: function () {
                    store = {};
                },
                removeItem: function (key: string) {
                    delete store[key];
                }
            };
        })();
        (globalThis as any).localStorage = localStorageMock;

        container = document.getElementById('vab-container')!;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should not be vulnerable to XSS in blueprint name', () => {
        // Instantiate VABEditor
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);

        // Inject malicious payload into blueprint name
        const maliciousName = '"><script>alert("XSS")</script>';
        // Access private property blueprint using 'any' cast or indexing
        (editor as any).blueprint.name = maliciousName;

        // Force render (private method)
        (editor as any).render();

        const input = container.querySelector('.vab-name-input') as HTMLInputElement;
        expect(input).toBeDefined();

        // The value property should contain the malicious string
        expect(input.value).toBe(maliciousName);

        // The outerHTML of the input should NOT contain the script tag outside of the value attribute
        // If it was injected via innerHTML template string, we would see: <input value=""><script>...

        // Check HTML content for script tags
        const html = container.innerHTML;

        // Check for script tag presence
        const scripts = container.getElementsByTagName('script');
        expect(scripts.length).toBe(0);

        // Also ensure the HTML string doesn't look suspicious
        // If vulnerable: <input ... value=""><script>...</script>" ...>
        // If safe: <input ... value=""> (value set via property)
        expect(html).not.toContain('<script>');

        // Ensure the value attribute in HTML is empty or non-existent (proving it wasn't interpolated)
        const attrValue = input.getAttribute('value');
        expect(attrValue === '' || attrValue === null).toBe(true);
    });

    it('should safely display blueprint name in input', () => {
        const onLaunch = vi.fn();
        const editor = new VABEditor('vab-container', onLaunch);
        const safeName = 'My Rocket';
        (editor as any).blueprint.name = safeName;
        (editor as any).render();

        const input = container.querySelector('.vab-name-input') as HTMLInputElement;
        expect(input.value).toBe(safeName);
    });
});
