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
| 1 | Web Application Foundation | ✅ Complete |
| 2 | GNSS/NavIC Simulator | ✅ Complete |
| 3 | Local Base Map Integration | ✅ Complete |
| 4 | IMU Simulator | ✅ Complete |
| 5 | Extended Kalman Filter / Sensor Fusion | ✅ Complete |
| 6 | GNSS Position Engine | ✅ Complete |
| 7 | Offline POI Database | ✅ Complete |
| 8 | Offline Routing Engine | ✅ Complete |
| 9 | Navigation Engine | ✅ Complete |
| 10 | Re-routing | ✅ Complete |
| 11 | Voice Navigation | ✅ Complete |
| 12 | Complete Web Simulation | ✅ Complete |
| 13 | Offline Stress Testing | ✅ Complete |
| 14 | Android Application | ✅ Complete |
| 15 | Replace Simulators With Real Hardware | ✅ Complete |
| 16 | Real NavIC Detection | ✅ Complete |
| 17 | Battery & Background Optimization | ✅ Complete |
| 18 | Final Offline Android Navigation | ✅ Complete |
| 19 | Performance & Reliability Testing | ✅ Complete |
| 20 | Final Validation & Demonstration | ✅ Complete |

### Completed Milestones
- **Phase 0**: Monorepo architecture (`shared-models`, `gnss-core`, `sensor-fusion`, `map-core`, `routing-core`, `navigation-core`), logging, error-handling, Vitest testing.
- **Phase 1**: Responsive SPA shell with modular screens (Dashboard, Map, Satellites, Sensors, Route, Settings).
- **Phase 2**: Multi-constellation GNSS simulator (NavIC L5/S, GPS, Galileo, BeiDou, GLONASS) with route simulation and SNR/geometry modeling.
- **Phase 3**: Offline MBTiles tile server and Leaflet map rendering with vehicle tracking.
- **Phase 4**: 50 Hz IMU Simulator (accelerometer, gyroscope, magnetometer) with real-time 3D attitude visualization.
- **Phase 5**: 7-state Extended Kalman Filter (EKF) sensor fusion running at 50 Hz with continuous Dead Reckoning during GNSS outages (< 0.1 ms latency).
- **Phase 6**: GNSS Position Engine with line-of-sight satellite geometry Dilution of Precision (HDOP, VDOP, PDOP, GDOP), kinematic outlier rejection, exponential coordinate smoothing, stationary bearing lock, and NavIC-assisted fix identification.
- **Phase 7**: Offline POI Database with 49 Delhi amenities across 10 categories, sub-0.1ms fuzzy & spatial search, category chips, live distance & bearing calculation, Route Planning destination lock, and interactive Leaflet map overlays with dark popups.
- **Phase 8**: Offline Routing Engine with 58-node/146-edge Delhi NCR topological road graph, sub-millisecond A* pathfinding (Car, Bicycle, Walking profiles; Fastest vs Shortest optimization), angular turn-by-turn maneuver classification, Route Planning step list, and dynamic high-contrast map polyline with floating navigation banner.
- **Phase 9**: Navigation Engine with high-performance planar map matching, route progress tracking (dynamic ETA, remaining distance, 25m arrival detection), turn-by-turn guidance engine with distance countdowns and proximity alerts, 3-sample debounced off-route detector, top Active Guidance HUD, and bottom Trip Statistics Bar.
- **Phase 10**: Re-routing Engine with `ReroutingManager`, anti-thrashing cooldown throttling (3,000 ms), concurrent execution guards, instantaneous offline A* recalculation, atomic route hot-swapping in `NavigationEngine` with progress resets, dynamic `#map-nav-reroute` banner animation, and manual re-route trigger controls.
- **Phase 11**: Voice Navigation with `VoicePromptGenerator`, multi-stage distance countdown triggering (300m Advance, 100m Approach, 30m Immediate), anti-repetition deduplication, offline procedural Web Audio API chimes (dual-tone harmonic turn, off-route alert, arrival chord), Web Speech API SpeechSynthesis with Indian English voice preference, Top HUD animated waveform badge, map `#btn-voice-toggle` one-tap mute control, and interactive Settings panel (switches, sliders, voice selector, test prompt).
- **Phase 12**: Complete Web Simulation Hub with 5 realistic Delhi NCR driving scenarios (Connaught Place to India Gate, Pragati Maidan Tunnel, Nehru Place Urban Canyon, NH-44 Highway Cruise, Off-Route Recalculation), continuous timeline seeking (0%–100% scrubber), playback speed scaling (0.5×–10×), multi-constellation mode toggling (All, NavIC-only, GPS-only), and hardware fault injections (15s Tunnel Outage with Dead Reckoning, Urban Canyon multipath degradation, 10s lateral Off-Route divergence).
- **Phase 13**: Offline Stress Testing & Diagnostics Suite with 10k continuous 50 Hz EKF cycles (0.024ms latency, >42,000 ops/s), 60-second Dead Reckoning blackout stability test, 500 A* path calculations (0.75ms avg time, 100% success rate), 2k POI spatial searches (0.163ms avg search), standalone offline Service Worker (`sw.js`) caching application shell and MBTiles tiles, Status Bar offline indicator chip, and interactive in-browser Diagnostics screen (`#/diagnostics`) with 1-click stress suite runner, live progress, metric telemetry, and JSON certificate exporter.
- **Phase 14**: Android Application Foundation with native Gradle project in `apps/android` (`compileSdk = 34`, `minSdk = 26`, OpenJDK 21), hardware permissions (`ACCESS_FINE_LOCATION`, `HIGH_SAMPLING_RATE_SENSORS`, `FOREGROUND_SERVICE`, `WAKE_LOCK`), `NavICNativeBridge.kt` with `@JavascriptInterface`, `MainActivity.kt` with `WebViewAssetLoader`, persistent `NavigationForegroundService.kt`, offline asset packaging tool `tools/copy-android-assets.js`, and successful 6.0 MB debug APK compilation (`app-debug.apk`).
- **Phase 15**: Replace Simulators With Real Hardware featuring native Android GNSS tracking (`AndroidLocationProvider.kt` via `LocationManager` & `GnssStatus.Callback` capturing raw constellation telemetry and NavIC support), native 50 Hz IMU sensor streaming (`AndroidSensorProvider.kt` via `SensorManager` registering accelerometer, gyroscope, and magnetometer at 20ms intervals), bidirectional native bridge integration (`NavICNativeBridge.kt`), W3C Geolocation hardware provider (`BrowserGeolocationProvider.ts` in `@navic/gnss-core` enabling real laptop/device location testing), USB Serial NMEA 0183 offline decoder (`SerialNMEAProvider.ts`), dynamic Hardware Source Selector in Status Bar (`🧪 [SIMULATION MODE]` vs `🛰️ [LIVE HARDWARE: LAPTOP]` vs `📱 [LIVE HARDWARE: ANDROID]` vs `🔌 [LIVE HARDWARE: USB NMEA]`), Simulation Hub data source toggling, and Settings hardware configuration panel with live telemetry feeds.
- **Phase 16**: Real NavIC Detection featuring `NavICDetector` in `@navic/gnss-core`, PRN-to-ISRO-spacecraft mapping (IRNSS-1A through 1I, NVS-01), GEO orbital slot identification (83.0°E, 32.5°E, 129.5°E) and GSO inclined orbit mapping (55.0°E, 111.75°E), multi-frequency carrier classification (L5 @ 1176.45 MHz, S-band @ 2492.028 MHz, L1 @ 1575.42 MHz), standalone vs hybrid multi-GNSS fix evaluation, signal integrity scoring (0–100%), Android `GnssStatus.getCarrierFrequencyHz()` (API 26+) and `GnssMeasurementsEvent.Callback` (API 24+) raw pseudorange hooks, `getNavICConstellationReport()` JavascriptInterface bridge, dedicated NavIC Constellation Telemetry & Signal Quality card on `#/satellites`, NavIC Regional System card on `#/dashboard`, and Status Bar NavIC indicator with 1-tap quick navigation.
- **Phase 17**: Battery & Background Optimization featuring `PowerOptimizer` in `@navic/sensor-fusion`, multi-tier power profiles (`NORMAL`, `POWER_SAVER`, `CRITICAL`), vehicle dynamics classification (8s debounced stationary detection vs in-motion vs highway cruise), adaptive IMU throttling (50 Hz down to 10 Hz when stopped), map rendering FPS limits (60 FPS down to 15 FPS), Screen WakeLock management (Web Screen Wake Lock API & native Android `FLAG_KEEP_SCREEN_ON`), native Android `AndroidBatteryMonitor.kt` (`ACTION_BATTERY_CHANGED` broadcast receiver monitoring level, charging state, temperature, voltage, and health), Android `NavigationForegroundService` ongoing notification updates with "Stop Navigation" action, battery runtime estimation, global `.power-saver-active` CSS optimizations, Status Bar battery indicator badge with charging bolt and power saver leaf, and interactive Settings control panel.
- **Phase 18**: Final Offline Android Navigation featuring RFC 5870 Geo URI parsing (`geo:` and `google.navigation:` intent schemes), persistent offline trip state recovery across reboots and process recreation (`localStorage` + native bridge), native Android audio focus ducking (`AndroidAudioManager.kt` with `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`), sticky immersive driving mode (`WindowInsetsControllerCompat` hiding navigation/status bars), Android `OnBackPressedCallback` driving safety modal, expandable `BigTextStyle` foreground navigation notifications with live distance/turn updates and "Exit Navigation" action, dynamic Map Trip Recovery banner with one-tap restore, and Settings Android Platform Features control panel with Geo URI test simulator.
- **Phase 19**: Performance & Reliability Testing featuring comprehensive automated Vitest benchmark suites (15,000-cycle 50 Hz EKF stability, 1,000-route scaled A* pathfinding distribution with p50/p95/p99 SLA validation, 100-km marathon navigation drive, anti-thrashing cooldown concurrency protection, 1,000 trip state fuzzing cycles, 10,000 Geo URI parsing stress, and 1:1 audio focus parity), browser-based `ReliabilityBenchmarkService` profiling live system throughput, upgraded tabbed Diagnostics & Reliability Workstation (`#/diagnostics`) with Production SLA Compliance Matrix, percentile breakdown cards, fault-tolerance resilience monitor, subsystem readiness audit, and one-click JSON and Markdown Audit Certificate exporter.
- **Phase 20**: Final Validation & Demonstration featuring 100% end-to-end multi-constellation test suite (`end-to-end-validation.test.ts`), Grand Showcase & Release Demonstration Screen (`#/showcase`) with 8-stage interactive guided tour (`ShowcaseService`) simulating a complete journey through Connaught Place, Pragati Maidan tunnel blackout, dead reckoning continuity, and destination arrival, 20-phase capabilities matrix with feature deep-linking, Monorepo Architecture & Hardware Data Flow topology, and verified production Android debug APK (`app-debug.apk`, 6.17 MB).
## ⚠️ Important Notes

- **SIMULATION MODE**: All simulated GNSS/IMU data is clearly labeled. Never present simulated data as real hardware measurements.
- **Offline-first**: The system is designed to work without internet after initial setup.
- **Modular interfaces**: GNSS and IMU providers use abstract interfaces so simulators can be replaced with Android hardware providers.

## 📄 License

MIT
