/**
 * Routing Service
 *
 * Web service connecting the OfflineRoutingEngine to UI screens
 * (Route Planning and Map). Manages active calculated route state,
 * profile/optimization selections, and reactive route subscribers.
 */

import {
  type Route,
  RoutingProfile,
  RouteOptimization,
  type Coordinate,
  Logger,
} from '@navic/shared-models';
import { OfflineRoutingEngine } from '@navic/routing-core';
import { poiService } from './poi-service.js';

export type RouteListener = (route: Route | null) => void;

class RoutingServiceImpl {
  private logger = new Logger('RoutingService');
  private engine: OfflineRoutingEngine;
  private currentRoute: Route | null = null;
  private activeProfile: RoutingProfile = RoutingProfile.Car;
  private activeOptimization: RouteOptimization = RouteOptimization.Fastest;
  private routeListeners: Set<RouteListener> = new Set();

  constructor() {
    this.engine = new OfflineRoutingEngine();

    // When destination is cleared, clear active route
    poiService.onDestinationChange((dest) => {
      if (!dest && this.currentRoute) {
        this.clearRoute();
      }
    });
  }

  public getEngine(): OfflineRoutingEngine {
    return this.engine;
  }

  public getCurrentRoute(): Route | null {
    return this.currentRoute;
  }

  public getProfile(): RoutingProfile {
    return this.activeProfile;
  }

  public setProfile(profile: RoutingProfile): void {
    this.activeProfile = profile;
  }

  public getOptimization(): RouteOptimization {
    return this.activeOptimization;
  }

  public setOptimization(opt: RouteOptimization): void {
    this.activeOptimization = opt;
  }

  /**
   * Calculates a route between origin and destination.
   * If not provided, uses vehicle position as origin and selected destination as target.
   */
  public async calculateRoute(options?: {
    origin?: Coordinate;
    destination?: Coordinate;
    profile?: RoutingProfile;
    optimization?: RouteOptimization;
  }): Promise<Route | null> {
    const origin = options?.origin ?? poiService.getVehicleCoordinate();
    const destPoi = poiService.getSelectedDestination();
    const destination = options?.destination ?? (destPoi ? { latitude: destPoi.latitude, longitude: destPoi.longitude } : null);

    if (!destination) {
      this.clearRoute();
      return null;
    }

    const profile = options?.profile ?? this.activeProfile;
    const optimization = options?.optimization ?? this.activeOptimization;

    try {
      const route = await this.engine.calculateRoute({
        origin,
        destination,
        profile,
        optimization,
      });

      this.currentRoute = route;
      this.activeProfile = profile;
      this.activeOptimization = optimization;

      this.notifyListeners(route);
      return route;
    } catch (e) {
      this.logger.error('Route calculation error:', e);
      throw e;
    }
  }

  public setCurrentRoute(route: Route): void {
    this.currentRoute = route;
    this.notifyListeners(route);
  }

  public clearRoute(): void {
    this.currentRoute = null;
    this.notifyListeners(null);
  }

  public onRoute(listener: RouteListener): () => void {
    this.routeListeners.add(listener);
    listener(this.currentRoute);
    return () => this.routeListeners.delete(listener);
  }

  private notifyListeners(route: Route | null): void {
    for (const listener of this.routeListeners) {
      try {
        listener(route);
      } catch (e) {
        this.logger.error('Route listener error:', e);
      }
    }
  }
}

export const routingService = new RoutingServiceImpl();
