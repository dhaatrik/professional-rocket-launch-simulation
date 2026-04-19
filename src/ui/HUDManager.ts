import { IVessel } from '../types';
import { EnvironmentState, formatTimeOfDay, getWindDirectionString } from '../physics/Environment';
import { UI_COLORS } from './UIConstants';
import { EngineStateCode } from '../core/PhysicsBuffer';
import { PIXELS_PER_METER } from '../config/Constants';
import { FlightTerminationSystem } from '../safety/FlightTermination';

export class HUDManager {
    // HUD state cache for minimizing DOM updates
    public lastHUDState = {
        // Environment
        windSpeed: -1,
        windDir: '',
        timeOfDay: '',
        launchStatus: '',
        maxQWarning: false,

        // Telemetry
        alt: '',
        vel: '',
        apogee: '',
        fuelPct: -1,
        thrustPct: -1,

        // Flight Data
        aoa: '',
        aoaColor: '',
        stability: '',
        stabilityColor: '',

        // TPS & Engine
        skinTemp: '',
        skinTempColor: '',
        tpsStatus: '',
        tpsStatusColor: '',
        engineStatus: '',
        engineStatusColor: '',
        igniters: -1,
        ignitersColor: '',

        // FTS
        ftsState: '',
        ftsStateColor: ''
    };

    // HUD element cache
    public hudWindSpeed: HTMLElement | null = null;
    public hudWindDir: HTMLElement | null = null;
    public hudTimeOfDay: HTMLElement | null = null;
    public hudLaunchStatus: HTMLElement | null = null;
    public hudMaxQ: HTMLElement | null = null;
    public hudAlt: HTMLElement | null = null;
    public hudVel: HTMLElement | null = null;
    public hudApogee: HTMLElement | null = null;
    public gaugeFuel: HTMLElement | null = null;
    public gaugeThrust: HTMLElement | null = null;
    public gaugeFuelContainer: HTMLElement | null = null;
    public gaugeThrustContainer: HTMLElement | null = null;
    public hudAoa: HTMLElement | null = null;
    public hudStability: HTMLElement | null = null;
    public hudSkinTemp: HTMLElement | null = null;
    public hudTpsStatus: HTMLElement | null = null;
    public hudEngineStatus: HTMLElement | null = null;
    public hudIgniters: HTMLElement | null = null;
    public hudFtsState: HTMLElement | null = null;

    constructor() {
        this.hudWindSpeed = document.getElementById('hud-wind-speed');
        this.hudWindDir = document.getElementById('hud-wind-dir');
        this.hudTimeOfDay = document.getElementById('hud-time-of-day');
        this.hudLaunchStatus = document.getElementById('hud-launch-status');
        this.hudMaxQ = document.getElementById('hud-maxq-warning');
        this.hudAlt = document.getElementById('hud-alt');
        this.hudVel = document.getElementById('hud-vel');
        this.hudApogee = document.getElementById('hud-apogee');
        this.gaugeFuel = document.getElementById('gauge-fuel');
        this.gaugeThrust = document.getElementById('gauge-thrust');
        this.gaugeFuelContainer = document.getElementById('fuel-gauge-container');
        this.gaugeThrustContainer = document.getElementById('thrust-gauge-container');
        this.hudAoa = document.getElementById('hud-aoa');
        this.hudStability = document.getElementById('hud-stability');
        this.hudSkinTemp = document.getElementById('hud-skin-temp');
        this.hudTpsStatus = document.getElementById('hud-tps-status');
        this.hudEngineStatus = document.getElementById('hud-engine-status');
        this.hudIgniters = document.getElementById('hud-igniters');
        this.hudFtsState = document.getElementById('hud-fts-state');
    }

    public update(
        trackedEntity: IVessel | null,
        groundY: number,
        cachedVelocity: number,
        lastEnvState: EnvironmentState | null,
        fts: FlightTerminationSystem
    ): void {
        this.updateEnvironmentHUD(lastEnvState);
        this.updateFlightDataHUD(trackedEntity, groundY, cachedVelocity);
        this.updateThermalHUD(trackedEntity);
        this.updatePropulsionHUD(trackedEntity);
        this.updateFTSHUD(fts);
    }

