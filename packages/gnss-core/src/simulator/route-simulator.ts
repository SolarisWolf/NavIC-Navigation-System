/**
 * Route Simulator
 *
 * Predefined movement scenarios for GNSS simulation testing.
 * Each scenario provides a series of waypoints with position, speed, and timing.
 */

import { haversineDistance, calculateBearing } from '@navic/shared-models';

/**
 * A waypoint in a simulation scenario.
 */
export interface Waypoint {
  readonly latitude: number;
  readonly longitude: number;
  readonly altitude: number;
  readonly speedMps: number; // Target speed at this point
}

/**
 * A simulation scenario.
 */
export interface SimulationScenario {
  readonly name: string;
  readonly description: string;
  readonly waypoints: readonly Waypoint[];
  readonly loop: boolean; // Whether to loop back to start
}

// ═══════════════════════════════════════════════════════════════════════════
// Predefined Scenarios
// ═══════════════════════════════════════════════════════════════════════════

export const SCENARIOS: Record<string, SimulationScenario> = {
  'stationary-delhi': {
    name: 'Stationary — Delhi',
    description: 'Fixed position at India Gate, New Delhi',
    loop: false,
    waypoints: [
      { latitude: 28.6129, longitude: 77.2295, altitude: 216, speedMps: 0 },
    ],
  },

  'stationary-bangalore': {
    name: 'Stationary — Bangalore',
    description: 'Fixed position at Vidhana Soudha, Bangalore',
    loop: false,
    waypoints: [
      { latitude: 12.9791, longitude: 77.5913, altitude: 920, speedMps: 0 },
    ],
  },

  'highway-nh44': {
    name: 'Highway — NH 44',
    description: 'Drive along NH-44 from Delhi south towards Jaipur',
    loop: true,
    waypoints: [
      // Delhi (India Gate)
      { latitude: 28.6129, longitude: 77.2295, altitude: 216, speedMps: 0 },
      // Delhi outskirts
      { latitude: 28.5500, longitude: 77.1800, altitude: 220, speedMps: 16 },
      // Manesar
      { latitude: 28.3600, longitude: 76.9400, altitude: 225, speedMps: 25 },
      // Dharuhera
      { latitude: 28.2100, longitude: 76.8000, altitude: 230, speedMps: 30 },
      // Rewari
      { latitude: 28.1900, longitude: 76.6200, altitude: 235, speedMps: 25 },
      // Narnaul approach
      { latitude: 28.0500, longitude: 76.3800, altitude: 300, speedMps: 22 },
      // Narnaul
      { latitude: 28.0400, longitude: 76.1100, altitude: 310, speedMps: 20 },
      // Behror
      { latitude: 27.8900, longitude: 76.2800, altitude: 325, speedMps: 25 },
      // Shahpura
      { latitude: 27.3900, longitude: 75.9600, altitude: 380, speedMps: 28 },
      // Jaipur approach
      { latitude: 26.9500, longitude: 75.8200, altitude: 430, speedMps: 22 },
      // Jaipur (Hawa Mahal)
      { latitude: 26.9239, longitude: 75.8267, altitude: 431, speedMps: 0 },
    ],
  },

  'urban-mumbai': {
    name: 'Urban — Mumbai',
    description: 'Urban driving in Mumbai with mixed conditions',
    loop: true,
    waypoints: [
      // Gateway of India
      { latitude: 18.9220, longitude: 72.8347, altitude: 8, speedMps: 0 },
      // Marine Drive
      { latitude: 18.9440, longitude: 72.8237, altitude: 5, speedMps: 8 },
      // Chowpatty
      { latitude: 18.9540, longitude: 72.8140, altitude: 3, speedMps: 6 },
      // Haji Ali
      { latitude: 18.9827, longitude: 72.8090, altitude: 4, speedMps: 5 },
      // Worli Sea Link approach
      { latitude: 19.0100, longitude: 72.8150, altitude: 12, speedMps: 14 },
      // Bandra
      { latitude: 19.0544, longitude: 72.8402, altitude: 10, speedMps: 8 },
      // Juhu Beach
      { latitude: 19.0962, longitude: 72.8265, altitude: 3, speedMps: 6 },
      // Andheri
      { latitude: 19.1190, longitude: 72.8467, altitude: 15, speedMps: 5 },
    ],
  },

  'gnss-outage': {
    name: 'GNSS Outage — Tunnel',
    description: 'Highway drive with 30-second GNSS loss in tunnel',
    loop: true,
    waypoints: [
      // Approaching tunnel
      { latitude: 19.0200, longitude: 73.0100, altitude: 50, speedMps: 22 },
      // Before tunnel
      { latitude: 19.0300, longitude: 73.0200, altitude: 55, speedMps: 20 },
      // Tunnel entry (GNSS loss handled by simulator)
      { latitude: 19.0400, longitude: 73.0300, altitude: 45, speedMps: 16 },
      // Tunnel mid
      { latitude: 19.0500, longitude: 73.0400, altitude: 40, speedMps: 16 },
      // Tunnel exit
      { latitude: 19.0600, longitude: 73.0500, altitude: 45, speedMps: 16 },
      // After tunnel (GNSS recovery)
      { latitude: 19.0700, longitude: 73.0600, altitude: 50, speedMps: 20 },
      // Clear highway
      { latitude: 19.0900, longitude: 73.0800, altitude: 55, speedMps: 25 },
    ],
  },
};

