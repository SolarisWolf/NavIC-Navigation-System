/**
 * GNSS Simulator
 *
 * Main simulator class implementing the GNSSProvider interface.
 * Produces realistic GNSSMeasurement data using constellation models,
 * route interpolation, and noise generation.
 *
 * IMPORTANT: All data produced by this simulator has isSimulated = true.
 * UI must display SIMULATION MODE when using this provider.
 */

import {
  type GNSSProvider,
  type GNSSMeasurement,
  type GNSSMeasurementCallback,
  type GNSSStatusCallback,
  type GNSSStatus,
  type SimulationConfig,
  Constellation,
  FixType,
  Logger,
  DEFAULT_CONFIG,
} from '@navic/shared-models';

import { computeVisibleSatellites } from './satellite-simulator.js';
import {
  addPositionNoise,
  addAltitudeNoise,
  addSpeedNoise,
  addBearingNoise,
  estimateAccuracy,
} from './noise-model.js';
import {
  RouteInterpolator,
  getScenario,
  getScenarioNames,
  type SimulationScenario,
} from './route-simulator.js';

/**
 * Configuration for the GNSS simulator.
 */
export interface GNSSSimulatorConfig extends SimulationConfig {
  /** Starting scenario name */
  scenario?: string;
  /** Speed multiplier (1 = real-time, 10 = 10× faster) */
  speedMultiplier?: number;
}

/**
 * GNSS Simulator implementing the GNSSProvider interface.
 *
 * Usage:
 *   const simulator = new GNSSSimulator();
 *   simulator.onMeasurement((m) => console.log(m.latitude, m.longitude));
 *   simulator.start();
 */
export class GNSSSimulator implements GNSSProvider {
  readonly name = 'GNSS Simulator';
  readonly isSimulated = true;

  private config: GNSSSimulatorConfig;
  private logger: Logger;
  private intervalId: number | null = null;
  private isRunning: boolean = false;

  // Callbacks
  private measurementCallbacks: GNSSMeasurementCallback[] = [];
  private statusCallbacks: GNSSStatusCallback[] = [];

  // Simulation state
  private routeInterpolator: RouteInterpolator;
  private currentScenarioName: string;
  private disabledConstellations: Set<Constellation> = new Set();
  private signalQuality: 'strong' | 'moderate' | 'weak' = 'strong';
  private isOutage: boolean = false;
  private outageTimeoutId: number | null = null;
  private speedMultiplier: number;
  private lastTimestamp: number = 0;
  private isPaused: boolean = false;

  // Last measurement for status queries
  private lastMeasurement: GNSSMeasurement | null = null;

  constructor(config?: Partial<GNSSSimulatorConfig>) {
    this.config = {
      ...DEFAULT_CONFIG.simulation,
      scenario: 'stationary-delhi',
      speedMultiplier: 1,
      ...config,
    };

    this.logger = new Logger('GNSSSimulator', { isSimulation: true });
    this.currentScenarioName = this.config.scenario ?? 'stationary-delhi';
    this.speedMultiplier = this.config.speedMultiplier ?? 1;

    const scenario = getScenario(this.currentScenarioName);
    this.routeInterpolator = new RouteInterpolator(scenario);

    this.logger.info(`Initialized with scenario: ${scenario.name}`);
  }

  // ─── GNSSProvider Interface ──────────────────────────────────────────────

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTimestamp = Date.now();

    const intervalMs = 1000 / this.config.gnssUpdateRateHz;

    this.intervalId = setInterval(() => {
      if (!this.isPaused) {
        this.generateMeasurement();
      }
    }, intervalMs);

