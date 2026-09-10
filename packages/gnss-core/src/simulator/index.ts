/**
 * GNSS Simulator Module — Barrel Export
 */

export { GNSSSimulator, type GNSSSimulatorConfig } from './gnss-simulator.js';
export { computeVisibleSatellites } from './satellite-simulator.js';
export {
  SCENARIOS,
  getScenario,
  getScenarioNames,
  RouteInterpolator,
  type SimulationScenario,
  type Waypoint,
} from './route-simulator.js';
export {
  ALL_SATELLITES,
  NAVIC_SATELLITES,
  GPS_SATELLITES,
  GALILEO_SATELLITES,
  BEIDOU_SATELLITES,
  GLONASS_SATELLITES,
  getSatellitesForConstellation,
  type SatelliteDefinition,
} from './constellation-data.js';
export {
  gaussianRandom,
  addPositionNoise,
  addAltitudeNoise,
  addSpeedNoise,
  addBearingNoise,
  estimateAccuracy,
} from './noise-model.js';
