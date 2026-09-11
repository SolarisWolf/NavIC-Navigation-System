/**
 * GNSS Service
 *
 * Singleton service that manages GNSS data sources (Simulation, Live Laptop/Device GPS,
 * Native Android Hardware, or USB Serial NMEA) and distributes measurement updates
 * to all UI subscribers.
 */

import { type GNSSMeasurement, type SatelliteInfo, type NavICSignalReport, Constellation, FixType, Logger } from '@navic/shared-models';
import { GNSSSimulator, BrowserGeolocationProvider, SerialNMEAProvider, NavICDetector } from '@navic/gnss-core';
import { androidBridgeService } from './android-bridge-service.js';

export type MeasurementListener = (measurement: GNSSMeasurement) => void;
export type NavICReportListener = (report: NavICSignalReport) => void;

export enum DataSourceMode {
  Simulation = 'simulation',
  LiveLaptopGPS = 'laptop-gps',
  AndroidHardware = 'android-hardware',
  USBSerial = 'usb-serial',
}

export type SourceModeListener = (mode: DataSourceMode) => void;

/**
 * Satellite count summary by constellation.
 */
export interface ConstellationCounts {
  total: number;
  usedInFix: number;
  navic: number;
  gps: number;
  galileo: number;
  beidou: number;
  glonass: number;
}

class GNSSServiceImpl {
  private logger = new Logger('GNSSService');
  private simulator: GNSSSimulator;
  private browserProvider: BrowserGeolocationProvider;
  private serialProvider: SerialNMEAProvider;

  private activeMode: DataSourceMode = DataSourceMode.Simulation;
  private listeners: Set<MeasurementListener> = new Set();
  private sourceListeners: Set<SourceModeListener> = new Set();
  private navicListeners: Set<NavICReportListener> = new Set();
  private _lastMeasurement: GNSSMeasurement | null = null;
  private _lastNavICReport: NavICSignalReport | null = null;
  private isStarted = false;

  constructor() {
    this.simulator = new GNSSSimulator({
      scenario: 'stationary-delhi',
      speedMultiplier: 1,
    });

    this.browserProvider = new BrowserGeolocationProvider();
    this.serialProvider = new SerialNMEAProvider();

    if (androidBridgeService.isRunningInAndroid()) {
      this.activeMode = DataSourceMode.AndroidHardware;
      this.logger.info('Detected native Android environment — default source set to AndroidHardware');
    }

    // Route simulator updates
    this.simulator.onMeasurement((m) => {
      if (this.activeMode === DataSourceMode.Simulation) {
        this.dispatchMeasurement(m);
      }
    });

    // Route browser geolocation updates
    this.browserProvider.onMeasurement((m) => {
      if (this.activeMode === DataSourceMode.LiveLaptopGPS) {
        this.dispatchMeasurement(m);
      }
    });

    // Route serial NMEA updates
    this.serialProvider.onMeasurement((m) => {
      if (this.activeMode === DataSourceMode.USBSerial) {
        this.dispatchMeasurement(m);
      }
    });

    // Route native Android hardware updates
    androidBridgeService.onHardwareGNSS((m) => {
      if (this.activeMode === DataSourceMode.AndroidHardware) {
        this.dispatchMeasurement(m);
      }
    });

    // Route native Android NavIC signal reports
    androidBridgeService.onNavICReport((report) => {
      if (this.activeMode === DataSourceMode.AndroidHardware) {
        this.dispatchNavICReport(report);
      }
    });

    // Automatically activate sensors when Android permissions are granted
    if (typeof window !== 'undefined') {
      window.addEventListener('android-permissions-granted', () => {
        this.logger.info('Android location permissions granted — starting hardware sensors');
        this.setSourceMode(DataSourceMode.AndroidHardware);
        this.start();
      });
    }
  }

  private dispatchMeasurement(m: GNSSMeasurement): void {
    this._lastMeasurement = m;
    for (const listener of this.listeners) {
      try {
        listener(m);
      } catch (e) {
        this.logger.error('GNSS listener error:', e);
      }
    }

    // Evaluate NavIC constellation health & signal integrity
    const report = NavICDetector.analyzeConstellation(
      m.satellites,
      m.satellites.filter((s) => s.usedInFix).length
    );
    this.dispatchNavICReport(report);
  }

  private dispatchNavICReport(report: NavICSignalReport): void {
    this._lastNavICReport = report;
    for (const listener of this.navicListeners) {
      try {
        listener(report);
      } catch (e) {
        this.logger.error('NavIC listener error:', e);
      }
    }
  }

  /** Subscribe to NavIC signal & constellation telemetry reports. */
  subscribeNavIC(listener: NavICReportListener): () => void {
    this.navicListeners.add(listener);
    if (this._lastNavICReport) {
      listener(this._lastNavICReport);
    }
    return () => this.navicListeners.delete(listener);
  }

  /** Get latest NavIC constellation report */
  get lastNavICReport(): NavICSignalReport | null {
    return this._lastNavICReport;
  }

