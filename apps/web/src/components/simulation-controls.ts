/**
 * Simulation Controls Component
 *
 * Floating control panel for the GNSS simulator.
 * Provides multi-scenario selection, live timeline scrubber, variable speed multipliers,
 * constellation filters (NavIC-only, GPS-only), and interactive fault injections
 * (tunnel blackouts, urban canyon multipath, off-route divergence).
 */

import { gnssService } from '../services/gnss-service.js';
import { imuService } from '../services/imu-service.js';
import { SCENARIOS, getScenario } from '@navic/gnss-core';

export class SimulationControls {
  private container: HTMLElement;
  private panel: HTMLElement;
  private scrubberTimer: ReturnType<typeof setInterval> | null = null;
  private offrouteTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(parentContainer: HTMLElement) {
    this.container = parentContainer;

    this.panel = document.createElement('div');
    this.panel.className = 'sim-controls';
    this.panel.innerHTML = this.buildHTML();
    this.container.appendChild(this.panel);

    this.attachHandlers();
    this.startProgressTicker();
  }

  private buildHTML(): string {
    const sim = gnssService.getSimulator();
    const scenarioKeys = Object.keys(SCENARIOS);
    const activeScenario = getScenario(sim.getScenarioName());

    return `
      <div class="sim-controls__header">
        <div class="sim-controls__header-left">
          <span class="sim-controls__title">🧪 Simulation Hub</span>
          <span class="sim-controls__status-badge" id="sim-status-badge">Ready</span>
        </div>
        <button class="sim-controls__toggle" id="sim-toggle-btn" title="Collapse">−</button>
      </div>

      <div class="sim-controls__body" id="sim-controls-body">
        <!-- Scenario Selector & Info -->
        <div class="sim-controls__row">
          <label class="sim-controls__label">Scenario</label>
          <select class="sim-controls__select" id="sim-scenario">
            ${scenarioKeys
              .map(
                (k) => `
                <option value="${k}" ${k === sim.getScenarioName() ? 'selected' : ''}>
                  ${SCENARIOS[k].name}
                </option>
              `
              )
              .join('')}
          </select>
        </div>
        <div class="sim-controls__scenario-desc" id="sim-scenario-desc">
          ${activeScenario.description}
        </div>

        <!-- Timeline Scrubber -->
        <div class="sim-controls__scrubber-section">
          <div class="sim-controls__scrubber-labels">
            <span class="sim-controls__scrubber-time" id="sim-scrubber-time">00:00</span>
            <span class="sim-controls__scrubber-pct" id="sim-scrubber-pct">0%</span>
            <span class="sim-controls__scrubber-dist" id="sim-scrubber-dist">${(sim.getTotalDistance() / 1000).toFixed(1)} km</span>
          </div>
          <input type="range" class="sim-controls__scrubber-slider" id="sim-scrubber" min="0" max="1000" value="0">
        </div>

        <!-- Playback Buttons -->
        <div class="sim-controls__row sim-controls__buttons">
          <button class="sim-controls__btn sim-controls__btn--play" id="sim-play" title="Play">▶ Play</button>
          <button class="sim-controls__btn" id="sim-pause" title="Pause">⏸ Pause</button>
          <button class="sim-controls__btn" id="sim-reset" title="Reset Start">↺ Reset</button>
        </div>

        <!-- Speed Multipliers -->
        <div class="sim-controls__row">
          <label class="sim-controls__label">Speed</label>
          <div class="sim-controls__speed">
            ${[0.5, 1, 2, 5, 10]
              .map(
                (s) => `
              <button class="sim-controls__speed-btn ${s === 1 ? 'sim-controls__speed-btn--active' : ''}"
                      data-speed="${s}">${s}×</button>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- Multi-Constellation Mode -->
        <div class="sim-controls__row">
          <label class="sim-controls__label">Constellation</label>
          <div class="sim-controls__constellation-toggles">
            <button class="sim-controls__pill-btn sim-controls__pill-btn--active" id="btn-mode-all">All</button>
            <button class="sim-controls__pill-btn" id="btn-mode-navic">NavIC</button>
            <button class="sim-controls__pill-btn" id="btn-mode-gps">GPS</button>
          </div>
        </div>

        <!-- Signal Quality -->
        <div class="sim-controls__row">
          <label class="sim-controls__label">Signal</label>
          <select class="sim-controls__select" id="sim-signal">
            <option value="strong" selected>Strong (Clear Sky)</option>
            <option value="moderate">Moderate (Suburban)</option>
            <option value="weak">Weak (Dense Urban)</option>
          </select>
        </div>

        <!-- Fault Injections -->
        <div class="sim-controls__faults-header">⚡ Fault Injections</div>
        <div class="sim-controls__faults-grid">
          <button class="sim-controls__fault-btn" id="sim-fault-tunnel" title="Simulate 15-second tunnel GNSS blackout">
            🚇 Tunnel Outage (15s)
          </button>
          <button class="sim-controls__fault-btn" id="sim-fault-canyon" title="Simulate urban canyon signal degradation">
            🏢 Urban Canyon
          </button>
          <button class="sim-controls__fault-btn" id="sim-fault-offroute" title="Force lateral divergence to test re-routing">
            ↩️ Diverge Off-Route (10s)
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
    const scenarioDesc = this.panel.querySelector('#sim-scenario-desc') as HTMLElement;
    scenarioSelect?.addEventListener('change', () => {
      sim.setScenario(scenarioSelect.value);
      sim.reset();
      const scen = getScenario(scenarioSelect.value);
      if (scenarioDesc) scenarioDesc.textContent = scen.description;
      this.updateProgressDisplay(0);
    });

    // Timeline Scrubber
    const scrubber = this.panel.querySelector('#sim-scrubber') as HTMLInputElement;
    scrubber?.addEventListener('input', () => {
      const fraction = parseInt(scrubber.value, 10) / 1000;
      sim.seek(fraction);
      this.updateProgressDisplay(fraction);
    });

    // Play
    const statusBadge = this.panel.querySelector('#sim-status-badge') as HTMLElement;
    this.panel.querySelector('#sim-play')?.addEventListener('click', () => {
      if (sim.getIsPaused()) {
        sim.resume();
        imuService.start(50);
      } else {
        gnssService.start();
        imuService.start(50);
      }
      if (statusBadge) {
        statusBadge.textContent = 'Running';
        statusBadge.className = 'sim-controls__status-badge sim-controls__status-badge--active';
      }
    });

    // Pause
    this.panel.querySelector('#sim-pause')?.addEventListener('click', () => {
      sim.pause();
      imuService.stop();
      if (statusBadge) {
        statusBadge.textContent = 'Paused';
        statusBadge.className = 'sim-controls__status-badge sim-controls__status-badge--paused';
      }
    });

    // Reset
    this.panel.querySelector('#sim-reset')?.addEventListener('click', () => {
      sim.reset();
      this.updateProgressDisplay(0);
      if (statusBadge) {
        statusBadge.textContent = 'Ready';
        statusBadge.className = 'sim-controls__status-badge';
      }
    });

    // Speed buttons
    const speedBtns = this.panel.querySelectorAll('.sim-controls__speed-btn');
    speedBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const speed = parseFloat((btn as HTMLElement).dataset.speed ?? '1');
        sim.setSpeedMultiplier(speed);
        speedBtns.forEach((b) => b.classList.remove('sim-controls__speed-btn--active'));
        btn.classList.add('sim-controls__speed-btn--active');
      });
    });

    // Multi-Constellation Mode Pill Buttons
    const btnAll = this.panel.querySelector('#btn-mode-all') as HTMLElement;
    const btnNavic = this.panel.querySelector('#btn-mode-navic') as HTMLElement;
    const btnGps = this.panel.querySelector('#btn-mode-gps') as HTMLElement;
    const constellationPills = [btnAll, btnNavic, btnGps];

    btnAll?.addEventListener('click', () => {
      sim.setConstellationMode('all');
      constellationPills.forEach((p) => p.classList.remove('sim-controls__pill-btn--active'));
      btnAll.classList.add('sim-controls__pill-btn--active');
    });

    btnNavic?.addEventListener('click', () => {
      sim.setConstellationMode('navic-only');
      constellationPills.forEach((p) => p.classList.remove('sim-controls__pill-btn--active'));
      btnNavic.classList.add('sim-controls__pill-btn--active');
    });

    btnGps?.addEventListener('click', () => {
      sim.setConstellationMode('gps-only');
      constellationPills.forEach((p) => p.classList.remove('sim-controls__pill-btn--active'));
      btnGps.classList.add('sim-controls__pill-btn--active');
    });

    // Signal quality
    const signalSelect = this.panel.querySelector('#sim-signal') as HTMLSelectElement;
    signalSelect?.addEventListener('change', () => {
      sim.setSignalQuality(signalSelect.value as 'strong' | 'moderate' | 'weak');
    });

    // Fault Injection: Tunnel Outage (15s)
    this.panel.querySelector('#sim-fault-tunnel')?.addEventListener('click', () => {
      sim.simulateOutage(15000);
      if (statusBadge) {
        statusBadge.textContent = 'Outage (15s)';
        statusBadge.className = 'sim-controls__status-badge sim-controls__status-badge--danger';
        setTimeout(() => {
          if (statusBadge && statusBadge.textContent?.includes('Outage')) {
            statusBadge.textContent = 'Running';
            statusBadge.className = 'sim-controls__status-badge sim-controls__status-badge--active';
          }
        }, 15000);
      }
    });

    // Fault Injection: Urban Canyon
    this.panel.querySelector('#sim-fault-canyon')?.addEventListener('click', () => {
      sim.setSignalQuality('weak');
      if (signalSelect) signalSelect.value = 'weak';
      if (statusBadge) {
        statusBadge.textContent = 'Urban Canyon';
        statusBadge.className = 'sim-controls__status-badge sim-controls__status-badge--warning';
      }
    });

    // Fault Injection: Diverge Off-Route (10s)
    this.panel.querySelector('#sim-fault-offroute')?.addEventListener('click', () => {
      if (this.offrouteTimer) clearTimeout(this.offrouteTimer);

      // Inject offset ~60m north-east
      sim.injectPositionOffset(0.004, 0.004);
      if (statusBadge) {
        statusBadge.textContent = 'Off-Route (10s)';
        statusBadge.className = 'sim-controls__status-badge sim-controls__status-badge--warning';
      }

      this.offrouteTimer = setTimeout(() => {
        sim.clearPositionOffset();
        if (statusBadge && statusBadge.textContent?.includes('Off-Route')) {
          statusBadge.textContent = 'Running';
          statusBadge.className = 'sim-controls__status-badge sim-controls__status-badge--active';
        }
      }, 10000);
    });
  }

  private startProgressTicker(): void {
    this.scrubberTimer = setInterval(() => {
      const sim = gnssService.getSimulator();
      if (!sim.getIsPaused()) {
        const progress = sim.getProgress();
        const scrubber = this.panel.querySelector('#sim-scrubber') as HTMLInputElement | null;
        if (scrubber && document.activeElement !== scrubber) {
          scrubber.value = Math.round(progress * 1000).toString();
          this.updateProgressDisplay(progress);
        }
      }
    }, 500);
  }

  private updateProgressDisplay(fraction: number): void {
    const sim = gnssService.getSimulator();
    const pct = Math.round(fraction * 100);
    const totalDistKm = (sim.getTotalDistance() / 1000).toFixed(1);
    const traveledKm = ((fraction * sim.getTotalDistance()) / 1000).toFixed(1);

    const pctSpan = this.panel.querySelector('#sim-scrubber-pct');
    const distSpan = this.panel.querySelector('#sim-scrubber-dist');
    const timeSpan = this.panel.querySelector('#sim-scrubber-time');

    if (pctSpan) pctSpan.textContent = `${pct}%`;
    if (distSpan) distSpan.textContent = `${traveledKm} / ${totalDistKm} km`;

    // Rough elapsed time approximation
    const elapsedSeconds = Math.round(fraction * 180);
    const m = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const s = (elapsedSeconds % 60).toString().padStart(2, '0');
    if (timeSpan) timeSpan.textContent = `${m}:${s}`;
  }

  public destroy(): void {
    if (this.scrubberTimer) {
      clearInterval(this.scrubberTimer);
      this.scrubberTimer = null;
    }
    if (this.offrouteTimer) {
      clearTimeout(this.offrouteTimer);
      this.offrouteTimer = null;
    }
  }
}
