/**
 * @navic/gnss-core
 *
 * GNSS position engine and provider management.
 */

// Re-export GNSS-related types
export type {
  GNSSProvider,
  GNSSMeasurement,
  GNSSStatus,
  SatelliteInfo,
  SatelliteSummary,
  DilutionOfPrecision,
  GNSSPosition,
  PositionEngineConfig,
  GNSSPositionCallback,
  GNSSLossOfFixCallback,
} from '@navic/shared-models';

export {
  Constellation,
  FixType,
} from '@navic/shared-models';

// Export simulator
export {
  GNSSSimulator,
  type GNSSSimulatorConfig,
  computeVisibleSatellites,
  SCENARIOS,
  getScenario,
  getScenarioNames,
  RouteInterpolator,
  ALL_SATELLITES,
  NAVIC_SATELLITES,
  GPS_SATELLITES,
  GALILEO_SATELLITES,
  BEIDOU_SATELLITES,
  GLONASS_SATELLITES,
  getSatellitesForConstellation,
  gaussianRandom,
  addPositionNoise,
  estimateAccuracy,
} from './simulator/index.js';

// Export position engine & algorithms
export {
  PositionEngine,
  calculateDOP,
  OutlierFilter,
  type OutlierCheckResult,
} from './engine/index.js';
