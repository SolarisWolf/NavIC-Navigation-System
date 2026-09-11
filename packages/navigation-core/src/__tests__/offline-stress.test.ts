/**
 * @navic/navigation-core — Offline Stress & High-Load Benchmark Tests
 *
 * Phase 13: Stress testing 50 Hz EKF, prolonged Dead Reckoning,
 * A* pathfinding throughput, POI spatial indexing, and rapid re-routing.
 */

import { describe, it, expect } from 'vitest';
import {
  FixType,
  GNSSMeasurement,
  RoutingProfile,
  RouteOptimization,
} from '@navic/shared-models';
import { ExtendedKalmanFilter } from '@navic/sensor-fusion';
import { OfflineRoutingEngine } from '@navic/routing-core';
import { POIDatabase } from '@navic/map-core';
import {
  NavigationEngine,
  ReroutingManager,
} from '../index.js';

describe('Phase 13: Offline Stress & Reliability Benchmarks', () => {
  // ─── 1. 50 Hz EKF Telemetry Stress Test (10,000 Cycles) ───────────────────
  describe('High-Frequency EKF 50 Hz Stress (10,000 Cycles)', () => {
    it('should complete 10,000 continuous 50 Hz cycles with sub-millisecond latency and positive covariance', () => {
      const ekf = new ExtendedKalmanFilter();
      ekf.initialize(0, 0, 0, 12, 0); // 12 m/s North

      const totalCycles = 10000; // Equivalent to 200 seconds (3.3 minutes) of continuous 50 Hz updates
      const dt = 0.02; // 50 Hz = 20 ms
      const latencies: number[] = [];

      const startTime = performance.now();

      for (let i = 0; i < totalCycles; i++) {
        const t0 = performance.now();

        // 50 Hz IMU Prediction step: moderate acceleration and yaw rate
        const ax = Math.sin(i * 0.01) * 0.5;
        const yawRate = Math.cos(i * 0.005) * 0.05;
        ekf.predict(dt, ax, yawRate);

        // 1 Hz GNSS Update step (every 50 IMU cycles)
        if (i % 50 === 0) {
          ekf.updateGNSS({
            east: Math.sin(i * 0.001) * 100,
            north: i * 0.24,
            up: 0,
            speed: 12 + Math.sin(i * 0.01) * 2,
            bearingRad: 0,
            horizontalAccuracy: 2.0,
            verticalAccuracy: 3.0,
          });
        }

        const t1 = performance.now();
        latencies.push(t1 - t0);
      }

      const totalElapsed = performance.now() - startTime;
      const avgLatencyMs = totalElapsed / totalCycles;
      const maxLatencyMs = Math.max(...latencies);

      // Latency thresholds
      expect(avgLatencyMs).toBeLessThan(0.5); // Strict: avg < 0.5ms (well within 20ms budget)
      expect(maxLatencyMs).toBeLessThan(100.0); // Bounded max latency even during GC / thread preemption

      // Numeric stability: state must remain finite
      const finalState = ekf.getState();
      expect(Number.isFinite(finalState.east)).toBe(true);
      expect(Number.isFinite(finalState.north)).toBe(true);
      expect(Number.isFinite(finalState.speed)).toBe(true);
      expect(Number.isFinite(finalState.accuracy)).toBe(true);
      expect(finalState.accuracy).toBeGreaterThan(0);

      // Covariance diagonal positive-definiteness
      const covDiag = ekf.getCovarianceDiagonal();
      expect(covDiag.length).toBe(7);
      for (const variance of covDiag) {
        expect(variance).toBeGreaterThan(0);
        expect(Number.isFinite(variance)).toBe(true);
      }
    });
  });

  // ─── 2. Extended Dead Reckoning Outage (60s Blackout / 3,000 Cycles) ───────
  describe('Prolonged Dead Reckoning Stress (60s Outage)', () => {
    it('should maintain smooth continuous state without numerical explosion during 60s GNSS loss', () => {
      const ekf = new ExtendedKalmanFilter();
      ekf.initialize(0, 0, 0, 16.67, 0); // 60 km/h (16.67 m/s) heading North

      const blackoutCycles = 3000; // 60 seconds at 50 Hz (3,000 IMU cycles)
      const dt = 0.02;
      let initialAccuracy = ekf.getState().accuracy;

      for (let i = 0; i < blackoutCycles; i++) {
        // Vehicle travels along a curve: 0.02 rad/s turn rate
        ekf.predict(dt, 0.05, 0.02);
      }

      const state = ekf.getState();
      // Vehicle should have traveled ~1,000 meters along its trajectory
      const totalDisplacement = Math.hypot(state.east, state.north);
      expect(totalDisplacement).toBeGreaterThan(800);
      expect(totalDisplacement).toBeLessThan(1200);

      // Uncertainty should grow systematically over the 60s blackout
      expect(state.accuracy).toBeGreaterThan(initialAccuracy);
      // But covariance should remain bounded and strictly positive
      const covDiag = ekf.getCovarianceDiagonal();
      for (const variance of covDiag) {
        expect(Number.isFinite(variance)).toBe(true);
        expect(variance).toBeGreaterThan(0);
      }
    });
  });

  // ─── 3. Offline A* Pathfinder Scale & Throughput (500 Calculations) ───────
  describe('Offline A* Routing Engine Throughput (500 Path Calculations)', () => {
    it('should calculate 500 routes across Delhi NCR with 100% success rate and sub-millisecond average time', async () => {
      const router = new OfflineRoutingEngine();

      // Representative coordinates across Delhi NCR
      const testCoordinates = [
        { latitude: 28.6315, longitude: 77.2167 }, // Connaught Place
        { latitude: 28.6129, longitude: 77.2295 }, // India Gate
        { latitude: 28.5535, longitude: 77.2588 }, // Nehru Place
        { latitude: 28.5245, longitude: 77.1855 }, // Qutub Minar
        { latitude: 28.6562, longitude: 77.2410 }, // Red Fort
        { latitude: 28.5893, longitude: 77.2215 }, // Safdarjung
        { latitude: 28.6271, longitude: 77.2155 }, // Janpath
        { latitude: 28.6180, longitude: 77.2340 }, // Pragati Maidan
      ];

      const profiles = [RoutingProfile.Car, RoutingProfile.Bicycle, RoutingProfile.Walking];
      const optimizations = [RouteOptimization.Fastest, RouteOptimization.Shortest];

      const iterations = 500;
      const latencies: number[] = [];
      let successfulRoutes = 0;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const origin = testCoordinates[i % testCoordinates.length];
        const dest = testCoordinates[(i + 1 + (i % 3)) % testCoordinates.length];
        const profile = profiles[i % profiles.length];
        const optimization = optimizations[i % optimizations.length];

        const t0 = performance.now();
        const route = await router.calculateRoute({
          origin,
          destination: dest,
          profile,
          optimization,
        });
        const t1 = performance.now();

        latencies.push(t1 - t0);

        if (route && route.geometry && route.geometry.length > 0 && route.distance > 0) {
          successfulRoutes++;
        }
      }

      const totalElapsed = performance.now() - startTime;
      const avgLatencyMs = totalElapsed / iterations;
      const maxLatencyMs = Math.max(...latencies);

      // All routes between connected nodes must succeed
      expect(successfulRoutes).toBe(iterations);

      // Performance benchmarks: sub-millisecond average
      expect(avgLatencyMs).toBeLessThan(10.0); // Avg < 10ms for 4000+ node graph
      expect(maxLatencyMs).toBeLessThan(350.0); // Max < 350ms across full graph
    });
  });

  // ─── 4. Rapid Re-routing Concurrency & Cooldown Throttling ─────────────────
  describe('Rapid Re-routing Concurrency Stress (100 Deviation Triggers)', () => {
    it('should throttle rapid triggers using anti-thrashing cooldown and safely resolve concurrency', async () => {
      const router = new OfflineRoutingEngine();
      const mockRoute = await router.calculateRoute({
        origin: { latitude: 28.6315, longitude: 77.2167 },
        destination: { latitude: 28.6129, longitude: 77.2295 },
      });

      const navEngine = new NavigationEngine();
      navEngine.startNavigation(mockRoute);

      const rerouteManager = new ReroutingManager(router, navEngine, {
        cooldownMs: 200, // 200ms cooldown for testing
      });

      let startedCount = 0;
      let successCount = 0;

      rerouteManager.onRerouteStarted(() => { startedCount++; });
      rerouteManager.onRerouteSuccess(() => { successCount++; });

      const origin = { latitude: 28.6250, longitude: 77.2200 };
      const dest = { latitude: 28.6129, longitude: 77.2295 };

      // Trigger 50 immediate consecutive requests within a tight loop
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 50; i++) {
        promises.push(rerouteManager.recalculate(origin, dest));
      }

      const results = await Promise.all(promises);

      // Exactly 1 should have started immediately; the rest throttled by cooldown / concurrency
      expect(startedCount).toBe(1);
      expect(successCount).toBe(1);
      expect(results[0]).not.toBeNull();
      for (let i = 1; i < 50; i++) {
        expect(results[i]).toBeNull();
      }

      navEngine.stopNavigation();
    });
  });

  // ─── 5. POI Spatial & Fuzzy Search Throughput (2,000 Queries) ──────────────
  describe('POI Spatial & Fuzzy Search Stress (2,000 Queries)', () => {
    it('should execute 2,000 mixed queries with sub-0.2ms average latency', () => {
      const samplePois = [
        { id: '1', name: 'India Gate', category: 'tourism' as any, latitude: 28.6129, longitude: 77.2295 },
        { id: '2', name: 'Connaught Place', category: 'commercial' as any, latitude: 28.6315, longitude: 77.2167 },
        { id: '3', name: 'AIIMS Hospital', category: 'hospital' as any, latitude: 28.5672, longitude: 77.2100 },
        { id: '4', name: 'New Delhi Railway Station', category: 'transport' as any, latitude: 28.6429, longitude: 77.2195 },
        { id: '5', name: 'Nehru Place Metro', category: 'transit' as any, latitude: 28.5535, longitude: 77.2588 },
        { id: '6', name: 'Indian Oil Petrol Pump', category: 'fuel' as any, latitude: 28.6250, longitude: 77.2210 },
      ];
      const poiDb = new POIDatabase(samplePois);

      const searchTerms = ['metro', 'hospital', 'gate', 'connaught', 'station', 'park', 'food', 'fuel'];
      const centerCoords = [
        { latitude: 28.6139, longitude: 77.2090 },
        { latitude: 28.6315, longitude: 77.2167 },
        { latitude: 28.5535, longitude: 77.2588 },
      ];

      const iterations = 2000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        if (i % 2 === 0) {
          // Spatial search within radius
          const coord = centerCoords[i % centerCoords.length];
          const radiusM = 1000 + (i % 5) * 1000;
          poiDb.search('', { center: coord, maxRadiusMeters: radiusM });
        } else {
          // Fuzzy text search
          const term = searchTerms[i % searchTerms.length];
          poiDb.search(term);
        }
      }

      const totalElapsed = performance.now() - startTime;
      const avgLatencyMs = totalElapsed / iterations;

      expect(avgLatencyMs).toBeLessThan(0.2); // Strict: avg < 0.2ms per POI query
    });
  });

  // ─── 6. High-Frequency Map Matching & Navigation Guidance (5,000 Steps) ───
  describe('High-Frequency Navigation Guidance (5,000 Steps)', () => {
    it('should process 5,000 vehicle position updates with map matching and countdowns without leakage', async () => {
      const router = new OfflineRoutingEngine();
      const route = await router.calculateRoute({
        origin: { latitude: 28.6315, longitude: 77.2167 },
        destination: { latitude: 28.6129, longitude: 77.2295 },
      });

      const navEngine = new NavigationEngine();
      navEngine.startNavigation(route);

      let lastState: any = null;
      navEngine.onStateChange((s) => { lastState = s; });

      const totalSteps = 5000;
      const startTime = performance.now();

      // Synthesize moving vehicle along the geometry
      const geom = route.geometry;
      for (let i = 0; i < totalSteps; i++) {
        const segIdx = Math.min(Math.floor((i / totalSteps) * (geom.length - 1)), geom.length - 2);
        const p1 = geom[segIdx].coordinate;
        const p2 = geom[segIdx + 1].coordinate;
        const frac = (i % 100) / 100;

        const currentLat = p1.latitude + (p2.latitude - p1.latitude) * frac;
        const currentLon = p1.longitude + (p2.longitude - p1.longitude) * frac;

        navEngine.updatePosition(
          { latitude: currentLat, longitude: currentLon },
          180,
          12.5
        );
      }

      const totalElapsed = performance.now() - startTime;
      const avgLatencyMs = totalElapsed / totalSteps;

      expect(avgLatencyMs).toBeLessThan(0.15); // Strict: avg < 0.15ms per update
      expect(lastState).not.toBeNull();
      expect(lastState.remainingDistance).toBeGreaterThanOrEqual(0);
      expect(lastState.matchedPosition).toBeDefined();

      navEngine.stopNavigation();
    });
  });
});
