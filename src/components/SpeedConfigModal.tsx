import React, { useState } from 'react';
import { X, Gauge, Mountain, Check } from 'lucide-react';
import { knotsToMps, metersToFeet, feetToMeters } from '../services/geoUtils';

interface SpeedConfigModalProps {
  isOpen: boolean;
  currentSpeedKnots: number;
  currentCruiseAltMeters: number;
  onClose: () => void;
  onApply: (speedKnots: number, cruiseAltMeters: number) => void;
}

export const SpeedConfigModal: React.FC<SpeedConfigModalProps> = ({
  isOpen,
  currentSpeedKnots,
  currentCruiseAltMeters,
  onClose,
  onApply,
}) => {
  const [speedKnots, setSpeedKnots] = useState(currentSpeedKnots);
  const [cruiseAltFt, setCruiseAltFt] = useState(Math.round(metersToFeet(currentCruiseAltMeters)));

  if (!isOpen) return null;

  const handleSave = () => {
    onApply(speedKnots, feetToMeters(cruiseAltFt));
    onClose();
  };

  const speedKmh = Math.round(knotsToMps(speedKnots) * 3.6);
  const cruiseAltM = Math.round(feetToMeters(cruiseAltFt));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Gauge size={16} className="cyan-icon" />
            <span>AIRCRAFT SIMULATION PARAMETERS</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-desc">
            For KML files without recorded timestamps or altitude recordings, configure the simulated cruising
            airspeed and target cruising altitude.
          </p>

          <div className="modal-field">
            <div className="field-head">
              <label>Simulated Cruising Airspeed</label>
              <span className="field-val cyan">{speedKnots} kts ({speedKmh} km/h)</span>
            </div>
            <input
              type="range"
              min="100"
              max="650"
              step="10"
              value={speedKnots}
              onChange={(e) => setSpeedKnots(parseInt(e.target.value, 10))}
              className="hud-slider"
            />
            <div className="field-presets">
              <button onClick={() => setSpeedKnots(140)}>Cessna (140 kts)</button>
              <button onClick={() => setSpeedKnots(320)}>Turboprop (320 kts)</button>
              <button onClick={() => setSpeedKnots(480)}>Airliner (480 kts)</button>
              <button onClick={() => setSpeedKnots(580)}>Jet (580 kts)</button>
            </div>
          </div>

          <div className="modal-field">
            <div className="field-head">
              <label>
                <Mountain size={14} />
                <span>Simulated Cruise Altitude</span>
              </label>
              <span className="field-val cyan">{cruiseAltFt.toLocaleString()} ft ({cruiseAltM.toLocaleString()} m)</span>
            </div>
            <input
              type="range"
              min="2000"
              max="45000"
              step="1000"
              value={cruiseAltFt}
              onChange={(e) => setCruiseAltFt(parseInt(e.target.value, 10))}
              className="hud-slider"
            />
            <div className="field-presets">
              <button onClick={() => setCruiseAltFt(10000)}>FL100 (10,000 ft)</button>
              <button onClick={() => setCruiseAltFt(24000)}>FL240 (24,000 ft)</button>
              <button onClick={() => setCruiseAltFt(33000)}>FL330 (33,000 ft)</button>
              <button onClick={() => setCruiseAltFt(38000)}>FL380 (38,000 ft)</button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            <Check size={14} />
            <span>Apply Parameters</span>
          </button>
        </div>
      </div>
    </div>
  );
};

