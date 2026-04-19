/**
 * Mission Log
 *
 * Event logging system for mission milestones and status updates.
 * Displays timestamped entries in the UI.
 */

import { IMissionLog, LogEventType, LogEvent } from '../types';

export class MissionLog implements IMissionLog {
    /** DOM element for log display */
    private el: HTMLUListElement | null;

    /** Event history */
    private events: LogEvent[] = [];

    /** Maximum entries to display */
    private readonly maxEntries: number = 10;

    /** Maximum entries to keep in memory */
    private readonly maxHistory: number = 100;

    /** Toggle button for collapsibility */
    private toggleBtn: HTMLButtonElement | null;

    /** Container element */
    private container: HTMLElement | null;

    constructor() {
        this.el = document.getElementById('log-list') as HTMLUListElement | null;
        this.toggleBtn = document.getElementById('log-toggle') as HTMLButtonElement | null;
        this.container = document.getElementById('mission-log');

        this.initToggle();
    }

    /**
     * Initialize collapsible toggle functionality
     */
    private initToggle(): void {
        if (!this.toggleBtn || !this.container) return;

        // Attach listener to the header so the entire area is clickable,
        // but ensure the button's ARIA state is properly updated.
        const header = typeof this.container.querySelector === 'function' ? this.container.querySelector('h3') : null;
        const toggleElement = header || this.toggleBtn;

        toggleElement.addEventListener('click', () => {
            if (this.container) {
                this.container.classList.toggle('collapsed');
                const isCollapsed = this.container.classList.contains('collapsed');
                if (this.toggleBtn) {
                    this.toggleBtn.textContent = isCollapsed ? '+' : '−';
                    this.toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
                }
            }
        });
    }

    /**
     * Log a mission event
     *
     * @param message - Event message
     * @param type - Event type for styling (info, warn, success)
     */
    log(message: string, type: LogEventType = 'info'): void {
        // Prevent duplicate consecutive messages
        if (this.events.length > 0) {
            const lastEvent = this.events[this.events.length - 1];
            if (lastEvent && lastEvent.msg === message) {
                return;
            }
        }

        // Format timestamp
        const now = new Date();
        const time = [
            now.getHours().toString().padStart(2, '0'),
            now.getMinutes().toString().padStart(2, '0'),
            now.getSeconds().toString().padStart(2, '0')
        ].join(':');

        // Store event
        this.events.push({ time, msg: message, type });
        if (this.events.length > this.maxHistory) {
            this.events.shift();
        }

        // Update DOM
        if (this.el) {
            const li = document.createElement('li');
            li.className = type;
            li.textContent = `[${time}] ${message}`;
            this.el.prepend(li);

            // Remove old entries
            while (this.el.children.length > this.maxEntries) {
                const lastChild = this.el.lastChild;
                if (lastChild) {
                    this.el.removeChild(lastChild);
                }
            }
        }
    }

    /**
     * Clear all log entries
     */
    clear(): void {
        if (this.el) {
            this.el.textContent = '';
        }
        this.events = [];
    }

    /**
     * Get all logged events
     */
    getEvents(): readonly LogEvent[] {
        return this.events;
    }

    /**
     * Get the most recent event
     */
    getLastEvent(): LogEvent | undefined {
        return this.events[this.events.length - 1];
    }
}
