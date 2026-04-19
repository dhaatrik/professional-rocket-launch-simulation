import { FlightFrame } from './FlightDataParser';

export class VisualizerRenderer {
    public drawVisualizer(
        frame: FlightFrame,
        ctx: CanvasRenderingContext2D | undefined,
        canvas: HTMLCanvasElement | undefined
    ) {
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
}
