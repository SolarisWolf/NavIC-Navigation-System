/**
 * NavIC Navigation — Showcase & Grand Exhibition Screen
 *
 * Phase 20: Premier interactive demonstration hub featuring:
 * - 8-Step Automated Narrative Showcase Tour with synchronized HUD & chimes
 * - Complete 20-Phase Milestone Exhibition Matrix (Phase 0 to Phase 20)
 * - Monorepo Offline Architecture Topology
 * - Direct screen navigation shortcuts
 */

import {
  showcaseService,
  ShowcaseStep,
  SHOWCASE_STEPS,
} from '../services/showcase-service.js';
import { qs, qsa } from '../utils/dom.js';

interface MilestoneCardData {
  phase: number;
  title: string;
  icon: string;
  badge: string;
  description: string;
  tags: string[];
  routeTarget: string;
}

const MILESTONES: readonly MilestoneCardData[] = [
  {
    phase: 0,
    title: 'Monorepo Architecture',
    icon: '🏗️',
    badge: 'Core Foundation',
    description: 'TypeScript npm workspaces monorepo: shared-models, gnss-core, sensor-fusion, map-core, routing-core, navigation-core, web, android.',
    tags: ['npm workspaces', 'TypeScript', 'Vitest', 'Clean Architecture'],
    routeTarget: '#/diagnostics',
  },
  {
    phase: 1,
    title: 'Web Application Foundation',
    icon: '💻',
    badge: 'Responsive Shell',
    description: 'Dark-mode SPA shell with modular screens: Dashboard, Map, Satellites, Sensors, Route, Settings, and Status Bar.',
    tags: ['SPA Router', 'Vanilla CSS', 'Dark Mode', 'Glassmorphic'],
    routeTarget: '#/dashboard',
  },
  {
    phase: 2,
    title: 'Multi-GNSS / NavIC Simulator',
    icon: '🛰️',
    badge: 'Constellations',
    description: 'Simulates NavIC (L5/S), GPS, Galileo, BeiDou, and GLONASS with orbital kinematics, SNR, and constellation geometry.',
    tags: ['NavIC L5/S', 'Multi-GNSS', 'NMEA 0183', 'Orbital Mechanics'],
    routeTarget: '#/satellites',
  },
  {
    phase: 3,
    title: 'Offline Base Map Integration',
    icon: '🗺️',
    badge: 'Local Tiles',
    description: 'Embedded MBTiles offline tile server and Leaflet map rendering with dynamic vehicle tracking marker.',
    tags: ['Leaflet', 'MBTiles', 'Offline Tiles', 'Vehicle Heading Marker'],
    routeTarget: '#/map',
  },
  {
    phase: 4,
    title: '50 Hz IMU Simulator',
    icon: '📐',
    badge: 'Kinematics',
    description: 'High-frequency 3-axis accelerometer, gyroscope, and magnetometer with real-time 3D vehicle attitude projection.',
    tags: ['50 Hz IMU', 'Quaternion', 'Roll/Pitch/Yaw', 'Sensor Noise'],
    routeTarget: '#/sensors',
  },
  {
    phase: 5,
    title: '7-State Extended Kalman Filter',
    icon: '🏎️',
    badge: 'Sensor Fusion',
    description: '7-state EKF fusing 50 Hz IMU with 1 Hz GNSS fixes. Uninterrupted Dead Reckoning during tunnel blackouts (<0.03ms cycle latency).',
    tags: ['EKF Fusion', 'Dead Reckoning', 'Covariance', 'Matrix Math'],
    routeTarget: '#/sensors',
  },
  {
    phase: 6,
    title: 'GNSS Position Engine',
    icon: '📡',
    badge: 'Position Engine',
    description: 'Line-of-sight satellite geometry DOP (HDOP/VDOP/PDOP), kinematic outlier rejection, and exponential coordinate smoothing.',
    tags: ['Dilution of Precision', 'Outlier Rejection', 'NavIC Fix', 'Smoothing'],
    routeTarget: '#/satellites',
  },
  {
    phase: 7,
    title: 'Offline POI Database',
    icon: '📍',
    badge: 'Spatial Index',
    description: '49 Delhi NCR amenities across 10 categories with sub-0.1ms fuzzy text search, category chips, and live vehicle proximity.',
    tags: ['Spatial KD-Tree', 'Fuzzy Search', 'Delhi POIs', 'Proximity Ranking'],
    routeTarget: '#/map',
  },
  {
    phase: 8,
    title: 'Offline Routing Engine',
    icon: '🧭',
    badge: 'Road Network',
    description: '58-node/146-edge Delhi NCR topological road graph. Sub-millisecond A* pathfinding (Car, Bicycle, Walking; Fastest/Shortest).',
    tags: ['A* Algorithm', 'Road Graph', 'Turn Classification', 'Polyline Geometry'],
    routeTarget: '#/route',
  },
  {
    phase: 9,
    title: 'Turn Navigation Engine',
    icon: '🚘',
    badge: 'Cockpit Guidance',
    description: 'High-performance planar map matching, route progress tracking, turn-by-turn guidance HUD countdowns, and arrival detection.',
    tags: ['Map Matching', 'HUD Turn Cards', 'Distance Countdown', 'Arrival Detection'],
    routeTarget: '#/map',
  },
  {
    phase: 10,
    title: 'Anti-Thrashing Re-Routing',
    icon: '🔄',
    badge: 'Auto Recalculation',
    description: '3-sample debounced off-route detector, 3,000ms anti-thrashing cooldown throttling, and atomic route hot-swapping.',
    tags: ['ReroutingManager', 'Cooldown Mutex', 'Atomic Swap', 'Zero Discontinuity'],
    routeTarget: '#/map',
  },
  {
    phase: 11,
    title: 'Offline Voice Navigation',
    icon: '🔊',
    badge: 'Audio Engine',
    description: 'Indian English SpeechSynthesis TTS with multi-stage distance countdowns and procedural Web Audio API harmonic turn chimes.',
    tags: ['Web Speech API', 'Web Audio Synth', 'Harmonic Chimes', 'Mute Control'],
    routeTarget: '#/settings',
  },
  {
    phase: 12,
    title: 'Web Simulation Hub',
    icon: '🧪',
    badge: 'Driving Scenarios',
    description: '5 Delhi NCR driving scenarios (Connaught Place, Tunnel, Urban Canyon, Highway, Detour) with timeline scrubber and fault injection.',
    tags: ['Timeline Seeking', 'Fault Injection', 'Speed Scaling', 'Scenario Runner'],
    routeTarget: '#/map',
  },
  {
    phase: 13,
    title: 'Stress Testing & Diagnostics',
    icon: '⚡',
    badge: 'Offline Certified',
    description: '10k EKF cycles (0.024ms latency), 60s blackout test, 500 A* routes, standalone Service Worker, and offline certification badge.',
    tags: ['Diagnostics Suite', 'Service Worker', 'Cache Storage', 'Stress Runner'],
    routeTarget: '#/diagnostics',
  },
  {
    phase: 14,
    title: 'Android Application Foundation',
    icon: '📱',
    badge: 'Native Android',
    description: 'Native Android project (compileSdk 34, minSdk 26), WebViewAssetLoader, NavICNativeBridge, and foreground guidance service.',
    tags: ['Kotlin', 'Gradle 8.12', 'WebViewAssetLoader', 'ForegroundService'],
    routeTarget: '#/settings',
  },
  {
    phase: 15,
    title: 'Real Hardware Providers',
    icon: '🛰️',
    badge: 'Hardware Bridge',
    description: 'Native Android LocationManager and 50 Hz SensorManager integration, W3C Geolocation provider, and USB Serial NMEA decoder.',
    tags: ['GnssStatus.Callback', 'SensorEventListener', 'Serial NMEA', 'Hardware Selector'],
    routeTarget: '#/settings',
  },
  {
    phase: 16,
    title: 'Real NavIC Detection',
    icon: '🇮🇳',
    badge: 'ISRO Spacecraft',
    description: 'PRN mapping for IRNSS-1A through 1I & NVS-01, GEO/GSO orbit slots, dual-frequency L5/S carrier classification, and telemetry cards.',
    tags: ['IRNSS Constellation', 'L5 & S-Band', 'Signal Quality', 'GEO/GSO Orbit'],
    routeTarget: '#/satellites',
  },
  {
    phase: 17,
    title: 'Battery & Power Optimization',
    icon: '🔋',
    badge: 'Eco Profiles',
    description: 'Vehicle dynamics classification (Stationary/In-Motion/Cruise), adaptive IMU throttling (50Hz to 10Hz), and Power Saver profile.',
    tags: ['PowerOptimizer', 'Stationary Debounce', 'Screen WakeLock', 'Battery Broadcast'],
    routeTarget: '#/settings',
  },
  {
    phase: 18,
    title: 'Final Offline Android Navigation',
    icon: '🚗',
    badge: 'OS Integration',
    description: 'RFC 5870 Geo URI parsing (geo: and google.navigation:), persistent trip state recovery, audio focus ducking, and immersive mode.',
    tags: ['Geo URI Parser', 'Trip Recovery', 'Audio Ducking', 'Immersive Mode'],
    routeTarget: '#/map',
  },
  {
    phase: 19,
    title: 'Performance & Reliability Testing',
    icon: '📊',
    badge: 'Automotive SLAs',
    description: 'Production SLA Compliance Matrix (p50/p95/p99), 15k-cycle EKF stability, 1k-route benchmark, and downloadable audit certificate.',
    tags: ['SLA Matrix', 'Percentiles', 'ReDoS Defense', 'Reliability Certificate'],
    routeTarget: '#/diagnostics',
  },
  {
    phase: 20,
    title: 'Final Validation & Demonstration',
    icon: '🏆',
    badge: 'Grand Finale',
    description: 'Automated 8-step guided showcase tour, comprehensive end-to-end integration validation, and complete 20-phase release package.',
    tags: ['Showcase Tour', 'End-to-End Suite', 'Production APK', 'Release Ready'],
    routeTarget: '#/showcase',
  },
];

