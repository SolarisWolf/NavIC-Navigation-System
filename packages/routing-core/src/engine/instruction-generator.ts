/**
 * @navic/routing-core — Turn-by-Turn Instruction Generator
 *
 * Translates a sequence of traversed road graph edges into
 * standard navigation maneuvers (TurnLeft, TurnRight, KeepStraight, etc.)
 * with exact distances, bearings, and human-readable descriptions.
 */

import {
  type Coordinate,
  type NavigationInstruction,
  type RoutePoint,
  ManeuverType,
  calculateBearing,
  haversineDistance,
} from '@navic/shared-models';
import { RoadEdge, RoadNode } from '../graph/road-graph.js';

export class InstructionGenerator {
  public static generateInstructions(
    edges: readonly RoadEdge[],
    origin: Coordinate,
    destination: Coordinate
  ): {
    instructions: NavigationInstruction[];
    geometry: RoutePoint[];
  } {
    if (edges.length === 0) {
      const singlePoint: RoutePoint = {
        coordinate: destination,
        roadName: 'Destination',
        distanceFromStart: 0,
      };
      const singleInstruction: NavigationInstruction = {
        maneuver: ManeuverType.Arrive,
        distanceFromStart: 0,
        distanceToNext: 0,
        roadName: 'Destination',
        description: 'You are at your destination',
        coordinate: destination,
      };
      return {
        instructions: [singleInstruction],
        geometry: [
          { coordinate: origin, roadName: 'Origin', distanceFromStart: 0 },
          singlePoint,
        ],
      };
    }

    // 1. Build composite high-resolution route geometry points
    const geometry: RoutePoint[] = [];
    let cumulativeDist = 0;

    // Start with origin
    geometry.push({
      coordinate: origin,
      roadName: edges[0].roadName,
      distanceFromStart: 0,
    });

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const pts = edge.geometry;

      for (let p = 0; p < pts.length; p++) {
        // Skip first point of edge if duplicate with last point
        if (geometry.length > 0) {
          const last = geometry[geometry.length - 1].coordinate;
          const stepDist = haversineDistance(
            last.latitude,
            last.longitude,
            pts[p].latitude,
            pts[p].longitude
          );
          if (stepDist < 1 && p === 0) continue;
          cumulativeDist += stepDist;
        }

        geometry.push({
          coordinate: pts[p],
          roadName: edge.roadName,
          distanceFromStart: Math.round(cumulativeDist),
        });
      }
    }

    // Append destination if not already at end
    const lastCoord = geometry[geometry.length - 1].coordinate;
    const endDist = haversineDistance(
      lastCoord.latitude,
      lastCoord.longitude,
      destination.latitude,
      destination.longitude
    );
    if (endDist > 1) {
      cumulativeDist += endDist;
      geometry.push({
        coordinate: destination,
        roadName: 'Destination',
        distanceFromStart: Math.round(cumulativeDist),
      });
    }

    // 2. Generate Turn Instructions
    const rawInstructions: NavigationInstruction[] = [];
    let distFromStart = 0;

    // Initial Departure
    const firstEdge = edges[0];
    const initialBearing = geometry.length >= 2
      ? calculateBearing(
          geometry[0].coordinate.latitude,
          geometry[0].coordinate.longitude,
          geometry[1].coordinate.latitude,
          geometry[1].coordinate.longitude
        )
      : 0;

    const cardinalDir = this.getCardinalDirection(initialBearing);
    rawInstructions.push({
      maneuver: ManeuverType.Depart,
      distanceFromStart: 0,
      distanceToNext: 0, // Will update in second pass
      roadName: firstEdge.roadName,
      description: `Head ${cardinalDir} on ${firstEdge.roadName}`,
      coordinate: origin,
    });

    // Intermediate Turn Transitions
    for (let i = 0; i < edges.length - 1; i++) {
      const prevEdge = edges[i];
      const nextEdge = edges[i + 1];

      distFromStart += prevEdge.lengthMeters;

      // Check if road name or trajectory changes significantly
      const prevGeom = prevEdge.geometry;
      const nextGeom = nextEdge.geometry;

      const p1 = prevGeom[prevGeom.length - 2] ?? prevGeom[0];
      const p2 = prevGeom[prevGeom.length - 1];
      const p3 = nextGeom[1] ?? nextGeom[nextGeom.length - 1];

      const bearingIn = calculateBearing(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
      const bearingOut = calculateBearing(p2.latitude, p2.longitude, p3.latitude, p3.longitude);

      let delta = bearingOut - bearingIn;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;

      const nameChanged = prevEdge.roadName.toLowerCase() !== nextEdge.roadName.toLowerCase();
      const isSignificantTurn = Math.abs(delta) >= 20;

      if (nameChanged || isSignificantTurn) {
        const maneuver = this.classifyManeuver(delta, nameChanged);
        const description = this.formatDescription(maneuver, nextEdge.roadName);

        rawInstructions.push({
          maneuver,
          distanceFromStart: Math.round(distFromStart),
          distanceToNext: 0,
          roadName: nextEdge.roadName,
          description,
          coordinate: p2,
        });
      }
    }

    // Final Arrival
    rawInstructions.push({
      maneuver: ManeuverType.Arrive,
      distanceFromStart: Math.round(cumulativeDist),
      distanceToNext: 0,
      roadName: 'Destination',
      description: 'You have arrived at your destination',
      coordinate: destination,
    });

    // 3. Second pass: Populate distanceToNext for each instruction
    const instructions: NavigationInstruction[] = [];
    for (let i = 0; i < rawInstructions.length; i++) {
      const curr = rawInstructions[i];
      const next = rawInstructions[i + 1];
      const distToNext = next ? Math.max(0, next.distanceFromStart - curr.distanceFromStart) : 0;

      instructions.push({
        ...curr,
        distanceToNext: distToNext,
      });
    }

    return { instructions, geometry };
  }

  private static classifyManeuver(delta: number, nameChanged: boolean): ManeuverType {
    if (delta > 135) return ManeuverType.UTurn;
    if (delta > 45) return ManeuverType.TurnRight;
    if (delta > 18) return ManeuverType.TurnSlightRight;

    if (delta < -135) return ManeuverType.UTurn;
    if (delta < -45) return ManeuverType.TurnLeft;
    if (delta < -18) return ManeuverType.TurnSlightLeft;

    return ManeuverType.KeepStraight;
  }

  private static formatDescription(maneuver: ManeuverType, roadName: string): string {
    switch (maneuver) {
      case ManeuverType.TurnRight:
        return `Turn right onto ${roadName}`;
      case ManeuverType.TurnLeft:
        return `Turn left onto ${roadName}`;
      case ManeuverType.TurnSlightRight:
        return `Turn slight right onto ${roadName}`;
      case ManeuverType.TurnSlightLeft:
        return `Turn slight left onto ${roadName}`;
      case ManeuverType.TurnSharpRight:
        return `Turn sharp right onto ${roadName}`;
      case ManeuverType.TurnSharpLeft:
        return `Turn sharp left onto ${roadName}`;
      case ManeuverType.UTurn:
        return `Make a U-turn onto ${roadName}`;
      case ManeuverType.KeepStraight:
      default:
        return `Continue onto ${roadName}`;
    }
  }

  private static getCardinalDirection(bearing: number): string {
    const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index < 0 ? index + 8 : index];
  }
}
