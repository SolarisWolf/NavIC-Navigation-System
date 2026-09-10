/**
 * Navigation Service
 *
 * Web singleton service managing active turn-by-turn navigation guidance and
 * automatic offline re-routing. Binds the NavigationEngine and ReroutingManager
 * to live telemetry from the Sensor Fusion / EKF engine, consumes active routes
 * from RoutingService, and exposes reactive guidance streams to Map and Route UI.
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
  ReroutingManager,
  type NavigationStateListener,
  type ManeuverListener,
  type OffRouteListener,
  type ArrivalListener,
  type RerouteStartedListener,
  type RerouteSuccessListener,
  type RerouteFailedListener,
  type ManeuverProximity,
  type OffRouteStatus,
} from '@navic/navigation-core';
import { fusionService } from './fusion-service.js';
import { routingService } from './routing-service.js';

class NavigationServiceImpl {
  private engine: NavigationEngine;
  private reroutingManager: ReroutingManager;

  private stateListeners: Set<NavigationStateListener> = new Set();
  private maneuverListeners: Set<ManeuverListener> = new Set();
  private offRouteListeners: Set<OffRouteListener> = new Set();
  private arrivalListeners: Set<ArrivalListener> = new Set();
  private rerouteStartedListeners: Set<RerouteStartedListener> = new Set();
  private rerouteSuccessListeners: Set<RerouteSuccessListener> = new Set();
  private rerouteFailedListeners: Set<RerouteFailedListener> = new Set();

  constructor() {
    this.engine = new NavigationEngine();
    this.reroutingManager = new ReroutingManager({
      routingEngine: routingService.getEngine(),
      cooldownMs: 3000,
    });

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

      // Automatically trigger re-route when vehicle just deviated and is actively navigating
      if (status.justDeviated && this.engine.isNavigating) {
        this.triggerReroute(false);
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

    // Re-routing event propagation
    this.reroutingManager.onRerouteStarted(() => {
      for (const listener of this.rerouteStartedListeners) {
        try {
          listener();
        } catch (e) {
          console.error('[NavigationService] Error in onRerouteStarted listener', e);
        }
      }
    });

    this.reroutingManager.onRerouteSuccess((newRoute) => {
      for (const listener of this.rerouteSuccessListeners) {
        try {
          listener(newRoute);
        } catch (e) {
          console.error('[NavigationService] Error in onRerouteSuccess listener', e);
        }
      }
    });

    this.reroutingManager.onRerouteFailed((error) => {
      for (const listener of this.rerouteFailedListeners) {
        try {
          listener(error);
        } catch (e) {
          console.error('[NavigationService] Error in onRerouteFailed listener', e);
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

  public getReroutingManager(): ReroutingManager {
    return this.reroutingManager;
  }

  public getState(): NavigationState {
    return this.engine.getState();
  }

  public get isNavigating(): boolean {
    return this.engine.isNavigating;
  }

  public get isRerouting(): boolean {
    return this.reroutingManager.isCalculating;
  }

  /**
   * Starts active turn-by-turn navigation.
   */
  public startNavigation(route?: Route): NavigationState {
    const targetRoute = route ?? routingService.getCurrentRoute();
    if (!targetRoute) {
      throw new Error('Cannot start navigation: no route selected');
    }

    this.reroutingManager.reset();
    return this.engine.startNavigation(targetRoute);
  }

  /**
   * Stops active navigation.
   */
  public stopNavigation(): NavigationState {
    this.reroutingManager.reset();
    return this.engine.stopNavigation();
  }

  /**
   * Triggers route recalculation (automatic on deviation, or manual override).
   */
  public async triggerReroute(force = false): Promise<Route | null> {
    const state = this.engine.getState();
    if (!state.route || !state.currentPosition || !this.engine.isNavigating) {
      return null;
    }

    // Set mode to Rerouting during calculation
    this.engine.setMode(NavigationMode.Rerouting);

    const newRoute = await this.reroutingManager.recalculate(
      state.currentPosition,
      state.route.destination,
      state.route.profile,
      state.route.optimization,
      force
    );

    if (newRoute) {
      routingService.setCurrentRoute(newRoute);
      this.engine.reroute(newRoute);
      return newRoute;
    } else {
      // If re-route was throttled or failed, restore Active mode
      if (this.engine.getState().mode === NavigationMode.Rerouting) {
        this.engine.setMode(NavigationMode.Active);
      }
      return null;
    }
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

  public onRerouteStarted(listener: RerouteStartedListener): () => void {
    this.rerouteStartedListeners.add(listener);
    return () => this.rerouteStartedListeners.delete(listener);
  }

  public onRerouteSuccess(listener: RerouteSuccessListener): () => void {
    this.rerouteSuccessListeners.add(listener);
    return () => this.rerouteSuccessListeners.delete(listener);
  }

  public onRerouteFailed(listener: RerouteFailedListener): () => void {
    this.rerouteFailedListeners.add(listener);
    return () => this.rerouteFailedListeners.delete(listener);
  }
}

export const navigationService = new NavigationServiceImpl();
