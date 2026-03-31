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
});
