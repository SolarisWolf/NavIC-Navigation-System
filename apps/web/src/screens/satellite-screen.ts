/**
 * Satellite Screen
 *
 * Detailed GNSS satellite view with sky plot, signal strength bars,
 * constellation filter toggles, real-time Dilution of Precision (DOP) metrics,
 * and dedicated hardware-grade NavIC (IRNSS) constellation detection and telemetry.
 */

import {
  type GNSSMeasurement,
  type GNSSPosition,
  type SatelliteInfo,
  type NavICSignalReport,
  Constellation,
  FixType,
} from '@navic/shared-models';
import { gnssService } from '../services/gnss-service.js';
import { positionService } from '../services/position-service.js';

let unsubscribe: (() => void) | null = null;
let unsubscribePos: (() => void) | null = null;
let unsubscribeNavIC: (() => void) | null = null;
let activeConstellations: Set<Constellation> = new Set([
  Constellation.GPS, Constellation.NavIC, Constellation.Galileo,
  Constellation.BeiDou, Constellation.GLONASS,
]);

const CONSTELLATION_COLORS: Record<string, string> = {
  [Constellation.GPS]: 'var(--color-gps)',
  [Constellation.NavIC]: 'var(--color-navic)',
  [Constellation.Galileo]: 'var(--color-galileo)',
  [Constellation.BeiDou]: 'var(--color-beidou)',
  [Constellation.GLONASS]: 'var(--color-glonass)',
};

const CONSTELLATION_CSS: Record<string, string> = {
  [Constellation.GPS]: 'gps',
  [Constellation.NavIC]: 'navic',
  [Constellation.Galileo]: 'galileo',
  [Constellation.BeiDou]: 'beidou',
  [Constellation.GLONASS]: 'glonass',
};

