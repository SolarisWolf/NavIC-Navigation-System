/**
 * Satellite Screen
 *
 * Detailed GNSS satellite view with sky plot, signal strength bars,
 * constellation filter toggles, and real-time Dilution of Precision (DOP)
 * metrics from the GNSS Position Engine.
 */

import { type GNSSMeasurement, type GNSSPosition, type SatelliteInfo, Constellation, FixType } from '@navic/shared-models';
import { gnssService } from '../services/gnss-service.js';
import { positionService } from '../services/position-service.js';

let unsubscribe: (() => void) | null = null;
let unsubscribePos: (() => void) | null = null;
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
    </style>

    <div class="satellite-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Satellites & Geometry</h1>
          <p class="screen__subtitle">GNSS constellation tracking, line-of-sight sky plot, and Dilution of Precision (DOP)</p>
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
  const elSatsUsed = document.getElementById('dop-sats-used');

  const elHdopRating = document.getElementById('dop-hdop-rating');
  const elPdopRating = document.getElementById('dop-pdop-rating');

  if (pos.fixType === FixType.NoFix) {
    if (elHdop) elHdop.textContent = '--';
    if (elVdop) elVdop.textContent = '--';
    if (elPdop) elPdop.textContent = '--';
    if (elGdop) elGdop.textContent = '--';
    if (elHacc) elHacc.textContent = '--';
    if (elSatsUsed) elSatsUsed.textContent = '0';
    if (elHdopRating) elHdopRating.textContent = 'No Solution';
    if (elPdopRating) elPdopRating.textContent = 'No Solution';
    return;
  }

  if (elHdop) elHdop.textContent = pos.dop.hdop.toFixed(2);
  if (elVdop) elVdop.textContent = pos.dop.vdop.toFixed(2);
  if (elPdop) elPdop.textContent = pos.dop.pdop.toFixed(2);
  if (elGdop) elGdop.textContent = pos.dop.gdop.toFixed(2);
  if (elHacc) elHacc.textContent = `±${pos.horizontalAccuracy.toFixed(1)}`;
  if (elSatsUsed) elSatsUsed.textContent = `${pos.satellitesUsed}`;

  if (elHdopRating) {
    if (pos.dop.hdop < 1.2) elHdopRating.textContent = 'Ideal (<1.2)';
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
