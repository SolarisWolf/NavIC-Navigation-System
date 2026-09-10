# System Architecture

## Overview

The NavIC-Enabled Smart Offline Navigation System is designed as a modular, offline-first navigation platform. The architecture separates concerns into six core packages that can be developed, tested, and deployed independently.

## High-Level Data Flow

```text
┌──────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                              │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │    GNSS     │    │     IMU     │    │    Offline Maps     │  │
│  │  Provider   │    │  Provider   │    │   (MBTiles/POI)     │  │
│  └──────┬──────┘    └──────┬──────┘    └──────────┬──────────┘  │
│         │                  │                      │              │
└─────────┼──────────────────┼──────────────────────┼──────────────┘
          │                  │                      │
          ▼                  ▼                      │
┌──────────────────────────────────┐                │
│     POSITION ESTIMATION          │                │
│                                  │                │
│  ┌──────────┐   ┌─────────────┐  │                │
│  │ Position │   │    EKF /    │  │                │
│  │  Engine  │──►│   Sensor    │  │                │
│  │ (GNSS)   │   │   Fusion    │  │                │
│  └──────────┘   └──────┬──────┘  │                │
│                        │         │                │
└────────────────────────┼─────────┘                │
                         │                          │
                         ▼                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                    NAVIGATION ENGINE                             │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────────┐  │
│  │   Map    │   │ Offline  │   │  Route   │   │    Voice    │  │
│  │ Matching │──►│ Routing  │──►│ Progress │──►│ Navigation  │  │
│  └──────────┘   └──────────┘   └──────────┘   └─────────────┘  │
│                                                                  │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                              │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────────┐  │
│  │   Map    │   │  GNSS    │   │  Route   │   │  Dashboard  │  │
│  │  Screen  │   │  Status  │   │  Screen  │   │   Screen    │  │
│  └──────────┘   └──────────┘   └──────────┘   └─────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Package Dependency Graph

```text
shared-models (no dependencies)
       │
       ├─── gnss-core
       │        │
       ├─── sensor-fusion (depends on gnss-core)
       │
       ├─── routing-core
       │
       ├─── map-core
       │
       └─── navigation-core (depends on sensor-fusion, routing-core)
                │
                ▼
            apps/web (depends on all packages)
```

## Provider Pattern

The system uses an abstraction layer so that simulated data sources can be replaced with real hardware:

```text
                    ┌─────────────────┐
                    │    Interface    │
                    │  (GNSSProvider) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              │              ▼
     ┌────────────────┐      │     ┌────────────────┐
     │   Simulator    │      │     │    Android     │
     │   (Phase 2)    │      │     │   Hardware     │
     │                │      │     │   (Phase 15)   │
     └────────────────┘      │     └────────────────┘
                             │
                    Same interface,
                    different data source
```

## Key Design Decisions

1. **TypeScript monorepo with npm workspaces** — Type safety for complex math, zero extra tooling.
2. **Abstract provider interfaces** — Enables simulator → hardware swap without changing downstream code.
3. **Offline-first** — All processing happens on-device; no cloud APIs in the critical path.
4. **EKF for sensor fusion** — As specified in the project requirements, combining GNSS + IMU with ~20ms target latency.
5. **MBTiles for offline maps** — Standard format for tile storage, works with OpenStreetMap data.
6. **GraphHopper for routing** — As specified, offline path calculation and map matching.

## Performance Targets

| Metric | Target |
|--------|--------|
| EKF processing latency | ~20 ms |
| Map rendering | ≥30 FPS |
| Route computation | ~1.5–2 seconds |
| Offline operation | 100% after setup |
