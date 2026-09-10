/**
 * Status Bar Component
 *
 * Top bar showing: Logo, GNSS status, simulation / live hardware badge, and clock.
 * Subscribes to GNSS service for status updates and dynamic source switching.
 */

import { DEFAULT_CONFIG, FixType, type NavICSignalReport } from '@navic/shared-models';
import { qs, formatTime } from '../utils/dom.js';
import { gnssService, DataSourceMode } from '../services/gnss-service.js';
import { offlineService, OfflineStatus } from '../services/offline-service.js';

export class StatusBar {
  private container: HTMLElement;
  private clockInterval: number | null = null;
  private unsubscribeGNSS: (() => void) | null = null;
  private unsubscribeOffline: (() => void) | null = null;
  private unsubscribeSource: (() => void) | null = null;
  private unsubscribeNavIC: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    this.startClock();
    
    // Subscribe to GNSS measurement state
    this.unsubscribeGNSS = gnssService.subscribe((m) => {
      this.updateGNSSIndicator(m.fixType);
    });

    // Subscribe to Offline service state
    this.unsubscribeOffline = offlineService.subscribe((status) => {
      this.updateOfflineIndicator(status);
    });

    // Subscribe to Hardware Data Source mode changes
    this.unsubscribeSource = gnssService.onSourceModeChange((mode) => {
      this.updateSourceBadge(mode);
    });

    // Subscribe to NavIC constellation report updates
    this.unsubscribeNavIC = gnssService.subscribeNavIC((report) => {
      this.updateNavICIndicator(report);
    });
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="status-bar__left">
        <div class="status-bar__logo">
          <div class="status-bar__logo-icon">🛰</div>
          <span class="status-bar__logo-text">NavIC Nav</span>
        </div>
      </div>

      <div class="status-bar__center">
        <div class="status-bar__indicator" id="gnss-indicator">
          <span class="status-bar__dot status-bar__dot--error" id="gnss-dot"></span>
          <span id="gnss-text">GNSS: No Fix</span>
        </div>
        <div class="status-bar__indicator" id="navic-indicator" style="cursor: pointer;" title="Click to view NavIC Constellation telemetry">
          <span class="status-bar__dot" id="navic-dot" style="background:var(--color-navic, #ff9933); opacity: 0.5;"></span>
          <span id="navic-text">NavIC: --</span>
        </div>
        <div class="status-bar__indicator" id="ekf-indicator">
          <span class="status-bar__dot"></span>
          <span>EKF: Idle</span>
        </div>
        <div class="status-bar__indicator" id="nav-indicator">
          <span class="status-bar__dot"></span>
          <span>Nav: Idle</span>
        </div>
        <div class="status-bar__indicator" id="offline-indicator" style="cursor: pointer;" title="Click to view Diagnostics">
          <span class="status-bar__dot status-bar__dot--active" id="offline-dot"></span>
          <span id="offline-text">Offline Ready</span>
        </div>
      </div>