  /** Get the underlying simulator for scenario and control operations. */
  getSimulator(): GNSSSimulator {
    return this.simulator;
  }

  /** Get the browser geolocation provider */
  getBrowserProvider(): BrowserGeolocationProvider {
    return this.browserProvider;
  }

  /** Get the serial NMEA provider */
  getSerialProvider(): SerialNMEAProvider {
    return this.serialProvider;
  }

  /** Get current active data source mode */
  getSourceMode(): DataSourceMode {
    return this.activeMode;
  }

  /** Returns true if currently operating on physical hardware (Laptop, Android, or USB) */
  isHardware(): boolean {
    return this.activeMode !== DataSourceMode.Simulation;
  }

  /**
   * Switch active data source dynamically without resetting UI or routes.
   */
  async setSourceMode(newMode: DataSourceMode): Promise<boolean> {
    if (this.activeMode === newMode) return true;

    this.logger.info(`Switching source mode from ${this.activeMode} to ${newMode}`);

    // Stop current active provider if running
    if (this.isStarted) {
      switch (this.activeMode) {
        case DataSourceMode.Simulation:
          this.simulator.stop();
          break;
        case DataSourceMode.LiveLaptopGPS:
          this.browserProvider.stop();
          break;
        case DataSourceMode.AndroidHardware:
          androidBridgeService.stopHardwareSensors();
          break;
        case DataSourceMode.USBSerial:
          this.serialProvider.stop();
          break;
      }
    }

    this.activeMode = newMode;

    // Start newly selected provider if system is running
    if (this.isStarted) {
      switch (newMode) {
        case DataSourceMode.Simulation:
          this.simulator.start();
          break;
        case DataSourceMode.LiveLaptopGPS:
          this.browserProvider.start();
          break;
        case DataSourceMode.AndroidHardware:
          androidBridgeService.startHardwareSensors();
          break;
        case DataSourceMode.USBSerial:
          this.serialProvider.start();
          break;
      }
    }

    // Notify UI subscribers
    for (const listener of this.sourceListeners) {
      try {
        listener(newMode);
      } catch (e) {
        this.logger.error('Source mode listener error:', e);
      }
    }

    return true;
  }

  /** Subscribe to data source mode changes (e.g. status bar badge updates) */
  onSourceModeChange(listener: SourceModeListener): () => void {
    this.sourceListeners.add(listener);
    listener(this.activeMode);
    return () => this.sourceListeners.delete(listener);
  }

  /** Start the currently active data source. */
  start(): void {
    if (androidBridgeService.isRunningInAndroid() && this.activeMode === DataSourceMode.Simulation) {
      this.activeMode = DataSourceMode.AndroidHardware;
    }
    this.isStarted = true;
    switch (this.activeMode) {
      case DataSourceMode.Simulation:
        this.simulator.start();
        break;
      case DataSourceMode.LiveLaptopGPS:
        this.browserProvider.start();
        break;
      case DataSourceMode.AndroidHardware:
        androidBridgeService.startHardwareSensors();
        break;
      case DataSourceMode.USBSerial:
        this.serialProvider.start();
        break;
    }
  }

  /** Stop the active data source. */
  stop(): void {
    this.isStarted = false;
    switch (this.activeMode) {
      case DataSourceMode.Simulation:
        this.simulator.stop();
        break;
      case DataSourceMode.LiveLaptopGPS:
        this.browserProvider.stop();
        break;
      case DataSourceMode.AndroidHardware:
        androidBridgeService.stopHardwareSensors();
        break;
      case DataSourceMode.USBSerial:
        this.serialProvider.stop();
        break;
    }
  }

  /** Subscribe to measurement updates. Returns an unsubscribe function. */
  subscribe(listener: MeasurementListener): () => void {
    this.listeners.add(listener);
    // Send last measurement immediately if available
    if (this._lastMeasurement) {
      listener(this._lastMeasurement);
    }
    return () => this.listeners.delete(listener);
  }

  /** Get the last measurement. */
  get lastMeasurement(): GNSSMeasurement | null {
    return this._lastMeasurement;
  }

  /** Compute constellation counts from satellite data. */
  static computeConstellationCounts(satellites: readonly SatelliteInfo[]): ConstellationCounts {
    const counts: ConstellationCounts = {
      total: satellites.length,
      usedInFix: 0,
      navic: 0,
      gps: 0,
      galileo: 0,
      beidou: 0,
      glonass: 0,
    };

    for (const sat of satellites) {
      if (sat.usedInFix) counts.usedInFix++;
      switch (sat.constellation) {
        case Constellation.NavIC: counts.navic++; break;
        case Constellation.GPS: counts.gps++; break;
        case Constellation.Galileo: counts.galileo++; break;
        case Constellation.BeiDou: counts.beidou++; break;
        case Constellation.GLONASS: counts.glonass++; break;
      }
    }

    return counts;
  }
}

/** Singleton instance */
export const gnssService = new GNSSServiceImpl();
