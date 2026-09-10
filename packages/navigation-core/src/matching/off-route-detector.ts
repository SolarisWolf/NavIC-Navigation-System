/**
 * @navic/navigation-core — Off-Route Detector
 *
 * Evaluates whether the vehicle has deviated from the planned route.
 * Employs hysteresis debouncing to eliminate false alarms caused by
 * momentary GNSS multipath, tunnel drift, or sharp turns.
 */

export interface OffRouteStatus {
  /** True if vehicle is reliably detected off-route */
  readonly isOffRoute: boolean;

  /** Current cross-track distance in meters */
  readonly distanceToRoute: number;

  /** Number of consecutive samples exceeding threshold */
  readonly consecutiveDeviations: number;

  /** True on the exact sample where state transitioned from on-route to off-route */
  readonly justDeviated: boolean;

  /** True on the exact sample where state transitioned from off-route to on-route */
  readonly justRecovered: boolean;
}

export class OffRouteDetector {
  private readonly thresholdMeters: number;
  private readonly requiredConsecutiveSamples: number;
  private readonly recoverySamples: number;

  private isOffRouteState: boolean = false;
  private consecutiveOffCount: number = 0;
  private consecutiveOnCount: number = 0;

  constructor(
    thresholdMeters: number = 35,
    requiredConsecutiveSamples: number = 3,
    recoverySamples: number = 2
  ) {
    this.thresholdMeters = thresholdMeters;
    this.requiredConsecutiveSamples = requiredConsecutiveSamples;
    this.recoverySamples = recoverySamples;
  }

  /**
   * Resets internal deviation counters.
   */
  public reset(): void {
    this.isOffRouteState = false;
    this.consecutiveOffCount = 0;
    this.consecutiveOnCount = 0;
  }

  /**
   * Evaluates the current cross-track error against deviation criteria.
   *
   * @param distanceToRoute Orthogonal distance in meters from the route
   */
  public evaluate(distanceToRoute: number): OffRouteStatus {
    let justDeviated = false;
    let justRecovered = false;

    if (distanceToRoute > this.thresholdMeters) {
      this.consecutiveOffCount++;
      this.consecutiveOnCount = 0;

      if (!this.isOffRouteState && this.consecutiveOffCount >= this.requiredConsecutiveSamples) {
        this.isOffRouteState = true;
        justDeviated = true;
      }
    } else {
      this.consecutiveOnCount++;
      this.consecutiveOffCount = 0;

      if (this.isOffRouteState && this.consecutiveOnCount >= this.recoverySamples) {
        this.isOffRouteState = false;
        justRecovered = true;
      }
    }

    return {
      isOffRoute: this.isOffRouteState,
      distanceToRoute: Math.round(distanceToRoute * 10) / 10,
      consecutiveDeviations: this.consecutiveOffCount,
      justDeviated,
      justRecovered,
    };
  }

  /**
   * Returns current off-route state.
   */
  public get isOffRoute(): boolean {
    return this.isOffRouteState;
  }
}
