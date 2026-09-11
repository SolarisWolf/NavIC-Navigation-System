/**
 * @navic/navigation-core — Voice Prompt Generator
 *
 * Evaluates guidance state, distance countdowns, and navigation events
 * to generate natural, driver-friendly turn-by-turn spoken audio prompts.
 * Includes multi-stage triggering, anti-repetition deduplication, and cooldowns.
 */

import {
  type NavigationInstruction,
  type NavigationState,
  ManeuverType,
  Logger,
} from '@navic/shared-models';
import type { GuidanceState } from '../guidance/guidance-engine';
import {
  type VoicePrompt,
  type VoicePromptStage,
  type VoicePromptPriority,
  type VoicePromptListener,
  type VoicePromptThresholds,
  type VoiceChimeType,
  DEFAULT_VOICE_THRESHOLDS,
} from './types';

export class VoicePromptGenerator {
  private readonly logger = new Logger('VoicePromptGenerator');
  private readonly thresholds: VoicePromptThresholds;
  private readonly listeners: VoicePromptListener[] = [];

  /** Set of completed stages keyed by `${instructionIndex}_${stage}` */
  private readonly spokenStages: Set<string> = new Set();

  /** Timestamp of the most recently emitted voice prompt */
  private lastPromptTimestamp: number = 0;

  /** Track currently navigated instruction index to detect step changes */
  private lastInstructionIndex: number = -1;

  constructor(thresholds: Partial<VoicePromptThresholds> = {}) {
    this.thresholds = {
      ...DEFAULT_VOICE_THRESHOLDS,
      ...thresholds,
    };
  }

