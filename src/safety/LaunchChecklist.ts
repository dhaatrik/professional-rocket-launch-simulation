/**
 * Interactive Launch Checklist System
 *
 * Provides Go/No-Go polling for launch readiness.
 * Mimics real-world launch procedures where each station
 * must confirm readiness before proceeding.
 */

import { state } from '../core/State';
import { createElement } from '../ui/DOMUtils';

// ============================================================================
// Types
// ============================================================================

export type ChecklistStatus = 'pending' | 'go' | 'no-go';

export interface ChecklistItem {
    id: string;
    label: string;
    station: string;
    status: ChecklistStatus;
    autoCheck?: () => boolean; // Optional auto-evaluation function
}

export interface ChecklistAuditEntry {
    timestamp: number; // Mission time or wall clock
    itemId: string;
    previousStatus: ChecklistStatus;
    newStatus: ChecklistStatus;
    operator: string; // 'MANUAL' or 'AUTO'
}

// ============================================================================
// Launch Checklist
// ============================================================================

export class LaunchChecklist {
    private items: ChecklistItem[] = [];
    private auditLog: ChecklistAuditEntry[] = [];
    private containerEl: HTMLElement | null = null;
    private _visible: boolean = false;

    constructor(containerId: string) {
        this.containerEl = document.getElementById(containerId);
        this.initDefaultItems();
    }

    /** Initialize default checklist items */
    private initDefaultItems(): void {
        this.items = [
            {
                id: 'prop-pressure',
                label: 'Tank pressure nominal',
                station: 'PROPULSION',
                status: 'pending'
            },
            {
                id: 'guid-fc',
                label: 'Flight computer loaded',
                station: 'GUIDANCE',
                status: 'pending'
            },
            {
                id: 'range-fts',
                label: 'FTS armed and green',
                station: 'RANGE SAFETY',
                status: 'pending'
            },
            {
                id: 'wx-winds',
                label: 'Winds within limits',
                station: 'WEATHER',
                status: 'pending',
                autoCheck: () => {
                    // Auto-check: use environment system's launch safety
                    const launchStatus = document.getElementById('hud-launch-status');
                    return launchStatus?.textContent === 'GO';
                }
            },
            {
                id: 'tlm-downlink',
                label: 'Telemetry downlink active',
                station: 'TELEMETRY',
                status: 'pending'
            },
            {
                id: 'pad-clear',
                label: 'Launch pad clear',
                station: 'GROUND',
                status: 'pending'
            }
        ];
    }

    /** Get all items */
    getItems(): readonly ChecklistItem[] {
        return this.items;
    }

    /** Get audit log */
    getAuditLog(): readonly ChecklistAuditEntry[] {
        return this.auditLog;
    }

    /** Check if all items are GO */
    isReadyForLaunch(): boolean {
        return this.items.every((item) => item.status === 'go');
    }

    /** Get count of completed items */
    getCompletionCount(): { go: number; noGo: number; pending: number; total: number } {
        return this.items.reduce(
            (acc, item) => {
                if (item.status === 'go') acc.go++;
                else if (item.status === 'no-go') acc.noGo++;
                else if (item.status === 'pending') acc.pending++;
                return acc;
            },
            { go: 0, noGo: 0, pending: 0, total: this.items.length }
        );
    }

    /** Set item status */
    setItemStatus(id: string, status: ChecklistStatus, operator: string = 'MANUAL'): void {
        const item = this.items.find((i) => i.id === id);
        if (!item) return;

        const previous = item.status;
        item.status = status;

        // Audit log
        this.auditLog.push({
            timestamp: Date.now(),
            itemId: id,
            previousStatus: previous,
            newStatus: status,
            operator
        });

        // Mission log
        if (state.missionLog) {
            const icon = status === 'go' ? '✅' : status === 'no-go' ? '❌' : '⏳';
            state.missionLog.log(
                `POLL: ${item.station} — ${icon} ${status.toUpperCase()}`,
                status === 'go' ? 'success' : status === 'no-go' ? 'warn' : 'info'
            );
        }

        this.render();
    }

