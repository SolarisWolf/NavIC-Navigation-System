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

export interface NearestEdgeMatch {
  readonly edge: RoadEdge;
  readonly projectedCoordinate: Coordinate;
  readonly distanceMeters: number;
  readonly segmentIndex: number;
  readonly fraction: number;
}

export class RoadGraph {
  private nodes: Map<string, RoadNode> = new Map();
  private edges: Map<string, RoadEdge> = new Map();
  private spatialGrid: Map<string, string[]> = new Map();
  private spatialGridEdges: Map<string, string[]> = new Map();
  private readonly gridCellSize = 0.002; // ~200 meters grid cell

  private getGridKey(lat: number, lon: number): string {
    return `${Math.floor(lat / this.gridCellSize)}_${Math.floor(lon / this.gridCellSize)}`;
  }

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

    const key = this.getGridKey(coordinate.latitude, coordinate.longitude);
    let cell = this.spatialGrid.get(key);
    if (!cell) {
      cell = [];
      this.spatialGrid.set(key, cell);
    }
    cell.push(id);

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
    this.indexEdge(edge);

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
      this.indexEdge(revEdge);
    }

    return edge;
  }

  private indexEdge(edge: RoadEdge): void {
    const geo = edge.geometry;
    for (const pt of geo) {
      const key = this.getGridKey(pt.latitude, pt.longitude);
      let list = this.spatialGridEdges.get(key);
      if (!list) {
        list = [];
        this.spatialGridEdges.set(key, list);
      }
      if (!list.includes(edge.id)) {
        list.push(edge.id);
      }
    }
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
   * Uses spatial grid index for O(1) expected lookup, falling back to full scan if needed.
   */
  public findNearestNode(coord: Coordinate, maxDistanceMeters = 50000): { node: RoadNode; distance: number } | null {
    if (this.nodes.size === 0) return null;

    let bestNode: RoadNode | null = null;
    let minDistance = Infinity;

    // Use spatial grid lookup first
    const centerLatIdx = Math.floor(coord.latitude / this.gridCellSize);
    const centerLonIdx = Math.floor(coord.longitude / this.gridCellSize);
    const approxMetersPerCell = this.gridCellSize * 111000;
    const maxRings = Math.min(25, Math.ceil(maxDistanceMeters / approxMetersPerCell) + 1);

    for (let r = 0; r <= maxRings; r++) {
      for (let dLat = -r; dLat <= r; dLat++) {
        for (let dLon = -r; dLon <= r; dLon++) {
          if (Math.max(Math.abs(dLat), Math.abs(dLon)) !== r) continue;
          const cellKey = `${centerLatIdx + dLat}_${centerLonIdx + dLon}`;
          const cellNodeIds = this.spatialGrid.get(cellKey);
          if (!cellNodeIds) continue;

          for (const id of cellNodeIds) {
            const node = this.nodes.get(id);
            if (!node) continue;
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
        }
      }

      // Early exit condition: if we already found a node and the minimum possible distance
      // to the next ring exceeds minDistance, no further node can be closer.
      if (bestNode && r * approxMetersPerCell > minDistance) {
        break;
      }
    }

    // Fall back to full scan only if spatial search did not find any node within maxDistanceMeters
    // or if distance bounds weren't satisfied
    if (!bestNode && maxDistanceMeters > maxRings * approxMetersPerCell) {
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
    }

    if (bestNode && minDistance <= maxDistanceMeters) {
      return { node: bestNode, distance: minDistance };
    }
    return null;
  }

  /**
   * Finds the nearest road graph edge and perpendicular projection point to an arbitrary coordinate.
   */
  public findNearestEdge(coord: Coordinate, maxDistanceMeters = 200): NearestEdgeMatch | null {
    if (this.edges.size === 0) return null;

    let bestMatch: NearestEdgeMatch | null = null;
    let minDistance = Infinity;

    const centerLatIdx = Math.floor(coord.latitude / this.gridCellSize);
    const centerLonIdx = Math.floor(coord.longitude / this.gridCellSize);
    const approxMetersPerCell = this.gridCellSize * 111000;
    const maxRings = Math.min(10, Math.ceil(maxDistanceMeters / approxMetersPerCell) + 1);

    const checkedEdgeIds = new Set<string>();

    for (let r = 0; r <= maxRings; r++) {
      for (let dLat = -r; dLat <= r; dLat++) {
        for (let dLon = -r; dLon <= r; dLon++) {
          if (Math.max(Math.abs(dLat), Math.abs(dLon)) !== r) continue;
          const cellKey = `${centerLatIdx + dLat}_${centerLonIdx + dLon}`;
          const edgeIds = this.spatialGridEdges.get(cellKey);
          if (!edgeIds) continue;

          for (const edgeId of edgeIds) {
            if (checkedEdgeIds.has(edgeId)) continue;
            checkedEdgeIds.add(edgeId);

            const edge = this.edges.get(edgeId);
            if (!edge || edge.geometry.length < 2) continue;

            const geom = edge.geometry;
            for (let i = 0; i < geom.length - 1; i++) {
              const segA = geom[i];
              const segB = geom[i + 1];
              const proj = this.projectPointToSegment(coord, segA, segB);
              if (proj.distance < minDistance) {
                minDistance = proj.distance;
                bestMatch = {
                  edge,
                  projectedCoordinate: proj.projected,
                  distanceMeters: minDistance,
                  segmentIndex: i,
                  fraction: proj.fraction,
                };
              }
            }
          }
        }
      }

      if (bestMatch && r * approxMetersPerCell > minDistance) {
        break;
      }
    }

    if (bestMatch && minDistance <= maxDistanceMeters) {
      return bestMatch;
    }
    return null;
  }

  private projectPointToSegment(
    p: Coordinate,
    a: Coordinate,
    b: Coordinate
  ): { projected: Coordinate; distance: number; fraction: number } {
    const cosLat = Math.cos(((a.latitude + b.latitude) / 2) * (Math.PI / 180));
    const dx = (b.longitude - a.longitude) * 111320 * cosLat;
    const dy = (b.latitude - a.latitude) * 111000;
    const px = (p.longitude - a.longitude) * 111320 * cosLat;
    const py = (p.latitude - a.latitude) * 111000;

    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-6) {
      const dist = haversineDistance(p.latitude, p.longitude, a.latitude, a.longitude);
      return { projected: a, distance: dist, fraction: 0 };
    }

    let t = (px * dx + py * dy) / lenSq;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;

    const projLat = a.latitude + t * (b.latitude - a.latitude);
    const projLon = a.longitude + t * (b.longitude - a.longitude);
    const dist = haversineDistance(p.latitude, p.longitude, projLat, projLon);

    return {
      projected: { latitude: projLat, longitude: projLon },
      distance: dist,
      fraction: t,
    };
  }

  /**
   * Connects a dynamic coordinate (e.g. vehicle or POI) to the graph.
   * Prioritizes snapping directly onto the nearest road edge so that routing
   * begins along the true road instead of detouring to distant junction nodes.
   */
  public snapOrCreateAccessNode(coord: Coordinate, prefix: string): RoadNode {
    // 1. If very close to an existing junction node (< 25m), snap directly to it
    const nearestNode = this.findNearestNode(coord, 30);
    if (nearestNode && nearestNode.distance < 25) {
      return nearestNode.node;
    }

    // 2. Project onto nearest road edge
    const nearestEdgeMatch = this.findNearestEdge(coord, 100);
    if (nearestEdgeMatch && nearestEdgeMatch.distanceMeters < 100) {
      const edge = nearestEdgeMatch.edge;
      const proj = nearestEdgeMatch.projectedCoordinate;

      const fromNode = this.nodes.get(edge.fromNodeId);
      const toNode = this.nodes.get(edge.toNodeId);

      if (fromNode) {
        const dFrom = haversineDistance(proj.latitude, proj.longitude, fromNode.coordinate.latitude, fromNode.coordinate.longitude);
        if (dFrom < 20) return fromNode;
      }
      if (toNode) {
        const dTo = haversineDistance(proj.latitude, proj.longitude, toNode.coordinate.latitude, toNode.coordinate.longitude);
        if (dTo < 20) return toNode;
      }

      const accessNodeId = `${prefix}_${proj.latitude.toFixed(5)}_${proj.longitude.toFixed(5)}`;
      const existing = this.nodes.get(accessNodeId);
      if (existing) return existing;

      const accessNode = this.addNode(accessNodeId, proj, edge.roadName);

      // Connect accessNode to toNode (forward path)
      if (toNode) {
        const forwardGeom = [proj, ...edge.geometry.slice(nearestEdgeMatch.segmentIndex + 1)];
        if (forwardGeom.length < 2) forwardGeom.push(toNode.coordinate);
        this.addEdge({
          id: `conn_${accessNodeId}_fwd_${toNode.id}`,
          fromNodeId: accessNode.id,
          toNodeId: toNode.id,
          roadName: edge.roadName,
          roadType: edge.roadType,
          speedKmh: edge.speedKmh,
          oneWay: edge.oneWay,
          geometry: forwardGeom,
        });
      }

      // If bidirectional road, connect accessNode to fromNode (reverse path)
      if (!edge.oneWay && fromNode) {
        const revGeom = [proj, ...edge.geometry.slice(0, nearestEdgeMatch.segmentIndex + 1).reverse()];
        if (revGeom.length < 2) revGeom.push(fromNode.coordinate);
        this.addEdge({
          id: `conn_${accessNodeId}_rev_${fromNode.id}`,
          fromNodeId: accessNode.id,
          toNodeId: fromNode.id,
          roadName: edge.roadName,
          roadType: edge.roadType,
          speedKmh: edge.speedKmh,
          oneWay: false,
          geometry: revGeom,
        });
      }

      // Also allow reaching accessNode from fromNode
      if (fromNode) {
        const leadGeom = [...edge.geometry.slice(0, nearestEdgeMatch.segmentIndex + 1), proj];
        if (leadGeom.length < 2) leadGeom.unshift(fromNode.coordinate);
        this.addEdge({
          id: `conn_${fromNode.id}_fwd_${accessNodeId}`,
          fromNodeId: fromNode.id,
          toNodeId: accessNode.id,
          roadName: edge.roadName,
          roadType: edge.roadType,
          speedKmh: edge.speedKmh,
          oneWay: edge.oneWay,
          geometry: leadGeom,
        });
      }

      return accessNode;
    }

    // 3. Fallback to nearest node
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
        roadName: nearest.node.name || 'Access Road',
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
