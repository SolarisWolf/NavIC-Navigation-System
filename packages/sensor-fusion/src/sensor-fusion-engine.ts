/**
 * @navic/sensor-fusion — Sensor Fusion Engine
 *
 * Coordinates data streams from GNSS and IMU providers, manages coordinate frames,
 * transitions between Full Fusion and Dead Reckoning modes, and publishes
 * 50 Hz FusedPositionEstimates.
 */

import {
  Coordinate,
  GNSSMeasurement,
  FixType,
  AccelerometerReading,
  GyroscopeReading,
  MagnetometerReading,
  SensorFusionMode,
  FusedPositionEstimate,
  SensorFusionStatus,
  FusedPositionCallback,
  SensorFusionStatusCallback,
  Logger,
} from '@navic/shared-models';

import { ExtendedKalmanFilter } from './ekf/extended-kalman-filter.js';
import { wgs84ToEnu, enuToWgs84 } from './math/coordinates.js';
import { rotationMatrixFromRotationVector, type Float64Matrix } from './math/matrix.js';

export interface DeviceRotationVector {
  x: number;
  y: number;
  z: number;
  w?: number;
}

export class SensorFusionEngine {
  private ekf: ExtendedKalmanFilter;
  private logger = new Logger('SensorFusionEngine');
  private deviceRotationMatrix: Float64Matrix | null = null;


  // Anchor coordinate for local ENU frame
  private anchor: Coordinate | null = null;

  // Listeners
  private positionCallbacks: FusedPositionCallback[] = [];
  private statusCallbacks: SensorFusionStatusCallback[] = [];

  // State tracking
  private mode: SensorFusionMode = SensorFusionMode.INITIALIZING;
  private lastGnssTimestamp: number | null = null;
  private lastImuTimestamp: number | null = null;
  private deadReckoningStartTime: number | null = null;

  // Latency metrics
  private latencyHistory: number[] = [];
  private readonly maxLatencyHistory = 50;

  // Cached IMU readings
  private lastAccel: AccelerometerReading | null = null;
  private lastGyro: GyroscopeReading | null = null;

  // Latest estimate
  private latestEstimate: FusedPositionEstimate | null = null;

  constructor() {
    this.ekf = new ExtendedKalmanFilter();
  }

  /**
   * Resets the sensor fusion engine and underlying filter.
   */
  public reset(): void {
    this.ekf.reset();
    this.anchor = null;
    this.mode = SensorFusionMode.INITIALIZING;
    this.lastGnssTimestamp = null;
    this.lastImuTimestamp = null;
    this.deadReckoningStartTime = null;
    this.latencyHistory = [];
    this.latestEstimate = null;
    this.logger.info('Sensor Fusion Engine reset');
  }

  /**
   * Subscribe to 50 Hz fused position estimates.
   */
  public onFusedPosition(cb: FusedPositionCallback): void {
    this.positionCallbacks.push(cb);
  }

  /**
   * Subscribe to fusion status telemetry.
   */
  public onStatus(cb: SensorFusionStatusCallback): void {
    this.statusCallbacks.push(cb);
  }

  /**
   * Ingests a GNSS measurement (typically 1 Hz).
   */
  public processGNSS(gnss: GNSSMeasurement): void {
    const isNoFix = gnss.fixType === FixType.NoFix || gnss.latitude === 0 || gnss.longitude === 0;

    if (isNoFix) {
      // Transition to dead reckoning if we were previously initialized
      if (this.ekf.initialized && this.mode !== SensorFusionMode.DEAD_RECKONING) {
        this.mode = SensorFusionMode.DEAD_RECKONING;
        this.deadReckoningStartTime = Date.now();
        this.logger.warn('GNSS outage detected — switched to Dead Reckoning');
      }
      return;
    }

    const now = Date.now();
    this.lastGnssTimestamp = now;

    // Set anchor if this is the first valid fix
    if (!this.anchor) {
      this.anchor = {
        latitude: gnss.latitude,
        longitude: gnss.longitude,
        altitude: gnss.altitude,
      };
      this.logger.info(`Anchor set to [${this.anchor.latitude}, ${this.anchor.longitude}]`);
    }

    // Convert GNSS coordinate to local ENU
    const enu = wgs84ToEnu(
      {
        latitude: gnss.latitude,
        longitude: gnss.longitude,
        altitude: gnss.altitude,
      },
      this.anchor
    );

    const bearingRad = (gnss.bearing * Math.PI) / 180.0;

    // Measurement update in EKF
    this.ekf.updateGNSS({
      east: enu.east,
      north: enu.north,
      up: enu.up,
      speed: gnss.speed,
      bearingRad,
      horizontalAccuracy: gnss.horizontalAccuracy,
      verticalAccuracy: gnss.verticalAccuracy,
    });

    // If recovering from dead reckoning, switch back to full fusion
    if (this.mode === SensorFusionMode.DEAD_RECKONING || this.mode === SensorFusionMode.INITIALIZING) {
      this.mode = SensorFusionMode.FULL_FUSION;
      this.deadReckoningStartTime = null;
      this.logger.info('GNSS recovered — returned to Full Sensor Fusion');
    }

    this.emitCurrentEstimate(now);
  }

  /**
   * Sets the device orientation rotation matrix from an Android rotation vector quaternion.
   */
  public setDeviceOrientation(x: number, y: number, z: number, w?: number): void {
    this.deviceRotationMatrix = rotationMatrixFromRotationVector(x, y, z, w);
  }

