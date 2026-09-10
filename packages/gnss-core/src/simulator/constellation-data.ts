/**
 * GNSS Constellation Data
 *
 * Defines satellite orbital parameters for all supported constellations.
 * These are simplified models sufficient for realistic simulation —
 * not precise ephemeris data.
 *
 * NavIC/IRNSS constellation is modeled with actual GEO and GSO positions
 * centered over the Indian Ocean region.
 */

import { Constellation } from '@navic/shared-models';

/**
 * Simplified orbital parameters for a satellite.
 */
export interface SatelliteDefinition {
  readonly svid: number;
  readonly constellation: Constellation;
  readonly name: string;

  /**
   * Orbital type:
   * - 'MEO': Medium Earth Orbit (~20,200 km for GPS)
   * - 'GEO': Geostationary (~35,786 km, 0° inclination)
   * - 'GSO': Geosynchronous (~35,786 km, inclined)
   * - 'IGSO': Inclined Geosynchronous
   */
  readonly orbitType: 'MEO' | 'GEO' | 'GSO' | 'IGSO';

  /** Orbital plane index (for MEO satellites) */
  readonly planeIndex: number;

  /** Position within the orbital plane (0–360°) */
  readonly slotAngle: number;

  /** Sub-satellite point longitude for GEO/GSO/IGSO (degrees) */
  readonly geoLongitude?: number;

  /** Orbital inclination in degrees */
  readonly inclination: number;

