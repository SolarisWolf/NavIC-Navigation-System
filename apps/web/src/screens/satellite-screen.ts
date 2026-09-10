/**
 * Satellite Screen
 *
 * Detailed GNSS satellite view with sky plot, signal strength bars,
 * and constellation filter toggles.
 * Shows empty frames until the GNSS simulator (Phase 2) provides data.
 */

export function renderSatelliteScreen(container: HTMLElement): void {
  container.innerHTML = `
    <div class="satellite-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Satellites</h1>
          <p class="screen__subtitle">GNSS constellation tracking and signal analysis</p>
        </div>
        <span class="status-badge status-badge--idle">No Fix</span>
      </div>

      <div class="satellite-screen__layout">
        <!-- Sky Plot -->
        <div class="sky-plot">
          <div class="sky-plot__title">Sky Plot — Satellite Positions</div>
          <div class="sky-plot__canvas">
            <div class="sky-plot__ring sky-plot__ring--30"></div>
            <div class="sky-plot__ring sky-plot__ring--60"></div>
            <div class="sky-plot__axis sky-plot__axis--h"></div>
            <div class="sky-plot__axis sky-plot__axis--v"></div>
            <span class="sky-plot__cardinal sky-plot__cardinal--n">N</span>
            <span class="sky-plot__cardinal sky-plot__cardinal--s">S</span>
            <span class="sky-plot__cardinal sky-plot__cardinal--e">E</span>
            <span class="sky-plot__cardinal sky-plot__cardinal--w">W</span>
            <span class="sky-plot__empty-label">Awaiting satellite data</span>
          </div>
        </div>

        <!-- Signal Strength Panel -->
        <div class="signal-panel">
          <div class="signal-panel__title">Signal Strength (C/N₀)</div>
          <div class="signal-panel__bars">
            <div class="signal-panel__empty">No satellites tracked</div>
          </div>

          <div class="constellation-filters">
            <div class="constellation-filter constellation-filter--active">
              <span class="constellation-dot constellation-dot--gps"></span>
              GPS
            </div>
            <div class="constellation-filter constellation-filter--active">
              <span class="constellation-dot constellation-dot--navic"></span>
              NavIC
            </div>
            <div class="constellation-filter constellation-filter--active">
              <span class="constellation-dot constellation-dot--galileo"></span>
              Galileo
            </div>
            <div class="constellation-filter constellation-filter--active">
              <span class="constellation-dot constellation-dot--beidou"></span>
              BeiDou
            </div>
            <div class="constellation-filter constellation-filter--active">
              <span class="constellation-dot constellation-dot--glonass"></span>
              GLONASS
            </div>
          </div>
        </div>
      </div>

      <!-- Constellation Detail Cards -->
      <div class="satellite-details">
        ${renderConstellationCard('GPS', 'gps', '📡')}
        ${renderConstellationCard('NavIC / IRNSS', 'navic', '🇮🇳')}
        ${renderConstellationCard('Galileo', 'galileo', '🇪🇺')}
        ${renderConstellationCard('BeiDou', 'beidou', '🇨🇳')}
      </div>
    </div>
  `;

  // Attach constellation filter toggle handlers
  const filters = container.querySelectorAll('.constellation-filter');
  filters.forEach((filter) => {
    filter.addEventListener('click', () => {
      filter.classList.toggle('constellation-filter--active');
    });
  });
}

function renderConstellationCard(name: string, color: string, icon: string): string {
  return `
    <div class="card" style="border-top: 2px solid var(--color-${color})">
      <div class="card__header">
        <div class="card__title">
          <span class="card__title-icon">${icon}</span>
          ${name}
        </div>
        <span class="card__badge">0 sats</span>
      </div>
      <div class="card__body">
        <div class="metric-row">
          <span class="metric-row__label">Visible</span>
          <span class="metric-row__value metric-row__value--empty">--</span>
        </div>
        <div class="metric-row">
          <span class="metric-row__label">Used in Fix</span>
          <span class="metric-row__value metric-row__value--empty">--</span>
        </div>
        <div class="metric-row">
          <span class="metric-row__label">Avg Signal</span>
          <span class="metric-row__value metric-row__value--empty">-- dB-Hz</span>
        </div>
        <div class="metric-row">
          <span class="metric-row__label">Best Signal</span>
          <span class="metric-row__value metric-row__value--empty">-- dB-Hz</span>
        </div>
      </div>
    </div>
  `;
}
