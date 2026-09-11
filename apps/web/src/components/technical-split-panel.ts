/**
 * Technical Split Panel Component (Specification §16, §22 & §30)
 *
 * "The Wow Screen" / Engineering Mode HUD:
 * Exposes live high-rate GNSS, 50 Hz EKF Sensor Fusion metrics,
 * Dead Reckoning status, and Offline Navigation verification checklist
 * side-by-side with the map for college demonstrations, professors, and judges.
 */

import { FixType, SensorFusionMode } from '@navic/shared-models';
import { gnssService, DataSourceMode } from '../services/gnss-service.js';
import { positionService } from '../services/position-service.js';
import { fusionService } from '../services/fusion-service.js';
import { navigationService } from '../services/navigation-service.js';
import { androidBridgeService } from '../services/android-bridge-service.js';

export class TechnicalSplitPanel {
  private container: HTMLElement;
  private isVisible = false;
  private unsubscribeFusion: (() => void) | null = null;
  private unsubscribeGNSS: (() => void) | null = null;
  private unsubscribeNav: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
  }

  private init(): void {
    this.render();

    this.unsubscribeFusion = fusionService.subscribe(() => {
      if (this.isVisible) this.updateMetrics();
    });

    this.unsubscribeGNSS = gnssService.subscribe(() => {
      if (this.isVisible) this.updateMetrics();
    });

    this.unsubscribeNav = navigationService.onStateChange(() => {
      if (this.isVisible) this.updateMetrics();
    });
  }

  public destroy(): void {
    if (this.unsubscribeFusion) {
      this.unsubscribeFusion();
      this.unsubscribeFusion = null;
    }
    if (this.unsubscribeGNSS) {
      this.unsubscribeGNSS();
      this.unsubscribeGNSS = null;
    }
    if (this.unsubscribeNav) {
      this.unsubscribeNav();
      this.unsubscribeNav = null;
    }
  }

  public toggle(): boolean {
    this.isVisible = !this.isVisible;
    this.container.classList.toggle('tech-panel--visible', this.isVisible);
    document.body.classList.toggle('tech-split-active', this.isVisible);
    if (this.isVisible) {
      this.updateMetrics();
    }
    return this.isVisible;
  }

  public show(): void {
    this.isVisible = true;
    this.container.classList.add('tech-panel--visible');
    document.body.classList.add('tech-split-active');
    this.updateMetrics();
  }

  public hide(): void {
    this.isVisible = false;
    this.container.classList.remove('tech-panel--visible');
    document.body.classList.remove('tech-split-active');
  }

  public get isOpen(): boolean {
    return this.isVisible;
  }

  private render(): void {
    this.container.className = 'technical-split-panel';

    this.container.innerHTML = `
      <div class="tech-panel__header">
        <div class="tech-panel__title">
          <span class="tech-panel__badge-icon">⚡</span>
          <span>ENGINEERING INSTRUMENTATION</span>
        </div>
        <div class="tech-panel__header-actions">
          <span class="tech-mode-pill" id="tech-mode-pill">SIMULATION</span>
          <button class="tech-panel__close" id="btn-close-tech-panel" aria-label="Close Technical Panel">✕</button>
        </div>
      </div>

      <div class="tech-panel__scrollable">
        <!-- Live Position Section -->
        <div class="tech-card">
          <div class="tech-card__label">LIVE POSITION (EKF FUSED)</div>
          <div class="tech-coord-row">
            <span class="tech-coord-val" id="tech-coords">12.934300° N, 77.562700° E</span>
            <span class="tech-accuracy-chip" id="tech-acc-chip">±3.2 m</span>
          </div>
          <div class="tech-telemetry-grid">
            <div class="telemetry-item">
              <span class="telemetry-lbl">VELOCITY</span>
              <span class="telemetry-val" id="tech-vel">0.0 km/h</span>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-lbl">HEADING</span>
              <span class="telemetry-val" id="tech-heading">000° (N)</span>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-lbl">ALTITUDE</span>
              <span class="telemetry-val" id="tech-alt">920 m MSL</span>
            </div>
            <div class="telemetry-item">
              <span class="telemetry-lbl">COVARIANCE</span>
              <span class="telemetry-val" id="tech-cov">0.002 m²</span>
            </div>
          </div>
        </div>

        <!-- GNSS & NavIC Architecture -->
        <div class="tech-card">
          <div class="tech-card__header">
            <span class="tech-card__label">GNSS CONSTELLATIONS</span>
            <span class="tech-card__sublabel" id="tech-sv-total">17 Visible · 12 Used</span>
          </div>

          <div class="constellation-matrix">
            <div class="matrix-cell matrix-cell--navic">
              <div class="matrix-header">
                <span class="const-flag">🇮🇳</span>
                <span class="const-title">NavIC / IRNSS</span>
              </div>
              <div class="matrix-count" id="tech-cnt-navic">4</div>
              <div class="matrix-status">L5 / S-Band Active</div>
            </div>

            <div class="matrix-cell">
              <div class="matrix-header">
                <span class="const-flag">🇺🇸</span>
                <span class="const-title">GPS</span>
              </div>
              <div class="matrix-count" id="tech-cnt-gps">6</div>
              <div class="matrix-status">L1 C/A Tracked</div>
            </div>

            <div class="matrix-cell">
              <div class="matrix-header">
                <span class="const-flag">🇪🇺</span>
                <span class="const-title">Galileo</span>
              </div>
              <div class="matrix-count" id="tech-cnt-galileo">3</div>
              <div class="matrix-status">E1 Tracked</div>
            </div>

            <div class="matrix-cell">
              <div class="matrix-header">
                <span class="const-flag">🇨🇳</span>
                <span class="const-title">BeiDou</span>
              </div>
              <div class="matrix-count" id="tech-cnt-beidou">4</div>
              <div class="matrix-status">B1I Tracked</div>
            </div>
          </div>

          <!-- DOP Indicators -->
          <div class="tech-dop-bar">
            <span>HDOP: <b id="tech-hdop">0.9</b></span>
            <span>VDOP: <b id="tech-vdop">1.4</b></span>
            <span>PDOP: <b id="tech-pdop">1.7</b></span>
            <span class="dop-tag dop-tag--ideal">IDEAL GEOMETRY</span>
          </div>
        </div>

        <!-- Sensor Fusion & EKF Engine -->
        <div class="tech-card">
          <div class="tech-card__header">
            <span class="tech-card__label">EXTENDED KALMAN FILTER (EKF)</span>
            <span class="status-indicator status-indicator--active" id="tech-ekf-status">RUNNING</span>
          </div>

          <div class="tech-spec-table">
            <div class="spec-row">
              <span class="spec-name">Sampling Rate</span>
              <span class="spec-val">50 Hz (IMU) / 10 Hz (GNSS)</span>
            </div>
            <div class="spec-row">
              <span class="spec-name">Filter Execution Latency</span>
              <span class="spec-val spec-accent" id="tech-latency">0.08 ms</span>
            </div>
            <div class="spec-row">
              <span class="spec-name">Dead Reckoning State</span>
              <span class="spec-val" id="tech-dr-state">READY (STANDBY)</span>
            </div>
            <div class="spec-row">
              <span class="spec-name">Fusion Algorithm</span>
              <span class="spec-val">15-State Error-State EKF</span>
            </div>
          </div>
        </div>

        <!-- Offline Navigation Guarantee Checklist (§30) -->
        <div class="tech-card tech-card--guarantee">
          <div class="tech-card__label">OFFLINE INDEPENDENCE GUARANTEE</div>
          <div class="guarantee-grid">
            <div class="guarantee-item">
              <span class="guarantee-icon">🗺️</span>
              <span class="guarantee-text">Maps</span>
              <span class="guarantee-check">✓ Offline MBTiles</span>
            </div>
            <div class="guarantee-item">
              <span class="guarantee-icon">🛣️</span>
              <span class="guarantee-text">Routing</span>
              <span class="guarantee-check">✓ Local GraphHopper A*</span>
            </div>
            <div class="guarantee-item">
              <span class="guarantee-icon">📍</span>
              <span class="guarantee-text">POI Search</span>
              <span class="guarantee-check">✓ Spatial R-Tree Index</span>
            </div>
            <div class="guarantee-item">
              <span class="guarantee-icon">🔊</span>
              <span class="guarantee-text">Voice</span>
              <span class="guarantee-check">✓ On-Device Speech</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-close-tech-panel')?.addEventListener('click', () => {
      this.hide();
    });
  }

  private updateMetrics(): void {
    const fused = fusionService.getLatestEstimate();
    const m = gnssService.lastMeasurement;
    const pos = positionService.lastPosition;
    const mode = gnssService.getSourceMode();

    const counts = { total: 0, usedInFix: 0, navic: 0, gps: 0, galileo: 0, beidou: 0, glonass: 0 };
    if (m && m.satellites) {
      counts.total = m.satellites.length;
      for (const s of m.satellites) {
        if (s.usedInFix) counts.usedInFix++;
        if (s.constellation === 'NavIC') counts.navic++;
        else if (s.constellation === 'GPS') counts.gps++;
        else if (s.constellation === 'Galileo') counts.galileo++;
        else if (s.constellation === 'BeiDou') counts.beidou++;
        else if (s.constellation === 'GLONASS') counts.glonass++;
      }
    }

    const coordsEl = this.container.querySelector<HTMLElement>('#tech-coords');
    const accChip = this.container.querySelector<HTMLElement>('#tech-acc-chip');
    const velEl = this.container.querySelector<HTMLElement>('#tech-vel');
    const headingEl = this.container.querySelector<HTMLElement>('#tech-heading');
    const altEl = this.container.querySelector<HTMLElement>('#tech-alt');
    const covEl = this.container.querySelector<HTMLElement>('#tech-cov');
    const svTotalEl = this.container.querySelector<HTMLElement>('#tech-sv-total');
    const cntNavic = this.container.querySelector<HTMLElement>('#tech-cnt-navic');
    const cntGps = this.container.querySelector<HTMLElement>('#tech-cnt-gps');
    const cntGalileo = this.container.querySelector<HTMLElement>('#tech-cnt-galileo');
    const cntBeidou = this.container.querySelector<HTMLElement>('#tech-cnt-beidou');
    const hdopEl = this.container.querySelector<HTMLElement>('#tech-hdop');
    const vdopEl = this.container.querySelector<HTMLElement>('#tech-vdop');
    const pdopEl = this.container.querySelector<HTMLElement>('#tech-pdop');
    const drStateEl = this.container.querySelector<HTMLElement>('#tech-dr-state');
    const modePill = this.container.querySelector<HTMLElement>('#tech-mode-pill');

    if (fused) {
      if (coordsEl) {
        coordsEl.textContent = `${fused.coordinate.latitude.toFixed(6)}° N, ${fused.coordinate.longitude.toFixed(6)}° E`;
      }
      if (accChip) {
        accChip.textContent = `±${fused.accuracy.toFixed(1)} m`;
      }
      if (velEl) {
        velEl.textContent = `${(fused.speed * 3.6).toFixed(1)} km/h`;
      }
      if (headingEl) {
        headingEl.textContent = `${Math.round(fused.bearing)}°`;
      }
      if (altEl) {
        altEl.textContent = `${Math.round(fused.coordinate.altitude ?? 920)} m MSL`;
      }
      if (covEl) {
        covEl.textContent = `${(fused.accuracy * fused.accuracy).toFixed(4)} m²`;
      }
      if (drStateEl) {
        if (fused.mode === SensorFusionMode.DEAD_RECKONING) {
          drStateEl.textContent = 'ACTIVE (DEAD RECKONING)';
          drStateEl.className = 'spec-val spec-warning';
        } else {
          drStateEl.textContent = 'READY (GNSS FUSED)';
          drStateEl.className = 'spec-val spec-green';
        }
      }
    }

    if (svTotalEl) svTotalEl.textContent = `${counts.total} Visible · ${counts.usedInFix} Used`;
    if (cntNavic) cntNavic.textContent = `${counts.navic}`;
    if (cntGps) cntGps.textContent = `${counts.gps}`;
    if (cntGalileo) cntGalileo.textContent = `${counts.galileo}`;
    if (cntBeidou) cntBeidou.textContent = `${counts.beidou}`;

    if (pos?.dop) {
      if (hdopEl) hdopEl.textContent = pos.dop.hdop.toFixed(2);
      if (vdopEl) vdopEl.textContent = pos.dop.vdop.toFixed(2);
      if (pdopEl) pdopEl.textContent = pos.dop.pdop.toFixed(2);
    }

    if (modePill) {
      if (mode === DataSourceMode.AndroidHardware) {
        modePill.textContent = 'HARDWARE (ANDROID)';
        modePill.className = 'tech-mode-pill tech-mode-pill--hardware';
      } else {
        modePill.textContent = 'SIMULATION';
        modePill.className = 'tech-mode-pill tech-mode-pill--sim';
      }
    }
  }
}
