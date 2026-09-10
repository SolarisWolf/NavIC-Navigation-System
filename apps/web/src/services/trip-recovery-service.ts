/**
 * @navic/web - Trip Recovery Service
 *
 * Manages persistent offline navigation state, enabling seamless recovery
 * if the app is closed, memory-reclaimed by Android, or restarted mid-route.
 * Also persists Android platform configuration (immersive mode, audio ducking,
 * trip recovery).
 */

import {
  ActiveTripState,
  AndroidPlatformSettings,
  DEFAULT_ANDROID_PLATFORM_SETTINGS,
  Logger,
} from '@navic/shared-models';

const STORAGE_KEY_TRIP = 'navic_active_trip_v1';
const STORAGE_KEY_SETTINGS = 'navic_android_platform_settings_v1';
const MAX_TRIP_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours shelf life

export class TripRecoveryService {
  private static instance: TripRecoveryService;
  private logger = new Logger('TripRecoveryService');
  private settings: AndroidPlatformSettings;
  private lastSaveTime = 0;
  private minSaveIntervalMs = 3000; // Throttle saves to at most once per 3s
  private tripRecovered = false;

  private constructor() {
    this.settings = this.loadSettings();
  }

  public static getInstance(): TripRecoveryService {
    if (!TripRecoveryService.instance) {
      TripRecoveryService.instance = new TripRecoveryService();
    }
    return TripRecoveryService.instance;
  }

  /**
   * Loads Android platform settings from local storage.
   */
  public loadSettings(): AndroidPlatformSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        return { ...DEFAULT_ANDROID_PLATFORM_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (err) {
      this.logger.warn('Failed to parse stored platform settings:', err);
    }
    return { ...DEFAULT_ANDROID_PLATFORM_SETTINGS };
  }

  /**
   * Updates Android platform integration settings.
   */
  public updateSettings(partial: Partial<AndroidPlatformSettings>): AndroidPlatformSettings {
    this.settings = { ...this.settings, ...partial };
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
      this.logger.info('Updated platform settings:', this.settings);
    } catch (err) {
      this.logger.warn('Failed to persist platform settings:', err);
    }
    return this.settings;
  }

  /**
   * Returns current Android platform integration settings.
   */
  public getSettings(): AndroidPlatformSettings {
    return { ...this.settings };
  }

  /**
   * Checks if an unfinished active navigation trip is available in storage.
   */
  public hasActiveTrip(): boolean {
    if (!this.settings.tripRecovery) return false;
    const trip = this.getStoredTrip();
    return trip !== null && trip.isNavigating && !this.tripRecovered;
  }

  /**
   * Retrieves the raw stored trip if it exists and hasn't expired.
   */
  public getStoredTrip(): ActiveTripState | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TRIP);
      if (!raw) return null;

      const trip: ActiveTripState = JSON.parse(raw);
      const age = Date.now() - (trip.savedAt || 0);

      if (age > MAX_TRIP_AGE_MS) {
        this.logger.info(`Expired trip found (${Math.round(age / 60000)}m old), clearing`);
        this.clearTrip();
        return null;
      }

      return trip;
    } catch (err) {
      this.logger.warn('Failed to parse active trip storage:', err);
      return null;
    }
  }

  /**
   * Persists the current navigation state (throttled).
   */
  public saveTrip(trip: ActiveTripState, force = false): void {
    if (!this.settings.tripRecovery) return;

    const now = Date.now();
    if (!force && now - this.lastSaveTime < this.minSaveIntervalMs) {
      return;
    }

    try {
      const snapshot: ActiveTripState = {
        ...trip,
        savedAt: now,
      };
      localStorage.setItem(STORAGE_KEY_TRIP, JSON.stringify(snapshot));
      this.lastSaveTime = now;
      this.tripRecovered = false;
    } catch (err) {
      this.logger.warn('Failed to save active trip:', err);
    }
  }

  /**
   * Clears saved trip from storage (called on arrival, trip cancel, or explicit discard).
   */
  public clearTrip(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_TRIP);
      this.tripRecovered = true;
      this.logger.info('Active trip cleared from storage');
    } catch (err) {
      this.logger.warn('Failed to clear trip storage:', err);
    }
  }

  /**
   * Marks that the stored trip has been handled (either resumed or dismissed)
   * so prompt doesn't repeatedly show.
   */
  public markTripHandled(): void {
    this.tripRecovered = true;
  }
}

export const tripRecoveryService = TripRecoveryService.getInstance();
