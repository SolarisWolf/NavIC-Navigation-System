/**
 * @navic/navigation-core — Navigation Engine
 *
 * Master orchestrator that drives active turn-by-turn navigation.
 * Coordinates map matching, route progress tracking, guidance maneuver
 * sequencing, and off-route detection.
 */

import {
  type Coordinate,
  type NavigationInstruction,
  type NavigationState,
  type Route,
  NavigationMode,
  Logger,
} from '@navic/shared-models';

import { MapMatcher, type MapMatchResult } from '../matching/map-matcher';
import { ProgressTracker, type RouteProgress } from '../tracker/progress-tracker';
import { GuidanceEngine, type GuidanceState, type ManeuverProximity } from '../guidance/guidance-engine';
import { OffRouteDetector, type OffRouteStatus } from '../matching/off-route-detector';

export type NavigationStateListener = (state: NavigationState) => void;
export type ManeuverListener = (instruction: NavigationInstruction, proximity: ManeuverProximity) => void;
export type OffRouteListener = (status: OffRouteStatus) => void;
export type ArrivalListener = (destination: Coordinate) => void;

export class NavigationEngine {
  private readonly logger: Logger;
  private readonly mapMatcher: MapMatcher;
  private readonly progressTracker: ProgressTracker;
  private readonly guidanceEngine: GuidanceEngine;
  private readonly offRouteDetector: OffRouteDetector;

  private activeRoute: Route | null = null;
  private currentState: NavigationState;
  private lastMatchedSegment: number = 0;
  private lastManeuverId: string | null = null;

  // Listeners
  private readonly stateListeners: Set<NavigationStateListener> = new Set();
  private readonly maneuverListeners: Set<ManeuverListener> = new Set();
  private readonly offRouteListeners: Set<OffRouteListener> = new Set();
  private readonly arrivalListeners: Set<ArrivalListener> = new Set();

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger('NavigationEngine');
    this.mapMatcher = new MapMatcher();
    this.progressTracker = new ProgressTracker(25);
    this.guidanceEngine = new GuidanceEngine(25);
    this.offRouteDetector = new OffRouteDetector(35, 3, 2);

