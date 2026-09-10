/**
 * MBTiles Reader
 *
 * Provides fast synchronous access to an MBTiles SQLite database
 * to serve map tiles to the frontend in a local/offline context.
 */

import Database from 'better-sqlite3';
import { Logger } from '@navic/shared-models';

export class MBTilesReader {
  private db: Database.Database | null = null;
  private logger = new Logger('MBTilesReader');

  private dbPath: string;

  /**
   * Initialize the MBTiles reader.
   * @param dbPath Absolute path to the .mbtiles file
   */
  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Connect to the SQLite database.
   */
  connect(): boolean {
    if (this.db) return true;
    try {
      this.db = new Database(this.dbPath, { readonly: true, fileMustExist: true });
      this.logger.info(`Opened MBTiles database: ${this.dbPath}`);
      return true;
    } catch (e) {
      this.logger.error(`Failed to open MBTiles database at ${this.dbPath}`, e);
      return false;
    }
  }

  /**
   * Disconnect from the database.
   */
  disconnect(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.info('Closed MBTiles database');
    }
  }

  /**
   * Get a specific tile.
   * MBTiles uses TMS coordinates (origin bottom-left), while Leaflet uses XYZ (origin top-left).
   * This method assumes XYZ inputs and handles the TMS conversion internally.
   *
   * @param z Zoom level
   * @param x Tile X
   * @param y Tile Y (XYZ format)
   * @returns Buffer containing the tile image, or null if not found
   */
  getTile(z: number, x: number, y: number): Buffer | null {
    if (!this.db) {
      if (!this.connect()) return null;
    }

    try {
      // Convert XYZ to TMS (MBTiles uses TMS)
      const tmsY = (1 << z) - 1 - y;

      const stmt = this.db!.prepare('SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?');
      const row = stmt.get(z, x, tmsY) as { tile_data: Buffer } | undefined;

      return row?.tile_data || null;
    } catch (e) {
      this.logger.error(`Error querying tile z:${z} x:${x} y:${y}`, e);
      return null;
    }
  }

  /**
   * Get database metadata (e.g., name, type, version, bounds).
   */
  getMetadata(): Record<string, string> {
    if (!this.db) {
      if (!this.connect()) return {};
    }

    try {
      const stmt = this.db!.prepare('SELECT name, value FROM metadata');
      const rows = stmt.all() as { name: string; value: string }[];
      
      const meta: Record<string, string> = {};
      for (const row of rows) {
        meta[row.name] = row.value;
      }
      return meta;
    } catch (e) {
      this.logger.error('Error querying metadata', e);
      return {};
    }
  }
}
