/**
 * Status Bar Component
 *
 * Top bar showing: Logo, GNSS status, simulation badge, and clock.
 * Subscribes to GNSS service for status updates.
 */

import { DEFAULT_CONFIG, FixType } from '@navic/shared-models';
import { qs, formatTime } from '../utils/dom.js';
import { gnssService } from '../services/gnss-service.js';

export class StatusBar {
  private container: HTMLElement;
  private clockInterval: number | null = null;
  private unsubscribeGNSS: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    this.startClock();
    
    // Subscribe to GNSS simulator state
    this.unsubscribeGNSS = gnssService.subscribe((m) => {
      this.updateGNSSIndicator(m.fixType);
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
        <div class="status-bar__indicator" id="ekf-indicator">
          <span class="status-bar__dot"></span>
          <span>EKF: Idle</span>
        </div>
        <div class="status-bar__indicator" id="nav-indicator">
          <span class="status-bar__dot"></span>
          <span>Nav: Idle</span>
        </div>
      </div>

      <div class="status-bar__right">
        ${DEFAULT_CONFIG.simulation.enabled
          ? '<span class="status-bar__sim-badge">⚠ Simulation</span>'
          : ''
        }
        <span class="status-bar__clock" id="status-clock">${formatTime()}</span>
      </div>
    `;
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
  }
}
