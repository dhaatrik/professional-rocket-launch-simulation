import { ManeuverPlan } from '../physics/OrbitalMechanics';
import { createElement } from './DOMUtils';

export function buildModalStructure(): HTMLElement {
    return createElement(
        'div',
        {
            className: 'script-editor-content maneuver-planner-content',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'planner-title'
        },
        [
            createElement('div', { className: 'script-editor-header' }, [
                createElement('h2', { id: 'planner-title', textContent: 'Orbital Maneuver Planner' }),
                createElement('button', {
                    id: 'planner-close-btn',
                    className: 'script-close-btn',
                    'aria-label': 'Close Maneuver Planner',
                    'aria-keyshortcuts': 'Escape',
                    title: 'Close [Esc]',
                    textContent: '×'
                })
            ]),
            createElement('div', { className: 'script-editor-body maneuver-planner-body' }, [
                createElement('div', { className: 'maneuver-section' }, [
                    createElement('h3', { textContent: 'Current Orbit' }),
                    createElement('div', { id: 'planner-orbit-stats', className: 'stats-grid' }, [
                        createElement('div', {}, [
                            createElement('strong', { textContent: 'Apoapsis:' }),
                            ' ',
                            createElement('span', { id: 'planner-stat-apo', textContent: '--' }),
                            ' km'
                        ]),
                        createElement('div', {}, [
                            createElement('strong', { textContent: 'Periapsis:' }),
                            ' ',
                            createElement('span', { id: 'planner-stat-peri', textContent: '--' }),
                            ' km'
                        ]),
                        createElement('div', {}, [
                            createElement('strong', { textContent: 'Period:' }),
                            ' ',
                            createElement('span', { id: 'planner-stat-period', textContent: '--' }),
                            ' min'
                        ]),
                        createElement('div', {}, [
                            createElement('strong', { textContent: 'Eccentricity:' }),
                            ' ',
                            createElement('span', { id: 'planner-stat-ecc', textContent: '--' })
                        ])
                    ])
                ]),
                createElement('div', { className: 'maneuver-section' }, [
                    createElement('h3', { textContent: 'Select Maneuver' }),
                    createElement(
                        'select',
                        {
                            id: 'maneuver-type-select',
                            className: 'script-select maneuver-select',
                            'aria-label': 'Select maneuver type'
                        },
                        [
                            createElement('option', {
                                value: 'circularize-apo',
                                textContent: 'Circularize at Apoapsis'
                            }),
                            createElement('option', {
                                value: 'circularize-peri',
                                textContent: 'Circularize at Periapsis'
                            }),
                            createElement('option', { value: 'hohmann', textContent: 'Hohmann Transfer' })
                        ]
                    ),
                    createElement(
                        'div',
                        {
                            id: 'hohmann-inputs',
                            className: 'maneuver-input-group',
                            style: { display: 'none' }
                        },
                        [
                            createElement('label', {
                                className: 'maneuver-label',
                                htmlFor: 'target-alt-input',
                                textContent: 'Target Altitude (km):'
                            }),
                            createElement('input', {
                                type: 'number',
                                id: 'target-alt-input',
                                className: 'script-name-input maneuver-input',
                                'aria-required': 'true',
                                required: true,
                                value: '500'
                            })
                        ]
                    )
                ]),
                createElement('div', { className: 'maneuver-section' }, [
                    createElement('h3', { textContent: 'Maneuver Plan' }),
                    createElement('div', {
                        id: 'planner-results',
                        className: 'maneuver-results',
                        'aria-live': 'polite',
                        textContent: 'Select a maneuver to calculate...'
                    })
                ])
            ]),
            createElement('div', { className: 'script-editor-footer' }, [
                createElement('button', {
                    id: 'planner-refresh-btn',
                    className: 'script-btn',
                    'aria-label': 'Refresh maneuver plan',
                    textContent: 'Refresh'
                })
            ])
        ]
    );
}

export function renderManeuverPlan(plan: ManeuverPlan, container: HTMLElement): void {
    container.appendChild(createElement('strong', { textContent: plan.description }));
    container.appendChild(createElement('br'));
    container.appendChild(createElement('hr', { className: 'maneuver-separator' }));
    container.appendChild(
        createElement('div', { textContent: `Target Orbit: ${(plan.targetOrbit.apoapsis / 1000).toFixed(0)} x ${(plan.targetOrbit.periapsis / 1000).toFixed(0)} km` })
    );

    const dvDiv = createElement('div', { className: 'maneuver-dv-container' });
    dvDiv.appendChild(createElement('span', { className: 'maneuver-dv-value', textContent: `ΔV: ${plan.deltaV.toFixed(1)} m/s` }));
    container.appendChild(dvDiv);

    container.appendChild(createElement('div', { textContent: `Burn Duration: ${plan.burnTime.toFixed(1)} s` }));
    container.appendChild(
        createElement('div', {
            className: 'maneuver-wait-text',
            textContent: `Wait for ${plan.description.includes('Apoapsis') ? 'Apoapsis' : 'Periapsis'} to execute.`
        })
    );
}

export function renderHohmannPlan(
    hResult: { deltaV1: number; deltaV2: number; transferTime: number; burnTime1: number },
    targetAltKm: number,
    container: HTMLElement
): void {
    container.appendChild(createElement('strong', { textContent: `Hohmann Transfer to ${targetAltKm} km` }));
    container.appendChild(createElement('br'));
    container.appendChild(createElement('hr', { className: 'maneuver-separator' }));
    container.appendChild(createElement('div', { textContent: `Transfer Time: ${(hResult.transferTime / 60).toFixed(1)} min` }));

    container.appendChild(createElement('div', { className: 'maneuver-burn-header', textContent: 'Burn 1 (Departure):' }));
    container.appendChild(createElement('div', { textContent: `ΔV: ${hResult.deltaV1.toFixed(1)} m/s` }));
    container.appendChild(createElement('div', { textContent: `Duration: ${hResult.burnTime1.toFixed(1)} s` }));

    container.appendChild(createElement('div', { className: 'maneuver-burn-header', textContent: 'Burn 2 (Arrival):' }));
    container.appendChild(createElement('div', { textContent: `ΔV: ${hResult.deltaV2.toFixed(1)} m/s` }));
    container.appendChild(createElement('div', { textContent: `Total ΔV: ${(hResult.deltaV1 + hResult.deltaV2).toFixed(1)} m/s` }));
}

export function renderErrorMessage(message: string, container: HTMLElement): void {
    container.appendChild(createElement('span', {
        className: 'maneuver-error',
        textContent: message
    }));
}
