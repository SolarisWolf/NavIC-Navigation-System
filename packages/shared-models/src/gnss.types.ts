/**
 * @navic/shared-models — GNSS Type Definitions
 *
 * Core types for GNSS measurements, satellite information, and position data.
 * These types are shared across the GNSS simulator, position engine, and EKF.
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

/**
 * Satellite constellation identifiers.
 * NavIC (IRNSS) is the Indian Regional Navigation Satellite System.
 */
export enum Constellation {
  GPS = 'GPS',
  NavIC = 'NavIC', // Also known as IRNSS
  Galileo = 'Galileo',
  BeiDou = 'BeiDou',
  GLONASS = 'GLONASS',
  SBAS = 'SBAS',
  QZSS = 'QZSS',
  Unknown = 'Unknown',
}

/**
 * GNSS fix quality classification.
 */
export enum FixType {
  NoFix = 'NoFix',
  Fix2D = '2D',
  Fix3D = '3D',
  DGPS = 'DGPS',
  RTK_Float = 'RTK_Float',
  RTK_Fixed = 'RTK_Fixed',
}

// ─── Satellite Information ───────────────────────────────────────────────────

/**
 * Information about a single satellite as observed by the receiver.
 */
export interface SatelliteInfo {
  /** Space Vehicle ID */
  readonly svid: number;

  /** Which constellation this satellite belongs to */
  readonly constellation: Constellation;

  /** Signal-to-Noise Ratio in dB-Hz (0 = not tracking) */
  readonly snr: number;

  /** Elevation angle in degrees (0–90) */
  readonly elevation: number;

  /** Azimuth angle in degrees (0–360) */
  readonly azimuth: number;

  /** Whether this satellite is used in the current position fix */
  readonly usedInFix: boolean;
}

// ─── Position & Measurement ──────────────────────────────────────────────────

/**
 * A single GNSS measurement from the receiver (or simulator).
 * This is the primary output of the GNSS provider.
 */
export interface GNSSMeasurement {
  /** Unix timestamp in milliseconds */
  readonly timestamp: number;

  /** Latitude in decimal degrees (WGS84) */
  readonly latitude: number;

  /** Longitude in decimal degrees (WGS84) */
  readonly longitude: number;

  /** Altitude in meters above WGS84 ellipsoid */
  readonly altitude: number;

  /** Speed over ground in m/s */
  readonly speed: number;

  /** Bearing/heading in degrees (0–360, clockwise from north) */
  readonly bearing: number;

  /** Estimated horizontal accuracy in meters (1σ) */
  readonly horizontalAccuracy: number;

  /** Estimated vertical accuracy in meters (1σ) */
  readonly verticalAccuracy: number;

  /** Fix quality classification */
  readonly fixType: FixType;

  /** All visible satellites */
  readonly satellites: readonly SatelliteInfo[];

  /** Whether this measurement is from a simulator */
  readonly isSimulated: boolean;
}

// ─── Satellite Summary ───────────────────────────────────────────────────────

/**
 * Aggregated satellite counts by constellation.
 */
export interface SatelliteSummary {
  readonly total: number;
  readonly usedInFix: number;
  readonly byConstellation: Readonly<Record<Constellation, number>>;
}

// ─── GNSS Provider Interface ─────────────────────────────────────────────────

/**
 * Callback invoked when a new GNSS measurement is available.
 */
export type GNSSMeasurementCallback = (measurement: GNSSMeasurement) => void;

/**
 * Callback invoked when GNSS status changes (e.g., fix lost/acquired).
 */
export type GNSSStatusCallback = (status: GNSSStatus) => void;

/**
 * GNSS provider status.
 */
export interface GNSSStatus {
  readonly isActive: boolean;
  readonly hasfix: boolean;
  readonly fixType: FixType;
  readonly isSimulated: boolean;
  readonly lastUpdateTimestamp: number | null;
}

/**
 * Abstract interface for GNSS data sources.
 * Implementations include the simulator (Phase 2) and Android GNSS (Phase 15).
 *
 * IMPORTANT: When isSimulated is true, all UI must display "SIMULATION MODE".
 */
export interface GNSSProvider {
  /** Human-readable name of this provider (e.g., "GNSS Simulator", "Android GNSS") */
  readonly name: string;

  /** Whether this provider produces simulated data */
  readonly isSimulated: boolean;

  /** Start producing GNSS measurements */
  start(): void;

  /** Stop producing GNSS measurements */
  stop(): void;

  /** Register a callback for new measurements */
  onMeasurement(callback: GNSSMeasurementCallback): void;

  /** Register a callback for status changes */
  onStatusChange(callback: GNSSStatusCallback): void;

  /** Get current provider status */
  getStatus(): GNSSStatus;
}
