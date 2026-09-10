/**
 * Map Screen
 *
 * Displays the Leaflet map with offline MBTiles support.
 * Tracks the vehicle position with high-rate (50 Hz) Extended Kalman Filter
 * sensor fusion, with support for seamless Dead Reckoning during GNSS outages.
 * Displays offline POIs, category pins, and selected destination lines.
 */

import L from 'leaflet';
import { type FusedPositionEstimate, SensorFusionMode, type POI } from '@navic/shared-models';
import { fusionService } from '../services/fusion-service.js';
import { poiService } from '../services/poi-service.js';
import { CATEGORY_ICONS, CATEGORY_LABELS } from './route-screen.js';

let map: L.Map | null = null;
let vehicleMarker: L.Marker | null = null;
let pathLine: L.Polyline | null = null;
let destinationMarker: L.Marker | null = null;
let destinationLine: L.Polyline | null = null;
let poiLayerGroup: L.LayerGroup | null = null;
let showPois = true;

let unsubscribeFusion: (() => void) | null = null;
let unsubscribeDest: (() => void) | null = null;

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
          <p class="screen__subtitle">Offline map tracking powered by 50 Hz EKF Sensor Fusion & POI Database</p>
        </div>
        <div class="map-screen__top-bar">
          <span class="status-badge status-badge--idle" id="map-fix-badge">Awaiting Fix</span>
          <span class="status-badge status-badge--active" id="map-poi-badge">${poiService.getAll().length} POIs Loaded</span>
        </div>
      </div>

      <div class="map-container" id="map-view"></div>

      <div class="map-controls">
        <button class="map-btn map-btn--active" id="btn-follow" title="Follow Vehicle">🎯</button>
        <button class="map-btn" id="btn-recenter" title="Recenter">⌖</button>
        <button class="map-btn map-btn--active" id="btn-toggle-pois" title="Toggle POIs">📍</button>
        <button class="map-btn" id="btn-outage" title="Simulate GNSS Outage (Test Dead Reckoning)">🚇 Outage</button>
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

  // Destination line connecting vehicle to target
  destinationLine = L.polyline([], {
    color: '#4f8cff',
    dashArray: '6, 8',
    weight: 3,
    opacity: 0.85,
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

  // Check initial destination
  updateDestinationMarker(poiService.getSelectedDestination());

  // Subscribe to destination changes
  unsubscribeDest = poiService.onDestinationChange((dest) => {
    updateDestinationMarker(dest);
  });

  // Subscribe to live 50 Hz Fused EKF updates
  unsubscribeFusion = fusionService.subscribe(updateMapState);
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

        setDestBtn?.addEventListener('click', () => {
          poiService.setDestination(poi);
          marker.closePopup();
        });

        routeBtn?.addEventListener('click', () => {
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

  // Update line from vehicle to destination
  if (vehicleMarker && destinationLine) {
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

  const latLng = L.latLng(latitude, longitude);

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
    map.setView(latLng, 15);
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

  // Update direct line to destination if active
  const curDest = poiService.getSelectedDestination();
  if (curDest && destinationLine) {
    destinationLine.setLatLngs([latLng, L.latLng(curDest.latitude, curDest.longitude)]);
  }
}
