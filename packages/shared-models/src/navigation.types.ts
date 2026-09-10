/**
 * @navic/shared-models — Navigation Type Definitions
 *
 * Core types for routing, navigation instructions, maneuvers, and
 * real-time navigation state tracking.
 */

// ─── Coordinates ─────────────────────────────────────────────────────────────

/**
 * A geographic coordinate in WGS84.
 */
export interface Coordinate {
  readonly latitude: number;
  readonly longitude: number;
  readonly altitude?: number;
}

// ─── Maneuvers ───────────────────────────────────────────────────────────────

/**
 * Types of navigation maneuvers.
 */
export enum ManeuverType {
  Depart = 'Depart',
  Arrive = 'Arrive',
  TurnLeft = 'TurnLeft',
  TurnRight = 'TurnRight',
  TurnSharpLeft = 'TurnSharpLeft',
  TurnSharpRight = 'TurnSharpRight',
  TurnSlightLeft = 'TurnSlightLeft',
  TurnSlightRight = 'TurnSlightRight',
  UTurn = 'UTurn',
  KeepStraight = 'KeepStraight',
  KeepLeft = 'KeepLeft',
  KeepRight = 'KeepRight',
  Roundabout = 'Roundabout',
  RoundaboutExit = 'RoundaboutExit',
  Merge = 'Merge',
  ExitHighway = 'ExitHighway',
  Fork = 'Fork',
}

/**
 * Routing profile (mode of transport).
 */
export enum RoutingProfile {
  Car = 'car',
  Bicycle = 'bicycle',
  Walking = 'walking',
}

/**
 * Route optimization strategy.
 */
export enum RouteOptimization {
  Fastest = 'fastest',
  Shortest = 'shortest',
}

// ─── Route ───────────────────────────────────────────────────────────────────

/**
 * A single navigation instruction within a route.
 */
export interface NavigationInstruction {
  /** The maneuver to perform */
  readonly maneuver: ManeuverType;

  /** Distance from route start to this instruction in meters */
  readonly distanceFromStart: number;

  /** Distance to the next instruction in meters */
  readonly distanceToNext: number;

  /** Name of the road to turn onto */
  readonly roadName: string;

  /** Human-readable description (e.g., "Turn right onto NH 44") */
  readonly description: string;

  /** Coordinate where this maneuver occurs */
  readonly coordinate: Coordinate;

  /** For roundabouts: which exit number */
  readonly roundaboutExitNumber?: number;
}

/**
 * A point along the route geometry.
 */
export interface RoutePoint {
  readonly coordinate: Coordinate;
  readonly roadName?: string;
  readonly distanceFromStart: number;
}

/**
 * A complete calculated route from origin to destination.
 */
export interface Route {
  /** Unique route identifier */
  readonly id: string;

  /** Origin coordinate */
  readonly origin: Coordinate;

  /** Destination coordinate */
  readonly destination: Coordinate;

  /** Total route distance in meters */
  readonly distance: number;

  /** Estimated travel time in seconds */
  readonly estimatedTime: number;

  /** Route geometry as a series of points */
  readonly geometry: readonly RoutePoint[];

  /** Turn-by-turn instructions */
  readonly instructions: readonly NavigationInstruction[];

  /** Routing profile used */
  readonly profile: RoutingProfile;

  /** Optimization strategy used */
  readonly optimization: RouteOptimization;

  /** Timestamp when this route was calculated */
  readonly calculatedAt: number;
}

// ─── Navigation State ────────────────────────────────────────────────────────

/**
 * Navigation mode.
 */
export enum NavigationMode {
  /** No active navigation */
  Idle = 'Idle',

  /** Route is being calculated */
  Calculating = 'Calculating',

  /** Actively navigating a route */
  Active = 'Active',

  /** User has deviated; recalculating route */
  Rerouting = 'Rerouting',

  /** Destination reached */
  Arrived = 'Arrived',
}

/**
 * Real-time navigation state during active navigation.
 */
export interface NavigationState {
  /** Current navigation mode */
  readonly mode: NavigationMode;

  /** Active route (null if idle) */
  readonly route: Route | null;

  /** Current estimated position (from EKF/GNSS) */
  readonly currentPosition: Coordinate | null;

  /** Matched position on the route (snapped to road) */
  readonly matchedPosition: Coordinate | null;

  /** Current road name */
  readonly currentRoadName: string | null;

  /** Next maneuver instruction */
  readonly nextInstruction: NavigationInstruction | null;

  /** Distance to next maneuver in meters */
  readonly distanceToNextManeuver: number | null;

  /** Remaining distance to destination in meters */
  readonly remainingDistance: number | null;

  /** Estimated time of arrival (Unix timestamp in ms) */
  readonly eta: number | null;

  /** Remaining time in seconds */
  readonly remainingTime: number | null;

  /** Current speed in m/s */
  readonly currentSpeed: number;

  /** Whether the user is off-route */
  readonly isOffRoute: boolean;

  /** Route progress as a fraction (0.0 to 1.0) */
  readonly progress: number;
}
