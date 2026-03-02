/**
 * Analysis App
 *
 * Main controller for the post-flight analysis tool.
 * Handles UI interactions, data loading, playback, and rendering.
 */

import { FlightDataParser, FlightFrame } from './FlightDataParser';

class AnalysisApp {
    private frames: FlightFrame[] = [];
    private currentIndex: number = 0;
    private isPlaying: boolean = false;
    private playbackSpeed: number = 1;
    private animationFrameId: number | null = null;

    // UI Elements
    private timeScrubber: HTMLInputElement;
    private dispTime: HTMLElement;
    private dispAlt: HTMLElement;
    private dispVel: HTMLElement;
    private canvases: { [key: string]: HTMLCanvasElement } = {};
    private ctxs: { [key: string]: CanvasRenderingContext2D } = {};

    constructor() {
        this.timeScrubber = document.getElementById('time-scrubber') as HTMLInputElement;
        this.dispTime = document.getElementById('disp-time') as HTMLElement;
        this.dispAlt = document.getElementById('disp-alt') as HTMLElement;
        this.dispVel = document.getElementById('disp-vel') as HTMLElement;

        this.initCharts();
        this.setupEventListeners();

        // Resize handler
        window.addEventListener('resize', () => {
            this.resizeCanvases();
            if (this.frames.length > 0) this.renderCharts(); // Re-render static charts
            this.renderFrame(this.currentIndex);
        });

        // Initial Resize
        setTimeout(() => this.resizeCanvases(), 100);
    }

    private initCharts() {
        const ids = ['visualizer', 'chart-alt', 'chart-vel', 'chart-throttle', 'chart-q'];
        ids.forEach((id) => {
            const canvas = document.getElementById(id + (id === 'visualizer' ? '-canvas' : '')) as HTMLCanvasElement;
            if (canvas) {
                this.canvases[id] = canvas;
                this.ctxs[id] = canvas.getContext('2d') as CanvasRenderingContext2D;
            }
        });
    }

    private resizeCanvases() {
        Object.values(this.canvases).forEach((canvas) => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            if (rect) {
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
        });
    }

