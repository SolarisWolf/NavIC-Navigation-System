import { describe, it, expect } from 'vitest';
import { NavICDetector } from '../engine/navic-detector.js';
import { Constellation, type SatelliteInfo } from '@navic/shared-models';

describe('Phase 16: Real NavIC Detection Engine', () => {
  const mockSat = (
    svid: number,
    constellation: Constellation,
    snr: number,
    usedInFix: boolean,
    carrierFrequencyHz?: number,
    signalBand?: 'L1' | 'L5' | 'S'
  ): SatelliteInfo => ({
    svid,
    constellation,
    snr,
    elevation: 45,
    azimuth: 120,
    usedInFix,
    carrierFrequencyHz,
    signalBand,
  });

  describe('classifyFrequencyBand', () => {
    it('should classify 1176.45 MHz as L5 band', () => {
      expect(NavICDetector.classifyFrequencyBand(1176.45e6)).toBe('L5');
      expect(NavICDetector.classifyFrequencyBand(1176.5e6)).toBe('L5');
    });

    it('should classify 2492.028 MHz as S band', () => {
      expect(NavICDetector.classifyFrequencyBand(2492.028e6)).toBe('S');
    });

    it('should classify 1575.42 MHz as L1 band', () => {
      expect(NavICDetector.classifyFrequencyBand(1575.42e6)).toBe('L1');
    });

    it('should default to L5 when frequency is missing or standard civilian NavIC', () => {
      expect(NavICDetector.classifyFrequencyBand(undefined)).toBe('L5');
      expect(NavICDetector.classifyFrequencyBand(undefined, 'S')).toBe('S');
    });
  });

  describe('getSatelliteMetadata', () => {
    it('should correctly map PRN 3 to IRNSS-1C (Prime Indian GEO 83°E)', () => {
      const meta = NavICDetector.getSatelliteMetadata(3);
      expect(meta.name).toBe('IRNSS-1C');
      expect(meta.orbitType).toBe('GEO');
      expect(meta.orbitalSlot).toContain('83.0°E');
    });

    it('should correctly map PRN 6 to IRNSS-1F (Western GEO 32.5°E)', () => {
      const meta = NavICDetector.getSatelliteMetadata(6);
      expect(meta.name).toBe('IRNSS-1F');
      expect(meta.orbitType).toBe('GEO');
      expect(meta.orbitalSlot).toContain('32.5°E');
    });

    it('should correctly map PRN 10 to Next-Gen NVS-01 (L1/L5 GSO)', () => {
      const meta = NavICDetector.getSatelliteMetadata(10);
      expect(meta.name).toBe('NVS-01');
      expect(meta.orbitType).toBe('GSO');
      expect(meta.orbitalSlot).toContain('Next-Gen');
    });

    it('should handle unmapped PRN gracefully with fallback', () => {
      const meta = NavICDetector.getSatelliteMetadata(14);
      expect(meta.name).toContain('IRNSS');
      expect(meta.orbitalSlot).toContain('Indian Regional Arc');
    });
  });

  describe('analyzeConstellation', () => {
    it('should return No Signal when no NavIC satellites are visible', () => {
      const allSats = [
        mockSat(1, Constellation.GPS, 42, true),
        mockSat(2, Constellation.GPS, 38, true),
        mockSat(12, Constellation.Galileo, 40, true),
      ];

      const report = NavICDetector.analyzeConstellation(allSats);
      expect(report.isNavICDetected).toBe(false);
      expect(report.lockStatus).toBe('No Signal');
      expect(report.fixAssistanceLevel).toBe('Multi-GNSS Only');
      expect(report.totalVisible).toBe(0);
      expect(report.usedInFix).toBe(0);
      expect(report.signalIntegrityScore).toBe(0);
    });

    it('should detect Full Lock and Standalone NavIC when >=4 NavIC sats form fix alone', () => {
      const allSats = [
        mockSat(3, Constellation.NavIC, 44, true, 1176.45e6), // 1C GEO
        mockSat(6, Constellation.NavIC, 42, true, 1176.45e6), // 1F GEO
        mockSat(7, Constellation.NavIC, 40, true, 2492.028e6), // 1G GEO S-band
        mockSat(1, Constellation.NavIC, 39, true, 1176.45e6), // 1A GSO
        mockSat(2, Constellation.NavIC, 35, false, 1176.45e6), // 1B GSO
      ];

      const report = NavICDetector.analyzeConstellation(allSats);
      expect(report.isNavICDetected).toBe(true);
      expect(report.lockStatus).toBe('Full Lock');
      expect(report.fixAssistanceLevel).toBe('Standalone NavIC');
      expect(report.totalVisible).toBe(5);
      expect(report.usedInFix).toBe(4);
      expect(report.geoCount).toBe(3);
      expect(report.gsoCount).toBe(2);
      expect(report.averageCn0).toBeCloseTo(40.0, 1);
      expect(report.bandsDetected).toContain('L5');
      expect(report.bandsDetected).toContain('S');
      expect(report.signalIntegrityScore).toBeGreaterThanOrEqual(80);
    });

    it('should detect NavIC + Multi-GNSS hybrid fix when combined with GPS', () => {
      const allSats = [
        mockSat(3, Constellation.NavIC, 43, true, 1176.45e6),
        mockSat(6, Constellation.NavIC, 41, true, 1176.45e6),
        mockSat(1, Constellation.GPS, 44, true),
        mockSat(2, Constellation.GPS, 39, true),
        mockSat(3, Constellation.GPS, 36, true),
      ];

      const report = NavICDetector.analyzeConstellation(allSats);
      expect(report.isNavICDetected).toBe(true);
      expect(report.lockStatus).toBe('Marginal Lock');
      expect(report.fixAssistanceLevel).toBe('NavIC + Multi-GNSS');
      expect(report.totalVisible).toBe(2);
      expect(report.usedInFix).toBe(2);
    });

    it('should populate satellite details correctly', () => {
      const allSats = [
        mockSat(3, Constellation.NavIC, 46, true, 1176.45e6),
        mockSat(10, Constellation.NavIC, 42, false, 1575.42e6),
      ];

      const report = NavICDetector.analyzeConstellation(allSats);
      expect(report.satellites.length).toBe(2);

      const sat1C = report.satellites.find((s) => s.svid === 3)!;
      expect(sat1C.name).toBe('IRNSS-1C');
      expect(sat1C.orbitType).toBe('GEO');
      expect(sat1C.frequencyBand).toBe('L5');
      expect(sat1C.usedInFix).toBe(true);

      const nvs = report.satellites.find((s) => s.svid === 10)!;
      expect(nvs.name).toBe('NVS-01');
      expect(nvs.orbitType).toBe('GSO');
      expect(nvs.frequencyBand).toBe('L1');
      expect(nvs.usedInFix).toBe(false);
    });
  });
});
