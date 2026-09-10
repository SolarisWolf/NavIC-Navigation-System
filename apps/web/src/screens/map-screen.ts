/**
 * Map Screen
 *
 * Displays the Leaflet map with offline MBTiles support.
 * Tracks the vehicle position with high-rate (50 Hz) Extended Kalman Filter
 * sensor fusion, with support for seamless Dead Reckoning during GNSS outages.
 * Displays offline POIs, category pins, active destination radar marker,
 * multi-segment road route polyline, and turn navigation guidance banner (Phase 8).
 */

import L from 'leaflet';
import {
  type FusedPositionEstimate,
  SensorFusionMode,
  type POI,
  type Route,
  ManeuverType,
  NavigationMode,
  type NavigationState,
  formatDistance,
  formatDuration,
} from '@navic/shared-models';
import { fusionService } from '../services/fusion-service.js';
import { poiService } from '../services/poi-service.js';
import { routingService } from '../services/routing-service.js';
import { navigationService } from '../services/navigation-service.js';
import { CATEGORY_ICONS, CATEGORY_LABELS, MANEUVER_ICONS } from './route-screen.js';

let map: L.Map | null = null;
let vehicleMarker: L.Marker | null = null;
let pathLine: L.Polyline | null = null;
let destinationMarker: L.Marker | null = null;
let destinationLine: L.Polyline | null = null;
let routePolyline: L.Polyline | null = null;
let routeCasingPolyline: L.Polyline | null = null;
let poiLayerGroup: L.LayerGroup | null = null;
let showPois = true;

let unsubscribeFusion: (() => void) | null = null;
let unsubscribeDest: (() => void) | null = null;
let unsubscribeRoute: (() => void) | null = null;
let unsubscribeNav: (() => void) | null = null;

let isFollowing = true;
let isInitialized = false;

const MAX_PATH_POINTS = 500;
const pathCoordinates: L.LatLng[] = [];

