/**
 * @navic/gnss-core — GNSS Position Engine
 *
 * The core positioning layer that validates, smooths, and enriches raw GNSS data.
 * Computes Dilution of Precision, rejects multipath outliers, locks stationary bearing,
 * detects loss-of-fix timeouts, and identifies NavIC constellation assistance.
 */

import {
  GNSSMeasurement,
  GNSSPosition,
  PositionEngineConfig,
  GNSSPositionCallback,
  GNSSLossOfFixCallback,
  GNSSProvider,
  FixType,
  Constellation,
  Coordinate,
  Logger,
} from '@navic/shared-models';

import { calculateDOP } from './dop-calculator.js';
import { OutlierFilter } from './outlier-filter.js';

export class PositionEngine {
  private logger = new Logger('PositionEngine');
  private outlierFilter: OutlierFilter;

  // Configuration
  private smoothingAlpha = 0.7; // Fallback / base smoothing
  private customSmoothingAlpha: number | null = null;
  private lossOfFixTimeoutMs = 1500;
  private stationarySpeedThresholdMs = 0.5;

  // Listeners
  private positionCallbacks: GNSSPositionCallback[] = [];
  private lossOfFixCallbacks: GNSSLossOfFixCallback[] = [];

  // Internal state
  private lastPosition: GNSSPosition | null = null;
  private lastSmoothedCoordinate: Coordinate | null = null;
  private lastStableBearing = 0;
  private lastMeasurementTime = 0;
  private watchdogTimeout: ReturnType<typeof setTimeout> | null = null;
  private hasFix = false;
  private isDestroyed = false;

