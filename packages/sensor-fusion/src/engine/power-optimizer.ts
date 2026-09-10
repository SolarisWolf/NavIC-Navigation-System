/**
 * Power Optimizer Engine
 *
 * Implements vehicle-dynamics-aware power management, adaptive IMU and map throttling,
 * battery health and discharge estimation, and multi-tier power saving profiles.
 */

import {
  PowerProfileMode,
  VehicleDynamicsState,
  type BatteryTelemetry,
  type PowerOptimizationStatus,
  type PowerStatusListener,
  Logger,
} from '@navic/shared-models';

export interface PowerOptimizerConfig {
  /** Speed threshold below which vehicle is considered stationary in m/s (default: 0.8 m/s ~= 3 km/h) */
  readonly stationarySpeedThresholdMs?: number;
  /** Duration in milliseconds vehicle must remain below threshold to enter STATIONARY state (default: 8000 ms) */
  readonly stationaryDebounceMs?: number;
  /** Speed threshold for highway cruising in m/s (default: 15.0 m/s ~= 54 km/h) */
  readonly highwaySpeedThresholdMs?: number;
  /** Battery percentage at which power saver mode auto-activates (default: 20%) */
  readonly autoPowerSaverThreshold?: number;
}

export class PowerOptimizer {
  private logger = new Logger('PowerOptimizer');

  private config: Required<PowerOptimizerConfig>;
  private profileMode: PowerProfileMode = PowerProfileMode.NORMAL;
  private isPowerSaverManual = false;
  private isPowerSaverActive = false;
  private isWakeLockActive = false;
  private isAdaptiveThrottlingEnabled = true;

  private vehicleDynamics: VehicleDynamicsState = VehicleDynamicsState.STATIONARY;
  private stationaryStartTime: number | null = null;
  private currentSpeedMs = 0;

  private battery: BatteryTelemetry = {
    levelPercent: 85,
    isCharging: false,
    chargingSource: 'UNKNOWN',
    temperatureCelsius: 31.5,
    voltageMv: 3950,
    health: 'GOOD',
    estimatedHoursRemaining: 5.6,
  };

  private listeners: Set<PowerStatusListener> = new Set();

  constructor(config: PowerOptimizerConfig = {}) {
    this.config = {
      stationarySpeedThresholdMs: config.stationarySpeedThresholdMs ?? 0.8,
      stationaryDebounceMs: config.stationaryDebounceMs ?? 8000,
      highwaySpeedThresholdMs: config.highwaySpeedThresholdMs ?? 15.0,
      autoPowerSaverThreshold: config.autoPowerSaverThreshold ?? 20,
    };

    this.recalculateState();
  }

  /**
   * Process vehicle speed updates to evaluate movement dynamics with anti-jitter debouncing.
   */
  public updateSpeed(speedMs: number, nowMs: number = Date.now()): void {
    this.currentSpeedMs = Math.max(0, speedMs);

    if (this.currentSpeedMs < this.config.stationarySpeedThresholdMs) {
      // Below movement threshold
      if (this.stationaryStartTime === null) {
        this.stationaryStartTime = nowMs;
      } else if (nowMs - this.stationaryStartTime >= this.config.stationaryDebounceMs) {
        if (this.vehicleDynamics !== VehicleDynamicsState.STATIONARY) {
          this.vehicleDynamics = VehicleDynamicsState.STATIONARY;
          this.logger.info('Vehicle stationary debounce elapsed -> STATIONARY state (power saving candidate)');
          this.recalculateState();
        }
      }
    } else {
      // Vehicle is moving; cancel stationary timer immediately
      this.stationaryStartTime = null;
      const nextDynamics = this.currentSpeedMs >= this.config.highwaySpeedThresholdMs
        ? VehicleDynamicsState.HIGHWAY_CRUISE
        : VehicleDynamicsState.IN_MOTION;

      if (this.vehicleDynamics !== nextDynamics) {
        this.vehicleDynamics = nextDynamics;
        this.logger.info(`Vehicle moving -> ${nextDynamics} state (full rate active)`);
        this.recalculateState();
      }
    }
  }

  /**
   * Update real-time battery telemetry from Android or Web Battery API.
   */
  public updateBattery(telemetry: Partial<BatteryTelemetry>): void {
    const prevLevel = this.battery.levelPercent;
    const prevCharging = this.battery.isCharging;

    this.battery = {
      ...this.battery,
      ...telemetry,
      levelPercent: Math.max(0, Math.min(100, telemetry.levelPercent ?? this.battery.levelPercent)),
    };

    // Calculate estimated hours remaining
    const hours = this.calculateEstimatedHours(this.battery.levelPercent, this.battery.isCharging, this.isPowerSaverActive);
    this.battery = {
      ...this.battery,
      estimatedHoursRemaining: hours,
    };

    // Check battery threshold transitions
    if (this.battery.levelPercent !== prevLevel || this.battery.isCharging !== prevCharging) {
      this.evaluateBatteryThresholds();
    }

    this.notifyListeners();
  }

