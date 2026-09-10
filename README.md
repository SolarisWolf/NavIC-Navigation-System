# NavIC-Enabled Smart Offline Navigation System

An offline-first navigation system with multi-GNSS support including NavIC/IRNSS constellation detection, Extended Kalman Filter sensor fusion, and fully offline routing with turn-by-turn navigation.

## 🎯 Project Goal

Build a navigation application that works **completely without internet connectivity** after initial setup, using:

- **Multi-GNSS positioning** (GPS, NavIC/IRNSS, Galileo, BeiDou, GLONASS)
- **IMU sensor fusion** via Extended Kalman Filter for enhanced accuracy
- **Dead reckoning** during temporary satellite loss
- **Offline maps** using OpenStreetMap + MBTiles
- **Offline routing** using GraphHopper
- **Turn-by-turn navigation** with voice instructions

## 🏗️ Architecture

```text
GNSS Provider ──► Position Engine ──► EKF ◄── IMU Provider
                                       │
                                       ▼
                              Fused Position Estimate
                                       │
                                       ▼
                                  Map Matching
                                       │
                                       ▼
                                Offline Routing
                                       │
                                       ▼
                              Navigation Engine
                                       │
                            ┌──────────┴──────────┐
                            ▼                     ▼
                       Map Display           Instructions
                                                  │
                                                  ▼
                                             Voice Output
```

## 📦 Project Structure

```text
navic-navigation/
├── apps/
│   ├── web/            → Vite web application (Stage A)
│   └── android/        → Kotlin/Compose Android app (Stage B)
├── packages/
│   ├── shared-models/  → Common types, interfaces, enums, utils
│   ├── gnss-core/      → GNSS simulator & position engine
│   ├── sensor-fusion/  → IMU simulator, EKF, dead reckoning
│   ├── routing-core/   → Offline graph routing (GraphHopper)
│   ├── navigation-core/→ Route following, maneuvers, re-routing
│   └── map-core/       → MBTiles reader, map renderer, POI database
├── data/
│   ├── maps/           → MBTiles files
│   ├── poi/            → POI database
│   ├── elevation/      → DEM data
│   └── simulation/     → Simulation routes & scenarios
├── docs/
└── tests/
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd navic-navigation

# Install dependencies
npm install

# Run tests
npm test

# Start the web application (Phase 1+)
npm run dev --workspace=@navic/web
```

## 📋 Development Phases

| Phase | Name | Status |
|-------|------|--------|
| **0** | Project Architecture & Repository Setup | ✅ Complete |
| 1 | Web Application Foundation | ⏳ Pending |
| 2 | GNSS/NavIC Simulator | ⏳ Pending |
| 3 | GNSS Position Engine | ⏳ Pending |
| 4 | IMU Simulator | ⏳ Pending |
| 5 | Extended Kalman Filter / Sensor Fusion | ⏳ Pending |
| 6 | Offline Map System | ⏳ Pending |
| 7 | Offline POI Database | ⏳ Pending |
| 8 | Offline Routing Engine | ⏳ Pending |
| 9 | Navigation Engine | ⏳ Pending |
| 10 | Re-routing | ⏳ Pending |
| 11 | Voice Navigation | ⏳ Pending |
| 12 | Complete Web Simulation | ⏳ Pending |
| 13 | Offline Stress Testing | ⏳ Pending |
| 14 | Android Application | ⏳ Pending |
| 15 | Replace Simulators With Real Hardware | ⏳ Pending |
| 16 | Real NavIC Detection | ⏳ Pending |
| 17 | Real Sensor Fusion | ⏳ Pending |
| 18 | Final Offline Android Navigation | ⏳ Pending |
| 19 | Performance & Reliability Testing | ⏳ Pending |
| 20 | Final Validation & Demonstration | ⏳ Pending |

## ⚠️ Important Notes

- **SIMULATION MODE**: All simulated GNSS/IMU data is clearly labeled. Never present simulated data as real hardware measurements.
- **Offline-first**: The system is designed to work without internet after initial setup.
- **Modular interfaces**: GNSS and IMU providers use abstract interfaces so simulators can be replaced with Android hardware providers.

## 📄 License

MIT
