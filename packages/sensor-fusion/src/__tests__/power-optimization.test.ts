import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PowerOptimizer } from '../engine/power-optimizer.js';
import { IMUSimulator } from '../simulator/imu-simulator.js';
import { PowerProfileMode, VehicleDynamicsState } from '@navic/shared-models';

describe('Phase 17: Battery & Power Optimization', () => {
  describe('IMUSimulator Dynamic Frequency Throttling', () => {
    let imu: IMUSimulator;

    beforeEach(() => {
      vi.useFakeTimers();
      imu = new IMUSimulator();
    });

    afterEach(() => {
      imu.stop();
      vi.useRealTimers();
    });

    it('should start with 50 Hz default frequency and count ticks accurately', () => {
      let ticks = 0;
      imu.onAccelerometer(() => { ticks++; });
      imu.start(50);

      expect(imu.getFrequency()).toBe(50);

      // Advance by 1 second (1000 ms) -> ~50 ticks
      vi.advanceTimersByTime(1000);
      expect(ticks).toBe(50);
    });

    it('should dynamically throttle frequency to 10 Hz without stopping', () => {
      let ticks = 0;
      imu.onAccelerometer(() => { ticks++; });
      imu.start(50);

      vi.advanceTimersByTime(1000);
      expect(ticks).toBe(50);

      // Throttle to 10 Hz
      imu.setFrequency(10);
      expect(imu.getFrequency()).toBe(10);

      // Advance by another 1 second -> should add only 10 ticks
      vi.advanceTimersByTime(1000);
      expect(ticks).toBe(60);
    });

    it('should restore frequency back to 50 Hz', () => {
      let ticks = 0;
      imu.onAccelerometer(() => { ticks++; });
      imu.start(10);

      vi.advanceTimersByTime(1000);
      expect(ticks).toBe(10);

      // Restore to 50 Hz
      imu.setFrequency(50);
      expect(imu.getFrequency()).toBe(50);

      vi.advanceTimersByTime(1000);
      expect(ticks).toBe(60);
    });
  });

  describe('PowerOptimizer Vehicle Dynamics & Adaptive Throttling', () => {
    let optimizer: PowerOptimizer;

    beforeEach(() => {
      optimizer = new PowerOptimizer({
        stationarySpeedThresholdMs: 0.8,
        stationaryDebounceMs: 8000,
        highwaySpeedThresholdMs: 15.0,
        autoPowerSaverThreshold: 20,
      });
    });

    it('should initialize in STATIONARY state with throttled target rates', () => {
      const status = optimizer.getStatus();
      expect(status.vehicleDynamics).toBe(VehicleDynamicsState.STATIONARY);
      expect(status.profileMode).toBe(PowerProfileMode.NORMAL);
      expect(status.activeImuRateHz).toBe(10); // Stationary throttled
      expect(status.mapFpsLimit).toBe(15);
    });

    it('should immediately transition to IN_MOTION when speed exceeds threshold', () => {
      optimizer.updateSpeed(2.5, 1000);
      const status = optimizer.getStatus();

      expect(status.vehicleDynamics).toBe(VehicleDynamicsState.IN_MOTION);
      expect(status.activeImuRateHz).toBe(50); // Full rate
      expect(status.mapFpsLimit).toBe(60);
    });

    it('should transition to HIGHWAY_CRUISE when speed exceeds 15 m/s (54 km/h)', () => {
      optimizer.updateSpeed(18.0, 1000);
      const status = optimizer.getStatus();

      expect(status.vehicleDynamics).toBe(VehicleDynamicsState.HIGHWAY_CRUISE);
      expect(status.activeImuRateHz).toBe(50);
      expect(status.mapFpsLimit).toBe(60);
    });

    it('should require 8000ms debounce before returning to STATIONARY state', () => {
      // Vehicle starts moving
      optimizer.updateSpeed(5.0, 1000);
      expect(optimizer.getStatus().vehicleDynamics).toBe(VehicleDynamicsState.IN_MOTION);

      // Vehicle stops at a red light (speed 0 m/s at t = 2000)
      optimizer.updateSpeed(0.0, 2000);
      expect(optimizer.getStatus().vehicleDynamics).toBe(VehicleDynamicsState.IN_MOTION); // Still in motion (debouncing)

      // Advance by 5000ms (t = 7000) -> 5s elapsed < 8s debounce
      optimizer.updateSpeed(0.0, 7000);
      expect(optimizer.getStatus().vehicleDynamics).toBe(VehicleDynamicsState.IN_MOTION);

      // Advance past 8000ms (t = 10001) -> 8001ms elapsed -> transitions to STATIONARY
      optimizer.updateSpeed(0.0, 10001);
      expect(optimizer.getStatus().vehicleDynamics).toBe(VehicleDynamicsState.STATIONARY);
      expect(optimizer.getStatus().activeImuRateHz).toBe(10);
    });

    it('should reset stationary debounce if vehicle accelerates momentarily', () => {
      optimizer.updateSpeed(5.0, 1000);
      expect(optimizer.getStatus().vehicleDynamics).toBe(VehicleDynamicsState.IN_MOTION);

      // Stop for 4 seconds
      optimizer.updateSpeed(0.0, 2000);
      optimizer.updateSpeed(0.0, 6000);
      expect(optimizer.getStatus().vehicleDynamics).toBe(VehicleDynamicsState.IN_MOTION);

      // Creep forward slightly in traffic (1.2 m/s > 0.8 threshold)
      optimizer.updateSpeed(1.2, 7000);
      expect(optimizer.getStatus().vehicleDynamics).toBe(VehicleDynamicsState.IN_MOTION);

      // Stop again at t = 8000
      optimizer.updateSpeed(0.0, 8000);

      // Check at t = 13000 (only 5s since reset) -> still IN_MOTION
      optimizer.updateSpeed(0.0, 13000);
      expect(optimizer.getStatus().vehicleDynamics).toBe(VehicleDynamicsState.IN_MOTION);

      // At t = 16001 (8001ms after reset) -> transitions to STATIONARY
      optimizer.updateSpeed(0.0, 16001);
      expect(optimizer.getStatus().vehicleDynamics).toBe(VehicleDynamicsState.STATIONARY);
    });

    it('should respect adaptive throttling disable switch', () => {
      optimizer.updateSpeed(0.0, 10000); // stationary
      expect(optimizer.getStatus().activeImuRateHz).toBe(10);

      // Disable adaptive throttling
      optimizer.setAdaptiveThrottlingEnabled(false);
      expect(optimizer.getStatus().activeImuRateHz).toBe(50); // Maintains 50 Hz even when stationary
    });
  });

  describe('PowerOptimizer Battery & Power Saver Modes', () => {
    let optimizer: PowerOptimizer;

    beforeEach(() => {
      optimizer = new PowerOptimizer({
        autoPowerSaverThreshold: 20,
      });
    });

    it('should support manual Power Saver Mode override', () => {
      optimizer.updateSpeed(5.0, 1000); // moving
      expect(optimizer.getStatus().activeImuRateHz).toBe(50);

      optimizer.setPowerSaverMode(true);
      const status = optimizer.getStatus();

      expect(status.isPowerSaverActive).toBe(true);
      expect(status.profileMode).toBe(PowerProfileMode.POWER_SAVER);
      expect(status.activeImuRateHz).toBe(25); // Capped at 25 Hz
      expect(status.mapFpsLimit).toBe(30); // Capped at 30 FPS
    });

    it('should automatically trigger Power Saver Mode when battery <= 20%', () => {
      optimizer.updateSpeed(5.0, 1000); // moving
      expect(optimizer.getStatus().profileMode).toBe(PowerProfileMode.NORMAL);

      // Battery drops to 18%
      optimizer.updateBattery({ levelPercent: 18, isCharging: false });
      const status = optimizer.getStatus();

      expect(status.isPowerSaverActive).toBe(true);
      expect(status.profileMode).toBe(PowerProfileMode.POWER_SAVER);
      expect(status.activeImuRateHz).toBe(25);
    });

    it('should enter CRITICAL mode when battery <= 10%', () => {
      optimizer.updateSpeed(5.0, 1000); // moving
      optimizer.updateBattery({ levelPercent: 8, isCharging: false });
      const status = optimizer.getStatus();

      expect(status.profileMode).toBe(PowerProfileMode.CRITICAL);
      expect(status.activeImuRateHz).toBe(10); // Throttle to 10 Hz even while moving
      expect(status.mapFpsLimit).toBe(15);
    });

    it('should return to NORMAL mode when plugged into charger', () => {
      optimizer.updateBattery({ levelPercent: 15, isCharging: false });
      expect(optimizer.getStatus().profileMode).toBe(PowerProfileMode.POWER_SAVER);

      // Connect charger
      optimizer.updateBattery({ isCharging: true, chargingSource: 'USB' });
      expect(optimizer.getStatus().profileMode).toBe(PowerProfileMode.NORMAL);
      expect(optimizer.getStatus().battery.estimatedHoursRemaining).toBe(99.0);
    });

    it('should calculate estimated battery hours correctly', () => {
      // 90% in Normal mode (15% per hour burn rate) -> 90 / 15 = 6.0 hours
      optimizer.updateBattery({ levelPercent: 90, isCharging: false });
      expect(optimizer.getStatus().battery.estimatedHoursRemaining).toBe(6.0);

      // Enable Power Saver (8% per hour burn rate) -> 90 / 8 = 11.3 hours
      optimizer.setPowerSaverMode(true);
      optimizer.updateBattery({ levelPercent: 90 });
      expect(optimizer.getStatus().battery.estimatedHoursRemaining).toBe(11.3);
    });

    it('should notify listeners on status changes', () => {
      let listenerCalls = 0;
      const unsubscribe = optimizer.onStatusChange(() => {
        listenerCalls++;
      });

      expect(listenerCalls).toBe(1); // Immediate initial callback

      optimizer.setWakeLockActive(true);
      expect(listenerCalls).toBe(2);

      optimizer.updateSpeed(10.0);
      expect(listenerCalls).toBe(3);

      unsubscribe();
      optimizer.setWakeLockActive(false);
      expect(listenerCalls).toBe(3); // No more calls after unsubscribe
    });
  });
});
