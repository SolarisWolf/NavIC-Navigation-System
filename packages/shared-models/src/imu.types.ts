/**
 * @navic/shared-models — IMU Type Definitions
 *
 * Core types for inertial measurement unit data: accelerometer, gyroscope,
 * and optional magnetometer. Used by the IMU simulator (Phase 4) and
 * Android hardware sensors (Phase 15).
 */

// ─── Primitives ──────────────────────────────────────────────────────────────

/**
 * A 3D vector representing values along X, Y, and Z axes.
 * Used for acceleration, angular velocity, and magnetic field.
 */
export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

// ─── Sensor Readings ─────────────────────────────────────────────────────────

/**
 * A single accelerometer reading.
 * Values are in m/s² and include gravity unless otherwise noted.
 */
export interface AccelerometerReading {
  /** Unix timestamp in milliseconds */
  readonly timestamp: number;

  /** Acceleration along X, Y, Z axes in m/s² */
  readonly acceleration: Vector3;

  /** Whether this reading is from a simulator */
  readonly isSimulated: boolean;
}

/**
 * A single gyroscope reading.
 * Values are in rad/s.
 */
export interface GyroscopeReading {
  /** Unix timestamp in milliseconds */
  readonly timestamp: number;

  /** Angular velocity around X, Y, Z axes in rad/s */
  readonly angularVelocity: Vector3;

  /** Whether this reading is from a simulator */
  readonly isSimulated: boolean;
}

/**
 * A single magnetometer reading.
 * Values are in μT (microtesla).
 */
export interface MagnetometerReading {
  /** Unix timestamp in milliseconds */
  readonly timestamp: number;

  /** Magnetic field along X, Y, Z axes in μT */
  readonly magneticField: Vector3;

  /** Whether this reading is from a simulator */
  readonly isSimulated: boolean;
}

// ─── Combined IMU State ──────────────────────────────────────────────────────

/**
 * Aggregated IMU state combining all sensor readings.
 */
export interface IMUState {
  readonly timestamp: number;
  readonly accelerometer: AccelerometerReading | null;
  readonly gyroscope: GyroscopeReading | null;
  readonly magnetometer: MagnetometerReading | null;
  readonly isSimulated: boolean;
}

// ─── IMU Provider Interface ──────────────────────────────────────────────────

/**
 * Callback for accelerometer readings.
 */
export type AccelerometerCallback = (reading: AccelerometerReading) => void;

/**
 * Callback for gyroscope readings.
 */
export type GyroscopeCallback = (reading: GyroscopeReading) => void;

/**
 * Callback for magnetometer readings.
 */
export type MagnetometerCallback = (reading: MagnetometerReading) => void;

/**
 * IMU provider status.
 */
export interface IMUStatus {
  readonly isActive: boolean;
  readonly hasAccelerometer: boolean;
  readonly hasGyroscope: boolean;
  readonly hasMagnetometer: boolean;
  readonly sampleRateHz: number;
  readonly isSimulated: boolean;
}

/**
 * Abstract interface for IMU data sources.
 * Implementations include the simulator (Phase 4) and Android sensors (Phase 15).
 *
 * The IMU provider typically runs at a higher frequency than GNSS (50–100 Hz)
 * to support EKF prediction steps between GNSS measurement updates.
 */
export interface IMUProvider {
  /** Human-readable name of this provider */
  readonly name: string;

  /** Whether this provider produces simulated data */
  readonly isSimulated: boolean;

  /** Start producing sensor readings */
  start(): void;

  /** Stop producing sensor readings */
  stop(): void;

  /** Register a callback for accelerometer readings */
  onAccelerometer(callback: AccelerometerCallback): void;

  /** Register a callback for gyroscope readings */
  onGyroscope(callback: GyroscopeCallback): void;

  /** Register a callback for magnetometer readings (optional sensor) */
  onMagnetometer(callback: MagnetometerCallback): void;

  /** Get current provider status */
  getStatus(): IMUStatus;
}
