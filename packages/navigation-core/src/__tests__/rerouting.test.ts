/**
 * @navic/navigation-core — Re-routing Unit Tests
 */

import { describe, it, expect, vi } from 'vitest';
import {
  type Route,
  type NavigationInstruction,
  ManeuverType,
  NavigationMode,
  RoutingProfile,
  RouteOptimization,
} from '@navic/shared-models';

import {
  NavigationEngine,
  ReroutingManager,
} from '../index';

describe('ReroutingManager', () => {
  const origin = { latitude: 28.6315, longitude: 77.2167 }; // CP
  const destination = { latitude: 28.6129, longitude: 77.2295 }; // India Gate

  it('should recalculate a new route successfully', async () => {
    const manager = new ReroutingManager({ cooldownMs: 1000 });
    const startedCallback = vi.fn();
    const successCallback = vi.fn();

    manager.onRerouteStarted(startedCallback);
    manager.onRerouteSuccess(successCallback);

    const offRoutePos = { latitude: 28.6270, longitude: 77.2200 };
    const newRoute = await manager.recalculate(
      offRoutePos,
      destination,
      RoutingProfile.Car,
      RouteOptimization.Fastest
    );

    expect(newRoute).toBeDefined();
    expect(newRoute?.distance).toBeGreaterThan(0);
    expect(startedCallback).toHaveBeenCalledTimes(1);
    expect(successCallback).toHaveBeenCalledTimes(1);
    expect(manager.isCalculating).toBe(false);
  });

  it('should throttle re-routing requests within cooldown window', async () => {
    const manager = new ReroutingManager({ cooldownMs: 5000 });
    const offRoutePos = { latitude: 28.6270, longitude: 77.2200 };

    // First call succeeds
    const route1 = await manager.recalculate(offRoutePos, destination);
    expect(route1).not.toBeNull();
    expect(manager.canReroute()).toBe(false);

    // Immediate second call throttled
    const route2 = await manager.recalculate(offRoutePos, destination);
    expect(route2).toBeNull();

    // Forced call bypasses cooldown
    const route3 = await manager.recalculate(offRoutePos, destination, RoutingProfile.Car, RouteOptimization.Fastest, true);
    expect(route3).not.toBeNull();
  });
});

describe('NavigationEngine Route Hot-Swapping', () => {
  const initialRoute: Route = {
    id: 'initial-route',
    origin: { latitude: 28.6315, longitude: 77.2167 },
    destination: { latitude: 28.6129, longitude: 77.2295 },
    distance: 2500,
    estimatedTime: 250,
    profile: RoutingProfile.Car,
    optimization: RouteOptimization.Fastest,
    calculatedAt: Date.now(),
    geometry: [
      { coordinate: { latitude: 28.6315, longitude: 77.2167 }, distanceFromStart: 0, roadName: 'Radial Road' },
      { coordinate: { latitude: 28.6250, longitude: 77.2185 }, distanceFromStart: 800, roadName: 'Janpath' },
      { coordinate: { latitude: 28.6129, longitude: 77.2295 }, distanceFromStart: 2500, roadName: 'India Gate' },
    ],
    instructions: [
      {
        maneuver: ManeuverType.Depart,
        distanceFromStart: 0,
        distanceToNext: 800,
        roadName: 'Radial Road',
        description: 'Depart on Radial Road',
        coordinate: { latitude: 28.6315, longitude: 77.2167 },
      },
      {
        maneuver: ManeuverType.TurnLeft,
        distanceFromStart: 800,
        distanceToNext: 1700,
        roadName: 'Janpath',
        description: 'Turn left onto Janpath',
        coordinate: { latitude: 28.6250, longitude: 77.2185 },
      },
      {
        maneuver: ManeuverType.Arrive,
        distanceFromStart: 2500,
        distanceToNext: 0,
        roadName: 'India Gate',
        description: 'Arrive at India Gate',
        coordinate: { latitude: 28.6129, longitude: 77.2295 },
      },
    ],
  };

  const recalculatedRoute: Route = {
    id: 'recalculated-route',
    origin: { latitude: 28.6200, longitude: 77.2300 }, // Off-route origin
    destination: { latitude: 28.6129, longitude: 77.2295 },
    distance: 1200,
    estimatedTime: 120,
    profile: RoutingProfile.Car,
    optimization: RouteOptimization.Fastest,
    calculatedAt: Date.now(),
    geometry: [
      { coordinate: { latitude: 28.6200, longitude: 77.2300 }, distanceFromStart: 0, roadName: 'Mathura Road' },
      { coordinate: { latitude: 28.6129, longitude: 77.2295 }, distanceFromStart: 1200, roadName: 'Mathura Road' },
    ],
    instructions: [
      {
        maneuver: ManeuverType.Depart,
        distanceFromStart: 0,
        distanceToNext: 1200,
        roadName: 'Mathura Road',
        description: 'Head south on Mathura Road',
        coordinate: { latitude: 28.6200, longitude: 77.2300 },
      },
      {
        maneuver: ManeuverType.Arrive,
        distanceFromStart: 1200,
        distanceToNext: 0,
        roadName: 'India Gate',
        description: 'Arrive at India Gate',
        coordinate: { latitude: 28.6129, longitude: 77.2295 },
      },
    ],
  };

  it('should transition to Rerouting mode when setMode is called', () => {
    const engine = new NavigationEngine();
    engine.startNavigation(initialRoute);

    const state = engine.setMode(NavigationMode.Rerouting);
    expect(state.mode).toBe(NavigationMode.Rerouting);
    expect(engine.getState().mode).toBe(NavigationMode.Rerouting);
  });

  it('should hot-swap route seamlessly and resume active guidance on new path', () => {
    const engine = new NavigationEngine();
    engine.startNavigation(initialRoute);

    // Simulate vehicle deviating off-route
    engine.updatePosition({ latitude: 28.6200, longitude: 77.2300 }, 180, 10);

    // Hot-swap with recalculated route
    const swappedState = engine.reroute(recalculatedRoute);

    expect(swappedState.mode).toBe(NavigationMode.Active);
    expect(swappedState.route?.id).toBe('recalculated-route');
    expect(swappedState.remainingDistance).toBe(1200);
    expect(swappedState.isOffRoute).toBe(false);
    expect(swappedState.nextInstruction?.roadName).toBe('Mathura Road');

    // Subsequent update snaps to the new route
    const nextUpdate = engine.updatePosition({ latitude: 28.6180, longitude: 77.2300 }, 180, 10);
    expect(nextUpdate.matchedPosition).toBeDefined();
    expect(nextUpdate.currentRoadName).toBe('Mathura Road');
  });
});
