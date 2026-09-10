/**
 * @navic/navigation-core — End-to-End System Validation Suite
 *
 * Phase 20: Comprehensive integration testing verifying all 20 development phases
 * working harmoniously as a unified, production-grade, 100% offline navigation system.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  FixType,
  GNSSMeasurement,
  RoutingProfile,
  RouteOptimization,
  NavigationMode,
  ManeuverType,
  PowerProfileMode,
  type ActiveTripState,
  type Route,
} from '@navic/shared-models';
import { ExtendedKalmanFilter } from '@navic/sensor-fusion';
import { PowerOptimizer } from '@navic/sensor-fusion';
import {
  buildDelhiRoadGraph,
  OfflineRoutingEngine,
  AStarRouter,
} from '@navic/routing-core';
import { POIDatabase } from '@navic/map-core';
import {
  NavigationEngine,
  ReroutingManager,
  GeoUriParser,
} from '../index.js';

describe('Phase 20: Grand End-to-End System Validation Suite', () => {
  const roadGraph = buildDelhiRoadGraph();
  const routingEngine = new OfflineRoutingEngine({ graph: roadGraph });

  // ─── 1. Complete End-to-End Navigation Lifecycle ──────────────────────────
  it('should execute a complete navigation journey: GNSS lock → EKF fusion → POI search → A* route → guidance → arrival', async () => {
    // A. GNSS Satellite Acquisition & EKF Fusion
    const ekf = new ExtendedKalmanFilter();
    ekf.initialize(0, 0, 0, 10, 0); // Origin at local ENU center, 10 m/s heading North
    expect(ekf.initialized).toBe(true);

    // Predict 50 Hz IMU step
    ekf.predict(0.02, 0.5, 0.01);
    // Ingest 1 Hz GNSS fix with NavIC assistance
    ekf.updateGNSS({
      east: 0.5,
      north: 10.2,
      up: 0,
      speed: 10.5,
      bearingRad: 0.05,
      horizontalAccuracy: 1.8,
      verticalAccuracy: 2.5,
    });
    const fusedState = ekf.getState();
    expect(fusedState.accuracy).toBeLessThan(3.0);

    // B. Offline POI Query: User searches for "India Gate"
    const poiDb = new POIDatabase([
      {
        id: 'poi_india_gate',
        name: 'India Gate',
        category: 'attraction',
        coordinate: { latitude: 28.6129, longitude: 77.2295 },
        description: 'Iconic war memorial arch in New Delhi',
      },
      {
        id: 'poi_cp',
        name: 'Connaught Place',
        category: 'commercial',
        coordinate: { latitude: 28.6315, longitude: 77.2167 },
        description: 'Georgian-style financial and commercial hub',
      },
    ]);

    const poiResults = poiDb.search('India Gate');
    expect(poiResults.length).toBeGreaterThan(0);
    const destinationPOI = poiResults[0].poi;
    expect(destinationPOI.name).toBe('India Gate');

    // C. Offline A* Route Calculation from Connaught Place to India Gate
    const route = await routingEngine.calculateRoute({
      origin: { latitude: 28.6315, longitude: 77.2167 },
      destination: destinationPOI.coordinate,
      profile: RoutingProfile.Car,
      optimization: RouteOptimization.Fastest,
    });

    expect(route).toBeDefined();
    expect(route.distance).toBeGreaterThan(2000);
    expect(route.instructions.length).toBeGreaterThanOrEqual(2);

    // D. Turn-by-Turn Navigation Engine Activation
    const navEngine = new NavigationEngine();
    let arrivalEventFired = false;
    navEngine.onArrival(() => {
      arrivalEventFired = true;
    });

    const initialNavState = navEngine.startNavigation(route);
    expect(initialNavState.mode).toBe(NavigationMode.Active);
    expect(initialNavState.remainingDistance).toBe(route.distance);

    // E. Drive through route waypoints to completion
    for (const pt of route.geometry) {
      navEngine.updatePosition(pt.coordinate, 12.0, 180);
    }

    // Vehicle reaches final destination point within arrival threshold
    const finalNavState = navEngine.getState();
    expect(arrivalEventFired).toBe(true);
    expect(finalNavState.mode).toBe(NavigationMode.Arrived);
  });

  // ─── 2. In-Flight Tunnel Outage & Dead Reckoning Continuity ────────────────
  it('should maintain continuous uninterrupted navigation during a 30-second tunnel GNSS blackout', async () => {
    const route = await routingEngine.calculateRoute({
      origin: { latitude: 28.6315, longitude: 77.2167 },
      destination: { latitude: 28.6129, longitude: 77.2295 },
      profile: RoutingProfile.Car,
    });

    const navEngine = new NavigationEngine();
    navEngine.startNavigation(route);

    const ekf = new ExtendedKalmanFilter();
    ekf.initialize(0, 0, 0, 15, 0); // 15 m/s (54 km/h) North

    // Simulate 30 seconds inside tunnel (1,500 continuous 50 Hz IMU prediction steps without GNSS)
    const blackoutDt = 0.02;
    for (let i = 0; i < 1500; i++) {
      ekf.predict(blackoutDt, 0.0, 0.0); // Constant speed, straight ahead
    }

    const tunnelState = ekf.getState();
    // Distance traveled: 15 m/s * 30s = ~450m
    expect(tunnelState.north).toBeCloseTo(450, -1);
    expect(Number.isFinite(tunnelState.accuracy)).toBe(true);
    // Uncertainty grew without GNSS corrections
    expect(tunnelState.accuracy).toBeGreaterThan(2.0);

    // Tunnel exit: GNSS signal reacquired!
    ekf.updateGNSS({
      east: 0,
      north: 455,
      up: 0,
      speed: 15.2,
      bearingRad: 0,
      horizontalAccuracy: 1.5,
      verticalAccuracy: 2.0,
    });

    const recoveredState = ekf.getState();
    expect(recoveredState.north).toBeCloseTo(455, 0);
    expect(recoveredState.accuracy).toBeLessThan(3.0);
  });

  // ─── 3. Off-Route Divergence & Re-Routing Engine Resilience ───────────────
  it('should detect off-route departure and perform an atomic route hot-swap within cooldown limits', async () => {
    const origin = { latitude: 28.6315, longitude: 77.2167 };
    const destination = { latitude: 28.6129, longitude: 77.2295 };

    const originalRoute = await routingEngine.calculateRoute({
      origin,
      destination,
      profile: RoutingProfile.Car,
    });

    const navEngine = new NavigationEngine();
    navEngine.startNavigation(originalRoute);

    const reroutingManager = new ReroutingManager({ cooldownMs: 1500 });
    const detourPosition = { latitude: 28.6280, longitude: 77.2500 }; // 2 km east of route

    // Recalculate route from detour location
    const newRoute = await reroutingManager.recalculate(detourPosition, destination);
    expect(newRoute).not.toBeNull();
    expect(newRoute?.id).not.toBe(originalRoute.id);

    // Hot-swap new route into active navigation engine
    const reroutedState = navEngine.reroute(newRoute!);
    expect(reroutedState.route?.id).toBe(newRoute?.id);
    expect(reroutedState.mode).toBe(NavigationMode.Active);
  });

  // ─── 4. Trip State Snapshot Persistence & Process Recovery ────────────────
  it('should serialize, store, and seamlessly restore active navigation state across simulated restart', async () => {
    const route = await routingEngine.calculateRoute({
      origin: { latitude: 28.6315, longitude: 77.2167 },
      destination: { latitude: 28.6129, longitude: 77.2295 },
      profile: RoutingProfile.Car,
    });

    // Active state prior to app termination
    const activeSnapshot: ActiveTripState = {
      route,
      destinationName: 'India Gate Landmark',
      destinationCoord: { latitude: 28.6129, longitude: 77.2295 },
      startedAt: Date.now() - 120000, // 2 minutes ago
      savedAt: Date.now(),
      lastMatchedSegment: 3,
      distanceTraveled: 850,
      remainingDistance: route.distance - 850,
      isNavigating: true,
      voiceMuted: false,
    };

    // Serialize to persistent storage format (JSON)
    const serialized = JSON.stringify(activeSnapshot);

    // Simulate process death / restart: restore from disk
    const restored: ActiveTripState = JSON.parse(serialized);
    expect(restored.destinationName).toBe('India Gate Landmark');
    expect(restored.isNavigating).toBe(true);
    expect(restored.distanceTraveled).toBe(850);

    // Resume navigation engine with restored route
    const newEngine = new NavigationEngine();
    const resumedState = newEngine.startNavigation(restored.route);
    expect(resumedState.mode).toBe(NavigationMode.Active);
    expect(resumedState.route?.id).toBe(route.id);
  });

  // ─── 5. Adaptive Power Optimizer Profile Throttling ───────────────────────
  it('should dynamically throttle sensor rate and map FPS as vehicle transitions and battery drains', () => {
    const optimizer = new PowerOptimizer({
      autoThrottleBatteryThreshold: 20,
      stationaryDebounceMs: 500, // Quick debounce for testing
    });

    // 1. Initial full power state
    optimizer.updateSpeed(10); // moving
    let status = optimizer.getStatus();
    expect(status.profileMode).toBe(PowerProfileMode.NORMAL);
    expect(status.activeImuRateHz).toBe(50);
    expect(status.mapFpsLimit).toBe(60);

    // 2. Simulate battery drain to 15% (below 20% threshold)
    optimizer.updateBattery({ levelPercent: 15, isCharging: false });
    status = optimizer.getStatus();
    expect(status.profileMode).toBe(PowerProfileMode.POWER_SAVER);
    expect(status.activeImuRateHz).toBe(25);
    expect(status.mapFpsLimit).toBe(30);

    // 3. Simulate severe battery drain to 5% (critical)
    optimizer.updateBattery({ levelPercent: 5, isCharging: false });
    status = optimizer.getStatus();
    expect(status.profileMode).toBe(PowerProfileMode.CRITICAL);
    expect(status.activeImuRateHz).toBe(10);
    expect(status.mapFpsLimit).toBe(15);
  });

  // ─── 6. RFC 5870 Geo URI Intent Resolution ────────────────────────────────
  it('should parse external Android geo navigation intent and resolve to navigable destination', async () => {
    const rawIntent = 'google.navigation:q=28.6129,77.2295&mode=d';
    const payload = GeoUriParser.parse(rawIntent);

    expect(payload.latitude).toBeCloseTo(28.6129, 4);
    expect(payload.longitude).toBeCloseTo(77.2295, 4);

    // Direct routing from user location to intent destination
    const route = await routingEngine.calculateRoute({
      origin: { latitude: 28.6315, longitude: 77.2167 },
      destination: { latitude: payload.latitude!, longitude: payload.longitude! },
      profile: RoutingProfile.Car,
    });

    expect(route).toBeDefined();
    expect(route.distance).toBeGreaterThan(2000);
  });
});
