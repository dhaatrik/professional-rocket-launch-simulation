/**
 * Main Entry Point
 *
 * Initializes the game and sets up UI event listeners.
 * This is the entry point for the bundled application.
 */

import { Game } from './core/Game';
import { CONFIG, PIXELS_PER_METER } from './config/Constants';
import { state } from './core/State';
import { SASModes } from './utils/SAS';
import { FullStack } from './physics/RocketComponents';
import { ScriptEditor } from './ui/ScriptEditor';
import { exportFlightData } from './telemetry/TelemetryExporter';
import { VABEditor } from './ui/VABEditor';
import { VehicleBlueprint, calculateStats } from './vab/VehicleBlueprint';
import { Vessel } from './physics/Vessel';
import { updateFlightComputerHUD } from './ui/FlightComputerHUD';

// Create and initialize game
let game: Game;
try {
    game = new Game();
    game.init().catch((e) => {
        console.error('Game initialization failed:', e);
        alert(`Game Init Error: ${e.message}`);
    });
} catch (e: any) {
    console.error('Game constructor failed:', e);
    alert(
        `Critical Error: ${e.message}\n\nThis application looks for SharedArrayBuffer support. Please ensure you are running with COOP/COEP headers.`
    );
    throw e;
}

// UI Cache for optimized updates
const uiCache = {
    fcStatus: null as HTMLElement | null,
    launchBtn: null as HTMLElement | null,
    bbStatus: null as HTMLElement | null,
    sasModeText: null as HTMLElement | null,
    tooltipOverlay: null as HTMLElement | null,
    fcBtn: null as HTMLElement | null
};

function initUI() {
    uiCache.fcStatus = document.getElementById('fc-status');
    uiCache.launchBtn = document.getElementById('launch-btn');
    uiCache.bbStatus = document.getElementById('bb-status');
    uiCache.sasModeText = document.getElementById('sas-mode-text');
    uiCache.tooltipOverlay = document.getElementById('tooltip-overlay');
    uiCache.fcBtn = document.getElementById('fc-btn');
}
initUI();

// Create Script Editor UI for Flight Computer
const scriptEditor = new ScriptEditor(game);

// Create VAB Editor with launch callback
const vabEditor = new VABEditor('vab-modal', (blueprint: VehicleBlueprint) => {
    // Apply blueprint stats to CONFIG for now (future: ModularVessel)
    const stats = calculateStats(blueprint);
    CONFIG.FUEL_MASS = stats.fuelMass;

    // Hide splash and reset
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) splashScreen.style.display = 'none';

    game.spawnVessel(blueprint);
    game.missionLog.log(`${blueprint.name} configured - ΔV: ${stats.totalDeltaV.toFixed(0)} m/s`, 'info');
    showOnboarding();
});

// ========================================
// UI/UX IMPROVEMENTS - Event Listeners
// ========================================

// --- Mission Log Toggle ---
document.querySelector('#mission-log h3')?.addEventListener('click', () => {
    document.getElementById('mission-log')?.classList.toggle('collapsed');
});

// --- Reset Button ---
document.getElementById('reset-btn')?.addEventListener('click', () => {
    location.reload();
});

// Track flight phase for dynamic buttons
let flightPhase: 'prelaunch' | 'ascending' | 'descending' | 'landed' = 'prelaunch';

// --- IMPROVEMENT #7: Onboarding System ---
function showOnboarding(): void {
    if (localStorage.getItem('onboarding-complete')) return;
    const overlay = uiCache.tooltipOverlay;
    if (overlay) {
        overlay.classList.add('visible');
        // Give time for display:block to apply before focusing
        setTimeout(() => {
            document.getElementById('tooltip-dismiss')?.focus();
        }, 50);
    }
}

function dismissOnboarding(): void {
    const overlay = uiCache.tooltipOverlay;
    if (overlay && overlay.classList.contains('visible')) {
        overlay.classList.remove('visible');
        localStorage.setItem('onboarding-complete', 'true');
        // Return focus to a logical element for keyboard users
        document.getElementById('launch-btn')?.focus();
    }
}

