/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Updates the Flight Computer HUD element with current status and commands.
 * Uses secure DOM methods to prevent XSS vulnerabilities.
 *
 * @param fcStatus The container element for the HUD
 * @param status The FlightComputer status object from Worker
 */
export function updateFlightComputerHUD(fcStatus: HTMLElement, status: any): void {
    if (!fcStatus) return;

    let statusStr: string;
    let commandStr: string;

    // Handle both data object (Worker/DTO) and class instance (Test/Legacy)
    if (status && typeof status.getStatusString === 'function') {
        statusStr = status.getStatusString();
        commandStr = status.getActiveCommandText();
    } else {
        statusStr = status.status || 'FC: ---';
        commandStr = status.command || '';
    }

    const isActive = statusStr === 'FC: ACTIVE';
    const isVisible = statusStr !== 'FC: OFF' && statusStr !== 'FC: ---';

    if (isVisible) {
        fcStatus.classList.add('active');

        let modeDiv = fcStatus.querySelector('.fc-mode');
        if (!modeDiv) {
            modeDiv = document.createElement('div');
            modeDiv.className = 'fc-mode';
            fcStatus.appendChild(modeDiv);
        }
        modeDiv.textContent = statusStr;

        let commandDiv = fcStatus.querySelector('.fc-command');
        if (isActive) {
            if (!commandDiv) {
                commandDiv = document.createElement('div');
                commandDiv.className = 'fc-command';
                fcStatus.appendChild(commandDiv);
            }
            commandDiv.textContent = commandStr;
        } else {
            if (commandDiv) {
                commandDiv.remove();
            }
        }
    } else {
        fcStatus.classList.remove('active');
        fcStatus.textContent = '';
    }
}
