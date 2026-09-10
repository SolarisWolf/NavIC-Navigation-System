/**
 * @navic/map-core — POI Database
 *
 * In-memory searchable spatial database for Points of Interest (POIs).
 * Supports offline fuzzy text search, category filtering, and spatial
 * proximity range queries with distance and bearing calculation.
 */

import {
  POI,
  POICategory,
  Coordinate,
  haversineDistance,
  calculateBearing,
  Logger,
} from '@navic/shared-models';

export interface POISearchOptions {
  /** Maximum number of results to return (default: 20) */
  readonly limit?: number;

  /** Filter by category or categories */
  readonly category?: POICategory | readonly POICategory[];

  /** Reference coordinate for calculating distance & bearing and proximity ranking */
  readonly center?: Coordinate;

  /** Maximum distance in meters from center */
  readonly maxRadiusMeters?: number;
}

export interface POISearchResult {
  readonly poi: POI;
  readonly distanceMeters?: number;
  readonly bearingDegrees?: number;
  readonly score: number;
}

export class POIDatabase {
  private logger = new Logger('POIDatabase');
  private pois: Map<string, POI> = new Map();
  private categoryIndex: Map<POICategory, Set<string>> = new Map();

  constructor(initialPois?: POI[]) {
    if (initialPois) {
      this.addPOIs(initialPois);
    }
  }

  /**
   * Adds a single POI to the database and updates indices.
   */
  public addPOI(poi: POI): void {
    this.pois.set(poi.id, poi);

    let catSet = this.categoryIndex.get(poi.category);
    if (!catSet) {
      catSet = new Set();
      this.categoryIndex.set(poi.category, catSet);
    }
    catSet.add(poi.id);
  }

  /**
   * Adds multiple POIs in bulk.
   */
  public addPOIs(pois: readonly POI[]): void {
    for (const poi of pois) {
      this.addPOI(poi);
    }
    this.logger.info(`Loaded ${pois.length} POIs (total in database: ${this.pois.size})`);
  }

  public getById(id: string): POI | undefined {
    return this.pois.get(id);
  }

  public getAll(): readonly POI[] {
    return Array.from(this.pois.values());
  }

  public count(): number {
    return this.pois.size;
  }

  /**
   * Searches POIs by name, address, category, and spatial proximity.
   */
  public search(query: string, options?: POISearchOptions): POISearchResult[] {
    const limit = options?.limit ?? 20;
    const center = options?.center;
    const maxRadius = options?.maxRadiusMeters;
    const normalizedQuery = query.trim().toLowerCase();
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);

    // Selected categories filter
    let allowedCategories: Set<POICategory> | null = null;
    if (options?.category) {
      allowedCategories = Array.isArray(options.category)
        ? new Set(options.category)
        : new Set([options.category as POICategory]);
    }

    const results: POISearchResult[] = [];

    for (const poi of this.pois.values()) {
      // 1. Category check
      if (allowedCategories && !allowedCategories.has(poi.category)) {
        continue;
      }

      // 2. Spatial distance check
      let distance: number | undefined;
      let bearing: number | undefined;

      if (center) {
        distance = haversineDistance(
          center.latitude,
          center.longitude,
          poi.latitude,
          poi.longitude
        );
        if (maxRadius !== undefined && distance > maxRadius) {
          continue;
        }
        bearing = calculateBearing(
          center.latitude,
          center.longitude,
          poi.latitude,
          poi.longitude
        );
      }

      // 3. Text relevance scoring
      let score = 0;

      if (terms.length === 0) {
        // Empty query: match all passing category/spatial filters
        score = 100;
      } else {
        const nameLower = poi.name.toLowerCase();
        const addrLower = (poi.address || '').toLowerCase();
        const catLower = poi.category.toLowerCase();

        let allTermsMatched = true;

        for (const term of terms) {
          let termScore = 0;
          if (nameLower.startsWith(term)) {
            termScore += 100;
          } else if (nameLower.includes(term)) {
            termScore += 50;
          }

          if (catLower.includes(term)) {
            termScore += 30;
          }

          if (addrLower.includes(term)) {
            termScore += 20;
          }

          if (poi.tags) {
            for (const val of Object.values(poi.tags)) {
              if (String(val).toLowerCase().includes(term)) {
                termScore += 15;
                break;
              }
            }
          }

          if (termScore === 0) {
            allTermsMatched = false;
            break;
          }
          score += termScore;
        }

        if (!allTermsMatched) continue;
      }

      results.push({
        poi,
        distanceMeters: distance !== undefined ? Math.round(distance) : undefined,
        bearingDegrees: bearing !== undefined ? Math.round(bearing) : undefined,
        score,
      });
    }

    // Sort results:
    // If text query provided: sort by score desc, then distance asc
    // If no text query: sort strictly by distance asc
    results.sort((a, b) => {
      if (terms.length > 0) {
        if (b.score !== a.score) return b.score - a.score;
      }
      if (a.distanceMeters !== undefined && b.distanceMeters !== undefined) {
        return a.distanceMeters - b.distanceMeters;
      }
      return 0;
    });

    return results.slice(0, limit);
  }

  /**
   * Search POIs strictly within a category, optionally sorted by distance from center.
   */
  public searchByCategory(
    category: POICategory | readonly POICategory[],
    options?: POISearchOptions
  ): POISearchResult[] {
    return this.search('', { ...options, category });
  }

  /**
   * Search POIs nearby a given coordinate within a specified radius, sorted by distance.
   */
  public searchNearby(
    center: Coordinate,
    maxRadiusMeters: number,
    options?: POISearchOptions
  ): POISearchResult[] {
    return this.search('', {
      ...options,
      center,
      maxRadiusMeters,
    });
  }
}
