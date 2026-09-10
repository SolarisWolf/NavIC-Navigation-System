/**
 * @navic/navigation-core
 *
 * Navigation engine — the orchestrator that turns a calculated route
 * into a real-time turn-by-turn navigation experience.
 *
 * Architecture:
 *   Fused Position (from sensor-fusion)
 *          ↓
 *   Map Matching (snap to route geometry)
 *          ↓
 *   Route Progress (along-route meters, ETA, arrival)
 *          ↓
 *   Guidance Engine (next maneuver, countdown, advancement)
 *          ↓
 *   Off-Route Detector (cross-track deviation alerts)
 *          ↓
 *   Navigation Engine (master state emitter for UI & voice)
 */

// Core Engine
export {
  NavigationEngine,
  type NavigationStateListener,
  type ManeuverListener,
  type OffRouteListener,
  type ArrivalListener,
} from './engine/navigation-engine';

// Map Matching
export {
  MapMatcher,
  type MapMatchResult,
} from './matching/map-matcher';

// Progress Tracking
export {
  ProgressTracker,
  type RouteProgress,
} from './tracker/progress-tracker';

// Guidance & Instructions
export {
  GuidanceEngine,
  type GuidanceState,
  type ManeuverProximity,
} from './guidance/guidance-engine';

// Off-Route Detection
export {
  OffRouteDetector,
  type OffRouteStatus,
} from './matching/off-route-detector';

// Re-export navigation-related types for convenience
export type {
  NavigationState,
  NavigationInstruction,
  Route,
  RoutePoint,
  Coordinate,
} from '@navic/shared-models';

export {
  NavigationMode,
  ManeuverType,
  RoutingProfile,
  RouteOptimization,
} from '@navic/shared-models';
