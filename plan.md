1. **Understand & Assess**:
   - `AnalysisApp` currently manages multiple concerns: UI interactions, DOM elements, file parsing initiation, playback loop logic, canvas rendering for charts (`renderCharts`, `drawChartCursors`), and canvas rendering for the visualizer (`drawVisualizer`).
   - Breaking it down into simpler classes will improve maintainability and follow Single Responsibility Principle.

2. **Refactoring Strategy**:
   - Create `src/analysis/renderers/ChartRenderer.ts`: Moves `renderCharts` and `drawChartCursors` and chart canvas setups.
   - Create `src/analysis/renderers/VisualizerRenderer.ts`: Moves `drawVisualizer` and visualizer canvas setup.
   - Create `src/analysis/DataLoader.ts`: Moves `loadFile` and delegates to `FlightDataParser`.
   - Update `AnalysisApp.ts`: Instantiate the renderers and data loader, reducing it to a controller bridging the logic.

3. **Detailed Steps**:
   - `VisualizerRenderer.ts`: Class with `drawVisualizer(frame, ctx, canvas)`. Maybe pass contexts/canvases during initialization or just give it the `canvas` IDs so it can find them and handle resizing.
   - `ChartRenderer.ts`: Class with `renderCharts(frames, contexts, canvases)` and `drawChartCursors(index, frames, contexts, canvases)`.
   - Update `AnalysisApp` to use these.

Let's refine the approach: I can extract the drawing functions and their canvas management into separate classes, and keep the application state and DOM logic in `AnalysisApp`.