document.getElementById('tooltip-dismiss')?.addEventListener('click', dismissOnboarding);

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        dismissOnboarding();
    }
});

// --- Splash Screen Buttons ---
document.getElementById('start-btn')?.addEventListener('click', () => {
    const splash = document.getElementById('splash-screen');
    if (splash) splash.style.display = 'none';
    game.missionLog.log('Mission Control Active', 'info');
    showOnboarding();
});

document.getElementById('open-vab-btn')?.addEventListener('click', () => {
    vabEditor.show();
});

// --- IMPROVEMENT #2: Dynamic Action Buttons ---
function updateActionButton(): void {
    const btn = uiCache.launchBtn;
    if (!btn || !game.trackedEntity) return;

    const alt = (state.groundY - game.trackedEntity.y - game.trackedEntity.h) / PIXELS_PER_METER;
    const vy = game.trackedEntity.vy;

    if (game.trackedEntity.throttle === 0 && alt < 100) {
        // Pre-launch
        btn.textContent = 'INITIATE LAUNCH';
        btn.className = 'primary state-launch';
        flightPhase = 'prelaunch';
    } else if (vy < 0) {
        // Ascending
        btn.textContent = 'ABORT MISSION';
        btn.className = 'primary state-abort';
        flightPhase = 'ascending';
    } else if (vy > 0 && alt > 1000) {
        // Descending from high altitude
        btn.textContent = 'DEPLOY LEGS';
        btn.className = 'primary state-deploy';
        flightPhase = 'descending';
    }
}

// Launch/Abort/Deploy button
document.getElementById('launch-btn')?.addEventListener('click', () => {
    if (flightPhase === 'prelaunch') {
        // Gate launch on checklist
        if (!game.checklist.isReadyForLaunch()) {
            game.missionLog.log('LAUNCH HOLD — Complete checklist first (press C)', 'warn');
            game.checklist.show();
            return;
        }
        game.launch();
        game.checklist.hide();
        updateActionButton();
    } else if (flightPhase === 'ascending') {
        // Abort - cut engines
        game.setThrottle(0);
        game.missionLog.log('ABORT INITIATED', 'warn');
    } else if (flightPhase === 'descending') {
        game.missionLog.log('LANDING LEGS DEPLOYED', 'info');
    }
});

// --- IMPROVEMENT #9: Color-Coded Toggle Buttons ---
document.getElementById('autopilot-btn')?.addEventListener('click', (e) => {
    const btn = e.target as HTMLButtonElement;
    state.autopilotEnabled = !state.autopilotEnabled;
    btn.textContent = state.autopilotEnabled ? 'Auto-Land: ON' : 'Auto-Land: OFF';
    btn.classList.toggle('enabled', state.autopilotEnabled);
    btn.setAttribute('aria-pressed', String(state.autopilotEnabled));
});

document.getElementById('audio-btn')?.addEventListener('click', (e) => {
    const btn = e.target as HTMLButtonElement;
    const muted = game.audio.toggleMute();
    btn.textContent = muted ? 'Enable Audio' : 'Disable Audio';
    btn.classList.remove('enabled', 'disabled');
    btn.classList.add(muted ? 'disabled' : 'enabled');
    btn.setAttribute('aria-pressed', String(!muted));
});

// --- IMPROVEMENT #4: SAS Control with Mode Indicator ---
document.querySelectorAll('.sas-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sas-btn').forEach((b) => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');

        const mode = btn.id.replace('sas-', '').toUpperCase() as keyof typeof SASModes;
        const sasMode = SASModes[mode] ?? SASModes.OFF;
        game.sas.setMode(sasMode, game.trackedEntity?.angle ?? 0);

        // Update SAS mode indicator
        const modeText = uiCache.sasModeText;
        const modeIcons: Record<string, string> = {
            OFF: '',
            STABILITY: '',
            PROGRADE: '',
            RETROGRADE: ''
        };

        if (modeText) {
            modeText.textContent = mode;
            const iconEl = modeText.previousElementSibling;
            if (iconEl) iconEl.textContent = '';
        }
    });
});

