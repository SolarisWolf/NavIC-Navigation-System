/**
 * Phase 0 — Shared Models Unit Tests
 *
 * Tests that all shared types compile correctly, logger works,
 * error classes instantiate properly, and utility functions produce
 * correct results.
 */

import { describe, it, expect, vi } from 'vitest';

import {
  // Enums
  Constellation,
  FixType,
  ManeuverType,
  NavigationMode,
  RoutingProfile,
  RouteOptimization,
  POICategory,
  LogLevel,

  // Logger
  Logger,

  // Errors
  NavigationError,
  GNSSError,
  IMUError,
  RoutingError,
  MapError,
  FusionError,
  GNSSErrorCode,
  IMUErrorCode,
  RoutingErrorCode,
  MapErrorCode,
  FusionErrorCode,

  // Config
  DEFAULT_CONFIG,

  // Utilities
  toRadians,
  toDegrees,
  haversineDistance,
  calculateBearing,
  normalizeAngle,
  clamp,
  generateId,
  formatDistance,
  formatDuration,
  normalizeAngleRad,
  normalizeAngleDeg,
  matrixInverse,
  invert4x4,
} from '@navic/shared-models';

// ─── Enum Tests ──────────────────────────────────────────────────────────────

describe('Constellation enum', () => {
  it('should have NavIC constellation', () => {
    expect(Constellation.NavIC).toBe('NavIC');
  });

  it('should have all major constellations', () => {
    expect(Constellation.GPS).toBeDefined();
    expect(Constellation.NavIC).toBeDefined();
    expect(Constellation.Galileo).toBeDefined();
    expect(Constellation.BeiDou).toBeDefined();
    expect(Constellation.GLONASS).toBeDefined();
  });
});

describe('FixType enum', () => {
  it('should have NoFix and 3D fix types', () => {
    expect(FixType.NoFix).toBe('NoFix');
    expect(FixType.Fix3D).toBe('3D');
  });
});

describe('ManeuverType enum', () => {
  it('should have core maneuver types', () => {
    expect(ManeuverType.TurnLeft).toBeDefined();
    expect(ManeuverType.TurnRight).toBeDefined();
    expect(ManeuverType.UTurn).toBeDefined();
    expect(ManeuverType.Roundabout).toBeDefined();
    expect(ManeuverType.Arrive).toBeDefined();
    expect(ManeuverType.Depart).toBeDefined();
  });
});

describe('NavigationMode enum', () => {
  it('should have all navigation modes', () => {
    expect(NavigationMode.Idle).toBeDefined();
    expect(NavigationMode.Active).toBeDefined();
    expect(NavigationMode.Rerouting).toBeDefined();
    expect(NavigationMode.Arrived).toBeDefined();
  });
});

describe('POICategory enum', () => {
  it('should have all specified POI categories', () => {
    expect(POICategory.Hospital).toBeDefined();
    expect(POICategory.Police).toBeDefined();
    expect(POICategory.PetrolStation).toBeDefined();
    expect(POICategory.Restaurant).toBeDefined();
    expect(POICategory.Hotel).toBeDefined();
    expect(POICategory.RailwayStation).toBeDefined();
    expect(POICategory.Airport).toBeDefined();
  });
});

// ─── Logger Tests ────────────────────────────────────────────────────────────

describe('Logger', () => {
  it('should create a logger with module name', () => {
    const logger = new Logger('TestModule');
    expect(logger).toBeDefined();
  });

  it('should output formatted messages', () => {
    const messages: string[] = [];
    const logger = new Logger('GNSS', {
      level: LogLevel.DEBUG,
      output: {
        debug: (msg) => messages.push(msg),
        info: (msg) => messages.push(msg),
        warn: (msg) => messages.push(msg),
        error: (msg) => messages.push(msg),
      },
    });

    logger.info('Position fix acquired');

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('[INFO]');
    expect(messages[0]).toContain('[GNSS]');
    expect(messages[0]).toContain('Position fix acquired');
  });

  it('should add [SIM] tag when in simulation mode', () => {
    const messages: string[] = [];
    const logger = new Logger('GNSS', {
      level: LogLevel.DEBUG,
      isSimulation: true,
      output: {
        debug: (msg) => messages.push(msg),
        info: (msg) => messages.push(msg),
        warn: (msg) => messages.push(msg),
        error: (msg) => messages.push(msg),
      },
    });

    logger.info('Simulated position');
    expect(messages[0]).toContain('[SIM]');
  });

  it('should filter messages below configured level', () => {
    const messages: string[] = [];
    const logger = new Logger('Test', {
      level: LogLevel.WARN,
      output: {
        debug: (msg) => messages.push(msg),
        info: (msg) => messages.push(msg),
        warn: (msg) => messages.push(msg),
        error: (msg) => messages.push(msg),
      },
    });

    logger.debug('should not appear');
    logger.info('should not appear');
    logger.warn('should appear');
    logger.error('should appear');

    expect(messages).toHaveLength(2);
  });

  it('should create child loggers with inherited settings', () => {
    const messages: string[] = [];
    const parentLogger = new Logger('Parent', {
      level: LogLevel.DEBUG,
      isSimulation: true,
      output: {
        debug: (msg) => messages.push(msg),
        info: (msg) => messages.push(msg),
        warn: (msg) => messages.push(msg),
        error: (msg) => messages.push(msg),
      },
    });

    const childLogger = parentLogger.child('Child');
    childLogger.info('child message');

    expect(messages[0]).toContain('[Child]');
    expect(messages[0]).toContain('[SIM]');
  });
});

