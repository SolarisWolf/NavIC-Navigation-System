import fs from 'fs';

async function fetchResidential() {
  const query = `[out:json][timeout:30];
way["highway"~"^(residential|living_street)"](12.92,77.545,12.955,77.585);
out tags geom;
`;
  console.log('Fetching residential streets for Vidyapeetha / Banashankari / Basavanagudi...');
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'NavIC-Offline/1.0'
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  const validWays = (data.elements || []).filter(e => e.type === 'way' && e.geometry && e.geometry.length >= 2);
  console.log('Residential ways fetched with geometry:', validWays.length);
  fs.writeFileSync('data/maps/bengaluru-residential-neighborhood.json', JSON.stringify(validWays, null, 2));
  console.log('Saved to data/maps/bengaluru-residential-neighborhood.json');
}

fetchResidential().catch(e => console.error('Error:', e.message));
