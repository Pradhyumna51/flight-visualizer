import React, { useRef } from 'react';
import {
  Globe,
  Box,
  Compass,
  Eye,
  Sliders,
  Key,
  Upload,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type {
  ModelSettings,
  VisualizationSettings,
} from '../types/flight';

interface SettingsPanelProps {
  modelSettings: ModelSettings;
  visSettings: VisualizationSettings;
  onUpdateModelSettings: (settings: Partial<ModelSettings>) => void;
  onUpdateVisSettings: (settings: Partial<VisualizationSettings>) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  modelSettings,
  visSettings,
  onUpdateModelSettings,
  onUpdateVisSettings,
}) => {
  const customModelInputRef = useRef<HTMLInputElement>(null);

  const handleCustomGlbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const objectUrl = URL.createObjectURL(file);
      onUpdateModelSettings({
        modelType: 'custom',
        customModelUrl: objectUrl,
        customModelName: file.name,
      });
    }
  };

  return (
    <div className="settings-panel-content">
      {/* 1. Cesium Ion & Terrain */}
      <div className="settings-group">
        <div className="settings-group-title">
          <Globe size={14} className="cyan-icon" />
          <span>CESIUM GLOBE & TERRAIN</span>
        </div>

        <div className="setting-item">
          <label className="setting-label">
            <Key size={12} />
            <span>Cesium ion Token</span>
          </label>
          <div className="input-with-status">
            <input
              type="password"
              placeholder="VITE_CESIUM_ION_TOKEN or paste token..."
              value={visSettings.cesiumIonToken}
              onChange={(e) => onUpdateVisSettings({ cesiumIonToken: e.target.value })}
              className="hud-input"
            />
            {visSettings.cesiumIonToken ? (
              <span title="Ion Token Set" className="status-icon active">
                <CheckCircle2 size={16} />
              </span>
            ) : (
              <span title="Using Fallback World Terrain" className="status-icon inactive">
                <AlertCircle size={16} />
              </span>
            )}
          </div>
          <span className="setting-hint">
            {visSettings.cesiumIonToken
              ? 'Cesium ion token active for high-res 3D World Terrain.'
              : 'No token detected. Using default globe ellipsoid & OpenStreetMap layers.'}
          </span>
        </div>

        <div className="setting-item">
          <div className="slider-header">
            <label className="setting-label">
              <Eye size={12} />
              <span>Vertical Exaggeration</span>
            </label>
            <span className="slider-val cyan">{visSettings.verticalExaggeration.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="5.0"
            step="0.1"
            value={visSettings.verticalExaggeration}
            onChange={(e) =>
              onUpdateVisSettings({ verticalExaggeration: parseFloat(e.target.value) })
            }
            className="hud-slider"
          />
          <span className="setting-hint">
            Exaggerates flight altitude above terrain for high-visibility mountain and climb paths.
          </span>
        </div>
      </div>

      {/* 2. 3D Aircraft Model */}
      <div className="settings-group">
        <div className="settings-group-title">
          <Box size={14} className="cyan-icon" />
          <span>3D AIRCRAFT MODEL</span>
        </div>

        <div className="setting-item">
          <label className="setting-label">Select Model</label>
          <div className="model-radio-buttons">
            <button
              className={`model-option-btn ${modelSettings.modelType === 'cesiumAir' ? 'active' : ''}`}
              onClick={() => onUpdateModelSettings({ modelType: 'cesiumAir' })}
            >
              Passenger Jet
            </button>
            <button
              className={`model-option-btn ${modelSettings.modelType === 'cesiumDrone' ? 'active' : ''}`}
              onClick={() => onUpdateModelSettings({ modelType: 'cesiumDrone' })}
            >
              Drone / Prop
            </button>
            <button
              className={`model-option-btn ${modelSettings.modelType === 'primitiveFallback' ? 'active' : ''}`}
              onClick={() => onUpdateModelSettings({ modelType: 'primitiveFallback' })}
            >
              3D Primitives
            </button>
            <button
              className={`model-option-btn ${modelSettings.modelType === 'custom' ? 'active' : ''}`}
              onClick={() => customModelInputRef.current?.click()}
            >
              <Upload size={12} />
              <span>Custom GLB</span>
            </button>
          </div>

          <input
            type="file"
            ref={customModelInputRef}
            accept=".glb,.gltf"
            style={{ display: 'none' }}
            onChange={handleCustomGlbUpload}
          />

          {modelSettings.modelType === 'custom' && modelSettings.customModelName && (
            <div className="custom-model-badge">
              <span>Loaded: {modelSettings.customModelName}</span>
            </div>
          )}
        </div>

        {/* Model Scale */}
        <div className="setting-item">
          <div className="slider-header">
            <label className="setting-label">Aircraft Scale</label>
            <span className="slider-val">{modelSettings.scale.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="5.0"
            step="0.1"
            value={modelSettings.scale}
            onChange={(e) => onUpdateModelSettings({ scale: parseFloat(e.target.value) })}
            className="hud-slider"
          />
        </div>

        {/* Forward Axis & Orientation Offsets */}
        <div className="setting-item">
          <label className="setting-label">
            <Compass size={12} />
            <span>Model Axis Offsets (GLB Forward Alignment)</span>
          </label>
          <div className="axis-offset-grid">
            <div className="offset-control">
              <span>Heading ({modelSettings.headingOffsetDeg}°)</span>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={modelSettings.headingOffsetDeg}
                onChange={(e) =>
                  onUpdateModelSettings({ headingOffsetDeg: parseInt(e.target.value, 10) })
                }
              />
            </div>
            <div className="offset-control">
              <span>Pitch ({modelSettings.pitchOffsetDeg}°)</span>
              <input
                type="range"
                min="-90"
                max="90"
                step="5"
                value={modelSettings.pitchOffsetDeg}
                onChange={(e) =>
                  onUpdateModelSettings({ pitchOffsetDeg: parseInt(e.target.value, 10) })
                }
              />
            </div>
            <div className="offset-control">
              <span>Roll ({modelSettings.rollOffsetDeg}°)</span>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={modelSettings.rollOffsetDeg}
                onChange={(e) =>
                  onUpdateModelSettings({ rollOffsetDeg: parseInt(e.target.value, 10) })
                }
              />
            </div>
          </div>
          <button
            className="reset-offsets-btn"
            onClick={() =>
              onUpdateModelSettings({
                headingOffsetDeg: 0,
                pitchOffsetDeg: 0,
                rollOffsetDeg: 0,
                scale: 1.0,
              })
            }
          >
            Reset Orientation Offsets
          </button>
        </div>
      </div>

      {/* 3. Visualization Toggles */}
      <div className="settings-group">
        <div className="settings-group-title">
          <Sliders size={14} className="cyan-icon" />
          <span>DISPLAY & VISUALS</span>
        </div>

        <div className="toggle-list">
          <label className="toggle-item">
            <input
              type="checkbox"
              checked={visSettings.showDropLine}
              onChange={(e) => onUpdateVisSettings({ showDropLine: e.target.checked })}
            />
            <span>Show Altitude Drop Indicator Line</span>
          </label>

          <label className="toggle-item">
            <input
              type="checkbox"
              checked={visSettings.showWaypoints}
              onChange={(e) => onUpdateVisSettings({ showWaypoints: e.target.checked })}
            />
            <span>Show Intermediate Waypoints</span>
          </label>

          <label className="toggle-item">
            <input
              type="checkbox"
              checked={visSettings.showLabels}
              onChange={(e) => onUpdateVisSettings({ showLabels: e.target.checked })}
            />
            <span>Show Airport & Altitude Text Labels</span>
          </label>
        </div>

        <div className="setting-item">
          <label className="setting-label">Trajectory Interpolation</label>
          <select
            value={visSettings.interpolationAlgorithm}
            onChange={(e) =>
              onUpdateVisSettings({
                interpolationAlgorithm: e.target.value as 'hermite' | 'linear' | 'lagrange',
              })
            }
            className="hud-select"
          >
            <option value="hermite">Hermite Spline (Smooth Aeronautical Curve)</option>
            <option value="lagrange">Lagrange Polynomial</option>
            <option value="linear">Linear Point-to-Point</option>
          </select>
        </div>
      </div>
    </div>
  );
};