    this.currentState = this.createIdleState();
  }

  /**
   * Returns current navigation state.
   */
  public getState(): NavigationState {
    return this.currentState;
  }

  /**
   * True if active guidance is in progress.
   */
  public get isNavigating(): boolean {
    return this.currentState.mode === NavigationMode.Active;
  }

  /**
   * Starts active navigation along the given route.
   */
  public startNavigation(route: Route): NavigationState {
    this.activeRoute = route;
    this.lastMatchedSegment = 0;
    this.lastManeuverId = null;

    this.progressTracker.reset();
    this.guidanceEngine.reset();
    this.offRouteDetector.reset();

    const firstInstruction = route.instructions[0] ?? null;

    this.currentState = {
      mode: NavigationMode.Active,
      route,
      currentPosition: route.origin,
      matchedPosition: route.origin,
      currentRoadName: firstInstruction?.roadName ?? null,
      nextInstruction: firstInstruction,
      distanceToNextManeuver: firstInstruction?.distanceToNext ?? 0,
      remainingDistance: route.distance,
      eta: Date.now() + route.estimatedTime * 1000,
      remainingTime: route.estimatedTime,
      currentSpeed: 0,
      isOffRoute: false,
      progress: 0,
    };

    this.logger.info(
      `Navigation started: ${route.instructions.length} steps, ${(route.distance / 1000).toFixed(2)} km, ETA: ${Math.round(route.estimatedTime / 60)} min`
    );

    this.notifyState();
    return this.currentState;
  }

  /**
   * Stops active navigation and resets state to Idle.
   */
  public stopNavigation(): NavigationState {
    this.activeRoute = null;
    this.lastMatchedSegment = 0;
    this.lastManeuverId = null;

    this.progressTracker.reset();
    this.guidanceEngine.reset();
    this.offRouteDetector.reset();

    this.currentState = this.createIdleState();
    this.logger.info('Navigation stopped');

    this.notifyState();
    return this.currentState;
  }

  /**
   * Updates vehicle position and processes navigation cycle.
   *
   * @param position Fused or GNSS vehicle coordinate
   * @param heading Vehicle heading in degrees [0, 360)
   * @param speed Vehicle speed in m/s
   */
  public updatePosition(
    position: Coordinate,
    heading?: number,
    speed: number = 0
  ): NavigationState {
    if (this.currentState.mode !== NavigationMode.Active || !this.activeRoute) {
      this.currentState = {
        ...this.currentState,
        currentPosition: position,
        currentSpeed: speed,
      };
      this.notifyState();
      return this.currentState;
    }

    const route = this.activeRoute;

    // 1. Map Matching
    const match = this.mapMatcher.match(
      position,
      route,
      heading,
      speed,
      this.lastMatchedSegment
    );
    this.lastMatchedSegment = match.segmentIndex;

    // 2. Off-Route Detection
    const offRoute = this.offRouteDetector.evaluate(match.distanceToRoute);
    if (offRoute.justDeviated) {
      this.logger.warn(`Vehicle went OFF ROUTE! Cross-track error: ${match.distanceToRoute.toFixed(1)}m`);
      for (const listener of this.offRouteListeners) {
        try {
          listener(offRoute);
        } catch (e) {
          this.logger.error('Error in offRoute listener', e);
        }
      }
    } else if (offRoute.justRecovered) {
      this.logger.info(`Vehicle returned to route! Cross-track error: ${match.distanceToRoute.toFixed(1)}m`);
    }

    // 3. Progress Tracking
    const progress = this.progressTracker.track(
      position,
      match.alongRouteDistance,
      route,
      speed
    );

    // 4. Guidance & Instruction Advancement
    const guidance = this.guidanceEngine.evaluate(
      match.alongRouteDistance,
      match.snappedCoordinate,
      route.instructions
    );

    // Maneuver transition detection
    if (guidance.currentInstruction) {
      const stepKey = `${guidance.instructionIndex}-${guidance.currentInstruction.maneuver}`;
      if (stepKey !== this.lastManeuverId) {
        this.lastManeuverId = stepKey;
        for (const listener of this.maneuverListeners) {
          try {
            listener(guidance.currentInstruction, guidance.proximity);
          } catch (e) {
            this.logger.error('Error in maneuver listener', e);
          }
        }
      }
    }

    // 5. Destination Arrival Check
    let newMode: NavigationMode = this.currentState.mode;
    if (progress.hasArrived) {
      newMode = NavigationMode.Arrived;
      this.logger.info(`Destination ARRIVED! Remaining distance: ${progress.remainingDistance}m`);
      for (const listener of this.arrivalListeners) {
        try {
          listener(route.destination);
        } catch (e) {
          this.logger.error('Error in arrival listener', e);
        }
      }
    }

    // 6. Assemble Navigation State
    this.currentState = {
      mode: newMode,
      route,
      currentPosition: position,
      matchedPosition: match.snappedCoordinate,
      currentRoadName: match.roadName ?? guidance.currentInstruction?.roadName ?? null,
      nextInstruction: guidance.currentInstruction,
      distanceToNextManeuver: guidance.distanceToNextManeuver,
      remainingDistance: progress.remainingDistance,
      eta: progress.eta,
      remainingTime: progress.remainingTime,
      currentSpeed: progress.currentSpeed,
      isOffRoute: offRoute.isOffRoute,
      progress: progress.progress,
    };

    this.notifyState();
    return this.currentState;
  }

  // ─── Subscriptions ─────────────────────────────────────────────────────────

  public onStateChange(listener: NavigationStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public onManeuverChange(listener: ManeuverListener): () => void {
    this.maneuverListeners.add(listener);
    return () => this.maneuverListeners.delete(listener);
  }

  public onOffRoute(listener: OffRouteListener): () => void {
    this.offRouteListeners.add(listener);
    return () => this.offRouteListeners.delete(listener);
  }

  public onArrival(listener: ArrivalListener): () => void {
    this.arrivalListeners.add(listener);
    return () => this.arrivalListeners.delete(listener);
  }

  private notifyState(): void {
    for (const listener of this.stateListeners) {
      try {
        listener(this.currentState);
      } catch (e) {
        this.logger.error('Error in state listener', e);
      }
    }
  }

  private createIdleState(): NavigationState {
    return {
      mode: NavigationMode.Idle,
      route: null,
      currentPosition: null,
      matchedPosition: null,
      currentRoadName: null,
      nextInstruction: null,
      distanceToNextManeuver: null,
      remainingDistance: null,
      eta: null,
      remainingTime: null,
      currentSpeed: 0,
      isOffRoute: false,
      progress: 0,
    };
  }
}
