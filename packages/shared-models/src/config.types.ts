/**
 * @navic/shared-models — Configuration Type Definitions
 *
 * Application-wide configuration for simulation, EKF parameters,
 * map settings, and system behavior.
 */

// ─── Log Level ───────────────────────────────────────────────────────────────

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

// ─── Simulation Configuration ────────────────────────────────────────────────

/**
 * Configuration for the GNSS and IMU simulators.
 */
export interface SimulationConfig {
  /** Whether the system is running in simulation mode */
  readonly enabled: boolean;

  /** GNSS update rate in Hz (e.g., 1 for 1 Hz) */
  readonly gnssUpdateRateHz: number;

  /** IMU update rate in Hz (e.g., 50 for 50 Hz) */
  readonly imuUpdateRateHz: number;

  /** Position noise standard deviation in meters */
  readonly positionNoiseSigma: number;

  /** Speed noise standard deviation in m/s */
  readonly speedNoiseSigma: number;

  /** Bearing noise standard deviation in degrees */
  readonly bearingNoiseSigma: number;

  /** Accelerometer noise standard deviation in m/s² */
  readonly accelerometerNoiseSigma: number;

  /** Gyroscope noise standard deviation in rad/s */
  readonly gyroscopeNoiseSigma: number;
}

// ─── EKF Configuration ──────────────────────────────────────────────────────

/**
 * Extended Kalman Filter tuning parameters.
 */
export interface EKFConfig {
  /** Process noise covariance scaling for position */
  readonly processNoisePosition: number;

  /** Process noise covariance scaling for velocity */
  readonly processNoiseVelocity: number;

  /** Process noise covariance scaling for orientation */
  readonly processNoiseOrientation: number;

  /** Measurement noise covariance for GNSS position */
  readonly measurementNoiseGNSS: number;

  /** Measurement noise covariance for IMU acceleration */
  readonly measurementNoiseIMU: number;

  /** Maximum time in ms before declaring GNSS outage */
  readonly gnssTimeoutMs: number;

  /** Target processing latency in ms (spec: ~20 ms) */
  readonly targetLatencyMs: number;
}

// ─── Map Configuration ───────────────────────────────────────────────────────

/**
 * Offline map system configuration.
 */
export interface MapConfig {
  /** Path to MBTiles file(s) */
  readonly mbtilesPath: string;

  /** Path to POI database */
  readonly poiDatabasePath: string;

  /** Default map center (latitude, longitude) */
  readonly defaultCenter: {
    readonly latitude: number;
    readonly longitude: number;
  };

  /** Default zoom level */
  readonly defaultZoom: number;

  /** Min zoom level */
  readonly minZoom: number;

  /** Max zoom level */
  readonly maxZoom: number;
}

// ─── Navigation Configuration ────────────────────────────────────────────────

/**
 * Navigation engine configuration.
 */
export interface NavigationConfig {
  /** Distance in meters from route before triggering re-route */
  readonly offRouteThresholdMeters: number;

  /** Distance in meters before a maneuver to announce it */
  readonly instructionAdvanceMeters: number;

  /** Minimum speed in m/s to consider the user moving */
  readonly minimumMovingSpeedMs: number;

  /** Maximum route computation time target in ms (spec: ~1500–2000 ms) */
  readonly routeComputationTimeoutMs: number;
}

// ─── Root Application Config ─────────────────────────────────────────────────

/**
 * Root application configuration.
 */
export interface AppConfig {
  /** Application name */
  readonly appName: string;

  /** Application version */
  readonly version: string;

  /** Log level */
  readonly logLevel: LogLevel;

  /** Simulation settings */
  readonly simulation: SimulationConfig;

  /** EKF tuning parameters */
  readonly ekf: EKFConfig;

  /** Map settings */
  readonly map: MapConfig;

  /** Navigation settings */
  readonly navigation: NavigationConfig;
}

// ─── Default Configuration ───────────────────────────────────────────────────

/**
 * Default application configuration.
 * Uses simulation mode with reasonable defaults.
 */
export const DEFAULT_CONFIG: AppConfig = {
  appName: 'NavIC Navigation',
  version: '0.1.0',
  logLevel: LogLevel.INFO,

  simulation: {
    enabled: true,
    gnssUpdateRateHz: 1,
    imuUpdateRateHz: 50,
    positionNoiseSigma: 3.0,
    speedNoiseSigma: 0.5,
    bearingNoiseSigma: 5.0,
    accelerometerNoiseSigma: 0.1,
    gyroscopeNoiseSigma: 0.01,
  },

  ekf: {
    processNoisePosition: 0.1,
    processNoiseVelocity: 0.5,
    processNoiseOrientation: 0.01,
    measurementNoiseGNSS: 5.0,
    measurementNoiseIMU: 0.5,
    gnssTimeoutMs: 5000,
    targetLatencyMs: 20,
  },

  map: {
    mbtilesPath: './data/maps',
    poiDatabasePath: './data/poi',
    defaultCenter: {
      latitude: 20.5937,  // India geographic center (approx)
      longitude: 78.9629,
    },
    defaultZoom: 5,
    minZoom: 2,
    maxZoom: 18,
  },

  navigation: {
    offRouteThresholdMeters: 50,
    instructionAdvanceMeters: 200,
    minimumMovingSpeedMs: 0.5,
    routeComputationTimeoutMs: 2000,
  },
};
