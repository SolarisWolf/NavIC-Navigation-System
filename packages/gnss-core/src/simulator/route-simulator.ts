/**
 * Route Simulator
 *
 * Predefined movement scenarios for GNSS simulation testing and end-to-end
 * offline navigation evaluation in Delhi NCR.
 * Each scenario provides waypoints with position, altitude, target speeds,
 * and realistic driving conditions (tunnels, urban canyons, highways, off-route).
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
  readonly name?: string;
  readonly isTunnel?: boolean; // Signal loss expected
  readonly isUrbanCanyon?: boolean; // Multipath expected
}

/**
 * A simulation scenario.
 */
export interface SimulationScenario {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly waypoints: readonly Waypoint[];
  readonly loop: boolean; // Whether to loop back to start
  readonly category: 'city' | 'highway' | 'tunnel' | 'canyon' | 'offroute' | 'stationary';
}

// ═══════════════════════════════════════════════════════════════════════════
// Predefined Scenarios
// ═══════════════════════════════════════════════════════════════════════════

export const SCENARIOS: Record<string, SimulationScenario> = {
  'connaught-to-indiagate': {
    id: 'connaught-to-indiagate',
    name: 'Delhi — Connaught Place to India Gate',
    description: 'City navigation via Barakhamba Road, Mandi House roundabout, and Copernicus Marg',
    loop: true,
    category: 'city',
    waypoints: [
      { latitude: 28.6328, longitude: 77.2197, altitude: 216, speedMps: 0, name: 'Connaught Place Inner Circle' },
      { latitude: 28.6295, longitude: 77.2230, altitude: 216, speedMps: 11, name: 'Barakhamba Road' },
      { latitude: 28.6258, longitude: 77.2340, altitude: 215, speedMps: 9, name: 'Mandi House Approach' },
      { latitude: 28.6250, longitude: 77.2348, altitude: 215, speedMps: 6, name: 'Mandi House Roundabout' },
      { latitude: 28.6200, longitude: 77.2320, altitude: 215, speedMps: 12, name: 'Copernicus Marg' },
      { latitude: 28.6145, longitude: 77.2295, altitude: 216, speedMps: 8, name: 'C-Hexagon Roundabout' },
      { latitude: 28.6129, longitude: 77.2295, altitude: 216, speedMps: 0, name: 'India Gate' },
    ],
  },

  'pragati-maidan-tunnel': {
    id: 'pragati-maidan-tunnel',
    name: 'Tunnel Outage — Pragati Maidan Tunnel',
    description: 'Underground tunnel transit with 20-second complete GNSS blackout testing 50 Hz EKF Dead Reckoning',
    loop: true,
    category: 'tunnel',
    waypoints: [
      { latitude: 28.6190, longitude: 77.2420, altitude: 215, speedMps: 14, name: 'Mathura Road Approach' },
      { latitude: 28.6210, longitude: 77.2435, altitude: 212, speedMps: 16, name: 'Tunnel Portal Entry', isTunnel: true },
      { latitude: 28.6240, longitude: 77.2450, altitude: 204, speedMps: 16, name: 'Subterranean Midpoint 1', isTunnel: true },
      { latitude: 28.6270, longitude: 77.2470, altitude: 202, speedMps: 16, name: 'Subterranean Midpoint 2', isTunnel: true },
      { latitude: 28.6300, longitude: 77.2490, altitude: 210, speedMps: 14, name: 'Tunnel Portal Exit', isTunnel: true },
      { latitude: 28.6320, longitude: 77.2510, altitude: 215, speedMps: 16, name: 'Ring Road Merge' },
    ],
  },

  'urban-canyon-nehru': {
    id: 'urban-canyon-nehru',
    name: 'Urban Canyon — Nehru Place',
    description: 'Dense commercial hub with tall buildings causing satellite attenuation and multipath reflection',
    loop: true,
    category: 'canyon',
    waypoints: [
      { latitude: 28.5520, longitude: 77.2480, altitude: 218, speedMps: 12, name: 'Outer Ring Road Approach' },
      { latitude: 28.5495, longitude: 77.2515, altitude: 220, speedMps: 8, name: 'Nehru Place Entrance', isUrbanCanyon: true },
      { latitude: 28.5480, longitude: 77.2520, altitude: 220, speedMps: 5, name: 'Deep Canyon Plaza', isUrbanCanyon: true },
      { latitude: 28.5465, longitude: 77.2525, altitude: 220, speedMps: 6, name: 'Tower Shadow Alley', isUrbanCanyon: true },
      { latitude: 28.5450, longitude: 77.2530, altitude: 219, speedMps: 10, name: 'Metro Corridor Exit' },
    ],
  },

  'nh44-highway-cruise': {
    id: 'nh44-highway-cruise',
    name: 'Highway Cruise — NH 44',
    description: 'High-speed corridor drive (85-100 km/h) testing rapid telemetry updates and advance turn cues',
    loop: true,
    category: 'highway',
    waypoints: [
      { latitude: 28.7400, longitude: 77.1500, altitude: 215, speedMps: 18, name: 'Mukarba Chowk' },
      { latitude: 28.8400, longitude: 77.1300, altitude: 218, speedMps: 24, name: 'Singhu Border' },
      { latitude: 28.9100, longitude: 77.1100, altitude: 220, speedMps: 26, name: 'Kundli Expressway' },
      { latitude: 29.0200, longitude: 77.0700, altitude: 224, speedMps: 27, name: 'Murthal Flyover' },
      { latitude: 29.0500, longitude: 77.0500, altitude: 225, speedMps: 25, name: 'Sonipat Toll' },
    ],
  },

  'offroute-recalculation': {
    id: 'offroute-recalculation',
    name: 'Off-Route & Recalculation Loop',
    description: 'Vehicle deviates off Barakhamba Road onto Tolstoy Marg forcing automatic offline re-routing',
    loop: true,
    category: 'offroute',
    waypoints: [
      { latitude: 28.6328, longitude: 77.2197, altitude: 216, speedMps: 0, name: 'CP Start' },
      { latitude: 28.6300, longitude: 77.2225, altitude: 216, speedMps: 10, name: 'Barakhamba Road' },
      { latitude: 28.6275, longitude: 77.2200, altitude: 215, speedMps: 8, name: 'Divergence — Tolstoy Marg' },
      { latitude: 28.6250, longitude: 77.2170, altitude: 215, speedMps: 10, name: 'Off-Route Deviation' },
      { latitude: 28.6220, longitude: 77.2185, altitude: 215, speedMps: 11, name: 'Recalculated Path (Janpath)' },
      { latitude: 28.6140, longitude: 77.2230, altitude: 216, speedMps: 12, name: 'Kartavya Path' },
      { latitude: 28.6129, longitude: 77.2295, altitude: 216, speedMps: 0, name: 'India Gate' },
    ],
  },

  'stationary-delhi': {
    id: 'stationary-delhi',
    name: 'Stationary — Delhi',
    description: 'Fixed position benchmark at India Gate, New Delhi',
    loop: false,
    category: 'stationary',
    waypoints: [
      { latitude: 28.6129, longitude: 77.2295, altitude: 216, speedMps: 0, name: 'India Gate' },
    ],
  },

  'stationary-bangalore': {
    id: 'stationary-bangalore',
    name: 'Stationary — Bangalore',
    description: 'Fixed position benchmark at Vidhana Soudha, Bangalore',
    loop: false,
    category: 'stationary',
    waypoints: [
      { latitude: 12.9791, longitude: 77.5913, altitude: 920, speedMps: 0, name: 'Vidhana Soudha' },
    ],
  },
};