    private updateEnvironmentHUD(envState: EnvironmentState | null): void {
        const last = this.lastHUDState;

        if (envState) {
            const hudWindSpeed = this.hudWindSpeed;
            if (hudWindSpeed) {
                const speed = Math.round(envState.surfaceWindSpeed);
                if (last.windSpeed !== speed) {
                    last.windSpeed = speed;
                    hudWindSpeed.textContent = speed + ' m/s';

                    // Color coding based on wind limits
                    if (speed > 15) {
                        hudWindSpeed.style.color = UI_COLORS.RED;
                    } else if (speed > 10) {
                        hudWindSpeed.style.color = UI_COLORS.YELLOW;
                    } else {
                        hudWindSpeed.style.color = UI_COLORS.GREEN;
                    }
                }
            }

            const hudWindDir = this.hudWindDir;
            if (hudWindDir) {
                const dirStr = getWindDirectionString(envState.surfaceWindDirection);
                if (last.windDir !== dirStr) {
                    last.windDir = dirStr;
                    hudWindDir.textContent = dirStr;
                }
            }

            const hudTimeOfDay = this.hudTimeOfDay;
            if (hudTimeOfDay) {
                const timeStr = formatTimeOfDay(envState.timeOfDay);
                if (last.timeOfDay !== timeStr) {
                    last.timeOfDay = timeStr;
                    hudTimeOfDay.textContent = timeStr;
                }
            }

            const hudLaunchStatus = this.hudLaunchStatus;
            if (hudLaunchStatus) {
                const statusStr = envState.isLaunchSafe ? 'GO' : 'NO-GO';

                if (last.launchStatus !== statusStr) {
                    last.launchStatus = statusStr;
                    hudLaunchStatus.textContent = statusStr;

                    if (envState.isLaunchSafe) {
                        hudLaunchStatus.style.color = UI_COLORS.GREEN;
                        hudLaunchStatus.className = 'go-status';
                    } else {
                        hudLaunchStatus.style.color = UI_COLORS.RED;
                        hudLaunchStatus.className = 'no-go-status';
                    }
                }
            }

            // Max Q Wind Shear Warning
            if (envState.maxQWindWarning) {
                const hudMaxQ = this.hudMaxQ;
                if (hudMaxQ) {
                    if (!last.maxQWarning) {
                        last.maxQWarning = true;
                        hudMaxQ.textContent = '⚠ HIGH WIND SHEAR';
                        hudMaxQ.style.display = 'block';
                    }
                }
            } else if (last.maxQWarning) {
                last.maxQWarning = false;
                const hudMaxQ = this.hudMaxQ;
                if (hudMaxQ) hudMaxQ.style.display = 'none';
            }
        }
    }

