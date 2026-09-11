/**
 * Download & Package Offline Bengaluru Map Tiles
 *
 * Downloads OpenStreetMap tiles covering Greater Bengaluru (Lat: 12.88 to 13.04, Lon: 77.52 to 77.67)
 * for zoom levels 11 through 15 into apps/web/public/tiles/{z}/{x}/{y}.png.
 */

import fs from 'fs';
import path from 'path';

function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
}

const BBOX = {
  minLat: 12.89,
  maxLat: 13.03,
  minLon: 77.53,
  maxLon: 77.66,
};

const ZOOM_LEVELS = [11, 12, 13, 14, 15];

const PUBLIC_TILES_DIR = path.resolve('apps/web/public/tiles');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTileWithRetry(z, x, y, retries = 3) {
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'NavIC-Navigation-Offline-Packager/1.0 (contact@navic.org)',
        },
      });
      if (res.ok) {
        return await res.arrayBuffer();
      }
      if (res.status === 429) {
        await sleep(1000 * attempt);
      }
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(500 * attempt);
    }
  }
  return null;
}

async function main() {
  console.log('--- Starting Offline Bengaluru Tiles Download ---');
  let totalSaved = 0;
  let totalSkipped = 0;

  for (const z of ZOOM_LEVELS) {
    const minX = lon2tile(BBOX.minLon, z);
    const maxX = lon2tile(BBOX.maxLon, z);
    const minY = lat2tile(BBOX.maxLat, z);
    const maxY = lat2tile(BBOX.minLat, z);

    console.log(`Zoom ${z}: X: ${minX}..${maxX}, Y: ${minY}..${maxY} (Total: ${(maxX - minX + 1) * (maxY - minY + 1)} tiles)`);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const outDir = path.join(PUBLIC_TILES_DIR, String(z), String(x));
        const outFile = path.join(outDir, `${y}.png`);

        if (fs.existsSync(outFile) && fs.statSync(outFile).size > 500) {
          totalSkipped++;
          continue;
        }

        fs.mkdirSync(outDir, { recursive: true });
        try {
          const buf = await fetchTileWithRetry(z, x, y);
          if (buf && buf.byteLength > 200) {
            fs.writeFileSync(outFile, Buffer.from(buf));
            totalSaved++;
          }
          await sleep(50);
        } catch (err) {
          console.warn(`Failed tile ${z}/${x}/${y}:`, err.message);
        }
      }
    }
  }

  console.log(`Finished: ${totalSaved} new tiles downloaded, ${totalSkipped} already cached.`);
}

main().catch(console.error);
