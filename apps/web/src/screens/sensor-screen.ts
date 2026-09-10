/**
 * Sensor Screen
 *
 * IMU sensor data display with accelerometer, gyroscope, and
 * magnetometer axis gauges. Visualizes real-time data from
 * the IMU Simulator.
 */

import { imuService } from '../services/imu-service.js';

let unsubscribeAccel: (() => void) | null = null;
let unsubscribeGyro: (() => void) | null = null;
let unsubscribeMag: (() => void) | null = null;

// Throttling for UI updates (to prevent UI thread blocking)
let lastUiUpdate = 0;
const UI_THROTTLE_MS = 33; // ~30fps UI update

let pitch = 0;
let roll = 0;
let yaw = 0;

export function renderSensorScreen(container: HTMLElement): void {
  // Cleanup previous subscriptions
  if (unsubscribeAccel) unsubscribeAccel();
  if (unsubscribeGyro) unsubscribeGyro();
  if (unsubscribeMag) unsubscribeMag();

  container.innerHTML = `
    <style>
      .cube-container {
        perspective: 800px;
        width: 150px;
        height: 150px;
        margin: var(--space-6) auto;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .cube {
        width: 100px;
        height: 100px;
        position: relative;
        transform-style: preserve-3d;
        transition: transform 0.1s linear;
      }
      .cube__face {
        position: absolute;
        width: 100px;
        height: 100px;
        border: 2px solid var(--accent-primary);
        background: rgba(0, 230, 118, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        color: var(--accent-primary);
        font-size: 14px;
      }
      .cube__face--front  { transform: rotateY(  0deg) translateZ(50px); }
      .cube__face--right  { transform: rotateY( 90deg) translateZ(50px); }
      .cube__face--back   { transform: rotateY(180deg) translateZ(50px); }
      .cube__face--left   { transform: rotateY(-90deg) translateZ(50px); }
      .cube__face--top    { transform: rotateX( 90deg) translateZ(50px); }
      .cube__face--bottom { transform: rotateX(-90deg) translateZ(50px); }

      .sensor-val { font-family: monospace; min-width: 60px; display: inline-block; text-align: right; }
      
      .active-badge { color: var(--accent-secondary); border-color: var(--accent-secondary); background: rgba(0, 230, 118, 0.1); }
    </style>

    <div class="sensor-screen screen">
      <div class="screen__header">
        <div>
          <h1 class="screen__title">Sensors</h1>
          <p class="screen__subtitle">Inertial measurement unit (IMU) telemetry</p>
        </div>
        <span class="status-badge" id="imu-global-status">Starting...</span>
      </div>

      <!-- 3D Visualization -->
      <div class="section">
        <div class="section__title">Vehicle Attitude (Raw)</div>
        <div class="cube-container">
          <div class="cube" id="imu-cube">
            <div class="cube__face cube__face--front">Front</div>
            <div class="cube__face cube__face--back">Back</div>
            <div class="cube__face cube__face--right">Right</div>
            <div class="cube__face cube__face--left">Left</div>
            <div class="cube__face cube__face--top">Top</div>
            <div class="cube__face cube__face--bottom">Bottom</div>
          </div>
        </div>
        <div style="text-align: center; font-family: monospace; color: var(--text-secondary);">
          Pitch: <span id="val-pitch">0.0</span>° | 
          Roll: <span id="val-roll">0.0</span>° | 
          Yaw: <span id="val-yaw">0.0</span>°
        </div>
      </div>

      <!-- Sensor Cards Grid -->
      <div class="sensor-screen__grid">
        <!-- Accelerometer -->
        <div class="sensor-card">
          <div class="sensor-card__header">
            <span class="sensor-card__title">📐 Accelerometer</span>
            <span class="sensor-card__status active-badge">50 Hz</span>
          </div>
          <div class="sensor-axes">
            ${renderAxis('X', 'acc-x', 'm/s²')}
            ${renderAxis('Y', 'acc-y', 'm/s²')}
            ${renderAxis('Z', 'acc-z', 'm/s²')}
          </div>
        </div>

        <!-- Gyroscope -->
        <div class="sensor-card">
          <div class="sensor-card__header">
            <span class="sensor-card__title">🔄 Gyroscope</span>
            <span class="sensor-card__status active-badge">50 Hz</span>
          </div>
          <div class="sensor-axes">
            ${renderAxis('X', 'gyr-x', 'rad/s')}
            ${renderAxis('Y', 'gyr-y', 'rad/s')}
            ${renderAxis('Z', 'gyr-z', 'rad/s')}
          </div>
        </div>

        <!-- Magnetometer -->
        <div class="sensor-card">
          <div class="sensor-card__header">
            <span class="sensor-card__title">🧲 Magnetometer</span>
            <span class="sensor-card__status active-badge">50 Hz</span>
          </div>
          <div class="sensor-axes">
            ${renderAxis('X', 'mag-x', 'μT')}
            ${renderAxis('Y', 'mag-y', 'μT')}
            ${renderAxis('Z', 'mag-z', 'μT')}
          </div>
        </div>
      </div>
    </div>
  `;

  // Start subscriptions
  unsubscribeAccel = imuService.subscribeAccelerometer((m) => {
    const now = Date.now();
    if (now - lastUiUpdate > UI_THROTTLE_MS) {
      updateValue('acc-x', m.acceleration.x);
      updateValue('acc-y', m.acceleration.y);
      updateValue('acc-z', m.acceleration.z);

      // Estimate Pitch/Roll from gravity vector
      // pitch = atan2(-x, sqrt(y^2 + z^2))
      pitch = Math.atan2(-m.acceleration.x, Math.sqrt(m.acceleration.y * m.acceleration.y + m.acceleration.z * m.acceleration.z)) * (180 / Math.PI);
      // roll = atan2(y, z)
      roll = Math.atan2(m.acceleration.y, m.acceleration.z) * (180 / Math.PI);
      
      updateCube();
      lastUiUpdate = now;
      updateStatus();
    }
  });

  unsubscribeGyro = imuService.subscribeGyroscope((m) => {
    const now = Date.now();
    if (now - lastUiUpdate > UI_THROTTLE_MS) {
      updateValue('gyr-x', m.angularVelocity.x);
      updateValue('gyr-y', m.angularVelocity.y);
      updateValue('gyr-z', m.angularVelocity.z);
      lastUiUpdate = now;
      updateStatus();
    }
  });

  unsubscribeMag = imuService.subscribeMagnetometer((m) => {
    const now = Date.now();
    if (now - lastUiUpdate > UI_THROTTLE_MS) {
      updateValue('mag-x', m.magneticField.x);
      updateValue('mag-y', m.magneticField.y);
      updateValue('mag-z', m.magneticField.z);

      // Estimate Yaw (Heading) from magnetometer
      yaw = Math.atan2(m.magneticField.x, m.magneticField.y) * (180 / Math.PI);
      if (yaw < 0) yaw += 360;

      updateCube();
      lastUiUpdate = now;
      updateStatus();
    }
  });
}

