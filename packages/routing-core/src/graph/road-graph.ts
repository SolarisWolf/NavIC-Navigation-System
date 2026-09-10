/**
 * @navic/routing-core — Road Network Graph
 *
 * In-memory spatial graph representation of road networks.
 * Supports nodes, directed edges, profile speed mappings,
 * one-way restrictions, and spatial nearest-node snapping.
 */

import {
  type Coordinate,
  RoutingProfile,
  haversineDistance,
  calculateBearing,
} from '@navic/shared-models';

export type RoadType =
  | 'motorway'
  | 'trunk'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'residential'
  | 'service'
  | 'cycleway'
  | 'footway';

export interface RoadNode {
  readonly id: string;
  readonly coordinate: Coordinate;
  readonly name?: string;
  readonly edgeIds: string[];
}

export interface RoadEdge {
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly roadName: string;
  readonly roadType: RoadType;
  readonly lengthMeters: number;
  readonly speedKmh: Record<RoutingProfile, number>;
  readonly oneWay: boolean;
  readonly geometry: Coordinate[];
}

export class RoadGraph {
  private nodes: Map<string, RoadNode> = new Map();
  private edges: Map<string, RoadEdge> = new Map();

  public addNode(id: string, coordinate: Coordinate, name?: string): RoadNode {
    const existing = this.nodes.get(id);
    if (existing) return existing;

    const node: RoadNode = {
      id,
      coordinate,
      name,
      edgeIds: [],
    };
    this.nodes.set(id, node);
    return node;
  }

  public addEdge(params: {
    id: string;
    fromNodeId: string;
    toNodeId: string;
    roadName: string;
    roadType?: RoadType;
    speedKmh?: Partial<Record<RoutingProfile, number>>;
    oneWay?: boolean;
    geometry?: Coordinate[];
  }): RoadEdge {
    const fromNode = this.nodes.get(params.fromNodeId);
    const toNode = this.nodes.get(params.toNodeId);

    if (!fromNode || !toNode) {
      throw new Error(`Cannot create edge ${params.id}: node ${params.fromNodeId} or ${params.toNodeId} not found`);
    }

    const roadType = params.roadType ?? 'secondary';
    const lengthMeters = Math.max(
      1,
      haversineDistance(
        fromNode.coordinate.latitude,
        fromNode.coordinate.longitude,
        toNode.coordinate.latitude,
        toNode.coordinate.longitude
      )
    );

    const defaultSpeeds: Record<RoutingProfile, number> = this.getDefaultSpeeds(roadType);
    const speedKmh: Record<RoutingProfile, number> = {
      [RoutingProfile.Car]: params.speedKmh?.car ?? defaultSpeeds.car,
      [RoutingProfile.Bicycle]: params.speedKmh?.bicycle ?? defaultSpeeds.bicycle,
      [RoutingProfile.Walking]: params.speedKmh?.walking ?? defaultSpeeds.walking,
    };

    const geometry = params.geometry && params.geometry.length > 0
      ? params.geometry
      : [fromNode.coordinate, toNode.coordinate];

    const edge: RoadEdge = {
      id: params.id,
      fromNodeId: params.fromNodeId,
      toNodeId: params.toNodeId,
      roadName: params.roadName,
      roadType,
      lengthMeters,
      speedKmh,
      oneWay: params.oneWay ?? false,
      geometry,
    };

    this.edges.set(edge.id, edge);
    fromNode.edgeIds.push(edge.id);

    // If bidirectional, register reverse edge if not oneWay
    if (!edge.oneWay) {
      const revId = `${params.id}_rev`;
      const revEdge: RoadEdge = {
        id: revId,
        fromNodeId: params.toNodeId,
        toNodeId: params.fromNodeId,
        roadName: params.roadName,
        roadType,
        lengthMeters,
        speedKmh,
        oneWay: false,
        geometry: [...geometry].reverse(),
      };
      this.edges.set(revId, revEdge);
      toNode.edgeIds.push(revId);
    }

    return edge;
  }

