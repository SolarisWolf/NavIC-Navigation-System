/**
 * @navic/navigation-core — Voice Prompt Types
 *
 * Defines prompt categories, proximity stages, chime cues,
 * and data contracts for spoken turn-by-turn guidance.
 */

export type VoicePromptStage =
  | 'START'
  | 'ADVANCE'
  | 'APPROACH'
  | 'IMMEDIATE'
  | 'ARRIVED'
  | 'REROUTE_STARTED'
  | 'REROUTE_COMPLETED';

export type VoicePromptPriority = 'HIGH' | 'NORMAL' | 'LOW';

export type VoiceChimeType = 'turn' | 'alert' | 'arrival' | 'none';

export interface VoicePrompt {
  /** Unique ID for tracking and de-duplication */
  readonly id: string;

  /** Spoken natural language text */
  readonly text: string;

  /** Announcement trigger stage */
  readonly stage: VoicePromptStage;

  /** Priority for audio queue preemption */
  readonly priority: VoicePromptPriority;

  /** Index of the route instruction if applicable */
  readonly instructionIndex?: number;

  /** Distance in meters to the maneuver at prompt time */
  readonly distanceMeters?: number;

  /** Procedural audio cue to play prior to speech */
  readonly chimeType: VoiceChimeType;

  /** Generation epoch timestamp */
  readonly timestamp: number;
}

export type VoicePromptListener = (prompt: VoicePrompt) => void;

export interface VoicePromptThresholds {
  /** Distance in meters for early advance warning (default: 300m) */
  readonly advanceDistanceMeters: number;

  /** Distance in meters for imminent approach warning (default: 100m) */
  readonly approachDistanceMeters: number;

  /** Distance in meters for immediate action instruction (default: 30m) */
  readonly immediateDistanceMeters: number;

  /** Minimum gap between consecutive normal prompts in milliseconds (default: 3500ms) */
  readonly minPromptIntervalMs: number;
}

export interface VoiceSettings {
  muted: boolean;
  volume: number; // 0.0 to 1.0
  rate: number; // 0.8 to 1.3
  chimeEnabled: boolean;
  selectedVoiceURI?: string;
}

export const DEFAULT_VOICE_THRESHOLDS: VoicePromptThresholds = {
  advanceDistanceMeters: 300,
  approachDistanceMeters: 100,
  immediateDistanceMeters: 30,
  minPromptIntervalMs: 3500,
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  muted: false,
  volume: 1.0,
  rate: 1.0,
  chimeEnabled: true,
};