  /**
   * Ingests IMU readings (typically 50 Hz).
   * Runs the EKF prediction step and emits a high-rate fused estimate.
   * Supports device-to-world rotation transforms when rotationVector or setDeviceOrientation is provided.
   */
  public processIMU(
    accel: AccelerometerReading,
    gyro: GyroscopeReading,
    _mag?: MagnetometerReading,
    rotationVector?: DeviceRotationVector
  ): void {
    this.lastAccel = accel;
    this.lastGyro = gyro;

    if (rotationVector) {
      this.deviceRotationMatrix = rotationMatrixFromRotationVector(
        rotationVector.x,
        rotationVector.y,
        rotationVector.z,
        rotationVector.w
      );
    }

    const now = accel.timestamp || Date.now();
    const dt = this.lastImuTimestamp ? (now - this.lastImuTimestamp) / 1000.0 : 0.02;
    this.lastImuTimestamp = now;

    // Check for GNSS timeout to detect outage
    if (
      this.mode === SensorFusionMode.FULL_FUSION &&
      this.lastGnssTimestamp &&
      now - this.lastGnssTimestamp > 1500
    ) {
      this.mode = SensorFusionMode.DEAD_RECKONING;
      this.deadReckoningStartTime = now;
      this.logger.warn('GNSS measurement timeout (>1.5s) — entering Dead Reckoning');
    }

    if (!this.ekf.initialized) return;

    let forwardAccel: number;
    let yawRate: number;

    if (this.deviceRotationMatrix) {
      const R = this.deviceRotationMatrix;
      const ax = accel.acceleration.x;
      const ay = accel.acceleration.y;
      const az = accel.acceleration.z;

      // Transform acceleration to world ENU frame: a_world = R * a_device
      const aEast = R.get(0, 0) * ax + R.get(0, 1) * ay + R.get(0, 2) * az;
      const aNorth = R.get(1, 0) * ax + R.get(1, 1) * ay + R.get(1, 2) * az;

      // Transform angular velocity to world frame: yaw rate around vertical Up axis
      const gx = gyro.angularVelocity.x;
      const gy = gyro.angularVelocity.y;
      const gz = gyro.angularVelocity.z;
      yawRate = R.get(2, 0) * gx + R.get(2, 1) * gy + R.get(2, 2) * gz;

      // Project horizontal acceleration along vehicle heading:
      // In EKF, heading 0 = North, pi/2 = East
      const heading = this.ekf.getState().bearingRad;
      forwardAccel = aEast * Math.sin(heading) + aNorth * Math.cos(heading);
    } else {
      // Baseline convention (device Y axis is forward, Z axis is yaw)
      forwardAccel = accel.acceleration.y;
      yawRate = gyro.angularVelocity.z;
    }

    // Predict step in EKF
    this.ekf.predict(dt, forwardAccel, yawRate);

    this.emitCurrentEstimate(now);
  }

  /**
   * Returns the most recent fused estimate.
   */
  public getLatestEstimate(): FusedPositionEstimate | null {
    return this.latestEstimate;
  }

  /**
   * Returns current diagnostic status.
   */
  public getStatus(): SensorFusionStatus {
    const ekfState = this.ekf.getState();
    const isDr = this.mode === SensorFusionMode.DEAD_RECKONING;
    const drSeconds = isDr && this.deadReckoningStartTime ? (Date.now() - this.deadReckoningStartTime) / 1000.0 : 0;

    const avgLatency =
      this.latencyHistory.length > 0
        ? this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length
        : 0;

    return {
      mode: this.mode,
      isDeadReckoning: isDr,
      deadReckoningSeconds: drSeconds,
      updateRateHz: 50,
      averageLatencyMs: avgLatency,
      accelBias: ekfState.accelBias,
      gyroBias: ekfState.gyroBias,
      lastGnssTimestamp: this.lastGnssTimestamp,
      lastImuTimestamp: this.lastImuTimestamp,
      positionUncertaintyMeters: ekfState.accuracy,
    };
  }

  private emitCurrentEstimate(timestamp: number): void {
    if (!this.anchor || !this.ekf.initialized) return;

    const ekfState = this.ekf.getState();

    // Record latency
    this.latencyHistory.push(ekfState.latencyMs);
    if (this.latencyHistory.length > this.maxLatencyHistory) {
      this.latencyHistory.shift();
    }

    // Convert local ENU state back to WGS84
    const coord = enuToWgs84(
      { east: ekfState.east, north: ekfState.north, up: ekfState.up },
      this.anchor
    );

    const isDr = this.mode === SensorFusionMode.DEAD_RECKONING;
    const drDuration = isDr && this.deadReckoningStartTime ? (timestamp - this.deadReckoningStartTime) / 1000.0 : 0;

    const estimate: FusedPositionEstimate = {
      timestamp,
      coordinate: coord,
      speed: ekfState.speed,
      bearing: ekfState.bearingDeg,
      accuracy: ekfState.accuracy,
      isDeadReckoning: isDr,
      deadReckoningDurationSec: drDuration,
      latencyMs: ekfState.latencyMs,
      mode: this.mode,
      forwardAcceleration: this.lastAccel?.acceleration.y,
      yawRate: this.lastGyro?.angularVelocity.z,
    };

    this.latestEstimate = estimate;

    for (const cb of this.positionCallbacks) {
      try {
        cb(estimate);
      } catch (e) {
        this.logger.error('Fused position listener error:', e);
      }
    }

    const status = this.getStatus();
    for (const cb of this.statusCallbacks) {
      try {
        cb(status);
      } catch (e) {
        this.logger.error('Fusion status listener error:', e);
      }
    }
  }
}

