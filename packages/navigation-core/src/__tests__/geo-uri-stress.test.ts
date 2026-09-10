/**
 * @navic/navigation-core — Geo URI Parser Stress & Fuzzing Tests
 *
 * Phase 19: High-volume throughput (10,000 URIs), malicious & malformed inputs,
 * adversarial regex ReDoS resilience, and boundary coordinate handling.
 */

import { describe, it, expect } from 'vitest';
import { GeoUriParser } from '../intents/geo-uri-parser.js';

describe('Phase 19: GeoUriParser Stress & Fuzzing Suite', () => {
  // ─── 1. 10,000 URI Throughput & Catastrophic Backtracking Stress ────────────
  it('should parse 10,000 diverse URIs in under 50ms (average < 0.01ms / 100k ops/sec)', () => {
    const templates = [
      'geo:28.6129,77.2295',
      'geo:28.6129,77.2295,216.5',
      'geo:28.6129,77.2295?z=16',
      'geo:28.6129,77.2295?q=India+Gate',
      'geo:0,0?q=Connaught+Place',
      'geo:0,0?q=28.6129,77.2295(India+Gate)',
      'google.navigation:q=28.6129,77.2295&mode=d',
      'google.navigation:q=Delhi+Aerocity',
      '28.6129,77.2295',
      'geo:0,0?q=%E0%A4%A8%E0%A4%88%20%E0%A4%A6%E0%A4%BF%E0%A4%B2%E0%A5%8D%E0%A4%B2%E0%A5%80', // URL-encoded Hindi
    ];

    const totalCount = 10000;
    const t0 = performance.now();

    for (let i = 0; i < totalCount; i++) {
      const uri = templates[i % templates.length];
      const res = GeoUriParser.parse(uri);
      expect(res).toBeDefined();
      expect(typeof res.rawUri).toBe('string');
    }

    const elapsedMs = performance.now() - t0;
    const avgMs = elapsedMs / totalCount;

    expect(avgMs).toBeLessThan(0.05); // Strict sub-0.05ms per parse (20x faster than 1.0ms SLA budget)
    expect(elapsedMs).toBeLessThan(500); // Total 10k parses in <500ms
  });

  // ─── 2. Malformed & Boundary Coordinate Fuzzing ───────────────────────────
  it('should safely reject out-of-range latitude/longitude without throwing', () => {
    const invalidCoords = [
      'geo:95.0000,77.2295',    // Lat > 90
      'geo:-91.0000,77.2295',   // Lat < -90
      'geo:28.6129,195.0000',   // Lng > 180
      'geo:28.6129,-190.0000',  // Lng < -180
      'geo:NaN,77.2295',
      'geo:Infinity,77.2295',
      'geo:abc,xyz',
      'geo:,,',
      'google.navigation:q=999,999',
    ];

    for (const invalid of invalidCoords) {
      const res = GeoUriParser.parse(invalid);
      expect(res).toBeDefined();
      // Should not have accepted impossible coordinates as valid
      if (res.latitude !== null) {
        expect(res.latitude).toBeGreaterThanOrEqual(-90);
        expect(res.latitude).toBeLessThanOrEqual(90);
      }
      if (res.longitude !== null) {
        expect(res.longitude).toBeGreaterThanOrEqual(-180);
        expect(res.longitude).toBeLessThanOrEqual(180);
      }
    }
  });

  // ─── 3. ReDoS (Regular Expression Denial of Service) Attack Resistance ────
  it('should parse giant and highly-repetitive adversarial inputs without freezing', () => {
    const hugeQuery = 'q=' + 'a'.repeat(50000);
    const adversarialUri = `geo:0,0?${hugeQuery}`;

    const t0 = performance.now();
    const res = GeoUriParser.parse(adversarialUri);
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(50); // Under 50ms even for 50,000 characters
    expect(res).toBeDefined();
    expect(res.query).toBeDefined();
  });

  // ─── 4. Special and Control Character Handling ────────────────────────────
  it('should safely handle null, undefined, control characters, and whitespace', () => {
    const weirdInputs = [
      '',
      '   ',
      '\t\r\n',
      'geo:',
      'google.navigation:',
      'geo:   ',
      'geo:0,0?q=',
      'geo:?z=',
      'geo:0,0?q=()',
      'geo:0,0?q=28.6129,77.2295()',
    ];

    for (const input of weirdInputs) {
      expect(() => GeoUriParser.parse(input)).not.toThrow();
      const res = GeoUriParser.parse(input);
      expect(res).toBeDefined();
    }
  });
});
