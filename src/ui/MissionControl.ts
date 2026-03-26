/**
 * Mission Control Dashboard
 *
 * Visualizes the rocket's ground track, impact point, and key telemetry
 * on a world map (Mercator projection).
 */

import { Game } from '../core/Game';
import { calculateGroundTrack, LAUNCH_SITE } from '../physics/OrbitalMechanics';

interface PathPoint {
    lat: number;
    lon: number;
    relX: number;
    relY: number;
}

export class MissionControl {
    private game: Game;
    private isVisible: boolean = false;
    private pathPoints: PathPoint[] = [];
    private lastPathUpdate: number = 0;
    private escapeHandler: ((e: KeyboardEvent) => void) | null = null;
    private invokingElement: HTMLElement | null = null;

    constructor(game: Game) {
        this.game = game;
        // Pre-fill path with launch site
        this.addPathPoint(LAUNCH_SITE.lat, LAUNCH_SITE.lon);
    }

    toggle(): void {
        if (!this.isVisible) {
            this.invokingElement = document.activeElement as HTMLElement;
        }

        this.isVisible = !this.isVisible;
        const mcOverlay = document.getElementById('mission-control-overlay');

        if (mcOverlay) {
            mcOverlay.style.display = this.isVisible ? 'block' : 'none';
        }

        if (this.isVisible) {
            if (!this.escapeHandler) {
                this.escapeHandler = (e: KeyboardEvent) => {
                    if (e.key === 'Escape' && this.isVisible) {
                        this.toggle();
                    }
                };
                document.addEventListener('keydown', this.escapeHandler);
            }
        } else {
            if (this.escapeHandler) {
                document.removeEventListener('keydown', this.escapeHandler);
                this.escapeHandler = null;
            }
            if (this.invokingElement) {
                this.invokingElement.focus();
                this.invokingElement = null;
            }
        }
    }

    update(dt: number, time: number): void {
        if (!this.game.trackedEntity) return;

        // Update path every 1 second or so to save memory/perf, or if distance moved is significant
        if (time - this.lastPathUpdate > 1.0) {
            // Every 1 sec
            const downrange = this.game.trackedEntity.x;
            const track = calculateGroundTrack(downrange, time);
            this.addPathPoint(track.lat, track.lon);
            this.lastPathUpdate = time;

            // Limit path length to prevent memory leak (e.g. last 1000 points)
            if (this.pathPoints.length > 3600) {
                // ~1 hour of flight
                this.pathPoints.shift();
            }
        }
    }

    private addPathPoint(lat: number, lon: number): void {
        const relX = this.lonToRel(lon);
        const relY = this.latToRel(lat);
        this.pathPoints.push({ lat, lon, relX, relY });
    }

    draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
        if (!this.isVisible) return;

