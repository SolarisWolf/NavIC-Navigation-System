import fs from 'fs';
import { RoadGraph, OfflineRoutingEngine } from '../packages/routing-core/dist/index.js';

const graphData = JSON.parse(fs.readFileSync('data/maps/bengaluru-compiled-graph.json', 'utf8'));
const g = new RoadGraph();
for (const n of graphData.nodes) {
  g.addNode(n.id, n.coordinate, n.name);
}
for (const e of graphData.edges) {
  g.addEdge(e);
}
console.log('Graph built in RAM: nodes =', g.nodeCount(), 'edges =', g.edgeCount());

// Test snap from Vidyapeetha Circle (12.9343, 77.5627)
const vidyaSnap = g.findNearestNode({ latitude: 12.9343, longitude: 77.5627 }, 500);
console.log('Vidya snap:', vidyaSnap?.node.name, 'dist:', vidyaSnap?.distance.toFixed(1), 'm');

// Test snap to Bull Temple (12.9425, 77.5680)
const bullSnap = g.findNearestNode({ latitude: 12.9425, longitude: 77.5680 }, 500);
console.log('Bull snap:', bullSnap?.node.name, 'dist:', bullSnap?.distance.toFixed(1), 'm');

// Route calculation
const engine = new OfflineRoutingEngine({ graph: g });
const t0 = performance.now();
const route = await engine.calculateRoute({
  origin: { latitude: 12.9343, longitude: 77.5627 },
  destination: { latitude: 12.9425, longitude: 77.5680 }
});
const ms = performance.now() - t0;
console.log('Route calculated in', ms.toFixed(1), 'ms:');
console.log('Distance:', (route.distance / 1000).toFixed(2), 'km, duration:', Math.round(route.duration / 60), 'min');
console.log('Maneuvers:', route.instructions.length);
console.log('Geometry points:', route.geometry.length);
for (const inst of route.instructions) {
  console.log('  ->', inst.maneuver, inst.roadName, inst.distanceToNext, 'm');
}