export function renderSatelliteScreen(container: HTMLElement): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (unsubscribePos) {
    unsubscribePos();
    unsubscribePos = null;
  }
  if (unsubscribeNavIC) {
    unsubscribeNavIC();
    unsubscribeNavIC = null;
  }

  container.innerHTML = `
    <style>
      .navic-badge-gold {
        background: rgba(255, 111, 0, 0.15) !important;
        border-color: #ff8f00 !important;
        color: #ffab00 !important;
        font-weight: 600;
      }
      .dop-badge {
        font-family: monospace;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .sat-header-badges {
        display: flex;
        gap: var(--space-2);
        align-items: center;
      }
      .navic-telemetry-card {
        border-color: rgba(255, 143, 0, 0.4) !important;
        background: linear-gradient(180deg, rgba(255, 143, 0, 0.04) 0%, rgba(13, 17, 23, 0.6) 100%), var(--bg-surface) !important;
      }
      .navic-band-chip {
        font-family: var(--font-mono);
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 3px;
        background: rgba(0, 229, 255, 0.15);
        color: #00e5ff;
        border: 1px solid rgba(0, 229, 255, 0.3);
        margin-left: 4px;
      }
    </style>

    <div class="satellite-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Satellites & NavIC Constellation</h1>
          <p class="screen__subtitle">GNSS constellation tracking, line-of-sight sky plot, DOP geometry, and NavIC L5/S detection</p>
        </div>
        <div class="sat-header-badges">
          <span class="status-badge" id="sat-navic-badge">Checking NavIC...</span>
          <span class="status-badge status-badge--idle" id="sat-fix-badge">No Fix</span>
        </div>
      </div>

      <div class="satellite-screen__layout">
        <!-- Sky Plot -->
        <div class="sky-plot">
          <div class="sky-plot__title">Sky Plot — Satellite Positions</div>
          <div class="sky-plot__canvas" id="sky-plot-canvas">
            <div class="sky-plot__ring sky-plot__ring--30"></div>
            <div class="sky-plot__ring sky-plot__ring--60"></div>
            <div class="sky-plot__axis sky-plot__axis--h"></div>
            <div class="sky-plot__axis sky-plot__axis--v"></div>
            <span class="sky-plot__cardinal sky-plot__cardinal--n">N</span>
            <span class="sky-plot__cardinal sky-plot__cardinal--s">S</span>
            <span class="sky-plot__cardinal sky-plot__cardinal--e">E</span>
            <span class="sky-plot__cardinal sky-plot__cardinal--w">W</span>
            <div id="sky-plot-dots"></div>
          </div>
        </div>

        <!-- Signal Strength Panel -->
        <div class="signal-panel">
          <div class="signal-panel__title">Signal Strength (C/N₀ dB-Hz)</div>
          <div class="signal-panel__bars" id="signal-bars">
            <div class="signal-panel__empty">Awaiting satellite data</div>
          </div>

          <div class="constellation-filters" id="constellation-filters">
            ${renderFilter('GPS', Constellation.GPS, 'gps')}
            ${renderFilter('NavIC', Constellation.NavIC, 'navic')}
            ${renderFilter('Galileo', Constellation.Galileo, 'galileo')}
            ${renderFilter('BeiDou', Constellation.BeiDou, 'beidou')}
            ${renderFilter('GLONASS', Constellation.GLONASS, 'glonass')}
          </div>
        </div>
      </div>

      <!-- NavIC Indian Constellation Dedicated Telemetry (Phase 16) -->
      <div class="section" style="margin-top: var(--space-6);">
        <div class="section__title">🇮🇳 NavIC (IRNSS) Constellation Telemetry & Signal Quality</div>
        <div class="sensor-screen__grid">
          <!-- NavIC Lock & Orbit Profile -->
          <div class="sensor-card navic-telemetry-card">
            <div class="sensor-card__header">
              <span class="sensor-card__title">NavIC Constellation Lock</span>
              <span class="sensor-card__status active-badge" id="navic-lock-status" style="background: rgba(255, 143, 0, 0.2); color: #ffab00; border-color: #ff8f00;">Detecting...</span>
            </div>
            <div class="sensor-axes">
              <div class="sensor-axis"><span class="sensor-axis__label">GEO Satellites (Fixed)</span><span class="sensor-axis__value sensor-val" id="navic-geo-count">--</span><span class="sensor-axis__unit">83°E, 32.5°E, 129.5°E</span></div>
              <div class="sensor-axis"><span class="sensor-axis__label">GSO Satellites (Figure-8)</span><span class="sensor-axis__value sensor-val" id="navic-gso-count">--</span><span class="sensor-axis__unit">55°E, 111.75°E</span></div>
              <div class="sensor-axis"><span class="sensor-axis__label">Fix Contribution</span><span class="sensor-axis__value sensor-val" id="navic-fix-assistance">--</span><span class="sensor-axis__unit">architecture</span></div>
            </div>
          </div>

          <!-- Multi-Frequency & Signal Integrity -->
          <div class="sensor-card" style="border-color: rgba(0, 229, 255, 0.3);">
            <div class="sensor-card__header">
              <span class="sensor-card__title">NavIC Multi-Band & Signal Integrity</span>
              <span class="sensor-card__status active-badge" id="navic-integrity-badge">--%</span>
            </div>
            <div class="sensor-axes">
              <div class="sensor-axis"><span class="sensor-axis__label">Active Frequencies</span><span class="sensor-axis__value sensor-val" id="navic-bands">L5 / S</span><span class="sensor-axis__unit">1176.45 / 2492.03 MHz</span></div>
              <div class="sensor-axis"><span class="sensor-axis__label">Average Signal (C/N₀)</span><span class="sensor-axis__value sensor-val" id="navic-avg-cn0">--</span><span class="sensor-axis__unit">dB-Hz</span></div>
              <div class="sensor-axis"><span class="sensor-axis__label">Sats in Solution</span><span class="sensor-axis__value sensor-val" id="navic-sats-used">--</span><span class="sensor-axis__unit">of <span id="navic-sats-total">--</span> visible</span></div>
            </div>
          </div>
        </div>

        <!-- NavIC Space Vehicle Detail List -->
        <div id="navic-sv-list" style="margin-top: var(--space-4); display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3);">
          <div style="grid-column: 1 / -1; padding: 12px; text-align: center; color: var(--text-muted); font-size: 13px;">
            Awaiting NavIC space vehicle telemetry...
          </div>
        </div>
      </div>

      <!-- Dilution of Precision (DOP) Telemetry -->
      <div class="section" style="margin-top: var(--space-6);">
        <div class="section__title">📐 Dilution of Precision (Satellite Geometry & Error Multipliers)</div>
        <div class="sensor-screen__grid">
          <!-- Horizontal & Accuracy -->
          <div class="sensor-card">
            <div class="sensor-card__header">
              <span class="sensor-card__title">Horizontal Geometry (HDOP)</span>
              <span class="sensor-card__status active-badge" id="dop-hdop-rating">Calculating</span>
            </div>
            <div class="sensor-axes">
              <div class="sensor-axis"><span class="sensor-axis__label">HDOP Value</span><span class="sensor-axis__value sensor-val" id="dop-hdop">--</span><span class="sensor-axis__unit">&lt;2 ideal</span></div>
              <div class="sensor-axis"><span class="sensor-axis__label">Est. Accuracy</span><span class="sensor-axis__value sensor-val" id="dop-hacc">--</span><span class="sensor-axis__unit">m (1σ)</span></div>
              <div class="sensor-axis"><span class="sensor-axis__label">Sats in Solution</span><span class="sensor-axis__value sensor-val" id="dop-sats-used">--</span><span class="sensor-axis__unit">satellites</span></div>
            </div>
          </div>

          <!-- 3D & Geometric DOP -->
          <div class="sensor-card">
            <div class="sensor-card__header">
              <span class="sensor-card__title">Vertical & 3D Geometry (PDOP/GDOP)</span>
              <span class="sensor-card__status active-badge" id="dop-pdop-rating">Calculating</span>
            </div>
            <div class="sensor-axes">
              <div class="sensor-axis"><span class="sensor-axis__label">VDOP</span><span class="sensor-axis__value sensor-val" id="dop-vdop">--</span><span class="sensor-axis__unit">vertical</span></div>
              <div class="sensor-axis"><span class="sensor-axis__label">PDOP</span><span class="sensor-axis__value sensor-val" id="dop-pdop">--</span><span class="sensor-axis__unit">3D position</span></div>
              <div class="sensor-axis"><span class="sensor-axis__label">GDOP</span><span class="sensor-axis__value sensor-val" id="dop-gdop">--</span><span class="sensor-axis__unit">overall</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Constellation Detail Cards -->
      <div class="satellite-details" id="constellation-details" style="margin-top: var(--space-6);">
        ${renderConstellationCard('GPS', 'gps', '📡')}
        ${renderConstellationCard('NavIC / IRNSS', 'navic', '🇮🇳')}
        ${renderConstellationCard('Galileo', 'galileo', '🇪🇺')}
        ${renderConstellationCard('BeiDou', 'beidou', '🇨🇳')}
      </div>
    </div>
  `;

  // Attach constellation filter handlers
  const filters = container.querySelectorAll('.constellation-filter');
  filters.forEach((filter) => {
    filter.addEventListener('click', () => {
      const cName = (filter as HTMLElement).dataset.constellation;
      if (!cName) return;
      const c = cName as Constellation;
      if (activeConstellations.has(c)) {
        activeConstellations.delete(c);
        filter.classList.remove('constellation-filter--active');
      } else {
        activeConstellations.add(c);
        filter.classList.add('constellation-filter--active');
      }
    });
  });

  // Subscribe to GNSS updates
  unsubscribe = gnssService.subscribe(updateSatelliteScreen);

  // Subscribe to Position Engine processed outputs for DOP
  unsubscribePos = positionService.subscribe(updateDopDisplay);

  // Subscribe to NavIC detection and signal quality updates
  unsubscribeNavIC = gnssService.subscribeNavIC(updateNavICDisplay);
}

