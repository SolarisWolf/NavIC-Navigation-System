/**
 * Position Service
 *
 * Singleton service that manages the PositionEngine instance.
 * Connects directly to gnssService, processes measurements through
 * DOP calculation, outlier filtering, stationary bearing locking, and
 * coordinate smoothing, and emits high-fidelity GNSSPosition updates.
 */

import { type GNSSPosition, type GNSSPositionCallback, Logger } from '@navic/shared-models';
import { PositionEngine } from '@navic/gnss-core';
import { gnssService } from './gnss-service.js';

class PositionServiceImpl {
  private logger = new Logger('PositionService');
  private engine: PositionEngine;
  private listeners: Set<GNSSPositionCallback> = new Set();
  private _lastPosition: GNSSPosition | null = null;

  constructor() {
    this.engine = new PositionEngine({
      smoothingFactor: 0.7,
      stationarySpeedThresholdMs: 0.5,
      lossOfFixTimeoutMs: 1500,
    });

    // Ingest raw measurements from gnssService
    gnssService.subscribe((measurement) => {
      const processed = this.engine.processMeasurement(measurement);
      this._lastPosition = processed;

      for (const listener of this.listeners) {
        try {
          listener(processed);
        } catch (e) {
          this.logger.error('Position listener error:', e);
        }
      }
    });

    // Reset position engine when switching data sources
    gnssService.onSourceModeChange(() => {
      this.reset();
    });
  }

  public getEngine(): PositionEngine {
    return this.engine;
  }

  public get lastPosition(): GNSSPosition | null {
    return this._lastPosition;
  }

  public subscribe(listener: GNSSPositionCallback): () => void {
    this.listeners.add(listener);
    if (this._lastPosition) {
      listener(this._lastPosition);
    }
    return () => this.listeners.delete(listener);
  }

  public reset(): void {
    this.engine.reset();
    this._lastPosition = null;
  }
}

export const positionService = new PositionServiceImpl();