// --- IMPROVEMENT #10: Camera Mode Panel ---
document.querySelectorAll('#camera-panel button').forEach((btn) => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#camera-panel button').forEach((b) => {
            b.classList.remove('active');
            b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');

        const camMode = parseInt((btn as HTMLButtonElement).dataset.cam ?? '1');
        game.input.cameraMode = camMode;
        game.missionLog.log(`Camera: ${btn.textContent?.trim()}`, 'info');
    });
});

// --- Maneuver Planner Button ---
document.getElementById('maneuver-btn')?.addEventListener('click', () => {
    game.maneuverPlanner.toggle();
});

// --- Mission Control Button ---
document.getElementById('mission-control-btn')?.addEventListener('click', () => {
    game.missionControl.toggle();
});

// --- Checklist Button ---
document.getElementById('checklist-btn')?.addEventListener('click', () => {
    game.checklist.toggle();
});

// --- FTS Destruct Button ---
document.getElementById('fts-destruct-btn')?.addEventListener('click', () => {
    if (game.trackedEntity) {
        const success = game.fts.triggerManualDestruct(game.trackedEntity);
        if (!success) {
            game.missionLog.log('FTS: Arm the system first (press T)', 'warn');
        }
    }
});

// --- FIS Panel Fault Toggle ---
document.getElementById('fis-panel')?.addEventListener('fis-toggle', ((e: CustomEvent) => {
    const faultId = e.detail?.faultId;
    if (faultId && game.trackedEntity && game.trackedEntity instanceof Vessel) {
        game.faultInjector.toggleFault(faultId, game.trackedEntity, (game.trackedEntity as Vessel).reliability);
    }
}) as EventListener);

// --- Flight Computer Button ---
uiCache.fcBtn?.addEventListener('click', () => {
    scriptEditor.open();
});

// --- Telemetry Pop-out Button ---
document.getElementById('telemetry-btn')?.addEventListener('click', () => {
    window.open('telemetry.html', 'Telemetry', 'width=800,height=600');
    game.missionLog.log('Telemetry Link Established', 'success');
});

// --- Flight Computer HUD Update ---
function updateFCStatus(): void {
    const fcStatus = uiCache.fcStatus;
    if (!fcStatus) return;

    // Use shared secure HUD updater
    updateFlightComputerHUD(fcStatus, game.getFlightComputerStatus());
}

