/**
 * Sensor Screen
 *
 * IMU sensor data display with accelerometer, gyroscope, and
 * magnetometer axis gauges. Shows zeroed/empty values until
 * the IMU simulator (Phase 4) provides data.
 */

export function renderSensorScreen(container: HTMLElement): void {
  container.innerHTML = `
    <div class="sensor-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Sensors</h1>
          <p class="screen__subtitle">Inertial measurement unit and sensor fusion status</p>
        </div>
        <span class="status-badge status-badge--idle">Inactive</span>
      </div>

      <!-- Sensor Cards Grid -->
      <div class="sensor-screen__grid">
        <!-- Accelerometer -->
        <div class="sensor-card">
          <div class="sensor-card__header">
            <span class="sensor-card__title">📐 Accelerometer</span>
            <span class="sensor-card__status">Awaiting data</span>
          </div>
          <div class="sensor-axes">
            ${renderAxis('X', '--', 'm/s²')}
            ${renderAxis('Y', '--', 'm/s²')}
            ${renderAxis('Z', '--', 'm/s²')}
          </div>
        </div>

        <!-- Gyroscope -->
        <div class="sensor-card">
          <div class="sensor-card__header">
            <span class="sensor-card__title">🔄 Gyroscope</span>
            <span class="sensor-card__status">Awaiting data</span>
          </div>
          <div class="sensor-axes">
            ${renderAxis('X', '--', 'rad/s')}
            ${renderAxis('Y', '--', 'rad/s')}
            ${renderAxis('Z', '--', 'rad/s')}
          </div>
        </div>

        <!-- Magnetometer -->
        <div class="sensor-card">
          <div class="sensor-card__header">
            <span class="sensor-card__title">🧲 Magnetometer</span>
            <span class="sensor-card__status">Optional</span>
          </div>
          <div class="sensor-axes">
            ${renderAxis('X', '--', 'μT')}
            ${renderAxis('Y', '--', 'μT')}
            ${renderAxis('Z', '--', 'μT')}
          </div>
        </div>
      </div>

      <!-- Sensor Fusion Status -->
      <div class="section">
        <div class="section__title">Sensor Fusion (EKF)</div>
        <div class="fusion-status">
          <div class="card">
            <div class="card__header">
              <div class="card__title">
                <span class="card__title-icon">⚡</span>
                EKF Status
              </div>
              <span class="status-badge status-badge--idle">Inactive</span>
            </div>
            <div class="card__body">
              <div class="metric-row">
                <span class="metric-row__label">State</span>
                <span class="metric-row__value metric-row__value--empty">Not initialized</span>
              </div>
              <div class="metric-row">
                <span class="metric-row__label">Processing Time</span>
                <span class="metric-row__value metric-row__value--empty">-- ms</span>
              </div>
              <div class="metric-row">
                <span class="metric-row__label">Target Latency</span>
                <span class="metric-row__value">20 ms</span>
              </div>
              <div class="metric-row">
                <span class="metric-row__label">GNSS Updates</span>
                <span class="metric-row__value metric-row__value--empty">0</span>
              </div>
              <div class="metric-row">
                <span class="metric-row__label">IMU Updates</span>
                <span class="metric-row__value metric-row__value--empty">0</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card__header">
              <div class="card__title">
                <span class="card__title-icon">🏃</span>
                Dead Reckoning
              </div>
              <span class="status-badge status-badge--idle">Standby</span>
            </div>
            <div class="card__body">
              <div class="metric-row">
                <span class="metric-row__label">Mode</span>
                <span class="metric-row__value metric-row__value--empty">GNSS + IMU</span>
              </div>
              <div class="metric-row">
                <span class="metric-row__label">DR Active</span>
                <span class="metric-row__value metric-row__value--empty">No</span>
              </div>
              <div class="metric-row">
                <span class="metric-row__label">DR Duration</span>
                <span class="metric-row__value metric-row__value--empty">--</span>
              </div>
              <div class="metric-row">
                <span class="metric-row__label">Estimated Drift</span>
                <span class="metric-row__value metric-row__value--empty">-- m</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAxis(label: string, value: string, unit: string): string {
  return `
    <div class="sensor-axis">
      <span class="sensor-axis__label">${label}</span>
      <span class="sensor-axis__value sensor-axis__value--empty">${value}</span>
      <span class="sensor-axis__unit">${unit}</span>
    </div>
  `;
}
