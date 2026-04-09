/**
 * Telemetry Receiver
 *
 * Handles receiving broadcasted telemetry data and updating the UI.
 */
import { TelemetryPacket } from './TelemetryTransmitter';

interface Vector2D {
    x: number;
    y: number;
}

class TelemetryReceiver {
    private channel: BroadcastChannel;
    private statusEl: HTMLElement;

    // UI Elements
    private dispAlt: HTMLElement;
    private dispVel: HTMLElement;
    private dispApogee: HTMLElement;
    private dispThrottle: HTMLElement;
    private dispFuel: HTMLElement;

    // Charts
    private mapCanvas: HTMLCanvasElement;
    private mapCtx: CanvasRenderingContext2D;
    private chartCanvas: HTMLCanvasElement;
    private chartCtx: CanvasRenderingContext2D;

    // Data Buffers
    private readonly MAX_POINTS = 100;
    private altHistory: number[] = new Array(this.MAX_POINTS).fill(0);
    private altHistoryHead: number = 0;
    private path: Vector2D[] = [];

    constructor() {
        this.channel = new BroadcastChannel('telemetry_channel');

        // Cache DOM elements
        this.statusEl = document.getElementById('connection-status') as HTMLElement;
        this.dispAlt = document.getElementById('disp-alt') as HTMLElement;
        this.dispVel = document.getElementById('disp-vel') as HTMLElement;
        this.dispApogee = document.getElementById('disp-apogee') as HTMLElement;
        this.dispThrottle = document.getElementById('disp-throttle') as HTMLElement;
        this.dispFuel = document.getElementById('disp-fuel') as HTMLElement;

        // Setup Canvas
        this.mapCanvas = document.getElementById('map-canvas') as HTMLCanvasElement;
        this.mapCtx = this.mapCanvas.getContext('2d') as CanvasRenderingContext2D;
        this.chartCanvas = document.getElementById('alt-graph') as HTMLCanvasElement;
        this.chartCtx = this.chartCanvas.getContext('2d') as CanvasRenderingContext2D;

        // Listen for messages
        this.channel.onmessage = this.handleMessage.bind(this);

        // Handle resize
        window.addEventListener('resize', this.resize.bind(this));
        this.resize();
    }

    private handleMessage(event: MessageEvent) {
        if (event.data.type === 'TELEMETRY_UPDATE') {
            this.updateUI(event.data.payload);
        }
    }

    private updateUI(data: TelemetryPacket) {
        // Update Metrics
        this.dispAlt.textContent = data.altitude.toFixed(0);
        this.dispVel.textContent = data.velocity.toFixed(0);
        this.dispApogee.textContent = (data.apogee / 1000).toFixed(1);
        this.dispThrottle.textContent = (data.throttle * 100).toFixed(0);
        this.dispFuel.textContent = (data.fuel * 100).toFixed(1);

        // Update Status
        this.statusEl.textContent = 'CONNECTED - T+' + data.missionTime.toFixed(1);
        this.statusEl.style.color = '#4ade80'; // green

        // Update Visuals
        this.drawMap(data.position, data.velocityVector);
        this.updateChart(data.altitude);
    }

    private resize() {
        if (this.mapCanvas && this.mapCanvas.parentElement) {
            this.mapCanvas.width = this.mapCanvas.parentElement.clientWidth;
            this.mapCanvas.height = this.mapCanvas.parentElement.clientHeight;
        }
        if (this.chartCanvas && this.chartCanvas.parentElement) {
            this.chartCanvas.width = this.chartCanvas.parentElement.clientWidth;
            this.chartCanvas.height = this.chartCanvas.parentElement.clientHeight;
        }
    }

    private drawMap(pos: Vector2D, vel: Vector2D) {
        const ctx = this.mapCtx;
        const width = this.mapCanvas.width;
        const height = this.mapCanvas.height;

        ctx.fillStyle = '#0f172a'; // Deep Base
        ctx.fillRect(0, 0, width, height);

        // Draw dummy ground
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, height - 40, width, 40);

        // Scale pos
        const cx = width / 2;
        const cy = height - 50;
        const scale = 0.5; // pixels per m

        const x = cx + pos.x * scale;
        const y = cy - pos.y * scale;

        // Path history
        this.path.push({ x, y });
        if (this.path.length > 500) this.path.shift();

        // Draw Path
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'; // Blue trace
        ctx.lineWidth = 2;
        // Optimization: Standard for loop avoids closure allocation in continuous render loop
        for (let i = 0; i < this.path.length; i++) {
            const p = this.path[i]!;
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // Rocket Icon
        ctx.save();
        ctx.translate(x, y);
        const angle = Math.atan2(vel.y, vel.x) + Math.PI / 2;
        ctx.rotate(angle);

        ctx.fillStyle = '#facc15'; // Yellow
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(5, 5);
        ctx.lineTo(-5, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Stats overlay
        ctx.fillStyle = '#64748b';
        ctx.font = '10px monospace';
        ctx.fillText(`X: ${pos.x.toFixed(0)} Y: ${pos.y.toFixed(0)}`, 10, 20);
    }

    private updateChart(newVal: number) {
        this.altHistory[this.altHistoryHead] = newVal;
        this.altHistoryHead = (this.altHistoryHead + 1) % this.MAX_POINTS;

        const ctx = this.chartCtx;
        const width = this.chartCanvas.width;
        const height = this.chartCanvas.height;

        ctx.clearRect(0, 0, width, height);

        // Auto scale
        const max = Math.max(...this.altHistory, 100);
        const min = 0;

        ctx.beginPath();
        ctx.strokeStyle = '#22c55e'; // Green
        ctx.lineWidth = 2;

        const step = width / (this.MAX_POINTS - 1);

        for (let i = 0; i < this.MAX_POINTS; i++) {
            const val = this.altHistory[(this.altHistoryHead + i) % this.MAX_POINTS] ?? 0;
            const x = i * step;
            const normalize = (val - min) / (max - min);
            const y = height - normalize * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
}

new TelemetryReceiver();
