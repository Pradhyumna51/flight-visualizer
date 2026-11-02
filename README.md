# 3D KML Flight Path Animator Using CesiumJS

A modern, high-precision geospatial web application that imports KML flight paths and animates realistic 3D aircraft moving along actual geographical routes with accurate 3D elevations, attitude (heading, pitch, and bank roll), and live avionics telemetry.

Built with **React 19**, **TypeScript**, **Vite**, **CesiumJS**, and **Recharts**. Operates entirely in the browser without requiring Blender, desktop GIS software, or a backend server.

---

## Features

### 1. Accurate 3D Geospatial Visualization
- **True 3D Routes**: Renders flight paths at real elevations above the WGS84 ellipsoid or 3D terrain (never flattened onto the surface).
- **Altitude Indicators**: Dynamic vertical drop indicator lines connecting the aircraft to the ground below for intuitive height perception.
- **Flight Path Highlighting**: Distinguishes completed flight legs (bright glowing cyan) from remaining planned route (translucent dashed line).
- **Start / Destination & Waypoints**: Automatic airport departure (green) and arrival (red) beacons, plus waypoint altitude markers in meters and feet.
- **Vertical Exaggeration**: Real-time slider (1.0x to 5.0x) to accentuate flight climb and descent profiles over long distances and mountainous regions.

### 2. KML & GPS Track Parser
- **KML LineString**: Full support for `<LineString>` with `<coordinates>lon,lat,alt ...</coordinates>`.
- **KML gx:Track**: Full support for Google Earth GPS tracks with `<when>` timestamps and `<gx:coord>lon lat alt</gx:coord>`.
- **Multi-Route & Multi-Track**: Detects multiple tracks/legs in a single KML file and provides an instant route selector.
- **Strict Coordinate Convention**: Accurately extracts `longitude, latitude, altitude` without accidental latitude/longitude inversions.
- **Altitude Mode Handling**:
  - `absolute` (mean sea level)
  - `relativeToGround`
  - `clampToGround` (flags 0/missing altitudes)
- **Missing Altitude Safeguard**: Warns when routes lack elevation data and provides a 1-click **"Generate Realistic Flight Altitude (FL310)"** generator that constructs realistic climb, cruise, and descent phases.
- **GPS Timestamps vs Simulation Timeline**: Uses authentic recorded timestamps when available, or calculates a simulated timeline based on geodesic distance and configurable cruising airspeed.

### 3. Realistic 3D Aircraft Models & Dynamics
- **Bundled 3D GLB Models**:
  - Commercial Passenger Jet (`/Cesium_Air.glb`)
  - Multi-rotor Surveillance Drone (`/Cesium_Drone.glb`)
  - **Custom User GLB Upload**: Upload any `.glb` or `.gltf` 3D model directly from your hard drive.
  - **3D Primitive Fallback**: Procedural 3D composite aircraft (fuselage cylinder, swept wings, vertical tail fin) rendered via Cesium geometry if GLB models fail to load.
- **Aircraft Orientation Engine**:
  - **Heading**: Computed automatically from sequential coordinates / velocity vectors.
  - **Pitch**: Calculated dynamically from climb and descent gradients (`atan2(dAlt, dDist)`).
  - **Coordinated Banking Roll**: Calculates realistic aircraft banking in turns proportional to yaw rate (`tan(bank) = V * omega / g`) smoothed within standard flight limits (±35°).
  - **Adjustable Model Offsets**: Adjust heading, pitch, and roll offsets (-180° to +180°) plus scale to support GLB models with varying forward axis conventions.

### 4. Interactive Avionics Dashboard & Controls
- **6 Camera Modes**:
  1. `FOLLOW`: Chase camera positioned behind and slightly above the aircraft.
  2. `SIDE VIEW`: Perpendicular side chase view highlighting climb and descent angles.
  3. `TOP-DOWN`: Orthogonal nadir view directly above the aircraft.
  4. `OVERVIEW`: Automatically zooms and frames the entire route bounding sphere.
  5. `FREE`: Unlocked camera allowing free globe orbit, zoom, and tilt.
  6. `COCKPIT`: Forward pilot view from the nose of the plane.
- **Interactive Altitude Profile Chart**:
  - Area chart plotting elevation (meters and feet) against distance (km and NM).
  - Real-time aircraft position indicator bug that tracks playback.
  - Click or scrub anywhere on the chart to seek the flight to that exact position.
- **Playback Controls**:
  - Play, Pause, Resume, Restart, Loop toggle.
  - Smooth timeline scrubber slider with instantaneous aircraft update when paused or playing.
  - Speeds: `0.25x`, `0.5x`, `1x`, `2x`, `5x`, `10x`, `20x`.
- **Keyboard Shortcuts**:
  - `[Space]`: Toggle Play / Pause
  - `[←] / [→]`: Seek backward / forward 5 seconds
  - `[R] / [Home]`: Restart flight
  - `[C]`: Cycle camera modes

---

## Getting Started

### Prerequisites
- Node.js 18+ (tested on Node v20 / v22 / v24)
- npm 9+

### Installation

```bash
# Clone or navigate to the repository
cd "Flight Path Visualizer"

# Install dependencies (Cesium assets are automatically synced via postinstall)
npm install
```

### Running Locally

```bash
# Start the Vite development server
npm run dev
```

Open your browser at the displayed local URL (typically `http://localhost:5173/`).

### Production Build

```bash
# Run TypeScript compilation and build production assets
npm run build

# Preview the production build locally
npm run preview
```

### Running Automated Tests

