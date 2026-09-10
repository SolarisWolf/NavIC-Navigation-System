/**
 * Settings Screen
 *
 * Displays application configuration values and provides interactive controls
 * for Voice Guidance, Speech synthesis, Procedural audio chimes, and
 * Hardware Sensor Source selection (Simulation vs Live Laptop GPS vs Native Android Hardware vs USB NMEA).
 */

import { DEFAULT_CONFIG, LogLevel, PowerProfileMode, VehicleDynamicsState } from '@navic/shared-models';
import { voiceGuidanceService } from '../services/voice-guidance-service.js';
import { gnssService, DataSourceMode } from '../services/gnss-service.js';
import { androidBridgeService } from '../services/android-bridge-service.js';
import { powerService } from '../services/power-service.js';

let unsubscribePowerSettings: (() => void) | null = null;

export function renderSettingsScreen(container: HTMLElement): void {
  if (unsubscribePowerSettings) {
    unsubscribePowerSettings();
    unsubscribePowerSettings = null;
  }

  const config = DEFAULT_CONFIG;
  const voiceSettings = voiceGuidanceService.getSettings();
  const availableVoices = voiceGuidanceService.getVoices();
  const currentSourceMode = gnssService.getSourceMode();
  const androidInfo = androidBridgeService.getDeviceInfo();
  const powerStatus = powerService.getStatus();

  container.innerHTML = `
    <div class="settings-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Settings</h1>
          <p class="screen__subtitle">Hardware sensor sources, voice guidance, and system configuration</p>
        </div>
      </div>

      <!-- Hardware & Sensor Sources (Phase 15) -->
      <div class="settings-group settings-group--interactive" id="hardware-settings-group">
        <div class="settings-group__header">
          <span class="settings-group__header-icon">🛰️</span>
          Hardware & Sensor Sources
        </div>

        <div class="settings-interactive-row">
          <div class="settings-interactive-row__info">
            <span class="settings-interactive-row__title">Active Data Source</span>
            <span class="settings-interactive-row__desc">Switch dynamically between physical hardware and synthetic Delhi simulations</span>
          </div>
          <select id="setting-hardware-source" class="settings-select" style="min-width: 220px; font-weight: 600;">
            <option value="simulation" ${currentSourceMode === 'simulation' ? 'selected' : ''}>🧪 Simulation Scenarios</option>
            <option value="laptop-gps" ${currentSourceMode === 'laptop-gps' ? 'selected' : ''}>🛰️ Live Laptop GPS (Real Hardware)</option>
            <option value="android-hardware" ${currentSourceMode === 'android-hardware' ? 'selected' : ''}>📱 Android Hardware (GNSS & IMU)</option>
            <option value="usb-serial" ${currentSourceMode === 'usb-serial' ? 'selected' : ''}>🔌 External USB Serial / NMEA</option>
          </select>
        </div>

        <div class="settings-interactive-row">
          <div class="settings-interactive-row__info">
            <span class="settings-interactive-row__title">Live Telemetry Feed</span>
            <span class="settings-interactive-row__desc" id="hardware-telemetry-coords">Monitoring telemetry stream...</span>
          </div>
          <span class="settings-row__value" id="hardware-mode-badge" style="color: #10b981; font-weight: 600;">
            ${gnssService.isHardware() ? '● LIVE HARDWARE' : '● SIMULATION'}
          </span>
        </div>

        ${androidInfo ? settingsRow('Android Host Hardware', `${androidInfo.brand} ${androidInfo.model} (API ${androidInfo.sdkVersion})`) : ''}
        ${androidInfo ? settingsRow('NavIC Constellation', androidInfo.isNavICSupported ? '✅ Available (CONSTELLATION_IRNSS)' : '⚠️ Standard Multi-GNSS') : ''}
        ${settingsRow('Browser Geolocation API', 'geolocation' in navigator ? '✅ Supported (Windows/Host Location)' : '❌ Not Available')}
        ${settingsRow('Web Serial API', 'serial' in navigator ? '✅ Supported (USB NMEA Receiver)' : '⚠️ Unavailable')}

        <div class="settings-test-action">
          <button class="btn btn--secondary" id="btn-use-laptop-gps">
            🛰️ Enable Laptop GPS
          </button>
          <button class="btn btn--secondary" id="btn-use-sim">
            🧪 Enable Simulation
          </button>
          <span class="settings-test-status" id="hardware-switch-status"></span>
        </div>
      </div>

      <!-- Voice Guidance & Audio (Interactive) -->
      <div class="settings-group settings-group--interactive">
        <div class="settings-group__header">
          <span class="settings-group__header-icon">🔊</span>
          Voice Guidance & Audio
        </div>

        <div class="settings-interactive-row">
          <div class="settings-interactive-row__info">
            <span class="settings-interactive-row__title">Spoken Navigation Prompts</span>
            <span class="settings-interactive-row__desc">Turn-by-turn spoken audio guidance via SpeechSynthesis</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="setting-voice-enabled" ${!voiceSettings.muted ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-interactive-row">
          <div class="settings-interactive-row__info">
            <span class="settings-interactive-row__title">Procedural Web Audio Chimes</span>
            <span class="settings-interactive-row__desc">Dual-tone notification chimes before turn maneuvers (100% offline)</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="setting-chime-enabled" ${voiceSettings.chimeEnabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-interactive-row">
          <div class="settings-interactive-row__info">
            <span class="settings-interactive-row__title">Voice Volume</span>
            <span class="settings-interactive-row__desc" id="volume-val-display">${Math.round(voiceSettings.volume * 100)}%</span>
          </div>
          <input type="range" id="setting-voice-volume" class="settings-slider" min="0" max="100" value="${Math.round(voiceSettings.volume * 100)}">
        </div>

        <div class="settings-interactive-row">
          <div class="settings-interactive-row__info">
            <span class="settings-interactive-row__title">Speech Rate</span>
            <span class="settings-interactive-row__desc" id="rate-val-display">${voiceSettings.rate.toFixed(1)}x</span>
          </div>
          <input type="range" id="setting-voice-rate" class="settings-slider" min="80" max="130" step="5" value="${Math.round(voiceSettings.rate * 100)}">
        </div>

        <div class="settings-interactive-row">
          <div class="settings-interactive-row__info">
            <span class="settings-interactive-row__title">Synthesizer Voice</span>
            <span class="settings-interactive-row__desc">Select system TTS accent</span>
          </div>
          <select id="setting-voice-select" class="settings-select">
            ${
              availableVoices.length > 0
                ? availableVoices
                    .map(
                      (v) => `
                        <option value="${v.voiceURI}" ${v.voiceURI === voiceSettings.selectedVoiceURI ? 'selected' : ''}>
                          ${v.name} (${v.lang})
                        </option>
                      `
                    )
                    .join('')
                : `<option value="">System Default</option>`
            }
          </select>
        </div>

        <div class="settings-test-action">
          <button class="btn btn--secondary" id="btn-test-voice">
            🔊 Test Voice Prompt
          </button>
          <span class="settings-test-status" id="voice-test-status"></span>
        </div>
      </div>

      <!-- Battery & Power Optimization (Phase 17) -->
      <div class="settings-group settings-group--interactive" id="power-settings-group">
        <div class="settings-group__header">
          <span class="settings-group__header-icon">⚡</span>
          Battery & Power Optimization
        </div>

        <!-- Live Battery Telemetry Card -->
        <div style="background: var(--bg-card, #1e293b); border: 1px solid var(--border-color, #334155); border-radius: 8px; padding: 14px; margin-bottom: 12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.5rem;" id="p-battery-icon">${powerStatus.battery.isCharging ? '⚡' : '🔋'}</span>
              <div>
                <span style="font-weight:700; font-size:1.2rem; color:var(--text-primary, #f8fafc);" id="p-battery-level">${powerStatus.battery.levelPercent}%</span>
                <span style="font-size:0.85rem; color:var(--text-secondary, #94a3b8); margin-left:6px;" id="p-battery-status">(${powerStatus.battery.isCharging ? 'Charging' : 'Discharging'})</span>
              </div>
            </div>
            <span class="status-badge ${powerStatus.isPowerSaverActive ? 'status-badge--warning' : 'status-badge--active'}" id="p-profile-badge">
              ${powerStatus.profileMode} (${powerStatus.activeImuRateHz} Hz)
            </span>
          </div>

          <!-- Battery level bar -->
          <div style="background: rgba(255,255,255,0.1); border-radius: 9999px; height: 8px; overflow: hidden; margin-bottom: 12px;">
            <div id="p-battery-fill" style="background: ${powerStatus.isPowerSaverActive ? 'var(--color-warning, #f59e0b)' : 'var(--color-navic, #ff9933)'}; height: 100%; width: ${powerStatus.battery.levelPercent}%; transition: width 300ms ease;"></div>
          </div>

          <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size:0.85rem;">
            <div style="color:var(--text-secondary, #94a3b8)">Estimated Runtime: <strong style="color:var(--text-primary, #f8fafc)" id="p-battery-hours">${powerStatus.battery.estimatedHoursRemaining} hrs</strong></div>
            <div style="color:var(--text-secondary, #94a3b8)">Temperature: <strong style="color:var(--text-primary, #f8fafc)" id="p-battery-temp">${powerStatus.battery.temperatureCelsius ?? 31.5} °C</strong></div>
            <div style="color:var(--text-secondary, #94a3b8)">Voltage: <strong style="color:var(--text-primary, #f8fafc)" id="p-battery-volt">${powerStatus.battery.voltageMv ?? 3950} mV</strong></div>
            <div style="color:var(--text-secondary, #94a3b8)">Vehicle Dynamics: <strong style="color:var(--text-primary, #f8fafc)" id="p-dynamics-state">${powerStatus.vehicleDynamics === VehicleDynamicsState.STATIONARY ? '🛑 STATIONARY (10 Hz)' : '🚗 IN MOTION (50 Hz)'}</strong></div>
          </div>
        </div>

        <div class="settings-interactive-row">
          <div class="settings-interactive-row__info">
            <span class="settings-interactive-row__title">Keep Screen On (WakeLock)</span>
            <span class="settings-interactive-row__desc">Keep screen illuminated continuously during active turn-by-turn navigation</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="setting-wakelock" ${powerStatus.isWakeLockActive ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-interactive-row">
          <div class="settings-interactive-row__info">
            <span class="settings-interactive-row__title">Adaptive Sensor Throttling</span>
            <span class="settings-interactive-row__desc">Throttle IMU to 10 Hz & map to 15 FPS when vehicle is stopped for > 8 seconds</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="setting-adaptive-throttle" ${powerStatus.isAdaptiveThrottlingEnabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-interactive-row">
          <div class="settings-interactive-row__info">
            <span class="settings-interactive-row__title">Power Saver Mode</span>
            <span class="settings-interactive-row__desc">Cap IMU to 25 Hz, limit map to 30 FPS, and minimize background rendering</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="setting-power-saver" ${powerStatus.isPowerSaverActive ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-interactive-row">
          <div class="settings-interactive-row__info">
            <span class="settings-interactive-row__title">Auto-Enable Threshold</span>
            <span class="settings-interactive-row__desc" id="threshold-val-display">Auto-enable power saver at ${powerStatus.autoPowerSaverThreshold}% battery</span>
          </div>
          <input type="range" id="setting-power-threshold" class="settings-slider" min="10" max="40" step="5" value="${powerStatus.autoPowerSaverThreshold}">
        </div>

        <div class="settings-test-action">
          <button class="btn btn--secondary" id="btn-simulate-battery-drop">
            🔋 Simulate -15% Battery
          </button>
          <button class="btn btn--secondary" id="btn-toggle-charging">
            ⚡ Toggle Charger Plugged
          </button>
          <span class="settings-test-status" id="power-test-status"></span>
        </div>
      </div>

      <!-- Navigation Parameters -->
      <div class="settings-group">
        <div class="settings-group__header">
          <span class="settings-group__header-icon">🧭</span>
          Navigation Parameters
        </div>
        ${settingsRow('Off-Route Threshold', `${config.navigation.offRouteThresholdMeters} m (3-sample debounce)`)}
        ${settingsRow('Instruction Advance', `${config.navigation.instructionAdvanceMeters} m`)}
        ${settingsRow('Min Moving Speed', `${config.navigation.minimumMovingSpeedMs} m/s`)}
        ${settingsRow('Route Timeout', `${config.navigation.routeComputationTimeoutMs} ms`)}
        ${settingsRow('Advance Warning Distance', '300 m (450 m at >50 km/h)')}
        ${settingsRow('Approach Warning Distance', '100 m')}
        ${settingsRow('Immediate Maneuver Distance', '30 m')}
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
    </div>
  `;

  // Bind hardware source handlers
  const hardwareSelect = document.getElementById('setting-hardware-source') as HTMLSelectElement | null;
  const hardwareCoords = document.getElementById('hardware-telemetry-coords');
  const hardwareBadge = document.getElementById('hardware-mode-badge');
  const hardwareStatus = document.getElementById('hardware-switch-status');
  const btnUseLaptop = document.getElementById('btn-use-laptop-gps');
  const btnUseSim = document.getElementById('btn-use-sim');

  const updateTelemetryDisplay = () => {
    const lastM = gnssService.lastMeasurement;
    if (hardwareCoords && lastM) {
      const mode = gnssService.getSourceMode();
      const prefix = mode === DataSourceMode.Simulation ? '[SIM]' : '[LIVE]';
      hardwareCoords.textContent = `${prefix} ${lastM.latitude.toFixed(5)}°N, ${lastM.longitude.toFixed(5)}°E | ${(lastM.speed * 3.6).toFixed(1)} km/h | Acc: ±${lastM.horizontalAccuracy.toFixed(1)}m`;
    }
    if (hardwareBadge) {
      if (gnssService.isHardware()) {
        hardwareBadge.textContent = '● LIVE HARDWARE';
        hardwareBadge.style.color = '#10b981';
      } else {
        hardwareBadge.textContent = '● SIMULATION';
        hardwareBadge.style.color = '#ff9800';
      }
    }
  };

  updateTelemetryDisplay();
  const telemetryInterval = setInterval(updateTelemetryDisplay, 1000);

  hardwareSelect?.addEventListener('change', async () => {
    const mode = hardwareSelect.value as DataSourceMode;
    await gnssService.setSourceMode(mode);
    if (hardwareStatus) {
      hardwareStatus.textContent = `Source switched to ${mode}`;
      setTimeout(() => { if (hardwareStatus) hardwareStatus.textContent = ''; }, 3000);
    }
    updateTelemetryDisplay();
  });

  btnUseLaptop?.addEventListener('click', async () => {
    await gnssService.setSourceMode(DataSourceMode.LiveLaptopGPS);
    if (hardwareSelect) hardwareSelect.value = 'laptop-gps';
    if (hardwareStatus) {
      hardwareStatus.textContent = 'Active: Live Laptop/Device GPS';
      setTimeout(() => { if (hardwareStatus) hardwareStatus.textContent = ''; }, 3000);
    }
    updateTelemetryDisplay();
  });

  btnUseSim?.addEventListener('click', async () => {
    await gnssService.setSourceMode(DataSourceMode.Simulation);
    if (hardwareSelect) hardwareSelect.value = 'simulation';
    if (hardwareStatus) {
      hardwareStatus.textContent = 'Active: Simulation Scenarios';
      setTimeout(() => { if (hardwareStatus) hardwareStatus.textContent = ''; }, 3000);
    }
    updateTelemetryDisplay();
  });

  // Bind voice handlers
  const voiceToggle = document.getElementById('setting-voice-enabled') as HTMLInputElement | null;
  const chimeToggle = document.getElementById('setting-chime-enabled') as HTMLInputElement | null;
  const volumeSlider = document.getElementById('setting-voice-volume') as HTMLInputElement | null;
  const volumeDisplay = document.getElementById('volume-val-display');
  const rateSlider = document.getElementById('setting-voice-rate') as HTMLInputElement | null;
  const rateDisplay = document.getElementById('rate-val-display');
  const voiceSelect = document.getElementById('setting-voice-select') as HTMLSelectElement | null;
  const btnTestVoice = document.getElementById('btn-test-voice');
  const testStatus = document.getElementById('voice-test-status');

  voiceToggle?.addEventListener('change', () => {
    voiceGuidanceService.setMuted(!voiceToggle.checked);
  });

  chimeToggle?.addEventListener('change', () => {
    voiceGuidanceService.setChimeEnabled(chimeToggle.checked);
  });

  volumeSlider?.addEventListener('input', () => {
    const val = parseInt(volumeSlider.value, 10);
    voiceGuidanceService.setVolume(val / 100);
    if (volumeDisplay) volumeDisplay.textContent = `${val}%`;
  });

  rateSlider?.addEventListener('input', () => {
    const val = parseInt(rateSlider.value, 10) / 100;
    voiceGuidanceService.setRate(val);
    if (rateDisplay) rateDisplay.textContent = `${val.toFixed(1)}x`;
  });

  voiceSelect?.addEventListener('change', () => {
    voiceGuidanceService.setSelectedVoice(voiceSelect.value);
  });

  btnTestVoice?.addEventListener('click', () => {
    if (testStatus) {
      testStatus.textContent = 'Playing test audio prompt...';
      setTimeout(() => {
        if (testStatus) testStatus.textContent = '';
      }, 4000);
    }
    voiceGuidanceService.testVoice('In 200 meters, turn right onto Barakhamba Road.');
  });

  // Bind battery & power optimization handlers
  const wakelockToggle = document.getElementById('setting-wakelock') as HTMLInputElement | null;
  const adaptiveThrottleToggle = document.getElementById('setting-adaptive-throttle') as HTMLInputElement | null;
  const powerSaverToggle = document.getElementById('setting-power-saver') as HTMLInputElement | null;
  const powerThresholdSlider = document.getElementById('setting-power-threshold') as HTMLInputElement | null;
  const thresholdDisplay = document.getElementById('threshold-val-display');
  const btnSimulateDrop = document.getElementById('btn-simulate-battery-drop');
  const btnToggleCharging = document.getElementById('btn-toggle-charging');
  const powerTestStatus = document.getElementById('power-test-status');

  wakelockToggle?.addEventListener('change', async () => {
    if (wakelockToggle.checked) {
      await powerService.requestWakeLock();
    } else {
      await powerService.releaseWakeLock();
    }
  });

  adaptiveThrottleToggle?.addEventListener('change', () => {
    powerService.setAdaptiveThrottlingEnabled(adaptiveThrottleToggle.checked);
  });

  powerSaverToggle?.addEventListener('change', () => {
    powerService.setPowerSaverMode(powerSaverToggle.checked);
  });

  powerThresholdSlider?.addEventListener('input', () => {
    const val = parseInt(powerThresholdSlider.value, 10);
    powerService.setAutoPowerSaverThreshold(val);
    if (thresholdDisplay) thresholdDisplay.textContent = `Auto-enable power saver at ${val}% battery`;
  });

  btnSimulateDrop?.addEventListener('click', () => {
    const current = powerService.getStatus().battery.levelPercent;
    const nextLevel = Math.max(5, current - 15);
    (powerService as any).optimizer.updateBattery({ levelPercent: nextLevel, isCharging: false });
    if (powerTestStatus) {
      powerTestStatus.textContent = `Simulated battery drop to ${nextLevel}%`;
      setTimeout(() => { if (powerTestStatus) powerTestStatus.textContent = ''; }, 3000);
    }
  });

  btnToggleCharging?.addEventListener('click', () => {
    const isCharging = !powerService.getStatus().battery.isCharging;
    (powerService as any).optimizer.updateBattery({ isCharging, chargingSource: isCharging ? 'USB' : 'UNKNOWN' });
    if (powerTestStatus) {
      powerTestStatus.textContent = isCharging ? 'Charger connected (USB)' : 'Charger disconnected';
      setTimeout(() => { if (powerTestStatus) powerTestStatus.textContent = ''; }, 3000);
    }
  });

  // Subscribe to live power status updates to update the Settings screen card
  unsubscribePowerSettings = powerService.subscribe((status) => {
    const iconEl = document.getElementById('p-battery-icon');
    const levelEl = document.getElementById('p-battery-level');
    const statusEl = document.getElementById('p-battery-status');
    const badgeEl = document.getElementById('p-profile-badge');
    const fillEl = document.getElementById('p-battery-fill');
    const hoursEl = document.getElementById('p-battery-hours');
    const tempEl = document.getElementById('p-battery-temp');
    const voltEl = document.getElementById('p-battery-volt');
    const dynEl = document.getElementById('p-dynamics-state');

    if (levelEl) levelEl.textContent = `${status.battery.levelPercent}%`;
    if (iconEl) iconEl.textContent = status.battery.isCharging ? '⚡' : '🔋';
    if (statusEl) statusEl.textContent = `(${status.battery.isCharging ? 'Charging' : 'Discharging'})`;
    if (fillEl) {
      fillEl.style.width = `${status.battery.levelPercent}%`;
      fillEl.style.background = status.isPowerSaverActive ? 'var(--color-warning, #f59e0b)' : 'var(--color-navic, #ff9933)';
    }
    if (badgeEl) {
      badgeEl.textContent = `${status.profileMode} (${status.activeImuRateHz} Hz)`;
      badgeEl.className = `status-badge ${status.isPowerSaverActive ? 'status-badge--warning' : 'status-badge--active'}`;
    }
    if (hoursEl) hoursEl.textContent = `${status.battery.estimatedHoursRemaining} hrs`;
    if (tempEl) tempEl.textContent = `${status.battery.temperatureCelsius ?? 31.5} °C`;
    if (voltEl) voltEl.textContent = `${status.battery.voltageMv ?? 3950} mV`;
    if (dynEl) {
      dynEl.textContent = status.vehicleDynamics === VehicleDynamicsState.STATIONARY
        ? '🛑 STATIONARY (10 Hz)'
        : '🚗 IN MOTION (50 Hz)';
    }

    if (powerSaverToggle && powerSaverToggle.checked !== status.isPowerSaverActive) {
      powerSaverToggle.checked = status.isPowerSaverActive;
    }
  });
}

function settingsRow(label: string, value: string): string {
  return `
    <div class="settings-row">
      <span class="settings-row__label">${label}</span>
      <span class="settings-row__value">${value}</span>
    </div>
  `;
}
