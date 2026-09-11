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
import { voiceGuidanceService } from '../services/voice-guidance-service.js';
import { powerService } from '../services/power-service.js';
import { androidBridgeService } from '../services/android-bridge-service.js';
import { tripRecoveryService } from '../services/trip-recovery-service.js';
import { positionService } from '../services/position-service.js';
import { GeoUriParser } from '@navic/navigation-core';
import { CATEGORY_ICONS, CATEGORY_LABELS, MANEUVER_ICONS } from './route-screen.js';
import { GNSSQualityPill } from '../components/gnss-quality-pill.js';
import { technicalSplitPanelInstance, destinationSearchModalInstance } from '../main.js';

let map: L.Map | null = null;
let vehicleMarker: L.Marker | null = null;
let pathLine: L.Polyline | null = null;
let destinationMarker: L.Marker | null = null;
let destinationLine: L.Polyline | null = null;
let routePolyline: L.Polyline | null = null;
let routeCasingPolyline: L.Polyline | null = null;
let poiLayerGroup: L.LayerGroup | null = null;
let showPois = true;
let gnssPill: GNSSQualityPill | null = null;

let unsubscribeFusion: (() => void) | null = null;
let unsubscribeDest: (() => void) | null = null;
let unsubscribeRoute: (() => void) | null = null;
let unsubscribeNav: (() => void) | null = null;
let unsubscribeVoiceSpeaking: (() => void) | null = null;
let unsubscribeVoiceSettings: (() => void) | null = null;
let unsubscribeGeoIntent: (() => void) | null = null;
let unsubscribeBackPress: (() => void) | null = null;

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

