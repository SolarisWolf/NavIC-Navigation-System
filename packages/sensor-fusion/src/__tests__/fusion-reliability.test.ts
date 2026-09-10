/**
 * @navic/sensor-fusion — Fusion Reliability & Extreme Stress Benchmarks
 *
 * Phase 19: Long-duration stability (15,000 cycles), multi-frequency rate jitter,
 * prolonged 300-second Dead Reckoning blackout, and extreme outlier robustness.
 */

import { describe, it, expect } from 'vitest';
import { ExtendedKalmanFilter } from '../ekf/extended-kalman-filter.js';

describe('Phase 19: ExtendedKalmanFilter Reliability & Stress Suite', () => {
  // ─── 1. 15,000 Continuous 50 Hz Cycles Stress ─────────────────────────────
  it('should maintain strict mathematical invariants over 15,000 continuous 50 Hz cycles', () => {
    const ekf = new ExtendedKalmanFilter();
    ekf.initialize(100, 200, 10, 15, 0); // 15 m/s North

    const totalCycles = 15000; // 300 seconds (5 full minutes) at 50 Hz
    const dt = 0.02; // 50 Hz
    let totalLatencyMs = 0;
    let maxLatencyMs = 0;

    for (let i = 0; i < totalCycles; i++) {
      const t0 = performance.now();

      // Dynamic vehicle maneuvers: oscillating acceleration & sinusoidal turns
      const accel = Math.sin(i * 0.02) * 3.5; // up to 3.5 m/s²
      const yawRate = Math.cos(i * 0.01) * 0.15; // up to ~8.6 deg/s
      ekf.predict(dt, accel, yawRate);

      // Periodic GNSS measurement at 1 Hz (every 50 IMU cycles)
      if (i % 50 === 0) {
        ekf.updateGNSS({
          east: 100 + Math.sin(i * 0.001) * 200,
          north: 200 + i * 0.3,
          up: 10 + Math.sin(i * 0.005) * 2,
          speed: 15 + Math.sin(i * 0.02) * 3,
          bearingRad: (i * 0.005) % (2 * Math.PI),
          horizontalAccuracy: 1.8 + Math.sin(i * 0.01) * 0.5,
          verticalAccuracy: 2.5,
        });
      }

      const elapsed = performance.now() - t0;
      totalLatencyMs += elapsed;
      if (elapsed > maxLatencyMs) maxLatencyMs = elapsed;
    }

    const avgLatencyMs = totalLatencyMs / totalCycles;

    // Automotive SLA budgets
    expect(avgLatencyMs).toBeLessThan(0.1); // Sub-0.1ms average (200x faster than 20ms budget)
    expect(maxLatencyMs).toBeLessThan(10.0); // Bounded max latency

    // Mathematical stability invariants
    const state = ekf.getState();
    expect(Number.isFinite(state.east)).toBe(true);
    expect(Number.isFinite(state.north)).toBe(true);
    expect(Number.isFinite(state.up)).toBe(true);
    expect(Number.isFinite(state.speed)).toBe(true);
    expect(Number.isFinite(state.bearingRad)).toBe(true);
    expect(Number.isFinite(state.bearingDeg)).toBe(true);
    expect(Number.isFinite(state.accelBias)).toBe(true);
    expect(Number.isFinite(state.gyroBias)).toBe(true);
    expect(Number.isFinite(state.accuracy)).toBe(true);

    expect(state.speed).toBeGreaterThanOrEqual(0);
    expect(state.accuracy).toBeGreaterThan(0);

    // Covariance matrix positive-definiteness on diagonal
    const covDiag = ekf.getCovarianceDiagonal();
    expect(covDiag).toHaveLength(7);
    for (let d = 0; d < 7; d++) {
      expect(Number.isFinite(covDiag[d])).toBe(true);
      expect(covDiag[d]).toBeGreaterThan(0);
      expect(covDiag[d]).toBeLessThan(1e6); // No unbounded explosion
    }
  });

  // ─── 2. Multi-Frequency Rate Jitter Switching ─────────────────────────────
  it('should seamlessly accommodate dynamic rate switching between 50 Hz, 25 Hz, 10 Hz, and 5 Hz', () => {
    const ekf = new ExtendedKalmanFilter();
    ekf.initialize(0, 0, 0, 10, 0);

    const rates = [50, 25, 10, 5]; // Hz
    let currentRateIdx = 0;

    for (let step = 0; step < 2000; step++) {
      // Switch sampling rate every 50 steps
      if (step % 50 === 0) {
        currentRateIdx = (currentRateIdx + 1) % rates.length;
      }

      const freqHz = rates[currentRateIdx];
      const dt = 1.0 / freqHz;

      ekf.predict(dt, 0.5, 0.02);

      // Verify no NaN or negative speed at any step
      const state = ekf.getState();
      expect(Number.isNaN(state.east)).toBe(false);
      expect(Number.isNaN(state.speed)).toBe(false);
      expect(state.speed).toBeGreaterThanOrEqual(0);
    }

    const finalState = ekf.getState();
    expect(Number.isFinite(finalState.east)).toBe(true);
    expect(Number.isFinite(finalState.north)).toBe(true);
    expect(Math.hypot(finalState.east, finalState.north)).toBeGreaterThan(0);
  });

  // ─── 3. Prolonged 300-Second Dead Reckoning Outage ─────────────────────────
  it('should maintain continuous bounded Dead Reckoning trajectory through 300s (15,000 cycles) blackout', () => {
    const ekf = new ExtendedKalmanFilter();
    ekf.initialize(0, 0, 0, 20, 0); // 20 m/s (72 km/h) North

    const blackoutCycles = 15000; // 300 seconds at 50 Hz
    const dt = 0.02;
    const initialAccuracy = ekf.getState().accuracy;

    for (let i = 0; i < blackoutCycles; i++) {
      // Gentle curve at highway speed
      ekf.predict(dt, 0.0, 0.005);
    }

    const finalState = ekf.getState();

    // Accuracy uncertainty must expand monotonically as GNSS is absent
    expect(finalState.accuracy).toBeGreaterThan(initialAccuracy);
    expect(Number.isFinite(finalState.accuracy)).toBe(true);

    // Vehicle travelled reasonable distance (approx ~6 km)
    const distance = Math.hypot(finalState.east, finalState.north);
    expect(distance).toBeGreaterThan(4000);
    expect(distance).toBeLessThan(8000);

    // Filter covariance remains positive and finite
    const cov = ekf.getCovarianceDiagonal();
    for (const v of cov) {
      expect(v).toBeGreaterThan(0);
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  // ─── 4. Outlier & Corrupt Input Resilience ────────────────────────────────
  it('should safely reject or absorb extreme sensor anomalies without NaN infection', () => {
    const ekf = new ExtendedKalmanFilter();
    ekf.initialize(500, 500, 0, 10, 0);

    // Ingest noisy prediction
    ekf.predict(0.02, 100.0, 50.0); // Extreme transient G-force spike

    // Ingest valid GNSS
    ekf.updateGNSS({
      east: 502,
      north: 505,
      up: 0,
      speed: 10.5,
      bearingRad: 0.1,
      horizontalAccuracy: 1.5,
      verticalAccuracy: 2.0,
    });

    const state = ekf.getState();
    expect(Number.isNaN(state.east)).toBe(false);
    expect(Number.isNaN(state.north)).toBe(false);
    expect(Number.isNaN(state.speed)).toBe(false);
    expect(Number.isFinite(state.accuracy)).toBe(true);
  });
});