  public getNode(id: string): RoadNode | undefined {
    return this.nodes.get(id);
  }

  public getEdge(id: string): RoadEdge | undefined {
    return this.edges.get(id);
  }

  public getAllNodes(): readonly RoadNode[] {
    return Array.from(this.nodes.values());
  }

  public getAllEdges(): readonly RoadEdge[] {
    return Array.from(this.edges.values());
  }

  public nodeCount(): number {
    return this.nodes.size;
  }

  public edgeCount(): number {
    return this.edges.size;
  }

  /**
   * Finds the nearest road graph node to an arbitrary coordinate.
   */
  public findNearestNode(coord: Coordinate, maxDistanceMeters = 50000): { node: RoadNode; distance: number } | null {
    let bestNode: RoadNode | null = null;
    let minDistance = Infinity;

    for (const node of this.nodes.values()) {
      const d = haversineDistance(
        coord.latitude,
        coord.longitude,
        node.coordinate.latitude,
        node.coordinate.longitude
      );
      if (d < minDistance) {
        minDistance = d;
        bestNode = node;
      }
    }

    if (bestNode && minDistance <= maxDistanceMeters) {
      return { node: bestNode, distance: minDistance };
    }
    return null;
  }

  /**
   * Connects a dynamic coordinate (e.g. vehicle or POI) to the graph.
   * If the nearest node is within tolerance, returns that node.
   * Otherwise adds a temporary/access node and bidirectional connector edge.
   */
  public snapOrCreateAccessNode(coord: Coordinate, prefix: string): RoadNode {
    const nearest = this.findNearestNode(coord);
    if (nearest && nearest.distance < 40) {
      return nearest.node;
    }

    const accessNodeId = `${prefix}_${coord.latitude.toFixed(5)}_${coord.longitude.toFixed(5)}`;
    const existing = this.nodes.get(accessNodeId);
    if (existing) return existing;

    const accessNode = this.addNode(accessNodeId, coord, `${prefix} Access`);
    if (nearest) {
      this.addEdge({
        id: `conn_${accessNodeId}_${nearest.node.id}`,
        fromNodeId: accessNode.id,
        toNodeId: nearest.node.id,
        roadName: 'Access Road',
        roadType: 'service',
        oneWay: false,
      });
    }
    return accessNode;
  }

  private getDefaultSpeeds(type: RoadType): Record<RoutingProfile, number> {
    switch (type) {
      case 'motorway':
        return { [RoutingProfile.Car]: 80, [RoutingProfile.Bicycle]: 0, [RoutingProfile.Walking]: 0 };
      case 'trunk':
        return { [RoutingProfile.Car]: 65, [RoutingProfile.Bicycle]: 12, [RoutingProfile.Walking]: 4.5 };
      case 'primary':
        return { [RoutingProfile.Car]: 50, [RoutingProfile.Bicycle]: 15, [RoutingProfile.Walking]: 4.8 };
      case 'secondary':
        return { [RoutingProfile.Car]: 40, [RoutingProfile.Bicycle]: 18, [RoutingProfile.Walking]: 5.0 };
      case 'tertiary':
        return { [RoutingProfile.Car]: 30, [RoutingProfile.Bicycle]: 20, [RoutingProfile.Walking]: 5.0 };
      case 'residential':
      case 'service':
        return { [RoutingProfile.Car]: 25, [RoutingProfile.Bicycle]: 18, [RoutingProfile.Walking]: 5.0 };
      case 'cycleway':
        return { [RoutingProfile.Car]: 0, [RoutingProfile.Bicycle]: 22, [RoutingProfile.Walking]: 5.0 };
      case 'footway':
        return { [RoutingProfile.Car]: 0, [RoutingProfile.Bicycle]: 8, [RoutingProfile.Walking]: 5.0 };
    }
  }
}
