import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnalysisApp } from '../../src/analysis/AnalysisApp';

describe('AnalysisApp', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
        // Setup DOM elements that AnalysisApp expects
        document.body.innerHTML = `
            <input type="range" id="time-scrubber" value="0">
            <div id="disp-time"></div>
            <div id="disp-alt"></div>
            <div id="disp-vel"></div>
            <canvas id="visualizer-canvas"></canvas>
            <canvas id="chart-alt"></canvas>
            <canvas id="chart-vel"></canvas>
            <canvas id="chart-throttle"></canvas>
            <canvas id="chart-q"></canvas>
            <div id="drop-zone"></div>
            <input type="file" id="file-input">
            <div id="upload-overlay"></div>
            <button id="load-new-btn"></button>
            <button id="btn-play"></button>
            <button id="btn-prev"></button>
            <button id="btn-next"></button>
            <div id="duration-label"></div>
        `;

        // Mock getContext for canvas
        HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
            clearRect: vi.fn(),
            fillRect: vi.fn(),
            translate: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            rotate: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            fill: vi.fn(),
            stroke: vi.fn(),
            setLineDash: vi.fn(),
        } as unknown as CanvasRenderingContext2D);
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    it('should initialize without throwing errors', () => {
        expect(() => new AnalysisApp()).not.toThrow();
    });

    it('should initialize UI elements correctly', () => {
        const app = new AnalysisApp();

        expect(app.timeScrubber).toBeDefined();
        expect(app.dispTime).toBeDefined();
        expect(app.dispAlt).toBeDefined();
        expect(app.dispVel).toBeDefined();

        expect(Object.keys(app.canvases).length).toBe(5);
        expect(Object.keys(app.ctxs).length).toBe(5);
    });

    describe('File Loading', () => {
        it('should correctly process valid CSV files', () => {
            const app = new AnalysisApp() as any;
            const mockCSV = `timestamp,missionTime,altitude,velocity\n1,10,100,50`;

            // Mock FileReader
            const mockFileReader = {
                readAsText: vi.fn(),
                onload: null as any,
                result: mockCSV
            };
            class MockFileReader {
                readAsText = mockFileReader.readAsText;
                onload = mockFileReader.onload;
                result = mockFileReader.result;
            }
            vi.stubGlobal('FileReader', MockFileReader);

            // Create a mock file
            const mockFile = new File([mockCSV], 'flight_data.csv', { type: 'text/csv' });

            // Override the actual loadFile logic a bit to capture the reader or simulate onload correctly
            // Since reader is created inside loadFile, we need to extract it or simulate the whole thing
            // The MockFileReader class gets instantiated inside loadFile
            let capturedReader1: any;
            class MockFileReader1 {
                readAsText = vi.fn().mockImplementation(function(this: any) {
                    capturedReader1 = this;
                });
                onload: any = null;
                result = mockCSV;
            }
            vi.stubGlobal('FileReader', MockFileReader1);

            // Call loadFile
            app.loadFile(mockFile);

            // Simulate onload
            if (capturedReader1 && capturedReader1.onload) {
                capturedReader1.onload({ target: capturedReader1 });
            }

            expect(app.frames.length).toBe(1);
            expect(app.frames[0].altitude).toBe(100);

            vi.unstubAllGlobals();
        });

        it('should alert on unsupported file types', () => {
            const app = new AnalysisApp() as any;
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

            // Mock FileReader
            const mockFileReader = {
                readAsText: vi.fn(),
                onload: null as any,
                result: 'content'
            };
            class MockFileReader {
                readAsText = mockFileReader.readAsText;
                onload = mockFileReader.onload;
                result = mockFileReader.result;
            }
            vi.stubGlobal('FileReader', MockFileReader);

            // Create an unsupported mock file
            const mockFile = new File(['content'], 'image.png', { type: 'image/png' });

            let capturedReader2: any;
            class MockFileReader2 {
                readAsText = vi.fn().mockImplementation(function(this: any) {
                    capturedReader2 = this;
                });
                onload: any = null;
                result = 'content';
            }
            vi.stubGlobal('FileReader', MockFileReader2);

            // Call loadFile
            app.loadFile(mockFile);

            // Simulate onload
            if (capturedReader2 && capturedReader2.onload) {
                capturedReader2.onload({ target: capturedReader2 });
            }

            expect(alertSpy).toHaveBeenCalledWith('Unsupported file type');
            expect(app.frames.length).toBe(0);

            alertSpy.mockRestore();
            vi.unstubAllGlobals();
        });

        it('should alert when file is empty or has no valid frames', () => {
            const app = new AnalysisApp() as any;
            const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

            // Mock FileReader with empty CSV
            const mockFileReader = {
                readAsText: vi.fn(),
                onload: null as any,
                result: 'timestamp,missionTime,altitude,velocity' // Just headers
            };
            class MockFileReader {
                readAsText = mockFileReader.readAsText;
                onload = mockFileReader.onload;
                result = mockFileReader.result;
            }
            vi.stubGlobal('FileReader', MockFileReader);

            // Create a mock file
            const mockFile = new File([''], 'empty.csv', { type: 'text/csv' });

            let capturedReader3: any;
            class MockFileReader3 {
                readAsText = vi.fn().mockImplementation(function(this: any) {
                    capturedReader3 = this;
                });
                onload: any = null;
                result = 'timestamp,missionTime,altitude,velocity';
            }
            vi.stubGlobal('FileReader', MockFileReader3);

            // Call loadFile
            app.loadFile(mockFile);

            // Simulate onload
            if (capturedReader3 && capturedReader3.onload) {
                capturedReader3.onload({ target: capturedReader3 });
            }

            expect(alertSpy).toHaveBeenCalledWith('No valid frames found in file.');
            expect(app.frames.length).toBe(0);

            alertSpy.mockRestore();
            vi.unstubAllGlobals();
        });
    });

    describe('Playback Controls', () => {
        it('should toggle playback state', () => {
            const app = new AnalysisApp() as any;
            const playBtn = document.getElementById('btn-play')!;

            // Mock requestAnimationFrame and cancelAnimationFrame
            vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1));
            vi.stubGlobal('cancelAnimationFrame', vi.fn());

            // Mock performance.now
            vi.spyOn(performance, 'now').mockReturnValue(1000);

            // Give it some dummy data to avoid immediate stop
            app.frames = [{missionTime: 0, altitude: 0, velocity: 0}, {missionTime: 1, altitude: 10, velocity: 5}];
            app.currentIndex = 0;

            // Initially not playing
            expect(app.isPlaying).toBe(false);

            // Toggle to play
            app.togglePlayback();
            expect(app.isPlaying).toBe(true);
            expect(playBtn.textContent).toBe('⏸');

            // Toggle to pause
            app.togglePlayback();
            expect(app.isPlaying).toBe(false);
            expect(playBtn.textContent).toBe('▶');

            vi.unstubAllGlobals();
        });

        it('should stop playback completely when requested', () => {
            const app = new AnalysisApp() as any;
            app.isPlaying = true;
            app.animationFrameId = 123;

            const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

            app.stopPlayback();

            expect(app.isPlaying).toBe(false);
            expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(123);

            cancelAnimationFrameSpy.mockRestore();
        });

        it('should handle loop advancement when playing', () => {
            const app = new AnalysisApp() as any;

            // Setup state
            app.isPlaying = true;
            app.currentIndex = 0;
            app.frames = [
                { missionTime: 0, altitude: 0, velocity: 0 },
                { missionTime: 1, altitude: 10, velocity: 5 },
                { missionTime: 2, altitude: 20, velocity: 10 }
            ];

            // Mock requestAnimationFrame
            const rAFSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { return 1; });

            // Run loop once
            app.loop();

            expect(app.currentIndex).toBe(1);
            expect(rAFSpy).toHaveBeenCalled();

            rAFSpy.mockRestore();
        });

        it('should stop playback when reaching end of frames in loop', () => {
            const app = new AnalysisApp() as any;

            // Setup state at the end
            app.isPlaying = true;
            app.frames = [
                { missionTime: 0, altitude: 0, velocity: 0 },
                { missionTime: 1, altitude: 10, velocity: 5 }
            ];
            app.currentIndex = 1; // Last frame

            const stopPlaybackSpy = vi.spyOn(app, 'stopPlayback');

            // Run loop
            app.loop();

            expect(stopPlaybackSpy).toHaveBeenCalled();

            stopPlaybackSpy.mockRestore();
        });
    });

    describe('Seeking', () => {
        it('should seek to specific frame', () => {
            const app = new AnalysisApp() as any;
            app.frames = [
                { missionTime: 0, altitude: 0, velocity: 0 },
                { missionTime: 1, altitude: 10, velocity: 5 },
                { missionTime: 2, altitude: 20, velocity: 10 }
            ];

            app.seekToFrame(1);

            expect(app.currentIndex).toBe(1);
        });

        it('should clamp seek values to valid frame bounds', () => {
            const app = new AnalysisApp() as any;
            app.frames = [
                { missionTime: 0, altitude: 0, velocity: 0 },
                { missionTime: 1, altitude: 10, velocity: 5 },
                { missionTime: 2, altitude: 20, velocity: 10 }
            ];

            // Seek past end
            app.seekToFrame(5);
            expect(app.currentIndex).toBe(2);

            // Seek before start
            app.seekToFrame(-5);
            expect(app.currentIndex).toBe(0);
        });

        it('should seek to percentage', () => {
            const app = new AnalysisApp() as any;
            app.frames = [
                { missionTime: 0, altitude: 0, velocity: 0 },
                { missionTime: 1, altitude: 10, velocity: 5 },
                { missionTime: 2, altitude: 20, velocity: 10 },
                { missionTime: 3, altitude: 30, velocity: 15 },
                { missionTime: 4, altitude: 40, velocity: 20 }
            ]; // Length 5, indices 0-4

            app.seekToPercentage(50); // 50% of 4 = 2

            expect(app.currentIndex).toBe(2);
        });

        it('should not throw when seeking with no frames', () => {
            const app = new AnalysisApp() as any;
            app.frames = [];

            expect(() => app.seekToFrame(1)).not.toThrow();
            expect(() => app.seekToPercentage(50)).not.toThrow();
        });
    });
});