function updateSatelliteScreen(m: GNSSMeasurement): void {
  const isNoFix = m.fixType === FixType.NoFix;

  // Fix badge
  const badge = document.getElementById('sat-fix-badge');
  if (badge) {
    if (isNoFix) {
      badge.textContent = 'No Fix';
      badge.className = 'status-badge status-badge--error';
    } else {
      badge.textContent = m.fixType === FixType.Fix3D ? '3D Fix' : '2D Fix';
      badge.className = 'status-badge status-badge--active';
    }
  }

  // Filter visible satellites by active constellations
  const visible = m.satellites.filter(s => activeConstellations.has(s.constellation));

  // Update sky plot
  updateSkyPlot(visible);

  // Update signal bars
  updateSignalBars(visible);

  // Update constellation detail cards
  updateConstellationCards(m.satellites);
}

function updateNavICDisplay(report: NavICSignalReport): void {
  const elLock = document.getElementById('navic-lock-status');
  if (elLock) {
    if (report.lockStatus === 'Full Lock') {
      elLock.textContent = `🟢 FULL LOCK (${report.usedInFix} SATS)`;
      elLock.style.background = 'rgba(16, 185, 129, 0.2)';
      elLock.style.borderColor = '#10b981';
      elLock.style.color = '#10b981';
    } else if (report.lockStatus === 'Marginal Lock') {
      elLock.textContent = `🟡 MARGINAL (${report.totalVisible} SATS)`;
      elLock.style.background = 'rgba(255, 171, 64, 0.2)';
      elLock.style.borderColor = '#ffab00';
      elLock.style.color = '#ffab00';
    } else {
      elLock.textContent = '⚪ NO SIGNAL';
      elLock.style.background = 'rgba(255, 255, 255, 0.05)';
      elLock.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      elLock.style.color = 'var(--text-muted)';
    }
  }

  const elGeo = document.getElementById('navic-geo-count');
  if (elGeo) elGeo.textContent = `${report.geoCount} GEOs`;

  const elGso = document.getElementById('navic-gso-count');
  if (elGso) elGso.textContent = `${report.gsoCount} GSOs`;

  const elFixAssistance = document.getElementById('navic-fix-assistance');
  if (elFixAssistance) elFixAssistance.textContent = report.fixAssistanceLevel;

  const elIntegrity = document.getElementById('navic-integrity-badge');
  if (elIntegrity) {
    elIntegrity.textContent = `${report.signalIntegrityScore}%`;
    elIntegrity.style.color = report.signalIntegrityScore >= 75 ? '#00e5ff' : report.signalIntegrityScore >= 40 ? '#10b981' : '#ffab00';
  }

  const elBands = document.getElementById('navic-bands');
  if (elBands) elBands.textContent = report.bandsDetected.join(' / ') || 'L5';

  const elAvgCn0 = document.getElementById('navic-avg-cn0');
  if (elAvgCn0) elAvgCn0.textContent = `${report.averageCn0}`;

  const elUsed = document.getElementById('navic-sats-used');
  if (elUsed) elUsed.textContent = `${report.usedInFix}`;

  const elTotal = document.getElementById('navic-sats-total');
  if (elTotal) elTotal.textContent = `${report.totalVisible}`;

  // Render NavIC space vehicle list
  const elList = document.getElementById('navic-sv-list');
  if (elList && report.satellites.length > 0) {
    let html = '';
    for (const sat of report.satellites) {
      const snrPct = Math.min(100, Math.max(0, (sat.snr / 50) * 100));
      const snrColor = sat.snr >= 40 ? '#00e5ff' : sat.snr >= 30 ? '#10b981' : '#ff9800';
      const usedBorder = sat.usedInFix ? 'border: 1px solid rgba(255, 143, 0, 0.4);' : 'border: 1px solid var(--border-default);';

      html += `
        <div class="sensor-card" style="padding: 10px 14px; ${usedBorder}">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; color: #ffab00;">${sat.name} (PRN ${sat.svid})</span>
            <span class="dop-badge" style="background: rgba(255, 143, 0, 0.2); color: #ffab00;">${sat.orbitType}</span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">
            ${sat.orbitalSlot} • Band: <strong style="color: #00e5ff;">${sat.frequencyBand}</strong>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
            <div style="flex: 1; margin-right: 12px; background: rgba(255, 255, 255, 0.05); height: 6px; border-radius: 3px; overflow: hidden;">
              <div style="width: ${snrPct}%; height: 100%; background: ${snrColor}; border-radius: 3px;"></div>
            </div>
            <span style="font-family: var(--font-mono); font-size: 12px; color: var(--text-primary); font-weight: 600;">${sat.snr} dB-Hz</span>
          </div>
        </div>
      `;
    }
    elList.innerHTML = html;
  }
}

