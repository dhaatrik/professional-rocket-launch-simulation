/**
 * ScriptEditor - Flight Computer Script Editor UI
 *
 * Modal editor for creating and editing mission scripts.
 * Features syntax validation, preset loading, and localStorage persistence.
 */

import { parseMissionScript, MissionScript } from '../guidance/FlightScript';
import { PRESET_SCRIPTS } from '../guidance/FlightComputer';
import { Game } from '../core/Game';
import { createElement } from './DOMUtils';

const STORAGE_KEY = 'rocket-sim-scripts';

export class ScriptEditor {
    private modal: HTMLElement | null = null;
    private textarea: HTMLTextAreaElement | null = null;
    private errorDisplay: HTMLElement | null = null;
    private saveSelect: HTMLSelectElement | null = null;
    private game: Game;
    private invokingElement: HTMLElement | null = null;
    private escapeHandler: ((e: KeyboardEvent) => void) | null = null;

    constructor(game: Game) {
        this.game = game;
        this.createModal();
        this.attachEventListeners();

        // Listen for worker response
        this.game.addPhysicsEventListener((e) => {
            if (e.name === 'FC_SCRIPT_LOADED') {
                if (e.success) {
                    this.showSuccess(`Loaded to Flight Computer! Press G to activate.`);

                    // Auto-close
                    setTimeout(() => {
                        this.hide();
                    }, 1500);
                } else {
                    this.showErrors(e.errors ? e.errors.join('\n') : 'Unknown error loading script');
                }
            }
        });
    }

    /**
     * Create the modal HTML structure
     */
    private createModal(): void {
        // Check if modal already exists
        if (document.getElementById('script-editor-modal')) {
            this.modal = document.getElementById('script-editor-modal');
            this.textarea = document.getElementById('script-textarea') as HTMLTextAreaElement;
            this.errorDisplay = document.getElementById('script-errors');
            this.saveSelect = document.getElementById('script-save-select') as HTMLSelectElement;
            return;
        }

        // Create modal container
        const modal = document.createElement('div');
        modal.id = 'script-editor-modal';
        modal.className = 'script-editor-modal';

        const content = createElement(
            'div',
            {
                className: 'script-editor-content',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby': 'script-editor-title'
            },
            [
                createElement('div', { className: 'script-editor-header' }, [
                    createElement('h2', { id: 'script-editor-title', textContent: 'Flight Computer - Script Editor' }),
                    createElement('button', {
                        id: 'script-editor-close',
                        className: 'script-close-btn',
                        'aria-label': 'Close script editor',
                        title: 'Close',
                        textContent: '×'
                    })
                ]),
                createElement('div', { className: 'script-editor-body' }, [
                    createElement('div', { className: 'script-toolbar' }, [
                        createElement(
                            'select',
                            {
                                id: 'script-preset-select',
                                className: 'script-select',
                                'aria-label': 'Load preset script'
                            },
                            [createElement('option', { value: '', textContent: '-- Load Preset --' })]
                        ),
                        createElement(
                            'select',
                            { id: 'script-save-select', className: 'script-select', 'aria-label': 'Load saved script' },
                            [createElement('option', { value: '', textContent: '-- Saved Scripts --' })]
                        ),
                        createElement('button', {
                            id: 'script-validate-btn',
                            className: 'script-btn',
                            textContent: 'Validate'
                        }),
                        createElement('button', {
                            id: 'script-clear-btn',
                            className: 'script-btn script-btn-danger',
                            textContent: 'Clear'
                        })
                    ]),
                    createElement('div', { className: 'script-syntax-help', id: 'script-syntax-help' }, [
                        createElement('strong', { textContent: 'Syntax:' }),
                        ' WHEN <condition> THEN <action>',
                        createElement('br'),
                        createElement('span', {
                            className: 'script-help-vars',
                            textContent:
                                'Variables: ALTITUDE, VELOCITY, APOGEE, FUEL, TIME | Actions: PITCH <deg>, THROTTLE <0-100>, STAGE, SAS <mode>'
                        })
                    ]),
                    createElement('textarea', {
                        id: 'script-textarea',
                        className: 'script-textarea',
                        'aria-label': 'Script editor content',
                        'aria-describedby': 'script-syntax-help',
                        placeholder:
                            '# Mission Script\n# Example:\nWHEN ALTITUDE > 1000 THEN PITCH 80\nWHEN ALTITUDE > 10000 THEN PITCH 60\nWHEN APOGEE > 100000 THEN THROTTLE 0'
                    }),
                    createElement('div', {
                        id: 'script-errors',
                        className: 'script-errors',
                        'aria-live': 'polite',
                        'aria-atomic': 'true'
                    })
                ]),
                createElement('div', { className: 'script-editor-footer' }, [
                    createElement('div', { className: 'script-footer-left' }, [
                        createElement('input', {
                            type: 'text',
                            id: 'script-name-input',
                            className: 'script-name-input',
                            'aria-label': 'Script name',
                            placeholder: 'Script name...',
                            value: 'My Mission'
                        }),
                        createElement('button', {
                            id: 'script-save-btn',
                            className: 'script-btn script-btn-secondary',
                            textContent: 'Save'
                        }),
                        createElement('button', {
                            id: 'script-delete-btn',
                            className: 'script-btn script-btn-danger',
                            textContent: 'Delete'
                        })
                    ]),
                    createElement('div', { className: 'script-footer-right' }, [
                        createElement('button', {
                            id: 'script-load-btn',
                            className: 'script-btn script-btn-primary',
                            textContent: 'Load to FC'
                        })
                    ])
                ])
            ]
        );

        modal.appendChild(content);

        document.body.appendChild(modal);
        this.modal = modal;
        this.textarea = document.getElementById('script-textarea') as HTMLTextAreaElement;
        this.errorDisplay = document.getElementById('script-errors');
        this.saveSelect = document.getElementById('script-save-select') as HTMLSelectElement;

        // Safely populate preset scripts
        const presetSelect = document.getElementById('script-preset-select') as HTMLSelectElement;
        if (presetSelect) {
            Object.keys(PRESET_SCRIPTS).forEach((name) => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                presetSelect.appendChild(option);
            });
        }

