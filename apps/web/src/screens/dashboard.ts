/**
 * Dashboard Screen
 *
 * Main overview screen showing GNSS status, satellite summary,
 * navigation state, and sensor fusion status.
 * All values show empty/awaiting states until data sources are connected.
 */

import { createMetricRow } from '../utils/dom.js';

export function renderDashboard(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dashboard screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Dashboard</h1>
          <p class="screen__subtitle">System overview and real-time status</p>
        </div>
        <span class="status-badge status-badge--idle">Idle</span>
      </div>

      <div class="dashboard__grid">
        <!-- GNSS Status Card -->
        <div class="card card--gnss" id="card-gnss">
          <div class="card__header">
            <div class="card__title">
              <span class="card__title-icon">📡</span>
              GNSS Status
            </div>
            <span class="card__badge">No Fix</span>
          </div>
          <div class="card__body" id="gnss-metrics"></div>
        </div>

        <!-- Satellites Card -->
        <div class="card card--satellites" id="card-satellites">
          <div class="card__header">
            <div class="card__title">
              <span class="card__title-icon">🛰</span>
              Satellites
            </div>
            <span class="card__badge">0 tracked</span>
          </div>
          <div class="card__body" id="satellite-metrics"></div>
        </div>

        <!-- Navigation Card -->
        <div class="card card--navigation" id="card-navigation">
          <div class="card__header">
            <div class="card__title">
              <span class="card__title-icon">🧭</span>
              Navigation
            </div>
            <span class="card__badge">No Route</span>
          </div>
          <div class="card__body" id="nav-metrics"></div>
        </div>

        <!-- Sensor Fusion Card -->
        <div class="card card--fusion" id="card-fusion">
          <div class="card__header">
            <div class="card__title">
              <span class="card__title-icon">⚡</span>
              Sensor Fusion
            </div>
            <span class="card__badge">Inactive</span>
          </div>
          <div class="card__body" id="fusion-metrics"></div>
        </div>
      </div>
    </div>
  `;

  // Populate GNSS metrics
  const gnssMetrics = document.getElementById('gnss-metrics');
  if (gnssMetrics) {
    gnssMetrics.appendChild(createMetricRow('Fix Type', '--'));
    gnssMetrics.appendChild(createMetricRow('Accuracy', '--'));
    gnssMetrics.appendChild(createMetricRow('Latitude', '--'));
    gnssMetrics.appendChild(createMetricRow('Longitude', '--'));
    gnssMetrics.appendChild(createMetricRow('Altitude', '--'));
    gnssMetrics.appendChild(createMetricRow('Speed', '--'));
    gnssMetrics.appendChild(createMetricRow('Heading', '--'));
  }

  // Populate Satellite constellation rows
  const satMetrics = document.getElementById('satellite-metrics');
  if (satMetrics) {
    const constellations = [
      { name: 'Total', color: '' },
      { name: 'NavIC / IRNSS', color: 'navic' },
      { name: 'GPS', color: 'gps' },
      { name: 'Galileo', color: 'galileo' },
      { name: 'BeiDou', color: 'beidou' },
      { name: 'GLONASS', color: 'glonass' },
      { name: 'Used in Fix', color: '' },
    ];

    for (const c of constellations) {
      const row = document.createElement('div');
      row.className = 'constellation-row';

      if (c.color) {
        const dot = document.createElement('span');
        dot.className = `constellation-row__dot`;
        dot.style.background = `var(--color-${c.color})`;
        row.appendChild(dot);
      }

      const name = document.createElement('span');
      name.className = 'constellation-row__name';
      name.textContent = c.name;
      if (!c.color) {
        name.style.fontWeight = '600';
        name.style.color = 'var(--text-primary)';
      }
      row.appendChild(name);

      const count = document.createElement('span');
      count.className = 'constellation-row__count constellation-row__count--empty';
      count.textContent = '--';
      row.appendChild(count);

      satMetrics.appendChild(row);
    }
  }

  // Populate Navigation metrics
  const navMetrics = document.getElementById('nav-metrics');
  if (navMetrics) {
    navMetrics.appendChild(createMetricRow('Destination', '--'));
    navMetrics.appendChild(createMetricRow('Distance', '--'));
    navMetrics.appendChild(createMetricRow('ETA', '--'));
    navMetrics.appendChild(createMetricRow('Instruction', '--'));
  }

  // Populate Sensor Fusion metrics
  const fusionMetrics = document.getElementById('fusion-metrics');
  if (fusionMetrics) {
    fusionMetrics.appendChild(createMetricRow('EKF Status', '--'));
    fusionMetrics.appendChild(createMetricRow('Mode', 'Idle'));
    fusionMetrics.appendChild(createMetricRow('GNSS Source', '--'));
    fusionMetrics.appendChild(createMetricRow('IMU Source', '--'));
    fusionMetrics.appendChild(createMetricRow('Dead Reckoning', '--'));
    fusionMetrics.appendChild(createMetricRow('Latency', '--'));
  }
}
