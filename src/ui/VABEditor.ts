/**
 * VAB Editor
 *
 * Visual vehicle builder UI with parts catalog, stacking area, and stage manager.
 */

import { RocketPart, PartCategory, PARTS_CATALOG, getPartsByCategory } from '../vab/PartsCatalog';
import {
    VehicleBlueprint,
    VehicleStats,
    createBlueprint,
    addStage,
    addPartToStage,
    removePartFromStage,
    removeStage,
    calculateStats,
    createFalconPreset,
    createSimplePreset,
    saveBlueprints,
    loadBlueprints
} from '../vab/VehicleBlueprint';
import { createElement } from './DOMUtils';

export class VABEditor {
    private container: HTMLElement;
    private blueprint: VehicleBlueprint;
    private savedBlueprints: VehicleBlueprint[] = [];
    private selectedCategory: PartCategory = 'engine';
    private selectedPartId: string | null = null;
    private onLaunch: (blueprint: VehicleBlueprint) => void;

    constructor(containerId: string, onLaunch: (blueprint: VehicleBlueprint) => void) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Container ${containerId} not found`);
        this.container = container;
        this.onLaunch = onLaunch;
        this.blueprint = createFalconPreset();
        this.savedBlueprints = loadBlueprints();
        this.render();
    }

    /**
     * Show the VAB editor
     */
    public show(): void {
        this.container.style.display = 'flex';
        this.render();
    }

    /**
     * Hide the VAB editor
     */
    public hide(): void {
        this.container.style.display = 'none';
    }

    /**
     * Get current blueprint
     */
    public getBlueprint(): VehicleBlueprint {
        return this.blueprint;
    }

    /**
     * Render the complete VAB UI
     */
    private render(): void {
        const stats = calculateStats(this.blueprint);

        // Preserve scroll position of parts list
        const partsList = this.container.querySelector('#vab-parts-list');
        const scrollTop = partsList ? partsList.scrollTop : 0;

        const nameInput = createElement('input', {
            type: 'text',
            className: 'vab-name-input',
            placeholder: 'Rocket Name',
            'aria-label': 'Rocket Name'
        }) as HTMLInputElement;
        // Safely set user input value to prevent XSS
        nameInput.value = this.blueprint.name;

        const editor = createElement('div', { className: 'vab-editor' }, [
            createElement('div', { className: 'vab-header' }, [
                createElement('h2', { textContent: 'Vehicle Assembly Building' }),
                nameInput
            ]),

            createElement('div', { className: 'vab-main' }, [
                // Parts Catalog
                createElement('div', { className: 'vab-parts-panel' }, [
                    createElement('h3', { textContent: 'Parts Catalog' }),
                    createElement('div', { className: 'vab-category-tabs', role: 'tablist' }, this.renderCategoryTabs()),
                    createElement('div', {
                        className: 'vab-parts-list',
                        id: 'vab-parts-list',
                        role: 'tabpanel',
                        'aria-labelledby': `tab-${this.selectedCategory}`
                    }, this.renderPartsList())
                ]),
                
                // Vehicle Preview
                createElement('div', { className: 'vab-preview-panel' }, [
                    createElement('h3', { textContent: 'Vehicle Preview' }),
                    createElement('div', { className: 'vab-vehicle-display' }, this.renderVehiclePreview())
                ]),
                
                // Stage Manager
                createElement('div', { className: 'vab-stages-panel' }, [
                    createElement('h3', { textContent: 'Stages' }),
                    createElement('div', { className: 'vab-stages-list' }, this.renderStagesList()),
                    createElement('button', { className: 'vab-add-stage-btn', textContent: '+ Add Stage' })
                ])
            ]),

            // Stats Bar
            createElement('div', { className: 'vab-stats-bar' }, this.renderStats(stats)),

            // Action Buttons
            createElement('div', { className: 'vab-actions' }, [
                createElement('div', { className: 'vab-presets' }, [
                    createElement('button', { className: 'vab-preset-btn', 'data-preset': 'falcon', textContent: 'Load Falcon 9' }),
                    createElement('button', { className: 'vab-preset-btn', 'data-preset': 'simple', textContent: 'Load Simple' }),
                    createElement('button', { className: 'vab-preset-btn', 'data-preset': 'new', textContent: 'New Rocket' })
                ]),
                createElement('div', { className: 'vab-main-actions' }, [
                    createElement('button', { className: 'vab-save-btn', textContent: 'Save' }),
                    createElement('button', { className: 'vab-cancel-btn', textContent: 'Cancel' }),
                    createElement('button', { className: 'vab-launch-btn primary large', textContent: 'GO FOR LAUNCH' })
                ])
            ])
        ]);

        this.container.innerHTML = '';
        this.container.appendChild(editor);

        // Restore scroll position
        const newPartsList = this.container.querySelector('#vab-parts-list');
        if (newPartsList) {
            newPartsList.scrollTop = scrollTop;
        }

        this.attachEventListeners();
    }

    /**
     * Escape HTML special characters to prevent XSS
     */
    private escapeHTML(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Render category tabs
     */
    private renderCategoryTabs(): HTMLElement[] {
        const categories: { id: PartCategory; icon: string; label: string }[] = [
            { id: 'engine', icon: '🔥', label: 'Engines' },
            { id: 'tank', icon: '⛽', label: 'Tanks' },
            { id: 'avionics', icon: '🎛️', label: 'Avionics' },
            { id: 'fairing', icon: '🛡️', label: 'Fairings' },
            { id: 'decoupler', icon: '⚡', label: 'Decouplers' },
            { id: 'srb', icon: '🚀', label: 'SRBs' }
        ];

        return categories.map((cat) =>
            createElement(
                'button',
                {
                    className: `vab-cat-tab ${this.selectedCategory === cat.id ? 'active' : ''}`,
                    role: 'tab',
                    'aria-selected': this.selectedCategory === cat.id ? 'true' : 'false',
                    'aria-controls': 'vab-parts-list',
                    id: `tab-${cat.id}`,
                    'data-category': cat.id
                },
                [createElement('span', { className: 'tab-icon', textContent: cat.icon }), ` ${cat.label}`]
            )
        );
    }

    /**
     * Render parts list for selected category
     */
    private renderPartsList(): HTMLElement[] {
        const parts = getPartsByCategory(this.selectedCategory);

        if (parts.length === 0) {
            return [createElement('div', { className: 'vab-no-parts', textContent: '🚫 No parts in this category' })];
        }

        return parts.map((part) =>
            createElement(
                'div',
                {
                    className: `vab-part-item ${this.selectedPartId === part.id ? 'selected' : ''}`,
                    'data-part-id': part.id,
                    role: 'button',
                    tabindex: '0',
                    'aria-label': `Select ${part.name}`
                },
                [
                    createElement('div', { className: 'vab-part-icon', textContent: this.getPartIcon(part) }),
                    createElement('div', { className: 'vab-part-info' }, [
                        createElement('div', { className: 'vab-part-name', textContent: part.name }),
                        createElement('div', { className: 'vab-part-desc', textContent: part.description }),
                        createElement('div', { className: 'vab-part-stats', textContent: this.formatPartStats(part) })
                    ]),
                    createElement('div', { className: 'vab-part-cost', textContent: `$${part.cost}` })
                ]
            )
        );
    }

    /**
     * Get icon for part category
     */
    private getPartIcon(part: RocketPart): string {
        switch (part.category) {
            case 'engine':
                return '🔥';
            case 'tank':
                return '⛽';
            case 'avionics':
                return '🎛️';
            case 'fairing':
                return '🛡️';
            case 'decoupler':
                return '⚡';
            case 'srb':
                return '🚀';
            default:
                return '📦';
        }
    }

    /**
     * Format part stats for display
     */
    private formatPartStats(part: RocketPart): string {
        const stats: string[] = [`${part.mass}kg`];

        if (part.thrust) {
            stats.push(`${(part.thrust / 1000).toFixed(0)}kN`);
        }
        if (part.ispVac) {
            stats.push(`${part.ispVac}s Isp`);
        }
        if (part.fuelCapacity) {
            stats.push(`${(part.fuelCapacity / 1000).toFixed(1)}t fuel`);
        }

        return stats.join(' | ');
    }

    /**
     * Render vehicle preview
     */
    private renderVehiclePreview(): HTMLElement[] {
        if (this.blueprint.stages.length === 0) {
            return [createElement('div', { className: 'vab-empty-vehicle', textContent: 'Add stages and parts to build your rocket' })];
        }

        // Build visual representation from top to bottom
        const stages: HTMLElement[] = [];
        for (let i = this.blueprint.stages.length - 1; i >= 0; i--) {
            const stage = this.blueprint.stages[i];
            if (!stage) continue;

            const stageElements: HTMLElement[] = [];

            // Render parts in stage (top to bottom in visual order)
            for (let j = stage.parts.length - 1; j >= 0; j--) {
                const inst = stage.parts[j];
                if (!inst) continue;

                const partPreview = createElement('div', {
                    className: 'vab-part-preview',
                    'data-instance': inst.instanceId,
                    'data-height': inst.part.height,
                    'data-width': inst.part.width
                }, [
                    createElement('span', { className: 'part-label', textContent: inst.part.name }),
                    createElement('button', {
                        className: 'remove-part',
                        'data-stage': i,
                        'data-instance': inst.instanceId,
                        title: `Remove ${inst.part.name}`,
                        'aria-label': `Remove ${inst.part.name}`,
                        textContent: '×'
                    })
                ]);
                stageElements.push(partPreview);
            }

            // Show decoupler if present
            if (stage.hasDecoupler && i > 0) {
                stageElements.push(createElement('div', { className: 'vab-decoupler-marker', textContent: 'STAGE SEP' }));
            }

            stages.push(createElement('div', { className: 'vab-stage-preview', 'data-stage': i }, stageElements));
        }

        return stages;
    }

    /**
     * Render stages list
     */
    private renderStagesList(): HTMLElement[] {
        if (this.blueprint.stages.length === 0) {
            return [createElement('div', { className: 'vab-no-stages', textContent: '🚀 No stages yet. Click "Add Stage" to begin assembly.' })];
        }

        const selectedPart = this.selectedPartId ? PARTS_CATALOG.find((p) => p.id === this.selectedPartId) : null;
        const btnTitle = selectedPart
            ? `Add ${selectedPart.name}`
            : 'Select a part from the catalog first';
        const btnDisabled = !selectedPart ? true : false;
        const btnText = selectedPart ? `+ Add ${selectedPart.name}` : '+ Add Selected Part';

        return this.blueprint.stages.map((stage, i) => {
            const stageStats = this.getStageStats(stage);

            const headerChildren: HTMLElement[] = [
                createElement('span', { className: 'stage-number', textContent: `Stage ${i + 1}` }),
                createElement('span', { className: 'stage-info', textContent: `${stage.parts.length} parts` })
            ];

            if (i > 0) {
                headerChildren.push(createElement('button', {
                    className: 'remove-stage',
                    'data-stage': i,
                    title: `Remove Stage ${i + 1}`,
                    'aria-label': `Remove Stage ${i + 1}`,
                    textContent: 'REMOVE'
                }));
            }

            return createElement('div', { className: `vab-stage-item ${i === 0 ? 'first-stage' : ''}`, 'data-stage': i }, [
                createElement('div', { className: 'vab-stage-header' }, headerChildren),
                createElement('div', { className: 'vab-stage-stats' }, [
                    createElement('span', { textContent: `Mass: ${(stageStats.mass / 1000).toFixed(1)}t` }),
                    createElement('span', { textContent: `ΔV: ${stageStats.deltaV.toFixed(0)} m/s` })
                ]),
                createElement('button', {
                    className: 'vab-add-to-stage',
                    'data-stage': i,
                    disabled: btnDisabled,
                    title: btnTitle,
                    textContent: btnText
                })
            ]);
        });
    }

    /**
     * Get simple stats for a single stage
     */
    private getStageStats(stage: any): { mass: number; deltaV: number } {
        let mass = 0;
        let fuel = 0;
        let isp = 0;
        let engineCount = 0;

        for (const inst of stage.parts) {
            mass += inst.part.mass;
            if (inst.part.fuelCapacity) {
                fuel += inst.part.fuelCapacity;
                mass += inst.part.fuelCapacity;
            }
            if (inst.part.ispVac) {
                isp += inst.part.ispVac;
                engineCount++;
            }
        }

        if (engineCount > 0) isp /= engineCount;

        const m0 = mass;
        const mf = mass - fuel;
        const deltaV = isp > 0 && mf > 0 && m0 > mf ? isp * 9.81 * Math.log(m0 / mf) : 0;

        return { mass, deltaV };
    }

    /**
     * Render stats bar
     */
    private renderStats(stats: VehicleStats): HTMLElement[] {
        const twr = stats.stageTWR[0] || 0;
        const twrClass = twr > 1.2 ? 'good' : twr > 1.0 ? 'warning' : 'bad';
        const dvClass = stats.totalDeltaV > 9000 ? 'good' : stats.totalDeltaV > 5000 ? 'warning' : 'bad';

        return [
            createElement('div', { className: 'vab-stat', title: 'Mass of the fully fueled vehicle' }, [
                createElement('div', { className: 'vab-stat-label', textContent: 'Total Mass' }),
                createElement('div', { className: 'vab-stat-value', textContent: (stats.wetMass / 1000).toFixed(1) }),
                createElement('div', { className: 'vab-stat-unit', textContent: 'tons' })
            ]),
            createElement('div', { className: 'vab-stat', title: 'Total change in velocity. Approx 9,400 m/s required for Low Earth Orbit.' }, [
                createElement('div', { className: 'vab-stat-label', textContent: 'Total ΔV' }),
                createElement('div', { className: `vab-stat-value ${dvClass}`, textContent: stats.totalDeltaV.toFixed(0) }),
                createElement('div', { className: 'vab-stat-unit', textContent: 'm/s' })
            ]),
            createElement('div', { className: 'vab-stat', title: 'Thrust-to-Weight Ratio. Must be > 1.0 to liftoff. Ideal is 1.3-1.5.' }, [
                createElement('div', { className: 'vab-stat-label', textContent: 'TWR (Stage 1)' }),
                createElement('div', { className: `vab-stat-value ${twrClass}`, textContent: twr.toFixed(2) }),
                createElement('div', { className: 'vab-stat-unit', textContent: 'ratio' })
            ]),
            createElement('div', { className: 'vab-stat', title: 'Number of stages in the vehicle stack' }, [
                createElement('div', { className: 'vab-stat-label', textContent: 'Stages' }),
                createElement('div', { className: 'vab-stat-value', textContent: this.blueprint.stages.length }),
                createElement('div', { className: 'vab-stat-unit', textContent: 'count' })
            ]),
            createElement('div', { className: 'vab-stat', title: 'Total construction cost' }, [
                createElement('div', { className: 'vab-stat-label', textContent: 'Total Cost' }),
                createElement('div', { className: 'vab-stat-value', textContent: stats.totalCost.toLocaleString() }),
                createElement('div', { className: 'vab-stat-unit', textContent: 'credits' })
            ]),
            createElement('div', { className: 'vab-stat' }, [
                createElement('div', {
                    className: `vab-stat-indicator ${stats.hasAvionics ? 'ok' : 'warn'}`,
                    title: 'Flight computer guidance. Required for control.',
                    textContent: `${stats.hasAvionics ? '[OK]' : '[MISSING]'} Avionics`
                }),
                createElement('div', {
                    className: `vab-stat-indicator ${stats.hasFairing ? 'ok' : 'warn'}`,
                    title: 'Protects payload from aerodynamic stress during ascent.',
                    textContent: `${stats.hasFairing ? '[OK]' : '[MISSING]'} Fairing`
                })
            ])
        ];
    }

    /**
     * Attach event listeners
     */
    private attachEventListeners(): void {
        // Category tabs
        this.container.querySelectorAll('.vab-cat-tab').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                this.selectedCategory = target.dataset.category as PartCategory;
                this.selectedPartId = null;
                this.render();
            });
        });

        // Part items (select part)
        this.container.querySelectorAll('.vab-part-item').forEach((item) => {
            const selectPart = (target: HTMLElement) => {
                const partId = target.dataset.partId;
                if (partId) {
                    this.selectedPartId = partId;
                    this.render();
                }
            };

            item.addEventListener('click', (e) => {
                selectPart(e.currentTarget as HTMLElement);
            });

            item.addEventListener('keydown', (e) => {
                const key = (e as KeyboardEvent).key;
                if (key === 'Enter' || key === ' ') {
                    e.preventDefault(); // Prevent scrolling for space
                    (e.currentTarget as HTMLElement).classList.add('selected');
                    selectPart(e.currentTarget as HTMLElement);
                }
            });
        });

        // Add to stage buttons
        this.container.querySelectorAll('.vab-add-to-stage').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const stageIndex = parseInt((e.currentTarget as HTMLElement).dataset.stage || '0');
                if (this.selectedPartId) {
                    const part = PARTS_CATALOG.find((p) => p.id === this.selectedPartId);
                    if (part) {
                        this.blueprint = addPartToStage(this.blueprint, stageIndex, part);
                        this.render();
                    }
                }
            });
        });

        // Remove part buttons
        this.container.querySelectorAll('.remove-part').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const target = e.currentTarget as HTMLElement;
                const stageIndex = parseInt(target.dataset.stage || '0');
                const instanceId = target.dataset.instance || '';
                this.blueprint = removePartFromStage(this.blueprint, stageIndex, instanceId);
                this.render();
            });
        });

        // Add stage button
        this.container.querySelector('.vab-add-stage-btn')?.addEventListener('click', () => {
            this.blueprint = addStage(this.blueprint);
            this.render();
        });

        // Remove stage buttons
        this.container.querySelectorAll('.remove-stage').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const stageIndex = parseInt((e.currentTarget as HTMLElement).dataset.stage || '0');
                this.blueprint = removeStage(this.blueprint, stageIndex);
                this.render();
            });
        });

        // Preset buttons
        this.container.querySelectorAll('.vab-preset-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const preset = (e.currentTarget as HTMLElement).dataset.preset;
                switch (preset) {
                    case 'falcon':
                        this.blueprint = createFalconPreset();
                        break;
                    case 'simple':
                        this.blueprint = createSimplePreset();
                        break;
                    case 'new':
                        this.blueprint = createBlueprint('New Rocket');
                        this.blueprint = addStage(this.blueprint);
                        break;
                }
                this.render();
            });
        });

        // Name input
        this.container.querySelector('.vab-name-input')?.addEventListener('change', (e) => {
            this.blueprint.name = (e.target as HTMLInputElement).value;
        });

        // Save button
        this.container.querySelector('.vab-save-btn')?.addEventListener('click', () => {
            // Update or add to saved blueprints
            const existing = this.savedBlueprints.findIndex((b) => b.id === this.blueprint.id);
            if (existing >= 0) {
                this.savedBlueprints[existing] = this.blueprint;
            } else {
                this.savedBlueprints.push(this.blueprint);
            }
            saveBlueprints(this.savedBlueprints);
            alert('Blueprint saved!');
        });

        // Cancel button
        this.container.querySelector('.vab-cancel-btn')?.addEventListener('click', () => {
            this.hide();
        });

        // Launch button
        this.container.querySelector('.vab-launch-btn')?.addEventListener('click', () => {
            const stats = calculateStats(this.blueprint);
            if (this.blueprint.stages.length === 0 || (stats.stageTWR[0] || 0) < 1.0) {
                alert('Vehicle not ready! Ensure you have stages and TWR > 1.0');
                return;
            }
            this.hide();
            this.onLaunch(this.blueprint);
        });
    }
}
