import React from 'react';
import type { FlightRoute, FlightTelemetry } from '../types/flight';
import {
  formatAltitude,
  formatDistance,
  formatSpeed,
  formatCoordinate,
  formatDuration,
  getCompassHeading,
} from '../services/geoUtils';
import {
  Compass,
  Gauge,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  MapPin,
  Clock,
  Navigation,
} from 'lucide-react';

interface TelemetryPanelProps {
  route: FlightRoute | null;
  telemetry: FlightTelemetry | null;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ route, telemetry }) => {
  if (!route || !telemetry) {
    return (
      <div className="telemetry-panel empty">
        <div className="telemetry-placeholder">
          <Navigation className="placeholder-icon pulse" size={32} />
          <h3>Awaiting Flight Data</h3>
          <p>Import a KML flight path or pick a sample flight to initialize telemetry.</p>
        </div>
      </div>
    );
  }

  const altFormatted = formatAltitude(telemetry.currentAltitudeMeters);
  const maxAltFormatted = formatAltitude(route.maxAltitudeMeters);
  const minAltFormatted = formatAltitude(route.minAltitudeMeters);
  const distCovered = formatDistance(telemetry.distanceCoveredMeters);
  const totalDist = formatDistance(route.totalDistanceMeters);
  const speedFormatted = formatSpeed(telemetry.currentPoint.speedMps || route.avgSpeedMps);
  const avgSpeedFormatted = formatSpeed(route.avgSpeedMps);

  const verticalSpeed = telemetry.verticalSpeedFpm;
  const isClimbing = verticalSpeed > 50;
  const isDescending = verticalSpeed < -50;

  return (
    <div className="telemetry-panel">
      {/* Header with live status badge */}
      <div className="telemetry-header">
        <div className="telemetry-title">
          <span className="live-indicator"></span>
          <span>FLIGHT TELEMETRY HUD</span>
        </div>
        <span className="flight-id-badge">{route.name.slice(0, 24)}</span>
      </div>

      {/* Primary Flight Instrument Grid */}
      <div className="instrument-grid">
        {/* Altitude Gauge Card */}
        <div className="instrument-card primary">
          <div className="card-top">
            <span className="card-label">ALTITUDE (MSL)</span>
            <span className="unit-badge">METRES / FEET</span>
          </div>
          <div className="card-primary-value cyan">{altFormatted.m}</div>
          <div className="card-secondary-value">{altFormatted.ft}</div>
          <div className="card-sub-stats">
            <span>MIN: {minAltFormatted.m}</span>
            <span>MAX: {maxAltFormatted.m}</span>
          </div>
        </div>

        {/* Speed Gauge Card */}
        <div className="instrument-card primary">
          <div className="card-top">
            <span className="card-label">GROUND SPEED</span>
            <Gauge size={14} className="card-icon" />
          </div>
          <div className="card-primary-value green">{speedFormatted.knots}</div>
          <div className="card-secondary-value">{speedFormatted.kmh}</div>
          <div className="card-sub-stats">
            <span>AVG: {avgSpeedFormatted.knots}</span>
            <span>{route.hasRecordedTimestamps ? 'GPS TIME' : 'SIMULATED'}</span>
          </div>
        </div>
      </div>

      {/* Secondary Flight Instruments: Vertical Speed & Attitude */}
      <div className="instrument-grid secondary">
        {/* Vertical Speed / VSI */}
        <div className="instrument-card">
          <div className="card-top">
            <span className="card-label">VERTICAL SPEED</span>
            {isClimbing ? (
              <ArrowUpRight size={14} className="icon-climb" />
            ) : isDescending ? (
              <ArrowDownRight size={14} className="icon-descend" />
            ) : (
              <Minus size={14} className="icon-level" />
            )}
          </div>
          <div className={`card-value ${isClimbing ? 'climb' : isDescending ? 'descend' : ''}`}>
            {verticalSpeed > 0 ? '+' : ''}
            {Math.round(verticalSpeed)} <span className="unit">ft/min</span>
          </div>
          <div className="card-subtext">
            {Math.abs(verticalSpeed) < 50 ? 'LEVEL CRUISE' : isClimbing ? 'CLIMBING' : 'DESCENDING'}
            {' '}({(telemetry.verticalSpeedMps).toFixed(1)} m/s)
          </div>
        </div>

        {/* Heading & Compass */}
        <div className="instrument-card">
          <div className="card-top">
            <span className="card-label">TRUE HEADING</span>
            <Compass size={14} className="card-icon" />
          </div>
          <div className="card-value cyan">
            {getCompassHeading(telemetry.currentHeadingDeg)}
          </div>
          <div className="compass-visual-strip">
            <div
              className="compass-indicator-bar"
              style={{
                transform: `translateX(${((telemetry.currentHeadingDeg % 360) / 360) * 100 - 50}%)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Aircraft Attitude (Pitch & Roll) */}
      <div className="instrument-row-split">
        <div className="mini-stat-card">
          <span className="mini-label">PITCH ANGLE</span>
          <span className={`mini-value ${telemetry.currentPitchDeg > 0 ? 'climb' : telemetry.currentPitchDeg < 0 ? 'descend' : ''}`}>
            {telemetry.currentPitchDeg > 0 ? '▲ +' : telemetry.currentPitchDeg < 0 ? '▼ ' : ''}
            {telemetry.currentPitchDeg.toFixed(1)}°
          </span>
        </div>
        <div className="mini-stat-card">
          <span className="mini-label">BANK / ROLL</span>
          <span className="mini-value">
            {Math.abs(telemetry.currentRollDeg) < 1
              ? 'WINGS LEVEL'
              : `${telemetry.currentRollDeg > 0 ? 'RIGHT' : 'LEFT'} ${Math.abs(telemetry.currentRollDeg).toFixed(1)}°`}
          </span>
        </div>
      </div>

      {/* Coordinates & Route Progress */}
      <div className="telemetry-section-box">
        <div className="box-row">
          <div className="box-item">
            <div className="item-label">
              <MapPin size={12} />
              <span>GEOGRAPHICAL POSITION</span>
            </div>
            <div className="item-val mono">
              {formatCoordinate(telemetry.currentPoint.latitude, telemetry.currentPoint.longitude)}
            </div>
          </div>
        </div>

        <div className="box-row">
          <div className="box-item">
            <div className="item-label">
              <Clock size={12} />
              <span>TIMELINE STATUS</span>
            </div>
            <div className="item-val">
              {formatDuration(telemetry.elapsedSeconds)} / {formatDuration(route.totalDurationSeconds)}
            </div>
          </div>
        </div>

        <div className="box-row">
          <div className="box-item">
            <div className="item-label">
              <span>DISTANCE COVERED</span>
            </div>
            <div className="item-val">
              {distCovered.km} ({distCovered.nm}) of {totalDist.km}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="progress-container">
          <div
            className="progress-fill"
            style={{ width: `${Math.round(telemetry.fraction * 100)}%` }}
          />
        </div>
      </div>

      {/* Metadata Badges */}
      <div className="telemetry-footer-badges">
        <span className="hud-pill">
          ALT MODE: <strong>{route.altitudeMode.toUpperCase()}</strong>
        </span>
        <span className={`hud-pill ${route.hasRealAltitude ? 'good' : 'warning'}`}>
          ALT DATA: <strong>{route.hasRealAltitude ? 'RECORDED' : route.isSimulatedAltitude ? 'SIMULATED' : 'FLAT'}</strong>
        </span>
      </div>
    </div>
  );
};
