import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateDOP } from '../engine/dop-calculator.js';
import { OutlierFilter } from '../engine/outlier-filter.js';
import { PositionEngine } from '../engine/position-engine.js';
import { Constellation, FixType, GNSSMeasurement, SatelliteInfo } from '@navic/shared-models';

describe('DOP Calculator', () => {
  it('should return degraded DOP (99.9) when fewer than 4 satellites are used', () => {
    const sats: SatelliteInfo[] = [
      { svid: 1, constellation: Constellation.NavIC, snr: 40, elevation: 45, azimuth: 90, usedInFix: true },
      { svid: 2, constellation: Constellation.GPS, snr: 38, elevation: 30, azimuth: 180, usedInFix: true },
      { svid: 3, constellation: Constellation.Galileo, snr: 35, elevation: 60, azimuth: 270, usedInFix: true },
    ];

    const dop = calculateDOP(sats);
    expect(dop.hdop).toBe(99.9);
    expect(dop.vdop).toBe(99.9);
    expect(dop.pdop).toBe(99.9);
    expect(dop.gdop).toBe(99.9);
  });

  it('should compute realistic DOP values with good satellite geometry', () => {
    // 8 satellites spread across azimuths and elevations
    const sats: SatelliteInfo[] = [
      { svid: 1, constellation: Constellation.NavIC, snr: 42, elevation: 65, azimuth: 45, usedInFix: true },
      { svid: 2, constellation: Constellation.NavIC, snr: 40, elevation: 55, azimuth: 135, usedInFix: true },
      { svid: 3, constellation: Constellation.NavIC, snr: 39, elevation: 50, azimuth: 225, usedInFix: true },
      { svid: 4, constellation: Constellation.GPS, snr: 38, elevation: 35, azimuth: 315, usedInFix: true },
      { svid: 5, constellation: Constellation.GPS, snr: 36, elevation: 70, azimuth: 10, usedInFix: true },
      { svid: 6, constellation: Constellation.Galileo, snr: 37, elevation: 40, azimuth: 100, usedInFix: true },
      { svid: 7, constellation: Constellation.BeiDou, snr: 35, elevation: 45, azimuth: 190, usedInFix: true },
      { svid: 8, constellation: Constellation.GLONASS, snr: 33, elevation: 30, azimuth: 280, usedInFix: true },
    ];

    const dop = calculateDOP(sats);
    expect(dop.hdop).toBeGreaterThan(0.5);
    expect(dop.hdop).toBeLessThan(5.0);
    expect(dop.vdop).toBeGreaterThan(0.5);
    expect(dop.vdop).toBeLessThan(10.0);
    expect(dop.pdop).toBeGreaterThan(dop.hdop);
    expect(dop.gdop).toBeGreaterThan(dop.pdop);
  });
});

describe('Outlier Filter', () => {
  let filter: OutlierFilter;

  beforeEach(() => {
    filter = new OutlierFilter({
      maxAccelerationMs2: 30.0,
      maxAbsoluteSpeedMs: 60.0,
      maxJumpMeters: 100.0,
    });
  });

  it('should accept smooth realistic vehicle trajectory', () => {
    const t0 = 100000;
    // Step 1: initial fix
    let res = filter.check({ latitude: 28.6139, longitude: 77.2090 }, 10, t0);
    expect(res.isOutlier).toBe(false);

    // Step 2: 1 second later, moved ~10m North
    res = filter.check({ latitude: 28.6140, longitude: 77.2090 }, 10, t0 + 1000);
    expect(res.isOutlier).toBe(false);
  });

  it('should reject instantaneous teleportation jump (> 100m in 1s)', () => {
    const t0 = 100000;
    filter.check({ latitude: 28.6139, longitude: 77.2090 }, 10, t0);

    // Jump by ~0.005 deg (~550 meters) in 1s
    const res = filter.check({ latitude: 28.6189, longitude: 77.2090 }, 10, t0 + 1000);
    expect(res.isOutlier).toBe(true);
    expect(res.reason).toContain('exceeds max limit');
  });

  it('should reject physically impossible acceleration (> 30 m/s²)', () => {
    const t0 = 100000;
    filter.check({ latitude: 28.6139, longitude: 77.2090 }, 0, t0);

    // 1s later, jump distance corresponds to 45 m/s from standstill (accel = 45 m/s²)
    // 45m North in 1s = ~0.0004 deg
    const res = filter.check({ latitude: 28.6143, longitude: 77.2090 }, 45, t0 + 1000);
    expect(res.isOutlier).toBe(true);
    expect(res.reason).toContain('Acceleration');
  });
});

