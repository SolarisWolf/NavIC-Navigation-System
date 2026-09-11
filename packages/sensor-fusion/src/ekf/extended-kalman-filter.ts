/**
 * @navic/sensor-fusion — Extended Kalman Filter
 *
 * 7-State Kinematic Extended Kalman Filter fusing 50 Hz IMU predictions
 * with 1 Hz GNSS measurement updates.
 *
 * Fully pre-allocated Float64Array-backed matrices for zero garbage collection
 * overhead during continuous 50 Hz navigation cycles.
 * Numerically stabilized using the Joseph-form covariance measurement update.
 *
 * State Vector:
 *   x[0] = East position (meters in local ENU)
 *   x[1] = North position (meters in local ENU)
 *   x[2] = Up position (meters in local ENU)
 *   x[3] = Forward velocity (m/s)
 *   x[4] = Heading / Yaw angle (radians, 0 = North, pi/2 = East, clockwise)
 *   x[5] = Forward accelerometer bias (m/s²)
 *   x[6] = Gyroscope yaw rate bias (rad/s)
 */

import {
  Float64Matrix,
  normalizeAngleRad,
  normalizeAngleDeg,
  type Matrix,
  type Vector,
} from '../math/matrix.js';

export interface EKFState {
  east: number;
  north: number;
  up: number;
  speed: number;
  bearingRad: number;
  bearingDeg: number;
  accelBias: number;
  gyroBias: number;
  accuracy: number; // 1-sigma horizontal position uncertainty in meters
  latencyMs: number;
}

export interface GNSSObservation {
  east: number;
  north: number;
  up: number;
  speed: number;
  bearingRad: number;
  horizontalAccuracy: number;
  verticalAccuracy: number;
}

export class ExtendedKalmanFilter {
  // 7-element state vector
  private x: Float64Array = new Float64Array(7);

  // 7x7 error covariance matrix
  private P: Float64Matrix = new Float64Matrix(7, 7);

  // Process noise parameters
  private qPos = 0.05;      // Position noise (m²/s)
  private qVel = 0.2;       // Velocity noise (m²/s³)
  private qHeading = 0.01;   // Heading noise (rad²/s)
  private qAccelBias = 0.001;// Accel bias drift ((m/s²)²/s)
  private qGyroBias = 0.0001;// Gyro bias drift ((rad/s)²/s)

  private isInitialized = false;
  private lastLatencyMs = 0;
  private predictCycleCount = 0;

  // ─── Pre-allocated Scratch Buffers (Predict Step) ──────────────────────────
  private F: Float64Matrix = new Float64Matrix(7, 7);
  private Q: Float64Matrix = new Float64Matrix(7, 7);
  private bufFP: Float64Matrix = new Float64Matrix(7, 7);
  private bufFT: Float64Matrix = new Float64Matrix(7, 7);
  private bufFPFT: Float64Matrix = new Float64Matrix(7, 7);

  // ─── Pre-allocated Scratch Buffers (Update Step & Joseph Form) ─────────────
  private H: Float64Matrix = new Float64Matrix(5, 7);
  private bufHT: Float64Matrix = new Float64Matrix(7, 5);
  private R: Float64Matrix = new Float64Matrix(5, 5);
  private bufHP: Float64Matrix = new Float64Matrix(5, 7);
  private bufHPHT: Float64Matrix = new Float64Matrix(5, 5);
  private bufS: Float64Matrix = new Float64Matrix(5, 5);
  private bufSInv: Float64Matrix = new Float64Matrix(5, 5);
  private augScratch: Float64Array = new Float64Array(5 * 10);
  private bufPHT: Float64Matrix = new Float64Matrix(7, 5);
  private bufK: Float64Matrix = new Float64Matrix(7, 5);
  private bufKT: Float64Matrix = new Float64Matrix(5, 7);
  private bufKy: Float64Array = new Float64Array(7);
  private y: Float64Array = new Float64Array(5);