function updateDopDisplay(pos: GNSSPosition): void {
  const navicBadge = document.getElementById('sat-navic-badge');
  if (navicBadge) {
    if (pos.isNavICAssisted) {
      navicBadge.textContent = `🇮🇳 NavIC Assisted (${pos.navicSatellitesUsed} sats)`;
      navicBadge.className = 'status-badge navic-badge-gold';
    } else {
      navicBadge.textContent = 'Standard Multi-GNSS';
      navicBadge.className = 'status-badge status-badge--idle';
    }
  }

  const elHdop = document.getElementById('dop-hdop');
  const elVdop = document.getElementById('dop-vdop');
  const elPdop = document.getElementById('dop-pdop');
  const elGdop = document.getElementById('dop-gdop');
  const elHacc = document.getElementById('dop-hacc');
  const elSats = document.getElementById('dop-sats-used');

  if (elHdop) elHdop.textContent = pos.dop.hdop.toFixed(2);
  if (elVdop) elVdop.textContent = pos.dop.vdop.toFixed(2);
  if (elPdop) elPdop.textContent = pos.dop.pdop.toFixed(2);
  if (elGdop) elGdop.textContent = pos.dop.gdop.toFixed(2);
  if (elHacc) elHacc.textContent = `±${pos.horizontalAccuracy.toFixed(1)}`;
  if (elSats) elSats.textContent = `${pos.satellitesUsed}`;

  const elHdopRating = document.getElementById('dop-hdop-rating');
  const elPdopRating = document.getElementById('dop-pdop-rating');

  if (elHdopRating) {
    if (pos.dop.hdop < 1.0) elHdopRating.textContent = 'Ideal (<1.0)';
    else if (pos.dop.hdop < 2.0) elHdopRating.textContent = 'Excellent (<2.0)';
    else if (pos.dop.hdop < 4.0) elHdopRating.textContent = 'Good (<4.0)';
    else elHdopRating.textContent = 'Moderate';
  }

  if (elPdopRating) {
    if (pos.dop.pdop < 2.0) elPdopRating.textContent = 'Excellent';
    else if (pos.dop.pdop < 4.0) elPdopRating.textContent = 'Good';
    else elPdopRating.textContent = 'Moderate';
  }
}