    this.logger.info(`Started at ${this.config.gnssUpdateRateHz} Hz`);
    this.emitStatus();
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.outageTimeoutId !== null) {
      clearTimeout(this.outageTimeoutId);
      this.outageTimeoutId = null;
    }

    this.logger.info('Stopped');
    this.emitStatus();
  }

  onMeasurement(callback: GNSSMeasurementCallback): void {
    this.measurementCallbacks.push(callback);
  }

  onStatusChange(callback: GNSSStatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  getStatus(): GNSSStatus {
    return {
      isActive: this.isRunning,
      hasfix: this.lastMeasurement?.fixType !== FixType.NoFix,
      fixType: this.lastMeasurement?.fixType ?? FixType.NoFix,
      isSimulated: true,
      lastUpdateTimestamp: this.lastMeasurement?.timestamp ?? null,
    };
  }

  // ─── Simulator Controls ──────────────────────────────────────────────────

  /** Switch to a different scenario. */
  setScenario(scenarioName: string): void {
    const scenario = getScenario(scenarioName);
    this.currentScenarioName = scenarioName;
    this.routeInterpolator = new RouteInterpolator(scenario);
    this.logger.info(`Switched scenario: ${scenario.name}`);
  }

  /** Get current scenario name. */
  getScenarioName(): string {
    return this.currentScenarioName;
  }

  /** Get all available scenario names. */
  getAvailableScenarios(): string[] {
    return getScenarioNames();
  }

  /** Simulate a GNSS outage for the given duration. */
  simulateOutage(durationMs: number): void {
    this.isOutage = true;
    this.logger.warn(`GNSS outage started (${durationMs}ms)`);
    this.emitStatus();

    this.outageTimeoutId = setTimeout(() => {
      this.isOutage = false;
      this.outageTimeoutId = null;
      this.logger.info('GNSS outage ended — signal recovered');
      this.emitStatus();
    }, durationMs);
  }

  /** Toggle NavIC satellite availability. */
  setNavICAvailability(available: boolean): void {
    if (available) {
      this.disabledConstellations.delete(Constellation.NavIC);
      this.logger.info('NavIC enabled');
    } else {
      this.disabledConstellations.add(Constellation.NavIC);
      this.logger.info('NavIC disabled');
    }
  }

  /** Check if NavIC is enabled. */
  isNavICEnabled(): boolean {
    return !this.disabledConstellations.has(Constellation.NavIC);
  }

  /** Set overall signal quality. */
  setSignalQuality(quality: 'strong' | 'moderate' | 'weak'): void {
    this.signalQuality = quality;
    this.logger.info(`Signal quality set to: ${quality}`);
  }

  /** Get current signal quality. */
  getSignalQuality(): 'strong' | 'moderate' | 'weak' {
    return this.signalQuality;
  }

  /** Set speed multiplier. */
  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Math.max(0.1, Math.min(20, multiplier));
    this.logger.info(`Speed multiplier: ${this.speedMultiplier}×`);
  }

  /** Get speed multiplier. */
  getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  /** Pause the simulation. */
  pause(): void {
    this.isPaused = true;
    this.logger.info('Paused');
  }

  /** Resume the simulation. */
  resume(): void {
    this.isPaused = false;
    this.lastTimestamp = Date.now();
    this.logger.info('Resumed');
  }

  /** Check if paused. */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /** Reset the simulation. */
  reset(): void {
    this.routeInterpolator.reset();
    this.isOutage = false;
    this.lastMeasurement = null;
    this.lastTimestamp = Date.now();
    this.logger.info('Reset');
    this.emitStatus();
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private generateMeasurement(): void {
    const now = Date.now();
    const dtMs = (now - this.lastTimestamp) * this.speedMultiplier;
    this.lastTimestamp = now;

    // Advance position along route
    const pos = this.routeInterpolator.update(dtMs);

    // During outage, emit NoFix measurement
    if (this.isOutage) {
      const measurement: GNSSMeasurement = {
        timestamp: now,
        latitude: 0,
        longitude: 0,
        altitude: 0,
        speed: 0,
        bearing: 0,
        horizontalAccuracy: 0,
        verticalAccuracy: 0,
        fixType: FixType.NoFix,
        satellites: [],
        isSimulated: true,
      };
      this.lastMeasurement = measurement;
      this.emitMeasurement(measurement);
      return;
    }

    // Compute visible satellites
    const satellites = computeVisibleSatellites(
      pos.latitude,
      pos.longitude,
      now,
      this.disabledConstellations,
      this.signalQuality,
    );

    // Count satellites used in fix
    const usedInFix = satellites.filter((s) => s.usedInFix).length;

    // Determine fix type
    const fixType = this.classifyFix(usedInFix);

    // Apply noise to position
    const [noisyLat, noisyLon] = addPositionNoise(
      pos.latitude,
      pos.longitude,
      this.config.positionNoiseSigma,
    );
    const noisyAlt = addAltitudeNoise(pos.altitude, this.config.positionNoiseSigma);
    const noisySpeed = addSpeedNoise(pos.speed, this.config.speedNoiseSigma);
    const noisyBearing = addBearingNoise(pos.bearing, this.config.bearingNoiseSigma);

    // Estimate accuracy
    const horizontalAccuracy = estimateAccuracy(
      this.config.positionNoiseSigma,
      usedInFix,
    );
    const verticalAccuracy = horizontalAccuracy * 1.5;

    const measurement: GNSSMeasurement = {
      timestamp: now,
      latitude: Math.round(noisyLat * 1e7) / 1e7, // 7 decimal places
      longitude: Math.round(noisyLon * 1e7) / 1e7,
      altitude: Math.round(noisyAlt * 10) / 10,
      speed: Math.round(noisySpeed * 100) / 100,
      bearing: Math.round(noisyBearing * 10) / 10,
      horizontalAccuracy,
      verticalAccuracy: Math.round(verticalAccuracy * 10) / 10,
      fixType,
      satellites,
      isSimulated: true,
    };

    this.lastMeasurement = measurement;
    this.emitMeasurement(measurement);
  }

  private classifyFix(usedInFix: number): FixType {
    if (usedInFix >= 4) return FixType.Fix3D;
    if (usedInFix >= 3) return FixType.Fix2D;
    return FixType.NoFix;
  }

  private emitMeasurement(measurement: GNSSMeasurement): void {
    for (const cb of this.measurementCallbacks) {
      try {
        cb(measurement);
      } catch (e) {
        this.logger.error('Error in measurement callback', e);
      }
    }
  }

  private emitStatus(): void {
    const status = this.getStatus();
    for (const cb of this.statusCallbacks) {
      try {
        cb(status);
      } catch (e) {
        this.logger.error('Error in status callback', e);
      }
    }
  }
}
