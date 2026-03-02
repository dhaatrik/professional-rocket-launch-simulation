
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VABEditor } from '../src/ui/VABEditor';
import * as VehicleBlueprint from '../src/vab/VehicleBlueprint';

// Mock the module
vi.mock('../src/vab/VehicleBlueprint', async () => {
    const actual = await vi.importActual('../src/vab/VehicleBlueprint');
    return {
        ...actual,
        createFalconPreset: () => ({
            name: 'Hacked Rocket',
            id: 'hacked-1',
            createdAt: 123,
            modifiedAt: 123,
            stages: [{
                stageNumber: 0,
                hasDecoupler: false,
                parts: [{
                    part: {
                        id: 'engine-merlin-1d',
                        name: 'Merlin 1D',
                        category: 'engine',
                        mass: 470,
                        height: 25,
                        width: 30,
                        cost: 1000,
                        description: 'High-thrust kerolox engine',
                    },
                    instanceId: '"><img src=x onerror=alert(1)>', // XSS Payload
                    stageIndex: 0
                }]
            }]
        }),
        loadBlueprints: () => []
    };
});

// Mock DOM
class MockElement {
    innerHTML = '';
    value = '';
    style = { display: '' };
    attributes: Record<string, string> = {};
    dataset: Record<string, string> = {};
    childNodes: any[] = [];
    classList = {
        add: () => {},
        remove: () => {},
        contains: () => false
    };

    querySelector() { return new MockElement(); }
    querySelectorAll() { return [new MockElement()]; }
    addEventListener() {}
    setAttribute(name: string, val: string) {
        this.attributes[name] = val;
    }
    getAttribute(name: string) {
        return this.attributes[name] || null;
    }
    appendChild(child: any) {
        this.childNodes.push(child);
    }
}

global.document = {
    getElementById: () => new MockElement(),
    createElement: () => new MockElement(),
    createTextNode: (text: string) => text,
    body: { appendChild: () => {} },
} as any;

global.alert = () => {};

describe('Security Vulnerability Reproduction', () => {
    it('should show that unescaped instanceId can lead to XSS', () => {
        // Instantiate VABEditor
        // This will call the mocked createFalconPreset()
        const editor = new VABEditor('vab-container', () => {});

        // Check mocked innerHTML/attributes
        // Since we are no longer using innerHTML, we must verify the attribute directly
        const container = (editor as any).container;
        const editorElement = container.childNodes[0]; // vab-editor div
        const main = editorElement.childNodes[1]; // vab-main
        const previewPanel = main.childNodes[1]; // vab-preview-panel
        const display = previewPanel.childNodes[1]; // vab-vehicle-display

        // Find the instance
        let foundSafeId = false;
        let foundDangerousId = false;
        const dangerousId = '"><img src=x onerror=alert(1)>';
        const searchNodes = [display];

        while(searchNodes.length > 0) {
            const node = searchNodes.pop();
            if (node.attributes && node.attributes['data-instance']) {
                if (node.attributes['data-instance'] === dangerousId) {
                    foundDangerousId = true;
                }
            }
            if (node.childNodes) {
                searchNodes.push(...node.childNodes);
            }
        }

        // Assert that DOMUtils handles the attribute setting natively (which is safe),
        // or the property was not injected as raw HTML string.
        // In the new createElement implementation, setting attributes via setAttribute is safe
        // because the browser treats them as text, not HTML.
        // The value is preserved but safe.
        expect(foundDangerousId).toBe(true); // setAttribute("data-instance", dangerousId) is inherently safe
    });
});
