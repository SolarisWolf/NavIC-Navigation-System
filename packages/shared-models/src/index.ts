/**
 * @navic/shared-models
 *
 * Central barrel export for all shared types, interfaces, enums,
 * utilities, logging, and error classes used across the NavIC
 * navigation system.
 */

// ─── GNSS Types ──────────────────────────────────────────────────────────────
export {
  Constellation,
  FixType,
  type SatelliteInfo,
  type GNSSMeasurement,
  type SatelliteSummary,
  type GNSSMeasurementCallback,
  type GNSSStatusCallback,
  type GNSSStatus,
  type GNSSProvider,
} from './gnss.types.js';

// ─── IMU Types ───────────────────────────────────────────────────────────────
export {
  type Vector3,
  type AccelerometerReading,
  type GyroscopeReading,
  type MagnetometerReading,
  type IMUState,
  type AccelerometerCallback,
  type GyroscopeCallback,
  type MagnetometerCallback,
  type IMUStatus,
  type IMUProvider,
} from './imu.types.js';

// ─── Navigation Types ────────────────────────────────────────────────────────
export {
  type Coordinate,
  ManeuverType,
  RoutingProfile,
  RouteOptimization,
  type NavigationInstruction,
  type RoutePoint,
  type Route,
  NavigationMode,
  type NavigationState,
} from './navigation.types.js';

// ─── Map Types ───────────────────────────────────────────────────────────────
export {
  type BoundingBox,
  type TileCoordinate,
  type MapTile,
  POICategory,
  type POI,
  type MapDisplayConfig,
  type MapViewState,
} from './map.types.js';

// ─── Configuration ───────────────────────────────────────────────────────────
export {
  LogLevel,
  type SimulationConfig,
  type EKFConfig,
  type MapConfig,
  type NavigationConfig,
  type AppConfig,
  DEFAULT_CONFIG,
} from './config.types.js';

// ─── Logger ──────────────────────────────────────────────────────────────────
export {
  Logger,
  type LoggerOptions,
  type LogOutput,
} from './logger.js';

// ─── Errors ──────────────────────────────────────────────────────────────────
export {
  NavigationError,
  GNSSError,
  IMUError,
  RoutingError,
  MapError,
  FusionError,
  GNSSErrorCode,
  IMUErrorCode,
  RoutingErrorCode,
  MapErrorCode,
  FusionErrorCode,
} from './errors.js';

// ─── Utilities ───────────────────────────────────────────────────────────────
export {
  toRadians,
  toDegrees,
  haversineDistance,
  calculateBearing,
  normalizeAngle,
  clamp,
  generateId,
  formatDistance,
  formatDuration,
} from './utils.js';
