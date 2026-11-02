import React, { useRef, useState, useCallback } from 'react';
import {
  Upload,
  FileCode,
  AlertTriangle,
  Sparkles,
  Layers,
  ChevronDown,
} from 'lucide-react';
import type { FlightRoute } from '../types/flight';
import { parseKML, applySimulatedAltitude } from '../services/kmlParser';
import { SAMPLE_FLIGHTS } from '../data/sampleFlights';
import type { SampleFlightItem } from '../data/sampleFlights';

interface KMLUploaderProps {
  onRouteLoaded: (route: FlightRoute, allRoutesInFile?: FlightRoute[]) => void;
  currentRoute: FlightRoute | null;
  availableRoutes: FlightRoute[];
  onSelectSubRoute: (route: FlightRoute) => void;
}

export const KMLUploader: React.FC<KMLUploaderProps> = ({
  onRouteLoaded,
  currentRoute,
  availableRoutes,
  onSelectSubRoute,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessKMLText = useCallback(
    (text: string) => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const routes = parseKML(text);
        if (routes.length === 0) {
          throw new Error('No valid flight paths or coordinates found in this KML file.');
        }

        const selected = routes[0];
        onRouteLoaded(selected, routes);
      } catch (err: unknown) {
        console.error('KML processing failed:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to parse KML file. Please ensure it contains valid coordinates.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [onRouteLoaded]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.kml') && !file.name.toLowerCase().endsWith('.xml')) {
        setErrorMessage('Please select a valid .kml or .xml file.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        handleProcessKMLText(text);
      };
      reader.onerror = () => {
        setErrorMessage('Failed to read the selected file.');
      };
      reader.readAsText(file);
    },
    [handleProcessKMLText]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleSampleClick = async (sample: SampleFlightItem) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await fetch(sample.path);
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch sample ${sample.path}`);
      const text = await res.text();
      handleProcessKMLText(text);
    } catch (err: unknown) {
      setErrorMessage(`Failed to load sample: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySimulatedAlt = () => {
    if (!currentRoute) return;
    const simulated = applySimulatedAltitude(currentRoute, 9500);
    onRouteLoaded(simulated, availableRoutes);
  };

  return (
    <div className="kml-uploader-card">
      <div className="card-section-title">
        <Upload size={14} className="cyan-icon" />
        <span>KML FLIGHT IMPORT</span>
      </div>

      {/* Drag & Drop Area */}
      <div
        className={`dropzone ${isDragging ? 'dragging' : ''} ${isLoading ? 'loading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept=".kml,.xml"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFile(e.target.files[0]);
            }
          }}
        />
        <FileCode size={26} className="dropzone-icon" />
        <div className="dropzone-text">
          <strong>Drag & drop .kml flight path</strong>
          <span>or click to browse local files</span>
        </div>
        <span className="dropzone-hint">Supports LineString, gx:Track, MultiTrack</span>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="upload-error-banner">
          <AlertTriangle size={15} className="error-icon" />
          <div className="error-text">{errorMessage}</div>
        </div>
      )}

      {/* Warning & Option for Missing Altitude */}
      {currentRoute && !currentRoute.hasRealAltitude && !currentRoute.isSimulatedAltitude && (
        <div className="altitude-warning-banner">
          <div className="warning-head">
            <AlertTriangle size={15} className="warning-icon" />
            <strong>No Flight Altitude In KML</strong>
          </div>
          <p>
            Route uses <code>{currentRoute.altitudeMode}</code> with zero altitude data. The route
            is currently resting flat on the ground.
          </p>
          <button className="apply-sim-alt-btn" onClick={handleApplySimulatedAlt}>
            <Sparkles size={14} />
            <span>Generate Realistic Flight Altitude (FL310)</span>
          </button>
        </div>
      )}

      {/* Multiple Sub-Routes Selector */}
      {availableRoutes.length > 1 && (
        <div className="subroute-selector">
          <div className="selector-label">
            <Layers size={13} />
            <span>SELECT FLIGHT ROUTE / LEG ({availableRoutes.length} DETECTED)</span>
          </div>
          <div className="select-wrapper">
            <select
              value={currentRoute?.id || ''}
              onChange={(e) => {
                const found = availableRoutes.find((r) => r.id === e.target.value);
                if (found) onSelectSubRoute(found);
              }}
            >
              {availableRoutes.map((r, i) => (
                <option key={r.id} value={r.id}>
                  {i + 1}. {r.name} ({Math.round(r.totalDistanceMeters / 1000)}km)
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="select-arrow" />
          </div>
        </div>
      )}

      {/* Sample Flight Paths Fast-Selector */}
      <div className="samples-section">
        <div className="samples-heading">OR LOAD A TEST SCENARIO:</div>
        <div className="samples-grid">
          {SAMPLE_FLIGHTS.map((sample) => (
            <button
              key={sample.id}
              className={`sample-btn ${currentRoute?.name.includes(sample.name.split(' ')[0]) ? 'active' : ''}`}
              onClick={() => handleSampleClick(sample)}
              disabled={isLoading}
            >
              <div className="sample-name">{sample.name}</div>
              <div className="sample-badge">{sample.badge}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
