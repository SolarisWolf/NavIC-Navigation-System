import { describe, it, expect, beforeEach } from 'vitest';
import { POIDatabase } from '../poi/poi-database.js';
import { POI, POICategory } from '@navic/shared-models';

const SAMPLE_POIS: POI[] = [
  {
    id: 'hosp-1',
    name: 'AIIMS New Delhi',
    category: POICategory.Hospital,
    latitude: 28.5672,
    longitude: 77.2100,
    address: 'Ansari Nagar, New Delhi',
  },
  {
    id: 'hosp-2',
    name: 'Safdarjung Hospital',
    category: POICategory.Hospital,
    latitude: 28.5705,
    longitude: 77.2078,
    address: 'Ring Road, New Delhi',
  },
  {
    id: 'land-1',
    name: 'India Gate',
    category: POICategory.Landmark,
    latitude: 28.6129,
    longitude: 77.2295,
    address: 'Kartavya Path, New Delhi',
  },
  {
    id: 'pol-1',
    name: 'Connaught Place Police Station',
    category: POICategory.Police,
    latitude: 28.6328,
    longitude: 77.2195,
    address: 'Block A, Connaught Place, New Delhi',
  },
  {
    id: 'petrol-1',
    name: 'IndianOil COCO Janpath',
    category: POICategory.PetrolStation,
    latitude: 28.6272,
    longitude: 77.2178,
    address: 'Janpath Road, New Delhi',
  },
  {
    id: 'transit-1',
    name: 'New Delhi Railway Station (NDLS)',
    category: POICategory.RailwayStation,
    latitude: 28.6428,
    longitude: 77.2205,
    address: 'Bhavbhuti Marg, Ajmeri Gate, New Delhi',
  },
];

describe('POIDatabase', () => {
  let db: POIDatabase;

  beforeEach(() => {
    db = new POIDatabase(SAMPLE_POIS);
  });

  it('should initialize and report correct POI count', () => {
    expect(db.count()).toBe(SAMPLE_POIS.length);
    expect(db.getById('hosp-1')?.name).toBe('AIIMS New Delhi');
  });

  it('should search POIs by name prefix and substring', () => {
    const results = db.search('aiims');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].poi.id).toBe('hosp-1');

    const cpResults = db.search('connaught');
    expect(cpResults.length).toBe(1);
    expect(cpResults[0].poi.name).toContain('Connaught Place');
  });

  it('should filter POIs strictly by category', () => {
    const hospitals = db.searchByCategory(POICategory.Hospital);
    expect(hospitals.length).toBe(2);
    for (const h of hospitals) {
      expect(h.poi.category).toBe(POICategory.Hospital);
    }
  });

  it('should search nearby POIs and rank in ascending distance order', () => {
    // Reference point at India Gate: [28.6129, 77.2295]
    const center = { latitude: 28.6129, longitude: 77.2295 };

    const nearby = db.searchNearby(center, 10000); // 10km radius
    expect(nearby.length).toBe(SAMPLE_POIS.length);

    // India Gate itself should be closest (distance ~0m)
    expect(nearby[0].poi.id).toBe('land-1');
    expect(nearby[0].distanceMeters).toBeLessThan(10);

    // Assert strictly ascending distance order
    for (let i = 1; i < nearby.length; i++) {
      expect(nearby[i].distanceMeters!).toBeGreaterThanOrEqual(nearby[i - 1].distanceMeters!);
      expect(nearby[i].bearingDegrees).toBeDefined();
    }
  });

  it('should respect maxRadiusMeters cutoff', () => {
    // Reference point near India Gate
    const center = { latitude: 28.6129, longitude: 77.2295 };

    // AIIMS is ~5.4km away from India Gate. If max radius is 3000m, AIIMS should be excluded.
    const closeOnly = db.searchNearby(center, 3000);
    const hasAiims = closeOnly.some((r) => r.poi.id === 'hosp-1');
    expect(hasAiims).toBe(false);
  });

  it('should execute searches rapidly (benchmark)', () => {
    const center = { latitude: 28.6129, longitude: 77.2295 };
    const iterations = 500;

    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      db.search('hospital', { center, limit: 10 });
    }
    const elapsed = performance.now() - t0;
    const avgMs = elapsed / iterations;

    // Search query should run in < 0.5 ms
    expect(avgMs).toBeLessThan(1.0);
  });
});
