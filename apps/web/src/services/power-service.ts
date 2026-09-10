/**
 * Power & Battery Optimization Service
 *
 * Coordinates Screen WakeLock, vehicle dynamics classification, adaptive sensor
 * throttling, system-wide Power Saver Mode, and background notification sync.
 */

import {
  type BatteryTelemetry,
  type PowerOptimizationStatus,
  type PowerStatusListener,
  PowerProfileMode,
  VehicleDynamicsState,
  Logger,
} from '@navic/shared-models';
import { PowerOptimizer } from '@navic/sensor-fusion';
import { androidBridgeService } from './android-bridge-service.js';
import { imuService } from './imu-service.js';
import { positionService } from './position-service.js';

class PowerServiceImpl {
  private logger = new Logger('PowerService');
  private optimizer: PowerOptimizer;

  private wakeLockSentinel: any = null;
  private isNavigationActive = false;

  constructor() {
    this.optimizer = new PowerOptimizer({
      stationarySpeedThresholdMs: 0.8,
      stationaryDebounceMs: 8000,
      highwaySpeedThresholdMs: 15.0,
      autoPowerSaverThreshold: 20,
    });

    this.initWakeLockListeners();
    this.initBatteryMonitoring();
    this.initMotionTracking();
    this.initPowerStatusSync();
  }

  /**
   * Acquire Screen WakeLock to prevent the screen from turning off during navigation.
   */
  public async requestWakeLock(): Promise<boolean> {
    this.optimizer.setWakeLockActive(true);

    // 1. Native Android wake lock via WindowManager
    androidBridgeService.setWakeLock(true);

    // 2. Web Screen Wake Lock API
    if ('wakeLock' in navigator && (navigator as any).wakeLock) {
      try {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        this.wakeLockSentinel.addEventListener('release', () => {
          this.logger.info('Screen Wake Lock was released by system');
          this.wakeLockSentinel = null;
        });
        this.logger.info('Web Screen Wake Lock acquired');
        return true;
      } catch (err: any) {
        this.logger.warn(`Could not acquire Web Screen Wake Lock: ${err.message}`);
      }
    }
    return true;
  }

  /**
   * Release Screen WakeLock when navigation is stopped.
   */
  public async releaseWakeLock(): Promise<void> {
    this.optimizer.setWakeLockActive(false);

    // 1. Native Android wake lock release
    androidBridgeService.setWakeLock(false);

    // 2. Web Screen Wake Lock release
    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
        this.wakeLockSentinel = null;
        this.logger.info('Web Screen Wake Lock released');
      } catch (err: any) {
        this.logger.warn(`Error releasing Web Screen Wake Lock: ${err.message}`);
      }
    }
  }

  /**
   * Called when active turn-by-turn navigation begins.
   */
  public onNavigationStarted(destinationName = 'Destination'): void {
    this.isNavigationActive = true;
    this.requestWakeLock();
    androidBridgeService.updateGuidance('Navigation Started', `Heading to ${destinationName}`);
  }

  /**
   * Called when active turn-by-turn navigation ends.
   */
  public onNavigationStopped(): void {
    this.isNavigationActive = false;
    this.releaseWakeLock();
    androidBridgeService.stopGuidance();
  }

  /**
   * Push real-time guidance telemetry to native Android ongoing notification
   * and Web Notifications if running in background.
   */
  public updateGuidanceNotification(maneuverText: string, etaStats: string): void {
    if (!this.isNavigationActive) return;

    // 1. Android Native ongoing notification update
    androidBridgeService.updateGuidance(maneuverText, etaStats);

    // 2. Web Notification fallback when tab is hidden
    if (typeof document !== 'undefined' && document.hidden && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(maneuverText, {
            body: etaStats,
            icon: '/assets/icon-192.png',
            tag: 'navic-guidance-ongoing',
          });
        } catch (e) {}
      }
    }
  }

  /**
   * Toggle manual Power Saver Mode.
   */
  public setPowerSaverMode(enabled: boolean): void {
    this.optimizer.setPowerSaverMode(enabled);
  }

  /**
   * Toggle adaptive sensor throttling when stationary.
   */
  public setAdaptiveThrottlingEnabled(enabled: boolean): void {
    this.optimizer.setAdaptiveThrottlingEnabled(enabled);
  }

  /**
   * Set threshold % for auto-enabling power saver.
   */
  public setAutoPowerSaverThreshold(percent: number): void {
    this.optimizer.setAutoPowerSaverThreshold(percent);
  }

  /**
   * Get current power status.
   */
  public getStatus(): PowerOptimizationStatus {
    return this.optimizer.getStatus();
  }

  /**
   * Subscribe to power status updates.
   */
  public subscribe(listener: PowerStatusListener): () => void {
    return this.optimizer.onStatusChange(listener);
  }

  private initWakeLockListeners(): void {
    // Re-acquire wake lock if page becomes visible again during active navigation
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && this.isNavigationActive && !this.wakeLockSentinel) {
          this.logger.info('Visibility restored; re-acquiring Screen Wake Lock');
          this.requestWakeLock();
        }
      });
    }
  }

  private initBatteryMonitoring(): void {
    // 1. Native Android battery updates
    const initialAndroidBattery = androidBridgeService.getBatteryStatus();
    if (initialAndroidBattery) {
      this.optimizer.updateBattery(initialAndroidBattery);
    }
    androidBridgeService.onBatteryChanged((battery) => {
      this.optimizer.updateBattery(battery);
    });

    // 2. Web Battery API fallback
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((batteryObj: any) => {
        const syncWebBattery = () => {
          this.optimizer.updateBattery({
            levelPercent: Math.round(batteryObj.level * 100),
            isCharging: batteryObj.charging,
            chargingSource: batteryObj.charging ? 'AC' : 'UNKNOWN',
          });
        };
        syncWebBattery();
        batteryObj.addEventListener('levelchange', syncWebBattery);
        batteryObj.addEventListener('chargingchange', syncWebBattery);
      }).catch(() => {});
    }
  }

  private initMotionTracking(): void {
    // Synchronize vehicle speed with PowerOptimizer for stationary debounce
    positionService.subscribe((pos) => {
      this.optimizer.updateSpeed(pos.speed);
    });
  }

  private initPowerStatusSync(): void {
    this.optimizer.onStatusChange((status) => {
      // 1. Throttle IMU simulator frequency
      imuService.getSimulator().setFrequency(status.activeImuRateHz);

      // 2. Throttle Android native sensor provider
      androidBridgeService.setSensorSamplingRate(status.activeImuRateHz);

      // 3. Apply global CSS class for power saver optimizations (reduces blur, shadows, animations)
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.toggle('power-saver-active', status.isPowerSaverActive);
      }
    });
  }
}

export const powerService = new PowerServiceImpl();
