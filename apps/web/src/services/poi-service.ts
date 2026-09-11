/**
 * POI Service
 *
 * Web service connecting the offline POI Database to UI screens
 * (Route Planning and Map view). Tracks selected navigation destinations,
 * category filters, and live vehicle proximity calculations.
 */

import {
  type POI,
  type POICategory,
  type Coordinate,
  Logger,
} from '@navic/shared-models';
import {
  POIDatabase,
  type POISearchOptions,
  type POISearchResult,
} from '@navic/map-core/poi';
import { fusionService } from './fusion-service.js';
import bangalorePoiData from '../../../../data/poi/bangalore-poi.json';

export type DestinationListener = (destination: POI | null) => void;

class POIServiceImpl {
  private logger = new Logger('POIService');
  private database: POIDatabase;
  private selectedDestination: POI | null = null;
  private destinationListeners: Set<DestinationListener> = new Set();
  private lastCoordinate: Coordinate | null = null;

  constructor() {
    this.database = new POIDatabase(bangalorePoiData as unknown as POI[]);

    // Track vehicle coordinate from EKF fusion
    fusionService.subscribe((estimate) => {
      if (estimate.coordinate.latitude !== 0 && estimate.coordinate.longitude !== 0) {
        this.lastCoordinate = estimate.coordinate;
      }
    });
  }

  public getDatabase(): POIDatabase {
    return this.database;
  }

  public getAll(): readonly POI[] {
    return this.database.getAll();
  }

  public getById(id: string): POI | undefined {
    return this.database.getById(id);
  }

  public getVehicleCoordinate(): Coordinate {
    // Default to Vidyapeetha / Ashok Nagar, Bengaluru if vehicle hasn't reported fix yet
    return this.lastCoordinate ?? { latitude: 12.9343, longitude: 77.5627, altitude: 920 };
  }

  /**
   * Search offline POIs with query and optional category filter,
   * automatically using vehicle position as center for proximity ranking.
   */
  public search(query: string, options?: POISearchOptions): POISearchResult[] {
    const center = options?.center ?? this.getVehicleCoordinate();
    return this.database.search(query, {
      center,
      ...options,
    });
  }

  /**
   * Get nearby POIs sorted by distance from current vehicle location.
   */
  public getNearby(limit = 10, category?: POICategory | readonly POICategory[], maxRadiusMeters?: number): POISearchResult[] {
    return this.database.searchNearby(this.getVehicleCoordinate(), maxRadiusMeters ?? 50000, {
      limit,
      category,
    });
  }

  /**
   * Get currently selected route destination.
   */
  public getSelectedDestination(): POI | null {
    return this.selectedDestination;
  }

  /**
   * Set destination for route planning.
   */
  public setDestination(poi: POI | null): void {
    this.selectedDestination = poi;
    for (const listener of this.destinationListeners) {
      try {
        listener(poi);
      } catch (e) {
        this.logger.error('Destination listener error:', e);
      }
    }
  }

  /**
   * Subscribe to destination changes.
   */
  public onDestinationChange(listener: DestinationListener): () => void {
    this.destinationListeners.add(listener);
    listener(this.selectedDestination);
    return () => this.destinationListeners.delete(listener);
  }
}

export const poiService = new POIServiceImpl();