    private updateFlightDataHUD(trackedEntity: IVessel | null, groundY: number, cachedVelocity: number): void {
        if (!trackedEntity) return;
        const last = this.lastHUDState;

        const hudAlt = this.hudAlt;
        const hudVel = this.hudVel;
        const hudApogee = this.hudApogee;
        const gaugeFuel = this.gaugeFuel;
        const gaugeThrust = this.gaugeThrust;
        const hudAoa = this.hudAoa;
        const hudStability = this.hudStability;

        if (hudAlt) {
            const altitude = (groundY - trackedEntity.y - trackedEntity.h) / PIXELS_PER_METER;
            const altStr = (altitude / 1000).toFixed(2) + ' km';
            if (last.alt !== altStr) {
                last.alt = altStr;
                hudAlt.textContent = altStr;
            }
        }

        if (hudVel) {
            const velStr = cachedVelocity.toFixed(1) + ' m/s';
            if (last.vel !== velStr) {
                last.vel = velStr;
                hudVel.textContent = velStr;
            }
        }

        if (hudApogee) {
            // Simple ballistic apogee approximation for HUD
            const altitude = (groundY - trackedEntity.y - trackedEntity.h) / PIXELS_PER_METER;
            const g = 9.81;
            const v_y = -trackedEntity.vy;
            let apogee = altitude;
            if (v_y > 0) {
                apogee = altitude + (v_y * v_y) / (2 * g);
            }
            const apStr = (apogee / 1000).toFixed(2) + ' km';
            if (last.apogee !== apStr) {
                last.apogee = apStr;
                hudApogee.textContent = apStr;
            }
        }

        if (gaugeFuel) {
            const fuelPct = trackedEntity.fuel;
            // Only update DOM if change is significant (1%)
            if (Math.abs(last.fuelPct - fuelPct) > 0.01) {
                last.fuelPct = fuelPct;
                gaugeFuel.style.height = fuelPct * 100 + '%';
                if (this.gaugeFuelContainer) {
                    this.gaugeFuelContainer.setAttribute('aria-valuenow', Math.round(fuelPct * 100).toString());
                }
            }
        }

        if (gaugeThrust) {
            const thrustPct = trackedEntity.throttle;
            if (Math.abs(last.thrustPct - thrustPct) > 0.01) {
                last.thrustPct = thrustPct;
                gaugeThrust.style.height = thrustPct * 100 + '%';
                if (this.gaugeThrustContainer) {
                    this.gaugeThrustContainer.setAttribute('aria-valuenow', Math.round(thrustPct * 100).toString());
                }
            }
        }

        if (hudAoa) {
            const aoaDeg = Math.abs((trackedEntity.aoa * 180) / Math.PI);
            const aoaStr = aoaDeg.toFixed(1) + '°';

            if (last.aoa !== aoaStr) {
                last.aoa = aoaStr;
                hudAoa.textContent = aoaStr;

                let color = UI_COLORS.GREEN;
                if (aoaDeg > 15) {
                    color = UI_COLORS.RED;
                } else if (aoaDeg > 5) {
                    color = UI_COLORS.YELLOW;
                }

                if (last.aoaColor !== color) {
                    last.aoaColor = color;
                    hudAoa.style.color = color;
                }
            }
        }

        if (hudStability) {
            const margin = trackedEntity.stabilityMargin;
            let stabStr: string;
            let color: string;

            if (trackedEntity.isAeroStable) {
                stabStr = (margin * 100).toFixed(1) + '%';
                color = UI_COLORS.GREEN;
            } else {
                stabStr = 'UNSTABLE';
                color = UI_COLORS.RED;
            }

            if (last.stability !== stabStr) {
                last.stability = stabStr;
                hudStability.textContent = stabStr;
            }

            if (last.stabilityColor !== color) {
                last.stabilityColor = color;
                hudStability.style.color = color;
            }
        }
    }

    private updateThermalHUD(trackedEntity: IVessel | null): void {
        if (!trackedEntity) return;
        const last = this.lastHUDState;

        const hudSkinTemp = this.hudSkinTemp;
        const hudTpsStatus = this.hudTpsStatus;

        if (hudSkinTemp) {
            const tempC = Math.round(trackedEntity.skinTemp - 273.15);
            const tempStr = tempC + '°C';

            if (last.skinTemp !== tempStr) {
                last.skinTemp = tempStr;
                hudSkinTemp.textContent = tempStr;

                let color = UI_COLORS.GREEN;
                if (trackedEntity.isThermalCritical) {
                    color = UI_COLORS.RED;
                } else if (tempC > 400) {
                    color = UI_COLORS.ORANGE;
                } else if (tempC > 200) {
                    color = UI_COLORS.YELLOW;
                }

                if (last.skinTempColor !== color) {
                    last.skinTempColor = color;
                    hudSkinTemp.style.color = color;
                }
            }
        }

        if (hudTpsStatus) {
            const shieldPct = Math.round(trackedEntity.heatShieldRemaining * 100);
            let statusStr: string;
            let color: string;

            if (shieldPct > 0) {
                statusStr = shieldPct + '%';
                if (trackedEntity.isAblating) {
                    color = UI_COLORS.ORANGE;
                } else if (shieldPct < 30) {
                    color = UI_COLORS.RED;
                } else {
                    color = UI_COLORS.GREEN;
                }
            } else {
                statusStr = 'N/A';
                color = UI_COLORS.GRAY;
            }

            if (last.tpsStatus !== statusStr) {
                last.tpsStatus = statusStr;
                hudTpsStatus.textContent = statusStr;
            }

            if (last.tpsStatusColor !== color) {
                last.tpsStatusColor = color;
                hudTpsStatus.style.color = color;
            }
        }
    }

