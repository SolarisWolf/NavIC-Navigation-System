/**
 * @navic/routing-core — Offline Routing Engine
 *
 * Core offline routing engine. Snaps coordinates to the topological
 * road network, computes optimal paths with A*, generates turn-by-turn
 * maneuvers, and provides optional delegation to local GraphHopper instances.
 */

import {
  type Coordinate,
  type Route,
  type RoutePoint,
  type NavigationInstruction,
  RoutingProfile,
  RouteOptimization,
  ManeuverType,
  haversineDistance,
  calculateBearing,
  Logger,
} from '@navic/shared-models';
import { RoadGraph } from '../graph/road-graph.js';
import { buildBangaloreRoadGraph } from '../graph/bangalore-network.js';
import { AStarRouter } from './astar-router.js';
import { InstructionGenerator } from './instruction-generator.js';

export interface RouteRequest {
  readonly origin: Coordinate;
  readonly destination: Coordinate;
  readonly profile?: RoutingProfile;
  readonly optimization?: RouteOptimization;
}

export interface RoutingEngineOptions {
  readonly graph?: RoadGraph;
  readonly graphhopperUrl?: string;
  readonly enableGraphhopperFallback?: boolean;
}

export class OfflineRoutingEngine {
  private logger = new Logger('OfflineRoutingEngine');
  private graph: RoadGraph;
  private graphhopperUrl: string | null = null;
  private enableGraphhopperFallback = false;

  constructor(options?: RoutingEngineOptions) {
    this.graph = options?.graph ?? buildBangaloreRoadGraph();
    this.graphhopperUrl = options?.graphhopperUrl ?? null;
    this.enableGraphhopperFallback = options?.enableGraphhopperFallback ?? false;

    this.logger.info(
      `Initialized with ${this.graph.nodeCount()} nodes and ${this.graph.edgeCount()} road edges`
    );
  }

  public getGraph(): RoadGraph {
    return this.graph;
  }

