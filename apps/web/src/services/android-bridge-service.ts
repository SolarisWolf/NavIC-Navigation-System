/**
 * Android Native Bridge Client
 *
 * Facilitates communication with the native Android container (MainActivity & NavICNativeBridge).
 * When running inside the Android app (WebView), exposes native hardware telemetry,
 * real hardware GPS/NavIC updates, 50 Hz IMU sensors, and wake-lock controls.
 */

import {
  Logger,
  type GNSSMeasurement,
  type AccelerometerReading,
  type GyroscopeReading,
  type MagnetometerReading,
} from '@navic/shared-models';

export interface AndroidDeviceInfo {
  platform: string;
  sdkVersion: number;
  release: string;
  brand: string;
  model: string;
  hardware: string;
  isNavICSupported: boolean;
  hasGnssMeasurements: boolean;
  isHighRateSensorsSupported: boolean;
  isHardwareActive?: boolean;
}

export interface AndroidHardwareStatus {
  totalSatellites: number;
  usedInFix: number;
  navicSatellites: number;
  isNavICDetected: boolean;
}

declare global {
  interface Window {
    NavICNative?: {
      getAndroidEnvironmentInfo(): string;
      isNavICSupported(): boolean;
      hasRawGnssMeasurements(): boolean;
      setWakeLock(enable: boolean): void;
      updateGuidanceNotification(maneuver: string, stats: string): void;
      stopGuidanceService(): void;
      startHardwareSensors(): boolean;
      stopHardwareSensors(): void;
      isHardwareSensorsActive(): boolean;
      getHardwareSensorStatus(): string;
      log(level: string, tag: string, message: string): void;
    };
  }
}

class AndroidBridgeServiceImpl {
  private logger = new Logger('AndroidBridge');
  private isNativeAndroid = typeof window !== 'undefined' && !!window.NavICNative;
  private deviceInfo: AndroidDeviceInfo | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    if (this.isNativeAndroid && window.NavICNative) {
      try {
        const raw = window.NavICNative.getAndroidEnvironmentInfo();
        this.deviceInfo = JSON.parse(raw);
        this.logger.info(`Native Android container connected: ${this.deviceInfo?.brand} ${this.deviceInfo?.model} (API ${this.deviceInfo?.sdkVersion})`);
      } catch (e) {
        this.logger.warn('Failed to parse Android environment info:', e);
      }
    } else {
      this.logger.debug('Running in standard Web browser environment (Native bridge standby)');
    }
  }

  public isRunningInAndroid(): boolean {
    return this.isNativeAndroid;
  }

  public getDeviceInfo(): AndroidDeviceInfo | null {
    return this.deviceInfo;
  }

  public isNavICSupported(): boolean {
    if (this.isNativeAndroid && window.NavICNative) {
      return window.NavICNative.isNavICSupported();
    }
    return false;
  }

  public startHardwareSensors(): boolean {
    if (this.isNativeAndroid && window.NavICNative) {
      return window.NavICNative.startHardwareSensors();
    }
    return false;
  }

  public stopHardwareSensors(): void {
    if (this.isNativeAndroid && window.NavICNative) {
      window.NavICNative.stopHardwareSensors();
    }
  }

  public isHardwareSensorsActive(): boolean {
    if (this.isNativeAndroid && window.NavICNative) {
      return window.NavICNative.isHardwareSensorsActive();
    }
    return false;
  }

  public onHardwareGNSS(callback: (m: GNSSMeasurement) => void): () => void {
    const handler = (evt: Event) => {
      const customEvt = evt as CustomEvent<GNSSMeasurement>;
      if (customEvt.detail) {
        callback(customEvt.detail);
      }
    };
    window.addEventListener('navic-hardware-gnss', handler);
    return () => window.removeEventListener('navic-hardware-gnss', handler);
  }

  public onHardwareGNSSStatus(callback: (s: AndroidHardwareStatus) => void): () => void {
    const handler = (evt: Event) => {
      const customEvt = evt as CustomEvent<AndroidHardwareStatus>;
      if (customEvt.detail) {
        callback(customEvt.detail);
      }
    };
    window.addEventListener('navic-hardware-gnss-status', handler);
    return () => window.removeEventListener('navic-hardware-gnss-status', handler);
  }

  public onHardwareAccel(callback: (r: AccelerometerReading) => void): () => void {
    const handler = (evt: Event) => {
      const customEvt = evt as CustomEvent<AccelerometerReading>;
      if (customEvt.detail) {
        callback(customEvt.detail);
      }
    };
    window.addEventListener('navic-hardware-accel', handler);
    return () => window.removeEventListener('navic-hardware-accel', handler);
  }

  public onHardwareGyro(callback: (r: GyroscopeReading) => void): () => void {
    const handler = (evt: Event) => {
      const customEvt = evt as CustomEvent<GyroscopeReading>;
      if (customEvt.detail) {
        callback(customEvt.detail);
      }
    };
    window.addEventListener('navic-hardware-gyro', handler);
    return () => window.removeEventListener('navic-hardware-gyro', handler);
  }

  public onHardwareMag(callback: (r: MagnetometerReading) => void): () => void {
    const handler = (evt: Event) => {
      const customEvt = evt as CustomEvent<MagnetometerReading>;
      if (customEvt.detail) {
        callback(customEvt.detail);
      }
    };
    window.addEventListener('navic-hardware-mag', handler);
    return () => window.removeEventListener('navic-hardware-mag', handler);
  }

  public setWakeLock(enabled: boolean): void {
    if (this.isNativeAndroid && window.NavICNative) {
      window.NavICNative.setWakeLock(enabled);
    }
  }

  public updateGuidance(maneuver: string, stats: string): void {
    if (this.isNativeAndroid && window.NavICNative) {
      window.NavICNative.updateGuidanceNotification(maneuver, stats);
    }
  }

  public stopGuidance(): void {
    if (this.isNativeAndroid && window.NavICNative) {
      window.NavICNative.stopGuidanceService();
    }
  }
}

export const androidBridgeService = new AndroidBridgeServiceImpl();
