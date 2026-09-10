/**
 * Satellite Simulator
 *
 * Computes satellite visibility, elevation, azimuth, and signal strength
 * from an observer position at a given time. Uses simplified orbital models.
 */

import { type SatelliteInfo, Constellation } from '@navic/shared-models';
import { type SatelliteDefinition, ALL_SATELLITES } from './constellation-data.js';
import { gaussianRandom } from './noise-model.js';

/** Radians ↔ degrees helpers */
const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Minimum elevation angle to consider a satellite visible (degrees) */
const MIN_ELEVATION = 5;

/** SNR threshold for "used in fix" (dB-Hz) */
const SNR_FIX_THRESHOLD = 25;

/**
 * Compute satellite visibility data for all satellites from an observer position.
 *
 * @param observerLat - Observer latitude in degrees
 * @param observerLon - Observer longitude in degrees
 * @param timestamp - Unix timestamp in milliseconds
 * @param disabledConstellations - Set of constellations to exclude
 * @param signalQuality - Overall signal quality multiplier
 * @returns Array of SatelliteInfo for all visible satellites
 */
export function computeVisibleSatellites(
  observerLat: number,
  observerLon: number,
  timestamp: number,
  disabledConstellations: Set<Constellation> = new Set(),
  signalQuality: 'strong' | 'moderate' | 'weak' = 'strong',
): SatelliteInfo[] {
  const timeSec = timestamp / 1000;
  const satellites: SatelliteInfo[] = [];

  for (const sat of ALL_SATELLITES) {
    if (disabledConstellations.has(sat.constellation)) continue;

    const result = computeSatellitePosition(sat, observerLat, observerLon, timeSec);
    if (result === null) continue;

    const { elevation, azimuth } = result;
    if (elevation < MIN_ELEVATION) continue;

    // Compute SNR based on elevation and signal quality
    const snr = computeSNR(elevation, sat.signalOffset, signalQuality);
    const usedInFix = snr >= SNR_FIX_THRESHOLD;

    satellites.push({
      svid: sat.svid,
      constellation: sat.constellation,
      snr: Math.round(snr * 10) / 10,
      elevation: Math.round(elevation * 10) / 10,
      azimuth: Math.round(azimuth * 10) / 10,
      usedInFix,
    });
  }

  return satellites;
}

/**
 * Compute the apparent elevation and azimuth of a satellite from an observer.
 * Returns null if the satellite is below the horizon.
 */
function computeSatellitePosition(
  sat: SatelliteDefinition,
  observerLat: number,
  observerLon: number,
  timeSec: number,
): { elevation: number; azimuth: number } | null {
  if (sat.orbitType === 'GEO') {
    return computeGEOPosition(sat, observerLat, observerLon);
  } else if (sat.orbitType === 'GSO' || sat.orbitType === 'IGSO') {
    return computeGSOPosition(sat, observerLat, observerLon, timeSec);
  } else {
    return computeMEOPosition(sat, observerLat, observerLon, timeSec);
  }
}

/**
 * Compute elevation/azimuth for a GEO satellite.
 * GEO satellites appear fixed in the sky.
 */
function computeGEOPosition(
  sat: SatelliteDefinition,
  observerLat: number,
  observerLon: number,
): { elevation: number; azimuth: number } | null {
  const geoLon = sat.geoLongitude ?? 0;
  const dLon = (geoLon - observerLon) * RAD;
  const latRad = observerLat * RAD;

  // GEO satellite is at 0° latitude, geoLon longitude, ~35786 km altitude
  // Earth radius ≈ 6371 km, so r/R ≈ 6.61
  const rOverR = 6.61;

  const cosGamma = Math.cos(latRad) * Math.cos(dLon);
  const elevation = Math.atan2(
    cosGamma - 1 / rOverR,
    Math.sqrt(1 - cosGamma * cosGamma),
  ) * DEG;

  if (elevation < 0) return null;

  const azimuth = Math.atan2(Math.sin(dLon), -Math.sin(latRad) * Math.cos(dLon)) * DEG;
  const normalizedAz = ((azimuth % 360) + 360) % 360;

  return { elevation, azimuth: normalizedAz };
}

/**
 * Compute elevation/azimuth for a GSO/IGSO satellite.
 * These trace a figure-8 pattern in the sky.
 */
function computeGSOPosition(
  sat: SatelliteDefinition,
  observerLat: number,
  observerLon: number,
  timeSec: number,
): { elevation: number; azimuth: number } | null {
  const geoLon = sat.geoLongitude ?? 0;
  const incl = sat.inclination * RAD;

  // GSO period ≈ 24 hours = 86400 seconds
  const orbitalPeriod = 86400;
  const phase = ((timeSec + sat.slotAngle * orbitalPeriod / 360) % orbitalPeriod) / orbitalPeriod;
  const angle = phase * 2 * Math.PI;

  // GSO sub-satellite point oscillates in latitude
  const subLat = Math.asin(Math.sin(incl) * Math.sin(angle)) * DEG;
  const subLon = geoLon + Math.atan2(
    Math.cos(incl) * Math.sin(angle),
    Math.cos(angle),
  ) * DEG - (Math.sin(incl) > 0 ? 0 : 0);

  // Treat as a "quasi-GEO" at the current sub-satellite point
  return computeSubSatelliteElevAz(subLat, subLon, observerLat, observerLon, 6.61);
}

