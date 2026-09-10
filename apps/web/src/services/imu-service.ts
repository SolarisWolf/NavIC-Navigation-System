/**
 * IMU Service
 *
 * Singleton service that manages IMU sensor streams (Simulated 50 Hz physics or
 * Native Android Hardware 50 Hz sensors) and distributes 3-axis sensor updates to UI subscribers.
 * Automatically synchronizes its physics state with the active GNSS service.
 */

import { 
  type AccelerometerReading,
  type GyroscopeReading,
  type MagnetometerReading,
} from '@navic/shared-models';
import { IMUSimulator } from '@navic/sensor-fusion';
import { gnssService, DataSourceMode } from './gnss-service.js';
import { androidBridgeService } from './android-bridge-service.js';

export type AccelListener = (reading: AccelerometerReading) => void;
export type GyroListener = (reading: GyroscopeReading) => void;
export type MagListener = (reading: MagnetometerReading) => void;

class IMUServiceImpl {
  private simulator: IMUSimulator;
  
  private accelListeners: Set<AccelListener> = new Set();
  private gyroListeners: Set<GyroListener> = new Set();
  private magListeners: Set<MagListener> = new Set();

  constructor() {
    this.simulator = new IMUSimulator();

    // 1. Route simulator measurements
    this.simulator.onAccelerometer((m) => {
      if (gnssService.getSourceMode() !== DataSourceMode.AndroidHardware) {
        this.dispatchAccel(m);
      }
    });

    this.simulator.onGyroscope((m) => {
      if (gnssService.getSourceMode() !== DataSourceMode.AndroidHardware) {
        this.dispatchGyro(m);
      }
    });

    this.simulator.onMagnetometer((m) => {
      if (gnssService.getSourceMode() !== DataSourceMode.AndroidHardware) {
        this.dispatchMag(m);
      }
    });

    // 2. Route native Android hardware sensor measurements
    androidBridgeService.onHardwareAccel((reading) => {
      if (gnssService.getSourceMode() === DataSourceMode.AndroidHardware) {
        this.dispatchAccel(reading);
      }
    });

    androidBridgeService.onHardwareGyro((reading) => {
      if (gnssService.getSourceMode() === DataSourceMode.AndroidHardware) {
        this.dispatchGyro(reading);
      }
    });

    androidBridgeService.onHardwareMag((reading) => {
      if (gnssService.getSourceMode() === DataSourceMode.AndroidHardware) {
        this.dispatchMag(reading);
      }
    });

    // Synchronize physics with GNSS movement during simulation or laptop tracking
    gnssService.subscribe((gnssMsg) => {
      this.simulator.updateVehicleState(gnssMsg.speed, gnssMsg.bearing);
    });
  }

  private dispatchAccel(m: AccelerometerReading): void {
    for (const listener of this.accelListeners) {
      try { listener(m); } catch (e) {}
    }
  }

  private dispatchGyro(m: GyroscopeReading): void {
    for (const listener of this.gyroListeners) {
      try { listener(m); } catch (e) {}
    }
  }

  private dispatchMag(m: MagnetometerReading): void {
    for (const listener of this.magListeners) {
      try { listener(m); } catch (e) {}
    }
  }

  getSimulator(): IMUSimulator {
    return this.simulator;
  }

  start(frequencyHz = 50): void {
    this.simulator.start(frequencyHz);
  }

  stop(): void {
    this.simulator.stop();
  }

  subscribeAccelerometer(listener: AccelListener): () => void {
    this.accelListeners.add(listener);
    return () => this.accelListeners.delete(listener);
  }

  subscribeGyroscope(listener: GyroListener): () => void {
    this.gyroListeners.add(listener);
    return () => this.gyroListeners.delete(listener);
  }

  subscribeMagnetometer(listener: MagListener): () => void {
    this.magListeners.add(listener);
    return () => this.magListeners.delete(listener);
  }
}

export const imuService = new IMUServiceImpl();
