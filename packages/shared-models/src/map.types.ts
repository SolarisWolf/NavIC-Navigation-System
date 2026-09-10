/**
 * @navic/shared-models — Map Type Definitions
 *
 * Core types for offline map rendering, tile management, POI data,
 * and geographic boundaries.
 */

// ─── Geographic Boundaries ──────────────────────────────────────────────────

/**
 * An axis-aligned bounding box in WGS84 coordinates.
 */
export interface BoundingBox {
  readonly north: number;
  readonly south: number;
  readonly east: number;
  readonly west: number;
}

// ─── Tile System ─────────────────────────────────────────────────────────────

/**
 * A tile coordinate in the standard TMS/XYZ tile scheme.
 */
export interface TileCoordinate {
  /** Tile X index */
  readonly x: number;

  /** Tile Y index */
  readonly y: number;

  /** Zoom level (0 = world, higher = more detail) */
  readonly z: number;
}

/**
 * A map tile with its data.
 */
export interface MapTile {
  readonly coordinate: TileCoordinate;

  /** Raw tile data (e.g., protobuf vector tile or PNG raster) */
  readonly data: ArrayBuffer;

  /** MIME type of the tile data */
  readonly mimeType: string;
}

// ─── Points of Interest ─────────────────────────────────────────────────────

/**
 * Categories for points of interest.
 * Matches the project specification's target POI types.
 */
export enum POICategory {
  Hospital = 'Hospital',
  Police = 'Police',
  PetrolStation = 'PetrolStation',
  Restaurant = 'Restaurant',
  Hotel = 'Hotel',
  School = 'School',
  College = 'College',
  RailwayStation = 'RailwayStation',
  Airport = 'Airport',
  Landmark = 'Landmark',
  ATM = 'ATM',
  Pharmacy = 'Pharmacy',
  BusStop = 'BusStop',
  Temple = 'Temple',
  Mosque = 'Mosque',
  Church = 'Church',
  Park = 'Park',
  ShoppingMall = 'ShoppingMall',
  Other = 'Other',
}

/**
 * A point of interest stored in the offline POI database.
 */
export interface POI {
  /** Unique identifier */
  readonly id: string;

  /** Display name */
  readonly name: string;

  /** POI category */
  readonly category: POICategory;

  /** Location */
  readonly latitude: number;
  readonly longitude: number;

  /** Optional street address */
  readonly address?: string;

  /** Optional phone number */
  readonly phone?: string;

  /** Optional additional tags/metadata */
  readonly tags?: Readonly<Record<string, string>>;
}

// ─── Map Configuration ───────────────────────────────────────────────────────

/**
 * Map display settings.
 */
export interface MapDisplayConfig {
  /** Minimum zoom level */
  readonly minZoom: number;

  /** Maximum zoom level */
  readonly maxZoom: number;

  /** Default center coordinate */
  readonly defaultCenter: {
    readonly latitude: number;
    readonly longitude: number;
  };

  /** Default zoom level */
  readonly defaultZoom: number;

  /** Whether to rotate the map with device bearing */
  readonly rotateWithBearing: boolean;
}

// ─── Map State ───────────────────────────────────────────────────────────────

/**
 * Current map viewport state.
 */
export interface MapViewState {
  /** Center of the viewport */
  readonly center: {
    readonly latitude: number;
    readonly longitude: number;
  };

  /** Current zoom level */
  readonly zoom: number;

  /** Map rotation in degrees (0 = north up) */
  readonly rotation: number;

  /** Visible bounding box */
  readonly bounds: BoundingBox;
}
