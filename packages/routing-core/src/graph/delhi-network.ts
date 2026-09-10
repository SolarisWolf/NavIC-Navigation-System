/**
 * @navic/routing-core — Delhi NCR Road Network
 *
 * Pre-compiled offline topological road graph of Delhi NCR.
 * Models major expressways, Ring Roads, radial corridors,
 * and arterial avenues connecting all city centers and POIs.
 */

import { RoadGraph } from './road-graph.js';

export function buildDelhiRoadGraph(): RoadGraph {
  const g = new RoadGraph();

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Core Hubs & Intersections
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Connaught Place & Central Radials
  g.addNode('CP_INNER', { latitude: 28.6328, longitude: 77.2197 }, 'Connaught Place Central');
  g.addNode('CP_OUTER_N', { latitude: 28.6345, longitude: 77.2197 }, 'CP Outer North (Minto Rd / Chelmsford)');
  g.addNode('CP_OUTER_E', { latitude: 28.6328, longitude: 77.2225 }, 'CP Outer East (Barakhamba Rd)');
  g.addNode('CP_OUTER_S', { latitude: 28.6300, longitude: 77.2197 }, 'CP Outer South (Janpath / KG Marg)');
  g.addNode('CP_OUTER_W', { latitude: 28.6328, longitude: 77.2165 }, 'CP Outer West (BKS Marg / Baba Kharak Singh)');

  // Janpath & Parliament Area
  g.addNode('JANPATH_TOLSTOY', { latitude: 28.6250, longitude: 77.2185 }, 'Janpath - Tolstoy Marg Crossing');
  g.addNode('JANPATH_RAJPATH', { latitude: 28.6140, longitude: 77.2180 }, 'Janpath - Kartavya Path Crossing');
  g.addNode('PARLIAMENT_CIRCLE', { latitude: 28.6172, longitude: 77.2081 }, 'Parliament House Roundabout');
  g.addNode('PATEL_CHOWK', { latitude: 28.6225, longitude: 77.2120 }, 'Patel Chowk Metro');
  g.addNode('RASHTRAPATI_BHAVAN', { latitude: 28.6143, longitude: 77.1995 }, 'Vijay Chowk / Rashtrapati Bhavan');

  // India Gate C-Hexagon
  g.addNode('INDIA_GATE_HEX', { latitude: 28.6129, longitude: 77.2295 }, 'India Gate C-Hexagon');
  g.addNode('TILAK_MARG_ITO', { latitude: 28.6280, longitude: 77.2410 }, 'ITO Crossing (Tilak Marg / Vikas Marg)');
  g.addNode('MAN_SINGH_ROAD', { latitude: 28.6075, longitude: 77.2250 }, 'Shahjahan Road / Man Singh Road Junction');

  // South Central / Diplomatic Enclave
  g.addNode('MOTILAL_NEHRU_MARG', { latitude: 28.6010, longitude: 77.2180 }, 'Motilal Nehru Marg / Claridges');
  g.addNode('PRITHVIRAJ_ROAD', { latitude: 28.5980, longitude: 77.2210 }, 'Prithviraj Road - Aurobindo Marg');
  g.addNode('TEEN_MURTI', { latitude: 28.6030, longitude: 77.1980 }, 'Teen Murti Bhavan Roundabout');
  g.addNode('SHANTI_PATH_CENTRAL', { latitude: 28.5920, longitude: 77.1890 }, 'Shanti Path Diplomatic Enclave');

  // Dhaula Kuan Interchange
  g.addNode('DHAULA_KUAN', { latitude: 28.5921, longitude: 77.1650 }, 'Dhaula Kuan Multi-level Interchange');
  g.addNode('SARDAR_PATEL_MARG', { latitude: 28.6010, longitude: 77.1800 }, 'Sardar Patel Marg / 11 Murti');

  // Ring Road — Southern Arc
  g.addNode('MOTI_BAGH', { latitude: 28.5810, longitude: 77.1720 }, 'Ring Road — Moti Bagh Flyover');
  g.addNode('BHIKAJI_CAMA', { latitude: 28.5720, longitude: 77.1880 }, 'Ring Road — Bhikaji Cama Place');
  g.addNode('AIIMS_INTERCHANGE', { latitude: 28.5680, longitude: 77.2100 }, 'Ring Road — AIIMS / Safdarjung Flyover');
  g.addNode('SOUTH_EXT', { latitude: 28.5695, longitude: 77.2220 }, 'Ring Road — South Extension');
  g.addNode('MOOLCHAND', { latitude: 28.5685, longitude: 77.2350 }, 'Ring Road — Moolchand Flyover');
  g.addNode('LAJPAT_NAGAR', { latitude: 28.5700, longitude: 77.2430 }, 'Ring Road — Lajpat Nagar Central Market');
  g.addNode('ASHRAM_CHOWK', { latitude: 28.5725, longitude: 77.2600 }, 'Ashram Chowk (Mathura Road Crossing)');

  // Mathura Road & Nizamuddin
  g.addNode('NIZAMUDDIN_FLYOVER', { latitude: 28.5880, longitude: 77.2500 }, 'Mathura Road — Hazrat Nizamuddin');
  g.addNode('SUNDAR_NAGAR', { latitude: 28.6010, longitude: 77.2430 }, 'Mathura Road — Zoo / Sundar Nagar');
  g.addNode('PRAGATI_MAIDAN', { latitude: 28.6180, longitude: 77.2440 }, 'Bhairon Marg / Pragati Maidan');

  // Ring Road — Eastern & Northern Arc
  g.addNode('SARAI_KALE_KHAN', { latitude: 28.5890, longitude: 77.2620 }, 'Sarai Kale Khan ISBT / RRTS');
  g.addNode('RAJGHAT_CROSSING', { latitude: 28.6410, longitude: 77.2500 }, 'Ring Road — Rajghat');
  g.addNode('DELHI_GATE', { latitude: 28.6420, longitude: 77.2400 }, 'Delhi Gate / Asaf Ali Road');
  g.addNode('KASHMERE_GATE_ISBT', { latitude: 28.6675, longitude: 77.2310 }, 'Kashmere Gate ISBT / Ring Road');
  g.addNode('OLD_DELHI_RAILWAY', { latitude: 28.6560, longitude: 77.2280 }, 'Old Delhi Railway Station / Chandni Chowk');
  g.addNode('RED_FORT_JUNCTION', { latitude: 28.6540, longitude: 77.2410 }, 'Netaji Subhash Marg / Red Fort');
  g.addNode('NEW_DELHI_STN_AJMERI', { latitude: 28.6415, longitude: 77.2230 }, 'New Delhi Station (Ajmeri Gate)');

  // Sri Aurobindo Marg (Southward to Mehrauli)
  g.addNode('GREEN_PARK', { latitude: 28.5580, longitude: 77.2060 }, 'Sri Aurobindo Marg — Green Park Metro');
  g.addNode('HAUZ_KHAS_JUNCTION', { latitude: 28.5480, longitude: 77.2050 }, 'Sri Aurobindo Marg — Hauz Khas / Outer Ring Rd');
  g.addNode('ADCHINI', { latitude: 28.5360, longitude: 77.1980 }, 'Sri Aurobindo Marg — Adchini');
  g.addNode('QUTUB_MINAR_JUNCTION', { latitude: 28.5245, longitude: 77.1855 }, 'Mehrauli — Qutub Minar Crossing');

  // Outer Ring Road — Southern Arc
  g.addNode('IIT_DELHI_GATE', { latitude: 28.5450, longitude: 77.1920 }, 'Outer Ring Road — IIT Delhi Main Gate');
  g.addNode('MUNIRKA_FLYOVER', { latitude: 28.5520, longitude: 77.1720 }, 'Outer Ring Road — Munirka');
  g.addNode('VASANT_VIHAR', { latitude: 28.5600, longitude: 77.1610 }, 'Outer Ring Road — Vasant Vihar');
  g.addNode('CHIRAG_DELHI', { latitude: 28.5430, longitude: 77.2230 }, 'Outer Ring Road — Chirag Delhi');
  g.addNode('NEHRU_PLACE', { latitude: 28.5480, longitude: 77.2510 }, 'Outer Ring Road — Nehru Place Terminal');
  g.addNode('GREATER_KAILASH', { latitude: 28.5350, longitude: 77.2400 }, 'Greater Kailash — Outer Ring Link');
  g.addNode('OKHLA_NSIC', { latitude: 28.5490, longitude: 77.2650 }, 'Outer Ring Road — Okhla Phase 3 / Modi Mill');

  // Airport Highway Corridors
  g.addNode('DELHI_CANTT', { latitude: 28.5850, longitude: 77.1450 }, 'Delhi Cantt Station / Cariappa Marg');
  g.addNode('SUBROTO_PARK', { latitude: 28.5750, longitude: 77.1400 }, 'NH 48 — Subroto Park');
  g.addNode('MAHIPALPUR_JUNCTION', { latitude: 28.5450, longitude: 77.1260 }, 'Mahipalpur — Aerocity Junction');
  g.addNode('AEROCITY_CENTRAL', { latitude: 28.5510, longitude: 77.1200 }, 'Delhi Aerocity Hospitality Hub');
  g.addNode('IGI_AIRPORT_T1', { latitude: 28.5610, longitude: 77.1120 }, 'IGI Airport Terminal 1 Entrance');
  g.addNode('IGI_AIRPORT_T2_T3', { latitude: 28.5550, longitude: 77.0850 }, 'IGI Airport Terminal 3 / Terminal 2 Main Pier');
  g.addNode('DWARKA_UNDERPASS', { latitude: 28.5700, longitude: 77.0700 }, 'Dwarka Underpass / T3 Link');

  // Western Arterials (Patel Road / Ring Road West)
  g.addNode('PATEL_NAGAR', { latitude: 28.6500, longitude: 77.1700 }, 'Patel Road — West Patel Nagar');
  g.addNode('KIRTI_NAGAR', { latitude: 28.6550, longitude: 77.1500 }, 'Kirti Nagar Furniture Hub / Ring Rd');
  g.addNode('RAJA_GARDEN', { latitude: 28.6580, longitude: 77.1250 }, 'Ring Road — Raja Garden Crossing');
  g.addNode('PUNJABI_BAGH', { latitude: 28.6700, longitude: 77.1300 }, 'Ring Road — Punjabi Bagh Roundabout');

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Edges & Highways
  // ═══════════════════════════════════════════════════════════════════════════

  // Connaught Place Inner/Outer Ring
  g.addEdge({ id: 'e_cp_circ_1', fromNodeId: 'CP_OUTER_N', toNodeId: 'CP_OUTER_E', roadName: 'Connaught Circus', roadType: 'primary', oneWay: true });
  g.addEdge({ id: 'e_cp_circ_2', fromNodeId: 'CP_OUTER_E', toNodeId: 'CP_OUTER_S', roadName: 'Connaught Circus', roadType: 'primary', oneWay: true });
  g.addEdge({ id: 'e_cp_circ_3', fromNodeId: 'CP_OUTER_S', toNodeId: 'CP_OUTER_W', roadName: 'Connaught Circus', roadType: 'primary', oneWay: true });
  g.addEdge({ id: 'e_cp_circ_4', fromNodeId: 'CP_OUTER_W', toNodeId: 'CP_OUTER_N', roadName: 'Connaught Circus', roadType: 'primary', oneWay: true });
  g.addEdge({ id: 'e_cp_rad_1', fromNodeId: 'CP_INNER', toNodeId: 'CP_OUTER_S', roadName: 'Janpath Radial', roadType: 'secondary' });
  g.addEdge({ id: 'e_cp_rad_2', fromNodeId: 'CP_INNER', toNodeId: 'CP_OUTER_E', roadName: 'Barakhamba Radial', roadType: 'secondary' });
  g.addEdge({ id: 'e_cp_rad_3', fromNodeId: 'CP_INNER', toNodeId: 'CP_OUTER_W', roadName: 'Sansad Marg Radial', roadType: 'secondary' });

  // Janpath & Central Vista
  g.addEdge({ id: 'e_janpath_1', fromNodeId: 'CP_OUTER_S', toNodeId: 'JANPATH_TOLSTOY', roadName: 'Janpath', roadType: 'primary' });
  g.addEdge({ id: 'e_janpath_2', fromNodeId: 'JANPATH_TOLSTOY', toNodeId: 'JANPATH_RAJPATH', roadName: 'Janpath', roadType: 'primary' });
  g.addEdge({ id: 'e_janpath_3', fromNodeId: 'JANPATH_RAJPATH', toNodeId: 'MOTILAL_NEHRU_MARG', roadName: 'Janpath South', roadType: 'primary' });
  g.addEdge({ id: 'e_rajpath_1', fromNodeId: 'RASHTRAPATI_BHAVAN', toNodeId: 'JANPATH_RAJPATH', roadName: 'Kartavya Path', roadType: 'primary' });
  g.addEdge({ id: 'e_rajpath_2', fromNodeId: 'JANPATH_RAJPATH', toNodeId: 'INDIA_GATE_HEX', roadName: 'Kartavya Path', roadType: 'primary' });

  // Parliament / Secretariat
  g.addEdge({ id: 'e_parl_1', fromNodeId: 'CP_OUTER_W', toNodeId: 'PATEL_CHOWK', roadName: 'Sansad Marg', roadType: 'primary' });
  g.addEdge({ id: 'e_parl_2', fromNodeId: 'PATEL_CHOWK', toNodeId: 'PARLIAMENT_CIRCLE', roadName: 'Parliament Street', roadType: 'secondary' });
  g.addEdge({ id: 'e_parl_3', fromNodeId: 'PARLIAMENT_CIRCLE', toNodeId: 'RASHTRAPATI_BHAVAN', roadName: 'North Avenue', roadType: 'secondary' });

  // India Gate & Diplomatic Connections
  g.addEdge({ id: 'e_ig_shj', fromNodeId: 'INDIA_GATE_HEX', toNodeId: 'MAN_SINGH_ROAD', roadName: 'Shahjahan Road', roadType: 'primary' });
  g.addEdge({ id: 'e_man_singh', fromNodeId: 'MAN_SINGH_ROAD', toNodeId: 'PRITHVIRAJ_ROAD', roadName: 'Prithviraj Road', roadType: 'primary' });
  g.addEdge({ id: 'e_auro_north', fromNodeId: 'PRITHVIRAJ_ROAD', toNodeId: 'AIIMS_INTERCHANGE', roadName: 'Sri Aurobindo Marg', roadType: 'primary' });
  g.addEdge({ id: 'e_motilal', fromNodeId: 'MOTILAL_NEHRU_MARG', toNodeId: 'PRITHVIRAJ_ROAD', roadName: 'Aurobindo Marg', roadType: 'primary' });

  // Chanakyapuri & Sardar Patel Marg
  g.addEdge({ id: 'e_teen_murti', fromNodeId: 'RASHTRAPATI_BHAVAN', toNodeId: 'TEEN_MURTI', roadName: 'Teen Murti Marg', roadType: 'primary' });
  g.addEdge({ id: 'e_sp_marg_1', fromNodeId: 'TEEN_MURTI', toNodeId: 'SARDAR_PATEL_MARG', roadName: 'Mother Teresa Crescent', roadType: 'primary' });
  g.addEdge({ id: 'e_sp_marg_2', fromNodeId: 'SARDAR_PATEL_MARG', toNodeId: 'DHAULA_KUAN', roadName: 'Sardar Patel Marg', roadType: 'trunk' });
  g.addEdge({ id: 'e_shanti_path', fromNodeId: 'TEEN_MURTI', toNodeId: 'SHANTI_PATH_CENTRAL', roadName: 'Shanti Path', roadType: 'primary' });
  g.addEdge({ id: 'e_shanti_moti', fromNodeId: 'SHANTI_PATH_CENTRAL', toNodeId: 'MOTI_BAGH', roadName: 'Benito Juarez Marg', roadType: 'secondary' });

  // Ring Road (Mahatma Gandhi Marg) — Complete South Arc
  g.addEdge({ id: 'e_rr_dh_mb', fromNodeId: 'DHAULA_KUAN', toNodeId: 'MOTI_BAGH', roadName: 'Ring Road', roadType: 'trunk' });
  g.addEdge({ id: 'e_rr_mb_bc', fromNodeId: 'MOTI_BAGH', toNodeId: 'BHIKAJI_CAMA', roadName: 'Ring Road', roadType: 'trunk' });
  g.addEdge({ id: 'e_rr_bc_aiims', fromNodeId: 'BHIKAJI_CAMA', toNodeId: 'AIIMS_INTERCHANGE', roadName: 'Ring Road', roadType: 'trunk' });
  g.addEdge({ id: 'e_rr_aiims_se', fromNodeId: 'AIIMS_INTERCHANGE', toNodeId: 'SOUTH_EXT', roadName: 'Ring Road', roadType: 'trunk' });
  g.addEdge({ id: 'e_rr_se_mc', fromNodeId: 'SOUTH_EXT', toNodeId: 'MOOLCHAND', roadName: 'Ring Road', roadType: 'trunk' });
  g.addEdge({ id: 'e_rr_mc_ln', fromNodeId: 'MOOLCHAND', toNodeId: 'LAJPAT_NAGAR', roadName: 'Ring Road', roadType: 'trunk' });
  g.addEdge({ id: 'e_rr_ln_ash', fromNodeId: 'LAJPAT_NAGAR', toNodeId: 'ASHRAM_CHOWK', roadName: 'Ring Road', roadType: 'trunk' });
  g.addEdge({ id: 'e_rr_ash_skk', fromNodeId: 'ASHRAM_CHOWK', toNodeId: 'SARAI_KALE_KHAN', roadName: 'Ring Road', roadType: 'trunk' });

  // Mathura Road & Eastern Corridor
  g.addEdge({ id: 'e_mathura_1', fromNodeId: 'ASHRAM_CHOWK', toNodeId: 'NIZAMUDDIN_FLYOVER', roadName: 'Mathura Road', roadType: 'primary' });
  g.addEdge({ id: 'e_mathura_2', fromNodeId: 'NIZAMUDDIN_FLYOVER', toNodeId: 'SUNDAR_NAGAR', roadName: 'Mathura Road', roadType: 'primary' });
  g.addEdge({ id: 'e_mathura_3', fromNodeId: 'SUNDAR_NAGAR', toNodeId: 'PRAGATI_MAIDAN', roadName: 'Mathura Road', roadType: 'primary' });
  g.addEdge({ id: 'e_mathura_4', fromNodeId: 'PRAGATI_MAIDAN', toNodeId: 'TILAK_MARG_ITO', roadName: 'Mathura Road', roadType: 'primary' });
  g.addEdge({ id: 'e_bhairon', fromNodeId: 'INDIA_GATE_HEX', toNodeId: 'PRAGATI_MAIDAN', roadName: 'Purana Qila Road', roadType: 'secondary' });
  g.addEdge({ id: 'e_tilak_ig', fromNodeId: 'INDIA_GATE_HEX', toNodeId: 'TILAK_MARG_ITO', roadName: 'Tilak Marg', roadType: 'primary' });
  g.addEdge({ id: 'e_barakhamba_ito', fromNodeId: 'CP_OUTER_E', toNodeId: 'TILAK_MARG_ITO', roadName: 'Barakhamba Road / Sikandra Rd', roadType: 'primary' });

  // Ring Road — North towards Old Delhi
  g.addEdge({ id: 'e_rr_skk_rajghat', fromNodeId: 'SARAI_KALE_KHAN', toNodeId: 'RAJGHAT_CROSSING', roadName: 'Ring Road (Yamuna Bypass)', roadType: 'trunk' });
  g.addEdge({ id: 'e_rr_ito_rajghat', fromNodeId: 'TILAK_MARG_ITO', toNodeId: 'RAJGHAT_CROSSING', roadName: 'Bahadur Shah Zafar Marg', roadType: 'primary' });
  g.addEdge({ id: 'e_rr_rajghat_delgate', fromNodeId: 'RAJGHAT_CROSSING', toNodeId: 'DELHI_GATE', roadName: 'Jawaharlal Nehru Marg', roadType: 'primary' });
  g.addEdge({ id: 'e_rr_delgate_ndls', fromNodeId: 'DELHI_GATE', toNodeId: 'NEW_DELHI_STN_AJMERI', roadName: 'Asaf Ali Road', roadType: 'secondary' });
  g.addEdge({ id: 'e_ndls_cp', fromNodeId: 'NEW_DELHI_STN_AJMERI', toNodeId: 'CP_OUTER_N', roadName: 'Chelmsford Road', roadType: 'secondary' });
  g.addEdge({ id: 'e_rr_rajghat_redfort', fromNodeId: 'RAJGHAT_CROSSING', toNodeId: 'RED_FORT_JUNCTION', roadName: 'Netaji Subhash Marg', roadType: 'primary' });
  g.addEdge({ id: 'e_redfort_olddel', fromNodeId: 'RED_FORT_JUNCTION', toNodeId: 'OLD_DELHI_RAILWAY', roadName: 'Chandni Chowk Marg', roadType: 'secondary' });
  g.addEdge({ id: 'e_redfort_kg', fromNodeId: 'RED_FORT_JUNCTION', toNodeId: 'KASHMERE_GATE_ISBT', roadName: 'Ring Road', roadType: 'trunk' });

  // Sri Aurobindo Marg — South to Hauz Khas & Qutub Minar
  g.addEdge({ id: 'e_auro_1', fromNodeId: 'AIIMS_INTERCHANGE', toNodeId: 'GREEN_PARK', roadName: 'Sri Aurobindo Marg', roadType: 'primary' });
  g.addEdge({ id: 'e_auro_2', fromNodeId: 'GREEN_PARK', toNodeId: 'HAUZ_KHAS_JUNCTION', roadName: 'Sri Aurobindo Marg', roadType: 'primary' });
  g.addEdge({ id: 'e_auro_3', fromNodeId: 'HAUZ_KHAS_JUNCTION', toNodeId: 'ADCHINI', roadName: 'Sri Aurobindo Marg', roadType: 'primary' });
  g.addEdge({ id: 'e_auro_4', fromNodeId: 'ADCHINI', toNodeId: 'QUTUB_MINAR_JUNCTION', roadName: 'Sri Aurobindo Marg / Mehrauli Rd', roadType: 'primary' });

  // Outer Ring Road — Southern Arc
  g.addEdge({ id: 'e_orr_iit_hk', fromNodeId: 'IIT_DELHI_GATE', toNodeId: 'HAUZ_KHAS_JUNCTION', roadName: 'Outer Ring Road (Gamal Abdel Nasser Marg)', roadType: 'trunk' });
  g.addEdge({ id: 'e_orr_munirka_iit', fromNodeId: 'MUNIRKA_FLYOVER', toNodeId: 'IIT_DELHI_GATE', roadName: 'Outer Ring Road', roadType: 'trunk' });
  g.addEdge({ id: 'e_orr_vv_munirka', fromNodeId: 'VASANT_VIHAR', toNodeId: 'MUNIRKA_FLYOVER', roadName: 'Outer Ring Road', roadType: 'trunk' });
  g.addEdge({ id: 'e_orr_dk_vv', fromNodeId: 'DHAULA_KUAN', toNodeId: 'VASANT_VIHAR', roadName: 'Outer Ring Road (Benito Juarez Link)', roadType: 'trunk' });
  g.addEdge({ id: 'e_orr_hk_chirag', fromNodeId: 'HAUZ_KHAS_JUNCTION', toNodeId: 'CHIRAG_DELHI', roadName: 'Outer Ring Road', roadType: 'trunk' });
  g.addEdge({ id: 'e_orr_chirag_np', fromNodeId: 'CHIRAG_DELHI', toNodeId: 'NEHRU_PLACE', roadName: 'Outer Ring Road', roadType: 'trunk' });
  g.addEdge({ id: 'e_orr_np_okhla', fromNodeId: 'NEHRU_PLACE', toNodeId: 'OKHLA_NSIC', roadName: 'Outer Ring Road (Modi Mill Flyover)', roadType: 'trunk' });
  g.addEdge({ id: 'e_okhla_ashram', fromNodeId: 'OKHLA_NSIC', toNodeId: 'ASHRAM_CHOWK', roadName: 'Mathura Road (Okhla Link)', roadType: 'primary' });
  g.addEdge({ id: 'e_gk_chirag', fromNodeId: 'GREATER_KAILASH', toNodeId: 'CHIRAG_DELHI', roadName: 'BRT Corridor / GK Link', roadType: 'secondary' });
  g.addEdge({ id: 'e_moolchand_chirag', fromNodeId: 'MOOLCHAND', toNodeId: 'CHIRAG_DELHI', roadName: 'Josip Broz Tito Marg (BRT)', roadType: 'primary' });

  // Airport Highway Corridors (NH 48 / T3 Airport Express)
  g.addEdge({ id: 'e_nh48_1', fromNodeId: 'DHAULA_KUAN', toNodeId: 'DELHI_CANTT', roadName: 'NH 48 (Delhi-Gurgaon Expressway)', roadType: 'motorway', oneWay: false });
  g.addEdge({ id: 'e_nh48_2', fromNodeId: 'DELHI_CANTT', toNodeId: 'SUBROTO_PARK', roadName: 'NH 48 Expressway', roadType: 'motorway' });
  g.addEdge({ id: 'e_nh48_3', fromNodeId: 'SUBROTO_PARK', toNodeId: 'MAHIPALPUR_JUNCTION', roadName: 'NH 48 Expressway', roadType: 'motorway' });
  g.addEdge({ id: 'e_nh48_aerocity', fromNodeId: 'MAHIPALPUR_JUNCTION', toNodeId: 'AEROCITY_CENTRAL', roadName: 'Aerocity Northern Access Road', roadType: 'primary' });
  g.addEdge({ id: 'e_nh48_t1', fromNodeId: 'SUBROTO_PARK', toNodeId: 'IGI_AIRPORT_T1', roadName: 'Ullon Bator Marg (T1 Terminal Road)', roadType: 'primary' });
  g.addEdge({ id: 'e_aero_t3', fromNodeId: 'AEROCITY_CENTRAL', toNodeId: 'IGI_AIRPORT_T2_T3', roadName: 'IGI Central Spine Road', roadType: 'trunk' });
  g.addEdge({ id: 'e_t1_t3', fromNodeId: 'IGI_AIRPORT_T1', toNodeId: 'IGI_AIRPORT_T2_T3', roadName: 'Airport Internal Perimeter Road', roadType: 'secondary' });
  g.addEdge({ id: 'e_t3_dwarka', fromNodeId: 'IGI_AIRPORT_T2_T3', toNodeId: 'DWARKA_UNDERPASS', roadName: 'Urban Extension Road II', roadType: 'trunk' });

  // Western Delhi Link
  g.addEdge({ id: 'e_cp_patel', fromNodeId: 'CP_OUTER_W', toNodeId: 'PATEL_NAGAR', roadName: 'Pusa Road / Patel Road', roadType: 'primary' });
  g.addEdge({ id: 'e_patel_kirti', fromNodeId: 'PATEL_NAGAR', toNodeId: 'KIRTI_NAGAR', roadName: 'Patel Road', roadType: 'primary' });
  g.addEdge({ id: 'e_kirti_raja', fromNodeId: 'KIRTI_NAGAR', toNodeId: 'RAJA_GARDEN', roadName: 'Shivaji Marg', roadType: 'primary' });
  g.addEdge({ id: 'e_rr_dk_raja', fromNodeId: 'DHAULA_KUAN', toNodeId: 'RAJA_GARDEN', roadName: 'Ring Road (Naraina / Mayapuri)', roadType: 'trunk' });
  g.addEdge({ id: 'e_rr_raja_pb', fromNodeId: 'RAJA_GARDEN', toNodeId: 'PUNJABI_BAGH', roadName: 'Ring Road', roadType: 'trunk' });
  g.addEdge({ id: 'e_rr_pb_kg', fromNodeId: 'PUNJABI_BAGH', toNodeId: 'KASHMERE_GATE_ISBT', roadName: 'Ring Road (Azadpur / Model Town)', roadType: 'trunk' });

  return g;
}
