/**
 * @navic/sensor-fusion — Extended Kalman Filter
 *
 * 7-State Kinematic Extended Kalman Filter fusing 50 Hz IMU predictions
 * with 1 Hz GNSS measurement updates.
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
  Matrix,
  Vector,
  createMatrix,
  identityMatrix,
  matrixAdd,
  matrixSub,
  matrixMultiply,
  matrixTranspose,
  matrixMultiplyVector,
  matrixInverse,
  normalizeAngleRad,
  normalizeAngleDeg,
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
  private x: Vector = [0, 0, 0, 0, 0, 0, 0];

  // 7x7 error covariance matrix
  private P: Matrix = identityMatrix(7);

  // Process noise parameters
  private qPos = 0.05;      // Position noise (m²/s)
  private qVel = 0.2;       // Velocity noise (m²/s³)
  private qHeading = 0.01;   // Heading noise (rad²/s)
  private qAccelBias = 0.001;// Accel bias drift ((m/s²)²/s)
  private qGyroBias = 0.0001;// Gyro bias drift ((rad/s)²/s)

  private isInitialized = false;
  private lastLatencyMs = 0;

  constructor() {
    this.reset();
  }

  /**
   * Resets the filter to initial state.
   */
  public reset(): void {
    this.x = [0, 0, 0, 0, 0, 0, 0];
    this.P = identityMatrix(7);

    // Initial uncertainty
    this.P[0][0] = 25.0; // East pos (5m std)
    this.P[1][1] = 25.0; // North pos (5m std)
    this.P[2][2] = 25.0; // Up pos (5m std)
    this.P[3][3] = 4.0;  // Velocity (2 m/s std)
    this.P[4][4] = 0.2;  // Heading (~25 deg std)
    this.P[5][5] = 0.5;  // Accel bias
    this.P[6][6] = 0.05; // Gyro bias

    this.isInitialized = false;
    this.lastLatencyMs = 0;
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
    this.P = identityMatrix(7);
    this.P[0][0] = 9.0;
    this.P[1][1] = 9.0;
    this.P[2][2] = 9.0;
    this.P[3][3] = 1.0;
    this.P[4][4] = 0.05;
    this.P[5][5] = 0.1;
    this.P[6][6] = 0.01;

    this.isInitialized = true;
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
    const F = identityMatrix(7);
    const sinTheta = Math.sin(avgTheta);
    const cosTheta = Math.cos(avgTheta);

    // d(pE)/dv
    F[0][3] = sinTheta * dt;
    // d(pE)/d(theta)
    F[0][4] = avgVel * cosTheta * dt;
    // d(pE)/d(accelBias)
    F[0][5] = -0.5 * sinTheta * dt * dt;
    // d(pE)/d(gyroBias)
    F[0][6] = -0.5 * avgVel * cosTheta * dt * dt;

    // d(pN)/dv
    F[1][3] = cosTheta * dt;
    // d(pN)/d(theta)
    F[1][4] = -avgVel * sinTheta * dt;
    // d(pN)/d(accelBias)
    F[1][5] = -0.5 * cosTheta * dt * dt;
    // d(pN)/d(gyroBias)
    F[1][6] = 0.5 * avgVel * sinTheta * dt * dt;

    // d(v)/d(accelBias)
    F[3][5] = -dt;

    // d(theta)/d(gyroBias)
    F[4][6] = -dt;

    // 4. Process Noise Matrix Q (7x7)
    const Q = createMatrix(7, 7, 0);
    Q[0][0] = this.qPos * dt;
    Q[1][1] = this.qPos * dt;
    Q[2][2] = this.qPos * dt;
    Q[3][3] = this.qVel * dt;
    Q[4][4] = this.qHeading * dt;
    Q[5][5] = this.qAccelBias * dt;
    Q[6][6] = this.qGyroBias * dt;

    // 5. Covariance propagation: P = F * P * F^T + Q
    const FP = matrixMultiply(F, this.P);
    const FT = matrixTranspose(F);
    const FPFT = matrixMultiply(FP, FT);
    this.P = matrixAdd(FPFT, Q);

    // Symmetrize P
    this.symmetrizeP();

    this.lastLatencyMs = performance.now() - t0;
  }

  /**
   * Measurement update step driven by GNSS position fix (typically 1 Hz).
   *
   * @param obs GNSS observation transformed to local ENU.
   */
  public updateGNSS(obs: GNSSObservation): void {
    const t0 = performance.now();

    if (!this.isInitialized) {
      this.initialize(obs.east, obs.north, obs.up, obs.speed, obs.bearingRad);
      return;
    }

    // Measurement Vector z (5 elements: [east, north, up, speed, bearing])
    const z: Vector = [
      obs.east,
      obs.north,
      obs.up,
      obs.speed,
      obs.bearingRad,
    ];

    // Observation Matrix H (5x7)
    // Directly observes: x[0]=pE, x[1]=pN, x[2]=pU, x[3]=v, x[4]=theta
    const H = createMatrix(5, 7, 0);
    H[0][0] = 1;
    H[1][1] = 1;
    H[2][2] = 1;
    H[3][3] = 1;
    H[4][4] = 1;

    // Measurement Covariance Matrix R (5x5)
    const R = createMatrix(5, 5, 0);
    const posVar = Math.max(0.5, obs.horizontalAccuracy * obs.horizontalAccuracy);
    const vertVar = Math.max(1.0, obs.verticalAccuracy * obs.verticalAccuracy);
    R[0][0] = posVar;
    R[1][1] = posVar;
    R[2][2] = vertVar;
    R[3][3] = 0.25; // 0.5 m/s speed std dev

    // Bearing variance is high if stationary, low if moving
    if (this.x[3] < 0.5 && obs.speed < 0.5) {
      R[4][4] = 100.0; // High uncertainty on bearing when stopped
    } else {
      R[4][4] = 0.03; // ~10 deg std dev (0.17 rad)
    }

    // Innovation residual y = z - H*x
    const y: Vector = [
      z[0] - this.x[0],
      z[1] - this.x[1],
      z[2] - this.x[2],
      z[3] - this.x[3],
      normalizeAngleRad(z[4] - this.x[4]), // Wrapped angle residual
    ];

    // Innovation covariance S = H * P * H^T + R (5x5)
    const HP = matrixMultiply(H, this.P);
    const HT = matrixTranspose(H);
    const HPHT = matrixMultiply(HP, HT);
    const S = matrixAdd(HPHT, R);

    // Kalman Gain K = P * H^T * S^-1 (7x5)
    const SInv = matrixInverse(S);
    const PHT = matrixMultiply(this.P, HT);
    const K = matrixMultiply(PHT, SInv);

    // State update x = x + K * y
    const Ky = matrixMultiplyVector(K, y);
    for (let i = 0; i < 7; i++) {
      this.x[i] += Ky[i];
    }
    this.x[3] = Math.max(0, this.x[3]); // velocity >= 0
    this.x[4] = normalizeAngleRad(this.x[4]); // wrap heading

    // Covariance update P = (I - K * H) * P
    const I7 = identityMatrix(7);
    const KH = matrixMultiply(K, H);
    const I_minus_KH = matrixSub(I7, KH);
    this.P = matrixMultiply(I_minus_KH, this.P);

    this.symmetrizeP();

    this.lastLatencyMs = performance.now() - t0;
  }

  /**
   * Returns current estimated state.
   */
  public getState(): EKFState {
    const bearingRad = this.x[4];
    let bearingDeg = normalizeAngleDeg((bearingRad * 180.0) / Math.PI);

    // Position uncertainty 1-sigma radius: sqrt(P[0][0] + P[1][1])
    const accuracy = Math.sqrt(Math.max(0, this.P[0][0]) + Math.max(0, this.P[1][1]));

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
    return this.P.map((row, i) => row[i]);
  }

  /**
   * Returns a copy of the 7x7 covariance matrix P.
   */
  public getCovariance(): Matrix {
    return this.P.map(row => [...row]);
  }

  /**
   * Symmetrizes the error covariance matrix P to maintain numerical stability.
   */
  private symmetrizeP(): void {
    for (let i = 0; i < 7; i++) {
      for (let j = i + 1; j < 7; j++) {
        const val = 0.5 * (this.P[i][j] + this.P[j][i]);
        this.P[i][j] = val;
        this.P[j][i] = val;
      }
      // Ensure positive diagonal
      if (this.P[i][i] < 1e-9) {
        this.P[i][i] = 1e-9;
      }
    }
  }
}
