import { describe, it, expect, beforeEach } from 'vitest';
import { BrowserGeolocationProvider } from '../providers/browser-geolocation-provider.js';
import { SerialNMEAProvider } from '../providers/serial-nmea-provider.js';
import { FixType } from '@navic/shared-models';

describe('Hardware Providers (Phase 15)', () => {
  describe('BrowserGeolocationProvider', () => {
    let mockWatchId = 42;
    let mockClearWatchCalled = false;
    let watchSuccessCb: ((pos: any) => void) | null = null;
    let watchErrorCb: ((err: any) => void) | null = null;

    const mockGeolocation: any = {
      watchPosition: (success: (pos: any) => void, error: (err: any) => void) => {
        watchSuccessCb = success;
        watchErrorCb = error;
        return mockWatchId;
      },
      clearWatch: (id: number) => {
        if (id === mockWatchId) {
          mockClearWatchCalled = true;
        }
      },
    };

    beforeEach(() => {
      mockClearWatchCalled = false;
      watchSuccessCb = null;
      watchErrorCb = null;
    });

    it('should initialize with live hardware markers (isSimulated = false)', () => {
      const provider = new BrowserGeolocationProvider({ geolocation: mockGeolocation });
      expect(provider.isSimulated).toBe(false);
      expect(provider.name).toContain('Hardware');
      expect(provider.getStatus().isSimulated).toBe(false);
    });

    it('should start watchPosition and process incoming GeolocationPosition fixes', () => {
      const provider = new BrowserGeolocationProvider({ geolocation: mockGeolocation });
      const measurements: any[] = [];
      provider.onMeasurement((m) => measurements.push(m));

      provider.start();
      expect(provider.getStatus().isActive).toBe(true);

      expect(watchSuccessCb).toBeDefined();
      // Simulate browser firing position update (e.g. Connaught Place, New Delhi)
      watchSuccessCb!({
        timestamp: 1700000000000,
        coords: {
          latitude: 28.6315,
          longitude: 77.2167,
          altitude: 215.0,
          speed: 12.5,
          heading: 90.0,
          accuracy: 4.2,
          altitudeAccuracy: 6.0,
        },
      });

      expect(measurements.length).toBe(1);
      const m = measurements[0];
      expect(m.latitude).toBeCloseTo(28.6315, 4);
      expect(m.longitude).toBeCloseTo(77.2167, 4);
      expect(m.altitude).toBe(215.0);
      expect(m.speed).toBe(12.5);
      expect(m.bearing).toBe(90.0);
      expect(m.horizontalAccuracy).toBe(4.2);
      expect(m.isSimulated).toBe(false);
      expect(m.fixType).toBe(FixType.Fix3D);
      expect(provider.getStatus().hasfix).toBe(true);
    });

    it('should handle geolocation error gracefully and set NoFix', () => {
      const provider = new BrowserGeolocationProvider({ geolocation: mockGeolocation });
      provider.start();

      watchErrorCb!({
        code: 1, // PERMISSION_DENIED
        message: 'User denied Geolocation',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });

      expect(provider.getStatus().hasfix).toBe(false);
      expect(provider.getStatus().fixType).toBe(FixType.NoFix);
    });

    it('should clear watch upon stop()', () => {
      const provider = new BrowserGeolocationProvider({ geolocation: mockGeolocation });
      provider.start();
      provider.stop();

      expect(mockClearWatchCalled).toBe(true);
      expect(provider.getStatus().isActive).toBe(false);
    });
  });

  describe('SerialNMEAProvider', () => {
    let provider: SerialNMEAProvider;

    beforeEach(() => {
      provider = new SerialNMEAProvider();
    });

    it('should initialize with live hardware markers', () => {
      expect(provider.isSimulated).toBe(false);
      expect(provider.name).toContain('NMEA');
    });

    it('should parse valid $GNGGA sentence and emit GNSSMeasurement', () => {
      const measurements: any[] = [];
      provider.onMeasurement((m) => measurements.push(m));
      provider.start();

      // $GNGGA,123519,2836.8340,N,07712.5400,E,1,08,0.9,215.0,M,0.0,M,,*47
      // Let's compute exact checksum for test:
      const sentenceContent = 'GNGGA,123519,2836.8340,N,07712.5400,E,1,08,0.9,215.0,M,0.0,M,,';
      let chk = 0;
      for (let i = 0; i < sentenceContent.length; i++) chk ^= sentenceContent.charCodeAt(i);
      const chkHex = chk.toString(16).toUpperCase().padStart(2, '0');

      const parsed = provider.parseSentence(`$${sentenceContent}*${chkHex}`);
      expect(parsed).toBe(true);
      expect(measurements.length).toBe(1);

      const m = measurements[0];
      // 28 + 36.8340/60 = 28.6139
      expect(m.latitude).toBeCloseTo(28.6139, 4);
      // 77 + 12.5400/60 = 77.2090
      expect(m.longitude).toBeCloseTo(77.2090, 4);
      expect(m.altitude).toBe(215.0);
      expect(m.isSimulated).toBe(false);
      expect(provider.getStatus().hasfix).toBe(true);
    });

    it('should parse valid $GNRMC sentence with speed and bearing', () => {
      const measurements: any[] = [];
      provider.onMeasurement((m) => measurements.push(m));
      provider.start();

      // $GNRMC,123519,A,2836.8340,N,07712.5400,E,20.5,180.0,230324,,,A
      const sentenceContent = 'GNRMC,123519,A,2836.8340,N,07712.5400,E,20.5,180.0,230324,,,A';
      let chk = 0;
      for (let i = 0; i < sentenceContent.length; i++) chk ^= sentenceContent.charCodeAt(i);
      const chkHex = chk.toString(16).toUpperCase().padStart(2, '0');

      const parsed = provider.parseSentence(`$${sentenceContent}*${chkHex}`);
      expect(parsed).toBe(true);
      expect(measurements.length).toBe(1);

      const m = measurements[0];
      expect(m.latitude).toBeCloseTo(28.6139, 4);
      expect(m.bearing).toBe(180.0);
      // 20.5 knots = 10.546 m/s
      expect(m.speed).toBeCloseTo(10.546, 2);
      expect(m.isSimulated).toBe(false);
    });

    it('should reject sentences with corrupted checksum', () => {
      const result = provider.parseSentence('$GNGGA,123519,2836.8340,N,07712.5400,E,1,08,0.9,215.0,M,0.0,M,,*FF');
      expect(result).toBe(false);
    });

    it('should correctly handle multi-sentence chunk streaming via feedChunk', () => {
      const measurements: any[] = [];
      provider.onMeasurement((m) => measurements.push(m));
      provider.start();

      const chunk =
        '$GNGGA,123519,2836.8340,N,07712.5400,E,1,08,0.9,215.0,M,0.0,M,,\n' +
        '$GNRMC,123519,A,2836.8340,N,07712.5400,E,25.0,90.0,230324,,,A\n';

      provider.feedChunk(chunk);
      expect(measurements.length).toBe(2);
      expect(measurements[1].bearing).toBe(90.0);
    });

    it('should convert coordinates with southern or western hemispheres to negative numbers', () => {
      const lat = provider.parseCoordinates('3351.8000', 'S');
      const lon = provider.parseCoordinates('15112.5000', 'W');
      // 33 + 51.8/60 = 33.8633 -> -33.8633
      expect(lat).toBeCloseTo(-33.8633, 4);
      // 151 + 12.5/60 = 151.2083 -> -151.2083
      expect(lon).toBeCloseTo(-151.2083, 4);
    });
  });
});