  /**
   * Toggle manual Power Saver Mode override.
   */
  public setPowerSaverMode(enabled: boolean): void {
    this.isPowerSaverManual = enabled;
    this.isPowerSaverActive = enabled;
    this.recalculateState();
  }

  /**
   * Toggle screen WakeLock state.
   */
  public setWakeLockActive(active: boolean): void {
    if (this.isWakeLockActive !== active) {
      this.isWakeLockActive = active;
      this.logger.info(`WakeLock state changed: ${active ? 'ACQUIRED' : 'RELEASED'}`);
      this.notifyListeners();
    }
  }

  /**
   * Toggle adaptive sensor throttling based on vehicle dynamics.
   */
  public setAdaptiveThrottlingEnabled(enabled: boolean): void {
    if (this.isAdaptiveThrottlingEnabled !== enabled) {
      this.isAdaptiveThrottlingEnabled = enabled;
      this.logger.info(`Adaptive sensor throttling: ${enabled ? 'ENABLED' : 'DISABLED'}`);
      this.recalculateState();
    }
  }

  /**
   * Set the threshold at which power saver mode auto-activates.
   */
  public setAutoPowerSaverThreshold(thresholdPercent: number): void {
    (this.config as any).autoPowerSaverThreshold = Math.max(5, Math.min(50, thresholdPercent));
    this.evaluateBatteryThresholds();
  }

  /**
   * Get the current target IMU sampling frequency (Hz).
   */
  public getTargetImuRateHz(): number {
    if (this.profileMode === PowerProfileMode.CRITICAL) {
      return 10;
    }
    if (this.isPowerSaverActive) {
      return 25;
    }
    if (this.isAdaptiveThrottlingEnabled && this.vehicleDynamics === VehicleDynamicsState.STATIONARY) {
      return 10; // Throttle down when stopped
    }
    return 50; // Full 50 Hz in motion
  }

  /**
   * Get the current target map render frame rate limit (FPS).
   */
  public getTargetMapFpsLimit(): number {
    if (this.profileMode === PowerProfileMode.CRITICAL) {
      return 15;
    }
    if (this.isPowerSaverActive) {
      return 30;
    }
    if (this.isAdaptiveThrottlingEnabled && this.vehicleDynamics === VehicleDynamicsState.STATIONARY) {
      return 15; // Low FPS when stopped
    }
    return 60; // 60 FPS smooth rendering
  }

  /**
   * Retrieve current consolidated status.
   */
  public getStatus(): PowerOptimizationStatus {
    return {
      profileMode: this.profileMode,
      isPowerSaverActive: this.isPowerSaverActive,
      autoPowerSaverThreshold: this.config.autoPowerSaverThreshold,
      isWakeLockActive: this.isWakeLockActive,
      isAdaptiveThrottlingEnabled: this.isAdaptiveThrottlingEnabled,
      vehicleDynamics: this.vehicleDynamics,
      activeImuRateHz: this.getTargetImuRateHz(),
      mapFpsLimit: this.getTargetMapFpsLimit(),
      battery: this.battery,
    };
  }

  /**
   * Subscribe to power optimization status updates.
   */
  public onStatusChange(listener: PowerStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private evaluateBatteryThresholds(): void {
    if (this.battery.levelPercent <= 10 && !this.battery.isCharging) {
      this.profileMode = PowerProfileMode.CRITICAL;
      this.isPowerSaverActive = true;
    } else if (this.battery.levelPercent <= this.config.autoPowerSaverThreshold && !this.battery.isCharging) {
      this.profileMode = PowerProfileMode.POWER_SAVER;
      this.isPowerSaverActive = true;
    } else if (!this.isPowerSaverManual) {
      this.profileMode = PowerProfileMode.NORMAL;
      this.isPowerSaverActive = false;
    }
    this.recalculateState();
  }

  private recalculateState(): void {
    if (this.isPowerSaverActive && this.profileMode === PowerProfileMode.NORMAL) {
      this.profileMode = PowerProfileMode.POWER_SAVER;
    }
    this.notifyListeners();
  }

  private calculateEstimatedHours(level: number, isCharging: boolean, isPowerSaver: boolean): number {
    if (isCharging) {
      return 99.0; // Unlimited when connected to power
    }
    // Estimated discharge rates in % per hour under GPS+IMU navigation:
    // Normal: 15% / hr -> 100% gives ~6.6 hrs
    // Power Saver: 8% / hr -> 100% gives ~12.5 hrs
    const burnRatePercentPerHour = isPowerSaver ? 8.0 : 15.0;
    const hours = level / burnRatePercentPerHour;
    return Math.round(hours * 10) / 10;
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch (e) {
        this.logger.error('Error in power status listener', e);
      }
    }
  }
}