/**
 * Compute elevation/azimuth for a MEO satellite.
 * Simplified: satellites orbit at known inclination and we compute approximate positions.
 */
function computeMEOPosition(
  sat: SatelliteDefinition,
  observerLat: number,
  observerLon: number,
  timeSec: number,
): { elevation: number; azimuth: number } | null {
  const incl = sat.inclination * RAD;

  // Orbital period varies by constellation
  let orbitalPeriod: number;
  let rOverR: number; // orbit radius / Earth radius

  switch (sat.constellation) {
    case Constellation.GPS:
      orbitalPeriod = 43082; // ~11h 58m (half sidereal day)
      rOverR = 4.17; // 26,560 km / 6,371 km
      break;
    case Constellation.Galileo:
      orbitalPeriod = 50760; // ~14h 5m
      rOverR = 4.65; // 29,600 km / 6,371 km
      break;
    case Constellation.GLONASS:
      orbitalPeriod = 40544; // ~11h 15m
      rOverR = 3.95; // 25,180 km / 6,371 km
      break;
    case Constellation.BeiDou:
      orbitalPeriod = 46350; // ~12h 52m (MEO)
      rOverR = 4.35; // 27,700 km / 6,371 km
      break;
    default:
      orbitalPeriod = 43200;
      rOverR = 4.2;
  }

  // RAAN (Right Ascension of Ascending Node) — spread planes evenly
  const numPlanes = sat.constellation === Constellation.GLONASS ? 3 :
                    sat.constellation === Constellation.Galileo ? 3 : 6;
  const raan = (sat.planeIndex * 360 / numPlanes) * RAD;

  // Mean anomaly advances with time
  const slotOffset = sat.slotAngle * RAD;
  const meanAnomaly = ((timeSec / orbitalPeriod) * 2 * Math.PI + slotOffset) % (2 * Math.PI);

  // Compute sub-satellite point
  const satLat = Math.asin(Math.sin(incl) * Math.sin(meanAnomaly + raan)) * DEG;

  // Earth rotates at ~360°/86400s = 0.004167°/s
  const earthRotation = (timeSec * 360 / 86400) % 360;
  const satLon = (Math.atan2(
    Math.sin(meanAnomaly + raan) * Math.cos(incl),
    Math.cos(meanAnomaly + raan),
  ) * DEG - earthRotation + 360) % 360;
  // Center around ±180
  const normalizedSatLon = satLon > 180 ? satLon - 360 : satLon;

  return computeSubSatelliteElevAz(satLat, normalizedSatLon, observerLat, observerLon, rOverR);
}

/**
 * Given a sub-satellite point and observer, compute elevation and azimuth.
 */
function computeSubSatelliteElevAz(
  subLat: number,
  subLon: number,
  obsLat: number,
  obsLon: number,
  rOverR: number,
): { elevation: number; azimuth: number } | null {
  const dLon = (subLon - obsLon) * RAD;
  const obsLatRad = obsLat * RAD;
  const subLatRad = subLat * RAD;

  // Central angle
  const cosGamma =
    Math.sin(obsLatRad) * Math.sin(subLatRad) +
    Math.cos(obsLatRad) * Math.cos(subLatRad) * Math.cos(dLon);

  // Elevation
  const elevation = Math.atan2(
    cosGamma - 1 / rOverR,
    Math.sqrt(1 - cosGamma * cosGamma),
  ) * DEG;

  if (elevation < 0) return null;

  // Azimuth
  const y = Math.sin(dLon) * Math.cos(subLatRad);
  const x = Math.cos(obsLatRad) * Math.sin(subLatRad) -
            Math.sin(obsLatRad) * Math.cos(subLatRad) * Math.cos(dLon);
  const azimuth = ((Math.atan2(y, x) * DEG) + 360) % 360;

  return { elevation, azimuth };
}

/**
 * Compute signal-to-noise ratio (C/N₀) in dB-Hz.
 * Higher elevation → stronger signal. Includes random variation.
 */
function computeSNR(
  elevation: number,
  signalOffset: number,
  quality: 'strong' | 'moderate' | 'weak',
): number {
  // Base SNR model: roughly linear with elevation
  // At 90° → ~47 dB-Hz, at 5° → ~20 dB-Hz
  const baseSnr = 18 + (elevation / 90) * 30;

  // Quality multiplier
  const qualityFactor =
    quality === 'strong' ? 1.0 :
    quality === 'moderate' ? 0.75 :
    0.5;

  // Add random variation (±3 dB-Hz)
  const noise = gaussianRandom(0, 1.5);

  const snr = (baseSnr + signalOffset + noise) * qualityFactor;
  return Math.max(0, Math.min(55, snr));
}
