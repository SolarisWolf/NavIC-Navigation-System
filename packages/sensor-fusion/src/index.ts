/**
 * @navic/sensor-fusion
 *
 * Extended Kalman Filter and dead reckoning for sensor fusion.
 *
 * This package will contain:
 * - IMU Simulator (Phase 4)
 * - Extended Kalman Filter (Phase 5)
 * - Dead Reckoning Engine (Phase 5)
 *
 * Architecture:
 *   GNSS Measurements ──► EKF ◄── IMU Readings
 *                          │
 *                          ▼
 *                   Fused Position Estimate
 *                   (position, velocity, orientation)
 *
 * The EKF combines GNSS and IMU data with target latency of ~20 ms.
 * During GNSS outages, the system falls back to IMU-only dead reckoning.
 */

// Re-export IMU-related types for convenience
export type {
  IMUProvider,
  IMUState,
  IMUStatus,
  AccelerometerReading,
  GyroscopeReading,
  MagnetometerReading,
  Vector3,
} from '@navic/shared-models';

/**
 * Fused position estimate from the EKF.
 * This is the primary output consumed by the navigation engine.
 */
export interface FusedPosition {
  /** Unix timestamp in milliseconds */
  readonly timestamp: number;

  /** Estimated latitude in decimal degrees */
  readonly latitude: number;

  /** Estimated longitude in decimal degrees */
  readonly longitude: number;

  /** Estimated altitude in meters */
  readonly altitude: number;

  /** Estimated speed in m/s */
  readonly speed: number;

  /** Estimated bearing in degrees (0–360) */
  readonly bearing: number;

  /** Estimated horizontal accuracy in meters */
  readonly accuracy: number;

  /** Whether GNSS data is currently available */
  readonly hasGNSS: boolean;

  /** Whether operating in dead reckoning mode (IMU only) */
  readonly isDeadReckoning: boolean;

  /** Whether source data is simulated */
  readonly isSimulated: boolean;

  /** EKF processing latency in milliseconds */
  readonly processingLatencyMs: number;
}

/**
 * Sensor fusion engine status.
 */
export interface FusionStatus {
  readonly isRunning: boolean;
  readonly hasGNSS: boolean;
  readonly hasIMU: boolean;
  readonly isDeadReckoning: boolean;
  readonly lastUpdateTimestamp: number | null;
  readonly averageLatencyMs: number;
}