  // Joseph-form matrices: P = (I - KH) P (I - KH)^T + K R K^T
  private I7: Float64Matrix = new Float64Matrix(7, 7);
  private bufKH: Float64Matrix = new Float64Matrix(7, 7);
  private bufIKH: Float64Matrix = new Float64Matrix(7, 7);
  private bufIKHT: Float64Matrix = new Float64Matrix(7, 7);
  private bufIKH_P: Float64Matrix = new Float64Matrix(7, 7);
  private bufTerm1: Float64Matrix = new Float64Matrix(7, 7);
  private bufKR: Float64Matrix = new Float64Matrix(7, 5);
  private bufTerm2: Float64Matrix = new Float64Matrix(7, 7);

  constructor() {
    this.I7.setIdentity();
    // Observation matrix H: directly measures East, North, Up, Speed, Bearing
    this.H.setZero();
    this.H.set(0, 0, 1.0);
    this.H.set(1, 1, 1.0);
    this.H.set(2, 2, 1.0);
    this.H.set(3, 3, 1.0);
    this.H.set(4, 4, 1.0);
    this.reset();
  }

  /**
   * Resets the filter to initial state.
   */
  public reset(): void {
    this.x.fill(0);
    this.P.setIdentity();

    // Initial uncertainty
    this.P.set(0, 0, 25.0); // East pos (5m std)
    this.P.set(1, 1, 25.0); // North pos (5m std)
    this.P.set(2, 2, 25.0); // Up pos (5m std)
    this.P.set(3, 3, 4.0);  // Velocity (2 m/s std)
    this.P.set(4, 4, 0.2);  // Heading (~25 deg std)
    this.P.set(5, 5, 0.5);  // Accel bias
    this.P.set(6, 6, 0.05); // Gyro bias

    this.isInitialized = false;
    this.lastLatencyMs = 0;
    this.predictCycleCount = 0;
  }

  /**
   * Initializes or re-anchors the filter state directly from an initial fix.
   */
  public initialize(east: number, north: number, up: number, speed: number, bearingRad: number): void {
    this.x[0] = east;
    this.x[1] = north;
    this.x[2] = up;
    this.x[3] = Math.max(0, speed);
    this.x[4] = normalizeAngleRad(bearingRad);
    this.x[5] = 0; // Reset biases
    this.x[6] = 0;

    // Reset covariance
    this.P.setIdentity();
    this.P.set(0, 0, 9.0);
    this.P.set(1, 1, 9.0);
    this.P.set(2, 2, 9.0);
    this.P.set(3, 3, 1.0);
    this.P.set(4, 4, 0.05);
    this.P.set(5, 5, 0.1);
    this.P.set(6, 6, 0.01);

    this.isInitialized = true;
    this.predictCycleCount = 0;
  }

