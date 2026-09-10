/**
 * @navic/routing-core — Routing Engine Unit & Benchmark Tests
 */

import { describe, it, expect } from 'vitest';
import {
  RoadGraph,
  buildDelhiRoadGraph,
  AStarRouter,
  InstructionGenerator,
  OfflineRoutingEngine,
  RoutingProfile,
  RouteOptimization,
  ManeuverType,
} from '../index.js';

describe('RoadGraph', () => {
  it('should construct nodes and bidirectional edges properly', () => {
    const g = new RoadGraph();
    g.addNode('A', { latitude: 28.6139, longitude: 77.2090 }, 'Node A');
    g.addNode('B', { latitude: 28.6200, longitude: 77.2100 }, 'Node B');

    g.addEdge({
      id: 'e1',
      fromNodeId: 'A',
      toNodeId: 'B',
      roadName: 'Main St',
      roadType: 'primary',
      oneWay: false,
    });

    expect(g.nodeCount()).toBe(2);
    // 1 forward + 1 reverse edge
    expect(g.edgeCount()).toBe(2);

    const nearest = g.findNearestNode({ latitude: 28.6140, longitude: 77.2091 });
    expect(nearest).not.toBeNull();
    expect(nearest?.node.id).toBe('A');
    expect(nearest?.distance).toBeLessThan(50);
  });

  it('should initialize Delhi NCR road network with core corridors', () => {
    const delhi = buildDelhiRoadGraph();
    expect(delhi.nodeCount()).toBeGreaterThan(30);
    expect(delhi.edgeCount()).toBeGreaterThan(50);

    const cpNode = delhi.getNode('CP_INNER');
    expect(cpNode).toBeDefined();

    const aiimsNode = delhi.getNode('AIIMS_INTERCHANGE');
    expect(aiimsNode).toBeDefined();
  });
});

describe('AStarRouter', () => {
  const delhi = buildDelhiRoadGraph();

  it('should calculate shortest path between Connaught Place and AIIMS', () => {
    const result = AStarRouter.findPath(
      delhi,
      'CP_INNER',
      'AIIMS_INTERCHANGE',
      RoutingProfile.Car,
      RouteOptimization.Shortest
    );

    expect(result).not.toBeNull();
    expect(result!.edges.length).toBeGreaterThan(2);
    expect(result!.totalDistanceMeters).toBeGreaterThan(3000);
    expect(result!.totalDistanceMeters).toBeLessThan(12000);
    expect(result!.totalTimeSeconds).toBeGreaterThan(60);
  });

  it('should calculate fastest path between India Gate and IGI Airport Terminal 3', () => {
    const result = AStarRouter.findPath(
      delhi,
      'INDIA_GATE_HEX',
      'IGI_AIRPORT_T2_T3',
      RoutingProfile.Car,
      RouteOptimization.Fastest
    );

    expect(result).not.toBeNull();
    expect(result!.edges.length).toBeGreaterThan(3);
    // Traverses expressways and arterial corridors to airport
    expect(result!.totalDistanceMeters).toBeGreaterThan(10000);
    expect(result!.totalTimeSeconds).toBeGreaterThan(300);
  });

  it('should produce different travel times for Car vs Bicycle vs Walking', () => {
    const carPath = AStarRouter.findPath(
      delhi,
      'CP_INNER',
      'INDIA_GATE_HEX',
      RoutingProfile.Car,
      RouteOptimization.Fastest
    );

    const bikePath = AStarRouter.findPath(
      delhi,
      'CP_INNER',
      'INDIA_GATE_HEX',
      RoutingProfile.Bicycle,
      RouteOptimization.Fastest
    );

    const walkPath = AStarRouter.findPath(
      delhi,
      'CP_INNER',
      'INDIA_GATE_HEX',
      RoutingProfile.Walking,
      RouteOptimization.Fastest
    );

    expect(carPath).not.toBeNull();
    expect(bikePath).not.toBeNull();
    expect(walkPath).not.toBeNull();

    // Walking time > Bicycle time > Car time
    expect(walkPath!.totalTimeSeconds).toBeGreaterThan(bikePath!.totalTimeSeconds);
    expect(bikePath!.totalTimeSeconds).toBeGreaterThan(carPath!.totalTimeSeconds);
  });
});

describe('InstructionGenerator', () => {
  const delhi = buildDelhiRoadGraph();

  it('should generate Depart, Turn, and Arrive instructions', () => {
    const path = AStarRouter.findPath(
      delhi,
      'CP_INNER',
      'AIIMS_INTERCHANGE',
      RoutingProfile.Car,
      RouteOptimization.Fastest
    );

    expect(path).not.toBeNull();

    const origin = { latitude: 28.6328, longitude: 77.2197 };
    const destination = { latitude: 28.5680, longitude: 77.2100 };

    const { instructions, geometry } = InstructionGenerator.generateInstructions(
      path!.edges,
      origin,
      destination
    );

    expect(instructions.length).toBeGreaterThanOrEqual(3);
    expect(instructions[0].maneuver).toBe(ManeuverType.Depart);
    expect(instructions[instructions.length - 1].maneuver).toBe(ManeuverType.Arrive);

    // Verify distance monotonicity
    for (let i = 0; i < instructions.length - 1; i++) {
      expect(instructions[i + 1].distanceFromStart).toBeGreaterThanOrEqual(
        instructions[i].distanceFromStart
      );
      expect(instructions[i].distanceToNext).toBeGreaterThanOrEqual(0);
    }

    expect(geometry.length).toBeGreaterThan(instructions.length);
  });
});

describe('OfflineRoutingEngine', () => {
  it('should compute full route end-to-end between coordinates', async () => {
    const engine = new OfflineRoutingEngine();

    // India Gate to AIIMS Hospital
    const route = await engine.calculateRoute({
      origin: { latitude: 28.6129, longitude: 77.2295 },
      destination: { latitude: 28.5672, longitude: 77.2100 },
      profile: RoutingProfile.Car,
      optimization: RouteOptimization.Fastest,
    });

    expect(route).toBeDefined();
    expect(route.distance).toBeGreaterThan(4000);
    expect(route.distance).toBeLessThan(10000);
    expect(route.instructions.length).toBeGreaterThan(2);
    expect(route.geometry.length).toBeGreaterThanOrEqual(5);
    expect(route.profile).toBe(RoutingProfile.Car);
  });

  it('should execute route calculations in under 10 ms (benchmark)', async () => {
    const engine = new OfflineRoutingEngine();
    const origin = { latitude: 28.6328, longitude: 77.2197 };
    const destination = { latitude: 28.5550, longitude: 77.0850 }; // CP to IGI T3

    // Warm-up
    await engine.calculateRoute({ origin, destination });

    const iters = 20;
    const start = performance.now();
    for (let i = 0; i < iters; i++) {
      await engine.calculateRoute({ origin, destination });
    }
    const duration = performance.now() - start;
    const avgMs = duration / iters;

    expect(avgMs).toBeLessThan(10); // Must be under 10ms
  });
});
