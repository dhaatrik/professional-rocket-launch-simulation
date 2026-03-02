/**
 * ScriptEditor - Flight Computer Script Editor UI
 *
 * Modal editor for creating and editing mission scripts.
 * Features syntax validation, preset loading, and localStorage persistence.
 */

import { parseMissionScript, MissionScript } from '../guidance/FlightScript';
import { PRESET_SCRIPTS } from '../guidance/FlightComputer';
import { Game } from '../core/Game';

const STORAGE_KEY = 'rocket-sim-scripts';

export class ScriptEditor {
    private modal: HTMLElement | null = null;
    private textarea: HTMLTextAreaElement | null = null;
    private errorDisplay: HTMLElement | null = null;
    private saveSelect: HTMLSelectElement | null = null;
    private game: Game;

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
        modal.innerHTML = `
            <div class="script-editor-content">
                <div class="script-editor-header">
                    <h2>Flight Computer - Script Editor</h2>
                    <button id="script-editor-close" class="script-close-btn" aria-label="Close script editor" title="Close">×</button>
                </div>
                
                <div class="script-editor-body">
                    <div class="script-toolbar">
                        <select id="script-preset-select" class="script-select" aria-label="Load preset script">
                            <option value="">-- Load Preset --</option>
                        </select>
                        
                        <select id="script-save-select" class="script-select" aria-label="Load saved script">
                            <option value="">-- Saved Scripts --</option>
                        </select>
                        
                        <button id="script-validate-btn" class="script-btn">Validate</button>
                        <button id="script-clear-btn" class="script-btn script-btn-danger">Clear</button>
                    </div>
                    
                    <div class="script-syntax-help" id="script-syntax-help">
                        <strong>Syntax:</strong> WHEN &lt;condition&gt; THEN &lt;action&gt;
                        <br>
                        <span class="script-help-vars">
                            Variables: ALTITUDE, VELOCITY, APOGEE, FUEL, TIME | 
                            Actions: PITCH &lt;deg&gt;, THROTTLE &lt;0-100&gt;, STAGE, SAS &lt;mode&gt;
                        </span>
                    </div>
                    
                    <textarea id="script-textarea" class="script-textarea"
                        aria-label="Script editor content"
                        aria-describedby="script-syntax-help"
                        placeholder="# Mission Script
# Example:
WHEN ALTITUDE > 1000 THEN PITCH 80
WHEN ALTITUDE > 10000 THEN PITCH 60
WHEN APOGEE > 100000 THEN THROTTLE 0"></textarea>
                    
                    <div id="script-errors" class="script-errors" aria-live="polite" aria-atomic="true"></div>
                </div>
                
                <div class="script-editor-footer">
                    <div class="script-footer-left">
                        <input type="text" id="script-name-input" class="script-name-input" aria-label="Script name"
                            placeholder="Script name..." value="My Mission">
                        <button id="script-save-btn" class="script-btn script-btn-secondary">Save</button>
                        <button id="script-delete-btn" class="script-btn script-btn-danger">Delete</button>
                    </div>
                    <div class="script-footer-right">
                        <button id="script-load-btn" class="script-btn script-btn-primary">Load to FC</button>
                    </div>
                </div>
            </div>
        `;

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

        // Keyboard shortcut to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible()) {
                this.hide();
            }
        });
    }

    /**
     * Show the editor modal
     */
    show(): void {
        if (this.modal) {
            this.modal.classList.add('visible');
            this.textarea?.focus();
        }
    }

    /**
     * Hide the editor modal
     */
    hide(): void {
        if (this.modal) {
            this.modal.classList.remove('visible');
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