// Custom vehicle icons for Fused (Green) vs Dead Reckoning (Amber)
function getVehicleSvg(isDeadReckoning: boolean): string {
  const color = isDeadReckoning ? '#ffb300' : '#00e676';
  const stroke = isDeadReckoning ? '#ff6f00' : '#000000';
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" class="vehicle-icon">
      <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" stroke="${stroke}" stroke-width="1.5"/>
    </svg>
  `;
}

function createVehicleIcon(isDeadReckoning: boolean): L.DivIcon {
  return L.divIcon({
    html: getVehicleSvg(isDeadReckoning),
    className: 'vehicle-marker',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function createPoiIcon(poi: POI): L.DivIcon {
  const icon = CATEGORY_ICONS[poi.category] || '📍';
  return L.divIcon({
    html: `<div class="poi-map-pin">${icon}</div>`,
    className: 'poi-marker-div',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createDestinationIcon(): L.DivIcon {
  return L.divIcon({
    html: `
      <div class="destination-pulse-pin">
        <div class="pulse-ring"></div>
        <div class="pin-head">🏁</div>
      </div>
    `,
    className: 'destination-marker-div',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function formatDist(meters?: number): string {
  if (meters === undefined) return '';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function renderMapScreen(container: HTMLElement): void {
  // Clean up if already rendered
  if (unsubscribeFusion) {
    unsubscribeFusion();
    unsubscribeFusion = null;
  }
  if (unsubscribeDest) {
    unsubscribeDest();
    unsubscribeDest = null;
  }
  if (unsubscribeRoute) {
    unsubscribeRoute();
    unsubscribeRoute = null;
  }
  if (unsubscribeNav) {
    unsubscribeNav();
    unsubscribeNav = null;
  }
  if (map) {
    map.remove();
    map = null;
    isInitialized = false;
  }

  container.innerHTML = `
    <style>
      .map-screen__top-bar {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .dr-active-badge {
        background: rgba(255, 179, 0, 0.15) !important;
        border-color: #ffb300 !important;
        color: #ffb300 !important;
      }
    </style>

    <div class="map-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Map</h1>
          <p class="screen__subtitle">Offline map tracking powered by 50 Hz EKF Sensor Fusion & Offline Road Routing</p>
        </div>
        <div class="map-screen__top-bar">
          <span class="status-badge status-badge--idle" id="map-fix-badge">Awaiting Fix</span>
          <span class="status-badge status-badge--active" id="map-poi-badge">${poiService.getAll().length} POIs Loaded</span>
        </div>
      </div>

      <div class="map-container" id="map-view">
        <!-- Floating Navigation Turn Guidance Banner -->
        <div class="map-nav-banner" id="map-nav-banner" style="display: none;">
          <!-- Re-routing Banner Strip -->
          <div class="map-nav-reroute-banner" id="map-nav-reroute" style="display: none;">
            <span class="reroute-spinner">🔄</span>
            <span>RE-ROUTING — Recalculating road path...</span>
          </div>

          <!-- Off-Route Alert Strip -->
          <div class="map-nav-offroute-banner" id="map-nav-offroute" style="display: none;">
            <span>⚠️</span>
            <span>OFF ROUTE — Please return to route</span>
          </div>

          <!-- Arrival Banner -->
          <div class="map-nav-arrival-banner" id="map-nav-arrival" style="display: none;">
            <span>🎉</span>
            <span>ARRIVED AT DESTINATION! 🏁</span>
          </div>

          <!-- Main Banner Content -->
          <div class="map-nav-banner__content">
            <div class="map-nav-icon" id="map-nav-icon">🧭</div>
            <div class="map-nav-info">
              <div class="map-nav-countdown" id="map-nav-countdown">
                <span id="countdown-val">--</span>
                <span class="map-nav-countdown__unit" id="countdown-unit"></span>
              </div>
              <div class="map-nav-instruction" id="map-nav-instruction">Starting Navigation...</div>
              <div class="map-nav-next-step" id="map-nav-next-step">-- km • -- min</div>
            </div>
            <div class="map-nav-actions">
              <button class="btn btn--primary btn--sm" id="btn-start-nav-map" style="display: none;">
                🚀 Start
              </button>
              <button class="map-nav-close" id="btn-close-nav" title="Clear / Stop Navigation">✕</button>
            </div>
          </div>

          <!-- Route Progress Track -->
          <div class="map-nav-progress-track">
            <div class="map-nav-progress-fill" id="map-nav-progress-fill"></div>
          </div>
        </div>

        <!-- Bottom Trip Statistics Bar -->
        <div class="map-trip-bar" id="map-trip-bar" style="display: none;">
          <div class="trip-metric">
            <span class="trip-metric__val" id="trip-remaining-dist">-- km</span>
            <span class="trip-metric__lbl">Remaining</span>
          </div>
          <div class="trip-divider"></div>
          <div class="trip-metric">
            <span class="trip-metric__val" id="trip-remaining-time">-- min</span>
            <span class="trip-metric__lbl">Duration</span>
          </div>
          <div class="trip-divider"></div>
          <div class="trip-metric">
            <span class="trip-metric__val" id="trip-eta">--:--</span>
            <span class="trip-metric__lbl">ETA</span>
          </div>
          <div class="trip-divider"></div>
          <div class="trip-metric">
            <span class="trip-metric__val" id="trip-speed">0 km/h</span>
            <span class="trip-metric__lbl">Speed</span>
          </div>
          <button class="btn-stop-nav" id="btn-stop-nav-trip">
            ⏹️ Stop
          </button>
        </div>
      </div>

      <div class="map-controls">
        <button class="map-btn map-btn--active" id="btn-follow" title="Follow Vehicle">🎯</button>
        <button class="map-btn" id="btn-recenter" title="Recenter">⌖</button>
        <button class="map-btn map-btn--active" id="btn-toggle-pois" title="Toggle POIs">📍</button>
        <button class="map-btn" id="btn-outage" title="Simulate GNSS Outage (Test Dead Reckoning)">🚇 Outage</button>
        <button class="map-btn" id="btn-manual-reroute" title="Recalculate Route" style="display: none;">🔄 Re-route</button>
      </div>
    </div>
  `;

  // Initialize Leaflet Map
  map = L.map('map-view', {
    zoomControl: false,
    attributionControl: false,
    maxZoom: 18,
    minZoom: 3,
  }).setView([28.6139, 77.2090], 13); // Default to Delhi

  // Add Zoom Control to bottom-left
  L.control.zoom({ position: 'bottomleft' }).addTo(map);

  // Add Tile Layer targeting local MBTiles
  L.tileLayer('/api/tiles/{z}/{x}/{y}', {
    maxNativeZoom: 18,
    maxZoom: 18,
  }).addTo(map);

  // Initialize Polyline for vehicle track
  pathLine = L.polyline([], {
    color: '#00e676',
    weight: 4,
    opacity: 0.8,
  }).addTo(map);

  // Destination straight line (fallback if no road route calculated)
  destinationLine = L.polyline([], {
    color: '#4f8cff',
    dashArray: '6, 8',
    weight: 3,
    opacity: 0.85,
  }).addTo(map);

  // Road Route Polylines (Casing + Vibrant core)
  routeCasingPolyline = L.polyline([], {
    color: '#0d47a1',
    weight: 7,
    opacity: 0.85,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(map);

  routePolyline = L.polyline([], {
    color: '#00e5ff',
    weight: 4,
    opacity: 0.95,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(map);

  // Initialize POI Layer Group
  poiLayerGroup = L.layerGroup();
  populatePoiMarkers();
  poiLayerGroup.addTo(map);

  // Map interaction handlers
  map.on('dragstart', () => {
    isFollowing = false;
    updateFollowBtn();
  });

  const btnFollow = document.getElementById('btn-follow');
  const btnRecenter = document.getElementById('btn-recenter');
  const btnTogglePois = document.getElementById('btn-toggle-pois');
  const btnOutage = document.getElementById('btn-outage');
  const btnCloseNav = document.getElementById('btn-close-nav');

  btnFollow?.addEventListener('click', () => {
    isFollowing = !isFollowing;
    updateFollowBtn();
    if (isFollowing && vehicleMarker) {
      map?.panTo(vehicleMarker.getLatLng());
    }
  });

  btnRecenter?.addEventListener('click', () => {
    if (vehicleMarker) {
      map?.panTo(vehicleMarker.getLatLng());
      isFollowing = true;
      updateFollowBtn();
    }
  });

  btnTogglePois?.addEventListener('click', () => {
    if (!map || !poiLayerGroup) return;
    showPois = !showPois;
    if (showPois) {
      map.addLayer(poiLayerGroup);
      btnTogglePois.classList.add('map-btn--active');
    } else {
      map.removeLayer(poiLayerGroup);
      btnTogglePois.classList.remove('map-btn--active');
    }
  });

  btnOutage?.addEventListener('click', () => {
    fusionService.triggerGNSSOutage(5000); // 5s GNSS outage
  });

  const btnStartNavMap = document.getElementById('btn-start-nav-map');
  const btnStopNavTrip = document.getElementById('btn-stop-nav-trip');

  btnStartNavMap?.addEventListener('click', () => {
    const route = routingService.getCurrentRoute();
    if (route) {
      navigationService.startNavigation(route);
      isFollowing = true;
      updateFollowBtn();
      if (vehicleMarker) map?.panTo(vehicleMarker.getLatLng());
    }
  });

  btnStopNavTrip?.addEventListener('click', () => {
    navigationService.stopNavigation();
  });

  const btnManualReroute = document.getElementById('btn-manual-reroute');
  btnManualReroute?.addEventListener('click', async () => {
    btnManualReroute.classList.add('map-btn--active');
    await navigationService.triggerReroute(true);
    btnManualReroute.classList.remove('map-btn--active');
  });

  btnCloseNav?.addEventListener('click', () => {
    if (navigationService.isNavigating) {
      navigationService.stopNavigation();
    }
    routingService.clearRoute();
  });

  // Check initial destination & route
  updateDestinationMarker(poiService.getSelectedDestination());
  updateRouteDisplay(routingService.getCurrentRoute());

  // Subscribe to destination changes
  unsubscribeDest = poiService.onDestinationChange((dest) => {
    updateDestinationMarker(dest);
  });

  // Subscribe to calculated route changes
  unsubscribeRoute = routingService.onRoute((route) => {
    updateRouteDisplay(route);
  });

  // Subscribe to active navigation guidance updates
  unsubscribeNav = navigationService.onStateChange((state) => {
    updateNavigationUI(state);
  });

  // Subscribe to live 50 Hz Fused EKF updates
  unsubscribeFusion = fusionService.subscribe(updateMapState);
}

function updateNavigationUI(state: NavigationState): void {
  const banner = document.getElementById('map-nav-banner');
  const rerouteStrip = document.getElementById('map-nav-reroute');
  const offRouteStrip = document.getElementById('map-nav-offroute');
  const arrivalStrip = document.getElementById('map-nav-arrival');
  const navIcon = document.getElementById('map-nav-icon');
  const countdownVal = document.getElementById('countdown-val');
  const countdownUnit = document.getElementById('countdown-unit');
  const navInstruction = document.getElementById('map-nav-instruction');
  const navNextStep = document.getElementById('map-nav-next-step');
  const startNavBtn = document.getElementById('btn-start-nav-map');
  const progressFill = document.getElementById('map-nav-progress-fill');
  const tripBar = document.getElementById('map-trip-bar');
  const btnManualReroute = document.getElementById('btn-manual-reroute');

  if (!state.route) {
    if (banner) banner.style.display = 'none';
    if (tripBar) tripBar.style.display = 'none';
    if (btnManualReroute) btnManualReroute.style.display = 'none';
    return;
  }

  if (banner) banner.style.display = 'flex';

  if (state.mode === NavigationMode.Rerouting) {
    if (rerouteStrip) rerouteStrip.style.display = 'flex';
    if (offRouteStrip) offRouteStrip.style.display = 'none';
    if (arrivalStrip) arrivalStrip.style.display = 'none';
    if (startNavBtn) startNavBtn.style.display = 'none';
    if (tripBar) tripBar.style.display = 'flex';
    if (btnManualReroute) btnManualReroute.style.display = 'inline-flex';

    if (navIcon) {
      navIcon.textContent = '🔄';
      navIcon.classList.add('map-nav-icon--immediate');
    }
    if (countdownVal && countdownUnit) {
      countdownVal.textContent = 'REROUTE';
      countdownUnit.textContent = '';
    }
    if (navInstruction) navInstruction.textContent = 'Recalculating optimal road route...';
    if (navNextStep) navNextStep.textContent = 'Updating road trajectory via offline network';
  } else if (state.mode === NavigationMode.Active) {
    if (rerouteStrip) rerouteStrip.style.display = 'none';
    if (startNavBtn) startNavBtn.style.display = 'none';
    if (tripBar) tripBar.style.display = 'flex';
    if (btnManualReroute) btnManualReroute.style.display = 'inline-flex';

    // Off-route status
    if (offRouteStrip) {
      offRouteStrip.style.display = state.isOffRoute ? 'flex' : 'none';
    }
    if (arrivalStrip) {
      arrivalStrip.style.display = 'none';
    }

    // Maneuver icon & proximity pulsing
    if (navIcon && state.nextInstruction) {
      navIcon.textContent = MANEUVER_ICONS[state.nextInstruction.maneuver] || '➡️';
      const isImmediate = state.distanceToNextManeuver !== null && state.distanceToNextManeuver <= 50;
      if (isImmediate) {
        navIcon.classList.add('map-nav-icon--immediate');
      } else {
        navIcon.classList.remove('map-nav-icon--immediate');
      }
    }

    // Countdown distance
    if (countdownVal && countdownUnit) {
      if (state.distanceToNextManeuver !== null) {
        if (state.distanceToNextManeuver <= 25) {
          countdownVal.textContent = 'NOW';
          countdownUnit.textContent = '';
        } else if (state.distanceToNextManeuver < 1000) {
          countdownVal.textContent = `${Math.round(state.distanceToNextManeuver)}`;
          countdownUnit.textContent = 'm';
        } else {
          countdownVal.textContent = `${(state.distanceToNextManeuver / 1000).toFixed(1)}`;
          countdownUnit.textContent = 'km';
        }
      } else {
        countdownVal.textContent = '--';
        countdownUnit.textContent = '';
      }
    }

    // Instruction description
    if (navInstruction && state.nextInstruction) {
      navInstruction.textContent = state.nextInstruction.description;
    }

    // Next step / road name
    if (navNextStep) {
      if (state.currentRoadName) {
        navNextStep.textContent = `On: ${state.currentRoadName}`;
      } else {
        navNextStep.textContent = `Follow route to destination`;
      }
    }

    // Progress bar fill
    if (progressFill) {
      progressFill.style.width = `${Math.round((state.progress || 0) * 100)}%`;
    }

    // Bottom Trip Bar metrics
    const tripDist = document.getElementById('trip-remaining-dist');
    const tripTime = document.getElementById('trip-remaining-time');
    const tripEta = document.getElementById('trip-eta');
    const tripSpeed = document.getElementById('trip-speed');

    if (tripDist) tripDist.textContent = formatDistance(state.remainingDistance ?? 0);
    if (tripTime) tripTime.textContent = formatDuration(state.remainingTime ?? 0);
    if (tripEta && state.eta) {
      tripEta.textContent = new Date(state.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (tripSpeed) {
      tripSpeed.textContent = `${Math.round((state.currentSpeed || 0) * 3.6)} km/h`;
    }
  } else if (state.mode === NavigationMode.Arrived) {
    if (arrivalStrip) arrivalStrip.style.display = 'flex';
    if (offRouteStrip) offRouteStrip.style.display = 'none';
    if (countdownVal) countdownVal.textContent = 'ARRIVED';
    if (countdownUnit) countdownUnit.textContent = '';
    if (navInstruction) navInstruction.textContent = 'You have reached your destination';
    if (navNextStep) navNextStep.textContent = 'Trip Completed';
    if (progressFill) progressFill.style.width = '100%';
    if (tripBar) tripBar.style.display = 'flex';
    if (startNavBtn) startNavBtn.style.display = 'none';
  } else {
    // Idle mode with calculated route: show route preview
    if (offRouteStrip) offRouteStrip.style.display = 'none';
    if (arrivalStrip) arrivalStrip.style.display = 'none';
    if (startNavBtn) startNavBtn.style.display = 'block';
    if (tripBar) tripBar.style.display = 'none';
    if (navIcon) navIcon.textContent = '🧭';
    if (countdownVal) countdownVal.textContent = `${(state.route.distance / 1000).toFixed(1)}`;
    if (countdownUnit) countdownUnit.textContent = 'km';
    if (navInstruction) {
      const firstTurn = state.route.instructions.length > 1 ? state.route.instructions[1] : state.route.instructions[0];
      navInstruction.textContent = firstTurn ? firstTurn.description : 'Route Calculated';
    }
    if (navNextStep) {
      const mins = Math.round(state.route.estimatedTime / 60);
      navNextStep.textContent = `~${mins} min (${state.route.profile.toUpperCase()}) • Ready to navigate`;
    }
    if (progressFill) progressFill.style.width = '0%';
  }
}

function updateRouteDisplay(route: Route | null): void {
  if (!route || route.geometry.length === 0) {
    if (routePolyline) routePolyline.setLatLngs([]);
    if (routeCasingPolyline) routeCasingPolyline.setLatLngs([]);
    updateNavigationUI(navigationService.getState());
    return;
  }

  // Convert geometry points to LatLng array
  const latLngs = route.geometry.map((pt) =>
    L.latLng(pt.coordinate.latitude, pt.coordinate.longitude)
  );

  if (routeCasingPolyline) routeCasingPolyline.setLatLngs(latLngs);
  if (routePolyline) routePolyline.setLatLngs(latLngs);

  // Hide straight direct dashed line when full road route is drawn
  if (destinationLine) destinationLine.setLatLngs([]);

  // Auto-fit map camera to route bounds only if not already navigating
  if (map && latLngs.length > 0 && !navigationService.isNavigating) {
    const bounds = L.latLngBounds(latLngs);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    isFollowing = false;
    updateFollowBtn();
  }

  // Update UI with current navigation state
  updateNavigationUI(navigationService.getState());
}

function populatePoiMarkers(): void {
  if (!poiLayerGroup) return;
  poiLayerGroup.clearLayers();

  const allPois = poiService.getAll();
  for (const poi of allPois) {
    const marker = L.marker([poi.latitude, poi.longitude], {
      icon: createPoiIcon(poi),
      title: poi.name,
    });

    marker.bindPopup(() => {
      const icon = CATEGORY_ICONS[poi.category] || '📍';
      const catLabel = CATEGORY_LABELS[poi.category] || poi.category;
      const vehicleCoord = poiService.getVehicleCoordinate();
      const results = poiService.search(poi.name, { center: vehicleCoord, limit: 1 });
      const distStr = results.length > 0 && results[0].distanceMeters !== undefined
        ? formatDist(results[0].distanceMeters)
        : '';
      const isCurDest = poiService.getSelectedDestination()?.id === poi.id;

      const popupDiv = document.createElement('div');
      popupDiv.className = 'poi-popup-content';
      popupDiv.innerHTML = `
        <div class="poi-popup-header">
          <span class="poi-popup-icon">${icon}</span>
          <div class="poi-popup-titles">
            <div class="poi-popup-name">${poi.name}</div>
            <div class="poi-popup-cat">${catLabel}</div>
          </div>
        </div>
        <div class="poi-popup-addr">${poi.address || 'Delhi NCR'}</div>
        <div class="poi-popup-meta">
          <span>📍 ${poi.latitude.toFixed(5)}°N, ${poi.longitude.toFixed(5)}°E</span>
          ${distStr ? `<span class="poi-popup-dist">📏 ${distStr} away</span>` : ''}
        </div>
        <div class="poi-popup-actions">
          <button class="btn btn--sm ${isCurDest ? 'btn--secondary' : 'btn--primary'}" id="btn-popup-dest-${poi.id}">
            ${isCurDest ? '✓ Current Destination' : '🎯 Set Destination'}
          </button>
          <button class="btn btn--sm btn--secondary" id="btn-popup-route-${poi.id}">
            🧭 Plan Route
          </button>
        </div>
      `;

      // Attach button event handlers
      setTimeout(() => {
        const setDestBtn = document.getElementById(`btn-popup-dest-${poi.id}`);
        const routeBtn = document.getElementById(`btn-popup-route-${poi.id}`);

        setDestBtn?.addEventListener('click', async () => {
          poiService.setDestination(poi);
          marker.closePopup();
          // Auto-calculate route
          await routingService.calculateRoute();
        });

        routeBtn?.addEventListener('click', async () => {
          poiService.setDestination(poi);
          window.location.hash = '#/route';
        });
      }, 50);

      return popupDiv;
    });

    poiLayerGroup.addLayer(marker);
  }
}

function updateDestinationMarker(dest: POI | null): void {
  if (!map) return;

  if (!dest) {
    if (destinationMarker) {
      map.removeLayer(destinationMarker);
      destinationMarker = null;
    }
    if (destinationLine) {
      destinationLine.setLatLngs([]);
    }
    return;
  }

  const destLatLng = L.latLng(dest.latitude, dest.longitude);

  if (!destinationMarker) {
    destinationMarker = L.marker(destLatLng, {
      icon: createDestinationIcon(),
      zIndexOffset: 2000,
    }).addTo(map);
  } else {
    destinationMarker.setLatLng(destLatLng);
  }

  destinationMarker.bindTooltip(`🏁 Destination: ${dest.name}`, {
    permanent: false,
    direction: 'top',
    className: 'poi-destination-tooltip',
  });

  // Update line from vehicle to destination only if road route isn't rendered
  const currentRoute = routingService.getCurrentRoute();
  if (vehicleMarker && destinationLine && (!currentRoute || currentRoute.geometry.length === 0)) {
    destinationLine.setLatLngs([vehicleMarker.getLatLng(), destLatLng]);
  }
}

function updateFollowBtn(): void {
  const btn = document.getElementById('btn-follow');
  if (btn) {
    if (isFollowing) {
      btn.classList.add('map-btn--active');
    } else {
      btn.classList.remove('map-btn--active');
    }
  }
}

let lastDrState = false;
let lastPanTime = 0;

function updateMapState(estimate: FusedPositionEstimate): void {
  if (!map) return;

  const badge = document.getElementById('map-fix-badge');
  const isDr = estimate.isDeadReckoning;
  const isInit = estimate.mode === SensorFusionMode.INITIALIZING;

  if (badge) {
    if (isInit) {
      badge.textContent = 'Initializing Fix...';
      badge.className = 'status-badge status-badge--idle';
    } else if (isDr) {
      badge.textContent = `Dead Reckoning (${estimate.deadReckoningDurationSec.toFixed(1)}s)`;
      badge.className = 'status-badge dr-active-badge';
    } else {
      badge.textContent = `EKF Fused (50 Hz, ±${estimate.accuracy.toFixed(1)}m)`;
      badge.className = 'status-badge status-badge--active';
    }
  }

  const { latitude, longitude } = estimate.coordinate;
  if (latitude === 0 || longitude === 0) return;

  let displayLat = latitude;
  let displayLon = longitude;

  // If navigating and snapped to route without being off-route, display snapped coordinate
  if (navigationService.isNavigating) {
    const navState = navigationService.getState();
    if (!navState.isOffRoute && navState.matchedPosition) {
      displayLat = navState.matchedPosition.latitude;
      displayLon = navState.matchedPosition.longitude;
    }
  }

  const latLng = L.latLng(displayLat, displayLon);

  // Initialize or update marker
  if (!vehicleMarker) {
    vehicleMarker = L.marker(latLng, {
      icon: createVehicleIcon(isDr),
      zIndexOffset: 1000,
    }).addTo(map);
    lastDrState = isDr;
  } else {
    // If dead reckoning mode changed, swap icon color
    if (isDr !== lastDrState) {
      vehicleMarker.setIcon(createVehicleIcon(isDr));
      lastDrState = isDr;
    }
    vehicleMarker.setLatLng(latLng);
  }

  // Rotate vehicle icon smoothly
  const iconEl = vehicleMarker.getElement()?.querySelector('svg');
  if (iconEl) {
    iconEl.style.transform = `rotate(${estimate.bearing}deg)`;
  }

  // First time camera center
  if (!isInitialized) {
    map.setView(latLng, 14);
    isInitialized = true;
    lastPanTime = Date.now();
  } else if (isFollowing) {
    // Throttle panTo to avoid overloading Leaflet render loop at 50 Hz
    const now = Date.now();
    if (now - lastPanTime > 300) {
      map.panTo(latLng, { animate: true, duration: 0.3 });
      lastPanTime = now;
    }
  }

  // Update track
  pathCoordinates.push(latLng);
  if (pathCoordinates.length > MAX_PATH_POINTS) {
    pathCoordinates.shift();
  }
  pathLine?.setLatLngs(pathCoordinates);

  // Update direct line to destination if active and no road route is computed
  const curDest = poiService.getSelectedDestination();
  const currentRoute = routingService.getCurrentRoute();
  if (curDest && destinationLine && (!currentRoute || currentRoute.geometry.length === 0)) {
    destinationLine.setLatLngs([latLng, L.latLng(curDest.latitude, curDest.longitude)]);
  }
}
