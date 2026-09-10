/**
 * GNSS Service
 *
 * Singleton service that manages the GNSSSimulator instance and
 * distributes measurement updates to all UI subscribers.
 */

import { type GNSSMeasurement, type SatelliteInfo, Constellation, FixType } from '@navic/shared-models';
import { GNSSSimulator } from '@navic/gnss-core';

export type MeasurementListener = (measurement: GNSSMeasurement) => void;

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
  private simulator: GNSSSimulator;
  private listeners: Set<MeasurementListener> = new Set();
  private _lastMeasurement: GNSSMeasurement | null = null;

  constructor() {
    this.simulator = new GNSSSimulator({
      scenario: 'stationary-delhi',
      speedMultiplier: 1,
    });

    this.simulator.onMeasurement((m) => {
      this._lastMeasurement = m;
      for (const listener of this.listeners) {
        try {
          listener(m);
        } catch (e) {
          console.error('GNSS listener error:', e);
        }
      }
    });
  }

  /** Get the underlying simulator for control operations. */
  getSimulator(): GNSSSimulator {
    return this.simulator;
  }

  /** Start the simulator. */
  start(): void {
    this.simulator.start();
  }

  /** Stop the simulator. */
  stop(): void {
    this.simulator.stop();
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
