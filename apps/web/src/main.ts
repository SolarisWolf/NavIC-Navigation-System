/**
 * NavIC Navigation — Web Application Entry Point
 *
 * Initializes the SPA: router, status bar, sidebar, and all screen routes.
 */

import { Logger, LogLevel, DEFAULT_CONFIG } from '@navic/shared-models';
import { Router } from './router.js';
import { StatusBar } from './components/status-bar.js';
import { Sidebar } from './components/sidebar.js';
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

// ─── Logger Setup ────────────────────────────────────────────────────────────

const logger = new Logger('App', {
  level: LogLevel.DEBUG,
  isSimulation: DEFAULT_CONFIG.simulation.enabled,
});

// ─── Application Bootstrap ──────────────────────────────────────────────────

function initApp(): void {
  logger.info(`${DEFAULT_CONFIG.appName} v${DEFAULT_CONFIG.version} — initializing`);

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
  
  if (DEFAULT_CONFIG.simulation.enabled) {
    new SimulationControls(document.body);
  }

  // Start router
  router.start('/dashboard');

  logger.info('Application initialized successfully');

  if (DEFAULT_CONFIG.simulation.enabled) {
    logger.warn('Running in SIMULATION MODE — no real GNSS/IMU data');
  }
}

// ─── Start ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', initApp);
