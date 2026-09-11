/**
 * @navic/routing-core — Bengaluru (Bangalore) High-Density Road Network
 *
 * Pre-compiled offline topological road graph of Bengaluru derived from
 * OpenStreetMap (OSM) geographic data. Contains 3,966+ topological junction nodes,
 * 5,400+ road edges, and 28,000+ detailed curvature coordinates.
 *
 * Covers:
 *  - User Neighborhood: Ashok Nagar 50ft Road, Vidyapeetha Circle, Srinagar, Hanumanthanagar,
 *    Mount Joy Road, 2nd Cross Road, Bugle Rock Road, Kathriguppe, Kamakya.
 *  - South Bengaluru: Bull Temple Road, DVG Road, Gandhi Bazaar, National College Metro,
 *    South End Circle, Jayanagar (all blocks), Banashankari TTMC & Metro, Kanakapura Road.
 *  - Central & Commercial Arterials: Lalbagh (West/Main/East Gates), Double Road (KH Road),
 *    JC Road, Town Hall, Corporation Circle, KR Market, Sirsi Circle Flyover, KSR Majestic Railway,
 *    Cubbon Park, Vidhana Soudha, Residency Road, MG Road, Brigade Road, Trinity Circle.
 *  - Radials & Expressways: Koramangala, Central Silk Board, Electronic City Expressway (NH 44),
 *    HSR Layout, Marathahalli, Domlur, Indiranagar 100ft Rd, Old Airport Road, Mekhri Circle, Hebbal.
 */

import { RoadGraph } from './road-graph.js';
import osmGraph from './bengaluru-compiled-graph.json';

