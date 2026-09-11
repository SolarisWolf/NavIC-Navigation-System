import fs from 'fs';

// Read OSM ways
const ways = JSON.parse(fs.readFileSync('data/maps/bengaluru-osm-roads.json', 'utf8'));
console.log(`Loaded ${ways.length} OSM ways.`);

// Coordinate key helper (~2-3 meter clustering)
function coordKey(lat, lon) {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

function haversineDist(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// 1. Find all point occurrences to determine junction nodes
const coordOccurrences = new Map(); // key -> count

for (const w of ways) {
  const geom = w.geometry;
  if (!geom || geom.length < 2) continue;
  
  // Way endpoints are always junction candidates
  const startKey = coordKey(geom[0].lat, geom[0].lon);
  const endKey = coordKey(geom[geom.length - 1].lat, geom[geom.length - 1].lon);
  coordOccurrences.set(startKey, (coordOccurrences.get(startKey) || 0) + 2);
  coordOccurrences.set(endKey, (coordOccurrences.get(endKey) || 0) + 2);

  // Intermediate points
  for (let i = 1; i < geom.length - 1; i++) {
    const key = coordKey(geom[i].lat, geom[i].lon);
    coordOccurrences.set(key, (coordOccurrences.get(key) || 0) + 1);
  }
}

// Points that appear >= 2 times (or are way endpoints) are junction nodes
const nodesMap = new Map(); // nodeId -> { id, lat, lon, name }
const coordToNodeId = new Map();

function getOrCreateNode(lat, lon, roadName) {
  const key = coordKey(lat, lon);
  let nodeId = coordToNodeId.get(key);
  if (!nodeId) {
    nodeId = `BLR_N_${nodesMap.size + 1}`;
    coordToNodeId.set(key, nodeId);
    nodesMap.set(nodeId, {
      id: nodeId,
      coordinate: { latitude: Number(lat.toFixed(6)), longitude: Number(lon.toFixed(6)) },
      name: roadName || 'Junction'
    });
  }
  return nodeId;
}

// 2. Split ways into edges between junction nodes
const edgesList = [];
let edgeIdCounter = 1;

for (const w of ways) {
  const geom = w.geometry;
  if (!geom || geom.length < 2) continue;

  const rawHw = w.tags?.highway || 'secondary';
  let roadType = 'secondary';
  if (rawHw.startsWith('motorway')) roadType = 'motorway';
  else if (rawHw.startsWith('trunk')) roadType = 'trunk';
  else if (rawHw.startsWith('primary')) roadType = 'primary';
  else if (rawHw.startsWith('secondary')) roadType = 'secondary';
  else if (rawHw.startsWith('tertiary')) roadType = 'tertiary';
  else if (rawHw.startsWith('residential')) roadType = 'residential';

  const roadName = w.tags?.name || (roadType.charAt(0).toUpperCase() + roadType.slice(1) + ' Road');
  const isOneWay = w.tags?.oneway === 'yes' || w.tags?.oneway === '1' || rawHw.includes('motorway');

  let segmentStartIdx = 0;
  for (let i = 1; i < geom.length; i++) {
    const key = coordKey(geom[i].lat, geom[i].lon);
    const count = coordOccurrences.get(key) || 0;
    const isJunction = count >= 2 || i === geom.length - 1;

    if (isJunction) {
      const fromNodeId = getOrCreateNode(geom[segmentStartIdx].lat, geom[segmentStartIdx].lon, roadName);
      const toNodeId = getOrCreateNode(geom[i].lat, geom[i].lon, roadName);

      if (fromNodeId !== toNodeId) {
        // Slice geometry points
        const subGeom = geom.slice(segmentStartIdx, i + 1).map(pt => ({
          latitude: Number(pt.lat.toFixed(6)),
          longitude: Number(pt.lon.toFixed(6))
        }));

        edgesList.push({
          id: `blr_osm_${edgeIdCounter++}`,
          fromNodeId,
          toNodeId,
          roadName,
          roadType,
          oneWay: isOneWay,
          geometry: subGeom
        });
      }
      segmentStartIdx = i;
    }
  }
}

console.log(`Extracted ${nodesMap.size} topological nodes and ${edgesList.length} edges!`);

// Write compiled JSON graph for fast bundling
const compiledGraph = {
  nodes: Array.from(nodesMap.values()),
  edges: edgesList
};

fs.writeFileSync('data/maps/bengaluru-compiled-graph.json', JSON.stringify(compiledGraph));
console.log('Saved to data/maps/bengaluru-compiled-graph.json');
const stats = fs.statSync('data/maps/bengaluru-compiled-graph.json');
console.log(`Compiled graph file size: ${(stats.size / 1024).toFixed(1)} KB`);
