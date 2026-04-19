const fs = require('fs');
let code = fs.readFileSync('src/analysis/AnalysisApp.ts', 'utf8');

// 1. Add imports
code = code.replace(
    `import { FlightDataParser, FlightFrame } from './FlightDataParser';`,
    `import { FlightDataParser, FlightFrame } from './FlightDataParser';\nimport { VisualizerRenderer } from './VisualizerRenderer';\nimport { ChartRenderer } from './ChartRenderer';\nimport { DataLoader } from './DataLoader';`
);

// 2. Add class properties for renderers and loader
code = code.replace(
    `    private animationFrameId: number | null = null;`,
    `    private animationFrameId: number | null = null;\n\n    private visualizerRenderer: VisualizerRenderer;\n    private chartRenderer: ChartRenderer;\n    private dataLoader: DataLoader;`
);

// 3. Initialize renderers and loader in constructor
code = code.replace(
    `        this.dispVel = document.getElementById('disp-vel') as HTMLElement;`,
    `        this.dispVel = document.getElementById('disp-vel') as HTMLElement;\n\n        this.visualizerRenderer = new VisualizerRenderer();\n        this.chartRenderer = new ChartRenderer();\n        this.dataLoader = new DataLoader();`
);

// 4. Update loadFile implementation
code = code.replace(
    /    private loadFile\(file: File\) \{[\s\S]*?reader\.readAsText\(file\);\n    \}/,
    `    private async loadFile(file: File) {
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
    }`
);

// 5. Update renderFrame to use new methods
code = code.replace(
    `        this.drawVisualizer(frame);

        // Draw Cursor on Charts
        this.drawChartCursors(index);`,
    `        this.visualizerRenderer.drawVisualizer(frame, this.ctxs['visualizer'], this.canvases['visualizer']);

        // Draw Cursor on Charts
        this.chartRenderer.drawChartCursors(index, this.frames, this.ctxs, this.canvases);`
);

// 6. Update resizeCanvases to call chart renderer
code = code.replace(
    `if (this.frames.length > 0) this.renderCharts();`,
    `if (this.frames.length > 0) this.chartRenderer.renderCharts(this.frames, this.ctxs, this.canvases);`
);

// 7. Update onDataLoaded to call chart renderer
code = code.replace(
    `this.renderCharts(); // Draw static background charts`,
    `this.chartRenderer.renderCharts(this.frames, this.ctxs, this.canvases); // Draw static background charts`
);

// 8. Remove drawVisualizer, renderCharts, drawChartCursors
code = code.replace(/    private drawVisualizer\(frame: FlightFrame\) \{[\s\S]*?ctx\.restore\(\);\n    \}/, '');
code = code.replace(/    \/\/ Performance Optimization: Combine iterations into a single standard for loop[\s\S]*?private renderCharts\(\) \{[\s\S]*?ctxQ\.globalAlpha = 1\.0;\n        \}\n    \}/, '');
code = code.replace(/    private drawChartCursors\(index: number\) \{[\s\S]*?ctx\.setLineDash\(\[\]\);\n        \}\n    \}/, '');

fs.writeFileSync('src/analysis/AnalysisApp.ts', code);
