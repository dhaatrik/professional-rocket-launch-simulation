1. **Create `DataLoader.ts`**:
   - Extract the file loading and delegating to `FlightDataParser` into a new `DataLoader` class.
   - It will have a `loadFile(file: File): Promise<FlightFrame[]>` method.

2. **Create `ChartRenderer.ts`**:
   - Extract `initCharts` (for charts), `resizeCanvases` (for charts), `renderCharts`, and `drawChartCursors` into a new `ChartRenderer` class.
   - This class will manage the 4 chart canvases (`chart-alt`, `chart-vel`, `chart-throttle`, `chart-q`).

3. **Create `VisualizerRenderer.ts`**:
   - Extract the visualizer canvas initialization, resizing, and `drawVisualizer` into a new `VisualizerRenderer` class.
   - This class will manage the `visualizer-canvas`.

4. **Refactor `AnalysisApp.ts`**:
   - Remove the extracted methods and state.
   - Instantiate `ChartRenderer` and `VisualizerRenderer`.
   - Update `loadFile` to use `DataLoader.loadFile(file)`.
   - Update resizing, rendering, and setup logic to delegate to the renderers.

5. **Test and Verify**:
   - Run linter and tests (`pnpm lint`, `pnpm test`).
   - Open the Analysis App in the browser to ensure the file uploads and rendering still work as expected.
