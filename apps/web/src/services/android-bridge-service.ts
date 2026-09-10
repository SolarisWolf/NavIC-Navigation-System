/**
 * Android Native Bridge Client
 *
 * Facilitates communication with the native Android container (MainActivity & NavICNativeBridge).
 * When running inside the Android app (WebView), exposes native hardware telemetry,
 * NavIC chipset capability, and native screen wake-lock controls.
 */

import { Logger } from '@navic/shared-models';

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
