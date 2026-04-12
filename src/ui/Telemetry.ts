/**
 * Telemetry System
 *
 * Records and displays flight data over time.
 * Shows altitude and velocity graphs.
 */

import type { TelemetryDataPoint } from '../types/index.ts';
import { MonotonicMaxQueue } from '../utils/MonotonicQueue';

export class TelemetrySystem {
    /** Canvas element */
    private canvas: HTMLCanvasElement | null;

    /** 2D rendering context */
    private ctx: CanvasRenderingContext2D | null;

    /** Recorded data points */
    private data: TelemetryDataPoint[] = [];

    /** Maximum number of data points to store */
    private readonly maxDataPoints: number = 300;

    /** Last sample time */
    private lastSample: number = 0;

    /** Sample interval (seconds) */
    private readonly sampleInterval: number = 0.1;

    /** Cached max values for scaling */
    private maxAlt: number = 100;
    private maxVel: number = 100;

    /** Monotonic queues for O(1) max retrieval */
    private maxAltQueue = new MonotonicMaxQueue();
    private maxVelQueue = new MonotonicMaxQueue();

    constructor() {
        this.canvas = document.getElementById('graph-canvas') as HTMLCanvasElement | null;
        this.ctx = this.canvas?.getContext('2d') ?? null;
    }

    /**
     * Update telemetry with new data point
     *
     * @param time - Current time (seconds)
     * @param alt - Altitude (meters)
     * @param vel - Velocity (m/s)
     */
    update(time: number, alt: number, vel: number): void {
        // Throttle sampling
        if (time - this.lastSample > this.sampleInterval) {
            // Update monotonic queues
            this.maxAltQueue.push(alt);
            this.maxVelQueue.push(vel);

            this.data.push({ t: time, alt, vel });

            // Limit data size
            if (this.data.length > this.maxDataPoints) {
                const removed = this.data.shift();

                if (removed) {
                    this.maxAltQueue.pop(removed.alt);
                    this.maxVelQueue.pop(removed.vel);
                }
            }

            // Update cached max values
            // Use 100 as minimum scale
            this.maxAlt = Math.max(100, this.maxAltQueue.max ?? 0);
            this.maxVel = Math.max(100, this.maxVelQueue.max ?? 0);

            this.lastSample = time;
        }
    }

    /**
     * Draw telemetry graphs
     */
    draw(): void {
        if (!this.ctx || !this.canvas) return;

        const w = this.canvas.width;
        const h = this.canvas.height;

        this.ctx.clearRect(0, 0, w, h);

        const len = this.data.length;
        if (len < 2) return;

        const maxAlt = this.maxAlt;
        const maxVel = this.maxVel;
        const xStep = w / (len - 1);
        const yAltScale = h / maxAlt;
        const yVelScale = h / maxVel;

        const altPath = new Path2D();
        const velPath = new Path2D();

        for (let i = 0; i < len; i++) {
            const d = this.data[i];
            if (!d) continue;
            const x = i * xStep;

            const yAlt = h - d.alt * yAltScale;
            const yVel = h - d.vel * yVelScale;

            if (i === 0) {
                altPath.moveTo(x, yAlt);
                velPath.moveTo(x, yVel);
            } else {
                altPath.lineTo(x, yAlt);
                velPath.lineTo(x, yVel);
            }
        }

        // Draw altitude line (green)
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#2ecc71';
        this.ctx.stroke(altPath);

        // Draw velocity line (blue)
        this.ctx.strokeStyle = '#3498db';
        this.ctx.stroke(velPath);
    }

    /**
     * Clear all recorded data
     */
    clear(): void {
        this.data = [];
        this.maxAltQueue.clear();
        this.maxVelQueue.clear();
        this.lastSample = 0;
        this.maxAlt = 100;
        this.maxVel = 100;
    }

    /**
     * Get current data
     */
    getData(): readonly TelemetryDataPoint[] {
        return this.data;
    }

    /**
     * Get latest data point
     */
    getLatest(): TelemetryDataPoint | undefined {
        return this.data[this.data.length - 1];
    }
}
