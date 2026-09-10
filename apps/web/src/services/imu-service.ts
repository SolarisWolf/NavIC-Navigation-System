/**
 * IMU Service
 *
 * Singleton service that manages the IMUSimulator instance and
 * distributes 3-axis sensor updates to UI subscribers.
 * Automatically synchronizes its physics state with the GNSS service.
 */

import { 
  type AccelerometerReading,
  type GyroscopeReading,
  type MagnetometerReading,
} from '@navic/shared-models';
import { IMUSimulator } from '@navic/sensor-fusion';
import { gnssService } from './gnss-service.js';

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

    // Route measurements to UI listeners
    this.simulator.onAccelerometer((m) => {
      for (const listener of this.accelListeners) {
        try { listener(m); } catch (e) {}
      }
    });

    this.simulator.onGyroscope((m) => {
      for (const listener of this.gyroListeners) {
        try { listener(m); } catch (e) {}
      }
    });

    this.simulator.onMagnetometer((m) => {
      for (const listener of this.magListeners) {
        try { listener(m); } catch (e) {}
      }
    });

    // Synchronize physics with GNSS movement
    gnssService.subscribe((gnssMsg) => {
      // Feed real-time speed and bearing to the IMU simulator for realistic physics
      this.simulator.updateVehicleState(gnssMsg.speed, gnssMsg.bearing);
    });
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
