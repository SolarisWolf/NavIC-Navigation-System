/**
 * NavIC Navigation — Standalone Offline Service Worker
 *
 * Implements 100% offline self-containment:
 * - Pre-caches application shell (HTML, CSS, JS bundles)
 * - Cache-first with background revalidation for local MBTiles tiles (/api/tiles/*)
 * - Transparent offline tile fallback for un-cached coordinates
 * - Cache audit and storage quota messaging for diagnostics
 */

const SHELL_CACHE_NAME = 'navic-shell-v1';
const TILES_CACHE_NAME = 'navic-tiles-v1';

const PRECACHE_URLS = [
  '/',
  '/index.html',
];

// ─── 1. Install Phase ────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Pre-cache non-fatal warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ─── 2. Activate Phase ───────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== SHELL_CACHE_NAME && key !== TILES_CACHE_NAME) {
            console.log('[SW] Evicting deprecated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── 3. Fetch Interception & Offline Strategies ──────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy A: Map Tile Requests (/api/tiles/*, OSM, CartoDB) — Cache-First with Network Fallback
  const isTileRequest =
    url.pathname.startsWith('/api/tiles/') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('cartocdn.com') ||
    url.hostname.includes('tile.osm.org');

  if (isTileRequest) {
    event.respondWith(
      caches.open(TILES_CACHE_NAME).then(async (tileCache) => {
        const cachedResponse = await tileCache.match(event.request);
        if (cachedResponse) {
          // Serve instantly from offline cache
          return cachedResponse;
        }

        try {
          // Fetch from local MBTiles server
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            // Clone & store in offline tile cache
            tileCache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // Offline & tile not in cache: Return a lightweight dark SVG placeholder tile
          return new Response(
            `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
              <rect width="256" height="256" fill="#0f172a" />
              <path d="M0 0h256v256H0z" fill="none" stroke="#1e293b" stroke-width="1" />
              <text x="128" y="132" fill="#334155" font-family="sans-serif" font-size="11" text-anchor="middle">Offline Tile</text>
            </svg>`,
            {
              headers: { 'Content-Type': 'image/svg+xml' },
              status: 200,
            }
          );
        }
      })
    );
    return;
  }

  // Strategy B: App Shell & Assets — Stale-While-Revalidate / Network-First with Cache Fallback
  if (event.request.method === 'GET' && (url.origin === self.location.origin || url.hostname.includes('fonts.'))) {
    event.respondWith(
      caches.open(SHELL_CACHE_NAME).then(async (shellCache) => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            shellCache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          // Network failed — fallback to cached asset
          const cachedResponse = await shellCache.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // If navigation request fails, return cached index.html
          if (event.request.mode === 'navigate') {
            const indexResponse = await shellCache.match('/index.html');
            if (indexResponse) return indexResponse;
          }

          throw err;
        }
      })
    );
  }
});

// ─── 4. Client Communication (Cache Diagnostics & Audit) ───────────────────
self.addEventListener('message', async (event) => {
  const { type } = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (type === 'GET_CACHE_STATS') {
    try {
      const shellCache = await caches.open(SHELL_CACHE_NAME);
      const tilesCache = await caches.open(TILES_CACHE_NAME);

      const shellKeys = await shellCache.keys();
      const tileKeys = await tilesCache.keys();

      let storageEstimate: StorageEstimate | null = null;
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        storageEstimate = await navigator.storage.estimate();
      }

      event.ports[0]?.postMessage({
        status: 'ok',
        shellCount: shellKeys.length,
        tilesCount: tileKeys.length,
        storageEstimate,
      });
    } catch (err) {
      event.ports[0]?.postMessage({
        status: 'error',
        error: String(err),
      });
    }
  }

  if (type === 'CLEAR_CACHES') {
    try {
      await caches.delete(SHELL_CACHE_NAME);
      await caches.delete(TILES_CACHE_NAME);
      event.ports[0]?.postMessage({ status: 'ok' });
    } catch (err) {
      event.ports[0]?.postMessage({ status: 'error', error: String(err) });
    }
  }
});
