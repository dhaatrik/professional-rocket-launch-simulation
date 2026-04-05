import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScriptEditor } from '../src/ui/ScriptEditor';
import { FlightComputer } from '../src/guidance/FlightComputer';

// Mock DOM
class MockHTMLElement {
    id: string = '';
    className: string = '';
    tagName: string = '';
    innerHTML: string = '';
    textContent: string = '';
    value: string = '';
    style: any = { display: '' };
    attributes: Record<string, string> = {};
    children: MockHTMLElement[] = [];
    classList = {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(),
    };
    options: any[] = []; // for select

    constructor(tagName: string = 'div') {
        this.tagName = tagName.toUpperCase();
    }

    getAttribute(name: string) {
        return this.attributes[name] || null;
    }

    setAttribute(name: string, value: string) {
        this.attributes[name] = value;
    }

    // Also mock set id, className etc if assigned directly
    set id_val(val: string) {
        this.id = val;
    }

    addEventListener() { }
    removeEventListener() { }
    focus() { }
    appendChild(child: MockHTMLElement) {
        this.children.push(child);
        return child;
    }

    // Minimal querySelector/remove/etc
    remove(index?: number) { }
    querySelector(selector: string) { return null; }
}

const mockDocument = {
    body: new MockHTMLElement('BODY'),
    createTextNode: (text: string) => text,
    getElementById: (id: string) => {
        const findIn = (el: MockHTMLElement | string): MockHTMLElement | null => {
            if (typeof el === 'string') return null;
            if (el.id === id) return el;
            for (const child of el.children || []) {
                const found = findIn(child);
                if (found) return found;
            }
            return null;
        };
        return findIn(mockDocument.body);
    },
    createElement: (tagName: string) => new MockHTMLElement(tagName),
    addEventListener: () => { },
};

// Need to implement mock setAttribute to also set properties if needed or track appropriately.
// MockHTMLElement already has setAttribute which saves to this.attributes.
// And getAttribute reads from this.attributes.

const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};

(globalThis as any).document = mockDocument;
(globalThis as any).window = {};
(globalThis as any).localStorage = mockLocalStorage;

describe('ScriptEditor Accessibility', () => {
    let editor: ScriptEditor;
    let flightComputer: FlightComputer;

    beforeEach(() => {
        // Reset DOM
        mockDocument.body = new MockHTMLElement('BODY');

        // Mock FlightComputer
        flightComputer = {
            state: { script: null },
            loadScript: vi.fn(),
        } as any;
    });

    it('should have aria-label on interactive elements', () => {
        // Mock Game object
        const mockGame: any = {
            flightComputer: flightComputer,
            command: vi.fn(),
            on: vi.fn(),
            addPhysicsEventListener: vi.fn()
        };

        // Instantiate editor
        editor = new ScriptEditor(mockGame);

        // Get the modal (it's appended to body)
        const modal = mockDocument.body.children[0];
        expect(modal).toBeDefined();

        // Helper to check attributes since we changed from innerHTML to a mocked DOM tree
        const getById = (id: string): MockHTMLElement | null => {
            const findIn = (el: any): MockHTMLElement | null => {
                if (!el || typeof el === 'string') return null;
                if (el.id === id) return el;
                // Also check attributes map because DOMUtils might use setAttribute('id', id)
                if (el.attributes && el.attributes['id'] === id) return el;

                for (const child of el.children || []) {
                    const found = findIn(child);
                    if (found) return found;
                }
                return null;
            };
            return findIn(mockDocument.body as MockHTMLElement);
        };

        // Assertions for Accessibility Attributes

        // 1. Close Button
        const closeBtn = getById('script-editor-close');
        expect(closeBtn).toBeDefined();
        expect(closeBtn?.getAttribute('aria-label')).toBe('Close script editor');
        expect(closeBtn?.getAttribute('title')).toBe('Close');

        // 2. Preset Select
        const presetSelect = getById('script-preset-select');
        expect(presetSelect).toBeDefined();
        expect(presetSelect?.getAttribute('aria-label')).toBe('Load preset script');

        // 3. Save Select
        const saveSelect = getById('script-save-select');
        expect(saveSelect).toBeDefined();
        expect(saveSelect?.getAttribute('aria-label')).toBe('Load saved script');

        // 4. Textarea
        const textarea = getById('script-textarea');
        expect(textarea).toBeDefined();
        expect(textarea?.getAttribute('aria-label')).toBe('Script editor content');

        // 5. Name Input
        const nameInput = getById('script-name-input');
        expect(nameInput).toBeDefined();
        expect(nameInput?.getAttribute('aria-label')).toBe('Script name');
    });
});