    private updatePropulsionHUD(trackedEntity: IVessel | null): void {
        if (!trackedEntity) return;
        const last = this.lastHUDState;

        const hudEngineStatus = this.hudEngineStatus;
        const hudIgniters = this.hudIgniters;

        if (hudEngineStatus) {
            const state = trackedEntity.engineState;
            let statusStr: string;
            let color: string;

            switch (state) {
                case EngineStateCode.OFF:
                    statusStr = 'OFF';
                    color = UI_COLORS.GRAY;
                    break;
                case EngineStateCode.STARTING:
                    statusStr = 'SPOOL';
                    color = UI_COLORS.YELLOW;
                    break;
                case EngineStateCode.RUNNING:
                    statusStr = 'RUN';
                    color = UI_COLORS.GREEN;
                    break;
                case EngineStateCode.SHUTDOWN:
                    statusStr = 'STOP';
                    color = UI_COLORS.ORANGE;
                    break;
                case EngineStateCode.FLAMEOUT:
                    statusStr = 'FLAMEOUT';
                    color = UI_COLORS.RED;
                    break;
                default:
                    statusStr = 'UNKNOWN';
                    color = UI_COLORS.GRAY;
            }

            if (last.engineStatus !== statusStr) {
                last.engineStatus = statusStr;
                hudEngineStatus.textContent = statusStr;
            }

            if (last.engineStatusColor !== color) {
                last.engineStatusColor = color;
                hudEngineStatus.style.color = color;
            }
        }

        if (hudIgniters) {
            const count = trackedEntity.ignitersRemaining;
            if (last.igniters !== count) {
                last.igniters = count;
                hudIgniters.textContent = count.toString();

                let color: string;
                if (count === 0) {
                    color = UI_COLORS.RED;
                } else if (count === 1) {
                    color = UI_COLORS.ORANGE;
                } else {
                    color = UI_COLORS.GREEN;
                }

                if (last.ignitersColor !== color) {
                    last.ignitersColor = color;
                    hudIgniters.style.color = color;
                }
            }
        }
    }

    private updateFTSHUD(fts: FlightTerminationSystem): void {
        if (!fts) return;
        const last = this.lastHUDState;

        const hudFtsState = this.hudFtsState;
        if (hudFtsState) {
            const ftsStatus = fts.getStatus();
            let ftsStr: string = ftsStatus.state;
            let ftsColor = '';

            switch (ftsStatus.state) {
                case 'SAFE':
                    ftsColor = UI_COLORS.GREEN;
                    break;
                case 'WARNING':
                    ftsStr = `WARN ${(fts.config.warningDurationS - ftsStatus.warningTimer).toFixed(0)}s`;
                    ftsColor = UI_COLORS.YELLOW;
                    break;
                case 'ARM':
                    ftsStr = ftsStatus.armed ? 'ARMED' : 'ARM';
                    ftsColor = UI_COLORS.ORANGE;
                    break;
                case 'DESTRUCT':
                    ftsStr = 'DESTRUCT';
                    ftsColor = UI_COLORS.RED;
                    break;
            }

            if (last.ftsState !== ftsStr) {
                last.ftsState = ftsStr;
                hudFtsState.textContent = ftsStr;
            }

            if (last.ftsStateColor !== ftsColor) {
                last.ftsStateColor = ftsColor;
                hudFtsState.style.color = ftsColor;
            }
        }
    }
}
