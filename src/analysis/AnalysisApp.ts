/**
 * Analysis App
 *
 * Main controller for the post-flight analysis tool.
 * Handles UI interactions, data loading, playback, and rendering.
 */

import { FlightDataParser, FlightFrame } from './FlightDataParser';

export class AnalysisApp {
    private frames: FlightFrame[] = [];
    private currentIndex: number = 0;
    private isPlaying: boolean = false;
    private playbackSpeed: number = 1;
    private animationFrameId: number | null = null;

    // UI Elements
    public timeScrubber: HTMLInputElement;
    public dispTime: HTMLElement;
    public dispAlt: HTMLElement;
    public dispVel: HTMLElement;
    public canvases: { [key: string]: HTMLCanvasElement } = {};
    public ctxs: { [key: string]: CanvasRenderingContext2D } = {};

    // Performance Optimization: Cache static chart image data
    private chartImageCache: { [key: string]: ImageData } = {};

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
            try {
                if (file.name.endsWith('.csv')) {
                    this.frames = FlightDataParser.parseCSV(content);
                } else if (file.name.endsWith('.json')) {
                    this.frames = FlightDataParser.parseJSON(content);
                } else {
                    alert('Unsupported file type');
                    return;
                }
            } catch (err) {
                console.error(err);
                alert('Failed to parse file: ' + (err instanceof Error ? err.message : String(err)));
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
        if (btn) {
            btn.textContent = this.isPlaying ? '⏸' : '▶';
            btn.setAttribute('aria-pressed', String(this.isPlaying));
        }

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
        if (btn) {
            btn.textContent = '▶';
            btn.setAttribute('aria-pressed', 'false');
        }
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

    // Performance Optimization: Combine iterations into a single standard for loop
    // to minimize GC pressure and redundant O(N) passes.
    private renderCharts() {
        if (this.frames.length === 0) return;

        const canvasAlt = this.canvases['chart-alt'];
        const canvasVel = this.canvases['chart-vel'];
        const canvasThr = this.canvases['chart-throttle'];
        const canvasQ = this.canvases['chart-q'];

        const ctxAlt = this.ctxs['chart-alt'];
        const ctxVel = this.ctxs['chart-vel'];
        const ctxThr = this.ctxs['chart-throttle'];
        const ctxQ = this.ctxs['chart-q'];

        if (!ctxAlt || !ctxVel || !ctxThr || !ctxQ || !canvasAlt || !canvasVel || !canvasThr || !canvasQ) return;

        const wAlt = canvasAlt.width,
            hAlt = canvasAlt.height;
        const wVel = canvasVel.width,
            hVel = canvasVel.height;
        const wThr = canvasThr.width,
            hThr = canvasThr.height;
        const wQ = canvasQ.width,
            hQ = canvasQ.height;

        ctxAlt.clearRect(0, 0, wAlt, hAlt);
        ctxVel.clearRect(0, 0, wVel, hVel);
        ctxThr.clearRect(0, 0, wThr, hThr);
        ctxQ.clearRect(0, 0, wQ, hQ);

        const len = this.frames.length;
        let maxAlt = -Infinity;
        let maxVel = -Infinity;
        let maxQ = -Infinity;

        for (let i = 0; i < len; i++) {
            const f = this.frames[i]!;
            if (f.altitude > maxAlt) maxAlt = f.altitude;
            if (f.velocity > maxVel) maxVel = f.velocity;
            if (f.q > maxQ) maxQ = f.q;
        }

        maxAlt *= 1.1;
        maxVel *= 1.1;
        maxQ *= 1.1;

        const rangeAlt = maxAlt || 1;
        const rangeVel = maxVel || 1;
        const rangeThr = 1; // max is fixed at 1 for throttle
        const rangeQ = maxQ || 1;

        const xStepAlt = len > 1 ? wAlt / (len - 1) : 0;
        const xStepVel = len > 1 ? wVel / (len - 1) : 0;
        const xStepThr = len > 1 ? wThr / (len - 1) : 0;
        const xStepQ = len > 1 ? wQ / (len - 1) : 0;

        ctxAlt.beginPath();
        ctxAlt.strokeStyle = '#3b82f6';
        ctxAlt.lineWidth = 2;

        ctxVel.beginPath();
        ctxVel.strokeStyle = '#10b981';
        ctxVel.lineWidth = 2;

        ctxThr.beginPath();
        ctxThr.strokeStyle = '#f59e0b';
        ctxThr.lineWidth = 2;

        ctxQ.beginPath();
        ctxQ.strokeStyle = '#8b5cf6';
        ctxQ.lineWidth = 2;

        const eventXsAlt: number[] = [];
        const eventXsVel: number[] = [];
        const eventXsThr: number[] = [];
        const eventXsQ: number[] = [];

        for (let i = 0; i < len; i++) {
            const f = this.frames[i]!;

            const xAlt = i * xStepAlt;
            const normAlt = f.altitude / rangeAlt;
            const yAlt = hAlt - normAlt * hAlt;

            const xVel = i * xStepVel;
            const normVel = f.velocity / rangeVel;
            const yVel = hVel - normVel * hVel;

            const xThr = i * xStepThr;
            const normThr = f.throttle / rangeThr;
            const yThr = hThr - normThr * hThr;

            const xQ = i * xStepQ;
            const normQ = f.q / rangeQ;
            const yQ = hQ - normQ * hQ;

            if (i === 0) {
                ctxAlt.moveTo(xAlt, yAlt);
                ctxVel.moveTo(xVel, yVel);
                ctxThr.moveTo(xThr, yThr);
                ctxQ.moveTo(xQ, yQ);
            } else {
                ctxAlt.lineTo(xAlt, yAlt);
                ctxVel.lineTo(xVel, yVel);
                ctxThr.lineTo(xThr, yThr);
                ctxQ.lineTo(xQ, yQ);
            }

            if (f.event) {
                eventXsAlt.push(xAlt);
                eventXsVel.push(xVel);
                eventXsThr.push(xThr);
                eventXsQ.push(xQ);
            }
        }

        ctxAlt.stroke();
        ctxVel.stroke();
        ctxThr.stroke();
        ctxQ.stroke();

        if (eventXsAlt.length > 0) {
            ctxAlt.fillStyle = 'white';
            ctxAlt.globalAlpha = 0.5;
            for (let i = 0; i < eventXsAlt.length; i++) ctxAlt.fillRect(eventXsAlt[i]!, 0, 1, hAlt);
            ctxAlt.globalAlpha = 1.0;

            ctxVel.fillStyle = 'white';
            ctxVel.globalAlpha = 0.5;
            for (let i = 0; i < eventXsVel.length; i++) ctxVel.fillRect(eventXsVel[i]!, 0, 1, hVel);
            ctxVel.globalAlpha = 1.0;

            ctxThr.fillStyle = 'white';
            ctxThr.globalAlpha = 0.5;
            for (let i = 0; i < eventXsThr.length; i++) ctxThr.fillRect(eventXsThr[i]!, 0, 1, hThr);
            ctxThr.globalAlpha = 1.0;

            ctxQ.fillStyle = 'white';
            ctxQ.globalAlpha = 0.5;
            for (let i = 0; i < eventXsQ.length; i++) ctxQ.fillRect(eventXsQ[i]!, 0, 1, hQ);
            ctxQ.globalAlpha = 1.0;
        }

        // Cache the static rendered charts
        const ids = ['chart-alt', 'chart-vel', 'chart-throttle', 'chart-q'];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i]!;
            const ctx = this.ctxs[id];
            const canvas = this.canvases[id];
            if (ctx && canvas) {
                this.chartImageCache[id] = ctx.getImageData(0, 0, canvas.width, canvas.height);
            }
        }
    }

    private drawChartCursors(index: number) {
        const xPct = index / (this.frames.length - 1);

        const ids = ['chart-alt', 'chart-vel', 'chart-throttle', 'chart-q'];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i]!;
            const ctx = this.ctxs[id];
            const canvas = this.canvases[id];
            if (!ctx || !canvas) continue;

            // Performance Optimization: Restore from ImageData cache instead of full re-render
            const cachedImg = this.chartImageCache[id];
            if (cachedImg) {
                ctx.putImageData(cachedImg, 0, 0);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

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
        }
    }
}

// Only auto-initialize if we're in a browser environment and not in a test
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
    new AnalysisApp();
}