// ========================================
// KEYBOARD SHORTCUTS
// ========================================
window.addEventListener('keydown', (e) => {
    // Prevent default for game keys
    if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
    }

    // SPACE - Launch or Stage
    if (e.key === ' ') {
        if (flightPhase === 'prelaunch' && game.mainStack?.throttle === 0) {
            // Gate launch on checklist
            if (!game.checklist.isReadyForLaunch()) {
                game.missionLog.log('LAUNCH HOLD — Complete checklist first (press C)', 'warn');
                game.checklist.show();
                return;
            }
            // Initial ignition
            game.launch();
            game.checklist.hide();
            updateActionButton();
        } else if (flightPhase !== 'prelaunch') {
            // Staging
            game.performStaging();
        }
    }

    // S - Staging
    if (e.key === 's' || e.key === 'S') {
        game.performStaging();
    }

    // 1, 2, 3 - Camera modes
    if (e.key === '1') {
        document.querySelector<HTMLButtonElement>('#camera-panel button[data-cam="1"]')?.click();
    } else if (e.key === '2') {
        document.querySelector<HTMLButtonElement>('#camera-panel button[data-cam="2"]')?.click();
    } else if (e.key === '3') {
        document.querySelector<HTMLButtonElement>('#camera-panel button[data-cam="3"]')?.click();
    }

    // A - Toggle Autopilot
    if (e.key === 'a' || e.key === 'A') {
        document.getElementById('autopilot-btn')?.click();
    }

    // G - Toggle Flight Computer
    if (e.key === 'g' || e.key === 'G') {
        const fcStatus = game.getFlightComputerStatus();
        const statusStr = fcStatus.status;

        if (statusStr === 'FC: OFF' || statusStr === 'FC: READY' || statusStr === 'FC: ---') {
            game.command('FC_START', {});
            game.missionLog.log('FC: Activating...', 'info');
        } else {
            game.command('FC_STOP', {});
            game.missionLog.log('FC: Deactivating...', 'info');
        }

        // Update FC button state
        const fcBtn = uiCache.fcBtn;
        if (fcBtn) {
            // Optimistic update
            fcBtn.classList.toggle('enabled', statusStr === 'FC: OFF');
        }
    }

    // F - Open Script Editor
    if (e.key === 'f' || e.key === 'F') {
        scriptEditor.open();
    }

    // R - Toggle Black Box Recording
    if (e.key === 'r' || e.key === 'R') {
        game.blackBox.toggle();
        const status = game.blackBox.getStatusString();
        game.missionLog.log(`Black Box: ${status || 'IDLE'}`, 'info');
    }

    // E - Export Flight Data
    if (e.key === 'e' || e.key === 'E') {
        const frames = game.blackBox.getFrames();
        if (frames.length > 0) {
            exportFlightData(frames, game.blackBox.getSummary(), 'csv');
            game.missionLog.log(`Exported ${frames.length} frames to CSV`, 'success');
        } else {
            game.missionLog.log('No flight data to export', 'warn');
        }
    }

    // T - Toggle SAS (Stability) / Alt+T - Toggle FTS Arm
    if (e.key === 't' || e.key === 'T') {
        if (e.altKey) {
            // Alt+T: Toggle FTS Arm
            game.fts.toggleArm();
            const ftsBtn = document.getElementById('fts-destruct-btn');
            if (ftsBtn) {
                ftsBtn.classList.toggle('armed', game.fts.getStatus().armed);
            }
        } else {
            // T: Toggle SAS Stability
            const sasOffBtn = document.getElementById('sas-off');
            const sasStabBtn = document.getElementById('sas-stability');

            if (sasOffBtn && sasStabBtn) {
                // If currently OFF (active class on OFF button), switch to STABILITY
                if (sasOffBtn.classList.contains('active')) {
                    sasStabBtn.click();
                } else {
                    // If currently ON (any mode), switch to OFF
                    sasOffBtn.click();
                }
            }
        }
    }

    // [ - SAS Prograde
    if (e.key === '[') {
        document.getElementById('sas-prograde')?.click();
    }

    // ] - SAS Retrograde
    if (e.key === ']') {
        document.getElementById('sas-retrograde')?.click();
    }

    // C - Toggle Checklist
    if (e.key === 'c' || e.key === 'C') {
        game.checklist.toggle();
    }

    // Ctrl+I - Toggle Fault Injection System (instructor)
    if (e.key === 'i' && e.ctrlKey) {
        e.preventDefault();
        game.faultInjector.toggle();
    }
});

// Update action button periodically
setInterval(updateActionButton, 500);
setInterval(updateFCStatus, 100);

// Update Black Box status in HUD
function updateBlackBoxStatus(): void {
    const bbStatus = uiCache.bbStatus;
    if (bbStatus) {
        const status = game.blackBox.getStatusString();
        bbStatus.textContent = status;
        bbStatus.classList.toggle('recording', game.blackBox.isRecording());
    }
}
setInterval(updateBlackBoxStatus, 200);

// Export button handler
document.getElementById('export-btn')?.addEventListener('click', () => {
    const frames = game.blackBox.getFrames();
    if (frames.length > 0) {
        exportFlightData(frames, game.blackBox.getSummary(), 'csv');
        game.missionLog.log(`Exported ${frames.length} frames to CSV`, 'success');
    } else {
        game.missionLog.log('No flight data to export', 'warn');
    }
});