    private setupEventListeners() {
        // Drag & Drop
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        const overlay = document.getElementById('upload-overlay');

        dropZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer?.files[0];
            if (file) {
                this.loadFile(file);
                if (overlay) overlay.style.display = 'none';
            }
        });

        // Click to browse
        dropZone?.addEventListener('click', () => fileInput.click());
        fileInput?.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (file) {
                this.loadFile(file);
                if (overlay) overlay.style.display = 'none';
            }
        });

        // Load New Button
        document.getElementById('load-new-btn')?.addEventListener('click', () => {
            if (overlay) overlay.style.display = 'flex';
            this.stopPlayback();
        });

        // Scrubber
        this.timeScrubber.addEventListener('input', (e) => {
            const val = parseFloat((e.target as HTMLInputElement).value);
            this.seekToPercentage(val);
        });

        // Playback Controls
        document.getElementById('btn-play')?.addEventListener('click', () => this.togglePlayback());
        document.getElementById('btn-prev')?.addEventListener('click', () => this.seekToFrame(this.currentIndex - 60)); // -1 sec
        document.getElementById('btn-next')?.addEventListener('click', () => this.seekToFrame(this.currentIndex + 60)); // +1 sec
    }

    private loadFile(file: File) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const target = e.target as FileReader;
            if (!target) return;
            const content = target.result as string;
            if (file.name.endsWith('.csv')) {
                this.frames = FlightDataParser.parseCSV(content);
            } else if (file.name.endsWith('.json')) {
                this.frames = FlightDataParser.parseJSON(content) || [];
            } else {
                alert('Unsupported file type');
                return;
            }

            if (this.frames.length > 0) {
                this.onDataLoaded();
            } else {
                alert('No valid frames found in file.');
            }
        };
        reader.readAsText(file);
    }

    private onDataLoaded() {
        if (this.frames.length === 0) return;
        this.currentIndex = 0;
        this.timeScrubber.value = '0';
        this.renderCharts(); // Draw static background charts
        this.renderFrame(0);

        // Update total duration label
        const lastFrame = this.frames[this.frames.length - 1];
        if (lastFrame) {
            const duration = lastFrame.missionTime;
            const m = Math.floor(duration / 60);
            const s = Math.floor(duration % 60);
            const label = document.getElementById('duration-label');
            if (label) label.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
    }

    private togglePlayback() {
        this.isPlaying = !this.isPlaying;
        const btn = document.getElementById('btn-play');
        if (btn) btn.textContent = this.isPlaying ? '⏸' : '▶';

        if (this.isPlaying) {
            this.lastFrameTime = performance.now();
            this.loop();
        } else {
            if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        }
    }

    private lastFrameTime = 0;

    private loop() {
        if (!this.isPlaying) return;

        const now = performance.now();
        this.lastFrameTime = now;

        // Advance frames based on recording Hz (assumed 60Hz or use timestamp delta)
        // Simple approach: advance 1 frame per 1/60s real time * playbackSpeed
        // More robust: find frame matching curentTime + dt

        if (this.currentIndex < this.frames.length - 1) {
            this.currentIndex++; // Simple step for now
            this.renderFrame(this.currentIndex);
            this.updateScrubber();
            this.animationFrameId = requestAnimationFrame(() => this.loop());
        } else {
            this.stopPlayback();
        }
    }

    private stopPlayback() {
        this.isPlaying = false;
        const btn = document.getElementById('btn-play');
        if (btn) btn.textContent = '▶';
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    }

    private seekToPercentage(pct: number) {
        if (this.frames.length === 0) return;
        const idx = Math.floor((pct / 100) * (this.frames.length - 1));
        this.seekToFrame(idx);
    }

    private seekToFrame(idx: number) {
        if (this.frames.length === 0) return;
        this.currentIndex = Math.max(0, Math.min(idx, this.frames.length - 1));
        this.renderFrame(this.currentIndex);
        this.updateScrubber();
    }

    private updateScrubber() {
        const pct = (this.currentIndex / (this.frames.length - 1)) * 100;
        this.timeScrubber.value = pct.toFixed(2);
    }

    private renderFrame(index: number) {
        const frame = this.frames[index];
        if (!frame) return;

        // Update DOM metrics
        const m = Math.floor(frame.missionTime / 60);
        const s = Math.floor(frame.missionTime % 60);
        this.dispTime.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        this.dispAlt.textContent = frame.altitude.toFixed(0);
        this.dispVel.textContent = frame.velocity.toFixed(0);

        // Draw Visualizer (Map / Orientation)
        this.drawVisualizer(frame);

        // Draw Cursor on Charts
        this.drawChartCursors(index);
    }

    private drawVisualizer(frame: FlightFrame) {
        const ctx = this.ctxs['visualizer'];
        const canvas = this.canvases['visualizer'];
        if (!ctx || !canvas) return;

        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Simple Ground View
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);

        // Ground line
        const groundY = h - 50;
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(0, groundY, w, 50);

        // Altitude scaling (logarithmic-ish for vis?) or linear
        // Let's keep it simple: Rocket moves up
        const scale = 0.5; // pixels per m
        const rocketY = groundY - frame.altitude * scale;

        // Auto-pan camera logic: keep rocket vertically centered if high up
        let camY = 0;
        if (rocketY < h / 2) {
            camY = h / 2 - rocketY;
        }

        ctx.save();
        ctx.translate(w / 2, camY);

        /** Draw Rocket path **/
        // Optimization: Don't draw full path every frame in 2D viz if it's expensive,
        // but here it's cheapish
        /*
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        this.frames.slice(0, this.currentIndex).forEach((f, i) => {
            const fy = groundY - (f.altitude * scale);
             // x position? if we have posX/Y we can do 2D trajectory. 
             // FlightFrame has posX.
             const fx = (f.posX ?? 0) * scale; // assuming 0 is center
             if (i===0) ctx.moveTo(fx, fy);
             else ctx.lineTo(fx, fy);
        });
        ctx.stroke();
        */

        // Draw Rocket
        const rx = (frame.posX ?? 0) * scale;
        const ry = groundY - frame.altitude * scale; // raw Y position relative to ground

        ctx.translate(rx, ry);

        // Rotation
        if (frame.angle !== undefined) {
            ctx.rotate(frame.angle); // Assuming angle is in radians
        }

        // Body
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(-5, -20, 10, 40);
        // Nose
        ctx.beginPath();
        ctx.moveTo(-5, -20);
        ctx.lineTo(0, -30);
        ctx.lineTo(5, -20);
        ctx.fill();
        // Fins
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-8, 10, 3, 10);
        ctx.fillRect(5, 10, 3, 10);

        // Flame
        if (frame.throttle > 0) {
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            const flameLen = frame.throttle * 20;
            ctx.moveTo(-3, 20);
            ctx.lineTo(0, 20 + flameLen + Math.random() * 5);
            ctx.lineTo(3, 20);
            ctx.fill();
        }

        ctx.restore();
    }

    private renderCharts() {
        if (this.frames.length === 0) return;

        this.drawSingleChart('chart-alt', 'altitude', '#3b82f6', 0);
        this.drawSingleChart('chart-vel', 'velocity', '#10b981', 0);
        this.drawSingleChart('chart-throttle', 'throttle', '#f59e0b', 0, 1);
        this.drawSingleChart('chart-q', 'q', '#8b5cf6', 0);
    }

    private drawSingleChart(canvasId: string, metric: keyof FlightFrame, color: string, min?: number, max?: number) {
        const ctx = this.ctxs[canvasId];
        const canvas = this.canvases[canvasId];
        if (!ctx || !canvas) return;

        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Find range
        const dataMin = min ?? 0;
        let dataMax = max ?? -Infinity;
        if (max === undefined) {
            this.frames.forEach((f) => {
                const val = f[metric] as number;
                if (val > dataMax) dataMax = val;
            });
            // Add padding
            dataMax *= 1.1;
        }

        const range = dataMax - dataMin || 1;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        this.frames.forEach((f, i) => {
            const x = (i / (this.frames.length - 1)) * w;
            const val = f[metric] as number;
            const normalized = (val - dataMin) / range;
            const y = h - normalized * h;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();

        // Checkpoints/Events overlay
        this.frames.forEach((f, i) => {
            if (f.event) {
                const x = (i / (this.frames.length - 1)) * w;
                ctx.fillStyle = 'white';
                ctx.globalAlpha = 0.5;
                ctx.fillRect(x, 0, 1, h);
                ctx.globalAlpha = 1.0;
            }
        });
    }

    private drawChartCursors(index: number) {
        // Redraw charts cleanly first (could optimize to just save/restore image data)
        // For now, let's just draw the cursor line on top, but valid point: clearing wipes chart.
        // Actually, renderCharts() draws the lines. We should redraw them or use overlay canvas.
        // Optimization: Just re-render everything for now, modern browsers can handle 4 simple paths.
        this.renderCharts();

        const xPct = index / (this.frames.length - 1);

        ['chart-alt', 'chart-vel', 'chart-throttle', 'chart-q'].forEach((id) => {
            const ctx = this.ctxs[id];
            const canvas = this.canvases[id];
            if (!ctx || !canvas) return;

            const w = canvas.width;
            const h = canvas.height;

            const x = xPct * w;

            ctx.beginPath();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
            ctx.setLineDash([]);
        });
    }
}

new AnalysisApp();
