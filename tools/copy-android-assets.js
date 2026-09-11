/**
 * Android Asset Bundling Tool
 *
 * Copies compiled web client assets, offline MBTiles map database,
 * and Delhi POI spatial data into Android app assets directory.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const WEB_DIST_DIR = path.resolve(ROOT_DIR, 'apps/web/dist');
const ANDROID_ASSETS_DIR = path.resolve(ROOT_DIR, 'apps/android/app/src/main/assets');
const TARGET_WEB_DIR = path.resolve(ANDROID_ASSETS_DIR, 'web');
const TARGET_MAPS_DIR = path.resolve(ANDROID_ASSETS_DIR, 'maps');
const TARGET_POI_DIR = path.resolve(ANDROID_ASSETS_DIR, 'poi');

const SOURCE_MAP_FILE = path.resolve(ROOT_DIR, 'data/maps/india.mbtiles');
const SOURCE_POI_FILE = path.resolve(ROOT_DIR, 'data/poi/delhi-poi.json');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

console.log('[AndroidAssets] Syncing assets for Android packaging...');

// 1. Copy Web Dist
if (fs.existsSync(WEB_DIST_DIR)) {
  if (fs.existsSync(TARGET_WEB_DIR)) {
    fs.rmSync(TARGET_WEB_DIR, { recursive: true, force: true });
  }
  copyRecursive(WEB_DIST_DIR, TARGET_WEB_DIR);
  console.log(`[AndroidAssets] Copied web client from ${WEB_DIST_DIR} -> ${TARGET_WEB_DIR}`);
} else {
  console.warn(`[AndroidAssets] Warning: apps/web/dist not found. Run 'npm run build --workspace=@navic/web' first.`);
}

// 2. Copy POI Data
if (fs.existsSync(SOURCE_POI_FILE)) {
  if (!fs.existsSync(TARGET_POI_DIR)) fs.mkdirSync(TARGET_POI_DIR, { recursive: true });
  fs.copyFileSync(SOURCE_POI_FILE, path.join(TARGET_POI_DIR, 'delhi-poi.json'));
  
  const allPoi = path.resolve(ROOT_DIR, 'data/poi/all-india-poi.json');
  if (fs.existsSync(allPoi)) {
    fs.copyFileSync(allPoi, path.join(TARGET_POI_DIR, 'all-india-poi.json'));
  }
  const blrPoi = path.resolve(ROOT_DIR, 'data/poi/bangalore-poi.json');
  if (fs.existsSync(blrPoi)) {
    fs.copyFileSync(blrPoi, path.join(TARGET_POI_DIR, 'bangalore-poi.json'));
  }
  console.log(`[AndroidAssets] Copied POI databases to ${TARGET_POI_DIR}`);
}

// 3. Setup Maps Directory
if (!fs.existsSync(TARGET_MAPS_DIR)) {
  fs.mkdirSync(TARGET_MAPS_DIR, { recursive: true });
}
if (fs.existsSync(SOURCE_MAP_FILE)) {
  const targetMap = path.join(TARGET_MAPS_DIR, 'india.mbtiles');
  if (!fs.existsSync(targetMap)) {
    fs.copyFileSync(SOURCE_MAP_FILE, targetMap);
    console.log(`[AndroidAssets] Copied local MBTiles database to ${targetMap}`);
  }
}

console.log('[AndroidAssets] Asset bundling complete.');
