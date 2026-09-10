/**
 * Map Screen
 *
 * Full-size map view container. Shows a grid placeholder with crosshair
 * until offline MBTiles maps are loaded in Phase 6.
 */

export function renderMapScreen(container: HTMLElement): void {
  container.innerHTML = `
    <div class="map-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Map</h1>
          <p class="screen__subtitle">Offline map viewer — OpenStreetMap + MBTiles</p>
        </div>
      </div>

      <div class="map-container">
        <!-- Grid pattern background -->
        <div class="map-container__grid"></div>

        <!-- Center crosshair -->
        <div class="map-container__crosshair">
          <div class="map-container__crosshair-dot"></div>
        </div>

        <!-- Placeholder content -->
        <div class="map-container__placeholder">
          <div class="map-container__placeholder-icon">🗺️</div>
          <div class="map-container__placeholder-title">Offline Maps</div>
          <p class="map-container__placeholder-text">
            Map rendering will be available in Phase 6.
            MBTiles data from OpenStreetMap will be rendered locally with no network dependency.
          </p>
        </div>

        <!-- Zoom controls (disabled) -->
        <div class="map-controls">
          <button class="map-controls__btn" disabled title="Zoom in">+</button>
          <button class="map-controls__btn" disabled title="Zoom out">−</button>
          <button class="map-controls__btn" disabled title="My location">◎</button>
          <button class="map-controls__btn" disabled title="North up">↑</button>
        </div>

        <!-- Coordinate display -->
        <div class="map-coords">
          <span>Lat: --.------</span>
          <span>Lon: --.------</span>
          <span>Zoom: --</span>
        </div>
      </div>
    </div>
  `;
}
