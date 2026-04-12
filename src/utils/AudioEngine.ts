/**
 * Audio Engine
 *
 * Web Audio API-based sound engine for rocket simulation.
 * Generates procedural audio for:
 * - Engine rumble (filtered noise, pitch varies with altitude/throttle)
 * - Explosions (frequency sweep)
 * - Staging events (sharp transients)
 * - Voice announcements (Web Speech API)
 */

import { IAudioEngine } from '../types';

export class AudioEngine implements IAudioEngine {
    /** Web Audio context */
    private ctx: AudioContext | null = null;

    /** Master volume control */
    private masterGain: GainNode | null = null;

    /** Engine noise volume */
    private noiseGain: GainNode | null = null;

    /** Low-pass filter for engine sound */
    private lowPass: BiquadFilterNode | null = null;

    /** Noise source node */
    private noiseNode: AudioBufferSourceNode | null = null;

    /** Whether audio has been initialized */
    public initialized: boolean = false;

    /** Whether audio is muted */
    public muted: boolean = true;

    /**
     * Initialize audio context and create nodes
     * Must be called after user interaction (browser policy)
     */
    init(): void {
        if (this.initialized) return;

        try {
            this.ctx = new AudioContext();

            // Master gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);

            // Create brown noise buffer for engine rumble
            const bufferSize = 2 * this.ctx.sampleRate;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const output = buffer.getChannelData(0);

            // Brown noise algorithm (integrated white noise)
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut + 0.02 * white) / 1.02;
                lastOut = output[i]!;
                output[i]! *= 3.5; // Amplify
            }

            // Create noise source
            this.noiseNode = this.ctx.createBufferSource();
            this.noiseNode.buffer = buffer;
            this.noiseNode.loop = true;

            // Low-pass filter for altitude-dependent sound
            this.lowPass = this.ctx.createBiquadFilter();
            this.lowPass.type = 'lowpass';
            this.lowPass.frequency.value = 100;

            // Noise gain (engine volume)
            this.noiseGain = this.ctx.createGain();
            this.noiseGain.gain.value = 0;

            // Connect audio graph
            this.noiseNode.connect(this.lowPass);
            this.lowPass.connect(this.noiseGain);
            this.noiseGain.connect(this.masterGain);
            this.noiseNode.start(0);

            this.initialized = true;
            this.muted = false;
        } catch (e) {
            console.warn('Audio initialization failed:', e);
        }
    }

    /**
     * Update engine sound based on thrust and atmospheric conditions
     *
     * @param throttle - Current throttle (0-1)
     * @param density - Atmospheric density (kg/m³)
     * @param velocity - Current velocity (m/s)
     */
    setThrust(throttle: number, density: number, velocity: number): void {
        if (!this.initialized || this.muted || !this.ctx || !this.noiseGain || !this.lowPass) return;

        const vacuumMuffle = 0.3;
        // Atmospheric factor: 1 at sea level, 0 in vacuum
        const atmoFactor = Math.min(density ?? 1.225, 1);

        // Volume decreases in vacuum
        const volume = throttle * (vacuumMuffle + (1 - vacuumMuffle) * atmoFactor);
        const targetVol = Math.max(0, volume * 0.5);

        this.noiseGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.1);

        // Frequency increases with speed (Doppler-like effect)
        const speedFactor = Math.min((velocity ?? 0) / 3000, 1);
        const targetFreq = 100 + throttle * 600 + speedFactor * 300;

        this.lowPass.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    }

    /**
     * Play explosion sound effect
     */
    playExplosion(): void {
        if (!this.initialized || this.muted || !this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 1);

        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 1);
    }

    /**
     * Play staging sound effect
     */
    playStaging(): void {
        if (!this.initialized || this.muted || !this.ctx || !this.masterGain) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    /**
     * Toggle mute state
     * @returns New muted state
     */
    toggleMute(): boolean {
        if (!this.initialized) {
            this.init();
        }

        this.muted = !this.muted;

        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.1);
        }

        // Cancel any pending speech
        if (this.muted && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        return this.muted;
    }

    /**
     * Speak text using Web Speech API
     *
     * @param text - Text to speak
     */
    speak(text: string): void {
        if (this.muted || !this.initialized || !window.speechSynthesis) return;

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;

        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find((v) => v.name.includes('Google US English') || v.name.includes('Samantha'));
        if (preferred) {
            utterance.voice = preferred;
        }

        window.speechSynthesis.speak(utterance);
    }

    /**
     * Resume audio context if suspended (browser autoplay policy)
     */
    async resume(): Promise<void> {
        if (this.ctx && this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
    }
}
