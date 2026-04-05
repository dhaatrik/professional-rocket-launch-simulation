/**
 * VAB Editor
 *
 * Visual vehicle builder UI with parts catalog, stacking area, and stage manager.
 */

import { RocketPart, PartCategory, getPartById, getPartsByCategory } from '../vab/PartsCatalog';
import { createElement } from './DOMUtils';
import {
    VehicleBlueprint,
    VehicleStage,
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

export class VABEditor {
    private container: HTMLElement;
    private blueprint: VehicleBlueprint;
    private savedBlueprints: VehicleBlueprint[] = [];
    private selectedCategory: PartCategory = 'engine';
    private selectedPartId: string | null = null;
    private onLaunch: (blueprint: VehicleBlueprint) => void;
    private escapeHandler: ((e: KeyboardEvent) => void) | null = null;
    private invokingElement: HTMLElement | null = null;

    constructor(containerId: string, onLaunch: (blueprint: VehicleBlueprint) => void) {
        const container = document.getElementById(containerId);
        if (!container) throw new Error(`Container ${containerId} not found`);
        this.container = container;
        this.onLaunch = onLaunch;
        this.blueprint = createFalconPreset();
        this.savedBlueprints = loadBlueprints();

        // Event delegation for click, change, and keydown
        this.container.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;

            // Remove part
            const removeBtn = target.closest('.remove-part') as HTMLElement;
            if (removeBtn) {
                e.stopPropagation();
                const stageIndex = parseInt(removeBtn.dataset.stage || '0');
                const instanceId = removeBtn.dataset.instance || '';
                this.blueprint = removePartFromStage(this.blueprint, stageIndex, instanceId);
                this.render();
                return;
            }

            // Category tab
            const tabBtn = target.closest('.vab-cat-tab') as HTMLElement;
            if (tabBtn) {
                this.selectedCategory = tabBtn.dataset.category as PartCategory;
                this.selectedPartId = null;
                this.render();
                return;
            }

            // Part item
            const partItem = target.closest('.vab-part-item') as HTMLElement;
            if (partItem) {
                const partId = partItem.dataset.partId;
                if (partId) {
                    this.selectedPartId = partId;
                    this.render();
                }
                return;
            }

            // Add to stage
            const addBtn = target.closest('.vab-add-to-stage') as HTMLElement;
            if (addBtn) {
                const stageIndex = parseInt(addBtn.dataset.stage || '0');
                if (this.selectedPartId) {
                    const part = getPartById(this.selectedPartId);
                    if (part) {
                        this.blueprint = addPartToStage(this.blueprint, stageIndex, part);
                        this.render();
                    }
                }
                return;
            }

            // Add stage
            const addStageBtn = target.closest('.vab-add-stage-btn') as HTMLElement;
            if (addStageBtn) {
                this.blueprint = addStage(this.blueprint);
                this.render();
                return;
            }

            // Remove stage
            const removeStageBtn = target.closest('.remove-stage') as HTMLElement;
            if (removeStageBtn) {
                e.stopPropagation();
                const stageIndex = parseInt(removeStageBtn.dataset.stage || '0');
                this.blueprint = removeStage(this.blueprint, stageIndex);
                this.render();
                return;
            }

            // Presets
            const presetBtn = target.closest('.vab-preset-btn') as HTMLElement;
            if (presetBtn) {
                if (!window.confirm('This will replace your current vehicle. Are you sure you want to proceed?')) {
                    return;
                }
                const preset = presetBtn.dataset.preset;
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
                return;
            }

            // Save button
            const saveBtn = target.closest('.vab-save-btn') as HTMLElement;
            if (saveBtn) {
                const existing = this.savedBlueprints.findIndex((b) => b.id === this.blueprint.id);
                if (existing >= 0) {
                    this.savedBlueprints[existing] = this.blueprint;
                } else {
                    this.savedBlueprints.push(this.blueprint);
                }
                saveBlueprints(this.savedBlueprints);
                alert('Blueprint saved!');
                return;
            }

            // Cancel button
            const cancelBtn = target.closest('.vab-cancel-btn') as HTMLElement;
            if (cancelBtn) {
                this.hide();
                return;
            }

            // Close button
            const closeBtn = target.closest('.script-close-btn') as HTMLElement;
            if (closeBtn) {
                this.hide();
                return;
            }

            // Launch button
            const launchBtn = target.closest('.vab-launch-btn') as HTMLElement;
            if (launchBtn) {
                this.hide();
                this.onLaunch(this.blueprint);
                return;
            }
        });

        this.container.addEventListener('change', (e) => {
            const target = e.target as HTMLElement;
            const nameInput = target.closest('.vab-name-input') as HTMLInputElement;
            if (nameInput) {
                this.blueprint.name = nameInput.value;
            }
        });

        this.container.addEventListener('keydown', (e) => {
            const target = e.target as HTMLElement;
            const partItem = target.closest('.vab-part-item') as HTMLElement;
            if (partItem) {
                const key = (e as KeyboardEvent).key;
                if (key === 'Enter' || key === ' ') {
                    e.preventDefault();
                    partItem.classList.add('selected');
                    const partId = partItem.dataset.partId;
                    if (partId) {
                        this.selectedPartId = partId;
                        this.render();
                    }
                }
            }
        });

        this.render();
    }

    /**
     * Show the VAB editor
     */
    public show(): void {
        if (this.container.style.display !== 'flex') {
            this.invokingElement = document.activeElement as HTMLElement;
        }

        this.container.style.display = 'flex';
        this.render();

        // Focus the name input for accessibility
        const nameInput = this.container.querySelector('.vab-name-input') as HTMLElement;
        if (nameInput) {
            nameInput.focus();
        }

        this.escapeHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.container.style.display !== 'none') {
                this.hide();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }

    /**
     * Hide the VAB editor
     */
    public hide(): void {
        this.container.style.display = 'none';

        if (this.invokingElement) {
            this.invokingElement.focus();
            this.invokingElement = null;
        }

        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }
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

        // Clear container
        this.container.textContent = '';

        const nameInput = createElement('input', {
            type: 'text',
            className: 'vab-name-input',
            placeholder: 'Rocket Name',
            value: '',
            'aria-label': 'Rocket Name',
            'aria-required': 'true',
            required: true
        });
        nameInput.value = this.blueprint.name;

        const headerControls = createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '15px' } }, [
            nameInput,
            createElement('button', {
                className: 'script-close-btn',
                'aria-label': 'Close Vehicle Assembly Building',
                title: 'Close',
                textContent: '×'
            })
        ]);

        const header = createElement('div', { className: 'vab-header' }, [
            createElement('h2', {}, ['Vehicle Assembly Building']),
            headerControls
        ]);

        const partsPanel = createElement('div', { className: 'vab-parts-panel' }, [
            createElement('h3', {}, ['Parts Catalog']),
            createElement('div', { className: 'vab-category-tabs', role: 'tablist' }, this.renderCategoryTabs()),
            createElement(
                'div',
                {
                    className: 'vab-parts-list',
                    id: 'vab-parts-list',
                    role: 'tabpanel',
                    'aria-labelledby': `tab-${this.selectedCategory}`
                },
                this.renderPartsList()
            )
        ]);

        const previewPanel = createElement('div', { className: 'vab-preview-panel' }, [
            createElement('h3', {}, ['Vehicle Preview']),
            createElement('div', { className: 'vab-vehicle-display' }, this.renderVehiclePreview())
        ]);

        const stagesPanel = createElement('div', { className: 'vab-stages-panel' }, [
            createElement('h3', {}, ['Stages']),
            createElement('div', { className: 'vab-stages-list' }, this.renderStagesList()),
            createElement('button', { className: 'vab-add-stage-btn' }, ['+ Add Stage'])
        ]);

        const mainPanel = createElement('div', { className: 'vab-main' }, [partsPanel, previewPanel, stagesPanel]);

        const statsBar = createElement('div', { className: 'vab-stats-bar' }, this.renderStats(stats));

        const presetsDiv = createElement('div', { className: 'vab-presets' }, [
            createElement('button', { className: 'vab-preset-btn', 'data-preset': 'falcon' }, ['Load Falcon 9']),
            createElement('button', { className: 'vab-preset-btn', 'data-preset': 'simple' }, ['Load Simple']),
            createElement('button', { className: 'vab-preset-btn', 'data-preset': 'new' }, ['New Rocket'])
        ]);

        const isReady = this.blueprint.stages.length > 0 && (stats.stageTWR[0] || 0) >= 1.0;

        const mainActionsDiv = createElement('div', { className: 'vab-main-actions' }, [
            createElement('button', { className: 'vab-save-btn' }, ['Save']),
            createElement('button', { className: 'vab-cancel-btn' }, ['Cancel']),
            createElement(
                'button',
                {
                    className: 'vab-launch-btn large',
                    disabled: !isReady,
                    'aria-disabled': (!isReady).toString(),
                    title: isReady ? 'Launch Vehicle' : 'Vehicle not ready! Ensure you have stages and TWR > 1.0'
                },
                ['GO FOR LAUNCH']
            )
        ]);

        const actionsDiv = createElement('div', { className: 'vab-actions' }, [presetsDiv, mainActionsDiv]);

        const editorDiv = createElement(
            'div',
            {
                className: 'vab-editor',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': 'Vehicle Assembly Building'
            },
            [header, mainPanel, statsBar, actionsDiv]
        );

        this.container.appendChild(editorDiv);

        // Restore scroll position
        const newPartsList = this.container.querySelector('#vab-parts-list');
        if (newPartsList) {
            newPartsList.scrollTop = scrollTop;
        }
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

        return categories.map((cat) => {
            const iconSpan = createElement('span', { className: 'tab-icon' }, [cat.icon]);
            return createElement(
                'button',
                {
                    className: `vab-cat-tab ${this.selectedCategory === cat.id ? 'active' : ''}`,
                    role: 'tab',
                    'aria-selected': this.selectedCategory === cat.id ? 'true' : 'false',
                    'aria-controls': 'vab-parts-list',
                    id: `tab-${cat.id}`,
                    'data-category': cat.id
                },
                [iconSpan, ` ${cat.label}`]
            );
        });
    }

    /**
     * Render parts list for selected category
     */
    private renderPartsList(): HTMLElement[] {
        const parts = getPartsByCategory(this.selectedCategory);

        if (parts.length === 0) {
            return [createElement('div', { className: 'vab-no-parts' }, ['🚫 No parts in this category'])];
        }

        return parts.map((part) => {
            const iconDiv = createElement('div', { className: 'vab-part-icon' }, [this.getPartIcon(part)]);

            const nameDiv = createElement('div', { className: 'vab-part-name' }, [part.name]);
            const descDiv = createElement('div', { className: 'vab-part-desc' }, [part.description]);
            const statsDiv = createElement('div', { className: 'vab-part-stats' }, [this.formatPartStats(part)]);

            const infoDiv = createElement('div', { className: 'vab-part-info' }, [nameDiv, descDiv, statsDiv]);
            const costDiv = createElement('div', { className: 'vab-part-cost' }, [`$${part.cost}`]);

            return createElement(
                'div',
                {
                    className: `vab-part-item ${this.selectedPartId === part.id ? 'selected' : ''}`,
                    'data-part-id': part.id,
                    role: 'button',
                    tabindex: 0,
                    'aria-label': `Select ${part.name}`
                },
                [iconDiv, infoDiv, costDiv]
            );
        });
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
            return [
                createElement('div', { className: 'vab-empty-vehicle' }, ['Add stages and parts to build your rocket'])
            ];
        }

        const elements: HTMLElement[] = [];

        for (let i = this.blueprint.stages.length - 1; i >= 0; i--) {
            const stage = this.blueprint.stages[i];
            if (!stage) continue;

            const stageElements: HTMLElement[] = [];

            for (let j = stage.parts.length - 1; j >= 0; j--) {
                const inst = stage.parts[j];
                if (!inst) continue;

                const labelSpan = createElement('span', { className: 'part-label' }, [inst.part.name]);
                const removeBtn = createElement(
                    'button',
                    {
                        className: 'remove-part',
                        'data-stage': i,
                        'data-instance': inst.instanceId,
                        title: `Remove ${inst.part.name}`,
                        'aria-label': `Remove ${inst.part.name}`
                    },
                    ['×']
                );

                const partDiv = createElement(
                    'div',
                    {
                        className: 'vab-part-preview',
                        'data-instance': inst.instanceId,
                        'data-height': inst.part.height,
                        'data-width': inst.part.width
                    },
                    [labelSpan, removeBtn]
                );

                stageElements.push(partDiv);
            }

            if (stage.hasDecoupler && i > 0) {
                stageElements.push(createElement('div', { className: 'vab-decoupler-marker' }, ['STAGE SEP']));
            }

            const stageDiv = createElement(
                'div',
                {
                    className: 'vab-stage-preview',
                    'data-stage': i
                },
                stageElements
            );

            elements.push(stageDiv);
        }

        return elements;
    }

    /**
     * Render stages list
     */
    private renderStagesList(): HTMLElement[] {
        if (this.blueprint.stages.length === 0) {
            return [
                createElement('div', { className: 'vab-no-stages' }, [
                    '🚀 No stages yet. Click "Add Stage" to begin assembly.'
                ])
            ];
        }

        const selectedPart = this.selectedPartId ? getPartById(this.selectedPartId) : null;
        const btnTitle = selectedPart ? `Add ${selectedPart.name}` : 'Select a part from the catalog first';
        const btnDisabled = !selectedPart;
        const btnText = selectedPart ? `+ Add ${selectedPart.name}` : '+ Add Selected Part';

        return this.blueprint.stages.map((stage, i) => {
            const stageStats = this.getStageStats(stage);

            const headerChildren: HTMLElement[] = [
                createElement('span', { className: 'stage-number' }, [`Stage ${i + 1}`]),
                createElement('span', { className: 'stage-info' }, [`${stage.parts.length} parts`])
            ];

            if (i > 0) {
                headerChildren.push(
                    createElement(
                        'button',
                        {
                            className: 'remove-stage',
                            'data-stage': i,
                            title: `Remove Stage ${i + 1}`,
                            'aria-label': `Remove Stage ${i + 1}`
                        },
                        ['REMOVE']
                    )
                );
            }

            const header = createElement('div', { className: 'vab-stage-header' }, headerChildren);

            const statsDiv = createElement('div', { className: 'vab-stage-stats' }, [
                createElement('span', {}, [`Mass: ${(stageStats.mass / 1000).toFixed(1)}t`]),
                createElement('span', {}, [`ΔV: ${stageStats.deltaV.toFixed(0)} m/s`])
            ]);

            const addBtn = createElement(
                'button',
                {
                    className: 'vab-add-to-stage',
                    'data-stage': i,
                    disabled: btnDisabled,
                    title: btnTitle
                },
                [btnText]
            );

            return createElement(
                'div',
                {
                    className: `vab-stage-item ${i === 0 ? 'first-stage' : ''}`,
                    'data-stage': i
                },
                [header, statsDiv, addBtn]
            );
        });
    }

    /**
     * Get simple stats for a single stage
     */
    private getStageStats(stage: VehicleStage): { mass: number; deltaV: number } {
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

        const massStat = createElement('div', { className: 'vab-stat', title: 'Mass of the fully fueled vehicle' }, [
            createElement('div', { className: 'vab-stat-label' }, ['Total Mass']),
            createElement('div', { className: 'vab-stat-value' }, [(stats.wetMass / 1000).toFixed(1)]),
            createElement('div', { className: 'vab-stat-unit' }, ['tons'])
        ]);

        const dvStat = createElement(
            'div',
            {
                className: 'vab-stat',
                title: 'Total change in velocity. Approx 9,400 m/s required for Low Earth Orbit.'
            },
            [
                createElement('div', { className: 'vab-stat-label' }, ['Total ΔV']),
                createElement('div', { className: `vab-stat-value ${dvClass}` }, [stats.totalDeltaV.toFixed(0)]),
                createElement('div', { className: 'vab-stat-unit' }, ['m/s'])
            ]
        );

        const twrStat = createElement(
            'div',
            { className: 'vab-stat', title: 'Thrust-to-Weight Ratio. Must be > 1.0 to liftoff. Ideal is 1.3-1.5.' },
            [
                createElement('div', { className: 'vab-stat-label' }, ['TWR (Stage 1)']),
                createElement('div', { className: `vab-stat-value ${twrClass}` }, [twr.toFixed(2)]),
                createElement('div', { className: 'vab-stat-unit' }, ['ratio'])
            ]
        );

        const stagesStat = createElement(
            'div',
            { className: 'vab-stat', title: 'Number of stages in the vehicle stack' },
            [
                createElement('div', { className: 'vab-stat-label' }, ['Stages']),
                createElement('div', { className: 'vab-stat-value' }, [this.blueprint.stages.length.toString()]),
                createElement('div', { className: 'vab-stat-unit' }, ['count'])
            ]
        );

        const costStat = createElement('div', { className: 'vab-stat', title: 'Total construction cost' }, [
            createElement('div', { className: 'vab-stat-label' }, ['Total Cost']),
            createElement('div', { className: 'vab-stat-value' }, [stats.totalCost.toLocaleString()]),
            createElement('div', { className: 'vab-stat-unit' }, ['credits'])
        ]);

        const indicatorsStat = createElement('div', { className: 'vab-stat' }, [
            createElement(
                'div',
                {
                    className: `vab-stat-indicator ${stats.hasAvionics ? 'ok' : 'warn'}`,
                    title: 'Flight computer guidance. Required for control.'
                },
                [`${stats.hasAvionics ? '[OK]' : '[MISSING]'} Avionics`]
            ),
            createElement(
                'div',
                {
                    className: `vab-stat-indicator ${stats.hasFairing ? 'ok' : 'warn'}`,
                    title: 'Protects payload from aerodynamic stress during ascent.'
                },
                [`${stats.hasFairing ? '[OK]' : '[MISSING]'} Fairing`]
            )
        ]);

        return [massStat, dvStat, twrStat, stagesStat, costStat, indicatorsStat];
    }
}
