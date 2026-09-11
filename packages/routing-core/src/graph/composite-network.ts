/**
 * @navic/routing-core — Composite India Road Network
 *
 * Unifies multi-city offline road graphs (Delhi NCR, Bengaluru, etc.)
 * into a single high-performance spatial-indexed topological graph.
 */

import { RoadGraph } from './road-graph.js';
import { buildDelhiRoadGraph } from './delhi-network.js';
import { buildBangaloreRoadGraph } from './bangalore-network.js';

export function buildCompositeIndiaRoadGraph(): RoadGraph {
  // Start with Delhi NCR network
  const g = buildDelhiRoadGraph();

  // Merge Bengaluru (Bangalore) network
  const blr = buildBangaloreRoadGraph();

  for (const node of blr.getAllNodes()) {
    g.addNode(node.id, node.coordinate, node.name);
  }

  for (const edge of blr.getAllEdges()) {
    // Only import forward edges; addEdge will automatically construct reverse edges if !oneWay
    if (!edge.id.endsWith('_rev')) {
      g.addEdge({
        id: edge.id,
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        roadName: edge.roadName,
        roadType: edge.roadType,
        oneWay: edge.oneWay,
        speedKmh: edge.speedKmh,
        geometry: edge.geometry,
      });
    }
  }

  return g;
}
