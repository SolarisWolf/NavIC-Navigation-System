/**
 * @navic/routing-core
 *
 * Offline routing engine.
 *
 * This package will contain:
 * - Offline Road Graph (Phase 8)
 * - Route Calculator (Phase 8)
 * - Map Matching (Phase 9)
 * - Re-routing Engine (Phase 10)
 *
 * The project specification requires GraphHopper for offline path calculation.
 *
 * Architecture:
 *   Current Position + Destination
 *          ↓
 *   Offline Road Graph (OSM data)
 *          ↓
 *   Routing Engine (Dijkstra/A*)
 *          ↓
 *   Route (geometry + turn instructions)
 */

// Re-export routing-related types for convenience
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
