import { useState, useEffect, useCallback } from 'react';
import {
  Plane,
  Settings as SettingsIcon,
  HelpCircle,
  Minimize2,
  Maximize2,
  X,
  Compass,
} from 'lucide-react';
import type {
  FlightRoute,
  FlightTelemetry,
  CameraMode,
  ModelSettings,
  VisualizationSettings,
} from './types/flight';
import { GlobeViewer } from './components/GlobeViewer';
import { KMLUploader } from './components/KMLUploader';
import { TelemetryPanel } from './components/TelemetryPanel';
import { AltitudeChart } from './components/AltitudeChart';
import { FlightControls } from './components/FlightControls';
import { SettingsPanel } from './components/SettingsPanel';
import { SpeedConfigModal } from './components/SpeedConfigModal';
import { parseKML, applySimulatedAltitude } from './services/kmlParser';

export function App() {
  // Flight Route State
  const [currentRoute, setCurrentRoute] = useState<FlightRoute | null>(null);
  const [availableRoutes, setAvailableRoutes] = useState<FlightRoute[]>([]);
  const [telemetry, setTelemetry] = useState<FlightTelemetry | null>(null);

  // Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [seekTimeSeconds, setSeekTimeSeconds] = useState<number | null>(null);

  // Camera State
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow');
  const [cameraDistance, setCameraDistance] = useState<number>(850);
  const [cameraPitchDeg, setCameraPitchDeg] = useState<number>(-20);

  // Model & Visual Settings
  const [modelSettings, setModelSettings] = useState<ModelSettings>({
    modelType: 'cesiumAir',
    scale: 1.0,
    headingOffsetDeg: 0,
    pitchOffsetDeg: 0,
    rollOffsetDeg: 0,
  });

  const [visSettings, setVisSettings] = useState<VisualizationSettings>({
    verticalExaggeration: 1.5,
    pathLeadColor: '#00f0ff',
    pathTrailColor: '#38bdf8',
    showDropLine: true,
    showWaypoints: true,
    showLabels: true,
    showTerrain: true,
    simulationCruiseAltitudeMeters: 9500,
    simulationSpeedKnots: 450,
    cesiumIonToken: import.meta.env.VITE_CESIUM_ION_TOKEN || '',
    interpolationAlgorithm: 'hermite',
  });

  // UI Panels State
  const [activeTab, setActiveTab] = useState<'upload' | 'settings'>('upload');
  const [leftSidebarOpen, setLeftSidebarOpen] = useState<boolean>(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState<boolean>(true);
  const [isSpeedModalOpen, setIsSpeedModalOpen] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ msg: string; type: 'info' | 'warn' | 'error' } | null>(null);

  // Helper to show transient notifications
  const notify = useCallback((msg: string, type: 'info' | 'warn' | 'error' = 'info') => {
    setNotification({ msg, type });
  }, []);

  // Auto-load default scenic flight on initial startup
  useEffect(() => {
    fetch('/samples/flight-with-altitude.kml')
      .then((res) => res.text())
      .then((kmlText) => {
        const routes = parseKML(kmlText);
        if (routes.length > 0) {
          setCurrentRoute(routes[0]);
          setAvailableRoutes(routes);
        }
      })
      .catch((err) => {
        console.warn('Initial sample flight load warning:', err);
      });
  }, []);

  // Handle Route Loaded
  const handleRouteLoaded = (route: FlightRoute, allRoutes?: FlightRoute[]) => {
    setCurrentRoute(route);
    if (allRoutes) {
      setAvailableRoutes(allRoutes);
    }
    setCurrentTimeSeconds(0);
    setSeekTimeSeconds(0);
    setIsPlaying(false);

    if (!route.hasRealAltitude) {
      notify(
        'KML route does not include vertical altitude data. You can generate simulated flight altitude using the button on the left.',
        'warn'
      );
    } else {
      notify(`Flight route "${route.name}" loaded successfully with 3D elevation.`, 'info');
    }
  };

  // Playback Actions
  const handleTogglePlay = () => {
    if (!currentRoute) return;
    // If finished, restart when clicking play
    if (currentTimeSeconds >= currentRoute.totalDurationSeconds) {
      setSeekTimeSeconds(0);
      setCurrentTimeSeconds(0);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((prev) => !prev);
  };

  const handleRestart = () => {
    setSeekTimeSeconds(0);
    setCurrentTimeSeconds(0);
    setIsPlaying(true);
  };

  const handleSeek = (seconds: number) => {
    setCurrentTimeSeconds(seconds);
    setSeekTimeSeconds(seconds);
  };

  const handleSeekFraction = (fraction: number) => {
    if (!currentRoute) return;
    const targetSeconds = fraction * currentRoute.totalDurationSeconds;
    handleSeek(targetSeconds);
  };

  const handleTimeUpdate = useCallback((elapsed: number, telem: FlightTelemetry) => {
    setCurrentTimeSeconds(elapsed);
    setTelemetry(telem);
    setSeekTimeSeconds(null);
  }, []);

  const handlePlaybackComplete = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Update Simulation Parameters (Speed & Cruise Altitude)
  const handleApplySimParams = (speedKnots: number, cruiseAltMeters: number) => {
    setVisSettings((prev) => ({
      ...prev,
      simulationSpeedKnots: speedKnots,
      simulationCruiseAltitudeMeters: cruiseAltMeters,
    }));

    if (currentRoute) {
      if (currentRoute.isSimulatedAltitude || !currentRoute.hasRealAltitude) {
        const updated = applySimulatedAltitude(currentRoute, cruiseAltMeters);
        setCurrentRoute(updated);
      }
      notify(`Simulated airspeed set to ${speedKnots} kts, cruising altitude ${Math.round(cruiseAltMeters)} m.`, 'info');
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (currentRoute) {
          handleSeek(Math.max(0, currentTimeSeconds - 5));
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (currentRoute) {
          handleSeek(Math.min(currentRoute.totalDurationSeconds, currentTimeSeconds + 5));
        }
      } else if (e.code === 'KeyR' || e.code === 'Home') {
        e.preventDefault();
        handleRestart();
      } else if (e.code === 'KeyC') {
        // Cycle camera mode
        const modes: CameraMode[] = ['follow', 'side', 'topDown', 'overview', 'free'];
        const nextIdx = (modes.indexOf(cameraMode) + 1) % modes.length;
        setCameraMode(modes[nextIdx]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentRoute, currentTimeSeconds, cameraMode, isPlaying]);

  return (
    <div className="flight-app-root">
      {/* Top Avionics Navigation Header */}
      <header className="app-topbar">
        <div className="topbar-left">
          <div className="app-brand">
            <Plane className="brand-icon" size={20} />
            <div className="brand-text">
              <span className="brand-title">3D KML FLIGHT PATH ANIMATOR</span>
              <span className="brand-sub">CESIUMJS GEOSPATIAL AVIONICS</span>
            </div>
          </div>
          {currentRoute && (
            <div className="topbar-flight-tag">
              <span className="route-indicator"></span>
              <span className="route-name">{currentRoute.name}</span>
            </div>
          )}
        </div>

        <div className="topbar-right">
          <div className="camera-badge-pill">
            <Compass size={13} />
            <span>CAM: <strong>{cameraMode.toUpperCase()}</strong></span>
          </div>

          <button
            className={`topbar-btn ${activeTab === 'upload' && leftSidebarOpen ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('upload');
              setLeftSidebarOpen(true);
            }}
            title="Import KML Flight"
          >
            Flight Path
          </button>

          <button
            className={`topbar-btn ${activeTab === 'settings' && leftSidebarOpen ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('settings');
              setLeftSidebarOpen(true);
            }}
            title="3D Globe & Model Settings"
          >
            <SettingsIcon size={14} />
            <span>Settings</span>
          </button>

          <button
            className="topbar-btn icon-only"
            onClick={() => {
              notify(
                'Shortcuts: [Space] Play/Pause | [Left/Right] Scrub ±5s | [R/Home] Restart | [C] Cycle Camera Mode',
                'info'
              );
            }}
            title="Keyboard Shortcuts & Guidance"
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </header>

      {/* Main Operational Container */}
      <div className="app-body">
        {/* Left Operational Sidebar */}
        <aside className={`app-sidebar left ${leftSidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <div className="sidebar-tabs">
              <button
                className={`sidebar-tab ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                Flight File
              </button>
              <button
                className={`sidebar-tab ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Settings & 3D
              </button>
            </div>
            <button
              className="sidebar-close-btn"
              onClick={() => setLeftSidebarOpen(false)}
              title="Collapse Panel"
            >
              <Minimize2 size={14} />
            </button>
          </div>

          <div className="sidebar-scrollable-content">
            {activeTab === 'upload' ? (
              <KMLUploader
                onRouteLoaded={handleRouteLoaded}
                currentRoute={currentRoute}
                availableRoutes={availableRoutes}
                onSelectSubRoute={(r) => handleRouteLoaded(r, availableRoutes)}
              />
            ) : (
              <SettingsPanel
                modelSettings={modelSettings}
                visSettings={visSettings}
                onUpdateModelSettings={(s) => setModelSettings((prev) => ({ ...prev, ...s }))}
                onUpdateVisSettings={(s) => setVisSettings((prev) => ({ ...prev, ...s }))}
              />
            )}
          </div>
        </aside>

        {/* Re-open Left Sidebar Button if collapsed */}
        {!leftSidebarOpen && (
          <button
            className="reopen-panel-btn left"
            onClick={() => setLeftSidebarOpen(true)}
            title="Open Control Panel"
          >
            <Maximize2 size={14} />
            <span>CONTROLS</span>
          </button>
        )}

        {/* Center 3D Globe Visualizer */}
        <main className="globe-canvas-container">
          <GlobeViewer
            route={currentRoute}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            isLooping={isLooping}
            seekTimeSeconds={seekTimeSeconds}
            cameraMode={cameraMode}
            cameraDistance={cameraDistance}
            cameraPitchDeg={cameraPitchDeg}
            modelSettings={modelSettings}
            visSettings={visSettings}
            onTimeUpdate={handleTimeUpdate}
            onPlaybackComplete={handlePlaybackComplete}
            onSelectCameraMode={setCameraMode}
            onCameraDistanceChange={setCameraDistance}
            onCameraPitchChange={setCameraPitchDeg}
            onModelError={(err) => notify(err, 'error')}
          />

          {/* Floating Transient Toast Notification */}
          {notification && (
            <div className={`hud-toast ${notification.type}`}>
              <span>{notification.msg}</span>
              <button onClick={() => setNotification(null)}>
                <X size={14} />
              </button>
            </div>
          )}
        </main>

        {/* Right Telemetry & Altitude Profile Sidebar */}
        <aside className={`app-sidebar right ${rightSidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <span className="hud-panel-title">LIVE AVIONICS & PROFILES</span>
            <button
              className="sidebar-close-btn"
              onClick={() => setRightSidebarOpen(false)}
              title="Collapse Telemetry"
            >
              <Minimize2 size={14} />
            </button>
          </div>

          <div className="sidebar-scrollable-content">
            <TelemetryPanel route={currentRoute} telemetry={telemetry} />
            <AltitudeChart
              route={currentRoute}
              telemetry={telemetry}
              onSeekFraction={handleSeekFraction}
            />
          </div>
        </aside>

        {/* Re-open Right Sidebar Button if collapsed */}
        {!rightSidebarOpen && (
          <button
            className="reopen-panel-btn right"
            onClick={() => setRightSidebarOpen(true)}
            title="Open Telemetry & Altitude Graph"
          >
            <Maximize2 size={14} />
            <span>TELEMETRY</span>
          </button>
        )}
      </div>

      {/* Bottom Avionics Playback Bar */}
      <footer className="app-footer">
        <FlightControls
          route={currentRoute}
          isPlaying={isPlaying}
          currentTimeSeconds={currentTimeSeconds}
          totalDurationSeconds={currentRoute?.totalDurationSeconds || 0}
          playbackSpeed={playbackSpeed}
          isLooping={isLooping}
          onTogglePlay={handleTogglePlay}
          onRestart={handleRestart}
          onSeek={handleSeek}
          onChangeSpeed={setPlaybackSpeed}
          onToggleLoop={() => setIsLooping((v) => !v)}
          onOpenSpeedConfig={() => setIsSpeedModalOpen(true)}
        />
      </footer>

      {/* Simulation Speed & Altitude Configuration Modal */}
      <SpeedConfigModal
        isOpen={isSpeedModalOpen}
        currentSpeedKnots={visSettings.simulationSpeedKnots}
        currentCruiseAltMeters={visSettings.simulationCruiseAltitudeMeters}
        onClose={() => setIsSpeedModalOpen(false)}
        onApply={handleApplySimParams}
      />
    </div>
  );
}

export default App;
