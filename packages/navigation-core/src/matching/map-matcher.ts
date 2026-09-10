/**
 * @navic/navigation-core — Map Matcher
 *
 * High-performance offline map matching that snaps raw/fused vehicle
 * coordinates onto the active route geometry.
 *
 * Employs local equirectangular projection for sub-0.05 ms projection
 * math across polyline segments with heading alignment weighting.
 */

import {
  type Coordinate,
  type Route,
  calculateBearing,
  clamp,
} from '@navic/shared-models';

/**
 * Result of snapping a coordinate to a route polyline.
 */
export interface MapMatchResult {
  /** The coordinate snapped orthogonally onto the route geometry */
  readonly snappedCoordinate: Coordinate;

  /** Orthogonal distance (cross-track error) in meters */
  readonly distanceToRoute: number;

  /** Index of the route geometry segment snapped to */
  readonly segmentIndex: number;

  /** Heading/bearing of the matched road segment in degrees [0, 360) */
  readonly segmentBearing: number;

  /** Cumulative distance along the route in meters from start to snapped point */
  readonly alongRouteDistance: number;

  /** Road name of the matched segment if known */
  readonly roadName?: string;

  /** Confidence score between 0.0 and 1.0 */
  readonly confidence: number;
}

const EARTH_RADIUS_METERS = 6371000;
const DEG_TO_RAD = Math.PI / 180;

export class MapMatcher {
  /**
   * Snaps a vehicle coordinate to the active route polyline.
   *
   * @param position Current vehicle coordinate
   * @param route Active route
   * @param heading Optional vehicle heading in degrees (0-360)
   * @param speed Optional vehicle speed in m/s
   * @param searchWindowStart Optional segment index to prioritize forward progression
   */
  public match(
    position: Coordinate,
    route: Route,
    heading?: number,
    speed: number = 0,
    searchWindowStart: number = 0
  ): MapMatchResult {
    const geometry = route.geometry;
    if (geometry.length === 0) {
      return {
        snappedCoordinate: position,
        distanceToRoute: 0,
        segmentIndex: 0,
        segmentBearing: 0,
        alongRouteDistance: 0,
        confidence: 1.0,
      };
    }

    if (geometry.length === 1) {
      const p = geometry[0].coordinate;
      const dist = this.equirectangularDistance(position, p);
      return {
        snappedCoordinate: p,
        distanceToRoute: dist,
        segmentIndex: 0,
        segmentBearing: 0,
        alongRouteDistance: 0,
        roadName: geometry[0].roadName,
        confidence: this.calculateConfidence(dist),
      };
    }

    let bestDist = Infinity;
    let bestSegmentIndex = 0;
    let bestT = 0;
    let bestSnapped: Coordinate = geometry[0].coordinate;
    let bestBearing = 0;
    let bestScore = Infinity;

    // Search window: If searchWindowStart is given, look from max(0, start - 2)
    // to prevent snapping backwards on complex or crossing loops
    const startIndex = Math.max(0, searchWindowStart - 1);
    const endIndex = geometry.length - 1;

    for (let i = startIndex; i < endIndex; i++) {
      const pA = geometry[i].coordinate;
      const pB = geometry[i + 1].coordinate;

      const meanLatRad = ((pA.latitude + pB.latitude) / 2) * DEG_TO_RAD;
      const cosLat = Math.cos(meanLatRad);

      // Local equirectangular planar coordinates relative to pA
      const bx = (pB.longitude - pA.longitude) * DEG_TO_RAD * cosLat * EARTH_RADIUS_METERS;
      const by = (pB.latitude - pA.latitude) * DEG_TO_RAD * EARTH_RADIUS_METERS;
      const px = (position.longitude - pA.longitude) * DEG_TO_RAD * cosLat * EARTH_RADIUS_METERS;
      const py = (position.latitude - pA.latitude) * DEG_TO_RAD * EARTH_RADIUS_METERS;

      const segLenSq = bx * bx + by * by;
      let t = 0;
      if (segLenSq > 1e-6) {
        t = (px * bx + py * by) / segLenSq;
        t = clamp(t, 0, 1);
      }

      const qx = t * bx;
      const qy = t * by;
      const dx = px - qx;
      const dy = py - qy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const bearing = calculateBearing(pA.latitude, pA.longitude, pB.latitude, pB.longitude);

      // Heading penalty if moving and heading diverges significantly
      let score = dist;
      if (heading !== undefined && speed > 1.5) {
        const angleDiff = Math.abs((heading - bearing + 540) % 360 - 180);
        if (angleDiff > 90) {
          // Penalize opposing direction
          score += (angleDiff - 90) * 0.5;
        }
      }

      // Small forward bias to prefer the forward segments when distance is close
      const segmentLagPenalty = Math.max(0, searchWindowStart - i) * 2.0;
      score += segmentLagPenalty;

      if (score < bestScore) {
        bestScore = score;
        bestDist = dist;
        bestSegmentIndex = i;
        bestT = t;
        bestBearing = bearing;
        bestSnapped = {
          latitude: pA.latitude + t * (pB.latitude - pA.latitude),
          longitude: pA.longitude + t * (pB.longitude - pA.longitude),
        };
      }
    }

    // Calculate along-route cumulative distance
    const distAtA = geometry[bestSegmentIndex].distanceFromStart;
    const nextDist = geometry[bestSegmentIndex + 1]?.distanceFromStart ?? (distAtA + 1);
    const segmentLen = Math.max(0, nextDist - distAtA);
    const alongRouteDistance = distAtA + bestT * segmentLen;

    const roadName =
      geometry[bestSegmentIndex + 1]?.roadName ||
      geometry[bestSegmentIndex]?.roadName;

    return {
      snappedCoordinate: bestSnapped,
      distanceToRoute: bestDist,
      segmentIndex: bestSegmentIndex,
      segmentBearing: Math.round(bestBearing),
      alongRouteDistance,
      roadName,
      confidence: this.calculateConfidence(bestDist),
    };
  }

  private equirectangularDistance(c1: Coordinate, c2: Coordinate): number {
    const meanLat = ((c1.latitude + c2.latitude) / 2) * DEG_TO_RAD;
    const dx = (c2.longitude - c1.longitude) * DEG_TO_RAD * Math.cos(meanLat) * EARTH_RADIUS_METERS;
    const dy = (c2.latitude - c1.latitude) * DEG_TO_RAD * EARTH_RADIUS_METERS;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private calculateConfidence(distanceMeters: number): number {
    if (distanceMeters <= 5) return 1.0;
    if (distanceMeters >= 50) return 0.0;
    return 1.0 - (distanceMeters - 5) / 45;
  }
}
