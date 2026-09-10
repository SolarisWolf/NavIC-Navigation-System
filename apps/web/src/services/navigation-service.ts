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
  type ActiveTripState,
  NavigationMode,
} from '@navic/shared-models';
import {
  NavigationEngine,
  ReroutingManager,
  VoicePromptGenerator,
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
import { voiceGuidanceService } from './voice-guidance-service.js';
import { powerService } from './power-service.js';
import { androidBridgeService } from './android-bridge-service.js';
import { tripRecoveryService } from './trip-recovery-service.js';

class NavigationServiceImpl {
  private engine: NavigationEngine;
  private reroutingManager: ReroutingManager;
  private voiceGenerator: VoicePromptGenerator;

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
    this.voiceGenerator = new VoicePromptGenerator();

    // Hook voice prompt output to voiceGuidanceService audio playback
    this.voiceGenerator.onPrompt((prompt) => {
      voiceGuidanceService.speak(prompt);
    });

    // Bubble engine events to our subscribers
    this.engine.onStateChange((state) => {
      // Process voice guidance if actively navigating on route
      if (state.mode === NavigationMode.Active && state.currentPosition) {
        this.voiceGenerator.processNavigationState(state);

        // Update ongoing Android notification and background Web Notification
        if (state.nextInstruction) {
          const remainingKm = state.remainingDistance ? (state.remainingDistance / 1000).toFixed(1) : '0.0';
          const etaMins = state.remainingTime ? Math.ceil(state.remainingTime / 60) : 0;
          const stats = `${remainingKm} km remaining • ETA ${etaMins} min`;
          powerService.updateGuidanceNotification(
            state.nextInstruction.description || 'Continue on route',
            stats
          );
          androidBridgeService.updateNavigationNotification(
            state.nextInstruction.description || 'Continue on route',
            `${remainingKm} km`,
            `${etaMins} min`,
            state.nextInstruction.roadName || ''
          );
        }

        // Persist active trip state for crash/relaunch recovery
        if (state.route) {
          const destName = state.route.instructions[state.route.instructions.length - 1]?.roadName || 'Destination';
          tripRecoveryService.saveTrip({
            route: state.route,
            destinationName: destName,
            destinationCoord: state.route.destination,
            startedAt: Date.now(),
            savedAt: Date.now(),
            lastMatchedSegment: (this.engine as any).lastMatchedSegment ?? 0,
            distanceTraveled: state.progress ? state.route.distance * state.progress : 0,
            remainingDistance: state.remainingDistance ?? 0,
            isNavigating: true,
            voiceMuted: voiceGuidanceService.getSettings().muted,
          });
        }
      }

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
      // Spoken off-route notification when vehicle first leaves route
      if (status.justDeviated && this.engine.isNavigating) {
        this.voiceGenerator.notifyOffRoute();
        this.triggerReroute(false);
      }

      for (const listener of this.offRouteListeners) {
        try {
          listener(status);
        } catch (e) {
          console.error('[NavigationService] Error in offRoute listener', e);
        }
      }
    });

    this.engine.onArrival((dest) => {
      this.voiceGenerator.notifyArrival();
      if (tripRecoveryService.getSettings().immersiveDrivingMode) {
        androidBridgeService.setImmersiveMode(false);
      }
      tripRecoveryService.clearTrip();

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
      this.voiceGenerator.notifyRerouteCompleted(newRoute.distance);

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

  public getVoiceGenerator(): VoicePromptGenerator {
    return this.voiceGenerator;
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
    this.voiceGenerator.reset();
    const state = this.engine.startNavigation(targetRoute);

    // Announce departure instruction
    const destName = targetRoute.instructions[targetRoute.instructions.length - 1]?.roadName || 'destination';
    const firstRoad = targetRoute.instructions[0]?.roadName;
    this.voiceGenerator.notifyNavigationStarted(destName, firstRoad);

    // Acquire wake lock & initialize foreground notification
    powerService.onNavigationStarted(destName);

    // Engage immersive driving mode if enabled
    if (tripRecoveryService.getSettings().immersiveDrivingMode) {
      androidBridgeService.setImmersiveMode(true);
    }

    return state;
  }

  /**
   * Resumes a previously active trip restored from local storage.
   */
  public resumeTrip(trip: ActiveTripState): NavigationState {
    routingService.setCurrentRoute(trip.route);
    tripRecoveryService.markTripHandled();
    return this.startNavigation(trip.route);
  }

  /**
   * Stops active navigation.
   */
  public stopNavigation(): NavigationState {
    this.reroutingManager.reset();
    this.voiceGenerator.reset();
    voiceGuidanceService.cancel();
    powerService.onNavigationStopped();
    if (tripRecoveryService.getSettings().immersiveDrivingMode) {
      androidBridgeService.setImmersiveMode(false);
    }
    tripRecoveryService.clearTrip();
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
