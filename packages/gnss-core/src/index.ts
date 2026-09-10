/**
 * @navic/gnss-core
 *
 * GNSS position engine and provider management.
 *
 * This package will contain:
 * - GNSS Simulator (Phase 2)
 * - Position Engine (Phase 3)
 * - Satellite summary utilities
 *
 * Architecture:
 *   GNSSProvider (interface from shared-models)
 *     ├── GNSSSimulator (Phase 2) — simulated constellation data
 *     └── AndroidGNSS (Phase 15) — real hardware GNSS
 *           ↓
 *     PositionEngine (Phase 3) — position estimation, smoothing, fix quality
 */

// Re-export GNSS-related types for convenience
export type {
  GNSSProvider,
  GNSSMeasurement,
  GNSSStatus,
  SatelliteInfo,
  SatelliteSummary,
} from '@navic/shared-models';

export {
  Constellation,
  FixType,
} from '@navic/shared-models';
