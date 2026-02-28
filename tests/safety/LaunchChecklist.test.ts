import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LaunchChecklist } from '../../src/safety/LaunchChecklist';

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

describe('LaunchChecklist', () => {
    let checklist: LaunchChecklist;

    beforeEach(() => {
        checklist = new LaunchChecklist('panel-id');
    });

    it('should initialize with items pending', () => {
        expect(checklist.isReadyForLaunch()).toBe(false);
        const counts = checklist.getCompletionCount();
        expect(counts.total).toBeGreaterThan(0);
        expect(counts.go).toBe(0);
    });

    it('should block launch until all items are GO', () => {
        // Manually set all items to GO
        const items = checklist.getItems();
        items.forEach(item => {
            checklist.setItemStatus(item.id, 'go');
        });

        expect(checklist.isReadyForLaunch()).toBe(true);
    });

    it('should generate audit log', () => {
        const items = checklist.getItems();
        if (items.length > 0) {
            checklist.setItemStatus(items[0]!.id, 'go');

            const logs = checklist.getAuditLog(); // Was dumpAuditLog
            expect(logs.length).toBeGreaterThan(0);
            expect(logs[0]!.newStatus).toBe('go');
        }
    });
});
