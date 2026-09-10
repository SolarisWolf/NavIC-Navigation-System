/**
 * @navic/navigation-core — Unit & Benchmark Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  type Route,
  type NavigationInstruction,
  ManeuverType,
  NavigationMode,
  RoutingProfile,
  RouteOptimization,
  haversineDistance,
} from '@navic/shared-models';

import {
  NavigationEngine,
  MapMatcher,
  ProgressTracker,
  GuidanceEngine,
  OffRouteDetector,
} from '../index';

describe('MapMatcher', () => {
  const mockRoute: Route = {
    id: 'test-route-1',
    origin: { latitude: 28.6315, longitude: 77.2167 }, // Connaught Place
    destination: { latitude: 28.6129, longitude: 77.2295 }, // India Gate
    distance: 2500,
    estimatedTime: 300,
    profile: RoutingProfile.Car,
    optimization: RouteOptimization.Fastest,
    calculatedAt: Date.now(),
    geometry: [
      { coordinate: { latitude: 28.6315, longitude: 77.2167 }, distanceFromStart: 0, roadName: 'Radial Road' },
      { coordinate: { latitude: 28.6250, longitude: 77.2185 }, distanceFromStart: 800, roadName: 'Janpath' },
      { coordinate: { latitude: 28.6140, longitude: 77.2200 }, distanceFromStart: 1800, roadName: 'Kartavya Path' },
      { coordinate: { latitude: 28.6129, longitude: 77.2295 }, distanceFromStart: 2500, roadName: 'India Gate Circle' },
    ],
    instructions: [],
  };

  it('should snap a vehicle close to a segment accurately', () => {
    const matcher = new MapMatcher();
    // Slightly offset to the east of the first segment (around halfway between 28.6315 and 28.6250)
    const rawPos = { latitude: 28.6280, longitude: 77.2180 };
    const match = matcher.match(rawPos, mockRoute);

    expect(match.segmentIndex).toBe(0);
    expect(match.distanceToRoute).toBeLessThan(100);
    expect(match.snappedCoordinate.latitude).toBeCloseTo(28.6280, 2);
    expect(match.alongRouteDistance).toBeGreaterThan(0);
    expect(match.alongRouteDistance).toBeLessThan(800);
    expect(match.confidence).toBeGreaterThan(0);
  });

  it('should calculate segment bearing and road name', () => {
    const matcher = new MapMatcher();
    const pos = { latitude: 28.6200, longitude: 77.2190 };
    const match = matcher.match(pos, mockRoute);

    expect(match.segmentIndex).toBe(1);
    expect(match.segmentBearing).toBeGreaterThanOrEqual(0);
    expect(match.segmentBearing).toBeLessThan(360);
    expect(match.roadName).toBeDefined();
  });
});

describe('ProgressTracker', () => {
  const mockRoute: Route = {
    id: 'test-route-2',
    origin: { latitude: 28.6315, longitude: 77.2167 },
    destination: { latitude: 28.6129, longitude: 77.2295 },
    distance: 2000,
    estimatedTime: 200,
    profile: RoutingProfile.Car,
    optimization: RouteOptimization.Fastest,
    calculatedAt: Date.now(),
    geometry: [],
    instructions: [],
  };

  it('should compute remaining distance, progress fraction, and ETA', () => {
    const tracker = new ProgressTracker(25);
    const pos = { latitude: 28.6220, longitude: 77.2180 };
    const progress = tracker.track(pos, 1000, mockRoute, 10); // 10 m/s speed

    expect(progress.distanceTraveled).toBe(1000);
    expect(progress.remainingDistance).toBe(1000);
    expect(progress.progress).toBe(0.5);
    expect(progress.remainingTime).toBe(100); // 1000m / 10m/s
    expect(progress.hasArrived).toBe(false);
  });

  it('should detect arrival at destination within threshold radius', () => {
    const tracker = new ProgressTracker(25);
    // At destination coordinate
    const arrivalPos = { latitude: 28.6129, longitude: 77.2295 };
    const progress = tracker.track(arrivalPos, 2000, mockRoute, 0);

    expect(progress.remainingDistance).toBe(0);
    expect(progress.progress).toBe(1);
    expect(progress.hasArrived).toBe(true);
  });
});

describe('GuidanceEngine', () => {
  const mockInstructions: NavigationInstruction[] = [
    {
      maneuver: ManeuverType.Depart,
      distanceFromStart: 0,
      distanceToNext: 800,
      roadName: 'Radial Road',
      description: 'Depart onto Radial Road',
      coordinate: { latitude: 28.6315, longitude: 77.2167 },
    },
    {
      maneuver: ManeuverType.TurnLeft,
      distanceFromStart: 800,
      distanceToNext: 1000,
      roadName: 'Janpath',
      description: 'Turn left onto Janpath',
      coordinate: { latitude: 28.6250, longitude: 77.2185 },
    },
    {
      maneuver: ManeuverType.TurnRight,
      distanceFromStart: 1800,
      distanceToNext: 700,
      roadName: 'Kartavya Path',
      description: 'Turn right onto Kartavya Path',
      coordinate: { latitude: 28.6140, longitude: 77.2200 },
    },
    {
      maneuver: ManeuverType.Arrive,
      distanceFromStart: 2500,
      distanceToNext: 0,
      roadName: 'India Gate',
      description: 'Arrive at India Gate',
      coordinate: { latitude: 28.6129, longitude: 77.2295 },
    },
  ];

  it('should report distance to the next maneuver', () => {
    const guidance = new GuidanceEngine(20);
    const startPos = { latitude: 28.6315, longitude: 77.2167 };
    const state = guidance.evaluate(0, startPos, mockInstructions);

    expect(state.currentInstruction?.maneuver).toBe(ManeuverType.Depart);
    expect(state.nextInstruction?.maneuver).toBe(ManeuverType.TurnLeft);
  });

  it('should advance to subsequent turn when vehicle moves past Depart', () => {
    const guidance = new GuidanceEngine(20);
    const movedPos = { latitude: 28.6280, longitude: 77.2175 };
    // Traveled 300m along route
    const state = guidance.evaluate(300, movedPos, mockInstructions);

    expect(state.currentInstruction?.maneuver).toBe(ManeuverType.TurnLeft);
    expect(state.distanceToNextManeuver).toBe(500); // 800 - 300
    expect(state.proximity).toBe('FAR');
  });

  it('should trigger IMMEDIATE proximity within 50m of a turn', () => {
    const guidance = new GuidanceEngine(20);
    const nearTurnPos = { latitude: 28.6253, longitude: 77.2184 };
    // 770m along route (30m from the 800m turn)
    const state = guidance.evaluate(770, nearTurnPos, mockInstructions);

    expect(state.currentInstruction?.maneuver).toBe(ManeuverType.TurnLeft);
    expect(state.distanceToNextManeuver).toBeLessThanOrEqual(50);
    expect(state.proximity).toBe('IMMEDIATE');
  });
});

describe('OffRouteDetector', () => {
  it('should not trigger off-route for transient noise under 3 samples', () => {
    const detector = new OffRouteDetector(35, 3, 2);

    // Sample 1: 40m away (> 35m)
    let status = detector.evaluate(40);
    expect(status.isOffRoute).toBe(false);
    expect(status.consecutiveDeviations).toBe(1);

    // Sample 2: 42m away
    status = detector.evaluate(42);
    expect(status.isOffRoute).toBe(false);
    expect(status.consecutiveDeviations).toBe(2);

    // Sample 3: Back to 20m (within threshold) -> resets counter
    status = detector.evaluate(20);
    expect(status.isOffRoute).toBe(false);
    expect(status.consecutiveDeviations).toBe(0);
  });

  it('should trigger off-route after 3 consecutive samples exceeding threshold and recover', () => {
    const detector = new OffRouteDetector(35, 3, 2);

    detector.evaluate(40);
    detector.evaluate(45);
    const status3 = detector.evaluate(50);

    expect(status3.isOffRoute).toBe(true);
    expect(status3.justDeviated).toBe(true);

    // Recovery requires 2 samples under 35m
    const rec1 = detector.evaluate(15);
    expect(rec1.isOffRoute).toBe(true);

    const rec2 = detector.evaluate(10);
    expect(rec2.isOffRoute).toBe(false);
    expect(rec2.justRecovered).toBe(true);
  });
});

describe('NavigationEngine (Integration & Benchmarks)', () => {
  const fullRoute: Route = {
    id: 'test-full-route',
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
      { coordinate: { latitude: 28.6140, longitude: 77.2200 }, distanceFromStart: 1800, roadName: 'Kartavya Path' },
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
        distanceToNext: 1000,
        roadName: 'Janpath',
        description: 'Turn left onto Janpath',
        coordinate: { latitude: 28.6250, longitude: 77.2185 },
      },
      {
        maneuver: ManeuverType.TurnRight,
        distanceFromStart: 1800,
        distanceToNext: 700,
        roadName: 'Kartavya Path',
        description: 'Turn right onto Kartavya Path',
        coordinate: { latitude: 28.6140, longitude: 77.2200 },
      },
      {
        maneuver: ManeuverType.Arrive,
        distanceFromStart: 2500,
        distanceToNext: 0,
        roadName: 'India Gate',
        description: 'Arrive at destination',
        coordinate: { latitude: 28.6129, longitude: 77.2295 },
      },
    ],
  };

  it('should start, update position, and stop cleanly', () => {
    const engine = new NavigationEngine();
    const stateCallback = vi.fn();
    const unsubscribe = engine.onStateChange(stateCallback);

    const startState = engine.startNavigation(fullRoute);
    expect(startState.mode).toBe(NavigationMode.Active);
    expect(engine.isNavigating).toBe(true);

    const updated = engine.updatePosition({ latitude: 28.6280, longitude: 77.2175 }, 160, 8.5);
    expect(updated.matchedPosition).toBeDefined();
    expect(updated.remainingDistance).toBeLessThan(2500);
    expect(updated.currentSpeed).toBe(8.5);

    const stopState = engine.stopNavigation();
    expect(stopState.mode).toBe(NavigationMode.Idle);
    expect(engine.isNavigating).toBe(false);

    unsubscribe();
  });

  it('should fire arrival listener when reaching destination', () => {
    const engine = new NavigationEngine();
    const arrivalCallback = vi.fn();
    engine.onArrival(arrivalCallback);

    engine.startNavigation(fullRoute);

    // Move to destination
    const arrivedState = engine.updatePosition({ latitude: 28.6129, longitude: 77.2295 }, 90, 0);

    expect(arrivedState.mode).toBe(NavigationMode.Arrived);
    expect(arrivalCallback).toHaveBeenCalledTimes(1);
    expect(arrivalCallback).toHaveBeenCalledWith(fullRoute.destination);
  });

  it('should execute 1,000 position updates in under 50 ms (benchmark)', () => {
    const engine = new NavigationEngine();
    engine.startNavigation(fullRoute);

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const frac = i / 1000;
      const lat = 28.6315 + frac * (28.6129 - 28.6315);
      const lon = 77.2167 + frac * (77.2295 - 77.2167);
      engine.updatePosition({ latitude: lat, longitude: lon }, 150, 10);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(50); // < 0.05 ms per update
  });
});
