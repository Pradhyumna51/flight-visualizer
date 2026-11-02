import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import type { CameraMode, FlightRoute } from '../types/flight';
import {
  Video,
  Globe,
  Maximize2,
  ArrowDownCircle,
  Eye,
  Sliders,
} from 'lucide-react';

interface CameraControllerProps {
  viewer: Cesium.Viewer | null;
  aircraftEntity: Cesium.Entity | null;
  currentCartesian: Cesium.Cartesian3 | null;
  currentHeadingDeg: number;
  cameraMode: CameraMode;
  cameraDistance: number;
  cameraPitchDeg: number;
  route: FlightRoute | null;
  onSelectMode: (mode: CameraMode) => void;
  onDistanceChange: (dist: number) => void;
  onPitchChange: (pitch: number) => void;
}

export const CameraController: React.FC<CameraControllerProps> = ({
  viewer,
  currentCartesian,
  currentHeadingDeg,
  cameraMode,
  cameraDistance,
  cameraPitchDeg,
  route,
  onSelectMode,
  onDistanceChange,
  onPitchChange,
}) => {
  const [showSettings, setShowSettings] = React.useState(false);
  const prevModeRef = useRef<CameraMode>(cameraMode);

  // Switch camera modes
  useEffect(() => {
    if (!viewer) return;

    if (cameraMode === 'free') {
      // Release camera target lock
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      viewer.trackedEntity = undefined;
    } else if (cameraMode === 'overview') {
      // Fly to overview bounding sphere
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      viewer.trackedEntity = undefined;

      if (route && route.points.length > 0) {
        const positions = route.points.map((p) =>
          Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, p.altitude)
        );
        const sphere = Cesium.BoundingSphere.fromPoints(positions);
        viewer.camera.flyToBoundingSphere(sphere, {
          duration: 1.5,
          offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), sphere.radius * 2.2),
        });
      }
    }

    prevModeRef.current = cameraMode;
  }, [viewer, cameraMode, route]);

  // Update camera each frame if following
  useEffect(() => {
    if (!viewer || !currentCartesian) return;
    if (cameraMode === 'free' || cameraMode === 'overview') return;

    const headingRad = Cesium.Math.toRadians(currentHeadingDeg);
    const pitchRad = Cesium.Math.toRadians(cameraPitchDeg);

    if (cameraMode === 'follow') {
      // Follow from behind and above
      const chaseHeading = headingRad; // facing same direction
      const range = cameraDistance;
      viewer.camera.lookAt(
        currentCartesian,
        new Cesium.HeadingPitchRange(chaseHeading, pitchRad, range)
      );
    } else if (cameraMode === 'side') {
      // Follow from the side to clearly visualize climb/descent
      const sideHeading = headingRad - Cesium.Math.toRadians(90);
      const sidePitch = Cesium.Math.toRadians(-5);
      const range = cameraDistance * 1.2;
      viewer.camera.lookAt(
        currentCartesian,
        new Cesium.HeadingPitchRange(sideHeading, sidePitch, range)
      );
    } else if (cameraMode === 'topDown') {
      // Orthogonal top-down view looking directly at aircraft
      const nadirPitch = Cesium.Math.toRadians(-89.9);
      const range = cameraDistance * 2.5;
      viewer.camera.lookAt(
        currentCartesian,
        new Cesium.HeadingPitchRange(headingRad, nadirPitch, range)
      );
    } else if (cameraMode === 'cockpit') {
      // Looking forward from nose
      const cockpitPitch = Cesium.Math.toRadians(0);
      const range = 25; // Close to nose
      viewer.camera.lookAt(
        currentCartesian,
        new Cesium.HeadingPitchRange(headingRad, cockpitPitch, range)
      );
    }
  }, [viewer, currentCartesian, currentHeadingDeg, cameraMode, cameraDistance, cameraPitchDeg]);

  return (
    <div className="camera-controller-hud">
      <div className="camera-mode-buttons">
        <button
          className={`cam-btn ${cameraMode === 'follow' ? 'active' : ''}`}
          onClick={() => onSelectMode('follow')}
          title="Follow Aircraft (Chase Cam)"
        >
          <Video size={14} />
          <span>FOLLOW</span>
        </button>

        <button
          className={`cam-btn ${cameraMode === 'side' ? 'active' : ''}`}
          onClick={() => onSelectMode('side')}
          title="Side View (Climb & Descent Profile)"
        >
          <Eye size={14} />
          <span>SIDE VIEW</span>
        </button>

        <button
          className={`cam-btn ${cameraMode === 'topDown' ? 'active' : ''}`}
          onClick={() => onSelectMode('topDown')}
          title="Top-Down Ortho View"
        >
          <ArrowDownCircle size={14} />
          <span>TOP-DOWN</span>
        </button>

        <button
          className={`cam-btn ${cameraMode === 'overview' ? 'active' : ''}`}
          onClick={() => onSelectMode('overview')}
          title="Overview Route"
        >
          <Maximize2 size={14} />
          <span>OVERVIEW</span>
        </button>

        <button
          className={`cam-btn ${cameraMode === 'free' ? 'active' : ''}`}
          onClick={() => onSelectMode('free')}
          title="Free Camera Exploration"
        >
          <Globe size={14} />
          <span>FREE</span>
        </button>

        <button
          className={`cam-btn settings-toggle ${showSettings ? 'open' : ''}`}
          onClick={() => setShowSettings((v) => !v)}
          title="Adjust Camera Distance & Angle"
        >
          <Sliders size={14} />
        </button>
      </div>

      {showSettings && (
        <div className="camera-sliders-popover">
          <div className="slider-row">
            <span className="slider-label">Distance: {Math.round(cameraDistance)}m</span>
            <input
              type="range"
              min="50"
              max="15000"
              step="50"
              value={cameraDistance}
              onChange={(e) => onDistanceChange(parseFloat(e.target.value))}
            />
          </div>
          <div className="slider-row">
            <span className="slider-label">Pitch: {Math.round(cameraPitchDeg)}°</span>
            <input
              type="range"
              min="-85"
              max="10"
              step="1"
              value={cameraPitchDeg}
              onChange={(e) => onPitchChange(parseFloat(e.target.value))}
            />
          </div>
        </div>
      )}
    </div>
  );
};
