/**
 * @navic/sensor-fusion — Coordinate Transformations
 *
 * Local Tangent Plane (ENU — East, North, Up) to WGS84 Geodetic conversions.
 * Enables running filter kinematics in metric Cartesian space while preserving
 * global latitude/longitude coordinates.
 */

import { Coordinate } from '@navic/shared-models';

export interface ENUCoordinate {
  readonly east: number;
  readonly north: number;
  readonly up: number;
}

const WGS84_A = 6378137.0; // WGS84 semi-major axis in meters

/**
 * Converts a WGS84 Coordinate to Local ENU coordinates relative to an anchor point.
 */
export function wgs84ToEnu(target: Coordinate, anchor: Coordinate): ENUCoordinate {
  const latRad0 = (anchor.latitude * Math.PI) / 180.0;
  const dLatRad = ((target.latitude - anchor.latitude) * Math.PI) / 180.0;
  const dLonRad = ((target.longitude - anchor.longitude) * Math.PI) / 180.0;

  const north = WGS84_A * dLatRad;
  const east = WGS84_A * dLonRad * Math.cos(latRad0);
  const up = (target.altitude ?? 0) - (anchor.altitude ?? 0);

  return { east, north, up };
}

/**
 * Converts Local ENU coordinates to a WGS84 Coordinate relative to an anchor point.
 */
export function enuToWgs84(enu: ENUCoordinate, anchor: Coordinate): Coordinate {
  const latRad0 = (anchor.latitude * Math.PI) / 180.0;
  const cosLat0 = Math.cos(latRad0);

  const dLatRad = enu.north / WGS84_A;
  const dLonRad = Math.abs(cosLat0) > 1e-7 ? enu.east / (WGS84_A * cosLat0) : 0;

  const latitude = anchor.latitude + (dLatRad * 180.0) / Math.PI;
  const longitude = anchor.longitude + (dLonRad * 180.0) / Math.PI;
  const altitude = (anchor.altitude ?? 0) + enu.up;

  return { latitude, longitude, altitude };
}
