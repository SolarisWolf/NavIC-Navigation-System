/**
 * @navic/gnss-core — Outlier Filter
 *
 * Rejects erratic multipath spikes and GPS jumps by validating kinematic consistency
 * (implied velocity and acceleration against realistic land vehicle physical constraints).
 */

import { Coordinate, haversineDistance } from '@navic/shared-models';

export interface OutlierCheckResult {
  readonly isOutlier: boolean;
  readonly reason?: string;
  readonly impliedSpeedMs: number;
}

export class OutlierFilter {
  private maxAccelerationMs2: number;
  private maxAbsoluteSpeedMs: number;
  private maxJumpMeters: number;

  private lastCoordinate: Coordinate | null = null;
  private lastSpeedMs = 0;
  private lastTimestamp = 0;

  constructor(options?: {
    maxAccelerationMs2?: number;
    maxAbsoluteSpeedMs?: number;
    maxJumpMeters?: number;
  }) {
    this.maxAccelerationMs2 = options?.maxAccelerationMs2 ?? 35.0; // 35 m/s² (~3.5g)
    this.maxAbsoluteSpeedMs = options?.maxAbsoluteSpeedMs ?? 70.0;  // 70 m/s (~250 km/h)
    this.maxJumpMeters = options?.maxJumpMeters ?? 120.0;          // Max jump in 1 second
  }

  public reset(): void {
    this.lastCoordinate = null;
    this.lastSpeedMs = 0;
    this.lastTimestamp = 0;
  }

  /**
   * Checks whether a new GNSS measurement represents an impossible physical jump.
   */
  public check(coord: Coordinate, speed: number, timestamp: number): OutlierCheckResult {
    if (!this.lastCoordinate || this.lastTimestamp <= 0) {
      this.lastCoordinate = coord;
      this.lastSpeedMs = speed;
      this.lastTimestamp = timestamp;
      return { isOutlier: false, impliedSpeedMs: speed };
    }

    const dt = Math.max(0.01, (timestamp - this.lastTimestamp) / 1000.0);
    const dist = haversineDistance(
      this.lastCoordinate.latitude,
      this.lastCoordinate.longitude,
      coord.latitude,
      coord.longitude
    );
    const impliedSpeed = dist / dt;

    // Check 1: Excessive instantaneous jump
    if (dist > this.maxJumpMeters * dt) {
      return {
        isOutlier: true,
        reason: `Position jump (${dist.toFixed(1)}m in ${dt.toFixed(2)}s) exceeds max limit`,
        impliedSpeedMs: impliedSpeed,
      };
    }

    // Check 2: Absolute speed bound
    if (impliedSpeed > this.maxAbsoluteSpeedMs) {
      return {
        isOutlier: true,
        reason: `Implied speed (${impliedSpeed.toFixed(1)} m/s) exceeds physical vehicle limit`,
        impliedSpeedMs: impliedSpeed,
      };
    }

    // Check 3: Acceleration bound
    const accel = Math.abs(impliedSpeed - this.lastSpeedMs) / dt;
    if (accel > this.maxAccelerationMs2 && dt <= 2.0) {
      return {
        isOutlier: true,
        reason: `Acceleration (${accel.toFixed(1)} m/s²) exceeds physical limits`,
        impliedSpeedMs: impliedSpeed,
      };
    }

    // Valid measurement: update history
    this.lastCoordinate = coord;
    this.lastSpeedMs = speed;
    this.lastTimestamp = timestamp;

    return { isOutlier: false, impliedSpeedMs: impliedSpeed };
  }
}
