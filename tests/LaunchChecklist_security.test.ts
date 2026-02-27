
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { LaunchChecklist } from '../src/safety/LaunchChecklist';

describe('LaunchChecklist Security', () => {
    let dom: JSDOM;
    let container: HTMLElement;

    beforeEach(() => {
        // Setup JSDOM
        dom = new JSDOM('<!DOCTYPE html><div id="checklist-panel"></div>', {
            url: "http://localhost/",
            runScripts: "dangerously"
        });
        (globalThis as any).document = dom.window.document;
        (globalThis as any).window = dom.window;
        (globalThis as any).HTMLElement = dom.window.HTMLElement;

        container = document.getElementById('checklist-panel')!;
    });

    afterEach(() => {
        // Cleanup global mocks
        delete (globalThis as any).document;
        delete (globalThis as any).window;
        delete (globalThis as any).HTMLElement;
    });

    it('should NOT be vulnerable to XSS in checklist item labels (fix verification)', () => {
        const checklist = new LaunchChecklist('checklist-panel');

        // Access private items array
        const items = (checklist as any).items;

        // Inject malicious payload
        const maliciousPayload = '<img src=x onerror=alert("XSS")>';
        items[0].label = maliciousPayload;
        items[0].station = maliciousPayload;

        // Force render
        (checklist as any).render();

        // Check if the payload was rendered as raw HTML
        const html = container.innerHTML;

        // It should NOT contain the malicious tag
        expect(html).not.toContain(maliciousPayload);

        // It should contain the escaped version
        expect(html).toContain('&lt;img src=x onerror=alert("XSS")&gt;');

        // Verify it's NOT in the DOM structure as an element
        const imgTags = container.getElementsByTagName('img');
        expect(imgTags.length).toBe(0);
    });
});