function updateSkyPlot(satellites: readonly SatelliteInfo[]): void {
  const container = document.getElementById('sky-plot-dots');
  if (!container) return;

  const RADIUS = 110;
  const CENTER_X = 130;
  const CENTER_Y = 130;

  let html = '';
  for (const s of satellites) {
    const r = RADIUS * (1 - s.elevation / 90);
    const azRad = (s.azimuth * Math.PI) / 180;
    const x = CENTER_X + r * Math.sin(azRad);
    const y = CENTER_Y - r * Math.cos(azRad);

    const css = CONSTELLATION_CSS[s.constellation] || 'unknown';
    const usedClass = s.usedInFix ? 'sky-dot--used' : '';

    html += `
      <div class="sky-dot sky-dot--${css} ${usedClass}"
           style="left: ${x - 9}px; top: ${y - 9}px;"
           title="${s.constellation} PRN ${s.svid} — El: ${s.elevation}°, Az: ${s.azimuth}°, SNR: ${s.snr} dB-Hz">
        ${s.svid}
      </div>
    `;
  }
  container.innerHTML = html;
}

function updateSignalBars(satellites: readonly SatelliteInfo[]): void {
  const container = document.getElementById('signal-bars');
  if (!container) return;

  if (satellites.length === 0) {
    container.innerHTML = '<div class="signal-panel__empty">No satellites match active filters</div>';
    return;
  }

  const sorted = [...satellites].sort((a, b) => {
    if (a.constellation !== b.constellation) {
      return a.constellation.localeCompare(b.constellation);
    }
    return a.svid - b.svid;
  });

  const MAX_SNR = 50;
  let html = '';
  for (const s of sorted) {
    const pct = Math.min(100, Math.max(0, (s.snr / MAX_SNR) * 100));
    const css = CONSTELLATION_CSS[s.constellation] || 'unknown';
    const usedClass = s.usedInFix ? 'signal-bar--used' : '';

    html += `
      <div class="signal-bar-col" title="${s.constellation} PRN ${s.svid}: ${s.snr} dB-Hz">
        <div class="signal-bar-track">
          <div class="signal-bar-fill signal-bar-fill--${css} ${usedClass}" style="height: ${pct}%"></div>
        </div>
        <span class="signal-bar-snr">${s.snr}</span>
        <span class="signal-bar-prn">${s.svid}</span>
      </div>
    `;
  }
  container.innerHTML = html;
}