        this.updateSavedScriptsList();
    }

    /**
     * Attach event listeners
     */
    private attachEventListeners(): void {
        // Close button
        document.getElementById('script-editor-close')?.addEventListener('click', () => {
            this.hide();
        });

        // Click outside to close
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        // Preset select
        document.getElementById('script-preset-select')?.addEventListener('change', (e) => {
            const select = e.target as HTMLSelectElement;
            const presetName = select.value;
            if (presetName && PRESET_SCRIPTS[presetName as keyof typeof PRESET_SCRIPTS]) {
                if (this.textarea) {
                    this.textarea.value = PRESET_SCRIPTS[presetName as keyof typeof PRESET_SCRIPTS];
                }
                this.validate();
            }
            select.value = '';
        });

        // Saved scripts select
        this.saveSelect?.addEventListener('change', (e) => {
            const select = e.target as HTMLSelectElement;
            const scriptName = select.value;
            if (scriptName) {
                this.loadSavedScript(scriptName);
            }
        });

        // Validate button
        document.getElementById('script-validate-btn')?.addEventListener('click', () => {
            this.validate();
        });

        // Clear button
        document.getElementById('script-clear-btn')?.addEventListener('click', () => {
            if (this.textarea) {
                this.textarea.value = '';
            }
            this.clearErrors();
        });

        // Save button
        document.getElementById('script-save-btn')?.addEventListener('click', () => {
            this.saveScript();
        });

        // Delete button
        document.getElementById('script-delete-btn')?.addEventListener('click', () => {
            this.deleteScript();
        });

        // Load to FC button
        document.getElementById('script-load-btn')?.addEventListener('click', () => {
            this.loadToFlightComputer();
        });

        // Real-time validation on input
        this.textarea?.addEventListener('input', () => {
            // Debounced validation
            clearTimeout((this as any).validateTimeout);
            (this as any).validateTimeout = setTimeout(() => {
                this.validate();
            }, 500);
        });
    }

    /**
     * Show the editor modal
     */
    show(): void {
        if (!this.isVisible()) {
            this.invokingElement = document.activeElement as HTMLElement;
        }
        if (this.modal) {
            this.modal.classList.add('visible');
            this.textarea?.focus();

            this.escapeHandler = (e: KeyboardEvent) => {
                if (e.key === 'Escape' && this.isVisible()) {
                    this.hide();
                }
            };
            document.addEventListener('keydown', this.escapeHandler);
        }
    }

    /**
     * Hide the editor modal
     */
    hide(): void {
        if (this.modal) {
            this.modal.classList.remove('visible');
            if (this.invokingElement) {
                this.invokingElement.focus();
                this.invokingElement = null;
            }

            if (this.escapeHandler) {
                document.removeEventListener('keydown', this.escapeHandler);
                this.escapeHandler = null;
            }
        }
    }

    /**
     * Check if modal is visible
     */
    isVisible(): boolean {
        return this.modal?.classList.contains('visible') ?? false;
    }

    /**
     * Toggle modal visibility
     */
    toggle(): void {
        if (this.isVisible()) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Open the editor (alias for show)
     */
    open(): void {
        this.show();
    }

    /**
     * Validate the current script
     */
    validate(): boolean {
        if (!this.textarea) return false;

        const scriptText = this.textarea.value;
        const name = (document.getElementById('script-name-input') as HTMLInputElement)?.value || 'Unnamed';
        const result = parseMissionScript(scriptText, name);

        if (result.success) {
            this.showSuccess(`Valid script with ${result.script?.commands.length} commands`);
            return true;
        } else {
            const errorMessages = result.errors.map((e) => `Line ${e.line}: ${e.error}`).join('\n');
            this.showErrors(errorMessages);
            return false;
        }
    }

    /**
     * Show error messages
     */
    private showErrors(message: string): void {
        if (this.errorDisplay) {
            this.errorDisplay.textContent = message;
            this.errorDisplay.className = 'script-errors script-errors-error';
            this.errorDisplay.setAttribute('role', 'alert');
        }
        if (this.textarea) {
            this.textarea.setAttribute('aria-invalid', 'true');
        }
    }

    /**
     * Show success message
     */
    private showSuccess(message: string): void {
        if (this.errorDisplay) {
            this.errorDisplay.textContent = message;
            this.errorDisplay.className = 'script-errors script-errors-success';
            this.errorDisplay.removeAttribute('role');
        }
        if (this.textarea) {
            this.textarea.setAttribute('aria-invalid', 'false');
        }
    }

    /**
     * Clear error display
     */
    private clearErrors(): void {
        if (this.errorDisplay) {
            this.errorDisplay.textContent = '';
            this.errorDisplay.className = 'script-errors';
            this.errorDisplay.removeAttribute('role');
        }
        if (this.textarea) {
            this.textarea.setAttribute('aria-invalid', 'false');
        }
    }

    /**
     * Save current script to localStorage
     */
    private saveScript(): void {
        if (!this.textarea) return;

        const scriptText = this.textarea.value;
        const name = (document.getElementById('script-name-input') as HTMLInputElement)?.value || 'Unnamed';

        const result = parseMissionScript(scriptText, name);
        if (!result.success || !result.script) {
            this.showErrors('Cannot save invalid script. Please fix errors first.');
            return;
        }

        // Get existing scripts
        const scripts = this.getSavedScripts();
        scripts[name] = {
            text: scriptText,
            script: result.script
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
        this.updateSavedScriptsList();
        this.showSuccess(`Saved "${name}"`);
    }

    /**
     * Delete a saved script
     */
    private deleteScript(): void {
        const name = (document.getElementById('script-name-input') as HTMLInputElement)?.value;
        if (!name) return;

        const scripts = this.getSavedScripts();
        if (scripts[name]) {
            delete scripts[name];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
            this.updateSavedScriptsList();
            this.showSuccess(`Deleted "${name}"`);
        }
    }

    /**
     * Load a saved script
     */
    private loadSavedScript(name: string): void {
        const scripts = this.getSavedScripts();
        if (scripts[name] && this.textarea) {
            this.textarea.value = scripts[name].text;
            const nameInput = document.getElementById('script-name-input') as HTMLInputElement;
            if (nameInput) nameInput.value = name;
            this.validate();
        }
    }

    /**
     * Get saved scripts from localStorage
     */
    private getSavedScripts(): Record<string, { text: string; script: MissionScript }> {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    }

    /**
     * Update the saved scripts dropdown
     */
    private updateSavedScriptsList(): void {
        if (!this.saveSelect) return;

        const scripts = this.getSavedScripts();
        const names = Object.keys(scripts);

        // Clear existing options except first
        while (this.saveSelect.options.length > 1) {
            this.saveSelect.remove(1);
        }

        // Add saved scripts
        names.forEach((name) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            this.saveSelect!.appendChild(option);
        });
    }

    /**
     * Load script to Flight Computer
     */
    private loadToFlightComputer(): void {
        if (!this.textarea) return;

        const scriptText = this.textarea.value;
        // Validate locally first
        if (!this.validate()) return;

        // Send to Worker
        this.game.command('FC_LOAD_SCRIPT', { script: scriptText });
        this.showSuccess('Sending to Flight Computer...');
    }

    /**
     * Set textarea content
     */
    setContent(text: string): void {
        if (this.textarea) {
            this.textarea.value = text;
            this.validate();
        }
    }

    /**
     * Get textarea content
     */
    getContent(): string {
        return this.textarea?.value ?? '';
    }
}
