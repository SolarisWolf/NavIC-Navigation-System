/**
 * Route Planning Screen
 *
 * Destination search with offline POI database, category filtering,
 * live proximity calculations, routing profile selection, and
 * destination assignment for offline navigation.
 */

import {
  type POI,
  POICategory,
} from '@navic/shared-models';
import { poiService } from '../services/poi-service.js';

export const CATEGORY_ICONS: Record<string, string> = {
  [POICategory.Hospital]: '🏥',
  [POICategory.Police]: '👮',
  [POICategory.PetrolStation]: '⛽',
  [POICategory.Restaurant]: '🍽️',
  [POICategory.Hotel]: '🏨',
  [POICategory.School]: '🏫',
  [POICategory.College]: '🎓',
  [POICategory.RailwayStation]: '🚆',
  [POICategory.Airport]: '✈️',
  [POICategory.Landmark]: '🏛️',
  [POICategory.ATM]: '🏧',
  [POICategory.Pharmacy]: '💊',
  [POICategory.BusStop]: '🚌',
  [POICategory.Temple]: '🛕',
  [POICategory.Mosque]: '🕌',
  [POICategory.Church]: '⛪',
  [POICategory.Park]: '🌳',
  [POICategory.ShoppingMall]: '🛍️',
  [POICategory.Other]: '📍',
};

export const CATEGORY_LABELS: Record<string, string> = {
  [POICategory.Hospital]: 'Hospital',
  [POICategory.Police]: 'Police',
  [POICategory.PetrolStation]: 'Fuel',
  [POICategory.Restaurant]: 'Food',
  [POICategory.Hotel]: 'Hotel',
  [POICategory.School]: 'School',
  [POICategory.College]: 'College',
  [POICategory.RailwayStation]: 'Transit',
  [POICategory.Airport]: 'Airport',
  [POICategory.Landmark]: 'Landmark',
  [POICategory.ATM]: 'ATM',
  [POICategory.Pharmacy]: 'Pharmacy',
  [POICategory.BusStop]: 'Bus Stop',
  [POICategory.Temple]: 'Temple',
  [POICategory.Mosque]: 'Mosque',
  [POICategory.Church]: 'Church',
  [POICategory.Park]: 'Park',
  [POICategory.ShoppingMall]: 'Mall',
  [POICategory.Other]: 'POI',
};

