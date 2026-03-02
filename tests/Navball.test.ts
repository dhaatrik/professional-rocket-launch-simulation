import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Navball } from '../src/ui/Navball';

// Mock dependencies
const mockCanvasContext = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    clip: vi.fn(),
    rect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1
};

const mockCanvas = {
    getContext: vi.fn(() => mockCanvasContext),
    width: 140,
    height: 140,
    addEventListener: vi.fn(),
};

vi.stubGlobal('document', {
    getElementById: vi.fn((id) => {
        if (id === 'navball') return mockCanvas;
        return null;
    }),
});

describe('Navball', () => {
    let navball: Navball;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Reset property values that are set during tests
        mockCanvasContext.fillStyle = '';
        mockCanvasContext.strokeStyle = '';
        mockCanvasContext.lineWidth = 1;

        navball = new Navball();
    });

    it('should initialize correctly with a canvas', () => {
        expect(document.getElementById).toHaveBeenCalledWith('navball');
        expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');

        // Check if internal width and height are set correctly based on the mock
        expect((navball as any).width).toBe(140);
        expect((navball as any).height).toBe(140);
    });

    it('should handle missing canvas gracefully', () => {
        // Override the getElementById mock to return null
        (document.getElementById as any).mockReturnValueOnce(null);

        const noCanvasNavball = new Navball();

        // Internal ctx should be null
        expect((noCanvasNavball as any).ctx).toBeNull();

        // Draw shouldn't throw an error when ctx is missing
        expect(() => noCanvasNavball.draw(0, 0)).not.toThrow();
    });

    it('should render basic elements (sky, ground, horizon, fixed marker, outer ring)', () => {
        const angle = Math.PI / 4; // 45 degrees
        navball.draw(angle, null);

        expect(mockCanvasContext.clearRect).toHaveBeenCalledWith(0, 0, 140, 140);

        // Verify clip setup
        expect(mockCanvasContext.save).toHaveBeenCalled();
        expect(mockCanvasContext.beginPath).toHaveBeenCalled();
        expect(mockCanvasContext.arc).toHaveBeenCalledWith(70, 70, 68, 0, Math.PI * 2);
        expect(mockCanvasContext.clip).toHaveBeenCalled();

        // Verify transformations
        expect(mockCanvasContext.translate).toHaveBeenCalledWith(70, 70);
        expect(mockCanvasContext.rotate).toHaveBeenCalledWith(-angle); // Rotating by negative angle

        // Verify rendering of Sky
        expect(mockCanvasContext.fillStyle).toBe('#8e44ad'); // Last set color (ground overrides sky in mock property, but fillRect is called before)
        expect(mockCanvasContext.fillRect).toHaveBeenCalledWith(-136, -136, 272, 136); // Sky
        expect(mockCanvasContext.fillRect).toHaveBeenCalledWith(-136, 0, 272, 136); // Ground

        // Note: Due to how mock properties work, we can't easily assert the exact sequence of property assignments
        // intermixed with method calls without more complex mocking, but we can verify the colors were set.
        // Sky: #3498db, Ground: #8e44ad, Horizon: white, Fixed ship: #f39c12, Outer ring: #aaa
        // We can check if `stroke` was called a certain number of times and with what paths.

        expect(mockCanvasContext.moveTo).toHaveBeenCalled();
        expect(mockCanvasContext.lineTo).toHaveBeenCalled();
        expect(mockCanvasContext.stroke).toHaveBeenCalled();

        // Verify final restore
        expect(mockCanvasContext.restore).toHaveBeenCalled();
    });

    it('should render prograde marker when progradeAngle is provided', () => {
        const angle = 0;
        const progradeAngle = Math.PI / 2;

        navball.draw(angle, progradeAngle);

        // Verify additional save/restore for prograde marker
        expect(mockCanvasContext.save).toHaveBeenCalledTimes(2);
        expect(mockCanvasContext.restore).toHaveBeenCalledTimes(2);

        // Verify prograde rotation and translation
        expect(mockCanvasContext.rotate).toHaveBeenCalledWith(progradeAngle);
        expect(mockCanvasContext.translate).toHaveBeenCalledWith(0, -68 * 0.7);

        // Verify prograde marker drawing (arc and lines)
        expect(mockCanvasContext.arc).toHaveBeenCalledWith(0, 0, 5, 0, Math.PI * 2);

        // Cross lines for prograde
        expect(mockCanvasContext.moveTo).toHaveBeenCalledWith(0, -5);
        expect(mockCanvasContext.lineTo).toHaveBeenCalledWith(0, -10);
    });
});