  /**
   * Calculates a turn-by-turn route between origin and destination.
   * Runs 100% offline via the embedded topological road graph and A* pathfinder.
   */
  public async calculateRoute(request: RouteRequest): Promise<Route> {
    const startTime = Date.now();
    const profile = request.profile ?? RoutingProfile.Car;
    const optimization = request.optimization ?? RouteOptimization.Fastest;

    // Optional local GraphHopper check
    if (this.enableGraphhopperFallback && this.graphhopperUrl) {
      try {
        const ghRoute = await this.tryQueryGraphhopper(request.origin, request.destination, profile, optimization);
        if (ghRoute) {
          this.logger.info(`Route computed via local GraphHopper in ${Date.now() - startTime}ms`);
          return ghRoute;
        }
      } catch {
        this.logger.warn('GraphHopper unavailable; using embedded offline road graph');
      }
    }

    // 1. Connect origin and destination to nearest road network vertices
    const startNode = this.graph.snapOrCreateAccessNode(request.origin, 'orig');
    const targetNode = this.graph.snapOrCreateAccessNode(request.destination, 'dest');

    // 2. Perform A* pathfinding
    const result = AStarRouter.findPath(
      this.graph,
      startNode.id,
      targetNode.id,
      profile,
      optimization
    );

    if (!result) {
      this.logger.warn(
        `No graph path between origin [${request.origin.latitude.toFixed(4)}, ${request.origin.longitude.toFixed(4)}] and destination [${request.destination.latitude.toFixed(4)}, ${request.destination.longitude.toFixed(4)}]; using resilient fallback route`
      );
      return this.generateDirectFallbackRoute(request, profile, optimization, startTime);
    }

    // 3. Generate Turn-by-Turn Maneuvers & Full Polyline Geometry
    const { instructions, geometry } = InstructionGenerator.generateInstructions(
      result.edges,
      request.origin,
      request.destination
    );

    const elapsedMs = Date.now() - startTime;
    this.logger.info(
      `Route calculated in ${elapsedMs}ms: ${(result.totalDistanceMeters / 1000).toFixed(2)} km, ` +
      `${Math.round(result.totalTimeSeconds / 60)} min, ${instructions.length} maneuvers`
    );

    const route: Route = {
      id: `route_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      origin: request.origin,
      destination: request.destination,
      distance: result.totalDistanceMeters,
      estimatedTime: result.totalTimeSeconds,
      geometry,
      instructions,
      profile,
      optimization,
      calculatedAt: Date.now(),
    };

    return route;
  }

  /**
   * Calculates up to 3 route alternatives (Fastest, Shortest, Balanced).
   */
  public async calculateRouteAlternatives(request: RouteRequest): Promise<Route[]> {
    const primaryRoute = await this.calculateRoute({
      ...request,
      optimization: RouteOptimization.Fastest,
    });

    const shortestRoute = await this.calculateRoute({
      ...request,
      optimization: RouteOptimization.Shortest,
    });

    const routes = [primaryRoute];
    if (shortestRoute && Math.abs(shortestRoute.distance - primaryRoute.distance) > 40) {
      routes.push(shortestRoute);
    }
    return routes;
  }

  /**
   * Attempts to query a local GraphHopper instance if configured.
   */
  private async tryQueryGraphhopper(
    origin: Coordinate,
    destination: Coordinate,
    profile: RoutingProfile,
    optimization: RouteOptimization
  ): Promise<Route | null> {
    if (!this.graphhopperUrl) return null;

    const ghVehicle = profile === RoutingProfile.Car ? 'car' : profile === RoutingProfile.Bicycle ? 'bike' : 'foot';
    const ghWeighting = optimization === RouteOptimization.Fastest ? 'fastest' : 'shortest';

    const url = new URL(this.graphhopperUrl);
    url.searchParams.append('point', `${origin.latitude},${origin.longitude}`);
    url.searchParams.append('point', `${destination.latitude},${destination.longitude}`);
    url.searchParams.append('profile', ghVehicle);
    url.searchParams.append('weighting', ghWeighting);
    url.searchParams.append('points_encoded', 'false');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return null;

    const data = await res.json() as any;
    if (!data.paths || data.paths.length === 0) return null;

    const path = data.paths[0];
    const coords: [number, number][] = path.points.coordinates;

    const geometry = coords.map((c, i) => ({
      coordinate: { latitude: c[1], longitude: c[0] },
      distanceFromStart: Math.round((path.distance * (i / coords.length))),
    }));

    return {
      id: `gh_${Date.now()}`,
      origin,
      destination,
      distance: Math.round(path.distance),
      estimatedTime: Math.round(path.time / 1000),
      geometry,
      instructions: [],
      profile,
      optimization,
      calculatedAt: Date.now(),
    };
  }

  /**
   * Generates a direct corridor route with turn maneuvers when coordinates are
   * outside the offline topological road graph (e.g. outside Delhi).
   */
  private generateDirectFallbackRoute(
    request: RouteRequest,
    profile: RoutingProfile,
    optimization: RouteOptimization,
    startTime: number
  ): Route {
    const distMeters = Math.max(
      10,
      Math.round(
        haversineDistance(
          request.origin.latitude,
          request.origin.longitude,
          request.destination.latitude,
          request.destination.longitude
        )
      )
    );

    const speedMs =
      profile === RoutingProfile.Car
        ? 11.1 // ~40 km/h
        : profile === RoutingProfile.Bicycle
        ? 4.2 // ~15 km/h
        : 1.4; // ~5 km/h
    const estimatedTime = Math.max(1, Math.round(distMeters / speedMs));

    const bearing = Math.round(
      calculateBearing(
        request.origin.latitude,
        request.origin.longitude,
        request.destination.latitude,
        request.destination.longitude
      )
    );

    const numPoints = Math.min(25, Math.max(4, Math.ceil(distMeters / 100)));
    const geometry: RoutePoint[] = [];

    for (let i = 0; i <= numPoints; i++) {
      const frac = i / numPoints;
      const lat =
        request.origin.latitude +
        (request.destination.latitude - request.origin.latitude) * frac;
      const lon =
        request.origin.longitude +
        (request.destination.longitude - request.origin.longitude) * frac;
      geometry.push({
        coordinate: { latitude: lat, longitude: lon },
        roadName: frac < 0.5 ? 'Current Road' : 'Approaching Destination',
        distanceFromStart: Math.round(distMeters * frac),
      });
    }

    const instructions: NavigationInstruction[] = [
      {
        maneuver: ManeuverType.Depart,
        distanceFromStart: 0,
        distanceToNext: distMeters,
        roadName: 'Main Road',
        description: `Head toward destination (${bearing}°)`,
        coordinate: request.origin,
      },
      {
        maneuver: ManeuverType.Arrive,
        distanceFromStart: distMeters,
        distanceToNext: 0,
        roadName: 'Destination',
        description: 'Arrive at destination',
        coordinate: request.destination,
      },
    ];

    const elapsedMs = Date.now() - startTime;
    this.logger.info(
      `Synthesized fallback route in ${elapsedMs}ms: ${(distMeters / 1000).toFixed(2)} km, ` +
        `${Math.round(estimatedTime / 60)} min`
    );

    return {
      id: `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      origin: request.origin,
      destination: request.destination,
      distance: distMeters,
      estimatedTime,
      geometry,
      instructions,
      profile,
      optimization,
      calculatedAt: Date.now(),
    };
  }
}
