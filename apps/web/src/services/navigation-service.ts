/**
 * Navigation Service
 *
 * Web singleton service managing active turn-by-turn navigation guidance.
 * Binds the NavigationEngine to live telemetry from the Sensor Fusion / EKF engine,
 * consumes active routes from RoutingService, and exposes reactive guidance streams
 * to Map and Route UI screens.
 */

import {
  type Coordinate,
  type NavigationState,
  type Route,
  type NavigationInstruction,
  NavigationMode,
} from '@navic/shared-models';
import {
  NavigationEngine,
  type NavigationStateListener,
  type ManeuverListener,
  type OffRouteListener,
  type ArrivalListener,
  type ManeuverProximity,
  type OffRouteStatus,
} from '@navic/navigation-core';
import { fusionService } from './fusion-service.js';
import { routingService } from './routing-service.js';

class NavigationServiceImpl {
  private engine: NavigationEngine;
  private stateListeners: Set<NavigationStateListener> = new Set();
  private maneuverListeners: Set<ManeuverListener> = new Set();
  private offRouteListeners: Set<OffRouteListener> = new Set();
  private arrivalListeners: Set<ArrivalListener> = new Set();

  constructor() {
    this.engine = new NavigationEngine();

    // Bubble engine events to our subscribers
    this.engine.onStateChange((state) => {
      for (const listener of this.stateListeners) {
        try {
          listener(state);
        } catch (e) {
          console.error('[NavigationService] Error in state listener', e);
        }
      }
    });

    this.engine.onManeuverChange((instruction, proximity) => {
      for (const listener of this.maneuverListeners) {
        try {
          listener(instruction, proximity);
        } catch (e) {
          console.error('[NavigationService] Error in maneuver listener', e);
        }
      }
    });

    this.engine.onOffRoute((status) => {
      for (const listener of this.offRouteListeners) {
        try {
          listener(status);
        } catch (e) {
          console.error('[NavigationService] Error in offRoute listener', e);
        }
      }
    });

    this.engine.onArrival((dest) => {
      for (const listener of this.arrivalListeners) {
        try {
          listener(dest);
        } catch (e) {
          console.error('[NavigationService] Error in arrival listener', e);
        }
      }
    });

    // Ingest live vehicle position updates from sensor fusion
    fusionService.onEstimate((estimate) => {
      if (this.engine.isNavigating && estimate.coordinate) {
        this.engine.updatePosition(
          {
            latitude: estimate.coordinate.latitude,
            longitude: estimate.coordinate.longitude,
          },
          estimate.bearing,
          estimate.speed
        );
      }
    });

    // When route is cleared, stop active navigation
    routingService.onRoute((route) => {
      if (!route && this.engine.isNavigating) {
        this.stopNavigation();
      }
    });
  }

  public getEngine(): NavigationEngine {
    return this.engine;
  }

  public getState(): NavigationState {
    return this.engine.getState();
  }

  public get isNavigating(): boolean {
    return this.engine.isNavigating;
  }

  /**
   * Starts active turn-by-turn navigation.
   * Uses passed route or grabs currently calculated route from routingService.
   */
  public startNavigation(route?: Route): NavigationState {
    const targetRoute = route ?? routingService.getCurrentRoute();
    if (!targetRoute) {
      throw new Error('Cannot start navigation: no route selected');
    }

    return this.engine.startNavigation(targetRoute);
  }

  /**
   * Stops active navigation.
   */
  public stopNavigation(): NavigationState {
    return this.engine.stopNavigation();
  }

  // ─── Subscriptions ─────────────────────────────────────────────────────────

  public onStateChange(listener: NavigationStateListener): () => void {
    this.stateListeners.add(listener);
    // Emit current state immediately
    listener(this.engine.getState());
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
}

export const navigationService = new NavigationServiceImpl();
