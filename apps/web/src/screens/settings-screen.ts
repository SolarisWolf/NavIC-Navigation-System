/**
 * Settings Screen
 *
 * Displays application configuration values and provides interactive controls
 * for Voice Guidance, speech synthesis, and procedural audio chimes.
 */

import { DEFAULT_CONFIG, LogLevel } from '@navic/shared-models';
import { voiceGuidanceService } from '../services/voice-guidance-service.js';

export function renderSettingsScreen(container: HTMLElement): void {
  const config = DEFAULT_CONFIG;
  const voiceSettings = voiceGuidanceService.getSettings();
  const availableVoices = voiceGuidanceService.getVoices();

  container.innerHTML = `
    <div class="settings-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Settings</h1>
          <p class="screen__subtitle">System configuration, audio preferences, and offline parameters</p>
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

  // Bind interactive handlers
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
}

function settingsRow(label: string, value: string): string {
  return `
    <div class="settings-row">
      <span class="settings-row__label">${label}</span>
      <span class="settings-row__value">${value}</span>
    </div>
  `;
}
