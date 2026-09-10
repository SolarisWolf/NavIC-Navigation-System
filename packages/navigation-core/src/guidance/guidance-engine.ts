/**
 * @navic/navigation-core — Guidance Engine
 *
 * Evaluates active turn-by-turn maneuvers, tracks distances to upcoming turns,
 * advances instructions as the vehicle reaches maneuvers, and prepares
 * immediate/near announcement cues.
 */

import {
  type Coordinate,
  type NavigationInstruction,
  ManeuverType,
  haversineDistance,
} from '@navic/shared-models';

export type ManeuverProximity = 'FAR' | 'NEAR' | 'IMMEDIATE' | 'ARRIVED';

export interface GuidanceState {
  /** The active maneuver instruction being navigated towards */
  readonly currentInstruction: NavigationInstruction | null;

  /** The subsequent maneuver instruction for lookahead preparation */
  readonly nextInstruction: NavigationInstruction | null;

  /** Distance in meters to the upcoming maneuver */
  readonly distanceToNextManeuver: number;

  /** Maneuver proximity category */
  readonly proximity: ManeuverProximity;

  /** Index of current instruction in route.instructions array */
  readonly instructionIndex: number;
}

export class GuidanceEngine {
  private activeIndex: number = 0;
  private readonly stepAdvanceRadiusMeters: number;

  constructor(stepAdvanceRadiusMeters: number = 20) {
    this.stepAdvanceRadiusMeters = stepAdvanceRadiusMeters;
  }

  /**
   * Resets guidance state for a new route.
   */
  public reset(): void {
    this.activeIndex = 0;
  }

  /**
   * Evaluates guidance along the route.
   *
   * @param alongRouteDistance Current along-route distance in meters
   * @param currentPosition Current vehicle coordinate
   * @param instructions Route instructions list
   */
  public evaluate(
    alongRouteDistance: number,
    currentPosition: Coordinate,
    instructions: readonly NavigationInstruction[]
  ): GuidanceState {
    if (!instructions || instructions.length === 0) {
      return {
        currentInstruction: null,
        nextInstruction: null,
        distanceToNextManeuver: 0,
        proximity: 'FAR',
        instructionIndex: 0,
      };
    }

    // Advance instruction if vehicle has passed or reached the current maneuver
    while (this.activeIndex < instructions.length - 1) {
      const activeStep = instructions[this.activeIndex];
      const nextStep = instructions[this.activeIndex + 1];

      // If at Depart instruction, only advance once vehicle starts moving (> 20m)
      if (activeStep.maneuver === ManeuverType.Depart) {
        if (alongRouteDistance > 20) {
          this.activeIndex++;
          continue;
        } else {
          break;
        }
      }

      // If vehicle has reached the step maneuver coordinate within tolerance
      const distToStepCoord = haversineDistance(
        currentPosition.latitude,
        currentPosition.longitude,
        activeStep.coordinate.latitude,
        activeStep.coordinate.longitude
      );
      const passedDistance = alongRouteDistance >= activeStep.distanceFromStart + 10;

      if (
        ((distToStepCoord <= this.stepAdvanceRadiusMeters && alongRouteDistance >= activeStep.distanceFromStart - 20) ||
          passedDistance) &&
        this.activeIndex < instructions.length - 1
      ) {
        this.activeIndex++;
      } else {
        break;
      }
    }

    const currentInstruction = instructions[this.activeIndex] ?? null;
    const nextInstruction = instructions[this.activeIndex + 1] ?? null;

    // Calculate distance to this maneuver
    let distanceToNextManeuver = 0;
    if (currentInstruction) {
      if (currentInstruction.maneuver === ManeuverType.Arrive) {
        distanceToNextManeuver = Math.max(0, currentInstruction.distanceFromStart - alongRouteDistance);
      } else {
        const directDist = haversineDistance(
          currentPosition.latitude,
          currentPosition.longitude,
          currentInstruction.coordinate.latitude,
          currentInstruction.coordinate.longitude
        );
        const alongDist = Math.max(0, currentInstruction.distanceFromStart - alongRouteDistance);
        // Prefer along-route distance if consistent, fallback to direct geodesic
        distanceToNextManeuver = Math.round(alongDist > 0 ? alongDist : directDist);
      }
    }

    // Determine proximity level
    let proximity: ManeuverProximity = 'FAR';
    if (currentInstruction?.maneuver === ManeuverType.Arrive && distanceToNextManeuver <= 25) {
      proximity = 'ARRIVED';
    } else if (distanceToNextManeuver <= 50) {
      proximity = 'IMMEDIATE';
    } else if (distanceToNextManeuver <= 250) {
      proximity = 'NEAR';
    }

    return {
      currentInstruction,
      nextInstruction,
      distanceToNextManeuver,
      proximity,
      instructionIndex: this.activeIndex,
    };
  }

  /**
   * Manually override active instruction index (e.g. for testing or re-sync)
   */
  public setInstructionIndex(index: number): void {
    this.activeIndex = Math.max(0, index);
  }
}
