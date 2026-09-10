/**
 * @navic/shared-models - Trip Recovery & Android Platform Types
 *
 * Interfaces and types for persistent offline navigation recovery,
 * geo URI intent resolution, and Android platform integrations.
 */

import { Coordinate, Route } from './navigation.types';

/**
 * Snapshot of active navigation state saved to offline persistent storage.
 */
export interface ActiveTripState {
  /** The calculated route being traversed */
  route: Route;
  /** Human-readable destination name */
  destinationName: string;
  /** Destination coordinate */
  destinationCoord: Coordinate;
  /** Timestamp when navigation started */
  startedAt: number;
  /** Timestamp when this state was last persisted */
  savedAt: number;
  /** Index of the route segment last matched */
  lastMatchedSegment: number;
  /** Distance traversed along route in meters */
  distanceTraveled: number;
  /** Remaining distance to destination in meters */
  remainingDistance: number;
  /** Whether active turn-by-turn guidance was running */
  isNavigating: boolean;
  /** Whether voice announcements were muted */
  voiceMuted: boolean;
}

/**
 * Structured payload parsed from an incoming Android geo: or google.navigation: intent.
 */
export interface GeoIntentPayload {
  /** Target latitude if specified */
  latitude: number | null;
  /** Target longitude if specified */
  longitude: number | null;
  /** Query or search label if specified (e.g. ?q=India+Gate) */
  query: string | null;
  /** Map zoom level if specified in URI */
  zoom: number | null;
  /** The original raw URI string received from Android */
  rawUri: string;
  /** Timestamp when the intent was processed */
  timestamp: number;
}

/**
 * Android platform integration configuration settings.
 */
export interface AndroidPlatformSettings {
  /** Whether sticky immersive full-screen mode engages during active navigation */
  immersiveDrivingMode: boolean;
  /** Whether transient audio ducking is requested during voice prompts */
  audioDucking: boolean;
  /** Whether active navigation state is persisted for crash/restart recovery */
  tripRecovery: boolean;
}

/**
 * Default Android platform settings.
 */
export const DEFAULT_ANDROID_PLATFORM_SETTINGS: AndroidPlatformSettings = {
  immersiveDrivingMode: true,
  audioDucking: true,
  tripRecovery: true,
};
