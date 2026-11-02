export interface FlightPoint {
  longitude: number; // degrees (-180 to 180)
  latitude: number;  // degrees (-90 to 90)
  altitude: number;  // meters above sea level
  timeIso?: string;   // ISO timestamp if present in KML
  secondsFromStart: number;
  distanceFromStartMeters: number;
  speedMps?: number;
  headingDeg?: number;
  pitchDeg?: number;
  rollDeg?: number;
}

export type AltitudeMode = 'absolute' | 'relativeToGround' | 'clampToGround' | 'unknown';

export interface FlightRoute {
  id: string;
  name: string;
  description?: string;
  altitudeMode: AltitudeMode;
  hasRecordedTimestamps: boolean;
  hasRealAltitude: boolean;
  isSimulatedAltitude: boolean;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  maxAltitudeMeters: number;
  minAltitudeMeters: number;
  avgSpeedMps: number;
  points: FlightPoint[];
  startTimeIso: string;
  stopTimeIso: string;
}

export interface FlightTelemetry {
  currentTimeIso: string;
  elapsedSeconds: number;
  totalDurationSeconds: number;
  fraction: number; // 0 to 1
  currentPoint: FlightPoint;
  currentSpeedKnots: number;
  currentSpeedKmh: number;
  currentAltitudeMeters: number;
  currentAltitudeFeet: number;
  verticalSpeedFpm: number;
  verticalSpeedMps: number;
  currentHeadingDeg: number;
  currentPitchDeg: number;
  currentRollDeg: number;
  distanceCoveredMeters: number;
  distanceRemainingMeters: number;
}

export type CameraMode = 'follow' | 'free' | 'overview' | 'topDown' | 'side' | 'cockpit';

export type ModelType = 'cesiumAir' | 'cesiumDrone' | 'custom' | 'primitiveFallback';

export interface ModelSettings {
  modelType: ModelType;
  customModelUrl?: string;
  customModelName?: string;
  scale: number;
  headingOffsetDeg: number;
  pitchOffsetDeg: number;
  rollOffsetDeg: number;
}

export interface VisualizationSettings {
  verticalExaggeration: number;
  pathLeadColor: string;
  pathTrailColor: string;
  showDropLine: boolean;
  showWaypoints: boolean;
  showLabels: boolean;
  showTerrain: boolean;
  simulationCruiseAltitudeMeters: number;
  simulationSpeedKnots: number;
  cesiumIonToken: string;
  interpolationAlgorithm: 'hermite' | 'linear' | 'lagrange';
}

