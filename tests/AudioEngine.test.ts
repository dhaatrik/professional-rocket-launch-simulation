import { describe, it, expect, vi } from 'vitest';
import { AudioEngine } from '../src/utils/AudioEngine';

// Mock Web Audio API
class MockAudioContext {
    state = 'running';
    sampleRate = 44100;
    currentTime = 0;
    destination = {};
    createGain = vi.fn(() => ({
        gain: { value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn()
    }));
    createBuffer = vi.fn(() => ({ getChannelData: () => new Float32Array(10) }));
    createBufferSource = vi.fn(() => ({
        buffer: null, loop: false, connect: vi.fn(), start: vi.fn(), stop: vi.fn()
    }));
    createBiquadFilter = vi.fn(() => ({
        type: 'lowpass', frequency: { value: 0, setTargetAtTime: vi.fn() }, connect: vi.fn()
    }));
    createOscillator = vi.fn(() => ({
        type: 'sine', frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(), start: vi.fn(), stop: vi.fn()
    }));
    resume = vi.fn().mockResolvedValue(undefined);
}

// Global mocks
vi.stubGlobal('AudioContext', MockAudioContext);
vi.stubGlobal('window', {
    AudioContext: MockAudioContext,
    speechSynthesis: {
        getVoices: vi.fn(() => []),
        cancel: vi.fn(),
        speak: vi.fn()
    }
});

class MockSpeechSynthesisUtterance {
    text: string;
    rate: number = 1;
    voice: any = null;
    constructor(text: string) {
        this.text = text;
    }
}
vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance);

describe('AudioEngine', () => {
    it('should initialize successfully', () => {
        const engine = new AudioEngine();
        engine.init();
        expect(engine.initialized).toBe(true);
        expect((engine as any).ctx).toBeInstanceOf(MockAudioContext);
    });

    it('should handle initialization errors gracefully', () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(function() {});

        // Temporarily override the global AudioContext mock to throw an error
        const mockError = new Error('AudioContext initialization failed');
        vi.stubGlobal('AudioContext', vi.fn().mockImplementation(function() {
            throw mockError;
        }));

        const engine = new AudioEngine();
        engine.init();

        expect(engine.initialized).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith('Audio initialization failed:', mockError);

        // Restore globals
        vi.stubGlobal('AudioContext', MockAudioContext);
        consoleSpy.mockRestore();
    });

    describe('setThrust', () => {
        it('should exit early if not initialized or muted', () => {
            const engine = new AudioEngine();
            // not initialized
            engine.setThrust(1, 1.2, 100);
            expect((engine as any).noiseGain).toBeNull();

            engine.init();
            engine.muted = true;
            engine.setThrust(1, 1.2, 100);
            const noiseGain = (engine as any).noiseGain;
            expect(noiseGain.gain.setTargetAtTime).not.toHaveBeenCalled();
        });

        it('should calculate target volume and frequency based on inputs', () => {
            const engine = new AudioEngine();
            engine.init();
            engine.muted = false;

            const noiseGain = (engine as any).noiseGain;
            const lowPass = (engine as any).lowPass;

            engine.setThrust(1, 1.225, 3000);

            // density 1.225 -> atmoFactor 1
            // throttle 1 -> volume 1 * (0.3 + 0.7 * 1) = 1
            // targetVol -> 0.5
            expect(noiseGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, 0, 0.1);

            // speedFactor 1 -> targetFreq = 100 + 600 + 300 = 1000
            expect(lowPass.frequency.setTargetAtTime).toHaveBeenCalledWith(1000, 0, 0.1);
        });
    });

    describe('playExplosion', () => {
        it('should exit early if not initialized or muted', () => {
            const engine = new AudioEngine();
            engine.playExplosion();
            expect((engine as any).ctx).toBeNull();
        });

        it('should play explosion sound effect', () => {
            const engine = new AudioEngine();
            engine.init();
            engine.muted = false;

            engine.playExplosion();

            const ctx = (engine as any).ctx;
            // createOscillator, createGain should have been called
            expect(ctx.createOscillator).toHaveBeenCalled();
            expect(ctx.createGain).toHaveBeenCalled();
        });
    });

    describe('playStaging', () => {
        it('should exit early if not initialized or muted', () => {
            const engine = new AudioEngine();
            engine.playStaging();
            expect((engine as any).ctx).toBeNull();
        });

        it('should play staging sound effect', () => {
            const engine = new AudioEngine();
            engine.init();
            engine.muted = false;

            engine.playStaging();

            const ctx = (engine as any).ctx;
            // createOscillator, createGain should have been called
            expect(ctx.createOscillator).toHaveBeenCalled();
            expect(ctx.createGain).toHaveBeenCalled();
        });
    });

    describe('toggleMute', () => {
        it('should initialize if not initialized', () => {
            const engine = new AudioEngine();
            expect(engine.initialized).toBe(false);
            engine.toggleMute();
            expect(engine.initialized).toBe(true);
        });

        it('should toggle muted state and update master gain', () => {
            const engine = new AudioEngine();
            engine.init();
            engine.muted = false; // explicitly start unmuted

            engine.toggleMute();
            expect(engine.muted).toBe(true);
            expect((engine as any).masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.1);

            engine.toggleMute();
            expect(engine.muted).toBe(false);
            expect((engine as any).masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.5, 0, 0.1);
        });

        it('should cancel speech synthesis if muted', () => {
            const engine = new AudioEngine();
            engine.init();
            engine.muted = false;

            engine.toggleMute(); // becomes muted
            expect(window.speechSynthesis.cancel).toHaveBeenCalled();
        });
    });

    describe('speak', () => {
        it('should exit early if muted or not initialized', () => {
            const engine = new AudioEngine();
            engine.speak('Test');
            expect(window.speechSynthesis.speak).not.toHaveBeenCalled();

            engine.init();
            engine.muted = true;
            engine.speak('Test');
            expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
        });

        it('should use preferred voice and call speak', () => {
            const engine = new AudioEngine();
            engine.init();
            engine.muted = false;

            const mockVoice = { name: 'Google US English' };
            vi.mocked(window.speechSynthesis.getVoices).mockReturnValue([mockVoice as any]);

            engine.speak('Test message');

            expect(window.speechSynthesis.getVoices).toHaveBeenCalled();
            expect(window.speechSynthesis.speak).toHaveBeenCalled();

            const utteranceCall = vi.mocked(window.speechSynthesis.speak).mock.calls[0][0] as SpeechSynthesisUtterance;
            expect(utteranceCall.text).toBe('Test message');
            expect(utteranceCall.rate).toBe(1.1);
            expect(utteranceCall.voice).toBe(mockVoice);
        });
    });

    describe('resume', () => {
        it('should resume audio context if suspended', async () => {
            const engine = new AudioEngine();
            engine.init();

            const ctx = (engine as any).ctx;
            ctx.state = 'suspended';

            await engine.resume();

            expect(ctx.resume).toHaveBeenCalled();
        });

        it('should not resume if not suspended', async () => {
            const engine = new AudioEngine();
            engine.init();

            const ctx = (engine as any).ctx;
            ctx.state = 'running';
            ctx.resume.mockClear();

            await engine.resume();

            expect(ctx.resume).not.toHaveBeenCalled();
        });
    });
});
