/**
 * @navic/routing-core
 *
 * Offline routing engine, graph modeling, A* pathfinding,
 * and turn-by-turn maneuver instruction generation.
 */

// Road Graph
export {
  RoadGraph,
  type RoadNode,
  type RoadEdge,
  type RoadType,
} from './graph/road-graph.js';

export { buildDelhiRoadGraph } from './graph/delhi-network.js';
export { buildBangaloreRoadGraph } from './graph/bangalore-network.js';
export { buildCompositeIndiaRoadGraph } from './graph/composite-network.js';

// Algorithms & Engine
export { AStarRouter, type AStarResult } from './engine/astar-router.js';
export { InstructionGenerator } from './engine/instruction-generator.js';
export {
  OfflineRoutingEngine,
  type RouteRequest,
  type RoutingEngineOptions,
} from './engine/routing-engine.js';

// Re-export routing-related types from shared-models for convenience
export type {
  Route,
  NavigationInstruction,
  RoutePoint,
  Coordinate,
} from '@navic/shared-models';

export {
  ManeuverType,
  RoutingProfile,
  RouteOptimization,
} from '@navic/shared-models';
