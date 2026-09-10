/**
 * NavIC (IRNSS) Constellation Detector & Signal Analyzer
 *
 * Provides real-time detection, signal quality evaluation, multi-frequency (L5 / S / L1)
 * identification, and orbital geometry analysis for India's regional satellite system.
 * Works seamlessly with both physical hardware feeds (Android GnssStatus/Measurements, NMEA)
 * and synthetic simulations.
 */

import {
  Constellation,
  type SatelliteInfo,
  type NavICSatelliteDetail,
  type NavICSignalReport,
} from '@navic/shared-models';

/**
 * Metadata definition for known NavIC space vehicles.
 */
interface NavICSVInfo {
  name: string;
  orbitType: 'GEO' | 'GSO';
  orbitalSlot: string;
}

const KNOWN_NAVIC_SVS: Record<number, NavICSVInfo> = {
  1: { name: 'IRNSS-1A', orbitType: 'GSO', orbitalSlot: '55.0°E (Inclined 29°)' },
  2: { name: 'IRNSS-1B', orbitType: 'GSO', orbitalSlot: '55.0°E (Inclined 29°)' },
  3: { name: 'IRNSS-1C', orbitType: 'GEO', orbitalSlot: '83.0°E (Prime Indian GEO)' },
  4: { name: 'IRNSS-1D', orbitType: 'GSO', orbitalSlot: '111.75°E (Inclined 29°)' },
  5: { name: 'IRNSS-1E', orbitType: 'GSO', orbitalSlot: '111.75°E (Inclined 29°)' },
  6: { name: 'IRNSS-1F', orbitType: 'GEO', orbitalSlot: '32.5°E (Western GEO)' },
  7: { name: 'IRNSS-1G', orbitType: 'GEO', orbitalSlot: '129.5°E (Eastern GEO)' },
  9: { name: 'IRNSS-1I', orbitType: 'GSO', orbitalSlot: '55.0°E (Inclined 29°)' },
  10: { name: 'NVS-01', orbitType: 'GSO', orbitalSlot: '55.0°E (Next-Gen L1/L5)' },
};

export class NavICDetector {
  /**
   * Determine the NavIC frequency band from carrier frequency in Hz.
   * - L5 Band: 1176.45 MHz (1.17645e9 Hz)
   * - S Band:  2492.028 MHz (2.492028e9 Hz)
   * - L1 Band: 1575.42 MHz (1.57542e9 Hz)
   */
  public static classifyFrequencyBand(carrierFreqHz?: number, explicitBand?: string): 'L5' | 'S' | 'L1' | 'Unknown' {
    if (explicitBand === 'L5' || explicitBand === 'S' || explicitBand === 'L1') {
      return explicitBand;
    }

    if (!carrierFreqHz || isNaN(carrierFreqHz) || carrierFreqHz <= 0) {
      return 'L5'; // Default civilian NavIC band
    }

    const freqMhz = carrierFreqHz / 1e6;

    // L5 Band: 1176.45 MHz ± 10 MHz
    if (Math.abs(freqMhz - 1176.45) < 10) {
      return 'L5';
    }

    // S Band: 2492.028 MHz ± 10 MHz
    if (Math.abs(freqMhz - 2492.028) < 10) {
      return 'S';
    }

    // L1 Band: 1575.42 MHz ± 10 MHz
    if (Math.abs(freqMhz - 1575.42) < 10) {
      return 'L1';
    }

    return 'Unknown';
  }

  /**
   * Map SVID/PRN to known ISRO Space Vehicle metadata.
   */
  public static getSatelliteMetadata(svid: number): NavICSVInfo {
    return (
      KNOWN_NAVIC_SVS[svid] ?? {
        name: `IRNSS-1S${svid}`,
        orbitType: svid % 2 === 0 ? 'GSO' : 'GEO',
        orbitalSlot: 'Indian Regional Arc',
      }
    );
  }

