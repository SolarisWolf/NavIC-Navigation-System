/**
 * @navic/map-core
 *
 * Offline map rendering and POI management.
 *
 * This package will contain:
 * - MBTiles Reader (Phase 6)
 * - Map Renderer (Phase 6)
 * - POI Database (Phase 7)
 * - POI Search Engine (Phase 7)
 *
 * Architecture:
 *   OSM data → Vector tiles → MBTiles → Local storage → Map renderer
 *
 * Critical requirement: After map data is installed, map rendering
 * must work with the network completely disabled.
 */

// Re-export map-related types for convenience
export type {
  BoundingBox,
  TileCoordinate,
  MapTile,
  POI,
  MapDisplayConfig,
  MapViewState,
} from '@navic/shared-models';

export {
  POICategory,
} from '@navic/shared-models';