describe('Position Engine', () => {
  let engine: PositionEngine;

  beforeEach(() => {
    engine = new PositionEngine({
      smoothingFactor: 0.5,
      stationarySpeedThresholdMs: 0.5,
      lossOfFixTimeoutMs: 1500,
    });
  });

  afterEach(() => {
    engine.destroy();
  });

  function createMockMeasurement(overrides?: Partial<GNSSMeasurement>): GNSSMeasurement {
    return {
      timestamp: Date.now(),
      latitude: 28.6139,
      longitude: 77.2090,
      altitude: 216,
      speed: 12.0,
      bearing: 90.0,
      horizontalAccuracy: 2.5,
      verticalAccuracy: 3.5,
      fixType: FixType.Fix3D,
      isSimulated: true,
      satellites: [
        { svid: 1, constellation: Constellation.NavIC, snr: 42, elevation: 65, azimuth: 45, usedInFix: true },
        { svid: 2, constellation: Constellation.NavIC, snr: 40, elevation: 55, azimuth: 135, usedInFix: true },
        { svid: 3, constellation: Constellation.GPS, snr: 38, elevation: 35, azimuth: 315, usedInFix: true },
        { svid: 4, constellation: Constellation.Galileo, snr: 36, elevation: 70, azimuth: 10, usedInFix: true },
      ],
      ...overrides,
    };
  }

  it('should process valid measurements and smooth coordinates', () => {
    const t0 = 100000;
    // 1st fix at lat=28.6139
    const pos1 = engine.processMeasurement(createMockMeasurement({ latitude: 28.6139, timestamp: t0 }));
    expect(pos1.coordinate.latitude).toBeCloseTo(28.6139, 5);

    // 2nd fix 1s later at lat=28.6141 (with alpha=0.5, smoothed lat should be exactly midpoint: 28.6140)
    const pos2 = engine.processMeasurement(createMockMeasurement({ latitude: 28.6141, timestamp: t0 + 1000 }));
    expect(pos2.coordinate.latitude).toBeCloseTo(28.6140, 5);
    expect(pos2.rawCoordinate.latitude).toBe(28.6141);
  });

  it('should lock bearing when vehicle is stationary (speed < 0.5 m/s)', () => {
    const t0 = 100000;
    // Moving at 10 m/s with bearing 90 degrees
    engine.processMeasurement(createMockMeasurement({ speed: 10, bearing: 90, timestamp: t0 }));

    // Vehicle comes to complete stop (speed = 0 m/s) 1s later, but raw GNSS bearing fluctuates to 270 degrees
    const stoppedPos = engine.processMeasurement(createMockMeasurement({ speed: 0, bearing: 270, timestamp: t0 + 1000 }));

    // Stationary bearing lock should preserve previous heading (90°) instead of erratic 270°
    expect(stoppedPos.bearing).toBe(90);
  });

  it('should flag NavIC-assisted fix when NavIC satellites are used', () => {
    const m = createMockMeasurement();
    const pos = engine.processMeasurement(m);

    expect(pos.isNavICAssisted).toBe(true);
    expect(pos.navicSatellitesUsed).toBe(2);
    expect(pos.satellitesUsed).toBe(4);
  });

  it('should handle NoFix and notify loss of fix callbacks', () => {
    let lossOfFixTriggered = false;
    engine.onLossOfFix(() => {
      lossOfFixTriggered = true;
    });

    // Valid fix
    engine.processMeasurement(createMockMeasurement());
    expect(lossOfFixTriggered).toBe(false);

    // Loss of fix
    const noFix = createMockMeasurement({ fixType: FixType.NoFix, latitude: 0, longitude: 0 });
    const pos = engine.processMeasurement(noFix);

    expect(pos.fixType).toBe(FixType.NoFix);
    expect(lossOfFixTriggered).toBe(true);
  });
});
