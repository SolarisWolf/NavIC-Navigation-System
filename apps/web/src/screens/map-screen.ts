/**
 * Map Screen
 *
 * Displays the Leaflet map with offline MBTiles support.
 * Tracks the vehicle position based on GNSS data.
 */

import L from 'leaflet';
import { type GNSSMeasurement, FixType } from '@navic/shared-models';
import { gnssService } from '../services/gnss-service.js';

let map: L.Map | null = null;
let vehicleMarker: L.Marker | null = null;
let pathLine: L.Polyline | null = null;
let unsubscribe: (() => void) | null = null;
let isFollowing = true;
let isInitialized = false;

const MAX_PATH_POINTS = 500;
const pathCoordinates: L.LatLng[] = [];

// Custom vehicle icon
const vehicleIconSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00e676" class="vehicle-icon">
    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" stroke="#000" stroke-width="1"/>
  </svg>
`;

const vehicleIcon = L.divIcon({
  html: vehicleIconSvg,
  className: 'vehicle-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

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
    <div class="map-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Map</h1>
          <p class="screen__subtitle">Offline map and vehicle tracking</p>
        </div>
        <span class="status-badge status-badge--idle" id="map-fix-badge">No Fix</span>
      </div>

      <div class="map-container" id="map-view"></div>

      <div class="map-controls">
        <button class="map-btn map-btn--active" id="btn-follow" title="Follow Vehicle">🎯</button>
        <button class="map-btn" id="btn-recenter" title="Recenter">⌖</button>
      </div>
    </div>
  `;

  // Initialize Leaflet Map
  map = L.map('map-view', {
    zoomControl: false,
    attributionControl: false,
    maxZoom: 18,
    minZoom: 3,
  }).setView([28.6139, 77.2090], 12); // Default to Delhi

  // Add Zoom Control to bottom-left
  L.control.zoom({ position: 'bottomleft' }).addTo(map);

  // Add Tile Layer targeting our Vite Plugin
  // We use maxNativeZoom: 14 assuming typical MBTiles, but map zooms to 18
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

  // Subscribe to live GNSS updates
  unsubscribe = gnssService.subscribe(updateMapState);
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

function updateMapState(m: GNSSMeasurement): void {
  if (!map) return;

  const badge = document.getElementById('map-fix-badge');
  const isNoFix = m.fixType === FixType.NoFix;

  if (badge) {
    if (isNoFix) {
      badge.textContent = 'No Fix';
      badge.className = 'status-badge status-badge--error';
    } else {
      badge.textContent = m.fixType === FixType.Fix3D ? '3D Fix' : '2D Fix';
      badge.className = 'status-badge status-badge--active';
    }
  }

  if (isNoFix || m.latitude === 0 || m.longitude === 0) return;

  const latLng = L.latLng(m.latitude, m.longitude);

  // Initialize or update marker
  if (!vehicleMarker) {
    vehicleMarker = L.marker(latLng, {
      icon: vehicleIcon,
      zIndexOffset: 1000,
    }).addTo(map);
  } else {
    vehicleMarker.setLatLng(latLng);
  }

  // Rotate vehicle icon using CSS transform
  const iconEl = vehicleMarker.getElement()?.querySelector('svg');
  if (iconEl) {
    iconEl.style.transform = `rotate(${m.bearing}deg)`;
  }

  // First time fix initialization
  if (!isInitialized) {
    map.setView(latLng, 16);
    isInitialized = true;
  } else if (isFollowing) {
    // Smooth pan if following
    map.panTo(latLng, { animate: true, duration: 1.0 });
  }

  // Update track
  pathCoordinates.push(latLng);
  if (pathCoordinates.length > MAX_PATH_POINTS) {
    pathCoordinates.shift();
  }
  pathLine?.setLatLngs(pathCoordinates);
}
