/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MissionLog } from '../src/ui/MissionLog';

describe('MissionLog', () => {
    let listEl: HTMLUListElement;
    let toggleBtn: HTMLButtonElement;
    let containerEl: HTMLElement;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="mission-log">
                <button id="log-toggle" aria-expanded="true">−</button>
                <ul id="log-list"></ul>
            </div>
        `;
        listEl = document.getElementById('log-list') as HTMLUListElement;
        toggleBtn = document.getElementById('log-toggle') as HTMLButtonElement;
        containerEl = document.getElementById('mission-log') as HTMLElement;

        vi.useFakeTimers();
        vi.setSystemTime(new Date(2023, 1, 1, 14, 30, 45)); // 14:30:45
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    describe('Initialization', () => {
        it('should initialize and attach to DOM elements correctly', () => {
            const log = new MissionLog();
            expect(log).toBeDefined();
            // It should not throw errors
        });

        it('should handle missing DOM elements gracefully', () => {
            document.body.innerHTML = ''; // Empty DOM
            const log = new MissionLog();
            expect(log).toBeDefined();
            expect(() => log.log('Test message')).not.toThrow();
            expect(log.getEvents().length).toBe(1);
        });
    });

    describe('Toggle Functionality', () => {
        it('should toggle collapsed class and update button attributes on click', () => {
            new MissionLog();

            // Initial state
            expect(containerEl.classList.contains('collapsed')).toBe(false);
            expect(toggleBtn.textContent).toBe('−');

            // Click to collapse
            toggleBtn.click();
            expect(containerEl.classList.contains('collapsed')).toBe(true);
            expect(toggleBtn.textContent).toBe('+');
            expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');

            // Click to expand
            toggleBtn.click();
            expect(containerEl.classList.contains('collapsed')).toBe(false);
            expect(toggleBtn.textContent).toBe('−');
            expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');
        });

        it('should do nothing if toggle elements are missing', () => {
            document.body.innerHTML = '<ul id="log-list"></ul>';
            const log = new MissionLog(); // Should not throw
            expect(log).toBeDefined();
        });
    });

    describe('Logging Functionality', () => {
        it('should add log entry to the DOM list with correct formatting', () => {
            const log = new MissionLog();
            log.log('Test info message');

            expect(listEl.children.length).toBe(1);
            const entry = listEl.firstElementChild as HTMLLIElement;
            expect(entry.className).toBe('info');
            expect(entry.textContent).toBe('[14:30:45] Test info message');
        });

        it('should add different types of log entries', () => {
            const log = new MissionLog();
            log.log('Warning message', 'warn');

            const entry = listEl.firstElementChild as HTMLLIElement;
            expect(entry.className).toBe('warn');
        });

        it('should prevent duplicate consecutive messages', () => {
            const log = new MissionLog();
            log.log('Duplicate message');
            log.log('Duplicate message');
            log.log('Different message');
            log.log('Duplicate message');

            expect(listEl.children.length).toBe(3);
            expect(log.getEvents().length).toBe(3);
        });

        it('should cap the DOM list size at maxEntries (10)', () => {
            const log = new MissionLog();

            for (let i = 0; i < 15; i++) {
                log.log(`Message ${i}`);
            }

            expect(listEl.children.length).toBe(10);

            // The newest messages are prepended, so the oldest 5 should be removed
            // Last added message is prepended to the top (first child)
            const firstChild = listEl.firstElementChild as HTMLLIElement;
            expect(firstChild.textContent).toBe('[14:30:45] Message 14');

            const lastChild = listEl.lastElementChild as HTMLLIElement;
            expect(lastChild.textContent).toBe('[14:30:45] Message 5');
        });

        it('should append to events array correctly', () => {
            const log = new MissionLog();
            log.log('Message 1');

            const events = log.getEvents();
            expect(events.length).toBe(1);
            expect(events[0]).toEqual({
                time: '14:30:45',
                msg: 'Message 1',
                type: 'info'
            });
        });
    });

    describe('Utility Methods', () => {
        it('should clear log entries and DOM', () => {
            const log = new MissionLog();
            log.log('Message 1');
            log.log('Message 2');

            expect(listEl.children.length).toBe(2);
            expect(log.getEvents().length).toBe(2);

            log.clear();

            expect(listEl.children.length).toBe(0);
            expect(log.getEvents().length).toBe(0);
        });

        it('should handle clear when DOM element is missing', () => {
            document.body.innerHTML = '';
            const log = new MissionLog();
            log.log('Message 1');

            expect(() => log.clear()).not.toThrow();
            expect(log.getEvents().length).toBe(0);
        });

        it('should return all logged events with getEvents()', () => {
            const log = new MissionLog();
            log.log('Msg 1');
            log.log('Msg 2');

            const events = log.getEvents();
            expect(events).toHaveLength(2);
            expect(events[0].msg).toBe('Msg 1');
            expect(events[1].msg).toBe('Msg 2');
        });

        it('should return the last event with getLastEvent()', () => {
            const log = new MissionLog();

            expect(log.getLastEvent()).toBeUndefined();

            log.log('First message');
            expect(log.getLastEvent()?.msg).toBe('First message');

            log.log('Second message');
            expect(log.getLastEvent()?.msg).toBe('Second message');
        });
    });
});
