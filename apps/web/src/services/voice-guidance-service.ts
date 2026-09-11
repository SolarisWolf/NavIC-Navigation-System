/**
 * Voice Guidance Service
 *
 * Provides offline-capable spoken navigation prompts and procedural audio chimes.
 * Integrates Web Speech API (speechSynthesis) and Web Audio API (AudioContext)
 * with user controls (mute/unmute, volume, rate, voice selection, chimes).
 */

import {
  type VoicePrompt,
  type VoiceSettings,
  DEFAULT_VOICE_SETTINGS,
} from '@navic/navigation-core';
import { Logger } from '@navic/shared-models';
import { androidBridgeService } from './android-bridge-service';
import { tripRecoveryService } from './trip-recovery-service';

export type VoiceSpeakingListener = (isSpeaking: boolean, text: string) => void;
export type VoiceSettingsListener = (settings: VoiceSettings) => void;

const STORAGE_KEY = 'navic_voice_settings';

export class VoiceGuidanceService {
  private static instance: VoiceGuidanceService | null = null;
  private logger = new Logger('VoiceGuidanceService');

  private settings: VoiceSettings;
  private audioCtx: AudioContext | null = null;
  private isSpeaking: boolean = false;
  private currentText: string = '';

  private readonly speakingListeners: VoiceSpeakingListener[] = [];
  private readonly settingsListeners: VoiceSettingsListener[] = [];

  private availableVoices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;

  private constructor() {
    this.settings = this.loadSettings();
    this.initVoices();
  }

  public static getInstance(): VoiceGuidanceService {
    if (!VoiceGuidanceService.instance) {
      VoiceGuidanceService.instance = new VoiceGuidanceService();
    }
    return VoiceGuidanceService.instance;
  }

