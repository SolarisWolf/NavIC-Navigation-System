/**
 * @navic/map-core
 *
 * Map core functionality including MBTiles reading, tile serving,
 * and offline POI spatial database.
 */

export { MBTilesReader } from './mbtiles-reader.js';
export { viteTilePlugin, type ViteTilePluginOptions } from './vite-tile-plugin.js';

// POI Database
export {
  POIDatabase,
  type POISearchOptions,
  type POISearchResult,
} from './poi/index.js';
