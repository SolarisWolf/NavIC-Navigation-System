/**
 * NavIC Navigation — Web Application Entry Point
 *
 * Initializes the SPA: router, status bar, sidebar, and all screen routes.
 */

import { Logger, LogLevel, DEFAULT_CONFIG } from '@navic/shared-models';
import { Router } from './router.js';
import { StatusBar } from './components/status-bar.js';
import { Sidebar } from './components/sidebar.js';
import { MobileBottomNav } from './components/bottom-nav.js';
import { SimulationControls } from './components/simulation-controls.js';
import { renderDashboard } from './screens/dashboard.js';
import { renderMapScreen } from './screens/map-screen.js';
import { renderSatelliteScreen } from './screens/satellite-screen.js';
import { renderSensorScreen } from './screens/sensor-screen.js';
import { renderRouteScreen } from './screens/route-screen.js';
import { renderSettingsScreen } from './screens/settings-screen.js';
import { renderDiagnosticsScreen } from './screens/diagnostics-screen.js';
import { renderShowcaseScreen } from './screens/showcase-screen.js';
import { offlineService } from './services/offline-service.js';
import { gnssService, DataSourceMode } from './services/gnss-service.js';
import { androidBridgeService } from './services/android-bridge-service.js';

import { TechnicalSplitPanel } from './components/technical-split-panel.js';
import { DestinationSearchModal } from './components/destination-search-modal.js';

export let technicalSplitPanelInstance: TechnicalSplitPanel | null = null;
export let destinationSearchModalInstance: DestinationSearchModal | null = null;

// ─── Logger Setup ────────────────────────────────────────────────────────────

const logger = new Logger('App', {
  level: LogLevel.DEBUG,
  isSimulation: DEFAULT_CONFIG.simulation.enabled,
});

// ─── Application Bootstrap ──────────────────────────────────────────────────

function initApp(): void {
  logger.info(`${DEFAULT_CONFIG.appName} v${DEFAULT_CONFIG.version} — initializing`);

  // Activate mobile-first UI layout on Android native container or touch/mobile screens
  const isMobile = androidBridgeService.isRunningInAndroid() ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth <= 1200;

  if (isMobile) {
    document.body.classList.add('is-mobile-ui');
  }
  window.addEventListener('resize', () => {
    if (androidBridgeService.isRunningInAndroid() || window.innerWidth <= 1200) {
      document.body.classList.add('is-mobile-ui');
    } else {
      document.body.classList.remove('is-mobile-ui');
    }
  });

  // Get DOM containers
  const statusBarEl = document.getElementById('status-bar');
  const sidebarEl = document.getElementById('sidebar');
  const mainContentEl = document.getElementById('main-content');

  if (!statusBarEl || !sidebarEl || !mainContentEl) {
    logger.error('Failed to find required DOM elements');
    return;
  }

  // Initialize router
  const router = new Router(mainContentEl);

  // Register routes
  router.addRoute({
    path: '/dashboard',
    label: 'Dashboard',
    icon: '📊',
    render: renderDashboard,
  });

  router.addRoute({
    path: '/map',
    label: 'Map',
    icon: '🗺️',
    render: renderMapScreen,
  });

  router.addRoute({
    path: '/satellites',
    label: 'Satellites',
    icon: '🛰',
    render: renderSatelliteScreen,
  });

  router.addRoute({
    path: '/sensors',
    label: 'Sensors',
    icon: '📐',
    render: renderSensorScreen,
  });

  router.addRoute({
    path: '/route',
    label: 'Route Plan',
    icon: '🧭',
    render: renderRouteScreen,
  });

  router.addRoute({
    path: '/settings',
    label: 'Settings',
    icon: '⚙️',
    render: renderSettingsScreen,
  });

  router.addRoute({
    path: '/diagnostics',
    label: 'Diagnostics',
    icon: '⚡',
    render: renderDiagnosticsScreen,
  });

  router.addRoute({
    path: '/showcase',
    label: 'Showcase',
    icon: '🏆',
    render: renderShowcaseScreen,
  });

  // Initialize components
  new StatusBar(statusBarEl);
  new Sidebar(sidebarEl, router);
  
  const bottomNavEl = document.getElementById('mobile-bottom-nav');
  if (bottomNavEl) {
    new MobileBottomNav(bottomNavEl, router);
  }

  const techPanelEl = document.getElementById('technical-split-panel');
  if (techPanelEl) {
    technicalSplitPanelInstance = new TechnicalSplitPanel(techPanelEl);
  }

  const searchModalEl = document.getElementById('destination-search-modal');
  if (searchModalEl) {
    destinationSearchModalInstance = new DestinationSearchModal(searchModalEl, router);
  }
  
  if (DEFAULT_CONFIG.simulation.enabled && !androidBridgeService.isRunningInAndroid()) {
    new SimulationControls(document.body);
  }

  // Start router (default to /map on launch for mobile navigation)
  const initialHash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
  router.start(initialHash || '/map');

  // Auto-start GNSS telemetry
  if (androidBridgeService.isRunningInAndroid()) {
    logger.info('Running inside Android container — engaging physical Android hardware GNSS & 50 Hz IMU');
    gnssService.setSourceMode(DataSourceMode.AndroidHardware);
    gnssService.start();
  } else {
    gnssService.start();
  }

  logger.info('Application initialized successfully');

  if (DEFAULT_CONFIG.simulation.enabled && !androidBridgeService.isRunningInAndroid()) {
    logger.warn('Running in SIMULATION MODE — no real GNSS/IMU data');
  }
}

// ─── Start ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', initApp);
