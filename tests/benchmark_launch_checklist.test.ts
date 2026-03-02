import { describe, it, expect, vi } from 'vitest';
import { LaunchChecklist } from '../src/safety/LaunchChecklist';

// Mock DOM
class MockElement {
    tagName: string;
    innerHTML = '';
    textContent = '';
    className = '';
    id = '';
    style = {};
    attributes: Record<string, string> = {};
    children: MockElement[] = [];
    classList = {
        add: vi.fn(),
        remove: vi.fn(),
        toggle: vi.fn(),
        contains: vi.fn(() => false)
    };

    constructor(tagName: string) {
        this.tagName = tagName;
    }

    setAttribute(name: string, value: string) {
        this.attributes[name] = value;
    }

    appendChild(child: MockElement) {
        this.children.push(child);
        this.innerHTML += child.tagName; // Rough approximation for tests
    }

    querySelector() {
        return null;
    }

    querySelectorAll() {
        return [];
    }

    dispatchEvent() {}
    addEventListener() {}
    removeEventListener() {}
}

const mockDoc = {
    getElementById: vi.fn(() => new MockElement('div')),
    createElement: vi.fn((tagName) => new MockElement(tagName)),
    createTextNode: vi.fn((text) => text)
};
vi.stubGlobal('document', mockDoc);

describe('LaunchChecklist getCompletionCount performance', () => {
    it('benchmark getCompletionCount', () => {
        const checklist = new LaunchChecklist('panel-id');

        // Let's create a larger checklist to make the benchmark more meaningful
        // Note: We bypass private visibility to setup the test data
        const originalItems = [...(checklist as any).items];
        const largeItems = [];
        for (let i = 0; i < 1000; i++) {
            const status = i % 3 === 0 ? 'go' : (i % 3 === 1 ? 'no-go' : 'pending');
            largeItems.push({
                id: `item-${i}`,
                label: `Item ${i}`,
                station: 'TEST',
                status: status as any
            });
        }
        (checklist as any).items = largeItems;

        const iterations = 10000;

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            checklist.getCompletionCount();
        }
        const end = performance.now();

        const timeElapsed = end - start;
        console.log(`[Benchmark] getCompletionCount took ${timeElapsed.toFixed(2)}ms for ${iterations} iterations with ${largeItems.length} items`);

        // Assert we get the correct result
        const result = checklist.getCompletionCount();
        expect(result.total).toBe(1000);
        expect(result.go).toBe(334);
        expect(result.noGo).toBe(333);
        expect(result.pending).toBe(333);
    });
});
