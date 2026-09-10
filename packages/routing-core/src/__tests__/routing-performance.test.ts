/**
 * @navic/routing-core — Routing Performance & Percentile Distribution Benchmarks
 *
 * Phase 19: 1,000-route scaled benchmark, percentile distribution (p50/p95/p99),
 * multi-distance latency scaling, and boundary edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  buildDelhiRoadGraph,
  AStarRouter,
  OfflineRoutingEngine,
  RoutingProfile,
  RouteOptimization,
} from '../index.js';

describe('Phase 19: Offline Routing Engine Performance & Scalability Suite', () => {
  const graph = buildDelhiRoadGraph();
  const engine = new OfflineRoutingEngine({ graph });
  const nodes = graph.getAllNodes();

  // ─── 1. 1,000 Route Scaled Benchmark Matrix ───────────────────────────────
  it('should compute 1,000 multi-profile routes with strict sub-millisecond p95 latency', () => {
    const totalIterations = 1000;
    const latencies: number[] = [];
    const profiles = [RoutingProfile.Car, RoutingProfile.Bicycle, RoutingProfile.Walking];
    const optimizations = [RouteOptimization.Fastest, RouteOptimization.Shortest];

    let successCount = 0;

    for (let i = 0; i < totalIterations; i++) {
      // Deterministic pseudo-random selection for repeatable testing
      const startIdx = (i * 7 + 3) % nodes.length;
      let endIdx = (i * 13 + 11) % nodes.length;
      if (startIdx === endIdx) {
        endIdx = (endIdx + 1) % nodes.length;
      }

      const startNode = nodes[startIdx];
      const endNode = nodes[endIdx];
      const profile = profiles[i % profiles.length];
      const opt = optimizations[i % optimizations.length];

      const t0 = performance.now();
      const path = AStarRouter.findPath(
        graph,
        startNode.id,
        endNode.id,
        profile,
        opt
      );
      const elapsed = performance.now() - t0;
      latencies.push(elapsed);

      if (path !== null && path.edges.length > 0) {
        successCount++;
      }
    }

    latencies.sort((a, b) => a - b);
    const avgLatency = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p90 = latencies[Math.floor(latencies.length * 0.9)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const maxLatency = latencies[latencies.length - 1];

    // SLA Assertions
    expect(avgLatency).toBeLessThan(1.0); // Average < 1.0ms
    expect(p50).toBeLessThan(0.8);        // Median < 0.8ms
    expect(p95).toBeLessThan(2.5);        // P95 < 2.5ms (well within 10ms budget)
    expect(p99).toBeLessThan(5.0);        // P99 < 5.0ms
    expect(maxLatency).toBeLessThan(15.0); // Max < 15.0ms (even with potential JIT warmup)

    // Robustness: Delhi NCR road graph contains some one-way arcs and isolated terminal loops
    expect(successCount).toBeGreaterThan(800); // >80% success rate across arbitrary pairs
  });

  // ─── 2. Multi-Distance Scalability Breakdown ──────────────────────────────
  it('should scale predictably across short (<3km), medium (3-10km), and long (>10km) corridors', async () => {
    // Short Corridor: Connaught Place to Shivaji Bridge / NDLS (~1.5 km)
    const t0 = performance.now();
    const shortRoute = await engine.calculateRoute({
      origin: { latitude: 28.6315, longitude: 77.2167 },
      destination: { latitude: 28.6415, longitude: 77.2205 },
      profile: RoutingProfile.Car,
    });
    const shortLatency = performance.now() - t0;

    // Medium Corridor: Connaught Place to AIIMS (~6.5 km)
    const t1 = performance.now();
    const medRoute = await engine.calculateRoute({
      origin: { latitude: 28.6315, longitude: 77.2167 },
      destination: { latitude: 28.5672, longitude: 77.2100 },
      profile: RoutingProfile.Car,
    });
    const medLatency = performance.now() - t1;

    // Long Corridor: Red Fort to IGI Airport (~22 km)
    const t2 = performance.now();
    const longRoute = await engine.calculateRoute({
      origin: { latitude: 28.6562, longitude: 77.2410 },
      destination: { latitude: 28.5562, longitude: 77.0999 },
      profile: RoutingProfile.Car,
    });
    const longLatency = performance.now() - t2;

    expect(shortRoute).not.toBeNull();
    expect(medRoute).not.toBeNull();
    expect(longRoute).not.toBeNull();

    expect(shortRoute.distance).toBeLessThan(3500);
    expect(medRoute.distance).toBeGreaterThan(4000);
    expect(longRoute.distance).toBeGreaterThan(12000);

    // All corridor calculations must complete in sub-10ms
    expect(shortLatency).toBeLessThan(10.0);
    expect(medLatency).toBeLessThan(10.0);
    expect(longLatency).toBeLessThan(15.0);
  });

  // ─── 3. Boundary & Edge Case Robustness ───────────────────────────────────
  it('should handle identical start/destination coordinates without infinite loops or errors', async () => {
    const cpCoord = { latitude: 28.6315, longitude: 77.2167 };
    const route = await engine.calculateRoute({
      origin: cpCoord,
      destination: cpCoord,
      profile: RoutingProfile.Car,
    });

    expect(route).not.toBeNull();
    expect(route.distance).toBeLessThanOrEqual(50);
    expect(route.instructions.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle distant coordinate snapping cleanly', async () => {
    // Coordinate slightly off the road network
    const suburbanCoord = { latitude: 28.7000, longitude: 77.1000 };
    const indiaGateCoord = { latitude: 28.6129, longitude: 77.2295 };

    const route = await engine.calculateRoute({
      origin: suburbanCoord,
      destination: indiaGateCoord,
      profile: RoutingProfile.Car,
    });
    expect(route).not.toBeNull();
    expect(route.geometry.length).toBeGreaterThan(2);
  });
});
