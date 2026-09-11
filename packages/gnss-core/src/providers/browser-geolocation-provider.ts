/**
 * Browser Geolocation Hardware Provider
 *
 * Connects the W3C Geolocation API (navigator.geolocation) to the NavIC
 * navigation pipeline. Enables testing navigation using the host laptop's
 * or phone's real hardware location sensors (via OS Location Services / Wi-Fi / Cell / GPS).
 *
 * All measurements emitted by this provider have `isSimulated: false`.
 */

import {
  type GNSSProvider,
  type GNSSMeasurement,
  type GNSSStatus,
  type GNSSMeasurementCallback,
  type GNSSStatusCallback,
  type SatelliteInfo,
  Constellation,
  FixType,
  Logger,
} from '@navic/shared-models';
import { computeVisibleSatellites } from '../simulator/index.js';

export interface BrowserGeolocationConfig {
  /** Optional custom Geolocation interface for testing or custom environments */
  geolocation?: Geolocation;
  /** High accuracy request flag (uses physical GNSS hardware if available) */
  enableHighAccuracy?: boolean;
  /** Maximum cached position age in ms */
  maximumAge?: number;
  /** Timeout for position request in ms */
  timeout?: number;
}

export class BrowserGeolocationProvider implements GNSSProvider {
  readonly name = 'Browser Geolocation Hardware';
  readonly isSimulated = false;
  private readonly logger = new Logger('BrowserGeolocationProvider');

  private geolocation: Geolocation | null = null;
  private watchId: number | null = null;
  private isRunning = false;
  private hasFix = false;
  private lastUpdateTimestamp: number | null = null;
  private lastMeasurement: GNSSMeasurement | null = null;

  private measurementCallbacks: Set<GNSSMeasurementCallback> = new Set();
  private statusCallbacks: Set<GNSSStatusCallback> = new Set();

  private config: Required<BrowserGeolocationConfig>;

  constructor(config: BrowserGeolocationConfig = {}) {
    const geo =
      config.geolocation ??
      (typeof navigator !== 'undefined' && 'geolocation' in navigator
        ? navigator.geolocation
        : undefined);

    this.geolocation = geo ?? null;
    this.config = {
      geolocation: this.geolocation as Geolocation,
      enableHighAccuracy: config.enableHighAccuracy ?? true,
      maximumAge: config.maximumAge ?? 1000,
      timeout: config.timeout ?? 10000,
    };
  }

  /**
   * Check if browser geolocation is supported in the current runtime.
   */
  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  }

  public start(): void {
    if (this.isRunning) return;

    if (!this.geolocation) {
      this.updateStatus(false, FixType.NoFix);
      console.warn('[BrowserGeolocationProvider] Geolocation API not available in this environment');
      return;
    }

    this.isRunning = true;

    try {
      this.watchId = this.geolocation.watchPosition(
        (position: GeolocationPosition) => {
          this.handlePosition(position);
        },
        (error: GeolocationPositionError) => {
          this.handleError(error);
        },
        {
          enableHighAccuracy: this.config.enableHighAccuracy,
          maximumAge: this.config.maximumAge,
          timeout: this.config.timeout,
        }
      );

      this.updateStatus(this.hasFix, this.hasFix ? FixType.Fix3D : FixType.NoFix);
    } catch (err) {
      this.logger.error('Failed to start watchPosition:', err);
      this.updateStatus(false, FixType.NoFix);
    }
  }

  public stop(): void {
    if (!this.isRunning) return;

    if (this.geolocation && this.watchId !== null) {
      try {
        this.geolocation.clearWatch(this.watchId);
      } catch (err) {
        this.logger.error('Error clearing watch:', err);
      }
      this.watchId = null;
    }

    this.isRunning = false;
    this.updateStatus(false, FixType.NoFix);
  }

  public onMeasurement(callback: GNSSMeasurementCallback): void {
    this.measurementCallbacks.add(callback);
    if (this.lastMeasurement) {
      try {
        callback(this.lastMeasurement);
      } catch (e) {
        this.logger.error('Error in measurement callback:', e);
      }
    }
  }

  public onStatusChange(callback: GNSSStatusCallback): void {
    this.statusCallbacks.add(callback);
    try {
      callback(this.getStatus());
    } catch (e) {
      this.logger.error('Error in status callback:', e);
    }
  }

  public getStatus(): GNSSStatus {
    return {
      isActive: this.isRunning,
      hasfix: this.hasFix,
      fixType: this.hasFix ? FixType.Fix3D : FixType.NoFix,
      isSimulated: false,
      lastUpdateTimestamp: this.lastUpdateTimestamp,
    };
  }

  public getLastMeasurement(): GNSSMeasurement | null {
    return this.lastMeasurement;
  }

  /**
   * Internal processor for GeolocationPosition updates.
   */
  public handlePosition(position: GeolocationPosition): void {
    const coords = position.coords;
    const now = position.timestamp || Date.now();
    this.lastUpdateTimestamp = now;
    this.hasFix = true;

    // Calculate visible satellites for this coordinate to populate skyview radar & NavIC status
    const visibleSats = computeVisibleSatellites(coords.latitude, coords.longitude, 0);

    const measurement: GNSSMeasurement = {
      timestamp: now,
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude ?? 216.0,
      speed: coords.speed !== null && !isNaN(coords.speed) ? Math.max(0, coords.speed) : 0,
      bearing: coords.heading !== null && !isNaN(coords.heading) ? coords.heading : 0,
      horizontalAccuracy: coords.accuracy || 5.0,
      verticalAccuracy: coords.altitudeAccuracy || (coords.accuracy ? coords.accuracy * 1.5 : 8.0),
      fixType: coords.altitude !== null ? FixType.Fix3D : FixType.Fix2D,
      satellites: visibleSats,
      isSimulated: false,
    };

    this.lastMeasurement = measurement;
    this.updateStatus(true, measurement.fixType);

    for (const cb of this.measurementCallbacks) {
      try {
        cb(measurement);
      } catch (err) {
        this.logger.error('Callback error:', err);
      }
    }
  }

  private handleError(error: GeolocationPositionError): void {
    this.logger.warn(`Geolocation error [${error.code}]: ${error.message}`);
    this.hasFix = false;
    this.updateStatus(false, FixType.NoFix);
  }

  private updateStatus(hasfix: boolean, fixType: FixType): void {
    this.hasFix = hasfix;
    const status = this.getStatus();
    for (const cb of this.statusCallbacks) {
      try {
        cb(status);
      } catch (err) {
        this.logger.error('Status callback error:', err);
      }
    }
  }
}
