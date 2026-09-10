/**
 * @navic/shared-models — Error Classes
 *
 * Typed error hierarchy for the navigation system. Each error carries
 * a machine-readable code, human-readable message, and optional details.
 *
 * Hierarchy:
 *   NavigationError (base)
 *   ├── GNSSError
 *   ├── IMUError
 *   ├── RoutingError
 *   ├── MapError
 *   └── FusionError
 */

// ─── Error Codes ─────────────────────────────────────────────────────────────

export enum GNSSErrorCode {
  NO_FIX = 'GNSS_NO_FIX',
  TIMEOUT = 'GNSS_TIMEOUT',
  INVALID_DATA = 'GNSS_INVALID_DATA',
  PROVIDER_UNAVAILABLE = 'GNSS_PROVIDER_UNAVAILABLE',
  FIX_LOST = 'GNSS_FIX_LOST',
}

export enum IMUErrorCode {
  SENSOR_UNAVAILABLE = 'IMU_SENSOR_UNAVAILABLE',
  CALIBRATION_NEEDED = 'IMU_CALIBRATION_NEEDED',
  INVALID_READING = 'IMU_INVALID_READING',
  PROVIDER_UNAVAILABLE = 'IMU_PROVIDER_UNAVAILABLE',
}

export enum RoutingErrorCode {
  NO_ROUTE_FOUND = 'ROUTING_NO_ROUTE',
  GRAPH_NOT_LOADED = 'ROUTING_GRAPH_NOT_LOADED',
  INVALID_ORIGIN = 'ROUTING_INVALID_ORIGIN',
  INVALID_DESTINATION = 'ROUTING_INVALID_DESTINATION',
  COMPUTATION_TIMEOUT = 'ROUTING_TIMEOUT',
}

export enum MapErrorCode {
  TILES_NOT_FOUND = 'MAP_TILES_NOT_FOUND',
  RENDER_FAILURE = 'MAP_RENDER_FAILURE',
  MBTILES_CORRUPT = 'MAP_MBTILES_CORRUPT',
  POI_DATABASE_ERROR = 'MAP_POI_DB_ERROR',
}

export enum FusionErrorCode {
  EKF_DIVERGENCE = 'FUSION_EKF_DIVERGENCE',
  INVALID_STATE = 'FUSION_INVALID_STATE',
  MEASUREMENT_REJECTED = 'FUSION_MEASUREMENT_REJECTED',
  INITIALIZATION_FAILED = 'FUSION_INIT_FAILED',
}

// ─── Base Error ──────────────────────────────────────────────────────────────

/**
 * Base error class for all navigation system errors.
 */
export class NavigationError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly timestamp: number;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'NavigationError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Specific Errors ─────────────────────────────────────────────────────────

export class GNSSError extends NavigationError {
  constructor(code: GNSSErrorCode, message: string, details?: unknown) {
    super(code, message, details);
    this.name = 'GNSSError';
  }
}

export class IMUError extends NavigationError {
  constructor(code: IMUErrorCode, message: string, details?: unknown) {
    super(code, message, details);
    this.name = 'IMUError';
  }
}

export class RoutingError extends NavigationError {
  constructor(code: RoutingErrorCode, message: string, details?: unknown) {
    super(code, message, details);
    this.name = 'RoutingError';
  }
}

export class MapError extends NavigationError {
  constructor(code: MapErrorCode, message: string, details?: unknown) {
    super(code, message, details);
    this.name = 'MapError';
  }
}

export class FusionError extends NavigationError {
  constructor(code: FusionErrorCode, message: string, details?: unknown) {
    super(code, message, details);
    this.name = 'FusionError';
  }
}
