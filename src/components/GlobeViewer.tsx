import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Cesium from 'cesium';
import type {
  FlightRoute,
  FlightTelemetry,
  CameraMode,
  ModelSettings,
  VisualizationSettings,
} from '../types/flight';
import {
  buildCesiumTrajectory,
  getTelemetryAtTime,
} from '../services/flightAnimator';
import type { CesiumFlightTrajectory } from '../services/flightAnimator';
import { AircraftEntity } from './AircraftEntity';
import { FlightPathRenderer } from './FlightPathRenderer';
import { CameraController } from './CameraController';

interface GlobeViewerProps {
  route: FlightRoute | null;
  isPlaying: boolean;
  playbackSpeed: number;
  isLooping: boolean;
  seekTimeSeconds: number | null;
  cameraMode: CameraMode;
  cameraDistance: number;
  cameraPitchDeg: number;
  modelSettings: ModelSettings;
  visSettings: VisualizationSettings;
  onTimeUpdate: (elapsedSeconds: number, telemetry: FlightTelemetry) => void;
  onPlaybackComplete: () => void;
  onSelectCameraMode: (mode: CameraMode) => void;
  onCameraDistanceChange: (dist: number) => void;
  onCameraPitchChange: (pitch: number) => void;
  onModelError: (errorMsg: string) => void;
}