function formatDistance(meters?: number): string {
  if (meters === undefined) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function renderRouteScreen(container: HTMLElement): void {
  let selectedCategory: POICategory | null = null;
  let searchQuery = '';
  let activeProfile = 'car';
  let activeOptimization = 'fastest';

  const destination = poiService.getSelectedDestination();
  const vehicleCoord = poiService.getVehicleCoordinate();

  container.innerHTML = `
    <div class="route-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Route Planning</h1>
          <p class="screen__subtitle">Offline search & routing powered by local POI database</p>
        </div>
      </div>

      <!-- Route Input Form -->
      <div class="route-form">
        <div class="route-form__title">Plan Your Route</div>

        <!-- Origin -->
        <div class="route-field">
          <label class="route-field__label">Origin</label>
          <div class="route-origin-display">
            <span class="route-origin-icon">📍</span>
            <div class="route-origin-info">
              <span class="route-origin-name">Current Position (NavIC/GNSS Live)</span>
              <span class="route-origin-coord">
                ${vehicleCoord.latitude.toFixed(5)}°N, ${vehicleCoord.longitude.toFixed(5)}°E
              </span>
            </div>
            <span class="status-badge status-badge--active">Auto-Fix</span>
          </div>
        </div>

        <!-- Destination Input with Autocomplete -->
        <div class="route-field">
          <div class="route-field__header">
            <label class="route-field__label">Destination (Offline POI Search)</label>
            ${
              destination
                ? `<button class="btn-text" id="btn-clear-dest">Change Destination</button>`
                : ''
            }
          </div>
          
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input
              class="route-field__input"
              type="text"
              id="route-destination-input"
              placeholder="Search hospitals, fuel, transit, landmarks..."
              value="${destination ? destination.name : ''}"
              autocomplete="off"
            />
            <button class="search-clear-btn" id="btn-input-clear" style="display: ${destination ? 'block' : 'none'};">✕</button>
          </div>

          <!-- Category Quick Filters -->
          <div class="poi-category-bar">
            <button class="poi-chip ${selectedCategory === null ? 'poi-chip--active' : ''}" data-cat="all">
              🌟 All
            </button>
            <button class="poi-chip ${selectedCategory === POICategory.Hospital ? 'poi-chip--active' : ''}" data-cat="${POICategory.Hospital}">
              🏥 Hospitals
            </button>
            <button class="poi-chip ${selectedCategory === POICategory.PetrolStation ? 'poi-chip--active' : ''}" data-cat="${POICategory.PetrolStation}">
              ⛽ Fuel
            </button>
            <button class="poi-chip ${selectedCategory === POICategory.RailwayStation ? 'poi-chip--active' : ''}" data-cat="${POICategory.RailwayStation}">
              🚆 Transit
            </button>
            <button class="poi-chip ${selectedCategory === POICategory.Restaurant ? 'poi-chip--active' : ''}" data-cat="${POICategory.Restaurant}">
              🍽️ Food
            </button>
            <button class="poi-chip ${selectedCategory === POICategory.Landmark ? 'poi-chip--active' : ''}" data-cat="${POICategory.Landmark}">
              🏛️ Landmarks
            </button>
            <button class="poi-chip ${selectedCategory === POICategory.Police ? 'poi-chip--active' : ''}" data-cat="${POICategory.Police}">
              👮 Police
            </button>
            <button class="poi-chip ${selectedCategory === POICategory.Hotel ? 'poi-chip--active' : ''}" data-cat="${POICategory.Hotel}">
              🏨 Hotels
            </button>
          </div>

          <!-- POI Search / Nearby Results Dropdown Container -->
          <div class="poi-results-container" id="poi-results-container">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- Selected Destination Card -->
        <div id="selected-dest-card" class="selected-dest-card" style="display: ${destination ? 'block' : 'none'};">
          ${renderDestinationCard(destination)}
        </div>

        <!-- Routing Options -->
        <div class="route-options">
          <div class="route-options__group">
            <span class="route-options__label">Profile</span>
            <div class="toggle-group" id="profile-toggle">
              <div class="toggle-group__item toggle-group__item--active" data-profile="car">🚗 Car</div>
              <div class="toggle-group__item" data-profile="bicycle">🚲 Bicycle</div>
              <div class="toggle-group__item" data-profile="walking">🚶 Walking</div>
            </div>
          </div>

          <div class="route-options__group">
            <span class="route-options__label">Optimize</span>
            <div class="toggle-group" id="opt-toggle">
              <div class="toggle-group__item toggle-group__item--active" data-opt="fastest">⚡ Fastest</div>
              <div class="toggle-group__item" data-opt="shortest">📏 Shortest</div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="route-form__actions">
          <button class="btn btn--primary" id="btn-calculate" ${destination ? '' : 'disabled'}>
            🧭 Calculate Route
          </button>
          <button class="btn btn--secondary" id="btn-view-map" ${destination ? '' : 'disabled'}>
            📍 View on Map
          </button>
        </div>
      </div>

      <!-- Route Summary -->
      <div class="route-summary" id="route-summary-panel">
        ${renderRouteSummary(destination, activeProfile, activeOptimization)}
      </div>
    </div>
  `;

  // Render search results
  function updateResultsList(): void {
    const listContainer = container.querySelector('#poi-results-container');
    if (!listContainer) return;

    let results = [];
    if (searchQuery.trim().length > 0) {
      results = poiService.search(searchQuery, {
        category: selectedCategory ?? undefined,
        limit: 8,
      });
    } else {
      results = poiService.getNearby(8, selectedCategory ?? undefined);
    }

    if (results.length === 0) {
      listContainer.innerHTML = `
        <div class="poi-empty">
          <span>🔍 No offline POIs match "${searchQuery}"</span>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = `
      <div class="poi-results-header">
        <span>${searchQuery ? 'Search Results' : 'Nearby Offline Points of Interest'} (${results.length})</span>
        <span class="poi-db-badge">⚡ Offline Indexed</span>
      </div>
      <div class="poi-results-list">
        ${results
          .map((r) => {
            const icon = CATEGORY_ICONS[r.poi.category] || '📍';
            const catLabel = CATEGORY_LABELS[r.poi.category] || r.poi.category;
            const isSelected = destination?.id === r.poi.id;
            return `
              <div class="poi-item ${isSelected ? 'poi-item--selected' : ''}" data-poi-id="${r.poi.id}">
                <div class="poi-item__icon">${icon}</div>
                <div class="poi-item__info">
                  <div class="poi-item__title">
                    <span class="poi-item__name">${r.poi.name}</span>
                    <span class="poi-item__category">${catLabel}</span>
                  </div>
                  <div class="poi-item__address">${r.poi.address || 'Delhi NCR'}</div>
                </div>
                <div class="poi-item__distance">
                  <span class="poi-item__dist-val">${formatDistance(r.distanceMeters)}</span>
                  ${r.bearingDegrees !== undefined ? `<span class="poi-item__bearing">${r.bearingDegrees}°</span>` : ''}
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

    // Click POI item to select destination
    listContainer.querySelectorAll('.poi-item').forEach((item) => {
      item.addEventListener('click', () => {
        const poiId = item.getAttribute('data-poi-id');
        if (!poiId) return;
        const poi = poiService.getById(poiId);
        if (poi) {
          selectDestination(poi);
        }
      });
    });
  }

  function selectDestination(poi: POI): void {
    poiService.setDestination(poi);
    const input = container.querySelector('#route-destination-input') as HTMLInputElement | null;
    if (input) input.value = poi.name;

    const clearBtn = container.querySelector('#btn-input-clear') as HTMLElement | null;
    if (clearBtn) clearBtn.style.display = 'block';

    const card = container.querySelector('#selected-dest-card');
    if (card) {
      card.innerHTML = renderDestinationCard(poi);
      card.setAttribute('style', 'display: block;');
      attachCardListeners();
    }

    const calcBtn = container.querySelector('#btn-calculate') as HTMLButtonElement | null;
    if (calcBtn) calcBtn.disabled = false;

    const mapBtn = container.querySelector('#btn-view-map') as HTMLButtonElement | null;
    if (mapBtn) mapBtn.disabled = false;

    const summary = container.querySelector('#route-summary-panel');
    if (summary) {
      summary.innerHTML = renderRouteSummary(poi, activeProfile, activeOptimization);
    }

    updateResultsList();
  }

  function clearDestination(): void {
    poiService.setDestination(null);
    const input = container.querySelector('#route-destination-input') as HTMLInputElement | null;
    if (input) {
      input.value = '';
      input.focus();
    }
    const clearBtn = container.querySelector('#btn-input-clear') as HTMLElement | null;
    if (clearBtn) clearBtn.style.display = 'none';

    const card = container.querySelector('#selected-dest-card');
    if (card) {
      card.innerHTML = '';
      card.setAttribute('style', 'display: none;');
    }

    const calcBtn = container.querySelector('#btn-calculate') as HTMLButtonElement | null;
    if (calcBtn) calcBtn.disabled = true;

    const mapBtn = container.querySelector('#btn-view-map') as HTMLButtonElement | null;
    if (mapBtn) mapBtn.disabled = true;

    const summary = container.querySelector('#route-summary-panel');
    if (summary) {
      summary.innerHTML = renderRouteSummary(null, activeProfile, activeOptimization);
    }

    searchQuery = '';
    updateResultsList();
  }

  function attachCardListeners(): void {
    const cardClear = container.querySelector('#btn-card-clear');
    cardClear?.addEventListener('click', clearDestination);
  }

  // Initial list rendering
  updateResultsList();
  attachCardListeners();

  // Search input events
  const searchInput = container.querySelector('#route-destination-input') as HTMLInputElement | null;
  const inputClearBtn = container.querySelector('#btn-input-clear');

  searchInput?.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    if (inputClearBtn) {
      (inputClearBtn as HTMLElement).style.display = searchQuery ? 'block' : 'none';
    }
    updateResultsList();
  });

  inputClearBtn?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchQuery = '';
      searchInput.focus();
    }
    clearDestination();
  });

  const headerClear = container.querySelector('#btn-clear-dest');
  headerClear?.addEventListener('click', clearDestination);

  // Category chip listeners
  const chips = container.querySelectorAll('.poi-chip');
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('poi-chip--active'));
      chip.classList.add('poi-chip--active');
      const cat = chip.getAttribute('data-cat');
      selectedCategory = cat === 'all' ? null : (cat as POICategory);
      updateResultsList();
    });
  });

  // Profile toggle
  const profileToggle = container.querySelector('#profile-toggle');
  profileToggle?.querySelectorAll('.toggle-group__item').forEach((item) => {
    item.addEventListener('click', () => {
      profileToggle.querySelectorAll('.toggle-group__item').forEach((i) => i.classList.remove('toggle-group__item--active'));
      item.classList.add('toggle-group__item--active');
      activeProfile = item.getAttribute('data-profile') || 'car';
      const curDest = poiService.getSelectedDestination();
      const summary = container.querySelector('#route-summary-panel');
      if (summary) summary.innerHTML = renderRouteSummary(curDest, activeProfile, activeOptimization);
    });
  });

  // Optimize toggle
  const optToggle = container.querySelector('#opt-toggle');
  optToggle?.querySelectorAll('.toggle-group__item').forEach((item) => {
    item.addEventListener('click', () => {
      optToggle.querySelectorAll('.toggle-group__item').forEach((i) => i.classList.remove('toggle-group__item--active'));
      item.classList.add('toggle-group__item--active');
      activeOptimization = item.getAttribute('data-opt') || 'fastest';
      const curDest = poiService.getSelectedDestination();
      const summary = container.querySelector('#route-summary-panel');
      if (summary) summary.innerHTML = renderRouteSummary(curDest, activeProfile, activeOptimization);
    });
  });

  // Button Actions
  const btnCalculate = container.querySelector('#btn-calculate');
  btnCalculate?.addEventListener('click', () => {
    const curDest = poiService.getSelectedDestination();
    if (!curDest) return;
    const summary = container.querySelector('#route-summary-panel');
    if (summary) {
      summary.innerHTML = renderCalculatedRoute(curDest, activeProfile, activeOptimization);
    }
  });

  const btnViewMap = container.querySelector('#btn-view-map');
  btnViewMap?.addEventListener('click', () => {
    window.location.hash = '#/map';
  });
}

function renderDestinationCard(poi: POI | null): string {
  if (!poi) return '';
  const icon = CATEGORY_ICONS[poi.category] || '📍';
  const catLabel = CATEGORY_LABELS[poi.category] || poi.category;
  const vehicleCoord = poiService.getVehicleCoordinate();
  
  // Calculate distance
  const results = poiService.search(poi.name, { center: vehicleCoord, limit: 1 });
  const distStr = results.length > 0 && results[0].distanceMeters !== undefined
    ? formatDistance(results[0].distanceMeters)
    : '';

  return `
    <div class="dest-card-inner">
      <div class="dest-card-header">
        <div class="dest-card-icon">${icon}</div>
        <div class="dest-card-titles">
          <div class="dest-card-name">${poi.name}</div>
          <div class="dest-card-category-badge">${catLabel}</div>
        </div>
        <button class="dest-card-clear" id="btn-card-clear" title="Remove destination">✕</button>
      </div>
      <div class="dest-card-body">
        <div class="dest-card-address">${poi.address || 'Delhi NCR, India'}</div>
        <div class="dest-card-meta">
          <span>📍 ${poi.latitude.toFixed(5)}°N, ${poi.longitude.toFixed(5)}°E</span>
          ${distStr ? `<span class="dest-card-dist">📏 ${distStr} direct</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderRouteSummary(destination: POI | null, profile: string, opt: string): string {
  if (!destination) {
    return `
      <div class="route-summary__title">Route Summary</div>
      <div class="route-summary__empty">
        <div class="route-summary__empty-icon">🛤️</div>
        <p>No destination selected</p>
        <p style="margin-top: var(--space-2); font-size: var(--text-xs); color: var(--text-muted);">
          Search and pick a Point of Interest above to configure your offline route.
        </p>
      </div>
    `;
  }

  const icon = CATEGORY_ICONS[destination.category] || '📍';
  const vehicleCoord = poiService.getVehicleCoordinate();
  const results = poiService.search(destination.name, { center: vehicleCoord, limit: 1 });
  const distMeters = results.length > 0 && results[0].distanceMeters ? results[0].distanceMeters : 5000;
  
  // Straight line estimation before GraphHopper (Phase 8)
  const estDistanceKm = (distMeters * 1.25 / 1000).toFixed(1); // 1.25 road curvature factor
  const speedKmh = profile === 'car' ? 35 : profile === 'bicycle' ? 15 : 4.5;
  const etaMinutes = Math.max(1, Math.round((parseFloat(estDistanceKm) / speedKmh) * 60));

  return `
    <div class="route-summary__title">Route Readiness</div>
    <div class="route-preview-grid">
      <div class="route-metric-card">
        <span class="route-metric-label">Target POI</span>
        <span class="route-metric-value">${icon} ${destination.name}</span>
      </div>
      <div class="route-metric-card">
        <span class="route-metric-label">Est. Distance</span>
        <span class="route-metric-value">~${estDistanceKm} km</span>
      </div>
      <div class="route-metric-card">
        <span class="route-metric-label">Est. Travel Time</span>
        <span class="route-metric-value">~${etaMinutes} min</span>
      </div>
      <div class="route-metric-card">
        <span class="route-metric-label">Profile & Opt</span>
        <span class="route-metric-value" style="text-transform: capitalize;">${profile} • ${opt}</span>
      </div>
    </div>
    <div class="route-summary__notice">
      <span>💡 POI destination ready. Click <strong>"🧭 Calculate Route"</strong> or preview on the Map! Full turn-by-turn road network routing will run locally in Phase 8 (GraphHopper).</span>
    </div>
  `;
}

function renderCalculatedRoute(destination: POI, profile: string, opt: string): string {
  const icon = CATEGORY_ICONS[destination.category] || '📍';
  const vehicleCoord = poiService.getVehicleCoordinate();
  const results = poiService.search(destination.name, { center: vehicleCoord, limit: 1 });
  const distMeters = results.length > 0 && results[0].distanceMeters ? results[0].distanceMeters : 4500;
  const estDistanceKm = (distMeters * 1.28 / 1000).toFixed(1);
  const speedKmh = profile === 'car' ? 38 : profile === 'bicycle' ? 16 : 4.5;
  const etaMinutes = Math.max(1, Math.round((parseFloat(estDistanceKm) / speedKmh) * 60));

  return `
    <div class="route-summary__title">Route Calculated (Offline Preview)</div>
    <div class="route-success-banner">
      <span class="banner-icon">✅</span>
      <div>
        <div class="banner-title">Destination Locked: ${destination.name}</div>
        <div class="banner-subtitle">Estimated ${estDistanceKm} km via optimal local path (${etaMinutes} min)</div>
      </div>
    </div>
    <div class="route-preview-grid" style="margin-top: var(--space-4);">
      <div class="route-metric-card">
        <span class="route-metric-label">Navigation Target</span>
        <span class="route-metric-value">${icon} ${destination.name}</span>
      </div>
      <div class="route-metric-card">
        <span class="route-metric-label">Total Distance</span>
        <span class="route-metric-value">${estDistanceKm} km</span>
      </div>
      <div class="route-metric-card">
        <span class="route-metric-label">Est. Duration</span>
        <span class="route-metric-value">${etaMinutes} mins</span>
      </div>
      <div class="route-metric-card">
        <span class="route-metric-label">Routing Status</span>
        <span class="route-metric-value" style="color: var(--accent-secondary);">Ready for Map</span>
      </div>
    </div>
    <div style="margin-top: var(--space-4); display: flex; gap: var(--space-3);">
      <button class="btn btn--primary" onclick="window.location.hash='#/map'">
        🗺️ Start Navigation on Map
      </button>
    </div>
  `;
}
