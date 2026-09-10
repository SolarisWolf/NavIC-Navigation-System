/**
 * Satellite Screen
 *
 * Detailed GNSS satellite view with sky plot, signal strength bars,
 * and constellation filter toggles.
 * Subscribes to GNSS service for live data updates.
 */

import { type GNSSMeasurement, type SatelliteInfo, Constellation, FixType } from '@navic/shared-models';
import { gnssService } from '../services/gnss-service.js';

let unsubscribe: (() => void) | null = null;
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

  container.innerHTML = `
    <div class="satellite-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Satellites</h1>
          <p class="screen__subtitle">GNSS constellation tracking and signal analysis</p>
        </div>
        <span class="status-badge status-badge--idle" id="sat-fix-badge">No Fix</span>
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

      <!-- Constellation Detail Cards -->
      <div class="satellite-details" id="constellation-details">
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

function updateSkyPlot(satellites: SatelliteInfo[]): void {
  const dotsContainer = document.getElementById('sky-plot-dots');
  if (!dotsContainer) return;

  // Clear old dots
  dotsContainer.innerHTML = '';

  for (const sat of satellites) {
    const dot = document.createElement('div');
    dot.style.cssText = `
      position: absolute;
      width: ${sat.usedInFix ? '10px' : '7px'};
      height: ${sat.usedInFix ? '10px' : '7px'};
      border-radius: 50%;
      background: ${CONSTELLATION_COLORS[sat.constellation] ?? 'var(--text-muted)'};
      opacity: ${sat.usedInFix ? 1 : 0.5};
      box-shadow: ${sat.usedInFix ? `0 0 6px ${CONSTELLATION_COLORS[sat.constellation]}` : 'none'};
      transform: translate(-50%, -50%);
      transition: all 0.3s ease;
      z-index: 10;
    `;

    // Convert elevation/azimuth to x/y in the polar chart
    // elevation 90° → center, 0° → edge
    const r = (1 - sat.elevation / 90) * 0.48; // radius fraction (0.48 = edge)
    const azRad = (sat.azimuth - 90) * (Math.PI / 180); // rotate so N is up
    const x = 50 + r * 100 * Math.cos(azRad);
    const y = 50 + r * 100 * Math.sin(azRad);

    dot.style.left = `${x}%`;
    dot.style.top = `${y}%`;
    dot.title = `${CONSTELLATION_CSS[sat.constellation]?.toUpperCase() ?? '?'}-${sat.svid}\nEl: ${sat.elevation}° Az: ${sat.azimuth}°\nSNR: ${sat.snr} dB-Hz${sat.usedInFix ? ' ✓ Used' : ''}`;

    dotsContainer.appendChild(dot);
  }
}

function updateSignalBars(satellites: SatelliteInfo[]): void {
  const barsContainer = document.getElementById('signal-bars');
  if (!barsContainer) return;

  if (satellites.length === 0) {
    barsContainer.innerHTML = '<div class="signal-panel__empty">No satellites tracked</div>';
    return;
  }

  // Sort by constellation, then svid
  const sorted = [...satellites].sort((a, b) => {
    if (a.constellation !== b.constellation) return a.constellation.localeCompare(b.constellation);
    return a.svid - b.svid;
  });

  barsContainer.innerHTML = sorted.map(sat => {
    const heightPct = Math.min(100, (sat.snr / 50) * 100);
    const cssClass = CONSTELLATION_CSS[sat.constellation] ?? '';
    return `
      <div class="signal-bar" title="${cssClass.toUpperCase()}-${sat.svid}: ${sat.snr} dB-Hz">
        <div class="signal-bar__fill signal-bar__fill--${cssClass}"
             style="height: ${heightPct}%"></div>
        <span class="signal-bar__label">${sat.svid}</span>
      </div>
    `;
  }).join('');
}

function updateConstellationCards(satellites: readonly SatelliteInfo[]): void {
  const constellationMap: Record<string, { visible: number; used: number; totalSnr: number; bestSnr: number }> = {
    gps: { visible: 0, used: 0, totalSnr: 0, bestSnr: 0 },
    navic: { visible: 0, used: 0, totalSnr: 0, bestSnr: 0 },
    galileo: { visible: 0, used: 0, totalSnr: 0, bestSnr: 0 },
    beidou: { visible: 0, used: 0, totalSnr: 0, bestSnr: 0 },
  };

  for (const sat of satellites) {
    const key = CONSTELLATION_CSS[sat.constellation];
    if (key && constellationMap[key]) {
      constellationMap[key].visible++;
      if (sat.usedInFix) constellationMap[key].used++;
      constellationMap[key].totalSnr += sat.snr;
      constellationMap[key].bestSnr = Math.max(constellationMap[key].bestSnr, sat.snr);
    }
  }

  for (const [key, data] of Object.entries(constellationMap)) {
    setDetailValue(`${key}-visible`, data.visible > 0 ? `${data.visible}` : '--', data.visible > 0);
    setDetailValue(`${key}-used`, data.used > 0 ? `${data.used}` : '--', data.used > 0);
    setDetailValue(`${key}-avg-snr`, data.visible > 0 ? `${(data.totalSnr / data.visible).toFixed(1)} dB-Hz` : '-- dB-Hz', data.visible > 0);
    setDetailValue(`${key}-best-snr`, data.bestSnr > 0 ? `${data.bestSnr.toFixed(1)} dB-Hz` : '-- dB-Hz', data.bestSnr > 0);

    const badge = document.getElementById(`${key}-sat-badge`);
    if (badge) badge.textContent = `${data.visible} sats`;
  }
}

function setDetailValue(id: string, value: string, hasData: boolean): void {
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
