/**
 * @navic/sensor-fusion — Coordinate Transformations
 *
 * Local Tangent Plane (ENU — East, North, Up) to WGS84 Geodetic conversions.
 * Enables running filter kinematics in metric Cartesian space while preserving
 * global latitude/longitude coordinates.
 *
 * Uses full WGS84 ellipsoidal geometry with meridian radius of curvature M(phi)
 * and prime vertical radius of curvature N(phi) for sub-millimeter geodesy.
 */

import { Coordinate } from '@navic/shared-models';

export interface ENUCoordinate {
  readonly east: number;
  readonly north: number;
  readonly up: number;
}

// WGS84 Reference Ellipsoid Constants
const WGS84_A = 6378137.0; // Semi-major axis in meters
const WGS84_F = 1.0 / 298.257223563; // Flattening
const WGS84_E2 = 2.0 * WGS84_F - WGS84_F * WGS84_F; // First eccentricity squared (~0.00669437999014)

/**
 * Computes prime vertical radius of curvature N(phi).
 */
export function primeVerticalRadius(latRad: number): number {
  const sinLat = Math.sin(latRad);
  return WGS84_A / Math.sqrt(1.0 - WGS84_E2 * sinLat * sinLat);
}

/**
 * Computes meridian radius of curvature M(phi).
 */
export function meridianRadius(latRad: number): number {
  const sinLat = Math.sin(latRad);
  const denom = Math.sqrt(1.0 - WGS84_E2 * sinLat * sinLat);
  return (WGS84_A * (1.0 - WGS84_E2)) / (denom * denom * denom);
}

/**
 * Converts a WGS84 Coordinate to Local ENU coordinates relative to an anchor point
 * using WGS84 ellipsoidal radii of curvature.
 */
export function wgs84ToEnu(target: Coordinate, anchor: Coordinate): ENUCoordinate {
  const latRad0 = (anchor.latitude * Math.PI) / 180.0;
  const sinLat0 = Math.sin(latRad0);
  const cosLat0 = Math.cos(latRad0);
  const denom = Math.sqrt(1.0 - WGS84_E2 * sinLat0 * sinLat0);

  // Prime vertical radius N and meridian radius M at anchor latitude
  const N = WGS84_A / denom;
  const M = (WGS84_A * (1.0 - WGS84_E2)) / (denom * denom * denom);

  const dLatRad = ((target.latitude - anchor.latitude) * Math.PI) / 180.0;
  const dLonRad = ((target.longitude - anchor.longitude) * Math.PI) / 180.0;

  const north = M * dLatRad;
  const east = N * cosLat0 * dLonRad;
  const up = (target.altitude ?? 0) - (anchor.altitude ?? 0);

  return { east, north, up };
}

/**
 * Converts Local ENU coordinates to a WGS84 Coordinate relative to an anchor point
 * using WGS84 ellipsoidal radii of curvature.
 */
export function enuToWgs84(enu: ENUCoordinate, anchor: Coordinate): Coordinate {
  const latRad0 = (anchor.latitude * Math.PI) / 180.0;
  const sinLat0 = Math.sin(latRad0);
  const cosLat0 = Math.cos(latRad0);
  const denom = Math.sqrt(1.0 - WGS84_E2 * sinLat0 * sinLat0);

  const N = WGS84_A / denom;
  const M = (WGS84_A * (1.0 - WGS84_E2)) / (denom * denom * denom);

  const dLatRad = enu.north / M;
  const dLonRad = Math.abs(cosLat0) > 1e-7 ? enu.east / (N * cosLat0) : 0;

  const latitude = anchor.latitude + (dLatRad * 180.0) / Math.PI;
  const longitude = anchor.longitude + (dLonRad * 180.0) / Math.PI;
  const altitude = (anchor.altitude ?? 0) + enu.up;

  return { latitude, longitude, altitude };
}
