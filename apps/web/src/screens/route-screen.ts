/**
 * Route Planning Screen
 *
 * Destination search with offline POI database, category filtering,
 * live proximity calculations, routing profile selection, and
 * offline path calculation with turn-by-turn maneuvers (Phase 8).
 */

import {
  type POI,
  POICategory,
  type Route,
  RoutingProfile,
  RouteOptimization,
  ManeuverType,
  type NavigationInstruction,
} from '@navic/shared-models';
import { poiService } from '../services/poi-service.js';
import { routingService } from '../services/routing-service.js';
import { navigationService } from '../services/navigation-service.js';

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

export const MANEUVER_ICONS: Record<ManeuverType, string> = {
  [ManeuverType.Depart]: '🚀',
  [ManeuverType.Arrive]: '🏁',
  [ManeuverType.KeepStraight]: '⬆️',
  [ManeuverType.KeepLeft]: '↖️',
  [ManeuverType.KeepRight]: '↗️',
  [ManeuverType.TurnRight]: '➡️',
  [ManeuverType.TurnLeft]: '⬅️',
  [ManeuverType.TurnSlightRight]: '↗️',
  [ManeuverType.TurnSlightLeft]: '↖️',
  [ManeuverType.TurnSharpRight]: '↪️',
  [ManeuverType.TurnSharpLeft]: '↩️',
  [ManeuverType.UTurn]: '🔄',
  [ManeuverType.Roundabout]: '⭕',
  [ManeuverType.RoundaboutExit]: '↗️',
  [ManeuverType.Merge]: '🔀',
  [ManeuverType.ExitHighway]: '🛣️',
  [ManeuverType.Fork]: '🍴',
};

