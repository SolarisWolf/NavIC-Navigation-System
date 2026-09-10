/**
 * @navic/gnss-core — Simulation Scenarios & Controls Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  GNSSSimulator,
  RouteInterpolator,
  getScenario,
  getScenarioNames,
  SCENARIOS,
  Constellation,
  FixType,
} from '../index.js';

describe('Simulation Scenarios & RouteInterpolator', () => {
  it('defines all required Delhi NCR scenarios with valid waypoints', () => {
    const names = getScenarioNames();
    expect(names).toContain('connaught-to-indiagate');
    expect(names).toContain('pragati-maidan-tunnel');
    expect(names).toContain('urban-canyon-nehru');
    expect(names).toContain('nh44-highway-cruise');
    expect(names).toContain('offroute-recalculation');

    for (const name of names) {
      const scenario = SCENARIOS[name];
      expect(scenario.name).toBeDefined();
      expect(scenario.description).toBeDefined();
      expect(scenario.waypoints.length).toBeGreaterThanOrEqual(1);

      for (const wp of scenario.waypoints) {
        expect(wp.latitude).toBeGreaterThan(10);
        expect(wp.latitude).toBeLessThan(35);
        expect(wp.longitude).toBeGreaterThan(70);
        expect(wp.longitude).toBeLessThan(90);
        expect(wp.speedMps).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('interpolates along scenario waypoints over time', () => {
    const scenario = getScenario('connaught-to-indiagate');
    const interpolator = new RouteInterpolator(scenario);

    expect(interpolator.getTotalDistance()).toBeGreaterThan(2000);
    expect(interpolator.getProgress()).toBe(0);

    // Update by 10 seconds (10,000 ms)
    const state = interpolator.update(10000);
    expect(state.latitude).toBeCloseTo(28.63, 1);
    expect(state.longitude).toBeCloseTo(77.22, 1);
    expect(interpolator.getProgress()).toBeGreaterThan(0);
  });

  it('supports timeline seeking to arbitrary progress fractions', () => {
    const scenario = getScenario('connaught-to-indiagate');
    const interpolator = new RouteInterpolator(scenario);

    // Seek to 50%
    interpolator.seek(0.5);
    expect(interpolator.getProgress()).toBeCloseTo(0.5, 1);

    // Seek to 100% (destination)
    interpolator.seek(1.0);
    expect(interpolator.getProgress()).toBeCloseTo(1.0, 1);

    // Seek to 0% (reset start)
    interpolator.seek(0.0);
    expect(interpolator.getProgress()).toBeCloseTo(0.0, 1);
  });

  it('detects tunnel and urban canyon environmental metadata', () => {
    const tunnelScenario = getScenario('pragati-maidan-tunnel');
    const interpolator = new RouteInterpolator(tunnelScenario);

    // Seek into the subterranean section (approx 40% progress)
    interpolator.seek(0.4);
    const state = interpolator.update(100);
    expect(state.isTunnel).toBe(true);
  });
});

describe('GNSSSimulator Playback & Fault Injections', () => {
  let sim: GNSSSimulator;

  beforeEach(() => {
    sim = new GNSSSimulator({
      scenario: 'connaught-to-indiagate',
      speedMultiplier: 1,
    });
  });

  it('filters constellations dynamically (NavIC-only mode)', () => {
    sim.setConstellationMode('navic-only');

    let receivedMeasurement = false;
    sim.onMeasurement((m) => {
      receivedMeasurement = true;
      // All satellites emitted should be NavIC
      for (const sat of m.satellites) {
        expect(sat.constellation).toBe(Constellation.NavIC);
      }
    });

    sim.start();
    // Force one measurement tick
    (sim as any).generateMeasurement();
    expect(receivedMeasurement).toBe(true);
    sim.stop();
  });

  it('handles manual GNSS outage and returns NoFix', () => {
    sim.simulateOutage(5000);

    let measurementFix: FixType | null = null;
    sim.onMeasurement((m) => {
      measurementFix = m.fixType;
    });

    (sim as any).generateMeasurement();
    expect(measurementFix).toBe(FixType.NoFix);
  });

  it('supports speed multiplier and seek controls on the simulator', () => {
    sim.setSpeedMultiplier(5);
    expect(sim.getSpeedMultiplier()).toBe(5);

    sim.seek(0.75);
    expect(sim.getProgress()).toBeCloseTo(0.75, 1);
  });

  it('injects artificial coordinate offsets for off-route testing', () => {
    const baseline = (sim as any).routeInterpolator.update(0);

    sim.injectPositionOffset(0.005, 0.005);
    let emittedLat = 0;
    sim.onMeasurement((m) => {
      emittedLat = m.latitude;
    });

    (sim as any).generateMeasurement();
    // Emitted latitude should be approximately baseline + 0.005 (with slight noise)
    expect(emittedLat).toBeCloseTo(baseline.latitude + 0.005, 2);

    sim.clearPositionOffset();
  });
});
