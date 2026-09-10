/**
 * @navic/navigation-core — Voice Prompts Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  VoicePromptGenerator,
  type VoicePrompt,
  ManeuverType,
  type NavigationInstruction,
} from '../index';
import type { GuidanceState } from '../guidance/guidance-engine';

describe('VoicePromptGenerator', () => {
  let generator: VoicePromptGenerator;

  const mockInstructionTurnLeft: NavigationInstruction = {
    maneuver: ManeuverType.TurnLeft,
    description: 'Turn left onto Barakhamba Road',
    roadName: 'Barakhamba Road',
    distanceToNext: 400,
    coordinate: { latitude: 28.6304, longitude: 77.2201 },
    distanceFromStart: 500,
  };

  const mockInstructionArrive: NavigationInstruction = {
    maneuver: ManeuverType.Arrive,
    description: 'You have arrived at your destination',
    roadName: 'India Gate',
    distanceToNext: 200,
    coordinate: { latitude: 28.6129, longitude: 77.2295 },
    distanceFromStart: 700,
  };

  beforeEach(() => {
    generator = new VoicePromptGenerator({
      advanceDistanceMeters: 300,
      approachDistanceMeters: 100,
      immediateDistanceMeters: 30,
      minPromptIntervalMs: 2000,
    });
  });

  it('generates multi-stage distance prompts for turn maneuvers', () => {
    const emitted: VoicePrompt[] = [];
    generator.onPrompt((p) => emitted.push(p));

    // Stage 1: Far away (500m) -> no prompt
    let guidance: GuidanceState = {
      currentInstruction: mockInstructionTurnLeft,
      nextInstruction: null,
      distanceToNextManeuver: 500,
      proximity: 'FAR',
      instructionIndex: 1,
    };
    let prompt = generator.processGuidance(guidance, 10);
    expect(prompt).toBeNull();
    expect(emitted).toHaveLength(0);

    // Stage 2: Advance warning (280m <= 300m)
    guidance = { ...guidance, distanceToNextManeuver: 280, proximity: 'NEAR' };
    prompt = generator.processGuidance(guidance, 10);
    expect(prompt).not.toBeNull();
    expect(prompt?.stage).toBe('ADVANCE');
    expect(prompt?.text).toContain('turn left onto Barakhamba Road');
    expect(prompt?.chimeType).toBe('turn');
    expect(emitted).toHaveLength(1);

    // Stage 3: Duplicate advance reading (250m) -> should be deduplicated
    guidance = { ...guidance, distanceToNextManeuver: 250 };
    prompt = generator.processGuidance(guidance, 10);
    expect(prompt).toBeNull();
    expect(emitted).toHaveLength(1);
  });

  it('generates approach and immediate cues as vehicle draws closer', () => {
    // Stage: Approach (80m <= 100m)
    const guidanceApproach: GuidanceState = {
      currentInstruction: mockInstructionTurnLeft,
      nextInstruction: null,
      distanceToNextManeuver: 80,
      proximity: 'NEAR',
      instructionIndex: 1,
    };
    const promptApproach = generator.processGuidance(guidanceApproach, 8);
    expect(promptApproach).not.toBeNull();
    expect(promptApproach?.stage).toBe('APPROACH');
    expect(promptApproach?.text).toContain('In 80 meters, turn left onto Barakhamba Road');

    // Stage: Immediate turn (< 30m)
    const guidanceImmediate: GuidanceState = {
      currentInstruction: mockInstructionTurnLeft,
      nextInstruction: null,
      distanceToNextManeuver: 15,
      proximity: 'IMMEDIATE',
      instructionIndex: 1,
    };
    const promptImmediate = generator.processGuidance(guidanceImmediate, 5);
    expect(promptImmediate).not.toBeNull();
    expect(promptImmediate?.stage).toBe('IMMEDIATE');
    expect(promptImmediate?.priority).toBe('HIGH');
    expect(promptImmediate?.text).toBe('Turn left onto Barakhamba Road now.');
  });

  it('formats various maneuver types naturally', () => {
    const uTurnStep: NavigationInstruction = {
      maneuver: ManeuverType.UTurn,
      description: 'Make a U-turn',
      roadName: '',
      distanceToNext: 100,
      coordinate: { latitude: 28.6, longitude: 77.2 },
      distanceFromStart: 0,
    };

    const textAdv = generator.formatManeuverText(uTurnStep, 'ADVANCE', 300);
    expect(textAdv).toBe('In 300 meters, make a U-turn.');

    const textImm = generator.formatManeuverText(uTurnStep, 'IMMEDIATE', 20);
    expect(textImm).toBe('Make a U-turn now.');
  });

  it('generates high-priority notifications for navigation start, off-route, reroute, and arrival', () => {
    const pStart = generator.notifyNavigationStarted('India Gate', 'Access Road');
    expect(pStart.stage).toBe('START');
    expect(pStart.text).toContain('Starting navigation to India Gate');
    expect(pStart.priority).toBe('HIGH');

    const pOffRoute = generator.notifyOffRoute();
    expect(pOffRoute.stage).toBe('REROUTE_STARTED');
    expect(pOffRoute.chimeType).toBe('alert');
    expect(pOffRoute.priority).toBe('HIGH');

    const pReroute = generator.notifyRerouteCompleted(1500);
    expect(pReroute.stage).toBe('REROUTE_COMPLETED');
    expect(pReroute.text).toContain('New route found. Continue for 1.5 kilometers.');

    const pArrival = generator.notifyArrival();
    expect(pArrival.stage).toBe('ARRIVED');
    expect(pArrival.chimeType).toBe('arrival');
    expect(pArrival.priority).toBe('HIGH');
  });

  it('resets stage history when route is restarted', () => {
    const guidance: GuidanceState = {
      currentInstruction: mockInstructionTurnLeft,
      nextInstruction: null,
      distanceToNextManeuver: 80,
      proximity: 'NEAR',
      instructionIndex: 1,
    };

    const first = generator.processGuidance(guidance, 5);
    expect(first).not.toBeNull();

    // Duplicate call returns null
    expect(generator.processGuidance(guidance, 5)).toBeNull();

    // Reset allows re-triggering for new route
    generator.reset();
    const afterReset = generator.processGuidance(guidance, 5);
    expect(afterReset).not.toBeNull();
  });
});