  /**
   * Evaluates a full list of satellites and produces a comprehensive NavICSignalReport.
   *
   * @param allSatellites All satellites visible from receiver
   * @param totalUsedInFix Optional count of total satellites used across all constellations
   */
  public static analyzeConstellation(
    allSatellites: readonly SatelliteInfo[],
    totalUsedInFix?: number
  ): NavICSignalReport {
    // 1. Filter out only NavIC satellites
    const navicSats = allSatellites.filter(
      (s) =>
        s.constellation === Constellation.NavIC ||
        (s as any).constellationType === 7 ||
        String(s.constellation).toLowerCase() === 'navic' ||
        String(s.constellation).toLowerCase() === 'irnss'
    );

    if (navicSats.length === 0) {
      return {
        isNavICDetected: false,
        lockStatus: 'No Signal',
        fixAssistanceLevel: 'Multi-GNSS Only',
        totalVisible: 0,
        usedInFix: 0,
        geoCount: 0,
        gsoCount: 0,
        averageCn0: 0,
        bandsDetected: [],
        signalIntegrityScore: 0,
        satellites: [],
      };
    }

    let geoCount = 0;
    let gsoCount = 0;
    let usedInFixCount = 0;
    let snrSum = 0;
    const bandsSet = new Set<'L5' | 'S' | 'L1'>();

    const satelliteDetails: NavICSatelliteDetail[] = navicSats.map((sat) => {
      const meta = NavICDetector.getSatelliteMetadata(sat.svid);
      if (meta.orbitType === 'GEO') geoCount++;
      if (meta.orbitType === 'GSO') gsoCount++;
      if (sat.usedInFix) usedInFixCount++;

      snrSum += sat.snr;

      const band = NavICDetector.classifyFrequencyBand(sat.carrierFrequencyHz, sat.signalBand);
      if (band !== 'Unknown') {
        bandsSet.add(band);
      }

      return {
        svid: sat.svid,
        name: meta.name,
        orbitType: meta.orbitType,
        orbitalSlot: meta.orbitalSlot,
        snr: sat.snr,
        basebandCn0: sat.basebandCn0DbHz,
        elevation: sat.elevation,
        azimuth: sat.azimuth,
        usedInFix: sat.usedInFix,
        carrierFrequencyHz: sat.carrierFrequencyHz,
        frequencyBand: band,
      };
    });

    const averageCn0 = navicSats.length > 0 ? Number((snrSum / navicSats.length).toFixed(1)) : 0;

    // Determine Lock Status
    let lockStatus: 'Full Lock' | 'Marginal Lock' | 'No Signal';
    if (usedInFixCount >= 4) {
      lockStatus = 'Full Lock';
    } else if (usedInFixCount >= 1 || navicSats.length >= 1) {
      lockStatus = 'Marginal Lock';
    } else {
      lockStatus = 'No Signal';
    }

    // Determine Fix Assistance Level
    const totalFixSats = totalUsedInFix ?? allSatellites.filter((s) => s.usedInFix).length;
    let fixAssistanceLevel: 'Standalone NavIC' | 'NavIC + Multi-GNSS' | 'Multi-GNSS Only';
    if (usedInFixCount >= 4 && totalFixSats === usedInFixCount) {
      fixAssistanceLevel = 'Standalone NavIC';
    } else if (usedInFixCount > 0) {
      fixAssistanceLevel = 'NavIC + Multi-GNSS';
    } else {
      fixAssistanceLevel = 'Multi-GNSS Only';
    }

    // Compute Signal Integrity Score (0 to 100%)
    // - Average SNR: up to 60 points (at 45+ dB-Hz)
    // - GEO visibility (stationary high-elevation anchors over India): up to 20 points
    // - Satellite diversity (4+ visible): up to 20 points
    const snrScore = Math.min(60, (averageCn0 / 45) * 60);
    const geoScore = geoCount >= 2 ? 20 : geoCount === 1 ? 12 : 0;
    const diversityScore = navicSats.length >= 4 ? 20 : navicSats.length >= 2 ? 10 : 5;
    const signalIntegrityScore = Math.min(100, Math.round(snrScore + geoScore + diversityScore));

    const bandsDetected = Array.from(bandsSet);
    if (bandsDetected.length === 0) {
      bandsDetected.push('L5');
    }

    return {
      isNavICDetected: true,
      lockStatus,
      fixAssistanceLevel,
      totalVisible: navicSats.length,
      usedInFix: usedInFixCount,
      geoCount,
      gsoCount,
      averageCn0,
      bandsDetected,
      signalIntegrityScore,
      satellites: satelliteDetails,
    };
  }
}
