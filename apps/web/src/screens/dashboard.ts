/**
 * Dashboard Screen
 *
 * Main overview screen showing GNSS status, satellite summary,
 * navigation state, and sensor fusion status.
 * Subscribes to GNSS service for live data updates.
 */

import { type GNSSMeasurement, type GNSSPosition, FixType, Constellation, SensorFusionMode, type SensorFusionStatus } from '@navic/shared-models';
import { gnssService } from '../services/gnss-service.js';
import { fusionService } from '../services/fusion-service.js';
import { positionService } from '../services/position-service.js';

let unsubscribe: (() => void) | null = null;
let unsubscribeFusion: (() => void) | null = null;
let unsubscribePos: (() => void) | null = null;

export function renderDashboard(container: HTMLElement): void {
  // Clean up previous subscriptions
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (unsubscribeFusion) {
    unsubscribeFusion();
    unsubscribeFusion = null;
  }
  if (unsubscribePos) {
    unsubscribePos();
    unsubscribePos = null;
  }

  container.innerHTML = `
    <div class="dashboard screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Dashboard</h1>
          <p class="screen__subtitle">System overview and real-time status</p>
        </div>
        <span class="status-badge status-badge--idle" id="dash-status-badge">Idle</span>
      </div>

      <div class="dashboard__grid">
        <!-- GNSS Status Card -->
        <div class="card card--gnss" id="card-gnss">
          <div class="card__header">
            <div class="card__title">
              <span class="card__title-icon">📡</span>
              GNSS Status
            </div>
            <span class="card__badge" id="gnss-fix-badge">No Fix</span>
          </div>
          <div class="card__body">
            <div class="metric-row"><span class="metric-row__label">Fix Type</span><span class="metric-row__value metric-row__value--empty" id="d-fix">--</span></div>
            <div class="metric-row"><span class="metric-row__label">Accuracy</span><span class="metric-row__value metric-row__value--empty" id="d-accuracy">--</span></div>
            <div class="metric-row"><span class="metric-row__label">Geometry (HDOP)</span><span class="metric-row__value metric-row__value--empty" id="d-hdop">--</span></div>
            <div class="metric-row"><span class="metric-row__label">Latitude</span><span class="metric-row__value metric-row__value--empty" id="d-lat">--</span></div>
            <div class="metric-row"><span class="metric-row__label">Longitude</span><span class="metric-row__value metric-row__value--empty" id="d-lon">--</span></div>
            <div class="metric-row"><span class="metric-row__label">Altitude</span><span class="metric-row__value metric-row__value--empty" id="d-alt">--</span></div>
            <div class="metric-row"><span class="metric-row__label">Speed</span><span class="metric-row__value metric-row__value--empty" id="d-speed">--</span></div>
            <div class="metric-row"><span class="metric-row__label">Heading</span><span class="metric-row__value metric-row__value--empty" id="d-heading">--</span></div>
          </div>
        </div>

        <!-- Satellites Card -->
        <div class="card card--satellites" id="card-satellites">
          <div class="card__header">
            <div class="card__title">
              <span class="card__title-icon">🛰</span>
              Satellites
            </div>
            <span class="card__badge" id="sat-total-badge">0 tracked</span>
          </div>
          <div class="card__body">
            <div class="constellation-row"><span class="constellation-row__name" style="font-weight:600;color:var(--text-primary)">Total</span><span class="constellation-row__count constellation-row__count--empty" id="d-sat-total">--</span></div>
            <div class="constellation-row"><span class="constellation-row__dot" style="background:var(--color-navic)"></span><span class="constellation-row__name">NavIC / IRNSS</span><span class="constellation-row__count constellation-row__count--empty" id="d-sat-navic">--</span></div>
            <div class="constellation-row"><span class="constellation-row__dot" style="background:var(--color-gps)"></span><span class="constellation-row__name">GPS</span><span class="constellation-row__count constellation-row__count--empty" id="d-sat-gps">--</span></div>
            <div class="constellation-row"><span class="constellation-row__dot" style="background:var(--color-galileo)"></span><span class="constellation-row__name">Galileo</span><span class="constellation-row__count constellation-row__count--empty" id="d-sat-galileo">--</span></div>
            <div class="constellation-row"><span class="constellation-row__dot" style="background:var(--color-beidou)"></span><span class="constellation-row__name">BeiDou</span><span class="constellation-row__count constellation-row__count--empty" id="d-sat-beidou">--</span></div>
            <div class="constellation-row"><span class="constellation-row__dot" style="background:var(--color-glonass)"></span><span class="constellation-row__name">GLONASS</span><span class="constellation-row__count constellation-row__count--empty" id="d-sat-glonass">--</span></div>
            <div class="constellation-row"><span class="constellation-row__name" style="font-weight:600;color:var(--text-primary)">Used in Fix</span><span class="constellation-row__count constellation-row__count--empty" id="d-sat-used">--</span></div>
          </div>
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
          <div class="card__body">
            <div class="metric-row"><span class="metric-row__label">Destination</span><span class="metric-row__value metric-row__value--empty">--</span></div>
            <div class="metric-row"><span class="metric-row__label">Distance</span><span class="metric-row__value metric-row__value--empty">--</span></div>
            <div class="metric-row"><span class="metric-row__label">ETA</span><span class="metric-row__value metric-row__value--empty">--</span></div>
            <div class="metric-row"><span class="metric-row__label">Instruction</span><span class="metric-row__value metric-row__value--empty">--</span></div>
          </div>
        </div>

        <!-- Sensor Fusion Card -->
        <div class="card card--fusion" id="card-fusion">
          <div class="card__header">
            <div class="card__title">
              <span class="card__title-icon">⚡</span>
              Sensor Fusion
            </div>
            <span class="card__badge" id="fusion-status-badge">Starting...</span>
          </div>
          <div class="card__body">
            <div class="metric-row"><span class="metric-row__label">EKF Status</span><span class="metric-row__value metric-row__value--empty" id="d-ekf-status">Initializing</span></div>
            <div class="metric-row"><span class="metric-row__label">Mode</span><span class="metric-row__value" id="d-ekf-mode">Initial Fix Pending</span></div>
            <div class="metric-row"><span class="metric-row__label">GNSS Source</span><span class="metric-row__value" id="d-ekf-gnss">GNSS Sim (1 Hz)</span></div>
            <div class="metric-row"><span class="metric-row__label">IMU Source</span><span class="metric-row__value" id="d-ekf-imu">IMU Sim (50 Hz)</span></div>
            <div class="metric-row"><span class="metric-row__label">Dead Reckoning</span><span class="metric-row__value" id="d-ekf-dr">Inactive</span></div>
            <div class="metric-row"><span class="metric-row__label">Latency</span><span class="metric-row__value" id="d-ekf-latency">--</span></div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Subscribe to GNSS updates
  unsubscribe = gnssService.subscribe(updateDashboard);

  // Subscribe to Fusion updates
  unsubscribeFusion = fusionService.subscribeStatus(updateFusionCard);

  // Subscribe to Position Engine updates
  unsubscribePos = positionService.subscribe(updatePositionMetrics);
}

function updateDashboard(m: GNSSMeasurement): void {
  const isNoFix = m.fixType === FixType.NoFix;

  // Status badge
  const badge = document.getElementById('dash-status-badge');
  if (badge) {
    if (isNoFix) {
      badge.textContent = 'No Fix';
      badge.className = 'status-badge status-badge--error';
    } else {
      badge.textContent = m.fixType === FixType.Fix3D ? '3D Fix' : '2D Fix';
      badge.className = 'status-badge status-badge--active';
    }
  }

  // GNSS fix badge
  const fixBadge = document.getElementById('gnss-fix-badge');
  if (fixBadge) {
    fixBadge.textContent = isNoFix ? 'No Fix' : m.fixType === FixType.Fix3D ? '3D Fix' : '2D Fix';
  }

  // GNSS values
  setMetric('d-fix', isNoFix ? 'No Fix' : m.fixType === FixType.Fix3D ? '3D Fix' : '2D Fix', !isNoFix);
  setMetric('d-accuracy', isNoFix ? '--' : `${m.horizontalAccuracy} m`, !isNoFix);
  setMetric('d-lat', isNoFix ? '--' : `${m.latitude.toFixed(7)}°`, !isNoFix);
  setMetric('d-lon', isNoFix ? '--' : `${m.longitude.toFixed(7)}°`, !isNoFix);
  setMetric('d-alt', isNoFix ? '--' : `${m.altitude.toFixed(1)} m`, !isNoFix);
  setMetric('d-speed', isNoFix ? '--' : `${m.speed.toFixed(2)} m/s`, !isNoFix);
  setMetric('d-heading', isNoFix ? '--' : `${m.bearing.toFixed(1)}°`, !isNoFix);

  // Satellite counts
  const counts = computeCounts(m);
  setMetric('d-sat-total', `${counts.total}`, counts.total > 0);
  setMetric('d-sat-navic', `${counts.navic}`, counts.navic > 0);
  setMetric('d-sat-gps', `${counts.gps}`, counts.gps > 0);
  setMetric('d-sat-galileo', `${counts.galileo}`, counts.galileo > 0);
  setMetric('d-sat-beidou', `${counts.beidou}`, counts.beidou > 0);
  setMetric('d-sat-glonass', `${counts.glonass}`, counts.glonass > 0);
  setMetric('d-sat-used', `${counts.used}`, counts.used > 0);

  const totalBadge = document.getElementById('sat-total-badge');
  if (totalBadge) totalBadge.textContent = `${counts.total} tracked`;
}

function setMetric(id: string, value: string, hasData: boolean): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
    el.className = `metric-row__value ${hasData ? '' : 'metric-row__value--empty'}`.trim();
    if (hasData && !el.className.includes('count')) {
      el.className = el.className.replace('constellation-row__count--empty', '');
    }
  }
}

function computeCounts(m: GNSSMeasurement) {
  let navic = 0, gps = 0, galileo = 0, beidou = 0, glonass = 0, used = 0;
  for (const s of m.satellites) {
    if (s.usedInFix) used++;
    switch (s.constellation) {
      case Constellation.NavIC: navic++; break;
      case Constellation.GPS: gps++; break;
      case Constellation.Galileo: galileo++; break;
      case Constellation.BeiDou: beidou++; break;
      case Constellation.GLONASS: glonass++; break;
    }
  }
  return { total: m.satellites.length, navic, gps, galileo, beidou, glonass, used };
}

function updateFusionCard(s: SensorFusionStatus): void {
  const badge = document.getElementById('fusion-status-badge');
  if (badge) {
    if (s.mode === SensorFusionMode.FULL_FUSION) {
      badge.textContent = 'Active (50 Hz)';
      badge.className = 'card__badge status-badge--active';
    } else if (s.mode === SensorFusionMode.DEAD_RECKONING) {
      badge.textContent = 'Dead Reckoning';
      badge.className = 'card__badge status-badge--error';
    } else {
      badge.textContent = 'Initializing';
      badge.className = 'card__badge status-badge--idle';
    }
  }

  const isDr = s.mode === SensorFusionMode.DEAD_RECKONING;
  const isFull = s.mode === SensorFusionMode.FULL_FUSION;

  setMetric(
    'd-ekf-status',
    isFull ? 'Converged (50 Hz)' : isDr ? 'Dead Reckoning' : 'Awaiting Fix',
    isFull || isDr
  );

  setMetric(
    'd-ekf-mode',
    isFull
      ? 'GNSS + IMU Full Fusion'
      : isDr
      ? 'IMU Kinematic Dead Reckoning'
      : 'Awaiting Initial Fix',
    true
  );

  setMetric('d-ekf-gnss', s.lastGnssTimestamp ? 'GNSS Sim (1 Hz)' : '--', !!s.lastGnssTimestamp);
  setMetric('d-ekf-imu', s.lastImuTimestamp ? 'IMU Sim (50 Hz)' : '--', !!s.lastImuTimestamp);
  setMetric(
    'd-ekf-dr',
    isDr ? `Active (${s.deadReckoningSeconds.toFixed(1)}s)` : 'Inactive (Fix OK)',
    true
  );

  const latText = s.averageLatencyMs > 0
    ? `${s.averageLatencyMs.toFixed(2)} ms (Target: < 20 ms)`
    : '< 0.5 ms (Target: < 20 ms)';
  setMetric('d-ekf-latency', latText, true);
}

function updatePositionMetrics(pos: GNSSPosition): void {
  const isNoFix = pos.fixType === FixType.NoFix;
  setMetric('d-hdop', isNoFix ? '--' : `${pos.dop.hdop.toFixed(2)} (${pos.isNavICAssisted ? 'NavIC' : 'Std'})`, !isNoFix);

  const fixBadge = document.getElementById('gnss-fix-badge');
  if (fixBadge && !isNoFix) {
    fixBadge.textContent = pos.isNavICAssisted ? '3D Fix (NavIC 🇮🇳)' : '3D Fix';
  }
}


