/**
 * Settings Screen
 *
 * Displays application configuration values from DEFAULT_CONFIG.
 * Read-only display for Phase 1 — interactive settings in later phases.
 */

import { DEFAULT_CONFIG, LogLevel } from '@navic/shared-models';

export function renderSettingsScreen(container: HTMLElement): void {
  const config = DEFAULT_CONFIG;

  container.innerHTML = `
    <div class="settings-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Settings</h1>
          <p class="screen__subtitle">System configuration and parameters</p>
        </div>
      </div>

      <!-- System Info -->
      <div class="settings-group">
        <div class="settings-group__header">
          <span class="settings-group__header-icon">ℹ️</span>
          System Information
        </div>
        ${settingsRow('Application', config.appName)}
        ${settingsRow('Version', config.version)}
        ${settingsRow('Log Level', LogLevel[config.logLevel])}
        ${settingsRow('Architecture', 'Offline-first, on-device processing')}
      </div>

      <!-- Simulation Settings -->
      <div class="settings-group">
        <div class="settings-group__header">
          <span class="settings-group__header-icon">🧪</span>
          Simulation
        </div>
        ${settingsRow('Simulation Mode', config.simulation.enabled ? 'Enabled' : 'Disabled')}
        ${settingsRow('GNSS Update Rate', `${config.simulation.gnssUpdateRateHz} Hz`)}
        ${settingsRow('IMU Update Rate', `${config.simulation.imuUpdateRateHz} Hz`)}
        ${settingsRow('Position Noise (σ)', `${config.simulation.positionNoiseSigma} m`)}
        ${settingsRow('Speed Noise (σ)', `${config.simulation.speedNoiseSigma} m/s`)}
        ${settingsRow('Bearing Noise (σ)', `${config.simulation.bearingNoiseSigma}°`)}
        ${settingsRow('Accelerometer Noise (σ)', `${config.simulation.accelerometerNoiseSigma} m/s²`)}
        ${settingsRow('Gyroscope Noise (σ)', `${config.simulation.gyroscopeNoiseSigma} rad/s`)}
      </div>

      <!-- EKF Parameters -->
      <div class="settings-group">
        <div class="settings-group__header">
          <span class="settings-group__header-icon">⚡</span>
          Extended Kalman Filter
        </div>
        ${settingsRow('Target Latency', `${config.ekf.targetLatencyMs} ms`)}
        ${settingsRow('GNSS Timeout', `${config.ekf.gnssTimeoutMs} ms`)}
        ${settingsRow('Process Noise (Position)', `${config.ekf.processNoisePosition}`)}
        ${settingsRow('Process Noise (Velocity)', `${config.ekf.processNoiseVelocity}`)}
        ${settingsRow('Process Noise (Orientation)', `${config.ekf.processNoiseOrientation}`)}
        ${settingsRow('Measurement Noise (GNSS)', `${config.ekf.measurementNoiseGNSS}`)}
        ${settingsRow('Measurement Noise (IMU)', `${config.ekf.measurementNoiseIMU}`)}
      </div>

      <!-- Map Settings -->
      <div class="settings-group">
        <div class="settings-group__header">
          <span class="settings-group__header-icon">🗺️</span>
          Map Configuration
        </div>
        ${settingsRow('MBTiles Path', config.map.mbtilesPath)}
        ${settingsRow('POI Database', config.map.poiDatabasePath)}
        ${settingsRow('Default Center', `${config.map.defaultCenter.latitude}°N, ${config.map.defaultCenter.longitude}°E`)}
        ${settingsRow('Default Zoom', `${config.map.defaultZoom}`)}
        ${settingsRow('Zoom Range', `${config.map.minZoom} – ${config.map.maxZoom}`)}
      </div>

      <!-- Navigation Settings -->
      <div class="settings-group">
        <div class="settings-group__header">
          <span class="settings-group__header-icon">🧭</span>
          Navigation
        </div>
        ${settingsRow('Off-Route Threshold', `${config.navigation.offRouteThresholdMeters} m`)}
        ${settingsRow('Instruction Advance', `${config.navigation.instructionAdvanceMeters} m`)}
        ${settingsRow('Min Moving Speed', `${config.navigation.minimumMovingSpeedMs} m/s`)}
        ${settingsRow('Route Timeout', `${config.navigation.routeComputationTimeoutMs} ms`)}
      </div>
    </div>
  `;
}

function settingsRow(label: string, value: string): string {
  return `
    <div class="settings-row">
      <span class="settings-row__label">${label}</span>
      <span class="settings-row__value">${value}</span>
    </div>
  `;
}