  constructor(config?: PositionEngineConfig) {
    if (config?.smoothingFactor !== undefined) {
      this.smoothingAlpha = config.smoothingFactor;
      this.customSmoothingAlpha = config.smoothingFactor;
    }
    if (config?.lossOfFixTimeoutMs !== undefined) this.lossOfFixTimeoutMs = config.lossOfFixTimeoutMs;
    if (config?.stationarySpeedThresholdMs !== undefined) {
      this.stationarySpeedThresholdMs = config.stationarySpeedThresholdMs;
    }

    this.outlierFilter = new OutlierFilter({
      maxAccelerationMs2: config?.maxSpeedJumpMs ?? 35.0,
    });
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.watchdogTimeout) {
      clearTimeout(this.watchdogTimeout);
      this.watchdogTimeout = null;
    }
    this.positionCallbacks = [];
    this.lossOfFixCallbacks = [];
  }

  public reset(): void {
    if (this.watchdogTimeout) {
      clearTimeout(this.watchdogTimeout);
      this.watchdogTimeout = null;
    }
    this.lastPosition = null;
    this.lastSmoothedCoordinate = null;
    this.lastStableBearing = 0;
    this.lastMeasurementTime = 0;
    this.hasFix = false;
    this.outlierFilter.reset();
  }

  /**
   * Automatically connects and subscribes to any GNSSProvider (Simulator or Android Hardware).
   */
  public connectProvider(provider: GNSSProvider): void {
    provider.onMeasurement((m) => this.processMeasurement(m));
    this.logger.info(`Connected to provider: ${provider.name}`);
  }

  public onPosition(cb: GNSSPositionCallback): void {
    this.positionCallbacks.push(cb);
  }

  public onLossOfFix(cb: GNSSLossOfFixCallback): void {
    this.lossOfFixCallbacks.push(cb);
  }

  public getLastPosition(): GNSSPosition | null {
    return this.lastPosition;
  }

  /**
   * Main processing pipeline for raw GNSS measurements.
   */
  public processMeasurement(m: GNSSMeasurement): GNSSPosition {
    const now = Date.now();
    this.lastMeasurementTime = now;

    const isNoFix = m.fixType === FixType.NoFix || m.latitude === 0 || m.longitude === 0;

    if (isNoFix) {
      if (this.hasFix) {
        this.hasFix = false;
        this.emitLossOfFix(now);
      }
      const noFixPos = this.createEmptyPosition(m, now);
      this.lastPosition = noFixPos;
      this.emitPosition(noFixPos);
      return noFixPos;
    }

    this.hasFix = true;
    this.scheduleWatchdog();

    // 1. Check for kinematic outlier jumps
    const rawCoord: Coordinate = {
      latitude: m.latitude,
      longitude: m.longitude,
      altitude: m.altitude,
    };

    const outlierResult = this.outlierFilter.check(rawCoord, m.speed, m.timestamp || now);
    let outlierRejected = false;

    let targetCoord = rawCoord;
    if (outlierResult.isOutlier && this.lastSmoothedCoordinate) {
      this.logger.warn(`Rejected GNSS outlier jump: ${outlierResult.reason}`);
      outlierRejected = true;
      // Reject raw jump; retain previous smoothed coordinate
      targetCoord = this.lastSmoothedCoordinate;
    }

    // 2. Exponential smoothing of geographic coordinate with speed-adaptive alpha
    const smoothedCoord = this.applyCoordinateSmoothing(targetCoord, m.speed);

    // 3. Stationary heading lock
    let finalBearing = m.bearing;
    if (m.speed < this.stationarySpeedThresholdMs) {
      // Vehicle is stationary: lock bearing to previous valid heading to prevent erratic 360° jitter
      finalBearing = this.lastStableBearing;
    } else {
      this.lastStableBearing = m.bearing;
    }

    // 4. Calculate Dilution of Precision (DOP)
    const dop = calculateDOP(m.satellites);

    // 5. Accuracy estimation weighted by satellite geometry
    // Base accuracy scaled by HDOP/VDOP factor
    const hdopFactor = Math.max(0.7, Math.min(2.5, dop.hdop / 1.5));
    const vdopFactor = Math.max(0.7, Math.min(2.5, dop.vdop / 2.0));
    const horizAcc = Number((m.horizontalAccuracy * hdopFactor).toFixed(2));
    const vertAcc = Number((m.verticalAccuracy * vdopFactor).toFixed(2));

    // 6. Constellation analysis & NavIC contribution
    let navicUsed = 0;
    let totalUsed = 0;
    for (const sat of m.satellites) {
      if (sat.usedInFix) {
        totalUsed++;
        if (sat.constellation === Constellation.NavIC) {
          navicUsed++;
        }
      }
    }
    const isNavICAssisted = navicUsed > 0;

    // 7. Assemble final processed GNSSPosition
    const processedPos: GNSSPosition = {
      timestamp: m.timestamp || now,
      coordinate: smoothedCoord,
      rawCoordinate: rawCoord,
      speed: m.speed,
      bearing: finalBearing,
      horizontalAccuracy: horizAcc,
      verticalAccuracy: vertAcc,
      dop,
      fixType: m.fixType,
      isNavICAssisted,
      navicSatellitesUsed: navicUsed,
      satellitesUsed: totalUsed,
      totalSatellites: m.satellites.length,
      outlierRejected,
    };

    this.lastPosition = processedPos;
    this.emitPosition(processedPos);
    return processedPos;
  }

  private applyCoordinateSmoothing(target: Coordinate, speed = 0): Coordinate {
    if (!this.lastSmoothedCoordinate) {
      this.lastSmoothedCoordinate = target;
      return target;
    }

    // Speed-adaptive alpha: higher speed -> more responsive (less lag on curves); low speed -> heavier smoothing (rejects jitter)
    const a = this.customSmoothingAlpha !== null
      ? this.customSmoothingAlpha
      : Math.max(0.4, Math.min(0.95, 0.4 + speed * 0.02));

    const smoothed: Coordinate = {
      latitude: a * target.latitude + (1 - a) * this.lastSmoothedCoordinate.latitude,
      longitude: a * target.longitude + (1 - a) * this.lastSmoothedCoordinate.longitude,
      altitude:
        target.altitude !== undefined && this.lastSmoothedCoordinate.altitude !== undefined
          ? a * target.altitude + (1 - a) * this.lastSmoothedCoordinate.altitude
          : target.altitude,
    };

    this.lastSmoothedCoordinate = smoothed;
    return smoothed;
  }

  private createEmptyPosition(m: GNSSMeasurement, timestamp: number): GNSSPosition {
    return {
      timestamp,
      coordinate: { latitude: 0, longitude: 0, altitude: 0 },
      rawCoordinate: { latitude: 0, longitude: 0, altitude: 0 },
      speed: 0,
      bearing: this.lastStableBearing,
      horizontalAccuracy: 999,
      verticalAccuracy: 999,
      dop: { hdop: 99.9, vdop: 99.9, pdop: 99.9, gdop: 99.9 },
      fixType: FixType.NoFix,
      isNavICAssisted: false,
      navicSatellitesUsed: 0,
      satellitesUsed: 0,
      totalSatellites: m.satellites.length,
      outlierRejected: false,
    };
  }

  private scheduleWatchdog(): void {
    if (this.isDestroyed) return;
    if (this.watchdogTimeout) {
      clearTimeout(this.watchdogTimeout);
    }
    this.watchdogTimeout = setTimeout(() => {
      if (this.isDestroyed) return;
      if (this.hasFix && this.lastMeasurementTime > 0) {
        const elapsed = Date.now() - this.lastMeasurementTime;
        if (elapsed > this.lossOfFixTimeoutMs) {
          this.hasFix = false;
          this.logger.warn(`Loss of fix detected — no GNSS updates for ${elapsed}ms`);
          this.emitLossOfFix(this.lastMeasurementTime);
          return;
        }
      }
      if (this.hasFix) {
        this.scheduleWatchdog();
      }
    }, 500);
  }

  private emitPosition(pos: GNSSPosition): void {
    for (const cb of this.positionCallbacks) {
      try {
        cb(pos);
      } catch (e) {
        this.logger.error('Position callback error:', e);
      }
    }
  }

  private emitLossOfFix(timestamp: number | null): void {
    for (const cb of this.lossOfFixCallbacks) {
      try {
        cb(timestamp);
      } catch (e) {
        this.logger.error('Loss-of-fix callback error:', e);
      }
    }
  }
}