function updateConstellationCards(satellites: readonly SatelliteInfo[]): void {
  const groups: Record<string, SatelliteInfo[]> = {
    gps: [], navic: [], galileo: [], beidou: [],
  };

  for (const s of satellites) {
    switch (s.constellation) {
      case Constellation.GPS: groups.gps.push(s); break;
      case Constellation.NavIC: groups.navic.push(s); break;
      case Constellation.Galileo: groups.galileo.push(s); break;
      case Constellation.BeiDou: groups.beidou.push(s); break;
    }
  }

  for (const [color, sats] of Object.entries(groups)) {
    const visible = sats.length;
    const used = sats.filter(s => s.usedInFix).length;
    const snrs = sats.map(s => s.snr);
    const avgSnr = snrs.length > 0 ? (snrs.reduce((a, b) => a + b, 0) / snrs.length).toFixed(1) : '--';
    const bestSnr = snrs.length > 0 ? Math.max(...snrs) : '--';

    const badge = document.getElementById(`${color}-sat-badge`);
    if (badge) badge.textContent = `${visible} sats`;

    setDetailMetric(`${color}-visible`, `${visible}`, visible > 0);
    setDetailMetric(`${color}-used`, `${used}`, used > 0);
    setDetailMetric(`${color}-avg-snr`, `${avgSnr} dB-Hz`, snrs.length > 0);
    setDetailMetric(`${color}-best-snr`, `${bestSnr} dB-Hz`, snrs.length > 0);
  }
}

function setDetailMetric(id: string, value: string, hasData: boolean): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
    el.className = `metric-row__value ${hasData ? '' : 'metric-row__value--empty'}`.trim();
  }
}

function renderFilter(label: string, constellation: Constellation, cssClass: string): string {
  return `
    <div class="constellation-filter constellation-filter--active" data-constellation="${constellation}">
      <span class="constellation-dot constellation-dot--${cssClass}"></span>
      ${label}
    </div>
  `;
}

function renderConstellationCard(name: string, color: string, icon: string): string {
  return `
    <div class="card" style="border-top: 2px solid var(--color-${color})">
      <div class="card__header">
        <div class="card__title">
          <span class="card__title-icon">${icon}</span>
          ${name}
        </div>
        <span class="card__badge" id="${color}-sat-badge">0 sats</span>
      </div>
      <div class="card__body">
        <div class="metric-row">
          <span class="metric-row__label">Visible</span>
          <span class="metric-row__value metric-row__value--empty" id="${color}-visible">--</span>
        </div>
        <div class="metric-row">
          <span class="metric-row__label">Used in Fix</span>
          <span class="metric-row__value metric-row__value--empty" id="${color}-used">--</span>
        </div>
        <div class="metric-row">
          <span class="metric-row__label">Avg Signal</span>
          <span class="metric-row__value metric-row__value--empty" id="${color}-avg-snr">-- dB-Hz</span>
        </div>
        <div class="metric-row">
          <span class="metric-row__label">Best Signal</span>
          <span class="metric-row__value metric-row__value--empty" id="${color}-best-snr">-- dB-Hz</span>
        </div>
      </div>
    </div>
  `;
}
