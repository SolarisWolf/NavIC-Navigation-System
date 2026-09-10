/**
 * Map Screen
 *
 * Displays the Leaflet map with offline MBTiles support.
 * Tracks the vehicle position with high-rate (50 Hz) Extended Kalman Filter
 * sensor fusion, with support for seamless Dead Reckoning during GNSS outages.
 */

import L from 'leaflet';
import { type FusedPositionEstimate, SensorFusionMode } from '@navic/shared-models';
import { fusionService } from '../services/fusion-service.js';

let map: L.Map | null = null;
let vehicleMarker: L.Marker | null = null;
let pathLine: L.Polyline | null = null;
let unsubscribe: (() => void) | null = null;
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

export function renderMapScreen(container: HTMLElement): void {
  // Clean up if already rendered
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
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
          <p class="screen__subtitle">Offline map tracking powered by 50 Hz EKF Sensor Fusion</p>
        </div>
        <div class="map-screen__top-bar">
          <span class="status-badge status-badge--idle" id="map-fix-badge">Awaiting Fix</span>
        </div>
      </div>

      <div class="map-container" id="map-view"></div>

      <div class="map-controls">
        <button class="map-btn map-btn--active" id="btn-follow" title="Follow Vehicle">🎯</button>
        <button class="map-btn" id="btn-recenter" title="Recenter">⌖</button>
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

  // Initialize Polyline for track
  pathLine = L.polyline([], {
    color: '#00e676',
    weight: 4,
    opacity: 0.8,
  }).addTo(map);

  // Map interaction handlers
  map.on('dragstart', () => {
    isFollowing = false;
    updateFollowBtn();
  });

  const btnFollow = document.getElementById('btn-follow');
  const btnRecenter = document.getElementById('btn-recenter');
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

  btnOutage?.addEventListener('click', () => {
    fusionService.triggerGNSSOutage(5000); // 5s GNSS outage
  });

  // Subscribe to live 50 Hz Fused EKF updates
  unsubscribe = fusionService.subscribe(updateMapState);
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
    map.setView(latLng, 16);
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
}
