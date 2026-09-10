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
  type NavICSatelliteDetail,
  type NavICSignalReport,
  type GNSSMeasurement,
  type SatelliteSummary,
  type GNSSMeasurementCallback,
  type GNSSStatusCallback,
  type GNSSStatus,
  type GNSSProvider,
} from './gnss.types';

// ─── GNSS Engine & DOP Types ────────────────────────────────────────────────
export {
  type DilutionOfPrecision,
  type GNSSPosition,
  type PositionEngineConfig,
  type GNSSPositionCallback,
  type GNSSLossOfFixCallback,
} from './gnss-engine.types';

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
} from './imu.types';

// ─── Sensor Fusion & EKF Types ───────────────────────────────────────────────
export {
  SensorFusionMode,
  type FusedPositionEstimate,
  type SensorFusionStatus,
  type FusedPositionCallback,
  type SensorFusionStatusCallback,
} from './sensor-fusion.types';

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
} from './navigation.types';

// ─── Map Types ───────────────────────────────────────────────────────────────
export {
  type BoundingBox,
  type TileCoordinate,
  type MapTile,
  POICategory,
  type POI,
  type MapDisplayConfig,
  type MapViewState,
} from './map.types';

// ─── Configuration ───────────────────────────────────────────────────────────
export {
  LogLevel,
  type SimulationConfig,
  type EKFConfig,
  type MapConfig,
  type NavigationConfig,
  type AppConfig,
  DEFAULT_CONFIG,
} from './config.types';

// ─── Logger ──────────────────────────────────────────────────────────────────
export {
  Logger,
  type LoggerOptions,
  type LogOutput,
} from './logger';

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
} from './errors';

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
} from './utils';

// ─── Power & Battery Optimization Types ──────────────────────────────────────
export {
  PowerProfileMode,
  VehicleDynamicsState,
  type BatteryTelemetry,
  type PowerOptimizationStatus,
  type PowerStatusListener,
} from './power.types';

// ─── Trip Recovery & Android Platform Types ─────────────────────────────────
export {
  type ActiveTripState,
  type GeoIntentPayload,
  type AndroidPlatformSettings,
  DEFAULT_ANDROID_PLATFORM_SETTINGS,
} from './trip-recovery.types';