  /** Nominal signal power offset in dB (0 = standard) */
  readonly signalOffset: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// NavIC / IRNSS Constellation (7 satellites)
// India's regional navigation system with coverage over Indian subcontinent
// ═══════════════════════════════════════════════════════════════════════════

export const NAVIC_SATELLITES: SatelliteDefinition[] = [
  // GEO Satellites (3) — fixed in sky, always visible from India
  {
    svid: 1, constellation: Constellation.NavIC, name: 'IRNSS-1C',
    orbitType: 'GEO', planeIndex: 0, slotAngle: 0,
    geoLongitude: 83.0, inclination: 0, signalOffset: 2,
  },
  {
    svid: 2, constellation: Constellation.NavIC, name: 'IRNSS-1F',
    orbitType: 'GEO', planeIndex: 0, slotAngle: 0,
    geoLongitude: 32.5, inclination: 0, signalOffset: 1,
  },
  {
    svid: 3, constellation: Constellation.NavIC, name: 'IRNSS-1G',
    orbitType: 'GEO', planeIndex: 0, slotAngle: 0,
    geoLongitude: 129.5, inclination: 0, signalOffset: 0,
  },
  // GSO Satellites (4) — figure-8 ground track over India
  {
    svid: 4, constellation: Constellation.NavIC, name: 'IRNSS-1A',
    orbitType: 'GSO', planeIndex: 1, slotAngle: 0,
    geoLongitude: 55.0, inclination: 29, signalOffset: 0,
  },
  {
    svid: 5, constellation: Constellation.NavIC, name: 'IRNSS-1B',
    orbitType: 'GSO', planeIndex: 1, slotAngle: 90,
    geoLongitude: 55.0, inclination: 29, signalOffset: -1,
  },
  {
    svid: 6, constellation: Constellation.NavIC, name: 'IRNSS-1D',
    orbitType: 'GSO', planeIndex: 2, slotAngle: 0,
    geoLongitude: 111.75, inclination: 29, signalOffset: 0,
  },
  {
    svid: 7, constellation: Constellation.NavIC, name: 'IRNSS-1E',
    orbitType: 'GSO', planeIndex: 2, slotAngle: 90,
    geoLongitude: 111.75, inclination: 29, signalOffset: -1,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// GPS Constellation (32 satellites)
// 6 orbital planes, 55° inclination, ~20,200 km altitude
// ═══════════════════════════════════════════════════════════════════════════

function generateGPSSatellites(): SatelliteDefinition[] {
  const sats: SatelliteDefinition[] = [];
  const satsPerPlane = [6, 5, 6, 5, 5, 5]; // ~32 total

  let svid = 1;
  for (let plane = 0; plane < 6; plane++) {
    const count = satsPerPlane[plane];
    for (let slot = 0; slot < count; slot++) {
      sats.push({
        svid,
        constellation: Constellation.GPS,
        name: `GPS-${svid.toString().padStart(2, '0')}`,
        orbitType: 'MEO',
        planeIndex: plane,
        slotAngle: (360 / count) * slot + plane * 15, // Offset per plane
        inclination: 55,
        signalOffset: 0,
      });
      svid++;
    }
  }
  return sats;
}

export const GPS_SATELLITES = generateGPSSatellites();

// ═══════════════════════════════════════════════════════════════════════════
// Galileo Constellation (30 satellites)
// 3 orbital planes, 56° inclination, ~23,222 km altitude
// ═══════════════════════════════════════════════════════════════════════════

function generateGalileoSatellites(): SatelliteDefinition[] {
  const sats: SatelliteDefinition[] = [];
  let svid = 1;

  for (let plane = 0; plane < 3; plane++) {
    for (let slot = 0; slot < 10; slot++) {
      sats.push({
        svid,
        constellation: Constellation.Galileo,
        name: `GAL-${svid.toString().padStart(2, '0')}`,
        orbitType: 'MEO',
        planeIndex: plane,
        slotAngle: (360 / 10) * slot + plane * 20,
        inclination: 56,
        signalOffset: 1, // Galileo typically slightly stronger
      });
      svid++;
    }
  }
  return sats;
}

export const GALILEO_SATELLITES = generateGalileoSatellites();

// ═══════════════════════════════════════════════════════════════════════════
// BeiDou Constellation (35 satellites)
// Mix of MEO (27), GEO (5), IGSO (3)
// ═══════════════════════════════════════════════════════════════════════════

function generateBeiDouSatellites(): SatelliteDefinition[] {
  const sats: SatelliteDefinition[] = [];
  let svid = 1;

  // 5 GEO satellites
  const geoLons = [58.75, 80.0, 110.5, 140.0, 160.0];
  for (const lon of geoLons) {
    sats.push({
      svid,
      constellation: Constellation.BeiDou,
      name: `BDS-G${svid}`,
      orbitType: 'GEO',
      planeIndex: 0,
      slotAngle: 0,
      geoLongitude: lon,
      inclination: 0,
      signalOffset: 0,
    });
    svid++;
  }

  // 3 IGSO satellites
  const igsoLons = [118.0, 95.0, 115.0];
  for (const lon of igsoLons) {
    sats.push({
      svid,
      constellation: Constellation.BeiDou,
      name: `BDS-I${svid}`,
      orbitType: 'IGSO',
      planeIndex: 1,
      slotAngle: (svid - 6) * 120,
      geoLongitude: lon,
      inclination: 55,
      signalOffset: 0,
    });
    svid++;
  }

  // 27 MEO satellites in 3 planes
  for (let plane = 0; plane < 3; plane++) {
    for (let slot = 0; slot < 9; slot++) {
      sats.push({
        svid,
        constellation: Constellation.BeiDou,
        name: `BDS-M${svid}`,
        orbitType: 'MEO',
        planeIndex: plane + 2,
        slotAngle: (360 / 9) * slot + plane * 15,
        inclination: 55,
        signalOffset: -1,
      });
      svid++;
    }
  }

  return sats;
}

export const BEIDOU_SATELLITES = generateBeiDouSatellites();

// ═══════════════════════════════════════════════════════════════════════════
// GLONASS Constellation (24 satellites)
// 3 orbital planes, 64.8° inclination, ~19,100 km altitude
// ═══════════════════════════════════════════════════════════════════════════

function generateGLONASSSatellites(): SatelliteDefinition[] {
  const sats: SatelliteDefinition[] = [];
  let svid = 1;

  for (let plane = 0; plane < 3; plane++) {
    for (let slot = 0; slot < 8; slot++) {
      sats.push({
        svid,
        constellation: Constellation.GLONASS,
        name: `GLO-${svid.toString().padStart(2, '0')}`,
        orbitType: 'MEO',
        planeIndex: plane,
        slotAngle: (360 / 8) * slot + plane * 15,
        inclination: 64.8,
        signalOffset: -2, // GLONASS typically slightly weaker
      });
      svid++;
    }
  }
  return sats;
}

export const GLONASS_SATELLITES = generateGLONASSSatellites();

// ═══════════════════════════════════════════════════════════════════════════
// All Constellations Combined
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_SATELLITES: SatelliteDefinition[] = [
  ...NAVIC_SATELLITES,
  ...GPS_SATELLITES,
  ...GALILEO_SATELLITES,
  ...BEIDOU_SATELLITES,
  ...GLONASS_SATELLITES,
];

/**
 * Get satellite definitions for a specific constellation.
 */
export function getSatellitesForConstellation(
  constellation: Constellation,
): SatelliteDefinition[] {
  switch (constellation) {
    case Constellation.NavIC: return NAVIC_SATELLITES;
    case Constellation.GPS: return GPS_SATELLITES;
    case Constellation.Galileo: return GALILEO_SATELLITES;
    case Constellation.BeiDou: return BEIDOU_SATELLITES;
    case Constellation.GLONASS: return GLONASS_SATELLITES;
    default: return [];
  }
}
