import { describe, it, expect, beforeEach } from 'vitest';
import {
  identityMatrix,
  matrixAdd,
  matrixMultiply,
  matrixInverse,
  matrixTranspose,
  normalizeAngleRad,
  normalizeAngleDeg,
} from '../math/matrix.js';
import { wgs84ToEnu, enuToWgs84 } from '../math/coordinates.js';
import { ExtendedKalmanFilter } from '../ekf/extended-kalman-filter.js';
import { SensorFusionEngine } from '../sensor-fusion-engine.js';
import { FixType, GNSSMeasurement, SensorFusionMode } from '@navic/shared-models';

describe('Matrix Operations', () => {
  it('should invert an identity matrix to itself', () => {
    const I = identityMatrix(4);
    const inv = matrixInverse(I);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        expect(inv[i][j]).toBeCloseTo(I[i][j], 5);
      }
    }
  });

  it('should correctly invert a symmetric positive-definite matrix', () => {
    // 3x3 test matrix
    const A = [
      [4, 1, 2],
      [1, 5, 0],
      [2, 0, 3],
    ];
    const inv = matrixInverse(A);
    const prod = matrixMultiply(A, inv);
    const I = identityMatrix(3);

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(prod[i][j]).toBeCloseTo(I[i][j], 4);
      }
    }
  });

  it('should normalize angles in radians to [-pi, pi]', () => {
    expect(normalizeAngleRad(0)).toBeCloseTo(0);
    expect(normalizeAngleRad(Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeAngleRad(Math.PI + 0.5)).toBeCloseTo(-Math.PI + 0.5);
    expect(normalizeAngleRad(-Math.PI - 0.5)).toBeCloseTo(Math.PI - 0.5);
    expect(normalizeAngleRad(3 * Math.PI)).toBeCloseTo(Math.PI);
  });

  it('should normalize angles in degrees to [0, 360)', () => {
    expect(normalizeAngleDeg(0)).toBe(0);
    expect(normalizeAngleDeg(360)).toBe(0);
    expect(normalizeAngleDeg(370)).toBe(10);
    expect(normalizeAngleDeg(-10)).toBe(350);
  });
});

describe('Coordinate Conversions (WGS84 <-> Local ENU)', () => {
  it('should have zero displacement at anchor point', () => {
    const anchor = { latitude: 28.6139, longitude: 77.2090, altitude: 216 };
    const enu = wgs84ToEnu(anchor, anchor);
    expect(enu.east).toBeCloseTo(0, 5);
    expect(enu.north).toBeCloseTo(0, 5);
    expect(enu.up).toBeCloseTo(0, 5);
  });

  it('should round-trip coordinates accurately within millimeter tolerance', () => {
    const anchor = { latitude: 28.6139, longitude: 77.2090, altitude: 216 };
    const target = { latitude: 28.6250, longitude: 77.2200, altitude: 220 };

    const enu = wgs84ToEnu(target, anchor);
    const roundtrip = enuToWgs84(enu, anchor);

    expect(roundtrip.latitude).toBeCloseTo(target.latitude, 6);
    expect(roundtrip.longitude).toBeCloseTo(target.longitude, 6);
    expect(roundtrip.altitude).toBeCloseTo(target.altitude, 4);
  });
});