  /**
   * Register a listener to receive emitted voice prompts.
   */
  public onPrompt(listener: VoicePromptListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /**
   * Resets generator state when starting or hot-swapping a route.
   */
  public reset(): void {
    this.spokenStages.clear();
    this.lastPromptTimestamp = 0;
    this.lastInstructionIndex = -1;
  }

  /**
   * Evaluates current guidance state and produces a voice prompt if a new stage threshold is met.
   *
   * @param guidance Active GuidanceState from GuidanceEngine
   * @param speedMs Current vehicle ground speed in m/s
   * @returns Emitted VoicePrompt or null if no new prompt needed
   */
  public processGuidance(guidance: GuidanceState, speedMs: number = 0): VoicePrompt | null {
    const { currentInstruction, distanceToNextManeuver, instructionIndex } = guidance;

    if (!currentInstruction) return null;

    // Reset prompt cache for new instruction step if we stepped forward
    if (instructionIndex !== this.lastInstructionIndex) {
      this.lastInstructionIndex = instructionIndex;
    }

    const now = Date.now();
    const isDepart = currentInstruction.maneuver === ManeuverType.Depart;
    const isArrive = currentInstruction.maneuver === ManeuverType.Arrive;

    // Dynamic advance distance: if driving fast (> 50 km/h = ~14 m/s), extend advance warning to 450m
    const dynamicAdvanceDist = speedMs > 14
      ? Math.max(450, this.thresholds.advanceDistanceMeters)
      : this.thresholds.advanceDistanceMeters;

    let targetStage: VoicePromptStage | null = null;
    let priority: VoicePromptPriority = 'NORMAL';
    let chimeType: VoiceChimeType = 'turn';

    if (isArrive) {
      if (distanceToNextManeuver <= this.thresholds.immediateDistanceMeters) {
        targetStage = 'ARRIVED';
        priority = 'HIGH';
        chimeType = 'arrival';
      } else if (distanceToNextManeuver <= this.thresholds.approachDistanceMeters) {
        targetStage = 'APPROACH';
      } else if (distanceToNextManeuver <= dynamicAdvanceDist) {
        targetStage = 'ADVANCE';
      }
    } else if (isDepart) {
      // Handled via notifyNavigationStarted or first advance
      if (distanceToNextManeuver <= this.thresholds.approachDistanceMeters) {
        targetStage = 'APPROACH';
      }
    } else {
      // Standard Turn Maneuvers
      if (distanceToNextManeuver <= this.thresholds.immediateDistanceMeters) {
        targetStage = 'IMMEDIATE';
        priority = 'HIGH';
      } else if (distanceToNextManeuver <= this.thresholds.approachDistanceMeters) {
        targetStage = 'APPROACH';
      } else if (distanceToNextManeuver <= dynamicAdvanceDist) {
        targetStage = 'ADVANCE';
      }
    }

    if (!targetStage) return null;

    const stageKey = `${instructionIndex}_${targetStage}`;
    if (this.spokenStages.has(stageKey)) {
      return null;
    }

    // Cooldown check (bypass for HIGH priority)
    if (priority !== 'HIGH' && now - this.lastPromptTimestamp < this.thresholds.minPromptIntervalMs) {
      return null;
    }

    // Generate natural text
    const text = this.formatManeuverText(currentInstruction, targetStage, distanceToNextManeuver);
    const prompt: VoicePrompt = {
      id: `prompt_${stageKey}_${now}`,
      text,
      stage: targetStage,
      priority,
      instructionIndex,
      distanceMeters: Math.round(distanceToNextManeuver),
      chimeType,
      timestamp: now,
    };

    this.spokenStages.add(stageKey);
    this.lastPromptTimestamp = now;
    this.emitPrompt(prompt);
    return prompt;
  }

  /**
   * Generates start of navigation announcement.
   */
  public notifyNavigationStarted(destinationName?: string, firstRoad?: string): VoicePrompt {
    const dest = destinationName ? ` to ${destinationName}` : '';
    const road = firstRoad ? `. Follow ${firstRoad}` : '';
    const text = `Starting navigation${dest}${road}.`;

    const prompt: VoicePrompt = {
      id: `prompt_start_${Date.now()}`,
      text,
      stage: 'START',
      priority: 'HIGH',
      chimeType: 'turn',
      timestamp: Date.now(),
    };

    this.spokenStages.add('start_prompt');
    this.lastPromptTimestamp = Date.now();
    this.emitPrompt(prompt);
    return prompt;
  }

  /**
   * Generates off-route recalculation alert.
   */
  public notifyOffRoute(): VoicePrompt {
    const text = 'You are off route. Recalculating path.';
    const prompt: VoicePrompt = {
      id: `prompt_offroute_${Date.now()}`,
      text,
      stage: 'REROUTE_STARTED',
      priority: 'HIGH',
      chimeType: 'alert',
      timestamp: Date.now(),
    };

    this.lastPromptTimestamp = Date.now();
    this.emitPrompt(prompt);
    return prompt;
  }

  /**
   * Generates re-route completed announcement.
   */
  public notifyRerouteCompleted(remainingDistanceMeters?: number): VoicePrompt {
    let distText = '';
    if (remainingDistanceMeters && remainingDistanceMeters > 0) {
      distText = remainingDistanceMeters >= 1000
        ? ` Continue for ${(remainingDistanceMeters / 1000).toFixed(1)} kilometers.`
        : ` Continue for ${Math.round(remainingDistanceMeters)} meters.`;
    }
    const text = `New route found.${distText}`;

    const prompt: VoicePrompt = {
      id: `prompt_reroute_done_${Date.now()}`,
      text,
      stage: 'REROUTE_COMPLETED',
      priority: 'HIGH',
      chimeType: 'turn',
      timestamp: Date.now(),
    };

    this.lastPromptTimestamp = Date.now();
    this.emitPrompt(prompt);
    return prompt;
  }

  /**
   * Generates destination arrival announcement.
   */
  public notifyArrival(): VoicePrompt {
    const text = 'You have arrived at your destination.';
    const prompt: VoicePrompt = {
      id: `prompt_arrived_${Date.now()}`,
      text,
      stage: 'ARRIVED',
      priority: 'HIGH',
      chimeType: 'arrival',
      timestamp: Date.now(),
    };

    this.lastPromptTimestamp = Date.now();
    this.emitPrompt(prompt);
    return prompt;
  }

  /**
   * Formats clean, concise natural speech phrasing for any maneuver instruction and stage.
   */
  public formatManeuverText(
    instruction: NavigationInstruction,
    stage: VoicePromptStage,
    distanceMeters: number
  ): string {
    const road = instruction.roadName && instruction.roadName !== 'unnamed road'
      ? ` onto ${instruction.roadName}`
      : '';

    const distFormatted = this.formatDistanceForSpeech(distanceMeters);

    if (instruction.maneuver === ManeuverType.Arrive) {
      if (stage === 'ARRIVED') {
        return 'You have arrived at your destination.';
      }
      return `In ${distFormatted}, you will arrive at your destination.`;
    }

    if (instruction.maneuver === ManeuverType.Depart) {
      return `Head towards ${instruction.roadName || 'your route'}.`;
    }

    // Action phrasing by maneuver type
    const actionPhrase = this.getManeuverActionPhrase(instruction.maneuver);

    switch (stage) {
      case 'ADVANCE':
        return `In ${distFormatted}, ${actionPhrase}${road}.`;
      case 'APPROACH':
        return `In ${distFormatted}, ${actionPhrase}${road}.`;
      case 'IMMEDIATE':
        return `${this.capitalizeFirst(actionPhrase)}${road} now.`;
      default:
        return `${this.capitalizeFirst(actionPhrase)}${road}.`;
    }
  }

  /**
   * Human-friendly spoken distance (e.g. "300 meters", "100 meters", "half a kilometer")
   */
  public formatDistanceForSpeech(meters: number): string {
    const rounded = Math.round(meters);
    if (rounded >= 1000) {
      const km = (rounded / 1000).toFixed(1);
      return km.endsWith('.0') ? `${Math.round(rounded / 1000)} kilometers` : `${km} kilometers`;
    }
    if (rounded >= 450 && rounded <= 550) {
      return '500 meters';
    }
    if (rounded > 100) {
      return `${Math.round(rounded / 50) * 50} meters`;
    }
    return `${Math.max(10, Math.round(rounded / 10) * 10)} meters`;
  }

  /**
   * Evaluates current NavigationState from NavigationEngine.
   */
  public processNavigationState(state: NavigationState): VoicePrompt | null {
    if (!state.nextInstruction || state.distanceToNextManeuver === null) {
      return null;
    }

    const instructionIndex = state.route
      ? state.route.instructions.findIndex((inst) => inst === state.nextInstruction)
      : 0;

    const guidance: GuidanceState = {
      currentInstruction: state.nextInstruction,
      nextInstruction: null,
      distanceToNextManeuver: state.distanceToNextManeuver,
      proximity: state.distanceToNextManeuver <= 30 ? 'IMMEDIATE' : state.distanceToNextManeuver <= 100 ? 'NEAR' : 'FAR',
      instructionIndex: instructionIndex >= 0 ? instructionIndex : 0,
    };

    return this.processGuidance(guidance, state.currentSpeed);
  }

  private getManeuverActionPhrase(type: ManeuverType): string {
    switch (type) {
      case ManeuverType.TurnLeft:
        return 'turn left';
      case ManeuverType.TurnRight:
        return 'turn right';
      case ManeuverType.TurnSlightLeft:
        return 'keep slight left';
      case ManeuverType.TurnSlightRight:
        return 'keep slight right';
      case ManeuverType.TurnSharpLeft:
        return 'turn sharp left';
      case ManeuverType.TurnSharpRight:
        return 'turn sharp right';
      case ManeuverType.UTurn:
        return 'make a U-turn';
      case ManeuverType.Roundabout:
        return 'enter the roundabout';
      case ManeuverType.RoundaboutExit:
        return 'take the roundabout exit';
      case ManeuverType.KeepLeft:
        return 'keep left';
      case ManeuverType.KeepRight:
        return 'keep right';
      case ManeuverType.Merge:
        return 'merge';
      case ManeuverType.ExitHighway:
        return 'take the exit';
      case ManeuverType.Fork:
        return 'take the fork';
      case ManeuverType.KeepStraight:
      default:
        return 'continue straight';
    }
  }

  private capitalizeFirst(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private emitPrompt(prompt: VoicePrompt): void {
    for (const listener of this.listeners) {
      try {
        listener(prompt);
      } catch (err) {
        this.logger.error('Error in voice prompt listener:', err);
      }
    }
  }
}
