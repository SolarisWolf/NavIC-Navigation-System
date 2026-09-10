/**
 * @navic/shared-models — GNSS Position Engine Type Definitions
 *
 * Types for processed GNSS positions, Dilution of Precision (DOP),
 * outlier rejection, and fix quality metrics.
 */

import { Coordinate } from './navigation.types.js';
import { FixType } from './gnss.types.js';

/**
 * Geometric Dilution of Precision (DOP) metrics.
 * Quantifies the mathematical multiplier on error due to satellite geometry.
 */
export interface DilutionOfPrecision {
  /** Horizontal Dilution of Precision (latitude & longitude) */
  readonly hdop: number;

  /** Vertical Dilution of Precision (altitude) */
  readonly vdop: number;

  /** Position 3D Dilution of Precision */
  readonly pdop: number;

  /** Geometric Dilution of Precision (includes receiver clock bias) */
  readonly gdop: number;
}

/**
 * Output of the GNSS Position Engine.
 * A validated, smoothed, outlier-filtered GNSS position estimate with
 * satellite geometry metrics and NavIC assistance identification.
 */
export interface GNSSPosition {
  /** Unix timestamp in milliseconds */
  readonly timestamp: number;

  /** Smoothed geographic coordinate (WGS84) */
  readonly coordinate: Coordinate;

  /** Raw geographic coordinate before smoothing */
  readonly rawCoordinate: Coordinate;

  /** Filtered speed over ground in m/s */
  readonly speed: number;

  /** Filtered heading in degrees [0, 360) with stationary lock */
  readonly bearing: number;

  /** Estimated 1-sigma horizontal accuracy in meters (weighted by HDOP & SNR) */
  readonly horizontalAccuracy: number;

  /** Estimated 1-sigma vertical accuracy in meters (weighted by VDOP) */
  readonly verticalAccuracy: number;

  /** Geometric Dilution of Precision */
  readonly dop: DilutionOfPrecision;

  /** Fix quality classification */
  readonly fixType: FixType;

  /** Whether NavIC satellites are actively contributing to the navigation fix */
  readonly isNavICAssisted: boolean;

  /** Number of NavIC satellites used in this fix */
  readonly navicSatellitesUsed: number;

  /** Total satellites used across all constellations */
  readonly satellitesUsed: number;

  /** Total visible satellites tracked */
  readonly totalSatellites: number;

  /** Whether the incoming measurement had an outlier jump rejected */
  readonly outlierRejected: boolean;
}

/**
 * Tuning parameters for the GNSS Position Engine.
 */
export interface PositionEngineConfig {
  /** Timeout in ms before declaring loss of fix (default: 1500 ms) */
  readonly lossOfFixTimeoutMs?: number;

  /** Exponential smoothing factor for position alpha (0.0 to 1.0, default: 0.7) */
  readonly smoothingFactor?: number;

  /** Maximum speed change rate in m/s² before flagging outlier jump (default: 30 m/s²) */
  readonly maxSpeedJumpMs?: number;

  /** Speed threshold below which bearing is locked to prevent jitter (default: 0.5 m/s) */
  readonly stationarySpeedThresholdMs?: number;
}

/** Callback for processed GNSS positions */
export type GNSSPositionCallback = (position: GNSSPosition) => void;

/** Callback for loss of fix notifications */
export type GNSSLossOfFixCallback = (lastTimestamp: number | null) => void;