// Named landmark reference locations for quick lookup and backwards compatibility
const LANDMARK_ALIASES: Array<{ id: string; lat: number; lon: number; name: string }> = [
  { id: 'BLR_ASHOK_NAGAR_MAIN', lat: 12.9343, lon: 77.5627, name: 'Ashoka Nagara 50ft Road' },
  { id: 'BLR_VIDYAPEETHA_CIRCLE', lat: 12.9360, lon: 77.5615, name: 'Vidyapeetha Circle' },
  { id: 'BLR_SRINAGAR_50FT', lat: 12.9405, lon: 77.5580, name: 'Srinagar 50 Feet Main Road' },
  { id: 'BLR_HANUMANTHNAGAR', lat: 12.9430, lon: 77.5615, name: 'Hanumanthnagar Mount Joy Road' },
  { id: 'BLR_KATHRIGUPPE_ORR', lat: 12.9245, lon: 77.5505, name: 'Outer Ring Road — Kathriguppe Signal' },
  { id: 'BLR_KAMAKYA_ORR', lat: 12.9210, lon: 77.5550, name: 'Outer Ring Road — Kamakya Junction' },
  { id: 'BLR_BANASHANKARI_BDA', lat: 12.9155, lon: 77.5735, name: 'Banashankari BDA Complex / Bus Station' },
  { id: 'BLR_BANASHANKARI_METRO', lat: 12.9175, lon: 77.5740, name: 'Banashankari Metro / Kanakapura Road' },
  { id: 'BLR_JP_NAGAR_SARAKKI', lat: 12.9075, lon: 77.5760, name: 'Sarakki Junction — Kanakapura Road' },
  { id: 'BLR_BULL_TEMPLE', lat: 12.9425, lon: 77.5680, name: 'Bull Temple Road — Dodda Ganesha' },
  { id: 'BLR_GANDHI_BAZAAR', lat: 12.9465, lon: 77.5700, name: 'Gandhi Bazaar Main Road' },
  { id: 'BLR_NATIONAL_COLLEGE', lat: 12.9500, lon: 77.5735, name: 'KR Road — National College Metro' },
  { id: 'BLR_SOUTH_END_CIRCLE', lat: 12.9370, lon: 77.5805, name: 'South End Circle Metro' },
  { id: 'BLR_JAYANAGAR_4TH_BLOCK', lat: 12.9295, lon: 77.5835, name: 'Jayanagar 4th Block Complex' },
  { id: 'BLR_JAYANAGAR_EAST_END', lat: 12.9180, lon: 77.5920, name: 'Jayanagar 9th Block — East End' },
  { id: 'BLR_LALBAGH_WEST_GATE', lat: 12.9490, lon: 77.5805, name: 'Lalbagh Botanical Garden — West Gate' },
  { id: 'BLR_LALBAGH_MAIN_GATE', lat: 12.9555, lon: 77.5865, name: 'Lalbagh Main Gate — Double Road' },
  { id: 'BLR_LALBAGH_EAST_GATE', lat: 12.9480, lon: 77.5925, name: 'Lalbagh East Gate — Siddapura' },
  { id: 'BLR_DAIRY_CIRCLE', lat: 12.9375, lon: 77.6000, name: 'Dairy Circle — Bannerghatta Road' },
  { id: 'BLR_NIMHANS_HOSPITAL', lat: 12.9385, lon: 77.5940, name: 'Hosur Road — NIMHANS Hospital' },
  { id: 'BLR_KR_MARKET', lat: 12.9620, lon: 77.5750, name: 'KR Market / Victoria Hospital' },
  { id: 'BLR_SIRSI_CIRCLE', lat: 12.9580, lon: 77.5550, name: 'Sirsi Circle Flyover / Mysore Road' },
  { id: 'BLR_TOWN_HALL', lat: 12.9650, lon: 77.5855, name: 'JC Road — Town Hall' },
  { id: 'BLR_CORPORATION_CIRCLE', lat: 12.9680, lon: 77.5875, name: 'Corporation Circle / Hudson Circle' },
  { id: 'BLR_MAJESTIC_STATION', lat: 12.9780, lon: 77.5700, name: 'KSR Bengaluru City Railway / Majestic' },
  { id: 'BLR_CUBBON_PARK_CENTRAL', lat: 12.9750, lon: 77.5930, name: 'Cubbon Park — Kasturba Road' },
  { id: 'BLR_VIDHANA_SOUDHA', lat: 12.9795, lon: 77.5910, name: 'Vidhana Soudha / High Court' },
  { id: 'BLR_RICHMOND_CIRCLE', lat: 12.9660, lon: 77.5995, name: 'Richmond Circle / Residency Road' },
  { id: 'BLR_MG_ROAD_BRIGADE', lat: 12.9740, lon: 77.6075, name: 'MG Road — Brigade Road Junction' },
  { id: 'BLR_TRINITY_CIRCLE', lat: 12.9725, lon: 77.6200, name: 'Trinity Circle / Halasuru' },
  { id: 'BLR_KORAMANGALA_BDA', lat: 12.9340, lon: 77.6180, name: 'Koramangala BDA Complex' },
  { id: 'BLR_KORAMANGALA_SONY_WORLD', lat: 12.9350, lon: 77.6255, name: 'Koramangala 100ft Rd — Sony World Signal' },
  { id: 'BLR_ST_JOHNS_SIGNAL', lat: 12.9300, lon: 77.6190, name: 'St. John’s Hospital Junction' },
  { id: 'BLR_SILK_BOARD', lat: 12.9175, lon: 77.6235, name: 'Central Silk Board Interchange' },
  { id: 'BLR_HSR_LAYOUT_RING_ROAD', lat: 12.9120, lon: 77.6400, name: 'Outer Ring Road — HSR Layout' },
  { id: 'BLR_ELECTRONIC_CITY_TOLL', lat: 12.8450, lon: 77.6650, name: 'Electronic City Expressway Toll' },
  { id: 'BLR_DOMLUR_FLYOVER', lat: 12.9610, lon: 77.6385, name: 'Old Airport Road — Domlur Flyover' },
  { id: 'BLR_INDIRANAGAR_100FT', lat: 12.9780, lon: 77.6405, name: 'Indiranagar 100 Feet Road' },
  { id: 'BLR_MARATHAHALLI_BRIDGE', lat: 12.9555, lon: 77.7015, name: 'Outer Ring Road — Marathahalli Bridge' },
  { id: 'BLR_WHITEFIELD_ITPL', lat: 12.9860, lon: 77.7300, name: 'Whitefield — ITPL Main Gate' },
  { id: 'BLR_MEKHRI_CIRCLE', lat: 13.0070, lon: 77.5840, name: 'Bellary Road — Mekhri Circle' },
  { id: 'BLR_HEBBAL_FLYOVER', lat: 13.0350, lon: 77.5975, name: 'Hebbal Flyover / Airport Expressway' },
  { id: 'BLR_YESHWANTHPUR_CIRCLE', lat: 13.0220, lon: 77.5500, name: 'Yeshwanthpur Circle / Tumkur Road' },
  { id: 'BLR_MALLESHWARAM_8TH_MAIN', lat: 12.9980, lon: 77.5700, name: 'Malleshwaram 8th Main Road' },
  { id: 'BLR_RAJAJINAGAR_ENTRANCE', lat: 12.9880, lon: 77.5550, name: 'Rajajinagar — West of Chord Road' },
];

export function buildBangaloreRoadGraph(): RoadGraph {
  const g = new RoadGraph();

  // 1. Populate all OpenStreetMap topological nodes
  for (const n of osmGraph.nodes) {
    g.addNode(n.id, n.coordinate, n.name);
  }

  // 2. Populate all OpenStreetMap topological edges with true curvature polylines
  for (const e of osmGraph.edges) {
    g.addEdge({
      id: e.id,
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
      roadName: e.roadName,
      roadType: e.roadType as any,
      oneWay: e.oneWay,
      geometry: e.geometry,
    });
  }

  // 3. Connect landmark aliases directly into the OSM network
  for (const lm of LANDMARK_ALIASES) {
    const lmCoord = { latitude: lm.lat, longitude: lm.lon };
    // Find nearest OSM junction node within 1000m to bridge into graph
    const nearest = g.findNearestNode(lmCoord, 1000);
    g.addNode(lm.id, lmCoord, lm.name);

    if (nearest) {
      g.addEdge({
        id: `blr_conn_${lm.id.toLowerCase()}`,
        fromNodeId: lm.id,
        toNodeId: nearest.node.id,
        roadName: nearest.node.name || 'Access Road',
        roadType: 'service',
        oneWay: false,
        geometry: [lmCoord, nearest.node.coordinate],
      });
    }
  }

  return g;
}
