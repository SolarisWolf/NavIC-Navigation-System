/**
 * Simulation Controls Component
 *
 * Floating control panel for the GNSS simulator.
 * Only visible in simulation mode.
 */

import { gnssService } from '../services/gnss-service.js';
import { imuService } from '../services/imu-service.js';

export class SimulationControls {
  private container: HTMLElement;
  private panel: HTMLElement;

  constructor(parentContainer: HTMLElement) {
    this.container = parentContainer;

    this.panel = document.createElement('div');
    this.panel.className = 'sim-controls';
    this.panel.innerHTML = this.buildHTML();
    this.container.appendChild(this.panel);

    this.attachHandlers();
  }

  private buildHTML(): string {
    const sim = gnssService.getSimulator();
    const scenarios = sim.getAvailableScenarios();

    return `
      <div class="sim-controls__header">
        <span class="sim-controls__title">🧪 Simulation</span>
        <button class="sim-controls__toggle" id="sim-toggle-btn" title="Collapse">−</button>
      </div>
      <div class="sim-controls__body" id="sim-controls-body">
        <div class="sim-controls__row">
          <label class="sim-controls__label">Scenario</label>
          <select class="sim-controls__select" id="sim-scenario">
            ${scenarios.map(s => `<option value="${s}" ${s === sim.getScenarioName() ? 'selected' : ''}>${s.replace(/-/g, ' ')}</option>`).join('')}
          </select>
        </div>

        <div class="sim-controls__row sim-controls__buttons">
          <button class="sim-controls__btn sim-controls__btn--play" id="sim-play" title="Play">▶</button>
          <button class="sim-controls__btn" id="sim-pause" title="Pause">⏸</button>
          <button class="sim-controls__btn" id="sim-reset" title="Reset">↺</button>
        </div>

        <div class="sim-controls__row">
          <label class="sim-controls__label">Speed</label>
          <div class="sim-controls__speed">
            ${[1, 2, 5, 10].map(s => `
              <button class="sim-controls__speed-btn ${s === 1 ? 'sim-controls__speed-btn--active' : ''}"
                      data-speed="${s}">${s}×</button>
            `).join('')}
          </div>
        </div>

        <div class="sim-controls__row">
          <label class="sim-controls__label">NavIC</label>
          <button class="sim-controls__btn sim-controls__btn--toggle sim-controls__btn--active" id="sim-navic">ON</button>
        </div>

        <div class="sim-controls__row">
          <label class="sim-controls__label">Signal</label>
          <select class="sim-controls__select" id="sim-signal">
            <option value="strong" selected>Strong</option>
            <option value="moderate">Moderate</option>
            <option value="weak">Weak</option>
          </select>
        </div>

        <div class="sim-controls__row">
          <button class="sim-controls__btn sim-controls__btn--outage" id="sim-outage">
            ⚡ Trigger GNSS Outage (30s)
          </button>
        </div>
      </div>
    `;
  }

  private attachHandlers(): void {
    const sim = gnssService.getSimulator();

    // Toggle collapse
    const toggleBtn = this.panel.querySelector('#sim-toggle-btn') as HTMLElement;
    const body = this.panel.querySelector('#sim-controls-body') as HTMLElement;
    toggleBtn?.addEventListener('click', () => {
      body.classList.toggle('sim-controls__body--collapsed');
      toggleBtn.textContent = body.classList.contains('sim-controls__body--collapsed') ? '+' : '−';
    });

    // Scenario selector
    const scenarioSelect = this.panel.querySelector('#sim-scenario') as HTMLSelectElement;
    scenarioSelect?.addEventListener('change', () => {
      sim.setScenario(scenarioSelect.value);
      sim.reset();
    });

    // Play
    this.panel.querySelector('#sim-play')?.addEventListener('click', () => {
      if (sim.getIsPaused()) {
        sim.resume();
        imuService.start(50);
      } else {
        gnssService.start();
        imuService.start(50);
      }
    });

    // Pause
    this.panel.querySelector('#sim-pause')?.addEventListener('click', () => {
      sim.pause();
      imuService.stop();
    });

    // Reset
    this.panel.querySelector('#sim-reset')?.addEventListener('click', () => {
      sim.reset();
      imuService.stop();
    });

    // Speed buttons
    const speedBtns = this.panel.querySelectorAll('.sim-controls__speed-btn');
    speedBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const speed = parseFloat((btn as HTMLElement).dataset.speed ?? '1');
        sim.setSpeedMultiplier(speed);
        speedBtns.forEach(b => b.classList.remove('sim-controls__speed-btn--active'));
        btn.classList.add('sim-controls__speed-btn--active');
      });
    });

    // NavIC toggle
    const navicBtn = this.panel.querySelector('#sim-navic') as HTMLElement;
    navicBtn?.addEventListener('click', () => {
      const isEnabled = sim.isNavICEnabled();
      sim.setNavICAvailability(!isEnabled);
      navicBtn.textContent = !isEnabled ? 'ON' : 'OFF';
      navicBtn.classList.toggle('sim-controls__btn--active', !isEnabled);
    });

    // Signal quality
    const signalSelect = this.panel.querySelector('#sim-signal') as HTMLSelectElement;
    signalSelect?.addEventListener('change', () => {
      sim.setSignalQuality(signalSelect.value as 'strong' | 'moderate' | 'weak');
    });

    // GNSS outage
    this.panel.querySelector('#sim-outage')?.addEventListener('click', () => {
      sim.simulateOutage(30000);
    });
  }
}
