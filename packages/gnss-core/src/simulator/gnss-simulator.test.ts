import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GNSSSimulator } from './gnss-simulator.js';
import { Constellation, FixType } from '@navic/shared-models';

describe('GNSSSimulator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should emit measurements when started', () => {
    const simulator = new GNSSSimulator({ gnssUpdateRateHz: 1 });
    const measurementCallback = vi.fn();
    
    simulator.onMeasurement(measurementCallback);
    simulator.start();

    // Advance time by 1 second (one update)
    vi.advanceTimersByTime(1000);

    expect(measurementCallback).toHaveBeenCalledTimes(1);
    
    const measurement = measurementCallback.mock.calls[0][0];
    expect(measurement.isSimulated).toBe(true);
    expect(measurement.satellites.length).toBeGreaterThan(0);
    
    simulator.stop();
  });

  it('should stop emitting when stopped', () => {
    const simulator = new GNSSSimulator({ gnssUpdateRateHz: 1 });
    const measurementCallback = vi.fn();
    
    simulator.onMeasurement(measurementCallback);
    simulator.start();
    
    vi.advanceTimersByTime(1000);
    expect(measurementCallback).toHaveBeenCalledTimes(1);
    
    simulator.stop();
    vi.advanceTimersByTime(1000);
    
    expect(measurementCallback).toHaveBeenCalledTimes(1); // Still 1
  });

  it('should emit NoFix during simulated outage', () => {
    const simulator = new GNSSSimulator({ gnssUpdateRateHz: 1 });
    const measurementCallback = vi.fn();
    
    simulator.onMeasurement(measurementCallback);
    simulator.start();
    
    // Trigger outage
    simulator.simulateOutage(5000);
    vi.advanceTimersByTime(1000);
    
    const outageMeasurement = measurementCallback.mock.calls[measurementCallback.mock.calls.length - 1][0];
    expect(outageMeasurement.fixType).toBe(FixType.NoFix);
    expect(outageMeasurement.satellites.length).toBe(0);
    
    // Wait for outage to end
    vi.advanceTimersByTime(5000);
    
    const recoveredMeasurement = measurementCallback.mock.calls[measurementCallback.mock.calls.length - 1][0];
    expect(recoveredMeasurement.fixType).not.toBe(FixType.NoFix);
    
    simulator.stop();
  });

  it('should toggle NavIC visibility', () => {
    const simulator = new GNSSSimulator({ gnssUpdateRateHz: 1 });
    const measurementCallback = vi.fn();
    
    simulator.onMeasurement(measurementCallback);
    simulator.start();
    
    // NavIC on by default
    vi.advanceTimersByTime(1000);
    const m1 = measurementCallback.mock.calls[measurementCallback.mock.calls.length - 1][0];
    const hasNavIC1 = m1.satellites.some((s: any) => s.constellation === Constellation.NavIC);
    expect(hasNavIC1).toBe(true);
    
    // Disable NavIC
    simulator.setNavICAvailability(false);
    vi.advanceTimersByTime(1000);
    
    const m2 = measurementCallback.mock.calls[measurementCallback.mock.calls.length - 1][0];
    const hasNavIC2 = m2.satellites.some((s: any) => s.constellation === Constellation.NavIC);
    expect(hasNavIC2).toBe(false);
    
    simulator.stop();
  });
});
