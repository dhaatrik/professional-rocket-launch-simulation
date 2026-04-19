import { FlightFrame } from './FlightDataParser';

export class ChartRenderer {
    public renderCharts(
        frames: FlightFrame[],
        ctxs: { [key: string]: CanvasRenderingContext2D },
        canvases: { [key: string]: HTMLCanvasElement }
    ) {
        if (frames.length === 0) return;

        const canvasAlt = canvases['chart-alt'];
        const canvasVel = canvases['chart-vel'];
        const canvasThr = canvases['chart-throttle'];
        const canvasQ = canvases['chart-q'];

        const ctxAlt = ctxs['chart-alt'];
        const ctxVel = ctxs['chart-vel'];
        const ctxThr = ctxs['chart-throttle'];
        const ctxQ = ctxs['chart-q'];

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

        const len = frames.length;
        let maxAlt = -Infinity;
        let maxVel = -Infinity;
        let maxQ = -Infinity;

        for (let i = 0; i < len; i++) {
            const f = frames[i]!;
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
            const f = frames[i]!;

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
    }

    public drawChartCursors(
        index: number,
        frames: FlightFrame[],
        ctxs: { [key: string]: CanvasRenderingContext2D },
        canvases: { [key: string]: HTMLCanvasElement }
    ) {
        if (frames.length === 0) return;

        // Redraw charts cleanly first
        this.renderCharts(frames, ctxs, canvases);

        const xPct = index / (frames.length - 1);

        const ids = ['chart-alt', 'chart-vel', 'chart-throttle', 'chart-q'];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i]!;
            const ctx = ctxs[id];
            const canvas = canvases[id];
            if (!ctx || !canvas) continue;

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