  /**
   * Initialize speech synthesis voices.
   */
  private initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.logger.warn('SpeechSynthesis API not supported in this environment');
      return;
    }

    const updateVoices = () => {
      this.availableVoices = window.speechSynthesis.getVoices();
      this.resolveSelectedVoice();
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }

  private resolveSelectedVoice(): void {
    if (this.availableVoices.length === 0) return;

    if (this.settings.selectedVoiceURI) {
      const match = this.availableVoices.find((v) => v.voiceURI === this.settings.selectedVoiceURI);
      if (match) {
        this.selectedVoice = match;
        return;
      }
    }

    // Prefer Indian English voice
    const indianVoice = this.availableVoices.find(
      (v) => v.lang.includes('en-IN') || v.name.toLowerCase().includes('india')
    );
    if (indianVoice) {
      this.selectedVoice = indianVoice;
      this.settings.selectedVoiceURI = indianVoice.voiceURI;
      return;
    }

    // Fallback to English voice
    const englishVoice = this.availableVoices.find((v) => v.lang.startsWith('en'));
    if (englishVoice) {
      this.selectedVoice = englishVoice;
      this.settings.selectedVoiceURI = englishVoice.voiceURI;
      return;
    }

    // Default first available
    this.selectedVoice = this.availableVoices[0];
  }

  /**
   * Lazily initialize Web Audio API AudioContext on user interaction or sound trigger.
   */
  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch((err) => {
        this.logger.warn('AudioContext resume failed:', err);
      });
    }

    return this.audioCtx;
  }

  /**
   * Plays a procedural synthesized audio chime using Web Audio API.
   * Completely offline, requires zero external audio assets.
   */
  public async playChime(type: 'turn' | 'alert' | 'arrival'): Promise<void> {
    if (this.settings.muted || !this.settings.chimeEnabled) return;

    if (tripRecoveryService.getSettings().audioDucking) {
      androidBridgeService.requestAudioFocus();
      setTimeout(() => {
        if (!this.isSpeaking) {
          androidBridgeService.abandonAudioFocus();
        }
      }, 700);
    }

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(this.settings.volume * 0.4, now);
      masterGain.connect(ctx.destination);

      if (type === 'turn') {
        // Dual-tone chime: C5 (523.25 Hz) -> E5 (659.25 Hz)
        this.playTone(ctx, masterGain, 523.25, now, 0.12);
        this.playTone(ctx, masterGain, 659.25, now + 0.13, 0.18);
      } else if (type === 'alert') {
        // Warning alert: A4 (440 Hz) -> E4 (330 Hz)
        this.playTone(ctx, masterGain, 440.0, now, 0.10);
        this.playTone(ctx, masterGain, 330.0, now + 0.12, 0.15);
      } else if (type === 'arrival') {
        // Celebration triad chord: C5 + E5 + G5
        this.playTone(ctx, masterGain, 523.25, now, 0.45);
        this.playTone(ctx, masterGain, 659.25, now + 0.05, 0.45);
        this.playTone(ctx, masterGain, 783.99, now + 0.10, 0.55);
      }
    } catch (err) {
      this.logger.warn('Error playing chime:', err);
    }
  }

  private playTone(
    ctx: AudioContext,
    destination: AudioNode,
    frequency: number,
    startTime: number,
    duration: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.8, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  /**
   * Queues or speaks a VoicePrompt.
   */
  public async speak(prompt: VoicePrompt): Promise<void> {
    if (this.settings.muted) return;

    if (tripRecoveryService.getSettings().audioDucking) {
      androidBridgeService.requestAudioFocus();
    }

    // Play chime prior to speech if enabled
    if (prompt.chimeType !== 'none') {
      await this.playChime(prompt.chimeType);
    }

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (tripRecoveryService.getSettings().audioDucking) {
        androidBridgeService.abandonAudioFocus();
      }
      return;
    }

    // High priority prompts cancel existing speech immediately
    if (prompt.priority === 'HIGH' && this.isSpeaking) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(prompt.text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.volume = this.settings.volume;
    utterance.rate = this.settings.rate;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.currentText = prompt.text;
      this.notifySpeakingChanged(true, prompt.text);
    };

    const cleanup = () => {
      this.isSpeaking = false;
      this.currentText = '';
      this.notifySpeakingChanged(false, '');
      if (tripRecoveryService.getSettings().audioDucking) {
        androidBridgeService.abandonAudioFocus();
      }
    };

    utterance.onend = cleanup;
    utterance.onerror = (e) => {
      this.logger.warn('Speech error:', e);
      cleanup();
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Stop any current speech playback immediately.
   */
  public cancel(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.currentText = '';
    this.notifySpeakingChanged(false, '');
    if (tripRecoveryService.getSettings().audioDucking) {
      androidBridgeService.abandonAudioFocus();
    }
  }

  /**
   * Play a test voice sample.
   */
  public testVoice(sampleText: string = 'In 200 meters, turn right onto Barakhamba Road.'): void {
    this.cancel();
    const prompt: VoicePrompt = {
      id: `test_${Date.now()}`,
      text: sampleText,
      stage: 'APPROACH',
      priority: 'HIGH',
      chimeType: 'turn',
      timestamp: Date.now(),
    };
    this.speak(prompt);
  }

  // --- Settings & Controls ---

  public toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    if (this.settings.muted) {
      this.cancel();
    } else {
      // Play a quick confirmation chime when unmuted
      this.playChime('turn');
    }
    this.saveSettings();
    this.notifySettingsChanged();
    return this.settings.muted;
  }

  public setMuted(muted: boolean): void {
    this.settings.muted = muted;
    if (muted) this.cancel();
    this.saveSettings();
    this.notifySettingsChanged();
  }

  public setVolume(volume: number): void {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
    this.notifySettingsChanged();
  }

  public setRate(rate: number): void {
    this.settings.rate = Math.max(0.5, Math.min(2.0, rate));
    this.saveSettings();
    this.notifySettingsChanged();
  }

  public setChimeEnabled(enabled: boolean): void {
    this.settings.chimeEnabled = enabled;
    this.saveSettings();
    this.notifySettingsChanged();
  }

  public setSelectedVoice(voiceURI: string): void {
    this.settings.selectedVoiceURI = voiceURI;
    this.selectedVoice = this.availableVoices.find((v) => v.voiceURI === voiceURI) || null;
    this.saveSettings();
    this.notifySettingsChanged();
  }

  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  public getVoices(): SpeechSynthesisVoice[] {
    return [...this.availableVoices];
  }

  public getActiveVoice(): SpeechSynthesisVoice | null {
    return this.selectedVoice;
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  public getCurrentText(): string {
    return this.currentText;
  }

  // --- Listeners ---

  public onSpeakingChange(listener: VoiceSpeakingListener): () => void {
    this.speakingListeners.push(listener);
    return () => {
      const idx = this.speakingListeners.indexOf(listener);
      if (idx >= 0) this.speakingListeners.splice(idx, 1);
    };
  }

  public onSettingsChange(listener: VoiceSettingsListener): () => void {
    this.settingsListeners.push(listener);
    return () => {
      const idx = this.settingsListeners.indexOf(listener);
      if (idx >= 0) this.settingsListeners.splice(idx, 1);
    };
  }

  private notifySpeakingChanged(isSpeaking: boolean, text: string): void {
    for (const l of this.speakingListeners) {
      try {
        l(isSpeaking, text);
      } catch (err) {
        this.logger.error('Speaking listener error:', err);
      }
    }
  }

  private notifySettingsChanged(): void {
    for (const l of this.settingsListeners) {
      try {
        l(this.getSettings());
      } catch (err) {
        this.logger.error('Settings listener error:', err);
      }
    }
  }

  private loadSettings(): VoiceSettings {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(raw) };
        }
      }
    } catch {
      // Fallback
    }
    return { ...DEFAULT_VOICE_SETTINGS };
  }

  private saveSettings(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      }
    } catch {
      // Ignore
    }
  }
}

export const voiceGuidanceService = VoiceGuidanceService.getInstance();
