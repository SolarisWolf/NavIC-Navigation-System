import type { Plugin } from 'vite';
import { MBTilesReader } from './mbtiles-reader.js';
import * as path from 'path';
import * as fs from 'fs';

export interface ViteTilePluginOptions {
  /** Path to the .mbtiles file */
  mbtilesPath: string;
  /** API prefix for tile requests. Default: '/api/tiles' */
  apiPrefix?: string;
  /** Online fallback URL if MBTiles file is missing. Default: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' */
  fallbackUrl?: string;
}

export function viteTilePlugin(options: ViteTilePluginOptions): Plugin {
  const apiPrefix = options.apiPrefix || '/api/tiles';
  let reader: MBTilesReader | null = null;
  let useFallback = false;

  return {
    name: 'vite-plugin-mbtiles',
    
    configureServer(server) {
      // Check if MBTiles file exists
      if (fs.existsSync(options.mbtilesPath)) {
        reader = new MBTilesReader(options.mbtilesPath);
        if (!reader.connect()) {
          console.warn(`[ViteTilePlugin] Failed to connect to ${options.mbtilesPath}. Falling back to online tiles.`);
          useFallback = true;
        } else {
          console.log(`[ViteTilePlugin] Serving local MBTiles from ${options.mbtilesPath}`);
        }
      } else {
        console.warn(`[ViteTilePlugin] MBTiles file not found at ${options.mbtilesPath}. Falling back to online tiles.`);
        useFallback = true;
      }

      // Add middleware to intercept tile requests
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith(apiPrefix)) {
          return next();
        }

        // Parse /api/tiles/{z}/{x}/{y} or /api/tiles/{z}/{x}/{y}.png
        const match = req.url.match(new RegExp(`^${apiPrefix}/(\\d+)/(\\d+)/(\\d+)`));
        if (!match) {
          res.statusCode = 400;
          res.end('Invalid tile URL format');
          return;
        }

        const z = parseInt(match[1], 10);
        const x = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);

        if (useFallback) {
          // If fallback is enabled, redirect to OSM
          const fallbackUrl = options.fallbackUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
          const redirectUrl = fallbackUrl
            .replace('{z}', z.toString())
            .replace('{x}', x.toString())
            .replace('{y}', y.toString())
            .replace('{s}', 'a'); // Simplification for {s}

          res.writeHead(302, { Location: redirectUrl });
          res.end();
          return;
        }

        if (!reader) {
          res.statusCode = 500;
          res.end('Tile reader not initialized');
          return;
        }

        const tileData = reader.getTile(z, x, y);
        
        if (!tileData) {
          res.statusCode = 404;
          res.end('Tile not found');
          return;
        }

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.end(tileData);
      });
    },

    closeBundle() {
      if (reader) {
        reader.disconnect();
      }
    }
  };
}