async function loadOfflineBengaluruFeatures(leafletMap: L.Map): Promise<void> {
  // 1. Natural Landscaping: Lalbagh, Cubbon Park, Bugle Rock, Lakes
  const landscapeGroup = L.layerGroup();

  // Lalbagh Botanical Garden (Greenery)
  L.polygon([
    [12.9460, 77.5800],
    [12.9555, 77.5840],
    [12.9550, 77.5920],
    [12.9460, 77.5910],
  ], {
    color: '#2e7d32',
    fillColor: '#1b5e20',
    fillOpacity: 0.35,
    weight: 1.5,
  }).bindTooltip('Lalbagh Botanical Garden (ಲಾಲ್‌ಬಾಗ್)', { sticky: true }).addTo(landscapeGroup);

  // Lalbagh Lake
  L.polygon([
    [12.9470, 77.5880],
    [12.9490, 77.5905],
    [12.9475, 77.5925],
    [12.9455, 77.5900],
  ], {
    color: '#0288d1',
    fillColor: '#01579b',
    fillOpacity: 0.6,
    weight: 1.5,
  }).bindTooltip('Lalbagh Lake (ಲಾಲ್‌ಬಾಗ್ ಕೆರೆ)', { sticky: true }).addTo(landscapeGroup);

  // Cubbon Park
  L.polygon([
    [12.9710, 77.5900],
    [12.9780, 77.5910],
    [12.9790, 77.5960],
    [12.9720, 77.5970],
  ], {
    color: '#2e7d32',
    fillColor: '#1b5e20',
    fillOpacity: 0.35,
    weight: 1.5,
  }).bindTooltip('Cubbon Park (ಕಬ್ಬನ್ ಪಾರ್ಕ್)', { sticky: true }).addTo(landscapeGroup);

  // Bugle Rock Park
  L.polygon([
    [12.9415, 77.5670],
    [12.9440, 77.5680],
    [12.9435, 77.5705],
    [12.9410, 77.5695],
  ], {
    color: '#2e7d32',
    fillColor: '#1b5e20',
    fillOpacity: 0.4,
    weight: 1.5,
  }).bindTooltip('Bugle Rock Park (ಕಹಳೆ ಬಂಡೆ)', { sticky: true }).addTo(landscapeGroup);

  // Ulsoor Lake
  L.polygon([
    [12.9800, 77.6180],
    [12.9860, 77.6200],
    [12.9880, 77.6260],
    [12.9820, 77.6270],
  ], {
    color: '#0288d1',
    fillColor: '#01579b',
    fillOpacity: 0.6,
    weight: 1.5,
  }).bindTooltip('Ulsoor Lake (ಹಲಸೂರು ಕೆರೆ)', { sticky: true }).addTo(landscapeGroup);

  // Sankey Tank
  L.polygon([
    [13.0060, 77.5700],
    [13.0110, 77.5710],
    [13.0115, 77.5745],
    [13.0065, 77.5735],
  ], {
    color: '#0288d1',
    fillColor: '#01579b',
    fillOpacity: 0.6,
    weight: 1.5,
  }).bindTooltip('Sankey Tank (ಸ್ಯಾಂಕಿ ಕೆರೆ)', { sticky: true }).addTo(landscapeGroup);

  landscapeGroup.addTo(leafletMap);

  // 2. Offline Vector Road Network from bundled data/bengaluru-roads.json (4,105 roads)
  try {
    const res = await fetch('data/bengaluru-roads.json');
    if (!res.ok) return;
    const roads = await res.json();
    if (!Array.isArray(roads)) return;

    const roadCanvasRenderer = L.canvas({ padding: 0.5 });
    const roadsGroup = L.layerGroup();

    for (const way of roads) {
      if (!way.geometry || way.geometry.length < 2) continue;
      const latlngs: [number, number][] = way.geometry.map((p: any) => [p.lat, p.lon]);
      const hw = way.tags?.highway || 'residential';

      let color = '#546e7a';
      let weight = 1.6;
      let opacity = 0.55;

      if (hw === 'motorway' || hw === 'trunk') {
        color = '#ff9100';
        weight = 3.8;
        opacity = 0.85;
      } else if (hw === 'primary') {
        color = '#ffa726';
        weight = 3.0;
        opacity = 0.8;
      } else if (hw === 'secondary') {
        color = '#ffe082';
        weight = 2.4;
        opacity = 0.75;
      } else if (hw === 'tertiary') {
        color = '#eceff1';
        weight = 1.8;
        opacity = 0.65;
      }

      const roadLine = L.polyline(latlngs, {
        renderer: roadCanvasRenderer,
        color,
        weight,
        opacity,
        lineCap: 'round',
        lineJoin: 'round',
      });

      const name = way.tags?.name;
      const knName = way.tags?.['name:kn'];
      if (name) {
        const title = knName ? `${name} (${knName})` : name;
        roadLine.bindTooltip(title, { sticky: true });
      }

      roadsGroup.addLayer(roadLine);
    }

    roadsGroup.addTo(leafletMap);
  } catch (err) {
    console.warn('Could not load offline vector roads:', err);
  }
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
  if (unsubscribeVoiceSpeaking) {
    unsubscribeVoiceSpeaking();
    unsubscribeVoiceSpeaking = null;
  }
  if (unsubscribeVoiceSettings) {
    unsubscribeVoiceSettings();
    unsubscribeVoiceSettings = null;
  }
  if (unsubscribeGeoIntent) {
    unsubscribeGeoIntent();
    unsubscribeGeoIntent = null;
  }
  if (unsubscribeBackPress) {
    unsubscribeBackPress();
    unsubscribeBackPress = null;
  }
  if (gnssPill) {
    gnssPill.destroy();
    gnssPill = null;
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
        <!-- Floating Top Bar: Destination Search Pill -->
        <div class="map-top-bar" id="map-top-bar">
          <div class="map-search-pill-container" id="map-search-pill-container">
            <button class="map-mobile-search-pill" id="map-mobile-search-pill" type="button">
              <span class="search-pill__icon">🔍</span>
              <span class="search-pill__placeholder">Where to in Bengaluru?</span>
              <span class="search-pill__badge">Offline</span>
            </button>
          </div>
        </div>

        <!-- Floating GNSS Quality Pill (Positioned cleanly below search bar) -->
        <div id="map-gnss-pill-mount"></div>

        <!-- GNSS Outage / Loss Alert Strip (Section 18) -->
        <div class="map-gnss-status-strip map-gnss-status-strip--loss" id="map-gnss-loss-strip" style="display: none;">
          <span class="gnss-strip-icon">⚠️</span>
          <div class="gnss-strip-text">
            <div class="gnss-strip-title">GNSS SIGNAL LOST</div>
            <div class="gnss-strip-sub">Dead Reckoning Active (50 Hz IMU Fusion)</div>
          </div>
        </div>

        <!-- GNSS Restored Banner Strip (Section 18) -->
        <div class="map-gnss-status-strip map-gnss-status-strip--restored" id="map-gnss-restored-strip" style="display: none;">
          <span class="gnss-strip-icon">✓</span>
          <div class="gnss-strip-text">
            <div class="gnss-strip-title">GNSS RESTORED</div>
            <div class="gnss-strip-sub">EKF 3D Fix Reacquired</div>
          </div>
        </div>

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
              <!-- Voice Speaking Waveform Badge -->
              <div class="map-nav-voice-badge" id="map-nav-voice-badge" style="display: none;">
                <span class="voice-wave-bar bar-1"></span>
                <span class="voice-wave-bar bar-2"></span>
                <span class="voice-wave-bar bar-3"></span>
                <span class="voice-wave-text" id="voice-wave-text">Voice Speaking...</span>
              </div>
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

        <!-- Idle Location & Quick Discovery Card (Section 5) -->
        <div class="map-idle-card" id="map-idle-card">
          <div class="idle-card-top">
            <div class="idle-location-info">
              <span class="idle-location-dot">📍</span>
              <div class="idle-location-text">
                <div class="idle-location-title" id="idle-location-title">Current Location: Bengaluru</div>
                <div class="idle-location-sub" id="idle-location-sub">Karnataka · 4,011 Roads Offline Ready</div>
              </div>
            </div>
            <button class="btn btn--primary btn--sm" id="btn-idle-search" type="button">🔍 Search</button>
          </div>
          <div class="idle-quick-categories">
            <button class="idle-cat-chip" data-cat="fuel" type="button">⛽ Fuel</button>
            <button class="idle-cat-chip" data-cat="parking" type="button">🅿️ Parking</button>
            <button class="idle-cat-chip" data-cat="hospital" type="button">🏥 Hospital</button>
            <button class="idle-cat-chip" data-cat="food" type="button">🍽️ Food</button>
            <button class="idle-cat-chip idle-cat-chip--tech" id="btn-idle-tech" type="button">⚡ Tech HUD</button>
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

        <!-- Trip Recovery Floating Banner (Phase 18) -->
        <div class="map-trip-recovery-banner" id="map-trip-recovery-banner" style="display: none;">
          <div class="trip-recovery-header">
            <span class="trip-recovery-icon">🔄</span>
            <div class="trip-recovery-text">
              <div class="trip-recovery-title">Resume Active Navigation?</div>
              <div class="trip-recovery-subtitle" id="trip-recovery-subtitle">Restored unfinished trip</div>
            </div>
          </div>
          <div class="trip-recovery-actions">
            <button class="btn btn--primary btn--sm" id="btn-resume-trip">▶️ Resume</button>
            <button class="btn btn--secondary btn--sm" id="btn-dismiss-trip">✕ Dismiss</button>
          </div>
        </div>

        <!-- Android Hardware Back Confirmation Modal (Phase 18) -->
        <div class="modal-overlay" id="map-exit-confirm-modal" style="display: none;">
          <div class="modal-card">
            <h3 class="modal-title">Exit Navigation Guidance?</h3>
            <p class="modal-desc">Active turn-by-turn guidance is currently running. Do you want to stop navigation?</p>
            <div class="modal-actions">
              <button class="btn btn--danger" id="btn-confirm-exit-nav">Yes, Stop Navigation</button>
              <button class="btn btn--secondary" id="btn-cancel-exit-nav">Stay on Route</button>
            </div>
          </div>
        </div>
      </div>

      <div class="map-controls">
        <button class="map-btn map-btn--active" id="btn-follow" title="Recenter & Follow Vehicle">⌖</button>
        <button class="map-btn" id="btn-voice-toggle" title="Toggle Voice Guidance">🔊</button>
        <button class="map-btn" id="btn-manual-reroute" title="Recalculate Route" style="display: none;">🔄</button>
      </div>
    </div>
  `;

  // Determine initial center from live fused estimate or positionService
  const initialCoord = fusionService.getLatestEstimate()?.coordinate || positionService.lastPosition?.coordinate;
  const initialCenter: [number, number] = (initialCoord && initialCoord.latitude !== 0 && initialCoord.longitude !== 0)
    ? [initialCoord.latitude, initialCoord.longitude]
    : [12.9343, 77.5627];
  const initialZoom = 15;

  // Initialize Leaflet Map
  map = L.map('map-view', {
    zoomControl: false,
    attributionControl: false,
    maxZoom: 19,
    minZoom: 3,
  }).setView(initialCenter, initialZoom);

  // Add Zoom Control to bottom-left
  L.control.zoom({ position: 'bottomleft' }).addTo(map);

  // 1. Primary Offline Tile Layer: Loads bundled local tiles from tiles/{z}/{x}/{y}.png (266 tiles)
  // Operates 100% offline without requiring internet on Android WebView and desktop web.
  L.tileLayer('tiles/{z}/{x}/{y}.png', {
    minZoom: 11,
    maxNativeZoom: 15,
    maxZoom: 19,
    errorTileUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="%231a202c"/><path d="M0 64 H256 M0 128 H256 M0 192 H256 M64 0 V256 M128 0 V256 M192 0 V256" stroke="%232d3748" stroke-width="1"/></svg>',
  }).addTo(map);

  // 2. Online Tile Layer fallback (only if connected)
  if (navigator.onLine) {
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      opacity: 0.85,
    }).addTo(map);
  }

  // 3. Load Offline Bengaluru Vector Road Network (4,011 roads), Parks & Water bodies
  loadOfflineBengaluruFeatures(map);

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

  // Mount GNSS Quality Pill
  const pillMount = document.getElementById('map-gnss-pill-mount');
  if (pillMount) {
    gnssPill = new GNSSQualityPill(pillMount);
  }

  // Floating search pill & idle card interactions
  const searchPill = document.getElementById('map-mobile-search-pill');
  searchPill?.addEventListener('click', () => {
    destinationSearchModalInstance?.open();
  });

  const btnIdleSearch = document.getElementById('btn-idle-search');
  btnIdleSearch?.addEventListener('click', () => {
    destinationSearchModalInstance?.open();
  });

  const idleCatChips = container.querySelectorAll('.idle-cat-chip');
  idleCatChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const cat = chip.getAttribute('data-cat');
      if (cat) {
        destinationSearchModalInstance?.open(cat);
      }
    });
  });

  // Technical HUD triggers
  const btnTechHud = document.getElementById('btn-tech-hud');
  btnTechHud?.addEventListener('click', () => {
    technicalSplitPanelInstance?.toggle();
  });

  const btnIdleTech = document.getElementById('btn-idle-tech');
  btnIdleTech?.addEventListener('click', () => {
    technicalSplitPanelInstance?.toggle();
  });

  // Tap-to-dismiss alert strips
  document.getElementById('map-gnss-loss-strip')?.addEventListener('click', () => {
    const strip = document.getElementById('map-gnss-loss-strip');
    if (strip) strip.style.display = 'none';
  });
  document.getElementById('map-gnss-restored-strip')?.addEventListener('click', () => {
    const strip = document.getElementById('map-gnss-restored-strip');
    if (strip) strip.style.display = 'none';
  });

  const btnFollow = document.getElementById('btn-follow');
  const btnCloseNav = document.getElementById('btn-close-nav');

  function updateFollowBtn(): void {
    if (!btnFollow) return;
    if (isFollowing) {
      btnFollow.classList.add('map-btn--active');
      btnFollow.title = 'Camera Locked (Following Vehicle)';
    } else {
      btnFollow.classList.remove('map-btn--active');
      btnFollow.title = 'Camera Free (Tap to Recenter)';
    }
  }

  btnFollow?.addEventListener('click', () => {
    isFollowing = true;
    updateFollowBtn();
    if (vehicleMarker) {
      map?.panTo(vehicleMarker.getLatLng(), { animate: true, duration: 0.3 });
    }
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

  // Voice Controls & Live Speaking Feedback
  const btnVoiceToggle = document.getElementById('btn-voice-toggle');
  const voiceBadge = document.getElementById('map-nav-voice-badge');
  const voiceText = document.getElementById('voice-wave-text');

  function updateVoiceButtonUI(settings = voiceGuidanceService.getSettings()) {
    if (!btnVoiceToggle) return;
    if (settings.muted) {
      btnVoiceToggle.textContent = '🔇';
      btnVoiceToggle.title = 'Voice Muted (Click to Unmute)';
      btnVoiceToggle.classList.add('map-btn--voice-muted');
      btnVoiceToggle.classList.remove('map-btn--voice-active');
    } else {
      btnVoiceToggle.textContent = '🔊';
      btnVoiceToggle.title = 'Voice Guidance On (Click to Mute)';
      btnVoiceToggle.classList.add('map-btn--voice-active');
      btnVoiceToggle.classList.remove('map-btn--voice-muted');
    }
  }

  btnVoiceToggle?.addEventListener('click', () => {
    voiceGuidanceService.toggleMute();
  });

  unsubscribeVoiceSettings = voiceGuidanceService.onSettingsChange((settings) => {
    updateVoiceButtonUI(settings);
  });
  updateVoiceButtonUI();

  unsubscribeVoiceSpeaking = voiceGuidanceService.onSpeakingChange((isSpeaking, text) => {
    if (!voiceBadge) return;
    if (isSpeaking && !voiceGuidanceService.getSettings().muted) {
      voiceBadge.style.display = 'inline-flex';
      if (voiceText) {
        voiceText.textContent = text || 'Voice Guidance...';
      }
    } else {
      voiceBadge.style.display = 'none';
    }
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

  // Check for unfinished trip restoration (Phase 18)
  function checkTripRecovery(): void {
    if (tripRecoveryService.hasActiveTrip() && !navigationService.isNavigating) {
      const trip = tripRecoveryService.getStoredTrip();
      if (!trip) return;

      const banner = document.getElementById('map-trip-recovery-banner');
      const subtitle = document.getElementById('trip-recovery-subtitle');
      if (banner && subtitle) {
        const remaining = formatDist(trip.remainingDistance);
        subtitle.textContent = `Destination: ${trip.destinationName} • ${remaining} remaining`;
        banner.style.display = 'flex';

        document.getElementById('btn-resume-trip')?.addEventListener('click', () => {
          banner.style.display = 'none';
          navigationService.resumeTrip(trip);
          isFollowing = true;
          updateFollowBtn();
          if (vehicleMarker) map?.panTo(vehicleMarker.getLatLng());
        });

        document.getElementById('btn-dismiss-trip')?.addEventListener('click', () => {
          banner.style.display = 'none';
          tripRecoveryService.clearTrip();
        });
      }
    }
  }
  checkTripRecovery();

  // Android Geo Intent Handling (Phase 18)
  function handleGeoUri(rawUri: string): void {
    if (!rawUri) return;
    const payload = GeoUriParser.parse(rawUri);
    if (payload.latitude !== null && payload.longitude !== null) {
      const destCoord = { latitude: payload.latitude, longitude: payload.longitude };
      const currentEstimate = fusionService.getLatestEstimate();
      if (currentEstimate?.coordinate) {
        routingService.calculateRoute({
          origin: currentEstimate.coordinate,
          destination: destCoord,
        });
        if (map) {
          map.setView([payload.latitude, payload.longitude], payload.zoom || 15);
        }
      }
    } else if (payload.query) {
      const results = poiService.search(payload.query);
      if (results.length > 0) {
        const target = results[0];
        const currentEstimate = fusionService.getLatestEstimate();
        if (currentEstimate?.coordinate) {
          routingService.calculateRoute({
            origin: currentEstimate.coordinate,
            destination: { latitude: target.poi.latitude, longitude: target.poi.longitude },
          });
          if (map) {
            map.setView([target.poi.latitude, target.poi.longitude], 16);
          }
        }
      }
    }
  }

  const pendingIntent = androidBridgeService.getPendingGeoIntent();
  if (pendingIntent) {
    handleGeoUri(pendingIntent);
  }

  unsubscribeGeoIntent = androidBridgeService.onGeoIntent((uri) => {
    handleGeoUri(uri);
  });

  // Android Hardware Back Navigation (Phase 18)
  const modalExit = document.getElementById('map-exit-confirm-modal');
  document.getElementById('btn-confirm-exit-nav')?.addEventListener('click', () => {
    navigationService.stopNavigation();
    if (modalExit) modalExit.style.display = 'none';
  });
  document.getElementById('btn-cancel-exit-nav')?.addEventListener('click', () => {
    if (modalExit) modalExit.style.display = 'none';
  });

  unsubscribeBackPress = androidBridgeService.onBackPressed(() => {
    if (navigationService.isNavigating) {
      if (modalExit) modalExit.style.display = 'flex';
    } else if (window.history.length > 1) {
      window.history.back();
    }
  });
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

  const searchContainer = document.getElementById('map-search-pill-container');
  const idleCard = document.getElementById('map-idle-card');
  const mapScreenEl = document.querySelector('.map-screen');

  if (!state.route) {
    if (banner) banner.style.display = 'none';
    if (tripBar) tripBar.style.display = 'none';
    if (btnManualReroute) btnManualReroute.style.display = 'none';
    if (searchContainer) searchContainer.style.display = '';
    if (idleCard) idleCard.style.display = 'flex';
    mapScreenEl?.classList.remove('map-screen--navigating');
    return;
  }

  if (searchContainer) searchContainer.style.display = 'none';
  if (idleCard) idleCard.style.display = 'none';
  mapScreenEl?.classList.add('map-screen--navigating');
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
let lastRenderTime = 0;

function updateMapState(estimate: FusedPositionEstimate): void {
  if (!map) return;

  // Power optimization: throttle map marker redraw rate according to vehicle dynamics & power saver profile
  const fpsLimit = powerService.getStatus().mapFpsLimit;
  if (fpsLimit < 60) {
    const minIntervalMs = 1000 / fpsLimit;
    const now = performance.now();
    if (now - lastRenderTime < minIntervalMs) {
      return; // Skip redraw to conserve GPU/CPU and battery
    }
    lastRenderTime = now;
  }

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
  } else {
    // If dead reckoning mode changed, swap icon color
    if (isDr !== lastDrState) {
      vehicleMarker.setIcon(createVehicleIcon(isDr));
    }
    vehicleMarker.setLatLng(latLng);
  }

  // Check and trigger GNSS loss / restored alert strips
  const lossStrip = document.getElementById('map-gnss-loss-strip');
  const restoredStrip = document.getElementById('map-gnss-restored-strip');
  if (!isInit && isDr && !lastDrState) {
    if (lossStrip) {
      lossStrip.style.display = 'flex';
      setTimeout(() => {
        if (lossStrip) lossStrip.style.display = 'none';
      }, 4000);
    }
    if (restoredStrip) restoredStrip.style.display = 'none';
  } else if (!isInit && !isDr && lastDrState) {
    if (lossStrip) lossStrip.style.display = 'none';
    if (restoredStrip) {
      restoredStrip.style.display = 'flex';
      setTimeout(() => {
        if (restoredStrip) restoredStrip.style.display = 'none';
      }, 3500);
    }
  }
  lastDrState = isDr;

  // Update idle location card subtitle
  const idleSub = document.getElementById('idle-location-sub');
  if (idleSub && !navigationService.isNavigating) {
    idleSub.textContent = `📍 ${displayLat.toFixed(4)}°N, ${displayLon.toFixed(4)}°E · 4,011 Roads Offline Ready`;
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
