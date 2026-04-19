/**
 * Analysis App
 *
 * Main controller for the post-flight analysis tool.
 * Handles UI interactions, data loading, playback, and rendering.
 */

import { FlightFrame } from './FlightDataParser';
import { VisualizerRenderer } from './VisualizerRenderer';
import { ChartRenderer } from './ChartRenderer';
import { DataLoader } from './DataLoader';

export class AnalysisApp {
    private frames: FlightFrame[] = [];
    private currentIndex: number = 0;
    private isPlaying: boolean = false;
    private playbackSpeed: number = 1;
    private animationFrameId: number | null = null;

    private visualizerRenderer: VisualizerRenderer;
    private chartRenderer: ChartRenderer;
    private dataLoader: DataLoader;

    // UI Elements
    public timeScrubber: HTMLInputElement;
    public dispTime: HTMLElement;
    public dispAlt: HTMLElement;
    public dispVel: HTMLElement;
    public canvases: { [key: string]: HTMLCanvasElement } = {};
    public ctxs: { [key: string]: CanvasRenderingContext2D } = {};

    constructor() {
        this.timeScrubber = document.getElementById('time-scrubber') as HTMLInputElement;
        this.dispTime = document.getElementById('disp-time') as HTMLElement;
        this.dispAlt = document.getElementById('disp-alt') as HTMLElement;
        this.dispVel = document.getElementById('disp-vel') as HTMLElement;

        this.visualizerRenderer = new VisualizerRenderer();
        this.chartRenderer = new ChartRenderer();
        this.dataLoader = new DataLoader();

        this.initCharts();
        this.setupEventListeners();

        // Resize handler
        window.addEventListener('resize', () => {
            this.resizeCanvases();
            if (this.frames.length > 0) this.chartRenderer.renderCharts(this.frames, this.ctxs, this.canvases); // Re-render static charts
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

    private async loadFile(file: File) {
        try {
            this.frames = await this.dataLoader.loadFile(file);
            if (this.frames.length > 0) {
                this.onDataLoaded();
            } else {
                alert('No valid frames found in file.');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to parse file: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    private onDataLoaded() {
        if (this.frames.length === 0) return;
        this.currentIndex = 0;
        this.timeScrubber.value = '0';
        this.chartRenderer.renderCharts(this.frames, this.ctxs, this.canvases); // Draw static background charts
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
        this.visualizerRenderer.drawVisualizer(frame, this.ctxs['visualizer'], this.canvases['visualizer']);

        // Draw Cursor on Charts
        this.chartRenderer.drawChartCursors(index, this.frames, this.ctxs, this.canvases);
    }






}

// Only auto-initialize if we're in a browser environment and not in a test
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
    new AnalysisApp();
}