/**
 * Get a scenario by name. Defaults to 'connaught-to-indiagate'.
 */
export function getScenario(name: string): SimulationScenario {
  return SCENARIOS[name] ?? SCENARIOS['connaught-to-indiagate'] ?? SCENARIOS['stationary-delhi'];
}

/**
 * Get all available scenario names.
 */
export function getScenarioNames(): string[] {
  return Object.keys(SCENARIOS);
}

// ═══════════════════════════════════════════════════════════════════════════
// Route Interpolator with Timeline Seeking & Speed Scaling
// ═══════════════════════════════════════════════════════════════════════════

export interface InterpolatedState {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  bearing: number;
  currentWaypointName?: string;
  isTunnel: boolean;
  isUrbanCanyon: boolean;
}

export class RouteInterpolator {
  private scenario: SimulationScenario;
  private currentIndex: number = 0;
  private segmentProgress: number = 0; // 0.0 to 1.0
  private segmentDuration: number = 0;
  private segmentElapsed: number = 0;

  // Total cumulative lengths
  private segmentDistances: number[] = [];
  private totalDistanceMeters: number = 0;

  constructor(scenario: SimulationScenario) {
    this.scenario = scenario;
    this.computeSegmentDistances();
    this.computeSegmentDuration();
  }

  public getScenario(): SimulationScenario {
    return this.scenario;
  }

