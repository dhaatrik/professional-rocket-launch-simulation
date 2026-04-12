import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LaunchChecklist } from '../../src/safety/LaunchChecklist';

describe('LaunchChecklist', () => {
    let container: HTMLElement;
    let checklist: LaunchChecklist;

    beforeEach(() => {
        document.body.innerHTML = '';
        container = document.createElement('div');
        container.id = 'panel-id';
        document.body.appendChild(container);

        checklist = new LaunchChecklist('panel-id');
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
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

            const logs = checklist.getAuditLog();
            expect(logs.length).toBeGreaterThan(0);
            expect(logs[0]!.newStatus).toBe('go');
        }
    });

    it('should handle DOM interactions for rendering', () => {
        checklist.render();
        expect(container.innerHTML).toContain('📋 LAUNCH READINESS POLL');
    });

    it('event listener for GO button sets status', () => {
        checklist.show(); // trigger render and add listeners
        const goBtn = container.querySelector('.cl-go') as HTMLButtonElement;
        expect(goBtn).not.toBeNull();

        goBtn.click();

        const firstItem = checklist.getItems()[0];
        expect(firstItem.status).toBe('go');
    });

    it('event listener for NO-GO button sets status', () => {
        checklist.show();
        const nogoBtn = container.querySelector('.cl-nogo') as HTMLButtonElement;

        nogoBtn.click();

        const firstItem = checklist.getItems()[0];
        expect(firstItem.status).toBe('no-go');
    });

    it('close button hides checklist', () => {
        checklist.show();
        expect(checklist.visible).toBe(true);

        const closeBtn = container.querySelector('#checklist-close-btn') as HTMLButtonElement;
        closeBtn.click();

        expect(checklist.visible).toBe(false);
    });

    it('runAutoChecks sets auto-checked items to go', () => {
        // mock hud-launch-status
        const hud = document.createElement('div');
        hud.id = 'hud-launch-status';
        hud.textContent = 'GO';
        document.body.appendChild(hud);

        checklist.runAutoChecks();

        const wxItem = checklist.getItems().find(i => i.id === 'wx-winds');
        expect(wxItem?.status).toBe('go');
    });

    it('toggle swaps visibility', () => {
        expect(checklist.visible).toBe(false);
        checklist.toggle();
        expect(checklist.visible).toBe(true);
        checklist.toggle();
        expect(checklist.visible).toBe(false);
    });

    it('escape handler hides panel', () => {
        checklist.show();
        expect(checklist.visible).toBe(true);

        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);

        expect(checklist.visible).toBe(false);
    });

    it('reset sets all items to pending and clears audit log', () => {
        checklist.setItemStatus(checklist.getItems()[0].id, 'go');
        expect(checklist.getAuditLog().length).toBeGreaterThan(0);

        checklist.reset();

        const items = checklist.getItems();
        expect(items.every(i => i.status === 'pending')).toBe(true);
        expect(checklist.getAuditLog().length).toBe(0);
    });
});
