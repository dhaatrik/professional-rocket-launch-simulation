import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createElement, escapeHTML } from '../src/ui/DOMUtils';

describe('DOMUtils', () => {
    describe('createElement', () => {
        let dom: JSDOM;

        beforeEach(() => {
            dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
            global.document = dom.window.document;
            global.HTMLElement = dom.window.HTMLElement;
            global.Node = dom.window.Node;
            global.HTMLLabelElement = dom.window.HTMLLabelElement;
        });

        afterEach(() => {
            // @ts-ignore
            delete global.document;
            // @ts-ignore
            delete global.HTMLElement;
            // @ts-ignore
            delete global.Node;
            // @ts-ignore
            delete global.HTMLLabelElement;
        });

        it('should create an element with the correct tag name', () => {
            const el = createElement('div');
            expect(el.tagName.toLowerCase()).toBe('div');
        });

        it('should set standard attributes correctly', () => {
            const el = createElement('input', { id: 'test-id', type: 'text' });
            expect(el.id).toBe('test-id');
            expect(el.getAttribute('type')).toBe('text');
        });

        it('should handle className specifically', () => {
            const el = createElement('div', { className: 'test-class another-class' });
            expect(el.className).toBe('test-class another-class');
            expect(el.getAttribute('class')).toBe('test-class another-class');
        });

        it('should handle textContent specifically', () => {
            const el = createElement('span', { textContent: 'Hello World' });
            expect(el.textContent).toBe('Hello World');
        });

        it('should handle htmlFor on label elements specifically', () => {
            const el = createElement('label', { htmlFor: 'input-id' }) as HTMLLabelElement;
            expect(el.htmlFor).toBe('input-id');
        });

        it('should not handle htmlFor on non-label elements specifically', () => {
            const el = createElement('div', { htmlFor: 'input-id' });
            expect(el.getAttribute('htmlFor')).toBe('input-id');
        });

        it('should handle style object correctly', () => {
            const el = createElement('div', { style: { color: 'red', backgroundColor: 'blue' } });
            expect(el.style.color).toBe('red');
            expect(el.style.backgroundColor).toBe('blue');
        });

        it('should handle boolean attributes correctly', () => {
            const el = createElement('input', { disabled: true, required: false });
            expect(el.hasAttribute('disabled')).toBe(true);
            expect(el.getAttribute('disabled')).toBe('');
            expect(el.hasAttribute('required')).toBe(false);
        });

        it('should append string children as TextNodes', () => {
            const el = createElement('div', {}, ['Child 1', 'Child 2']);
            expect(el.childNodes.length).toBe(2);
            expect(el.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
            expect(el.childNodes[0].textContent).toBe('Child 1');
            expect(el.childNodes[1].nodeType).toBe(Node.TEXT_NODE);
            expect(el.childNodes[1].textContent).toBe('Child 2');
        });

        it('should append Node children', () => {
            const child1 = document.createElement('span');
            const child2 = document.createElement('strong');
            const el = createElement('div', {}, [child1, child2]);
            expect(el.childNodes.length).toBe(2);
            expect(el.childNodes[0]).toBe(child1);
            expect(el.childNodes[1]).toBe(child2);
        });

        it('should ignore false boolean attributes entirely', () => {
             const el = createElement('button', { disabled: false });
             expect(el.hasAttribute('disabled')).toBe(false);
        });
    });

    describe('escapeHTML', () => {
        it('should escape &, <, >, ", and \' characters', () => {
            const unsafe = '<div>"Hello" & \'World\'</div>';
            const safe = escapeHTML(unsafe);
            expect(safe).toBe('&lt;div&gt;&quot;Hello&quot; &amp; &#039;World&#039;&lt;/div&gt;');
        });

        it('should return the original string if no special characters are present', () => {
            const safeStr = 'Hello World 123';
            expect(escapeHTML(safeStr)).toBe(safeStr);
        });

        it('should handle empty strings', () => {
            expect(escapeHTML('')).toBe('');
        });
    });
});
