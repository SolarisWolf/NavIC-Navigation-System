/**
 * @navic/navigation-core — Re-routing Manager
 *
 * Orchestrates automatic and manual route recalculations when a vehicle
 * deviates from the planned road path.
 *
 * Features anti-thrashing cooldown rate limiting, concurrency protection,
 * and seamless route hot-swapping.
 */

import {
  type Coordinate,
  type Route,
  RoutingProfile,
  RouteOptimization,
  Logger,
} from '@navic/shared-models';
import { OfflineRoutingEngine } from '@navic/routing-core';

export type RerouteStartedListener = () => void;
export type RerouteSuccessListener = (newRoute: Route) => void;
export type RerouteFailedListener = (error: Error) => void;

export interface RerouteOptions {
  /** Cooldown time in ms between re-routing requests (default: 3000 ms) */
  readonly cooldownMs?: number;
  /** Custom router instance if provided */
  readonly routingEngine?: OfflineRoutingEngine;
  /** Optional logger */
  readonly logger?: Logger;
}

export class ReroutingManager {
  private readonly router: OfflineRoutingEngine;
  private readonly cooldownMs: number;
  private readonly logger: Logger;

  private isCalculatingState: boolean = false;
  private lastRerouteTime: number = 0;

  private readonly startedListeners: Set<RerouteStartedListener> = new Set();
  private readonly successListeners: Set<RerouteSuccessListener> = new Set();
  private readonly failedListeners: Set<RerouteFailedListener> = new Set();

  constructor(options: RerouteOptions = {}) {
    this.cooldownMs = options.cooldownMs ?? 3000;
    this.logger = options.logger ?? new Logger('ReroutingManager');
    this.router = options.routingEngine ?? new OfflineRoutingEngine();
  }

  /**
   * True if a re-routing computation is currently in progress.
   */
  public get isCalculating(): boolean {
    return this.isCalculatingState;
  }

  /**
   * Checks whether a new re-route can be triggered (respecting cooldown and concurrency).
   */
  public canReroute(): boolean {
    if (this.isCalculatingState) return false;
    const elapsed = Date.now() - this.lastRerouteTime;
    return elapsed >= this.cooldownMs;
  }

  /**
   * Resets the cooldown timer and calculation state.
   */
  public reset(): void {
    this.isCalculatingState = false;
    this.lastRerouteTime = 0;
  }

  /**
   * Triggers a route recalculation from the vehicle's current position to the destination.
   *
   * @param currentPosition Vehicle's current coordinate
   * @param destination Target destination coordinate
   * @param profile Routing profile (Car, Bicycle, Walking)
   * @param optimization Route optimization (Fastest, Shortest)
   * @param force If true, bypasses the cooldown check (e.g. for manual user override)
   */
  public async recalculate(
    currentPosition: Coordinate,
    destination: Coordinate,
    profile: RoutingProfile = RoutingProfile.Car,
    optimization: RouteOptimization = RouteOptimization.Fastest,
    force: boolean = false
  ): Promise<Route | null> {
    if (!force && !this.canReroute()) {
      this.logger.debug(
        `Re-route throttled: cooldown active (${Date.now() - this.lastRerouteTime}ms < ${this.cooldownMs}ms)`
      );
      return null;
    }

    if (this.isCalculatingState) {
      this.logger.warn('Re-route ignored: calculation already in progress');
      return null;
    }

    this.isCalculatingState = true;
    this.notifyStarted();
    this.logger.info(
      `Re-routing initiated from [${currentPosition.latitude.toFixed(4)}, ${currentPosition.longitude.toFixed(4)}] to destination`
    );

    try {
      const newRoute = await this.router.calculateRoute({
        origin: currentPosition,
        destination,
        profile,
        optimization,
      });

      this.lastRerouteTime = Date.now();
      this.logger.info(
        `Re-routing succeeded: ${newRoute.instructions.length} steps, ${(newRoute.distance / 1000).toFixed(2)} km, ETA: ${Math.round(newRoute.estimatedTime / 60)} min`
      );

      this.notifySuccess(newRoute);
      return newRoute;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Re-routing failed:', error.message);
      this.notifyFailed(error);
      return null;
    } finally {
      this.isCalculatingState = false;
    }
  }

  // ─── Subscriptions ─────────────────────────────────────────────────────────

  public onRerouteStarted(listener: RerouteStartedListener): () => void {
    this.startedListeners.add(listener);
    return () => this.startedListeners.delete(listener);
  }

  public onRerouteSuccess(listener: RerouteSuccessListener): () => void {
    this.successListeners.add(listener);
    return () => this.successListeners.delete(listener);
  }

  public onRerouteFailed(listener: RerouteFailedListener): () => void {
    this.failedListeners.add(listener);
    return () => this.failedListeners.delete(listener);
  }

  private notifyStarted(): void {
    for (const listener of this.startedListeners) {
      try {
        listener();
      } catch (e) {
        this.logger.error('Error in onRerouteStarted listener', e);
      }
    }
  }

  private notifySuccess(newRoute: Route): void {
    for (const listener of this.successListeners) {
      try {
        listener(newRoute);
      } catch (e) {
        this.logger.error('Error in onRerouteSuccess listener', e);
      }
    }
  }

  private notifyFailed(error: Error): void {
    for (const listener of this.failedListeners) {
      try {
        listener(error);
      } catch (e) {
        this.logger.error('Error in onRerouteFailed listener', e);
      }
    }
  }
}
