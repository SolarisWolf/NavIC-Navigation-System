/**
 * @navic/navigation-core
 *
 * Navigation engine — the orchestrator that turns a calculated route
 * into a real-time navigation experience.
 *
 * This package will contain:
 * - Navigation Engine (Phase 9)
 * - Map Matching (Phase 9)
 * - Route Progress Tracker (Phase 9)
 * - Re-routing Manager (Phase 10)
 * - Voice Navigation Controller (Phase 11)
 *
 * Architecture:
 *   Fused Position (from sensor-fusion)
 *          ↓
 *   Map Matching (snap to road)
 *          ↓
 *   Route Progress (where on route?)
 *          ↓
 *   Next Maneuver (what instruction?)
 *          ↓
 *   Navigation State (UI consumption)
 *          ↓
 *   Voice Output (TTS)
 */

// Re-export navigation-related types for convenience
export type {
  NavigationState,
  NavigationInstruction,
  Route,
  Coordinate,
} from '@navic/shared-models';

export {
  NavigationMode,
  ManeuverType,
} from '@navic/shared-models';
