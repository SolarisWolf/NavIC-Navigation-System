/**
 * GNSS Quality Overlay Component
 *
 * An elegant, non-intrusive floating indicator for the map screen.
 * Displays compact accuracy and NavIC counts, and expands on tap
 * into a rich GNSS status drawer without overwhelming normal drivers.
 */

import { FixType } from '@navic/shared-models';
import { gnssService, DataSourceMode } from '../services/gnss-service.js';
import { positionService } from '../services/position-service.js';
import type { Router } from '../router.js';

export class GNSSQualityPill {
  private container: HTMLElement;
  private router?: Router;
  private unsubscribeGNSS: (() => void) | null = null;
  private isExpanded = false;

  constructor(container: HTMLElement, router?: Router) {
    this.container = container;
    this.router = router;
    this.init();
  }

  private init(): void {
    this.render();

    this.unsubscribeGNSS = gnssService.subscribe(() => {
      this.updateData();
    });

    // Close drawer when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isExpanded && !this.container.contains(e.target as Node)) {
        this.isExpanded = false;
        this.updateDrawerVisibility();
      }
    });
  }

  public destroy(): void {
    if (this.unsubscribeGNSS) {
      this.unsubscribeGNSS();
      this.unsubscribeGNSS = null;
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="gnss-pill-wrapper">
        <!-- Compact Pill -->
        <button class="gnss-quality-pill" id="gnss-quality-pill-btn" aria-label="GNSS Status">
          <span class="gnss-dot gnss-dot--active" id="gnss-pill-dot"></span>
          <span class="gnss-pill-text" id="gnss-pill-text">GNSS ● 3.2m · NavIC 4</span>
          <span class="gnss-pill-badge" id="gnss-pill-badge">SIM</span>
        </button>

        <!-- Expandable Drawer -->
        <div class="gnss-drawer" id="gnss-drawer" style="display: none;">
          <div class="gnss-drawer__header">
            <div class="gnss-drawer__title">
              <span class="gnss-drawer__icon">🛰️</span>
              <span>GNSS Positioning Status</span>
            </div>
            <button class="gnss-drawer__close" id="gnss-drawer-close-btn" aria-label="Close">✕</button>
          </div>

          <div class="gnss-drawer__body">
            <!-- Fix & Accuracy Grid -->
            <div class="gnss-metric-grid">
              <div class="gnss-metric-card">
                <span class="gnss-metric-lbl">FIX STATUS</span>
                <span class="gnss-metric-val" id="gnss-drawer-fix">3D Fix</span>
              </div>
              <div class="gnss-metric-card">
                <span class="gnss-metric-lbl">ACCURACY</span>
                <span class="gnss-metric-val gnss-val--accent" id="gnss-drawer-acc">±3.2 m</span>
              </div>
            </div>

            <!-- Satellites Summary -->
            <div class="gnss-drawer__section-title">
              <span>SATELLITES</span>
              <span class="gnss-drawer__badge" id="gnss-drawer-sv-count">17 visible · 12 used</span>
            </div>

            <!-- Constellations List -->
            <div class="gnss-constellation-list">
              <div class="gnss-constellation-row gnss-constellation-row--navic">
                <span class="const-name">🇮🇳 NavIC / IRNSS</span>
                <span class="const-count" id="gnss-cnt-navic">4</span>
              </div>
              <div class="gnss-constellation-row">
                <span class="const-name">🇺🇸 GPS</span>
                <span class="const-count" id="gnss-cnt-gps">6</span>
              </div>
              <div class="gnss-constellation-row">
                <span class="const-name">🇪🇺 Galileo</span>
                <span class="const-count" id="gnss-cnt-galileo">3</span>
              </div>
              <div class="gnss-constellation-row">
                <span class="const-name">🇨🇳 BeiDou</span>
                <span class="const-count" id="gnss-cnt-beidou">4</span>
              </div>
            </div>

            <!-- Dilution of Precision (DOP) -->
            <div class="gnss-drawer__section-title">
              <span>GEOMETRY (DOP)</span>
            </div>
            <div class="gnss-dop-row">
              <div class="gnss-dop-item">
                <span class="dop-lbl">HDOP</span>
                <span class="dop-val" id="gnss-dop-hdop">0.9</span>
              </div>
              <div class="gnss-dop-item">
                <span class="dop-lbl">VDOP</span>
                <span class="dop-val" id="gnss-dop-vdop">1.4</span>
              </div>
              <div class="gnss-dop-item">
                <span class="dop-lbl">PDOP</span>
                <span class="dop-val" id="gnss-dop-pdop">1.7</span>
              </div>
            </div>

            <!-- Source Mode Info -->
            <div class="gnss-source-indicator" id="gnss-drawer-source">
              <span class="source-dot"></span>
              <span class="source-text" id="gnss-source-text">SIMULATION MODE</span>
            </div>

            <!-- Jump to Full GNSS Screen -->
            <button class="btn btn--outline btn--sm gnss-full-view-btn" id="btn-open-full-gnss">
              Open Sky-View & Signal Details →
            </button>
          </div>
        </div>
      </div>
    `;

    // Click handler for toggling drawer
    this.container.querySelector('#gnss-quality-pill-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isExpanded = !this.isExpanded;
      this.updateDrawerVisibility();
    });

    this.container.querySelector('#gnss-drawer-close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isExpanded = false;
      this.updateDrawerVisibility();
    });

    this.container.querySelector('#btn-open-full-gnss')?.addEventListener('click', () => {
      this.isExpanded = false;
      this.updateDrawerVisibility();
      if (this.router) {
        this.router.navigate('/satellites');
      } else {
        window.location.hash = '#/satellites';
      }
    });

    this.updateData();
  }

  private updateDrawerVisibility(): void {
    const drawer = this.container.querySelector<HTMLElement>('#gnss-drawer');
    if (drawer) {
      drawer.style.display = this.isExpanded ? 'block' : 'none';
    }
  }

  private updateData(): void {
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

    const pillDot = this.container.querySelector<HTMLElement>('#gnss-pill-dot');
    const pillText = this.container.querySelector<HTMLElement>('#gnss-pill-text');
    const pillBadge = this.container.querySelector<HTMLElement>('#gnss-pill-badge');

    const hasFix = m && m.fixType !== FixType.NoFix;
    const accuracyStr = m ? `${m.horizontalAccuracy.toFixed(1)}m` : 'No Fix';
    const navicCount = counts.navic;

    // Compact pill text
    if (pillText) {
      if (hasFix) {
        pillText.textContent = `GNSS ● ${accuracyStr} · NavIC ${navicCount}`;
      } else {
        pillText.textContent = `GNSS ● Awaiting Fix`;
      }
    }

    if (pillDot) {
      pillDot.className = `gnss-dot ${hasFix ? 'gnss-dot--active' : 'gnss-dot--idle'}`;
    }

    if (pillBadge) {
      if (mode === DataSourceMode.AndroidHardware) {
        pillBadge.textContent = 'HARDWARE';
        pillBadge.className = 'gnss-pill-badge gnss-pill-badge--hardware';
      } else {
        pillBadge.textContent = 'SIM';
        pillBadge.className = 'gnss-pill-badge gnss-pill-badge--sim';
      }
    }

    // Drawer elements
    const fixEl = this.container.querySelector<HTMLElement>('#gnss-drawer-fix');
    const accEl = this.container.querySelector<HTMLElement>('#gnss-drawer-acc');
    const svCountEl = this.container.querySelector<HTMLElement>('#gnss-drawer-sv-count');
    const cntNavic = this.container.querySelector<HTMLElement>('#gnss-cnt-navic');
    const cntGps = this.container.querySelector<HTMLElement>('#gnss-cnt-gps');
    const cntGalileo = this.container.querySelector<HTMLElement>('#gnss-cnt-galileo');
    const cntBeidou = this.container.querySelector<HTMLElement>('#gnss-cnt-beidou');
    const hdopEl = this.container.querySelector<HTMLElement>('#gnss-dop-hdop');
    const vdopEl = this.container.querySelector<HTMLElement>('#gnss-dop-vdop');
    const pdopEl = this.container.querySelector<HTMLElement>('#gnss-dop-pdop');
    const sourceText = this.container.querySelector<HTMLElement>('#gnss-source-text');

    if (fixEl) fixEl.textContent = m ? m.fixType : 'No Fix';
    if (accEl) accEl.textContent = m ? `±${m.horizontalAccuracy.toFixed(1)} m` : '--';
    if (svCountEl) svCountEl.textContent = `${counts.total} visible · ${counts.usedInFix} used`;
    if (cntNavic) cntNavic.textContent = `${counts.navic}`;
    if (cntGps) cntGps.textContent = `${counts.gps}`;
    if (cntGalileo) cntGalileo.textContent = `${counts.galileo}`;
    if (cntBeidou) cntBeidou.textContent = `${counts.beidou}`;
    if (hdopEl) hdopEl.textContent = pos?.dop ? `${pos.dop.hdop.toFixed(2)}` : '--';
    if (vdopEl) vdopEl.textContent = pos?.dop ? `${pos.dop.vdop.toFixed(2)}` : '--';
    if (pdopEl) pdopEl.textContent = pos?.dop ? `${pos.dop.pdop.toFixed(2)}` : '--';

    if (sourceText) {
      if (mode === DataSourceMode.AndroidHardware) {
        sourceText.textContent = 'REAL HARDWARE (ANDROID)';
        sourceText.parentElement?.classList.add('source--hardware');
      } else {
        sourceText.textContent = 'SIMULATION MODE';
        sourceText.parentElement?.classList.remove('source--hardware');
      }
    }
  }
}