describe('ScriptEditor Syntax Highlighting Error Path', () => {
    let flightComputer: FlightComputer;
    let editor: ScriptEditor;

    beforeEach(() => {
        // Reset DOM
        mockDocument.body = new MockHTMLElement('BODY');

        // Mock FlightComputer
        flightComputer = {
            state: { script: null },
            loadScript: vi.fn(),
        } as any;

        const mockGame: any = {
            flightComputer: flightComputer,
            command: vi.fn(),
            on: vi.fn(),
            addPhysicsEventListener: vi.fn()
        };

        editor = new ScriptEditor(mockGame);
    });

    it('should test error path for catch block when localStorage parsing fails', () => {
        // Mock localStorage to return invalid JSON, forcing the catch block at line 407 to execute
        mockLocalStorage.getItem.mockReturnValue('{ invalid json payload }');

        // Instantiating the editor triggers updateSavedScriptsList -> getSavedScripts
        let newEditor: ScriptEditor | null = null;
        expect(() => {
            newEditor = new ScriptEditor((editor as any).game);
        }).not.toThrow();

        // Verify the fallback path inside the catch block was executed successfully, returning {}
        expect((newEditor as any).getSavedScripts()).toEqual({});
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith('rocket-sim-scripts');
    });

    it('should handle valid JSON but invalid schema in localStorage', () => {
        // Mock localStorage to return valid JSON but invalid schema (e.g., an array instead of a Record)
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(['this', 'is', 'not', 'a', 'record']));

        let newEditor = new ScriptEditor((editor as any).game);

        // Should return empty object due to validation failure
        expect((newEditor as any).getSavedScripts()).toEqual({});
    });

    it('should handle valid JSON but invalid script entry in localStorage', () => {
        // Mock localStorage to return a record but with missing required fields
        const invalidData = {
            'Broken Script': {
                text: 'WHEN ALTITUDE > 100 THEN STAGE',
                // script field is missing or malformed
                script: {
                    name: 'Broken Script'
                    // commands and createdAt are missing
                }
            }
        };
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(invalidData));

        let newEditor = new ScriptEditor((editor as any).game);

        // Should return empty object due to validation failure of the entry
        expect((newEditor as any).getSavedScripts()).toEqual({});
    });

    it('should return valid scripts from localStorage', () => {
        const validData = {
            'Valid Script': {
                text: 'WHEN ALTITUDE > 100 THEN STAGE',
                script: {
                    name: 'Valid Script',
                    commands: [
                        {
                            action: {
                                type: 'STAGE'
                            },
                            condition: {
                                clauses: [
                                    {
                                        operator: '>',
                                        value: 100,
                                        variable: 'ALTITUDE'
                                    }
                                ],
                                logicalOperators: []
                            },
                            id: 1,
                            oneShot: true,
                            rawText: 'WHEN ALTITUDE > 100 THEN STAGE',
                            state: 'pending'
                        }
                    ],
                    createdAt: Date.now()
                }
            }
        };
        mockLocalStorage.getItem.mockReturnValue(JSON.stringify(validData));

        let newEditor = new ScriptEditor((editor as any).game);

        // Since the new logic dynamically reconstructs the script using parseMissionScript,
        // it generates full command objects rather than exactly matching the mocked partial validData.
        const savedScripts = (newEditor as any).getSavedScripts();
        expect(savedScripts['Valid Script']).toBeDefined();
        expect(savedScripts['Valid Script'].text).toEqual(validData['Valid Script'].text);
        expect(savedScripts['Valid Script'].script.name).toEqual(validData['Valid Script'].script.name);
        expect(savedScripts['Valid Script'].script.createdAt).toEqual(validData['Valid Script'].script.createdAt);
        expect(savedScripts['Valid Script'].script.commands.length).toBe(1);
    });
});
