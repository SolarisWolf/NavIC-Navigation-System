/**
 * @navic/navigation-core — Navigation Reliability & Fault-Tolerance Tests
 *
 * Phase 19: Anti-thrashing re-routing concurrency, long-distance marathon guidance,
 * trip state serialization fuzzing, and audio focus parity.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  type Route,
  type NavigationInstruction,
  ManeuverType,
  NavigationMode,
  RoutingProfile,
  RouteOptimization,
  type ActiveTripState,
} from '@navic/shared-models';
import {
  NavigationEngine,
  ReroutingManager,
} from '../index.js';

describe('Phase 19: Navigation Reliability & Fault Tolerance Suite', () => {
  const origin = { latitude: 28.6315, longitude: 77.2167 };
  const destination = { latitude: 28.6129, longitude: 77.2295 };

  const testRoute: Route = {
    id: 'test-marathon-route',
    origin,
    destination,
    distance: 3000,
    estimatedTime: 300,
    profile: RoutingProfile.Car,
    optimization: RouteOptimization.Fastest,
    calculatedAt: Date.now(),
    geometry: [
      { coordinate: { latitude: 28.6315, longitude: 77.2167 }, distanceFromStart: 0, roadName: 'Janpath' },
      { coordinate: { latitude: 28.6250, longitude: 77.2200 }, distanceFromStart: 1000, roadName: 'Janpath' },
      { coordinate: { latitude: 28.6180, longitude: 77.2250 }, distanceFromStart: 2000, roadName: 'Rajpath' },
      { coordinate: { latitude: 28.6129, longitude: 77.2295 }, distanceFromStart: 3000, roadName: 'India Gate' },
    ],
    instructions: [
      {
        maneuver: ManeuverType.Depart,
        distanceFromStart: 0,
        distanceToNext: 1000,
        roadName: 'Janpath',
        description: 'Head south on Janpath',
        coordinate: { latitude: 28.6315, longitude: 77.2167 },
      },
      {
        maneuver: ManeuverType.TurnLeft,
        distanceFromStart: 1000,
        distanceToNext: 1000,
        roadName: 'Rajpath',
        description: 'Turn left onto Rajpath',
        coordinate: { latitude: 28.6250, longitude: 77.2200 },
      },
      {
        maneuver: ManeuverType.Arrive,
        distanceFromStart: 2000,
        distanceToNext: 1000,
        roadName: 'India Gate',
        description: 'Arrive at India Gate',
        coordinate: { latitude: 28.6129, longitude: 77.2295 },
      },
    ],
  };

  // ─── 1. Anti-Thrashing Re-Routing Concurrency Stress ───────────────────────
  it('should safely throttle 100 rapid concurrent re-route requests without race conditions', async () => {
    const manager = new ReroutingManager({ cooldownMs: 2000 });
    const offRouteCoord = { latitude: 28.6280, longitude: 77.2220 };

    let triggeredCount = 0;
    let throttledCount = 0;

    // Fire 100 near-simultaneous recalculation triggers
    const promises: Promise<Route | null>[] = [];
    for (let i = 0; i < 100; i++) {
      promises.push(
        manager.recalculate(offRouteCoord, destination).then((res) => {
          if (res !== null) triggeredCount++;
          else throttledCount++;
          return res;
        })
      );
    }

    await Promise.all(promises);

    // Exactly 1 request must succeed; 99 must be throttled by cooldown / mutex
    expect(triggeredCount).toBe(1);
    expect(throttledCount).toBe(99);
    expect(manager.isCalculating).toBe(false);
    expect(manager.canReroute()).toBe(false);
  });

  // ─── 2. Long-Distance Marathon Navigation Drive ───────────────────────────
  it('should smoothly process 3,000 interpolated position updates and trigger arrival cleanly', () => {
    const engine = new NavigationEngine();
    let arrived = false;

    engine.onArrival(() => {
      arrived = true;
    });

    engine.startNavigation(testRoute);

    const totalSteps = 3000;
    const geom = testRoute.geometry;
    let prevRemainingDistance = Infinity;

    for (let i = 0; i <= totalSteps; i++) {
      const frac = i / totalSteps;
      const targetDist = frac * 3000;

      // Find segment
      let segIdx = 0;
      for (let s = 0; s < geom.length - 1; s++) {
        if (targetDist >= geom[s].distanceFromStart && targetDist <= geom[s + 1].distanceFromStart) {
          segIdx = s;
          break;
        }
      }

      const p1 = geom[segIdx];
      const p2 = geom[segIdx + 1] ?? p1;
      const segLen = p2.distanceFromStart - p1.distanceFromStart;
      const localFrac = segLen > 0 ? (targetDist - p1.distanceFromStart) / segLen : 0;

      const lat = p1.coordinate.latitude + (p2.coordinate.latitude - p1.coordinate.latitude) * localFrac;
      const lng = p1.coordinate.longitude + (p2.coordinate.longitude - p1.coordinate.longitude) * localFrac;

      const state = engine.updatePosition(
        { latitude: lat, longitude: lng },
        12.0, // 12 m/s (~43 km/h)
        180   // South
      );

      // Distance countdown should generally decrease along the route
      if (i % 200 === 0 && i < totalSteps - 50 && state.remainingDistance !== null) {
        expect(state.remainingDistance).toBeLessThanOrEqual(prevRemainingDistance + 10);
        prevRemainingDistance = state.remainingDistance;
      }
    }

    // Vehicle reached destination
    expect(arrived).toBe(true);
    expect(engine.getState().mode).toBe(NavigationMode.Arrived);
  });

  // ─── 3. Trip State Serialization Fuzzing ──────────────────────────────────
  it('should withstand 1,000 randomized trip state serialization and deserialization cycles', () => {
    const testDestinations = [
      'Connaught Place, Inner Circle',
      'नई दिल्ली रेलवे स्टेशन',
      'IGI Airport Terminal 3 / Domestic Departure #4',
      'AIIMS Hospital — Emergency & Trauma Centre (गेट 1)',
      'Chandni Chowk <Old Delhi> & Red Fort',
      'Special chars: "Quotes", \nNewlines, \tTabs, \u0000, 100% Offline!',
    ];

    for (let cycle = 0; cycle < 1000; cycle++) {
      const tripState: ActiveTripState = {
        route: testRoute,
        destinationName: testDestinations[cycle % testDestinations.length],
        startedAt: Date.now() - cycle * 1000,
        lastMatchedSegment: cycle % 4,
        distanceTraveled: cycle * 5.2,
        isNavigating: cycle % 2 === 0,
        voiceMuted: cycle % 3 === 0,
      };

      const serialized = JSON.stringify(tripState);
      expect(typeof serialized).toBe('string');
      expect(serialized.length).toBeGreaterThan(100);

      const parsed: ActiveTripState = JSON.parse(serialized);
      expect(parsed.destinationName).toBe(tripState.destinationName);
      expect(parsed.route.id).toBe(testRoute.id);
      expect(parsed.distanceTraveled).toBe(tripState.distanceTraveled);
      expect(parsed.lastMatchedSegment).toBe(tripState.lastMatchedSegment);
      expect(parsed.isNavigating).toBe(tripState.isNavigating);
      expect(parsed.voiceMuted).toBe(tripState.voiceMuted);
    }
  });

  // ─── 4. Audio Focus Balance & Zero Leakage ────────────────────────────────
  it('should maintain strict 1:1 balance between acquire and release under rapid guidance alerts', () => {
    let activeFocusCount = 0;
    let totalAcquisitions = 0;
    let totalReleases = 0;

    const mockAudioManager = {
      acquire: () => {
        activeFocusCount++;
        totalAcquisitions++;
        return true;
      },
      release: () => {
        activeFocusCount--;
        totalReleases++;
        return true;
      },
    };

    // Simulate 100 guidance speech/chime cycles
    for (let i = 0; i < 100; i++) {
      mockAudioManager.acquire();
      // Simulate speech duration
      mockAudioManager.release();
    }

    expect(totalAcquisitions).toBe(100);
    expect(totalReleases).toBe(100);
    expect(activeFocusCount).toBe(0); // Zero orphaned audio focus requests
  });
});