// ─── Error Tests ─────────────────────────────────────────────────────────────

describe('Error classes', () => {
  it('should create NavigationError with code and message', () => {
    const error = new NavigationError('TEST_CODE', 'Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.message).toBe('Test message');
    expect(error.name).toBe('NavigationError');
    expect(error.timestamp).toBeDefined();
    expect(error instanceof Error).toBe(true);
  });

  it('should create GNSSError with correct error codes', () => {
    const error = new GNSSError(GNSSErrorCode.NO_FIX, 'No satellite fix available');
    expect(error.code).toBe('GNSS_NO_FIX');
    expect(error.name).toBe('GNSSError');
    expect(error instanceof NavigationError).toBe(true);
    expect(error instanceof GNSSError).toBe(true);
  });

  it('should create IMUError with correct error codes', () => {
    const error = new IMUError(IMUErrorCode.SENSOR_UNAVAILABLE, 'Gyroscope not found');
    expect(error.code).toBe('IMU_SENSOR_UNAVAILABLE');
    expect(error.name).toBe('IMUError');
    expect(error instanceof NavigationError).toBe(true);
  });

  it('should create RoutingError with correct error codes', () => {
    const error = new RoutingError(RoutingErrorCode.NO_ROUTE_FOUND, 'Cannot reach destination');
    expect(error.code).toBe('ROUTING_NO_ROUTE');
    expect(error.name).toBe('RoutingError');
    expect(error instanceof NavigationError).toBe(true);
  });

  it('should create MapError with correct error codes', () => {
    const error = new MapError(MapErrorCode.TILES_NOT_FOUND, 'MBTiles file missing');
    expect(error.code).toBe('MAP_TILES_NOT_FOUND');
    expect(error.name).toBe('MapError');
    expect(error instanceof NavigationError).toBe(true);
  });

  it('should create FusionError with correct error codes', () => {
    const error = new FusionError(FusionErrorCode.EKF_DIVERGENCE, 'Filter diverged');
    expect(error.code).toBe('FUSION_EKF_DIVERGENCE');
    expect(error.name).toBe('FusionError');
    expect(error instanceof NavigationError).toBe(true);
  });

  it('should carry optional details', () => {
    const details = { latitude: 20.5, longitude: 78.9 };
    const error = new GNSSError(GNSSErrorCode.INVALID_DATA, 'Bad coordinates', details);
    expect(error.details).toEqual(details);
  });
});

// ─── Configuration Tests ────────────────────────────────────────────────────

describe('DEFAULT_CONFIG', () => {
  it('should have simulation enabled by default', () => {
    expect(DEFAULT_CONFIG.simulation.enabled).toBe(true);
  });

  it('should target 20ms EKF latency', () => {
    expect(DEFAULT_CONFIG.ekf.targetLatencyMs).toBe(20);
  });

  it('should have India-centered default map', () => {
    expect(DEFAULT_CONFIG.map.defaultCenter.latitude).toBeCloseTo(20.5937, 2);
    expect(DEFAULT_CONFIG.map.defaultCenter.longitude).toBeCloseTo(78.9629, 2);
  });

  it('should have reasonable GNSS timeout', () => {
    expect(DEFAULT_CONFIG.ekf.gnssTimeoutMs).toBeGreaterThan(0);
  });

  it('should have off-route threshold', () => {
    expect(DEFAULT_CONFIG.navigation.offRouteThresholdMeters).toBeGreaterThan(0);
  });
});

// ─── Utility Tests ───────────────────────────────────────────────────────────

describe('Utility functions', () => {
  describe('toRadians / toDegrees', () => {
    it('should convert degrees to radians', () => {
      expect(toRadians(180)).toBeCloseTo(Math.PI, 10);
      expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 10);
      expect(toRadians(0)).toBe(0);
    });

    it('should convert radians to degrees', () => {
      expect(toDegrees(Math.PI)).toBeCloseTo(180, 10);
      expect(toDegrees(Math.PI / 2)).toBeCloseTo(90, 10);
      expect(toDegrees(0)).toBe(0);
    });

    it('should be inverse operations', () => {
      expect(toDegrees(toRadians(45))).toBeCloseTo(45, 10);
      expect(toRadians(toDegrees(1.5))).toBeCloseTo(1.5, 10);
    });
  });

  describe('haversineDistance', () => {
    it('should return 0 for same point', () => {
      expect(haversineDistance(20.5, 78.9, 20.5, 78.9)).toBe(0);
    });

    it('should calculate distance between Delhi and Mumbai (~1150 km)', () => {
      // Delhi: 28.6139°N, 77.2090°E
      // Mumbai: 19.0760°N, 72.8777°E
      const distance = haversineDistance(28.6139, 77.2090, 19.0760, 72.8777);
      expect(distance).toBeGreaterThan(1_100_000); // > 1100 km
      expect(distance).toBeLessThan(1_200_000);    // < 1200 km
    });

    it('should handle antipodal points', () => {
      // Distance should be approximately half Earth circumference
      const distance = haversineDistance(0, 0, 0, 180);
      expect(distance).toBeGreaterThan(20_000_000); // > 20,000 km
    });
  });

  describe('calculateBearing', () => {
    it('should return 0 for due north', () => {
      const bearing = calculateBearing(0, 0, 1, 0);
      expect(bearing).toBeCloseTo(0, 0);
    });

    it('should return ~90 for due east', () => {
      const bearing = calculateBearing(0, 0, 0, 1);
      expect(bearing).toBeCloseTo(90, 0);
    });

    it('should return ~180 for due south', () => {
      const bearing = calculateBearing(1, 0, 0, 0);
      expect(bearing).toBeCloseTo(180, 0);
    });

    it('should return ~270 for due west', () => {
      const bearing = calculateBearing(0, 1, 0, 0);
      expect(bearing).toBeCloseTo(270, 0);
    });
  });

  describe('normalizeAngle', () => {
    it('should normalize angles to 0-360 range', () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(360)).toBe(0);
      expect(normalizeAngle(-90)).toBe(270);
      expect(normalizeAngle(450)).toBe(90);
    });
  });

  describe('clamp', () => {
    it('should clamp values within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should return a non-empty string', () => {
      const id = generateId();
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('formatDistance', () => {
    it('should format meters for short distances', () => {
      expect(formatDistance(250)).toBe('250 m');
      expect(formatDistance(999)).toBe('999 m');
    });

    it('should format kilometers for long distances', () => {
      expect(formatDistance(1000)).toBe('1.0 km');
      expect(formatDistance(2500)).toBe('2.5 km');
      expect(formatDistance(150000)).toBe('150.0 km');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds', () => {
      expect(formatDuration(30)).toBe('30 sec');
    });

    it('should format minutes', () => {
      expect(formatDuration(300)).toBe('5 min');
    });

    it('should format hours and minutes', () => {
      expect(formatDuration(5400)).toBe('1 hr 30 min');
    });

    it('should format exact hours', () => {
      expect(formatDuration(7200)).toBe('2 hr');
    });
  });

  describe('normalizeAngleRad & normalizeAngleDeg', () => {
    it('should normalize angles in radians to [-pi, pi]', () => {
      expect(normalizeAngleRad(0)).toBeCloseTo(0);
      expect(normalizeAngleRad(Math.PI)).toBeCloseTo(Math.PI);
      expect(normalizeAngleRad(3 * Math.PI)).toBeCloseTo(Math.PI);
      expect(normalizeAngleRad(-3 * Math.PI)).toBeCloseTo(Math.PI);
      expect(normalizeAngleRad(Math.PI / 2)).toBeCloseTo(Math.PI / 2);
      expect(normalizeAngleRad(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
    });

    it('should normalize angles in degrees to [0, 360)', () => {
      expect(normalizeAngleDeg(0)).toBe(0);
      expect(normalizeAngleDeg(360)).toBe(0);
      expect(normalizeAngleDeg(720)).toBe(0);
      expect(normalizeAngleDeg(-90)).toBe(270);
      expect(normalizeAngleDeg(450)).toBe(90);
    });
  });

  describe('matrixInverse & invert4x4', () => {
    it('should invert 2x2 identity matrix', () => {
      const I = [[1, 0], [0, 1]];
      const inv = matrixInverse(I);
      expect(inv[0][0]).toBeCloseTo(1);
      expect(inv[1][1]).toBeCloseTo(1);
      expect(inv[0][1]).toBeCloseTo(0);
      expect(inv[1][0]).toBeCloseTo(0);
    });

    it('should invert a diagonal 4x4 matrix', () => {
      const diag = [
        [2, 0, 0, 0],
        [0, 4, 0, 0],
        [0, 0, 5, 0],
        [0, 0, 0, 8],
      ];
      const inv = invert4x4(diag);
      expect(inv[0][0]).toBeCloseTo(0.5);
      expect(inv[1][1]).toBeCloseTo(0.25);
      expect(inv[2][2]).toBeCloseTo(0.2);
      expect(inv[3][3]).toBeCloseTo(0.125);
    });

    it('should multiply A and A_inv to get identity', () => {
      const A = [
        [4, 7],
        [2, 6],
      ];
      const inv = matrixInverse(A);
      // [4*0.6 + 7*(-0.2) = 2.4 - 1.4 = 1]
      const r0c0 = A[0][0] * inv[0][0] + A[0][1] * inv[1][0];
      const r0c1 = A[0][0] * inv[0][1] + A[0][1] * inv[1][1];
      expect(r0c0).toBeCloseTo(1);
      expect(r0c1).toBeCloseTo(0);
    });
  });
});
