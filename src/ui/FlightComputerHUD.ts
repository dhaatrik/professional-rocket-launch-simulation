import type { FlightComputerStatusDTO } from '../types';

/**
 * Updates the Flight Computer HUD element with current status and commands.
 * Uses secure DOM methods to prevent XSS vulnerabilities.
 *
 * @param fcStatus The container element for the HUD
 * @param status The FlightComputer status object from Worker
 */
interface HUDCache {
    modeDiv: HTMLElement | null;
    commandDiv: HTMLElement | null;
}

const domCache = new WeakMap<HTMLElement, HUDCache>();

export function updateFlightComputerHUD(
    fcStatus: HTMLElement,
    status: FlightComputerStatusDTO | { getStatusString: () => string; getActiveCommandText: () => string }
): void {
    if (!fcStatus) return;

    let statusStr: string;
    let commandStr: string;

    // Handle both data object (Worker/DTO) and class instance (Test/Legacy)
    if (status && 'getStatusString' in status && typeof status.getStatusString === 'function') {
        statusStr = status.getStatusString();
        commandStr = (status as { getActiveCommandText: () => string }).getActiveCommandText();
    } else {
        statusStr = (status as FlightComputerStatusDTO).status || 'FC: ---';
        commandStr = (status as FlightComputerStatusDTO).command || '';
    }

    const isActive = statusStr === 'FC: ACTIVE';
    const isVisible = statusStr !== 'FC: OFF' && statusStr !== 'FC: ---';

    let cache = domCache.get(fcStatus);
    if (!cache) {
        cache = {
            modeDiv: fcStatus.querySelector('.fc-mode') as HTMLElement | null,
            commandDiv: fcStatus.querySelector('.fc-command') as HTMLElement | null
        };
        domCache.set(fcStatus, cache);
    }

    if (isVisible) {
        fcStatus.classList.add('active');

        let modeDiv = cache.modeDiv;
        if (!modeDiv) {
            modeDiv = document.createElement('div');
            modeDiv.className = 'fc-mode';
            fcStatus.appendChild(modeDiv);
            cache.modeDiv = modeDiv;
        } else if (!modeDiv.parentNode) {
            fcStatus.appendChild(modeDiv);
        }
        modeDiv.textContent = statusStr;

        let commandDiv = cache.commandDiv;
        if (isActive) {
            if (!commandDiv) {
                commandDiv = document.createElement('div');
                commandDiv.className = 'fc-command';
                fcStatus.appendChild(commandDiv);
                cache.commandDiv = commandDiv;
            } else if (!commandDiv.parentNode) {
                fcStatus.appendChild(commandDiv);
            }
            commandDiv.textContent = commandStr;
        } else {
            if (commandDiv && commandDiv.parentNode) {
                fcStatus.removeChild(commandDiv);
            }
        }
    } else {
        fcStatus.classList.remove('active');
        if (cache.modeDiv && cache.modeDiv.parentNode) {
            fcStatus.removeChild(cache.modeDiv);
        }
        if (cache.commandDiv && cache.commandDiv.parentNode) {
            fcStatus.removeChild(cache.commandDiv);
        }
        fcStatus.textContent = '';
    }
}