export function renderShowcaseScreen(container: HTMLElement): () => void {
  container.innerHTML = `
    <div class="showcase-screen">
      <!-- Hero Banner -->
      <section class="showcase-hero">
        <div class="showcase-hero-content">
          <div class="showcase-hero-badge">🏆 Phase 20 Milestone: Grand Release</div>
          <h1 class="showcase-hero-title">NavIC Smart Offline Navigation</h1>
          <p class="showcase-hero-subtitle">
            A 100% on-device, automotive-grade navigation system engineered for India's NavIC (IRNSS) satellite constellation.
            Fusing 50 Hz IMU telemetry with sub-millisecond offline A* routing, turn-by-turn cockpit guidance, and zero-cloud dependency.
          </p>
          <div class="showcase-hero-actions">
            <button id="btn-start-tour" class="btn btn-showcase-tour">
              🎬 Start Automated Showcase Tour
            </button>
            <a href="#/map" class="btn btn--secondary">
              🗺️ Open Live Cockpit Map
            </a>
            <a href="#/diagnostics" class="btn btn--secondary">
              ⚡ View SLA Benchmarks
            </a>
          </div>
        </div>
      </section>

      <!-- Active Guided Tour HUD Card -->
      <section class="showcase-tour-panel" id="tour-panel">
        <!-- Step Navigation Pills -->
        <div class="tour-step-pills" id="tour-pills">
          ${SHOWCASE_STEPS.map(
            (s, idx) => `
            <button class="tour-step-pill ${idx === 0 ? 'active' : ''}" data-step="${idx}">
              ${idx + 1}. ${s.title}
            </button>
          `
          ).join('')}
        </div>

        <!-- Narrative Card Content -->
        <div class="tour-narrative-card">
          <div class="tour-narrative-top">
            <div class="tour-step-title" id="tour-step-title">
              1. NavIC Constellation Acquisition
            </div>
            <span class="tour-step-badge" id="tour-step-badge" style="background: rgba(0, 230, 118, 0.15); border: 1px solid #00e676; color: #00e676;">
              🛰️ PHASE 2 & 16
            </span>
          </div>

          <p class="tour-narration-text" id="tour-narration-text">
            Locking Indian Regional Navigation Satellite System (NavIC/IRNSS). Receiving 3 Geostationary and 4 Inclined Geosynchronous satellites with dual-frequency L5 and S-band classification.
          </p>

          <!-- Live Technical Specs Grid -->
          <div class="tour-tech-chips" id="tour-tech-chips">
            <div class="tour-tech-chip">
              <span class="tour-tech-label">Constellation</span>
              <span class="tour-tech-val">NavIC (IRNSS) + Multi-GNSS</span>
            </div>
            <div class="tour-tech-chip">
              <span class="tour-tech-label">Frequencies</span>
              <span class="tour-tech-val">L5 (1176.45 MHz) & S-band</span>
            </div>
            <div class="tour-tech-chip">
              <span class="tour-tech-label">Carrier C/N0</span>
              <span class="tour-tech-val">44.8 dB-Hz (Strong Fix)</span>
            </div>
            <div class="tour-tech-chip">
              <span class="tour-tech-label">Horizontal DOP</span>
              <span class="tour-tech-val">0.88 (Optimal Geometry)</span>
            </div>
          </div>
        </div>

        <!-- Tour Playback Controls -->
        <div class="tour-controls-row">
          <div class="tour-controls-left">
            <button class="btn btn--sm btn--primary" id="btn-tour-play">▶ Play Tour</button>
            <button class="btn btn--sm btn--secondary" id="btn-tour-prev">⏮ Previous</button>
            <button class="btn btn--sm btn--secondary" id="btn-tour-next">⏭ Next</button>
            <button class="btn btn--sm btn--secondary" id="btn-tour-reset">↺ Reset</button>
          </div>
          <span style="font-size: 0.8rem; color: #94a3b8;" id="tour-step-counter">
            Step 1 of 8
          </span>
        </div>
      </section>

      <!-- 20-Phase Milestone Exhibition Matrix -->
      <section class="showcase-matrix-section">
        <div class="showcase-section-header">
          <div>
            <h2 class="showcase-section-title">🏛️ 20-Phase Development Journey & Capabilities Matrix</h2>
            <p class="showcase-section-subtitle">
              Every phase fully verified, documented, and operating 100% locally on-device.
            </p>
          </div>
          <span style="font-size: 0.85rem; font-weight: 700; color: #34d399;">
            ✅ 20 / 20 PHASES COMPLETE (100%)
          </span>
        </div>

        <div class="showcase-milestones-grid">
          ${MILESTONES.map(
            (m) => `
            <div class="showcase-card">
              <div class="showcase-card-top">
                <div class="showcase-card-header">
                  <span class="showcase-phase-badge">PHASE ${m.phase}</span>
                  <span class="showcase-status-badge">✅ Complete</span>
                </div>
                <h3 class="showcase-card-title">${m.icon} ${m.title}</h3>
                <p class="showcase-card-desc">${m.description}</p>
                <div class="showcase-card-tags">
                  ${m.tags.map((t) => `<span class="showcase-card-tag">${t}</span>`).join('')}
                </div>
              </div>
              <a href="${m.routeTarget}" class="btn btn--sm btn--secondary showcase-card-action">
                View Feature →
              </a>
            </div>
          `
          ).join('')}
        </div>
      </section>

      <!-- Monorepo Architecture Topology -->
      <section class="showcase-arch-card">
        <div class="showcase-section-header">
          <h2 class="showcase-section-title">📐 Monorepo Architecture & Hardware Data Flow</h2>
          <span style="font-size: 0.8rem; color: #38bdf8; font-family: 'JetBrains Mono', monospace;">
            npm workspaces • Android API 26-34 • 100% Offline
          </span>
        </div>

        <div class="showcase-arch-grid">
          <div class="showcase-arch-box">
            <div class="showcase-arch-box-title">🛰️ @navic/gnss-core</div>
            <ul class="showcase-arch-box-list">
              <li>Multi-Constellation Simulator</li>
              <li>NavIC Regional L5/S Detector</li>
              <li>DOP Satellite Geometry Engine</li>
              <li>W3C Geolocation Hardware Provider</li>
              <li>USB Serial NMEA 0183 Decoder</li>
            </ul>
          </div>

          <div class="showcase-arch-box">
            <div class="showcase-arch-box-title">🏎️ @navic/sensor-fusion</div>
            <ul class="showcase-arch-box-list">
              <li>50 Hz IMU Kinematic Simulator</li>
              <li>7-State Extended Kalman Filter</li>
              <li>Sub-0.03ms Prediction Cycle</li>
              <li>Uninterrupted Dead Reckoning</li>
              <li>PowerOptimizer Multi-Tier Profiles</li>
            </ul>
          </div>

          <div class="showcase-arch-box">
            <div class="showcase-arch-box-title">🧭 @navic/routing-core</div>
            <ul class="showcase-arch-box-list">
              <li>58-Node / 146-Edge Delhi Road Graph</li>
              <li>Sub-0.5ms A* Pathfinding</li>
              <li>Car, Bicycle, Walking Profiles</li>
              <li>Fastest vs Shortest Optimization</li>
              <li>Turn Maneuver Classification</li>
            </ul>
          </div>

          <div class="showcase-arch-box">
            <div class="showcase-arch-box-title">🚘 @navic/navigation-core</div>
            <ul class="showcase-arch-box-list">
              <li>Planar Map Matching Engine</li>
              <li>Dynamic Turn HUD Countdowns</li>
              <li>Anti-Thrashing Re-Routing</li>
              <li>Procedural Audio Turn Chimes</li>
              <li>RFC 5870 Geo URI Intent Parser</li>
            </ul>
          </div>

          <div class="showcase-arch-box">
            <div class="showcase-arch-box-title">📱 apps/android</div>
            <ul class="showcase-arch-box-list">
              <li>WebViewAssetLoader (100% Offline)</li>
              <li>NavIC Native JavascriptInterface</li>
              <li>50 Hz SensorManager Telemetry</li>
              <li>Foreground Guidance Service</li>
              <li>Audio Focus Transient Ducking</li>
            </ul>
          </div>

          <div class="showcase-arch-box">
            <div class="showcase-arch-box-title">💻 apps/web</div>
            <ul class="showcase-arch-box-list">
              <li>Cockpit Leaflet Map View</li>
              <li>Simulation Hub with 5 Scenarios</li>
              <li>Production SLA Diagnostics</li>
              <li>Trip State Persistence Service</li>
              <li>Grand Showcase Tour Controller</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  `;

  // ─── Wire Tour Controller ──────────────────────────────────────────────────
  const titleEl = qs('#tour-step-title', container);
  const badgeEl = qs('#tour-step-badge', container);
  const narrationEl = qs('#tour-narration-text', container);
  const chipsEl = qs('#tour-tech-chips', container);
  const counterEl = qs('#tour-step-counter', container);
  const playBtn = qs('#btn-tour-play', container);
  const prevBtn = qs('#btn-tour-prev', container);
  const nextBtn = qs('#btn-tour-next', container);
  const resetBtn = qs('#btn-tour-reset', container);
  const startTourHeroBtn = qs('#btn-start-tour', container);
  const stepPills = qsa('.tour-step-pill', container);

  function renderStep(step: ShowcaseStep, isPlaying: boolean): void {
    if (titleEl) titleEl.textContent = `${step.index + 1}. ${step.title}`;
    if (badgeEl) {
      badgeEl.textContent = step.badge;
      badgeEl.style.color = step.badgeColor;
      badgeEl.style.borderColor = step.badgeColor;
      badgeEl.style.background = `${step.badgeColor}22`;
    }
    if (narrationEl) narrationEl.textContent = step.narration;
    if (counterEl) counterEl.textContent = `Step ${step.index + 1} of ${SHOWCASE_STEPS.length}`;

    if (chipsEl) {
      chipsEl.innerHTML = step.technicalDetails
        .map(
          (t) => `
        <div class="tour-tech-chip">
          <span class="tour-tech-label">${t.label}</span>
          <span class="tour-tech-val">${t.value}</span>
        </div>
      `
        )
        .join('');
    }

    if (playBtn) {
      playBtn.textContent = isPlaying ? '⏸ Pause Tour' : '▶ Play Tour';
    }

    stepPills.forEach((p, idx) => {
      p.classList.toggle('active', idx === step.index);
    });
  }

  const unsubscribe = showcaseService.subscribe((step, isPlaying) => {
    renderStep(step, isPlaying);
  });

  playBtn?.addEventListener('click', () => {
    if (showcaseService.getIsPlaying()) {
      showcaseService.pauseTour();
    } else {
      showcaseService.resumeTour();
    }
  });

  prevBtn?.addEventListener('click', () => {
    showcaseService.prevStep();
  });

  nextBtn?.addEventListener('click', () => {
    showcaseService.nextStep();
  });

  resetBtn?.addEventListener('click', () => {
    showcaseService.stopTour();
  });

  startTourHeroBtn?.addEventListener('click', () => {
    showcaseService.startTour();
    const panel = qs('#tour-panel', container);
    panel?.scrollIntoView({ behavior: 'smooth' });
  });

  stepPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const stepIdx = parseInt(pill.getAttribute('data-step') || '0', 10);
      showcaseService.jumpToStep(stepIdx);
    });
  });

  return () => {
    unsubscribe();
    showcaseService.stopTour();
  };
}