        // Draw background
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, width, height);

        // Draw Map Grid (Mercator)
        // Mercator range: Lon [-PI, PI], Lat limit usually ~85 deg
        // Map Area: Let's use a central box, e.g., 80% width/height
        const mapW = width * 0.9;
        const mapH = height * 0.8;
        const mapX = (width - mapW) / 2;
        const mapY = (height - mapH) / 2;

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(mapX, mapY, mapW, mapH);

        // Grid Lines
        ctx.beginPath();
        // Longitude lines (every 30 deg)
        for (let i = -180; i <= 180; i += 30) {
            const x = this.lonToMask((i * Math.PI) / 180, mapX, mapW);
            ctx.moveTo(x, mapY);
            ctx.lineTo(x, mapY + mapH);
        }
        // Latitude lines (Equator, Tropics, Circles)
        const latLines = [0, 23.5, -23.5, 66.5, -66.5];
        latLines.forEach((lat) => {
            const y = this.latToMask((lat * Math.PI) / 180, mapY, mapH);
            ctx.moveTo(mapX, y);
            ctx.lineTo(mapX + mapW, y);
        });
        ctx.stroke();

        // Draw Prime Meridian & Equator thicker
        ctx.beginPath();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        // Equator
        const eqY = this.latToMask(0, mapY, mapH);
        ctx.moveTo(mapX, eqY);
        ctx.lineTo(mapX + mapW, eqY);
        // Prime Meridian
        const pmX = this.lonToMask(0, mapX, mapW);
        ctx.moveTo(pmX, mapY);
        ctx.lineTo(pmX, mapY + mapH);
        ctx.stroke();

        // Draw Launch Site
        const lsX = this.lonToMask(LAUNCH_SITE.lon, mapX, mapW);
        const lsY = this.latToMask(LAUNCH_SITE.lat, mapY, mapH);
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(lsX, lsY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('CAPE', lsX + 5, lsY);

        // Draw Path
        if (this.pathPoints.length > 1) {
            ctx.strokeStyle = '#e74c3c'; // Red trail
            ctx.lineWidth = 2;
            ctx.beginPath();

            // Handle wrapping? Simple drawing for now, might draw lines across map if wrapping.
            // Improve: Break line if dLon > PI

            for (let i = 0; i < this.pathPoints.length; i++) {
                const p = this.pathPoints[i];
                if (!p) continue;

                // Optimization: Use pre-calculated relative coordinates
                const px = mapX + p.relX * mapW;
                const py = mapY + p.relY * mapH;

                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    const prev = this.pathPoints[i - 1];
                    // Check for wrapping (dateline crossing)
                    if (prev && Math.abs(p.lon - prev.lon) > Math.PI) {
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(px, py);
                    } else {
                        ctx.lineTo(px, py);
                    }
                }
            }
            ctx.stroke();
        }

        // Current Position
        if (this.game.trackedEntity) {
            const currentTrack = calculateGroundTrack(this.game.trackedEntity.x, this.game.missionTime);
            const cx = this.lonToMask(currentTrack.lon, mapX, mapW);
            const cy = this.latToMask(currentTrack.lat, mapY, mapH);

            ctx.fillStyle = '#2ecc71'; // Green current
            ctx.beginPath();
            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
            ctx.fill();

            // Ripple effect
            ctx.strokeStyle = '#2ecc71';
            ctx.lineWidth = 1;
            const ripple = ((Date.now() % 1000) / 1000) * 20;
            ctx.beginPath();
            ctx.arc(cx, cy, ripple, 0, Math.PI * 2);
            ctx.stroke();

            // Draw Impact Point (Simple ballistic)
            // If suborbital (ecc < 1 and periapsis < 0 approx)
            // This is hard to calc exactly without full propagator,
            // but we can just project forward a bit or use current velocity vector direction?
            // "Current Heading" line
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.5)';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            // simple heading estimation (not quite right but visual)
            // heading derived from lat/lon change?
            // No, just draw a small leader line
            // ctx.lineTo(cx + 20, cy);
            // We need heading angle.
        }

        // Overlay Text
        ctx.fillStyle = 'white';
        ctx.font = '24px monospace';
        ctx.fillText('MISSION CONTROL - GROUND TRACK', mapX, mapY - 15);

        ctx.font = '14px monospace';
        ctx.fillStyle = '#aaa';
        const lastPoint = this.pathPoints[this.pathPoints.length - 1];
        if (lastPoint) {
            const latDeg = ((lastPoint.lat * 180) / Math.PI).toFixed(4);
            const lonDeg = ((lastPoint.lon * 180) / Math.PI).toFixed(4);
            ctx.fillText(`LAT: ${latDeg}°  LON: ${lonDeg}°`, mapX + mapW - 250, mapY - 15);
        }
    }

    // Helper: Longitude to Relative X [0, 1]
    private lonToRel(lon: number): number {
        // lon in [-PI, PI] -> [0, 1] relative
        return (lon + Math.PI) / (2 * Math.PI);
    }

    // Helper: Latitude to Relative Y [0, 1]
    private latToRel(lat: number): number {
        // lat in [-85 deg, 85 deg] to avoid infinity
        // y = ln(tan(PI/4 + lat/2))
        const MAX_LAT = (85 * Math.PI) / 180;
        const clampedLat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));

        const mercN = Math.log(Math.tan(Math.PI / 4 + clampedLat / 2));
        // Normalize: Max Mercator Y (at 85 deg) is approx 3.13
        const MAX_MERC = 3.13; // Math.log(Math.tan(Math.PI/4 + MAX_LAT/2))

        // Map [-MAX_MERC, MAX_MERC] to [height, 0] (Top is North)
        // rel from 0 (North) to 1 (South)
        return 1 - (mercN + MAX_MERC) / (2 * MAX_MERC);
    }

    // Helper: Longitude to Screen X (Mercator)
    private lonToMask(lon: number, mapX: number, mapW: number): number {
        return mapX + this.lonToRel(lon) * mapW;
    }

    // Helper: Latitude to Screen Y (Mercator)
    private latToMask(lat: number, mapY: number, mapH: number): number {
        return mapY + this.latToRel(lat) * mapH;
    }
}