  public setScenario(scenario: SimulationScenario): void {
    this.scenario = scenario;
    this.computeSegmentDistances();
    this.reset();
  }

  /**
   * Reset to the start of the route.
   */
  public reset(): void {
    this.currentIndex = 0;
    this.segmentProgress = 0;
    this.segmentElapsed = 0;
    this.computeSegmentDuration();
  }

  /**
   * Seeks to a normalized progress along the scenario route (0.0 to 1.0).
   */
  public seek(fraction: number): void {
    const clamped = Math.max(0, Math.min(1.0, fraction));
    if (this.totalDistanceMeters <= 0 || this.segmentDistances.length === 0) {
      this.segmentProgress = clamped;
      return;
    }

    const targetDistance = clamped * this.totalDistanceMeters;
    let accumulated = 0;

    for (let i = 0; i < this.segmentDistances.length; i++) {
      const segDist = this.segmentDistances[i];
      if (accumulated + segDist >= targetDistance || i === this.segmentDistances.length - 1) {
        this.currentIndex = i;
        const remainder = targetDistance - accumulated;
        this.segmentProgress = segDist > 0 ? Math.max(0, Math.min(1.0, remainder / segDist)) : 0;
        this.computeSegmentDuration();
        this.segmentElapsed = this.segmentProgress * this.segmentDuration;
        return;
      }
      accumulated += segDist;
    }
  }

  /**
   * Calculates overall progress along the scenario (0.0 to 1.0).
   */
  public getProgress(): number {
    if (this.totalDistanceMeters <= 0 || this.segmentDistances.length === 0) {
      return this.segmentProgress;
    }

    let traveled = 0;
    for (let i = 0; i < this.currentIndex; i++) {
      traveled += this.segmentDistances[i] ?? 0;
    }
    traveled += (this.segmentDistances[this.currentIndex] ?? 0) * this.segmentProgress;
    return Math.max(0, Math.min(1.0, traveled / this.totalDistanceMeters));
  }

  public getTotalDistance(): number {
    return this.totalDistanceMeters;
  }

  /**
   * Update the route interpolator by a time delta.
   *
   * @param dtMs - Time delta in milliseconds (already scaled by speed multiplier)
   * @returns Current interpolated position and metadata
   */
  public update(dtMs: number): InterpolatedState {
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
        currentWaypointName: wp.name,
        isTunnel: Boolean(wp.isTunnel),
        isUrbanCanyon: Boolean(wp.isUrbanCanyon),
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

    const isTunnel = Boolean(from.isTunnel || to.isTunnel);
    const isUrbanCanyon = Boolean(from.isUrbanCanyon || to.isUrbanCanyon);

    return {
      latitude,
      longitude,
      altitude,
      speed,
      bearing,
      currentWaypointName: from.name,
      isTunnel,
      isUrbanCanyon,
    };
  }

  private computeSegmentDistances(): void {
    this.segmentDistances = [];
    this.totalDistanceMeters = 0;
    const wps = this.scenario.waypoints;

    for (let i = 0; i < wps.length - 1; i++) {
      const dist = haversineDistance(
        wps[i].latitude,
        wps[i].longitude,
        wps[i + 1].latitude,
        wps[i + 1].longitude
      );
      this.segmentDistances.push(dist);
      this.totalDistanceMeters += dist;
    }
  }

  private computeSegmentDuration(): void {
    const waypoints = this.scenario.waypoints;
    if (this.currentIndex >= waypoints.length - 1) {
      this.segmentDuration = 0;
      return;
    }

    const from = waypoints[this.currentIndex];
    const to = waypoints[this.currentIndex + 1];
    const distance = this.segmentDistances[this.currentIndex] ?? haversineDistance(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude
    );

    // Average speed for the segment (minimum 0.5 m/s to prevent division by zero)
    const avgSpeed = Math.max(0.5, (from.speedMps + to.speedMps) / 2);
    this.segmentDuration = (distance / avgSpeed) * 1000;
  }
}