/**
 * Get a scenario by name. Defaults to 'stationary-delhi'.
 */
export function getScenario(name: string): SimulationScenario {
  return SCENARIOS[name] ?? SCENARIOS['stationary-delhi'];
}

/**
 * Get all available scenario names.
 */
export function getScenarioNames(): string[] {
  return Object.keys(SCENARIOS);
}

// ═══════════════════════════════════════════════════════════════════════════
// Route Interpolator
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Manages movement along a scenario's waypoints over time.
 */
export class RouteInterpolator {
  private scenario: SimulationScenario;
  private currentIndex: number = 0;
  private segmentProgress: number = 0; // 0.0 to 1.0
  private segmentDuration: number = 0;
  private segmentElapsed: number = 0;

  constructor(scenario: SimulationScenario) {
    this.scenario = scenario;
    this.computeSegmentDuration();
  }

  /**
   * Reset to the start of the route.
   */
  reset(): void {
    this.currentIndex = 0;
    this.segmentProgress = 0;
    this.segmentElapsed = 0;
    this.computeSegmentDuration();
  }

  /**
   * Update the route interpolator by a time delta.
   *
   * @param dtMs - Time delta in milliseconds
   * @returns Current interpolated position
   */
  update(dtMs: number): {
    latitude: number;
    longitude: number;
    altitude: number;
    speed: number;
    bearing: number;
  } {
    const waypoints = this.scenario.waypoints;

    // Single-point (stationary) scenario
    if (waypoints.length <= 1) {
      const wp = waypoints[0];
      return {
        latitude: wp.latitude,
        longitude: wp.longitude,
        altitude: wp.altitude,
        speed: 0,
        bearing: 0,
      };
    }

    // Advance along the route
    this.segmentElapsed += dtMs;
    if (this.segmentDuration > 0) {
      this.segmentProgress = Math.min(1.0, this.segmentElapsed / this.segmentDuration);
    }

    // Move to next segment if complete
    if (this.segmentProgress >= 1.0 && this.currentIndex < waypoints.length - 2) {
      this.currentIndex++;
      this.segmentProgress = 0;
      this.segmentElapsed = 0;
      this.computeSegmentDuration();
    } else if (this.segmentProgress >= 1.0 && this.scenario.loop) {
      // Loop back to start
      this.currentIndex = 0;
      this.segmentProgress = 0;
      this.segmentElapsed = 0;
      this.computeSegmentDuration();
    }

    // Interpolate between current and next waypoint
    const from = waypoints[this.currentIndex];
    const to = waypoints[Math.min(this.currentIndex + 1, waypoints.length - 1)];
    const t = this.segmentProgress;

    const latitude = from.latitude + (to.latitude - from.latitude) * t;
    const longitude = from.longitude + (to.longitude - from.longitude) * t;
    const altitude = from.altitude + (to.altitude - from.altitude) * t;
    const speed = from.speedMps + (to.speedMps - from.speedMps) * t;

    // Calculate bearing from current to next
    const bearing = calculateBearing(latitude, longitude, to.latitude, to.longitude);

    return { latitude, longitude, altitude, speed, bearing };
  }

  /**
   * Compute the duration of the current segment based on distance and speed.
   */
  private computeSegmentDuration(): void {
    const waypoints = this.scenario.waypoints;
    if (this.currentIndex >= waypoints.length - 1) {
      this.segmentDuration = 0;
      return;
    }

    const from = waypoints[this.currentIndex];
    const to = waypoints[this.currentIndex + 1];

    const distance = haversineDistance(
      from.latitude, from.longitude,
      to.latitude, to.longitude,
    );

    // Average speed for the segment
    const avgSpeed = Math.max(0.5, (from.speedMps + to.speedMps) / 2);

    // Duration in ms
    this.segmentDuration = (distance / avgSpeed) * 1000;
  }
}
