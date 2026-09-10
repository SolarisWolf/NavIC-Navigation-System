import { defineConfig } from 'vite';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'vite-plugin-mbtiles',
    configureServer(server) {
      const mbtilesPath = path.resolve(__dirname, '../../data/maps/india.mbtiles');
      let db: Database.Database | null = null;
      let useFallback = false;

      if (fs.existsSync(mbtilesPath)) {
        try {
          db = new Database(mbtilesPath, { readonly: true });
          console.log(`[ViteTilePlugin] Serving local MBTiles from ${mbtilesPath}`);
        } catch (e) {
          console.warn(`[ViteTilePlugin] Failed to open ${mbtilesPath}. Falling back to online tiles.`);
          useFallback = true;
        }
      } else {
        console.warn(`[ViteTilePlugin] MBTiles file not found at ${mbtilesPath}. Falling back to online OSM tiles.`);
        useFallback = true;
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/tiles')) return next();

        const match = req.url.match(/^\/api\/tiles\/(\d+)\/(\d+)\/(\d+)/);
        if (!match) {
          res.statusCode = 400;
          return res.end('Invalid tile URL format');
        }

        const z = parseInt(match[1], 10);
        const x = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);

        if (useFallback) {
          const redirectUrl = `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`;
          res.writeHead(302, { Location: redirectUrl });
          return res.end();
        }

        if (!db) {
          res.statusCode = 500;
          return res.end('Tile reader not initialized');
        }

        try {
          // Convert XYZ to TMS
          const tmsY = (1 << z) - 1 - y;
          const stmt = db.prepare('SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?');
          const row = stmt.get(z, x, tmsY) as { tile_data: Buffer } | undefined;

          if (!row || !row.tile_data) {
            res.statusCode = 404;
            return res.end('Tile not found');
          }

          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.end(row.tile_data);
        } catch (e) {
          res.statusCode = 500;
          res.end('Error reading tile');
        }
      });
    },
    closeBundle() {
      // Nothing needed here, process exit will clean up read-only sqlite
    }
  }],
  optimizeDeps: {
    exclude: ['better-sqlite3'],
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
  }
});