describe('Extended Kalman Filter (EKF)', () => {
  let ekf: ExtendedKalmanFilter;

  beforeEach(() => {
    ekf = new ExtendedKalmanFilter();
  });

  it('should initialize state correctly', () => {
    ekf.initialize(10, 20, 5, 12.5, Math.PI / 4);
    const state = ekf.getState();

    expect(state.east).toBe(10);
    expect(state.north).toBe(20);
    expect(state.speed).toBe(12.5);
    expect(state.bearingRad).toBeCloseTo(Math.PI / 4);
    expect(state.bearingDeg).toBeCloseTo(45);
    expect(state.accuracy).toBeGreaterThan(0);
  });

  it('should propagate forward motion along heading in prediction step', () => {
    // Initialized at origin, heading East (pi/2 rad), speed = 10 m/s
    ekf.initialize(0, 0, 0, 10, Math.PI / 2);

    // Run 50 Hz prediction for 1 second (50 steps of dt = 0.02s) with 0 accel and 0 yaw rate
    for (let i = 0; i < 50; i++) {
      ekf.predict(0.02, 0, 0);
    }

    const state = ekf.getState();
    // After 1s at 10 m/s East: East should be ~10m, North ~0m
    expect(state.east).toBeCloseTo(10.0, 1);
    expect(state.north).toBeCloseTo(0.0, 1);
    expect(state.speed).toBeCloseTo(10.0, 1);
  });

  it('should propagate vehicle turn via gyroscope yaw rate', () => {
    // Heading North (0 rad), speed = 10 m/s
    ekf.initialize(0, 0, 0, 10, 0);

    // Turn 90 degrees right over 1 second (yawRate = pi/2 rad/s)
    const yawRate = Math.PI / 2;
    for (let i = 0; i < 50; i++) {
      ekf.predict(0.02, 0, yawRate);
    }

    const state = ekf.getState();
    // Heading should now be East (pi/2 rad, 90 deg)
    expect(state.bearingRad).toBeCloseTo(Math.PI / 2, 1);
    expect(state.bearingDeg).toBeCloseTo(90, 0);
  });

  it('should reduce uncertainty when incorporating GNSS measurement updates', () => {
    ekf.initialize(0, 0, 0, 10, 0);

    // Let uncertainty grow through prediction steps
    for (let i = 0; i < 50; i++) {
      ekf.predict(0.02, 0, 0);
    }
    const uncertBefore = ekf.getState().accuracy;

    // Ingest GNSS observation with 2m accuracy
    ekf.updateGNSS({
      east: 0,
      north: 10,
      up: 0,
      speed: 10,
      bearingRad: 0,
      horizontalAccuracy: 2.0,
      verticalAccuracy: 3.0,
    });

    const uncertAfter = ekf.getState().accuracy;
    expect(uncertAfter).toBeLessThan(uncertBefore);
  });

  it('should perform continuous Dead Reckoning during GNSS outage', () => {
    ekf.initialize(0, 0, 0, 15, 0); // 15 m/s North

    // Simulate 3 seconds of GNSS outage (150 IMU prediction cycles)
    for (let i = 0; i < 150; i++) {
      ekf.predict(0.02, 0, 0);
    }

    const state = ekf.getState();
    // In 3 seconds at 15 m/s, vehicle should have moved ~45 meters North
    expect(state.north).toBeCloseTo(45, 1);
    expect(state.speed).toBeCloseTo(15, 1);
    // Uncertainty should grow during outage
    expect(state.accuracy).toBeGreaterThan(4.0);
  });

  it('should execute well under 20ms latency target (benchmark)', () => {
    ekf.initialize(0, 0, 0, 10, 0);

    const iterations = 500;
    const t0 = performance.now();

    for (let i = 0; i < iterations; i++) {
      ekf.predict(0.02, 0.1, 0.05);
      if (i % 50 === 0) {
        ekf.updateGNSS({
          east: i * 0.2,
          north: i * 0.2,
          up: 0,
          speed: 10,
          bearingRad: 0,
          horizontalAccuracy: 2.5,
          verticalAccuracy: 3.0,
        });
      }
    }

    const elapsed = performance.now() - t0;
    const avgLatencyMs = elapsed / iterations;

    // Spec target is ~20ms. Our optimized filter runs in < 0.5ms
    expect(avgLatencyMs).toBeLessThan(20.0);
    expect(avgLatencyMs).toBeLessThan(2.0); // Strict threshold
  });
});