function updateValue(id: string, val: number): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = val.toFixed(3);
    el.classList.remove('sensor-axis__value--empty');
  }
}

function updateCube(): void {
  const cube = document.getElementById('imu-cube');
  if (cube) {
    // CSS 3D Transforms rotate based on X, Y, Z axes.
    // Map our pitch/roll/yaw to the CSS axes:
    // Pitch (nose up/down) = rotateX
    // Roll (tilt left/right) = rotateZ
    // Yaw (heading) = rotateY
    cube.style.transform = `rotateX(${pitch}deg) rotateY(${yaw}deg) rotateZ(${roll}deg)`;
  }
  
  const elPitch = document.getElementById('val-pitch');
  const elRoll = document.getElementById('val-roll');
  const elYaw = document.getElementById('val-yaw');
  
  if (elPitch) elPitch.textContent = pitch.toFixed(1);
  if (elRoll) elRoll.textContent = roll.toFixed(1);
  if (elYaw) elYaw.textContent = yaw.toFixed(1);
}

function updateStatus(): void {
  const badge = document.getElementById('imu-global-status');
  if (badge) {
    const status = imuService.getSimulator().getStatus();
    if (status.isActive) {
      badge.textContent = 'Active (50 Hz)';
      badge.className = 'status-badge status-badge--active';
    } else {
      badge.textContent = 'Paused';
      badge.className = 'status-badge status-badge--idle';
    }
  }
}

function renderAxis(label: string, id: string, unit: string): string {
  return `
    <div class="sensor-axis">
      <span class="sensor-axis__label">${label}</span>
      <span class="sensor-axis__value sensor-axis__value--empty sensor-val" id="${id}">0.000</span>
      <span class="sensor-axis__unit">${unit}</span>
    </div>
  `;
}