export const GlobeViewer: React.FC<GlobeViewerProps> = ({
  route,
  isPlaying,
  playbackSpeed,
  isLooping,
  seekTimeSeconds,
  cameraMode,
  cameraDistance,
  cameraPitchDeg,
  modelSettings,
  visSettings,
  onTimeUpdate,
  onPlaybackComplete,
  onSelectCameraMode,
  onCameraDistanceChange,
  onCameraPitchChange,
  onModelError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const [trajectory, setTrajectory] = useState<CesiumFlightTrajectory | null>(null);
  const [currentCartesian, setCurrentCartesian] = useState<Cesium.Cartesian3 | null>(null);
  const [currentHeadingDeg, setCurrentHeadingDeg] = useState(0);
  const [aircraftEntity, setAircraftEntity] = useState<Cesium.Entity | null>(null);
  const [telemetry, setTelemetry] = useState<FlightTelemetry | null>(null);

  // Initialize Cesium Viewer once
  useEffect(() => {
    if (!containerRef.current) return;

    // Set Cesium base URL
    window.CESIUM_BASE_URL = '/cesium/';

    // Set Cesium Ion token if available
    const ionToken =
      visSettings.cesiumIonToken ||
      import.meta.env.VITE_CESIUM_ION_TOKEN ||
      '';
    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken;
    }

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayerPicker: false,
      animation: false,
      timeline: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      infoBox: false,
      selectionIndicator: false,
      fullscreenButton: false,
      scene3DOnly: true,
      shouldAnimate: false,
    });

    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.globe.enableLighting = true;

    // Apply vertical exaggeration
    viewer.scene.verticalExaggeration = visSettings.verticalExaggeration || 1.0;

    // Set fallback terrain if no ion token
    if (!ionToken) {
      viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    } else {
      // Async load world terrain
      Cesium.createWorldTerrainAsync()
        .then((tp) => {
          if (!viewer.isDestroyed()) {
            viewer.terrainProvider = tp;
          }
        })
        .catch((err) => {
          console.warn('Cesium World Terrain fallback triggered:', err);
          if (!viewer.isDestroyed()) {
            viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
          }
        });
    }

    viewerRef.current = viewer;

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Update Ion token dynamically if user updates it in settings
  useEffect(() => {
    if (!viewerRef.current) return;
    if (visSettings.cesiumIonToken) {
      Cesium.Ion.defaultAccessToken = visSettings.cesiumIonToken;
      Cesium.createWorldTerrainAsync()
        .then((tp) => {
          if (viewerRef.current && !viewerRef.current.isDestroyed()) {
            viewerRef.current.terrainProvider = tp;
          }
        })
        .catch(console.warn);
    }
  }, [visSettings.cesiumIonToken]);

  // Update vertical exaggeration dynamically
  useEffect(() => {
    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      viewerRef.current.scene.verticalExaggeration = visSettings.verticalExaggeration || 1.0;
    }
  }, [visSettings.verticalExaggeration]);

  // Build Trajectory when route or model settings change
  useEffect(() => {
    if (!route || route.points.length < 2) {
      setTrajectory(null);
      return;
    }

    const traj = buildCesiumTrajectory(route, modelSettings, visSettings);
    setTrajectory(traj);

    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed()) {
      viewer.clock.startTime = traj.startJulianDate;
      viewer.clock.stopTime = traj.stopJulianDate;
      viewer.clock.currentTime = traj.startJulianDate;
      viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
      viewer.clock.multiplier = playbackSpeed;
      viewer.clock.shouldAnimate = isPlaying;

      // Calculate initial telemetry at time 0
      const initialTelem = getTelemetryAtTime(route, 0);
      setTelemetry(initialTelem);
      onTimeUpdate(0, initialTelem);

      // Initial camera positioning: zoom to route
      const positions = route.points.map((p) =>
        Cesium.Cartesian3.fromDegrees(
          p.longitude,
          p.latitude,
          p.altitude * visSettings.verticalExaggeration
        )
      );
      const sphere = Cesium.BoundingSphere.fromPoints(positions);
      viewer.camera.flyToBoundingSphere(sphere, {
        duration: 2.0,
        offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-40), sphere.radius * 2.5),
      });
    }
  }, [route, modelSettings.headingOffsetDeg, modelSettings.pitchOffsetDeg, modelSettings.rollOffsetDeg, modelSettings.scale, visSettings.verticalExaggeration, visSettings.interpolationAlgorithm]);

  // Synchronize Playback state and Speed to Cesium Clock
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    viewer.clock.shouldAnimate = isPlaying;
    viewer.clock.multiplier = playbackSpeed;
  }, [isPlaying, playbackSpeed]);

  // Handle Seek from Slider / Chart
  useEffect(() => {
    if (seekTimeSeconds === null || !trajectory || !route) return;

    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    const newTime = Cesium.JulianDate.addSeconds(
      trajectory.startJulianDate,
      seekTimeSeconds,
      new Cesium.JulianDate()
    );

    viewer.clock.currentTime = newTime;

    // Immediately update telemetry & positions on the seeked frame
    const telem = getTelemetryAtTime(route, seekTimeSeconds);
    setTelemetry(telem);
    onTimeUpdate(seekTimeSeconds, telem);

    // Update position and heading for camera lock
    const pos = trajectory.positionProperty.getValue(newTime, new Cesium.Cartesian3());
    if (pos) {
      setCurrentCartesian(pos);
      setCurrentHeadingDeg(telem.currentHeadingDeg);
    }
  }, [seekTimeSeconds, trajectory, route]);

  // Cesium Clock onTick event listener
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed() || !trajectory || !route) return;

    const onTickCallback = (clock: Cesium.Clock) => {
      const elapsed = Cesium.JulianDate.secondsDifference(clock.currentTime, clock.startTime);

      // Check for route end
      if (elapsed >= route.totalDurationSeconds) {
        if (isLooping) {
          clock.currentTime = clock.startTime;
        } else {
          clock.shouldAnimate = false;
          onPlaybackComplete();
        }
      }

      const telem = getTelemetryAtTime(route, elapsed);
      setTelemetry(telem);
      onTimeUpdate(elapsed, telem);

      // Extract current aircraft position
      const pos = trajectory.positionProperty.getValue(clock.currentTime, new Cesium.Cartesian3());
      if (pos) {
        setCurrentCartesian(pos);
        setCurrentHeadingDeg(telem.currentHeadingDeg);
      }
    };

    const removeListener = viewer.clock.onTick.addEventListener(onTickCallback);

    return () => {
      removeListener();
    };
  }, [trajectory, route, isLooping, onPlaybackComplete, onTimeUpdate]);

  const handleEntityCreated = useCallback((ent: Cesium.Entity) => {
    setAircraftEntity(ent);
  }, []);

  return (
    <div className="globe-viewer-wrapper">
      <div ref={containerRef} className="cesium-container" />

      {/* Sub-Components hooked into the viewer */}
      {viewerRef.current && (
        <>
          <AircraftEntity
            viewer={viewerRef.current}
            trajectory={trajectory}
            telemetry={telemetry}
            modelSettings={modelSettings}
            visSettings={visSettings}
            onEntityCreated={handleEntityCreated}
            onModelLoadError={onModelError}
          />

          <FlightPathRenderer
            viewer={viewerRef.current}
            route={route}
            telemetry={telemetry}
            visSettings={visSettings}
          />

          <CameraController
            viewer={viewerRef.current}
            aircraftEntity={aircraftEntity}
            currentCartesian={currentCartesian}
            currentHeadingDeg={currentHeadingDeg}
            cameraMode={cameraMode}
            cameraDistance={cameraDistance}
            cameraPitchDeg={cameraPitchDeg}
            route={route}
            onSelectMode={onSelectCameraMode}
            onDistanceChange={onCameraDistanceChange}
            onPitchChange={onCameraPitchChange}
          />
        </>
      )}
    </div>
  );
};