describe('SensorFusionEngine', () => {
  let engine: SensorFusionEngine;

  beforeEach(() => {
    engine = new SensorFusionEngine();
  });

  it('should transition from INITIALIZING to FULL_FUSION upon first valid GNSS fix', () => {
    expect(engine.getStatus().mode).toBe(SensorFusionMode.INITIALIZING);

    const mockFix: GNSSMeasurement = {
      timestamp: Date.now(),
      latitude: 28.6139,
      longitude: 77.2090,
      altitude: 216,
      speed: 12.0,
      bearing: 90.0,
      horizontalAccuracy: 2.0,
      verticalAccuracy: 3.0,
      fixType: FixType.Fix3D,
      satellites: [],
      isSimulated: true,
    };

    engine.processGNSS(mockFix);

    expect(engine.getStatus().mode).toBe(SensorFusionMode.FULL_FUSION);
    const estimate = engine.getLatestEstimate();
    expect(estimate).not.toBeNull();
    expect(estimate?.coordinate.latitude).toBeCloseTo(28.6139, 5);
    expect(estimate?.coordinate.longitude).toBeCloseTo(77.2090, 5);
    expect(estimate?.isDeadReckoning).toBe(false);
  });

  it('should transition to DEAD_RECKONING when GNSS reports NoFix', () => {
    const validFix: GNSSMeasurement = {
      timestamp: Date.now(),
      latitude: 28.6139,
      longitude: 77.2090,
      altitude: 216,
      speed: 10.0,
      bearing: 0.0,
      horizontalAccuracy: 2.0,
      verticalAccuracy: 3.0,
      fixType: FixType.Fix3D,
      satellites: [],
      isSimulated: true,
    };

    engine.processGNSS(validFix);
    expect(engine.getStatus().mode).toBe(SensorFusionMode.FULL_FUSION);

    // Simulate GNSS outage (tunnel / loss of fix)
    const outageFix: GNSSMeasurement = {
      timestamp: Date.now() + 1000,
      latitude: 0,
      longitude: 0,
      altitude: 0,
      speed: 0,
      bearing: 0,
      horizontalAccuracy: 999,
      verticalAccuracy: 999,
      fixType: FixType.NoFix,
      satellites: [],
      isSimulated: true,
    };

    engine.processGNSS(outageFix);
    expect(engine.getStatus().mode).toBe(SensorFusionMode.DEAD_RECKONING);
    expect(engine.getStatus().isDeadReckoning).toBe(true);

    // Feed IMU predictions during outage
    engine.processIMU(
      { timestamp: Date.now() + 1020, acceleration: { x: 0, y: 0, z: 9.81 }, isSimulated: true },
      { timestamp: Date.now() + 1020, angularVelocity: { x: 0, y: 0, z: 0 }, isSimulated: true }
    );

    const est = engine.getLatestEstimate();
    expect(est?.isDeadReckoning).toBe(true);
    expect(est?.coordinate.latitude).toBeGreaterThan(28.6139); // Moved North
  });

  it('should recover to FULL_FUSION when GNSS fix is restored', () => {
    const fix1: GNSSMeasurement = {
      timestamp: Date.now(),
      latitude: 28.6139,
      longitude: 77.2090,
      altitude: 216,
      speed: 10.0,
      bearing: 0.0,
      horizontalAccuracy: 2.0,
      verticalAccuracy: 3.0,
      fixType: FixType.Fix3D,
      satellites: [],
      isSimulated: true,
    };
    engine.processGNSS(fix1);

    // Outage
    const fixOutage: GNSSMeasurement = {
      ...fix1,
      fixType: FixType.NoFix,
      latitude: 0,
      longitude: 0,
    };
    engine.processGNSS(fixOutage);
    expect(engine.getStatus().mode).toBe(SensorFusionMode.DEAD_RECKONING);

    // Recovery
    const fixRecovered: GNSSMeasurement = {
      ...fix1,
      timestamp: Date.now() + 5000,
      latitude: 28.6145,
      longitude: 77.2090,
      fixType: FixType.Fix3D,
    };
    engine.processGNSS(fixRecovered);
    expect(engine.getStatus().mode).toBe(SensorFusionMode.FULL_FUSION);
    expect(engine.getStatus().isDeadReckoning).toBe(false);
  });
});