function formatDistance(meters?: number): string {
  if (meters === undefined) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours} hr ${remMins} min`;
}

export function renderRouteScreen(container: HTMLElement): void {
  let selectedCategory: POICategory | null = null;
  let searchQuery = '';
  let activeProfile: RoutingProfile = routingService.getProfile();
  let activeOptimization: RouteOptimization = routingService.getOptimization();
  let isCalculating = false;

  const destination = poiService.getSelectedDestination();
  const vehicleCoord = poiService.getVehicleCoordinate();
  const currentRoute = routingService.getCurrentRoute();

  container.innerHTML = `
    <div class="route-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Route Planning</h1>
          <p class="screen__subtitle">Offline road pathfinding & turn-by-turn routing powered by GraphHopper engine</p>
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
              <div class="toggle-group__item ${activeProfile === RoutingProfile.Car ? 'toggle-group__item--active' : ''}" data-profile="${RoutingProfile.Car}">🚗 Car</div>
              <div class="toggle-group__item ${activeProfile === RoutingProfile.Bicycle ? 'toggle-group__item--active' : ''}" data-profile="${RoutingProfile.Bicycle}">🚲 Bicycle</div>
              <div class="toggle-group__item ${activeProfile === RoutingProfile.Walking ? 'toggle-group__item--active' : ''}" data-profile="${RoutingProfile.Walking}">🚶 Walking</div>
            </div>
          </div>

          <div class="route-options__group">
            <span class="route-options__label">Optimize</span>
            <div class="toggle-group" id="opt-toggle">
              <div class="toggle-group__item ${activeOptimization === RouteOptimization.Fastest ? 'toggle-group__item--active' : ''}" data-opt="${RouteOptimization.Fastest}">⚡ Fastest</div>
              <div class="toggle-group__item ${activeOptimization === RouteOptimization.Shortest ? 'toggle-group__item--active' : ''}" data-opt="${RouteOptimization.Shortest}">📏 Shortest</div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="route-form__actions">
          <button class="btn btn--primary" id="btn-calculate" ${destination ? '' : 'disabled'}>
            🧭 Calculate Route
          </button>
          <button class="btn btn--secondary" id="btn-view-map" ${currentRoute || destination ? '' : 'disabled'}>
            📍 View on Map
          </button>
        </div>
      </div>

      <!-- Route Summary & Turn-by-Turn Maneuvers -->
      <div class="route-summary" id="route-summary-panel">
        ${renderRouteSummary(currentRoute, destination, activeProfile, activeOptimization)}
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

  async function executeRouteCalculation(): Promise<void> {
    const curDest = poiService.getSelectedDestination();
    if (!curDest || isCalculating) return;

    isCalculating = true;
    const calcBtn = container.querySelector('#btn-calculate') as HTMLButtonElement | null;
    if (calcBtn) {
      calcBtn.disabled = true;
      calcBtn.textContent = '⏳ Calculating Route...';
    }

    try {
      const route = await routingService.calculateRoute({
        profile: activeProfile,
        optimization: activeOptimization,
      });

      const summary = container.querySelector('#route-summary-panel');
      if (summary && route) {
        summary.innerHTML = renderRouteSummary(route, curDest, activeProfile, activeOptimization);
        attachSummaryListeners();
      }

      const mapBtn = container.querySelector('#btn-view-map') as HTMLButtonElement | null;
      if (mapBtn) mapBtn.disabled = false;
    } catch (e: any) {
      const summary = container.querySelector('#route-summary-panel');
      if (summary) {
        summary.innerHTML = `
          <div class="route-summary__title">Route Error</div>
          <div class="route-error-banner">
            <span>⚠️ Could not find navigable path: ${e.message}</span>
          </div>
        `;
      }
    } finally {
      isCalculating = false;
      if (calcBtn) {
        calcBtn.disabled = false;
        calcBtn.textContent = '🧭 Calculate Route';
      }
    }
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

    // Immediately trigger route calculation
    executeRouteCalculation();
    updateResultsList();
  }

  function clearDestination(): void {
    poiService.setDestination(null);
    routingService.clearRoute();

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
      summary.innerHTML = renderRouteSummary(null, null, activeProfile, activeOptimization);
    }

    searchQuery = '';
    updateResultsList();
  }

  function attachCardListeners(): void {
    const cardClear = container.querySelector('#btn-card-clear');
    cardClear?.addEventListener('click', clearDestination);
  }

  function attachSummaryListeners(): void {
    const previewMapBtn = container.querySelector('#btn-view-map-preview') || container.querySelector('#btn-start-nav');
    previewMapBtn?.addEventListener('click', () => {
      window.location.hash = '#/map';
    });

    const startNavBtn = container.querySelector('#btn-start-nav-active');
    startNavBtn?.addEventListener('click', () => {
      const route = routingService.getCurrentRoute();
      if (route) {
        navigationService.startNavigation(route);
      }
      window.location.hash = '#/map';
    });
  }

  // Initial list rendering
  updateResultsList();
  attachCardListeners();
  attachSummaryListeners();

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
      activeProfile = (item.getAttribute('data-profile') || 'car') as RoutingProfile;
      routingService.setProfile(activeProfile);
      executeRouteCalculation();
    });
  });

  // Optimize toggle
  const optToggle = container.querySelector('#opt-toggle');
  optToggle?.querySelectorAll('.toggle-group__item').forEach((item) => {
    item.addEventListener('click', () => {
      optToggle.querySelectorAll('.toggle-group__item').forEach((i) => i.classList.remove('toggle-group__item--active'));
      item.classList.add('toggle-group__item--active');
      activeOptimization = (item.getAttribute('data-opt') || 'fastest') as RouteOptimization;
      routingService.setOptimization(activeOptimization);
      executeRouteCalculation();
    });
  });

  // Button Actions
  const btnCalculate = container.querySelector('#btn-calculate');
  btnCalculate?.addEventListener('click', () => {
    executeRouteCalculation();
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
  
  // Calculate direct distance
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

function renderRouteSummary(
  route: Route | null,
  destination: POI | null,
  profile: RoutingProfile,
  opt: RouteOptimization
): string {
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

  if (!route) {
    return `
      <div class="route-summary__title">Route Readiness</div>
      <div class="route-summary__notice">
        <span>💡 Destination locked: <strong>${destination.name}</strong>. Click <strong>"🧭 Calculate Route"</strong> to generate road path and turn instructions.</span>
      </div>
    `;
  }

  const icon = CATEGORY_ICONS[destination.category] || '📍';
  const distKm = (route.distance / 1000).toFixed(1);
  const durationStr = formatDuration(route.estimatedTime);
  const turnCount = route.instructions.length;

  return `
    <div class="route-summary__title">Calculated Route Details</div>
    
    <!-- Top metrics bar -->
    <div class="route-success-banner">
      <span class="banner-icon">🛣️</span>
      <div style="flex: 1;">
        <div class="banner-title">${icon} ${destination.name}</div>
        <div class="banner-subtitle">
          ${distKm} km • ${durationStr} • ${turnCount} steps (${profile.toUpperCase()} • ${opt.toUpperCase()})
        </div>
      </div>
      <div style="display: flex; gap: var(--space-2); flex-wrap: wrap;">
        <button class="btn btn--secondary btn--sm" id="btn-view-map-preview">
          🗺️ View Map
        </button>
        <button class="btn btn--primary btn--sm" id="btn-start-nav-active">
          🚀 Start Navigation
        </button>
      </div>
    </div>

    <!-- Quick Stats Grid -->
    <div class="route-preview-grid" style="margin-top: var(--space-4);">
      <div class="route-metric-card">
        <span class="route-metric-label">Total Distance</span>
        <span class="route-metric-value">${distKm} km</span>
      </div>
      <div class="route-metric-card">
        <span class="route-metric-label">Estimated Time</span>
        <span class="route-metric-value">${durationStr}</span>
      </div>
      <div class="route-metric-card">
        <span class="route-metric-label">Maneuvers</span>
        <span class="route-metric-value">${turnCount} steps</span>
      </div>
      <div class="route-metric-card">
        <span class="route-metric-label">Routing Engine</span>
        <span class="route-metric-value" style="color: var(--accent-secondary);">Offline A* Graph</span>
      </div>
    </div>

    <!-- Turn-by-Turn Directions List -->
    <div class="route-directions-section">
      <div class="route-directions-header">Turn-by-Turn Navigation Instructions</div>
      <div class="route-instructions-list">
        ${route.instructions
          .map((step, idx) => {
            const stepIcon = MANEUVER_ICONS[step.maneuver] || '➡️';
            const distNextStr = step.distanceToNext > 0 ? formatDistance(step.distanceToNext) : '';
            return `
              <div class="instruction-item">
                <div class="instruction-item__icon">${stepIcon}</div>
                <div class="instruction-item__content">
                  <div class="instruction-item__desc">${step.description}</div>
                  <div class="instruction-item__road">${step.roadName}</div>
                </div>
                ${
                  distNextStr
                    ? `<div class="instruction-item__dist">${distNextStr}</div>`
                    : ''
                }
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
}