  public get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Prediction step driven by high-frequency IMU telemetry (typically 50 Hz).
   *
   * @param dt Elapsed time in seconds since last prediction step.
   * @param forwardAccel Forward linear acceleration in m/s² (from Accelerometer).
   * @param yawRate Angular velocity around vertical yaw axis in rad/s (from Gyroscope).
   */
  public predict(dt: number, forwardAccel: number, yawRate: number): void {
    if (!this.isInitialized || dt <= 0) return;

    const t0 = performance.now();

    // 1. Remove estimated biases
    const unbiasedAccel = forwardAccel - this.x[5];
    const unbiasedYawRate = yawRate - this.x[6];

    // 2. Kinematic state propagation
    const thetaOld = this.x[4];
    const vOld = this.x[3];

    // Propagate heading
    const thetaNew = normalizeAngleRad(thetaOld + unbiasedYawRate * dt);

    // Propagate forward velocity (bound non-negative for land vehicle)
    const vNew = Math.max(0, vOld + unbiasedAccel * dt);

    // Average angle during step for midpoint integration
    const avgTheta = normalizeAngleRad(thetaOld + 0.5 * unbiasedYawRate * dt);
    const avgVel = 0.5 * (vOld + vNew);

    // East / North position updates: East = v * sin(heading), North = v * cos(heading)
    const dEast = avgVel * Math.sin(avgTheta) * dt;
    const dNorth = avgVel * Math.cos(avgTheta) * dt;

    this.x[0] += dEast;
    this.x[1] += dNorth;
    this.x[3] = vNew;
    this.x[4] = thetaNew;

    // 3. State Transition Jacobian Matrix F (7x7)
    this.F.setIdentity();
    const sinTheta = Math.sin(avgTheta);
    const cosTheta = Math.cos(avgTheta);

    // d(pE)/dv
    this.F.set(0, 3, sinTheta * dt);
    // d(pE)/d(theta)
    this.F.set(0, 4, avgVel * cosTheta * dt);
    // d(pE)/d(accelBias)
    this.F.set(0, 5, -0.5 * sinTheta * dt * dt);
    // d(pE)/d(gyroBias)
    this.F.set(0, 6, -0.5 * avgVel * cosTheta * dt * dt);

    // d(pN)/dv
    this.F.set(1, 3, cosTheta * dt);
    // d(pN)/d(theta)
    this.F.set(1, 4, -avgVel * sinTheta * dt);
    // d(pN)/d(accelBias)
    this.F.set(1, 5, -0.5 * cosTheta * dt * dt);
    // d(pN)/d(gyroBias)
    this.F.set(1, 6, 0.5 * avgVel * sinTheta * dt * dt);

    // d(v)/d(accelBias)
    this.F.set(3, 5, -dt);

    // d(theta)/d(gyroBias)
    this.F.set(4, 6, -dt);

    // 4. Process Noise Matrix Q (7x7)
    this.Q.setZero();
    this.Q.set(0, 0, this.qPos * dt);
    this.Q.set(1, 1, this.qPos * dt);
    this.Q.set(2, 2, this.qPos * dt);
    this.Q.set(3, 3, this.qVel * dt);
    this.Q.set(4, 4, this.qHeading * dt);
    this.Q.set(5, 5, this.qAccelBias * dt);
    this.Q.set(6, 6, this.qGyroBias * dt);

    // 5. Covariance propagation: P = F * P * F^T + Q
    Float64Matrix.multiply(this.F, this.P, this.bufFP);
    Float64Matrix.transpose(this.F, this.bufFT);
    Float64Matrix.multiply(this.bufFP, this.bufFT, this.bufFPFT);
    Float64Matrix.add(this.bufFPFT, this.Q, this.P);

    // Batched symmetrization: only symmetrize every 50 cycles (1s) during high-frequency prediction
    // Full symmetrization is always performed during updateGNSS
    this.predictCycleCount++;
    if (this.predictCycleCount >= 50) {
      Float64Matrix.symmetrize(this.P);
      this.predictCycleCount = 0;
    }

    this.lastLatencyMs = performance.now() - t0;
  }