```bash
# Run Vitest test suite
npm test
```

---

## Configuring Cesium ion Token

The application includes built-in fallback globe terrain and OpenStreetMap imagery, so it runs **out of the box without requiring any API token**.

To enable high-resolution **Cesium World Terrain (3D elevation)** and Bing/Sentinel satellite imagery:

1. Create a free account at [cesium.com/ion](https://cesium.com/ion/).
2. Copy your default access token.
3. Configure the token using either method:
   - **Option A (Environment Variable)**: Create a `.env.local` file in the project root:
     ```env
     VITE_CESIUM_ION_TOKEN=your_token_here
     ```
   - **Option B (In-App Settings)**: Click the **Settings** tab in the top-right corner of the web interface and paste your token into the **Cesium ion Token** input field.

---

## How to Import Flight Paths

1. **Drag-and-Drop**: Drag any `.kml` or `.xml` flight path file onto the dropzone in the left sidebar.
2. **File Picker**: Click the dropzone to select a `.kml` file from your computer.
3. **Built-in Sample Scenarios**: Click any of the 5 pre-loaded scenarios for instant demonstration:
   - `SFO → LAS Scenic`: Commercial flight with distinct climb to 34,000ft, cruise, and descent over the Sierra Nevada.
   - `LHR → CDG Shuttle`: GPS track featuring `<gx:Track>` and original recorded ISO timestamps.
   - `JFK → LHR Transatlantic`: Long-distance great-circle flight crossing the North Atlantic ocean.
   - `HND → ITM (Ground Track)`: Flat route without altitude data (`clampToGround`) to test simulated altitude generation.
   - `SFO ⇄ LAX Roundtrip`: Multi-leg KML demonstrating multi-route selection.

---

## Supported KML Formats

| Format | Tag | Description |
|---|---|---|
| KML LineString | `<LineString><coordinates>` | Comma-separated tuples: `lon,lat,alt lon,lat,alt ...` |
| KML gx:Track | `<gx:Track><when>` / `<gx:coord>` | Space-separated tuples: `lon lat alt` with ISO timestamps |
| MultiTrack / MultiGeometry | `<MultiGeometry>` / `<gx:MultiTrack>` | Multiple placemarks or paths in a single document |

### Altitude Modes Supported
- `absolute`: Altitude relative to mean sea level (MSL) in meters.
- `relativeToGround`: Altitude relative to ground elevation.
- `clampToGround`: Coordinate is clamped to the surface (triggers the simulated flight altitude option).

---

## Project Structure

```
Flight Path Visualizer/
├── public/
│   ├── cesium/                 # Synchronized Cesium static assets (Widgets, Assets, Workers)
│   ├── samples/                # Sample test KML files (altitude, timestamps, long haul, flat, multi-leg)
│   ├── Cesium_Air.glb          # Default 3D airliner aircraft model
│   └── Cesium_Drone.glb        # Default 3D surveillance drone model
├── scripts/
│   └── copy-cesium.mjs         # Cross-platform asset sync script
├── src/
│   ├── types/
│   │   └── flight.ts           # TypeScript interfaces: FlightRoute, Telemetry, CameraMode, Settings
│   ├── services/
│   │   ├── geoUtils.ts         # Haversine, true bearing, pitch, bank roll, and unit conversions
│   │   ├── kmlParser.ts        # Robust parser for LineString, gx:Track, altitude modes, simulated altitude
│   │   ├── flightAnimator.ts   # Cesium SampledPositionProperty, Quaternion orientation, telemetry
│   │   └── __tests__/
│   │       └── flight.test.ts  # Automated test suite covering all acceptance criteria
│   ├── components/
│   │   ├── GlobeViewer.tsx     # Cesium 3D Earth, scene lifecycle, clock synchronization
│   │   ├── AircraftEntity.tsx  # 3D GLB model management, orientation offsets, 3D primitive fallback
│   │   ├── FlightPathRenderer.tsx # 3D polyline with lead/trail split, departure/arrival beacons
│   │   ├── CameraController.tsx# Follow, Free, Overview, Top-Down, Side, and Cockpit camera modes
│   │   ├── FlightControls.tsx  # Play, pause, timeline slider, speed pills (0.25x-20x)
│   │   ├── TelemetryPanel.tsx  # Aviation HUD: altitude MSL/AGL, speed, VSI, compass, attitude
│   │   ├── AltitudeChart.tsx   # Interactive altitude vs distance profile chart with seeking
│   │   ├── KMLUploader.tsx     # Drag-and-drop dropzone, sample picker, missing altitude alert
│   │   ├── SettingsPanel.tsx   # Ion token, vertical exaggeration, model offsets, interpolation
│   │   └── SpeedConfigModal.tsx# Simulated airspeed and cruise altitude configurator
│   ├── data/
│   │   └── sampleFlights.ts    # Test flight metadata registry
│   ├── App.tsx                 # Main application coordinator and responsive layout
│   ├── App.css                 # Aviation cockpit HUD dark-mode styling
│   └── main.tsx                # Entrypoint & Cesium asset base URL configuration
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## Known Limitations

- **Browser WebGL Memory**: Very large KML files containing more than 50,000 coordinate waypoints should be simplified before loading to maintain smooth 60 FPS rendering on laptops with integrated GPUs.
- **External 3D Models**: User-uploaded `.glb` models should have reasonable polycounts (<10MB) for optimal mobile and laptop performance. Different models use different origin axes; use the **Model Axis Offsets** sliders in Settings to align the forward axis if needed.
