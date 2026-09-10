/**
 * @navic/shared-models — Sensor Fusion & EKF Type Definitions
 *
 * Types and interfaces for Extended Kalman Filter (EKF), fused position
 * estimates, and dead-reckoning state.
 */

import { Coordinate } from './navigation.types.js';

/**
 * Operating mode of the sensor fusion engine.
 */
export enum SensorFusionMode {
  /** Waiting for initial GNSS fix to anchor the filter */
  INITIALIZING = 'INITIALIZING',

  /** Full multi-sensor fusion (1 Hz GNSS + 50 Hz IMU) */
  FULL_FUSION = 'FULL_FUSION',

  /** GNSS unavailable/lost; propagating position via IMU dead reckoning */
  DEAD_RECKONING = 'DEAD_RECKONING',

  /** Running on GNSS updates alone without IMU */
  GNSS_ONLY = 'GNSS_ONLY',
}

/**
 * Fused position and kinematic estimate emitted by the EKF.
 * Provides high-frequency (50 Hz), smoothed estimates for navigation.
 */
export interface FusedPositionEstimate {
  /** Unix timestamp in milliseconds */
  readonly timestamp: number;

  /** Estimated geographic coordinate (WGS84) */
  readonly coordinate: Coordinate;

  /** Estimated speed over ground in m/s */
  readonly speed: number;

  /** Estimated heading / bearing in degrees [0, 360) */
  readonly bearing: number;

  /** Estimated 1-sigma horizontal position accuracy in meters */
  readonly accuracy: number;

  /** Whether the estimate is currently in dead reckoning mode */
  readonly isDeadReckoning: boolean;

  /** Duration of current dead reckoning period in seconds (0 if full fusion) */
  readonly deadReckoningDurationSec: number;

  /** Processing latency for this filter cycle in milliseconds */
  readonly latencyMs: number;

  /** Active sensor fusion mode */
  readonly mode: SensorFusionMode;

  /** Estimated forward acceleration in m/s² */
  readonly forwardAcceleration?: number;

  /** Estimated yaw angular velocity in rad/s */
  readonly yawRate?: number;
}

/**
 * Comprehensive diagnostics and telemetry from the Sensor Fusion Engine.
 */
export interface SensorFusionStatus {
  /** Active sensor fusion mode */
  readonly mode: SensorFusionMode;

  /** Whether dead reckoning is actively maintaining position */
  readonly isDeadReckoning: boolean;

  /** Duration in seconds of continuous dead reckoning */
  readonly deadReckoningSeconds: number;

  /** Filter prediction frequency in Hz */
  readonly updateRateHz: number;

  /** Rolling average processing latency in milliseconds (spec target: ~20 ms) */
  readonly averageLatencyMs: number;

  /** Estimated accelerometer bias along forward axis in m/s² */
  readonly accelBias: number;

  /** Estimated gyroscope bias along yaw axis in rad/s */
  readonly gyroBias: number;

  /** Timestamp of the most recent GNSS measurement */
  readonly lastGnssTimestamp: number | null;

  /** Timestamp of the most recent IMU measurement */
  readonly lastImuTimestamp: number | null;

  /** Horizontal position uncertainty (1-sigma) in meters */
  readonly positionUncertaintyMeters: number;
}

/**
 * Callback for fused position updates.
 */
export type FusedPositionCallback = (estimate: FusedPositionEstimate) => void;

/**
 * Callback for fusion status updates.
 */
export type SensorFusionStatusCallback = (status: SensorFusionStatus) => void;
