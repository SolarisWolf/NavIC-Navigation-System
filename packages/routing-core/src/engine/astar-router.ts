/**
 * @navic/routing-core — A* Pathfinding Router
 *
 * Implements the A* heuristic shortest/fastest path algorithm
 * on the RoadGraph, respecting profile restrictions (Car, Bicycle, Walking)
 * and optimization targets (Fastest vs Shortest).
 */

import {
  type Coordinate,
  RoutingProfile,
  RouteOptimization,
  haversineDistance,
} from '@navic/shared-models';
import { RoadGraph, RoadNode, RoadEdge } from '../graph/road-graph.js';

export interface AStarResult {
  readonly edges: readonly RoadEdge[];
  readonly totalDistanceMeters: number;
  readonly totalTimeSeconds: number;
  readonly nodes: readonly RoadNode[];
}

interface PriorityQueueNode {
  readonly nodeId: string;
  readonly priority: number;
}

class MinPriorityQueue {
  private items: PriorityQueueNode[] = [];

  public push(nodeId: string, priority: number): void {
    this.items.push({ nodeId, priority });
    this.bubbleUp(this.items.length - 1);
  }

  public pop(): string | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const bottom = this.items.pop();
    if (this.items.length > 0 && bottom !== undefined) {
      this.items[0] = bottom;
      this.sinkDown(0);
    }
    return top.nodeId;
  }

  public isEmpty(): boolean {
    return this.items.length === 0;
  }

  private bubbleUp(index: number): void {
    const item = this.items[index];
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      const parent = this.items[parentIdx];
      if (item.priority >= parent.priority) break;
      this.items[index] = parent;
      this.items[parentIdx] = item;
      index = parentIdx;
    }
  }

  private sinkDown(index: number): void {
    const length = this.items.length;
    const item = this.items[index];
    while (true) {
      const leftChildIdx = 2 * index + 1;
      const rightChildIdx = 2 * index + 2;
      let swapIdx = -1;

      if (leftChildIdx < length) {
        if (this.items[leftChildIdx].priority < item.priority) {
          swapIdx = leftChildIdx;
        }
      }

      if (rightChildIdx < length) {
        if (
          (swapIdx === -1 && this.items[rightChildIdx].priority < item.priority) ||
          (swapIdx !== -1 && this.items[rightChildIdx].priority < this.items[leftChildIdx].priority)
        ) {
          swapIdx = rightChildIdx;
        }
      }

      if (swapIdx === -1) break;
      this.items[index] = this.items[swapIdx];
      this.items[swapIdx] = item;
      index = swapIdx;
    }
  }
}

export class AStarRouter {
  public static findPath(
    graph: RoadGraph,
    startNodeId: string,
    targetNodeId: string,
    profile: RoutingProfile = RoutingProfile.Car,
    optimization: RouteOptimization = RouteOptimization.Fastest
  ): AStarResult | null {
    const startNode = graph.getNode(startNodeId);
    const targetNode = graph.getNode(targetNodeId);

    if (!startNode || !targetNode) return null;
    if (startNodeId === targetNodeId) {
      return {
        edges: [],
        totalDistanceMeters: 0,
        totalTimeSeconds: 0,
        nodes: [startNode],
      };
    }

    // Determine max speed for heuristic normalization
    const maxSpeedKmh = profile === RoutingProfile.Car ? 100 : profile === RoutingProfile.Bicycle ? 25 : 5.5;
    const maxSpeedMps = maxSpeedKmh / 3.6;

    const gScore: Map<string, number> = new Map();
    const fScore: Map<string, number> = new Map();
    const cameFrom: Map<string, { edge: RoadEdge; fromNodeId: string }> = new Map();
    const openSet = new MinPriorityQueue();
    const closedSet: Set<string> = new Set();

    gScore.set(startNodeId, 0);
    const initialH = this.heuristic(startNode.coordinate, targetNode.coordinate, optimization, maxSpeedMps);
    fScore.set(startNodeId, initialH);
    openSet.push(startNodeId, initialH);

    while (!openSet.isEmpty()) {
      const currentId = openSet.pop();
      if (!currentId) break;

      if (currentId === targetNodeId) {
        return this.reconstructPath(graph, cameFrom, targetNodeId, profile);
      }

      closedSet.add(currentId);
      const currentNode = graph.getNode(currentId);
      if (!currentNode) continue;

      const currentG = gScore.get(currentId) ?? Infinity;

      for (const edgeId of currentNode.edgeIds) {
        const edge = graph.getEdge(edgeId);
        if (!edge) continue;

        const neighborId = edge.toNodeId;
        if (closedSet.has(neighborId)) continue;

        // Check profile accessibility
        const speedKmh = edge.speedKmh[profile] ?? 0;
        if (speedKmh <= 0) continue; // Inaccessible for this profile

        // Compute edge cost
        const edgeCost = this.getEdgeCost(edge, profile, optimization);
        const tentativeG = currentG + edgeCost;
        const neighborG = gScore.get(neighborId) ?? Infinity;

        if (tentativeG < neighborG) {
          cameFrom.set(neighborId, { edge, fromNodeId: currentId });
          gScore.set(neighborId, tentativeG);

          const neighborNode = graph.getNode(neighborId);
          if (neighborNode) {
            const h = this.heuristic(neighborNode.coordinate, targetNode.coordinate, optimization, maxSpeedMps);
            const neighborF = tentativeG + h;
            fScore.set(neighborId, neighborF);
            openSet.push(neighborId, neighborF);
          }
        }
      }
    }

    return null; // Path not found
  }

  private static heuristic(
    from: Coordinate,
    to: Coordinate,
    optimization: RouteOptimization,
    maxSpeedMps: number
  ): number {
    const distanceMeters = haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude);
    if (optimization === RouteOptimization.Shortest) {
      return distanceMeters;
    }
    // Fastest: travel time in seconds
    return distanceMeters / maxSpeedMps;
  }

  private static getEdgeCost(
    edge: RoadEdge,
    profile: RoutingProfile,
    optimization: RouteOptimization
  ): number {
    if (optimization === RouteOptimization.Shortest) {
      return edge.lengthMeters;
    }
    // Fastest: duration in seconds
    const speedMps = (edge.speedKmh[profile] ?? 30) / 3.6;
    return edge.lengthMeters / Math.max(0.1, speedMps);
  }

  private static reconstructPath(
    graph: RoadGraph,
    cameFrom: Map<string, { edge: RoadEdge; fromNodeId: string }>,
    targetNodeId: string,
    profile: RoutingProfile
  ): AStarResult {
    const edges: RoadEdge[] = [];
    const nodeIds: string[] = [targetNodeId];
    let curr = targetNodeId;

    let totalDistance = 0;
    let totalTime = 0;

    while (cameFrom.has(curr)) {
      const prev = cameFrom.get(curr)!;
      edges.unshift(prev.edge);
      totalDistance += prev.edge.lengthMeters;

      const speedMps = (prev.edge.speedKmh[profile] ?? 30) / 3.6;
      totalTime += prev.edge.lengthMeters / Math.max(0.1, speedMps);

      curr = prev.fromNodeId;
      nodeIds.unshift(curr);
    }

    const nodes = nodeIds
      .map((id) => graph.getNode(id))
      .filter((n): n is RoadNode => n !== undefined);

    return {
      edges,
      totalDistanceMeters: Math.round(totalDistance),
      totalTimeSeconds: Math.round(totalTime),
      nodes,
    };
  }
}