  /**
   * Measurement update step driven by GNSS position fix (typically 1 Hz).
   * Uses numerically stable Joseph-form covariance update:
   * P = (I - K*H) * P * (I - K*H)^T + K * R * K^T
   *
   * @param obs GNSS observation transformed to local ENU.
   */
  public updateGNSS(obs: GNSSObservation): void {
    const t0 = performance.now();

    if (!this.isInitialized) {
      this.initialize(obs.east, obs.north, obs.up, obs.speed, obs.bearingRad);
      return;
    }

    // Measurement Covariance Matrix R (5x5)
    this.R.setZero();
    const posVar = Math.max(0.5, obs.horizontalAccuracy * obs.horizontalAccuracy);
    const vertVar = Math.max(1.0, obs.verticalAccuracy * obs.verticalAccuracy);
    this.R.set(0, 0, posVar);
    this.R.set(1, 1, posVar);
    this.R.set(2, 2, vertVar);
    this.R.set(3, 3, 0.25); // 0.5 m/s speed std dev

    // Bearing variance is high if stationary, low if moving
    if (this.x[3] < 0.5 && obs.speed < 0.5) {
      this.R.set(4, 4, 100.0); // High uncertainty on bearing when stopped
    } else {
      this.R.set(4, 4, 0.03); // ~10 deg std dev (0.17 rad)
    }

    // Innovation residual y = z - H*x
    this.y[0] = obs.east - this.x[0];
    this.y[1] = obs.north - this.x[1];
    this.y[2] = obs.up - this.x[2];
    this.y[3] = obs.speed - this.x[3];
    this.y[4] = normalizeAngleRad(obs.bearingRad - this.x[4]); // Wrapped angle residual

    // Innovation covariance S = H * P * H^T + R (5x5)
    Float64Matrix.multiply(this.H, this.P, this.bufHP);
    Float64Matrix.transpose(this.H, this.bufHT);
    Float64Matrix.multiply(this.bufHP, this.bufHT, this.bufHPHT);
    Float64Matrix.add(this.bufHPHT, this.R, this.bufS);

    // Kalman Gain K = P * H^T * S^-1 (7x5)
    Float64Matrix.invert(this.bufS, this.bufSInv, this.augScratch);
    Float64Matrix.multiply(this.P, this.bufHT, this.bufPHT);
    Float64Matrix.multiply(this.bufPHT, this.bufSInv, this.bufK);

    // State update x = x + K * y
    Float64Matrix.multiplyVector(this.bufK, this.y, this.bufKy);
    for (let i = 0; i < 7; i++) {
      this.x[i] += this.bufKy[i];
    }
    this.x[3] = Math.max(0, this.x[3]); // velocity >= 0
    this.x[4] = normalizeAngleRad(this.x[4]); // wrap heading

    // Joseph-form covariance update:
    // P = (I - K*H) * P * (I - K*H)^T + K * R * K^T
    // Term 1: (I - KH) * P * (I - KH)^T
    Float64Matrix.multiply(this.bufK, this.H, this.bufKH);
    Float64Matrix.sub(this.I7, this.bufKH, this.bufIKH);
    Float64Matrix.transpose(this.bufIKH, this.bufIKHT);
    Float64Matrix.multiply(this.bufIKH, this.P, this.bufIKH_P);
    Float64Matrix.multiply(this.bufIKH_P, this.bufIKHT, this.bufTerm1);

    // Term 2: K * R * K^T
    Float64Matrix.transpose(this.bufK, this.bufKT);
    Float64Matrix.multiply(this.bufK, this.R, this.bufKR);
    Float64Matrix.multiply(this.bufKR, this.bufKT, this.bufTerm2);

    // P = Term 1 + Term 2
    Float64Matrix.add(this.bufTerm1, this.bufTerm2, this.P);

    // Symmetrize P to maintain positive semi-definiteness
    Float64Matrix.symmetrize(this.P);

    this.lastLatencyMs = performance.now() - t0;
  }

  /**
   * Returns current estimated state.
   */
  public getState(): EKFState {
    const bearingRad = this.x[4];
    const bearingDeg = normalizeAngleDeg((bearingRad * 180.0) / Math.PI);

    // Position uncertainty 1-sigma radius: sqrt(P[0][0] + P[1][1])
    const accuracy = Math.sqrt(Math.max(0, this.P.get(0, 0)) + Math.max(0, this.P.get(1, 1)));

    return {
      east: this.x[0],
      north: this.x[1],
      up: this.x[2],
      speed: this.x[3],
      bearingRad,
      bearingDeg,
      accelBias: this.x[5],
      gyroBias: this.x[6],
      accuracy,
      latencyMs: this.lastLatencyMs,
    };
  }

  /**
   * Returns the main diagonal elements of the 7x7 covariance matrix P.
   * Useful for uncertainty telemetry, sanity checks, and stress diagnostics.
   */
  public getCovarianceDiagonal(): number[] {
    return [
      this.P.get(0, 0),
      this.P.get(1, 1),
      this.P.get(2, 2),
      this.P.get(3, 3),
      this.P.get(4, 4),
      this.P.get(5, 5),
      this.P.get(6, 6),
    ];
  }

  /**
   * Returns a copy of the 7x7 covariance matrix P as a 2D array.
   */
  public getCovariance(): Matrix {
    return this.P.to2DArray();
  }
}
