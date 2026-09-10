/**
 * Power & Battery Optimization Types
 *
 * Enums and interfaces for battery monitoring, power saving profiles,
 * vehicle motion dynamics classification, and adaptive sensor throttling.
 */

/**
 * Operating power profile mode of the navigation system.
 */
export enum PowerProfileMode {
  /** High performance: 50 Hz IMU, 60 FPS rendering, full satellite tracking */
  NORMAL = 'NORMAL',
  /** Power conservation: 25 Hz IMU, 30 FPS rendering, reduced micro-animations */
  POWER_SAVER = 'POWER_SAVER',
  /** Critical battery (<= 10%): 10 Hz IMU, 15 FPS rendering, minimal UI load */
  CRITICAL = 'CRITICAL',
}

/**
 * Vehicle movement dynamics state evaluated from velocity and acceleration telemetry.
 */
export enum VehicleDynamicsState {
  /** Stopped or idling (< 0.8 m/s for > 8 seconds) */
  STATIONARY = 'STATIONARY',
  /** Maneuvering in city traffic (0.8 m/s - 15 m/s) */
  IN_MOTION = 'IN_MOTION',
  /** Fast highway cruising (> 15 m/s / > 54 km/h) */
  HIGHWAY_CRUISE = 'HIGHWAY_CRUISE',
}

/**
 * Real-time battery and power hardware telemetry.
 */
export interface BatteryTelemetry {
  /** Battery charge percentage (0 - 100) */
  readonly levelPercent: number;
  /** Whether the device is connected to a power source */
  readonly isCharging: boolean;
  /** Power source when charging */
  readonly chargingSource?: 'AC' | 'USB' | 'WIRELESS' | 'UNKNOWN';
  /** Battery temperature in degrees Celsius (e.g. 32.5 °C) */
  readonly temperatureCelsius?: number;
  /** Battery voltage in millivolts (e.g. 3950 mV) */
  readonly voltageMv?: number;
  /** Battery operational health assessment */
  readonly health?: 'GOOD' | 'OVERHEAT' | 'DEGRADED';
  /** Estimated hours of navigation guidance remaining under current workload */
  readonly estimatedHoursRemaining: number;
}

/**
 * Current status of the power optimization engine.
 */
export interface PowerOptimizationStatus {
  /** Active power profile mode */
  readonly profileMode: PowerProfileMode;
  /** Whether power saver mode is active (manual or auto-triggered) */
  readonly isPowerSaverActive: boolean;
  /** Auto-enable power saver threshold percentage (default: 20%) */
  readonly autoPowerSaverThreshold: number;
  /** Screen WakeLock status */
  readonly isWakeLockActive: boolean;
  /** Whether adaptive sensor throttling when stationary is enabled */
  readonly isAdaptiveThrottlingEnabled: boolean;
  /** Current vehicle dynamics classification */
  readonly vehicleDynamics: VehicleDynamicsState;
  /** Target IMU sampling rate (Hz) based on dynamics and profile */
  readonly activeImuRateHz: number;
  /** Target map rendering refresh rate limit (FPS) */
  readonly mapFpsLimit: number;
  /** Latest battery telemetry */
  readonly battery: BatteryTelemetry;
}

export type PowerStatusListener = (status: PowerOptimizationStatus) => void;
