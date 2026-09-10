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
  type NavICSignalReport,
  type AccelerometerReading,
  type GyroscopeReading,
  type MagnetometerReading,
  type BatteryTelemetry,
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
      updateNavigationNotification(maneuver: string, distance: string, eta: string, road: string): void;
      requestAudioFocus(): boolean;
      abandonAudioFocus(): boolean;
      setImmersiveMode(enable: boolean): void;
      getPendingGeoIntent(): string;
      stopGuidanceService(): void;
      startHardwareSensors(): boolean;
      stopHardwareSensors(): void;
      isHardwareSensorsActive(): boolean;
      getHardwareSensorStatus(): string;
      getNavICConstellationReport(): string;
      getBatteryStatus(): string;
      setSensorSamplingRate(rateHz: number): void;
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

  public getNavICConstellationReport(): NavICSignalReport | null {
    if (this.isNativeAndroid && window.NavICNative) {
      try {
        const raw = window.NavICNative.getNavICConstellationReport();
        if (raw && raw !== '{}') {
          return JSON.parse(raw);
        }
      } catch (e) {
        this.logger.warn('Failed to parse NavIC constellation report:', e);
      }
    }
    return null;
  }

  public onNavICReport(callback: (report: NavICSignalReport) => void): () => void {
    const handler = (evt: Event) => {
      const customEvt = evt as CustomEvent<NavICSignalReport>;
      if (customEvt.detail) {
        callback(customEvt.detail);
      }
    };
    window.addEventListener('navic-hardware-report', handler);
    return () => window.removeEventListener('navic-hardware-report', handler);
  }

  public getBatteryStatus(): BatteryTelemetry | null {
    if (this.isNativeAndroid && window.NavICNative) {
      try {
        const raw = window.NavICNative.getBatteryStatus();
        if (raw && raw !== '{}') {
          return JSON.parse(raw);
        }
      } catch (e) {
        this.logger.warn('Failed to parse native battery status:', e);
      }
    }
    return null;
  }

  public onBatteryChanged(callback: (battery: BatteryTelemetry) => void): () => void {
    const handler = (evt: Event) => {
      const customEvt = evt as CustomEvent<BatteryTelemetry>;
      if (customEvt.detail) {
        callback(customEvt.detail);
      }
    };
    window.addEventListener('navic-hardware-battery', handler);
    return () => window.removeEventListener('navic-hardware-battery', handler);
  }

  public setSensorSamplingRate(rateHz: number): void {
    if (this.isNativeAndroid && window.NavICNative) {
      window.NavICNative.setSensorSamplingRate(rateHz);
    }
  }

  public updateNavigationNotification(maneuver: string, distance: string, eta: string, road: string): void {
    if (this.isNativeAndroid && window.NavICNative) {
      window.NavICNative.updateNavigationNotification(maneuver, distance, eta, road);
    }
  }

  public requestAudioFocus(): boolean {
    if (this.isNativeAndroid && window.NavICNative) {
      return window.NavICNative.requestAudioFocus();
    }
    return true;
  }

  public abandonAudioFocus(): boolean {
    if (this.isNativeAndroid && window.NavICNative) {
      return window.NavICNative.abandonAudioFocus();
    }
    return true;
  }

  public setImmersiveMode(enabled: boolean): void {
    if (this.isNativeAndroid && window.NavICNative) {
      window.NavICNative.setImmersiveMode(enabled);
    }
  }

  public getPendingGeoIntent(): string {
    if (this.isNativeAndroid && window.NavICNative) {
      return window.NavICNative.getPendingGeoIntent();
    }
    return '';
  }

  public onGeoIntent(callback: (uri: string) => void): () => void {
    const handler = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ uri: string }>;
      if (customEvt.detail?.uri) {
        callback(customEvt.detail.uri);
      }
    };
    window.addEventListener('android-geo-intent', handler);
    return () => window.removeEventListener('android-geo-intent', handler);
  }

  public onBackPressed(callback: () => void): () => void {
    const handler = () => {
      callback();
    };
    window.addEventListener('android-back-pressed', handler);
    return () => window.removeEventListener('android-back-pressed', handler);
  }

  public stopGuidance(): void {
    if (this.isNativeAndroid && window.NavICNative) {
      window.NavICNative.stopGuidanceService();
    }
  }
}

export const androidBridgeService = new AndroidBridgeServiceImpl();
