import fs from 'fs';

console.log('Querying Overpass API for comprehensive Bengaluru road network...');

const query = `[out:json][timeout:90];
(
  // 1. All motorways, trunks, primaries, secondaries, and tertiaries for Bengaluru urban area
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary)"](12.89,77.51,13.05,77.67);
  
  // 2. High-density residential & local streets for user neighborhood (Vidyapeetha, Ashok Nagar, Hanumanthanagar, Basavanagudi, Jayanagar, Banashankari)
  way["highway"~"^(residential|unclassified|living_street)"](12.915,77.545,12.965,77.595);
);
out tags geom;
`;

async function run() {
  try {
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter'
    ];
    let res;
    for (const ep of endpoints) {
      try {
        console.log(`Trying endpoint ${ep}...`);
        res = await fetch(ep, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'NavIC-Navigation-Offline/1.0 (offline navigation research)'
          }
        });
        if (res.ok) break;
        console.warn(`Endpoint ${ep} returned ${res.status}: ${res.statusText}`);
      } catch (e) {
        console.warn(`Endpoint ${ep} error:`, e.message);
      }
    }
    if (!res || !res.ok) {
      throw new Error(`All endpoints failed: ${res?.status} ${res?.statusText}`);
    }
    const json = await res.json();
    console.log(`Fetched ${json.elements.length} road ways from Overpass!`);
    const waysWithGeom = json.elements.filter(e => e.type === 'way' && e.geometry && e.geometry.length >= 2);
    console.log(`Ways with valid geometry: ${waysWithGeom.length}`);
    fs.writeFileSync('data/maps/bengaluru-osm-roads.json', JSON.stringify(waysWithGeom, null, 2));
    console.log('Saved to data/maps/bengaluru-osm-roads.json');
  } catch (err) {
    console.error('Overpass download failed:', err);
  }
}

run();
