/**
 * @navic/navigation-core — Route Progress Tracker
 *
 * Tracks vehicle progression along the active route geometry, computes
 * remaining distance and time, dynamic ETA, and triggers destination arrival.
 */

import {
  type Coordinate,
  type Route,
  RoutingProfile,
  clamp,
  haversineDistance,
} from '@navic/shared-models';

export interface RouteProgress {
  /** Distance traveled along the route in meters */
  readonly distanceTraveled: number;

  /** Distance remaining to destination in meters */
  readonly remainingDistance: number;

  /** Fraction of route completed [0.0, 1.0] */
  readonly progress: number;

  /** Estimated remaining time in seconds */
  readonly remainingTime: number;

  /** Estimated Time of Arrival (Unix epoch timestamp in ms) */
  readonly eta: number;

  /** Smoothed current speed in m/s */
  readonly currentSpeed: number;

  /** True if vehicle has arrived at destination */
  readonly hasArrived: boolean;
}

export class ProgressTracker {
  private smoothedSpeed: number = 0;
  private readonly arrivalRadiusMeters: number;

  constructor(arrivalRadiusMeters: number = 25) {
    this.arrivalRadiusMeters = arrivalRadiusMeters;
  }

  /**
   * Resets the tracker state for a new route.
   */
  public reset(): void {
    this.smoothedSpeed = 0;
  }

  /**
   * Computes route progression from the matched position along the route.
   *
   * @param currentPosition Raw or snapped vehicle coordinate
   * @param alongRouteDistance Cumulative meters from route start
   * @param route Active route
   * @param speed Current measured speed in m/s
   */
  public track(
    currentPosition: Coordinate,
    alongRouteDistance: number,
    route: Route,
    speed: number = 0
  ): RouteProgress {
    const totalDistance = Math.max(1, route.distance);
    const distanceTraveled = clamp(alongRouteDistance, 0, totalDistance);
    const remainingDistance = Math.max(0, totalDistance - distanceTraveled);
    const progress = clamp(distanceTraveled / totalDistance, 0, 1);

    // Speed smoothing: Exponential Moving Average
    if (speed > 0.5) {
      if (this.smoothedSpeed <= 0) {
        this.smoothedSpeed = speed;
      } else {
        this.smoothedSpeed = 0.3 * speed + 0.7 * this.smoothedSpeed;
      }
    }

    // Determine effective speed for ETA
    // If vehicle is stopped (at red lights/traffic), fall back to nominal profile speed
    let effectiveSpeed = this.smoothedSpeed;
    if (effectiveSpeed < 1.5) {
      effectiveSpeed = this.getNominalProfileSpeed(route.profile);
    }

    const remainingTime = Math.round(remainingDistance / effectiveSpeed);
    const eta = Date.now() + remainingTime * 1000;

    // Check arrival at destination
    const distanceToDestination = haversineDistance(
      currentPosition.latitude,
      currentPosition.longitude,
      route.destination.latitude,
      route.destination.longitude
    );
    const hasArrived =
      (distanceToDestination <= this.arrivalRadiusMeters) ||
      (remainingDistance <= 15 && distanceToDestination <= this.arrivalRadiusMeters * 1.5);

    return {
      distanceTraveled: Math.round(distanceTraveled),
      remainingDistance: Math.round(remainingDistance),
      progress: Math.round(progress * 1000) / 1000,
      remainingTime,
      eta,
      currentSpeed: Math.round(speed * 10) / 10,
      hasArrived,
    };
  }

  private getNominalProfileSpeed(profile: RoutingProfile): number {
    switch (profile) {
      case RoutingProfile.Walking:
        return 1.4; // ~5 km/h
      case RoutingProfile.Bicycle:
        return 4.5; // ~16 km/h
      case RoutingProfile.Car:
      default:
        return 10.0; // ~36 km/h (Delhi city average)
    }
  }
}