      <div class="status-bar__right">
        <span class="status-bar__sim-badge" id="source-badge" title="Click to change hardware source">🧪 [SIMULATION MODE]</span>
        <span class="status-bar__clock" id="status-clock">${formatTime()}</span>
      </div>
    `;

    // Click on NavIC indicator navigates to satellites screen
    const navicInd = qs('#navic-indicator', this.container);
    navicInd?.addEventListener('click', () => {
      window.location.hash = '#/satellites';
    });

    // Click on offline indicator navigates to diagnostics
    const offlineInd = qs('#offline-indicator', this.container);
    offlineInd?.addEventListener('click', () => {
      window.location.hash = '#/diagnostics';
    });

    // Click on source badge navigates to settings hardware configuration
    const sourceBadge = qs('#source-badge', this.container);
    sourceBadge?.addEventListener('click', () => {
      window.location.hash = '#/settings';
    });
  }

  private updateSourceBadge(mode: DataSourceMode): void {
    const badge = qs('#source-badge', this.container);
    if (!badge) return;

    switch (mode) {
      case DataSourceMode.Simulation:
        badge.className = 'status-bar__sim-badge';
        badge.textContent = '🧪 [SIMULATION MODE]';
        badge.title = 'Data Source: Simulated Route. Click to switch hardware source.';
        break;
      case DataSourceMode.LiveLaptopGPS:
        badge.className = 'status-bar__hardware-badge';
        badge.textContent = '🛰️ [LIVE HARDWARE: LAPTOP]';
        badge.title = 'Data Source: Real Laptop/Device Geolocation. Click to configure.';
        break;
      case DataSourceMode.AndroidHardware:
        badge.className = 'status-bar__hardware-badge';
        badge.textContent = '📱 [LIVE HARDWARE: ANDROID]';
        badge.title = 'Data Source: Native Android GNSS & 50 Hz IMU. Click to configure.';
        break;
      case DataSourceMode.USBSerial:
        badge.className = 'status-bar__hardware-badge';
        badge.textContent = '🔌 [LIVE HARDWARE: USB NMEA]';
        badge.title = 'Data Source: USB Serial NMEA Receiver. Click to configure.';
        break;
    }
  }

  private updateGNSSIndicator(fixType: FixType): void {
    const dot = qs('#gnss-dot', this.container);
    const text = qs('#gnss-text', this.container);
    
    if (dot && text) {
      if (fixType === FixType.NoFix) {
        dot.className = 'status-bar__dot status-bar__dot--error';
        text.textContent = 'GNSS: No Fix';
      } else {
        dot.className = 'status-bar__dot status-bar__dot--active';
        text.textContent = `GNSS: ${fixType === FixType.Fix3D ? '3D Fix' : '2D Fix'}`;
      }
    }
  }

  private updateOfflineIndicator(status: OfflineStatus): void {
    const dot = qs('#offline-dot', this.container);
    const text = qs('#offline-text', this.container);

    if (dot && text) {
      if (status.isSimulatedOffline) {
        dot.className = 'status-bar__dot status-bar__dot--warning';
        text.textContent = 'Offline Mode';
      } else if (!status.isOnline) {
        dot.className = 'status-bar__dot status-bar__dot--active';
        text.textContent = 'Offline Cache';
      } else {
        dot.className = 'status-bar__dot status-bar__dot--active';
        text.textContent = 'Offline Ready';
      }
    }
  }

  private updateNavICIndicator(report: NavICSignalReport): void {
    const dot = qs('#navic-dot', this.container);
    const text = qs('#navic-text', this.container);
    if (!dot || !text) return;

    if (report.lockStatus === 'Full Lock') {
      dot.className = 'status-bar__dot status-bar__dot--navic';
      dot.style.background = 'var(--color-navic, #ff9933)';
      dot.style.boxShadow = '0 0 8px rgba(255, 153, 51, 0.6)';
      dot.style.opacity = '1';
      text.textContent = `NavIC: ${report.usedInFix}/${report.totalVisible} SVs 🇮🇳`;
    } else if (report.lockStatus === 'Marginal Lock') {
      dot.className = 'status-bar__dot status-bar__dot--warning';
      dot.style.background = '';
      dot.style.boxShadow = '';
      dot.style.opacity = '1';
      text.textContent = `NavIC: ${report.totalVisible} SVs (Marginal)`;
    } else {
      dot.className = 'status-bar__dot status-bar__dot--idle';
      dot.style.background = 'var(--color-navic, #ff9933)';
      dot.style.boxShadow = '';
      dot.style.opacity = '0.4';
      text.textContent = 'NavIC: No Signal';
    }
  }

  private startClock(): void {
    this.clockInterval = window.setInterval(() => {
      const clockEl = qs('#status-clock');
      if (clockEl) {
        clockEl.textContent = formatTime();
      }
    }, 1000);
  }

  destroy(): void {
    if (this.clockInterval !== null) {
      clearInterval(this.clockInterval);
    }
    if (this.unsubscribeGNSS) {
      this.unsubscribeGNSS();
    }
    if (this.unsubscribeOffline) {
      this.unsubscribeOffline();
    }
    if (this.unsubscribeSource) {
      this.unsubscribeSource();
    }
    if (this.unsubscribeNavIC) {
      this.unsubscribeNavIC();
    }
  }
}