    /** Run auto-checks for items that have autoCheck functions */
    runAutoChecks(): void {
        this.items.forEach((item) => {
            if (item.autoCheck && item.status === 'pending') {
                const result = item.autoCheck();
                if (result) {
                    this.setItemStatus(item.id, 'go', 'AUTO');
                }
            }
        });
    }

    /** Toggle visibility */
    toggle(): void {
        this._visible = !this._visible;
        if (this._visible) {
            this.runAutoChecks();
            this.render();
        }
        if (this.containerEl) {
            this.containerEl.style.display = this._visible ? 'block' : 'none';
        }
    }

    /** Show the panel */
    show(): void {
        this._visible = true;
        this.runAutoChecks();
        this.render();
        if (this.containerEl) {
            this.containerEl.style.display = 'block';
        }
    }

    /** Hide the panel */
    hide(): void {
        this._visible = false;
        if (this.containerEl) {
            this.containerEl.style.display = 'none';
        }
    }

    get visible(): boolean {
        return this._visible;
    }

    /** Reset all items to pending */
    reset(): void {
        this.items.forEach((i) => (i.status = 'pending'));
        this.auditLog = [];
        this.render();
    }

    /** Render the checklist UI */
    render(): void {
        if (!this.containerEl) return;

        const counts = this.getCompletionCount();
        const allGo = this.isReadyForLaunch();

        this.containerEl.innerHTML = '';

        const checklistItems = this.items.map(item => {
            const statusClass = item.status === 'go' ? 'go' : item.status === 'no-go' ? 'no-go' : 'pending';

            return createElement('div', { className: `checklist-row ${statusClass}` }, [
                createElement('div', { className: 'checklist-station', textContent: item.station }),
                createElement('div', { className: 'checklist-label', textContent: item.label }),
                createElement('div', { className: 'checklist-buttons', role: 'group', 'aria-label': `${item.station} Status` }, [
                    createElement('button', {
                        className: `cl-btn cl-go ${item.status === 'go' ? 'active' : ''}`,
                        'data-item': item.id,
                        'data-action': 'go',
                        'aria-label': `Set ${item.station} to GO`,
                        'aria-pressed': item.status === 'go'
                    }, ['GO']),
                    createElement('button', {
                        className: `cl-btn cl-nogo ${item.status === 'no-go' ? 'active' : ''}`,
                        'data-item': item.id,
                        'data-action': 'no-go',
                        'aria-label': `Set ${item.station} to NO GO`,
                        'aria-pressed': item.status === 'no-go'
                    }, ['NO GO'])
                ])
            ]);
        });

        const checklistInner = createElement('div', { className: 'checklist-inner' }, [
            createElement('div', { className: 'checklist-header' }, [
                createElement('h3', { textContent: '📋 LAUNCH READINESS POLL' }),
                createElement('span', { className: 'checklist-count', textContent: `${counts.go}/${counts.total} GO` }),
                createElement('button', { className: 'checklist-close', id: 'checklist-close-btn', 'aria-label': 'Close Launch Checklist', textContent: '✕' })
            ]),
            createElement('div', { className: 'checklist-items' }, checklistItems),
            createElement('div', { className: 'checklist-footer' }, [
                createElement('div', {
                    className: `checklist-verdict ${allGo ? 'all-go' : 'not-ready'}`,
                    'aria-live': 'polite',
                    textContent: allGo ? '✅ ALL STATIONS GO — LAUNCH AUTHORIZED' : '⏳ AWAITING ALL STATIONS'
                })
            ])
        ]);

        this.containerEl.appendChild(checklistInner);

        // Wire up button events
        this.containerEl.querySelectorAll('.cl-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLButtonElement;
                const itemId = target.dataset.item;
                const action = target.dataset.action as ChecklistStatus;
                if (itemId && action) {
                    this.setItemStatus(itemId, action);
                }
            });
        });

        // Close button
        const closeBtn = this.containerEl.querySelector('#checklist-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
    }
}
