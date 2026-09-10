/**
 * Fusion Service
 *
 * Singleton service managing the SensorFusionEngine instance.
 * Subscribes to live GNSS and IMU telemetry streams, processes them through
 * the Extended Kalman Filter, and distributes 50 Hz fused position estimates
 * to UI subscribers (Dashboard, Map, and Sensor screens).
 */

import {
  type FusedPositionEstimate,
  type SensorFusionStatus,
  type FusedPositionCallback,
  type SensorFusionStatusCallback,
  type AccelerometerReading,
  type GyroscopeReading,
} from '@navic/shared-models';
import { SensorFusionEngine } from '@navic/sensor-fusion';
import { gnssService } from './gnss-service.js';
import { imuService } from './imu-service.js';

class FusionServiceImpl {
  private engine: SensorFusionEngine;
  private latestEstimate: FusedPositionEstimate | null = null;
  private latestStatus: SensorFusionStatus | null = null;

  private estimateListeners: Set<FusedPositionCallback> = new Set();
  private statusListeners: Set<SensorFusionStatusCallback> = new Set();

  private lastAccel: AccelerometerReading | null = null;
  private lastGyro: GyroscopeReading | null = null;

  constructor() {
    this.engine = new SensorFusionEngine();

    // Register engine callbacks
    this.engine.onFusedPosition((estimate) => {
      this.latestEstimate = estimate;
      for (const listener of this.estimateListeners) {
        try {
          listener(estimate);
        } catch (e) {
          console.error('Fusion estimate listener error:', e);
        }
      }
    });

    this.engine.onStatus((status) => {
      this.latestStatus = status;
      for (const listener of this.statusListeners) {
        try {
          listener(status);
        } catch (e) {
          console.error('Fusion status listener error:', e);
        }
      }
    });

    // 1. Ingest GNSS measurements (1 Hz)
    gnssService.subscribe((measurement) => {
      this.engine.processGNSS(measurement);
    });

    // 2. Ingest IMU telemetry (50 Hz)
    imuService.subscribeAccelerometer((accel) => {
      this.lastAccel = accel;
      if (this.lastGyro) {
        this.engine.processIMU(this.lastAccel, this.lastGyro);
      }
    });

    imuService.subscribeGyroscope((gyro) => {
      this.lastGyro = gyro;
    });
  }

  public getEngine(): SensorFusionEngine {
    return this.engine;
  }

  public getLatestEstimate(): FusedPositionEstimate | null {
    return this.latestEstimate;
  }

  public getStatus(): SensorFusionStatus {
    return this.engine.getStatus();
  }

  /**
   * Subscribe to 50 Hz fused position estimates. Returns an unsubscribe function.
   */
  public subscribe(listener: FusedPositionCallback): () => void {
    this.estimateListeners.add(listener);
    if (this.latestEstimate) {
      listener(this.latestEstimate);
    }
    return () => this.estimateListeners.delete(listener);
  }

  /**
   * Subscribe to EKF diagnostic updates. Returns an unsubscribe function.
   */
  public subscribeStatus(listener: SensorFusionStatusCallback): () => void {
    this.statusListeners.add(listener);
    if (this.latestStatus) {
      listener(this.latestStatus);
    }
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Triggers a temporary GNSS outage on the GNSS simulator to demonstrate Dead Reckoning.
   */
  public triggerGNSSOutage(durationMs = 5000): void {
    const sim = gnssService.getSimulator();
    sim.simulateOutage(durationMs);
  }

  public reset(): void {
    this.engine.reset();
  }
}

export const fusionService = new FusionServiceImpl();
