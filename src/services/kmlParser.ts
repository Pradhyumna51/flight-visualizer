import type {
  FlightPoint,
  FlightRoute,
  AltitudeMode,
} from '../types/flight';
import {
  calculateHaversineDistance,
  calculateBearing,
  calculatePitch,
  calculateBankAngle,
  knotsToMps,
} from './geoUtils';

interface ParsedRawTrack {
  id: string;
  name: string;
  description?: string;
  altitudeMode: AltitudeMode;
  coords: Array<{ lon: number; lat: number; alt: number; time?: string }>;
}

/**
 * Parses raw KML text into one or more FlightRoute objects.
 */
export function parseKML(
  kmlText: string,
  options?: {
    defaultSpeedKnots?: number;
    fallbackCruiseAltMeters?: number;
  }
): FlightRoute[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

  // Check for XML parsing errors
  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`KML parsing failed: ${parseError.textContent || 'Malformed XML structure'}`);
  }

  const rawTracks: ParsedRawTrack[] = [];

  // 1. Check for gx:Track elements (KML Extension for GPS tracking with timestamps)
  const trackElements = Array.from(xmlDoc.getElementsByTagNameNS('*', 'Track'));
  trackElements.forEach((trackEl, index) => {
    const placemarkEl = trackEl.closest('Placemark') || trackEl.parentElement;
    const name =
      placemarkEl?.getElementsByTagName('name')[0]?.textContent?.trim() ||
      `GPS Track ${index + 1}`;
    const description =
      placemarkEl?.getElementsByTagName('description')[0]?.textContent?.trim();

    const altModeEl =
      trackEl.getElementsByTagName('altitudeMode')[0] ||
      trackEl.getElementsByTagNameNS('*', 'altitudeMode')[0];
    const altitudeMode = parseAltitudeMode(altModeEl?.textContent);

    const whenEls = Array.from(trackEl.getElementsByTagName('when'));
    const coordEls = Array.from(trackEl.getElementsByTagNameNS('*', 'coord'));

    const coords: Array<{ lon: number; lat: number; alt: number; time?: string }> = [];

    const count = Math.max(whenEls.length, coordEls.length);
    for (let i = 0; i < count; i++) {
      const coordStr = coordEls[i]?.textContent?.trim();
      const timeStr = whenEls[i]?.textContent?.trim();

      if (coordStr) {
        // gx:coord is space-separated: "lon lat alt"
        const parts = coordStr.split(/\s+/).map(Number);
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          coords.push({
            lon: parts[0], // longitude first!
            lat: parts[1], // latitude second!
            alt: parts.length > 2 && !isNaN(parts[2]) ? parts[2] : 0,
            time: timeStr || undefined,
          });
        }
      }
    }

    if (coords.length >= 2) {
      rawTracks.push({
        id: `track-${index}-${Date.now()}`,
        name,
        description,
        altitudeMode,
        coords,
      });
    }
  });

  // 2. Check for LineString elements
  const lineStringElements = Array.from(xmlDoc.getElementsByTagName('LineString'));
  lineStringElements.forEach((lineEl, index) => {
    const placemarkEl = lineEl.closest('Placemark') || lineEl.parentElement;
    const name =
      placemarkEl?.getElementsByTagName('name')[0]?.textContent?.trim() ||
      `Flight Path ${index + 1}`;
    const description =
      placemarkEl?.getElementsByTagName('description')[0]?.textContent?.trim();

    const altModeEl =
      lineEl.getElementsByTagName('altitudeMode')[0] ||
      lineEl.getElementsByTagNameNS('*', 'altitudeMode')[0] ||
      placemarkEl?.getElementsByTagName('altitudeMode')[0];
    const altitudeMode = parseAltitudeMode(altModeEl?.textContent);

    const coordsEl = lineEl.getElementsByTagName('coordinates')[0];
    if (coordsEl?.textContent) {
      const coordsText = coordsEl.textContent.trim();
      // LineString coordinates are "lon,lat,alt lon,lat,alt ..."
      // Whitespace or newlines separate tuples
      const tupleStrings = coordsText.split(/\s+/).filter((s) => s.length > 0);
      const coords: Array<{ lon: number; lat: number; alt: number; time?: string }> = [];

      for (const tuple of tupleStrings) {
        const parts = tuple.split(',').map((p) => p.trim()).map(Number);
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          coords.push({
            lon: parts[0], // longitude
            lat: parts[1], // latitude
            alt: parts.length > 2 && !isNaN(parts[2]) ? parts[2] : 0,
          });
        }
      }

      if (coords.length >= 2) {
        rawTracks.push({
          id: `linestring-${index}-${Date.now()}`,
          name,
          description,
          altitudeMode,
          coords,
        });
      }
    }
  });

  if (rawTracks.length === 0) {
    throw new Error(
      'No valid flight routes found in KML. The file must contain at least two sequential coordinates in a <LineString> or <gx:Track>.'
    );
  }

  // Convert raw tracks to standardized FlightRoute objects
  const defaultSpeedMps = knotsToMps(options?.defaultSpeedKnots || 450);

  return rawTracks.map((raw) => processRawTrack(raw, defaultSpeedMps));
}

function parseAltitudeMode(modeStr?: string | null): AltitudeMode {
  if (!modeStr) return 'unknown';
  const clean = modeStr.trim().toLowerCase();
  if (clean.includes('relative')) return 'relativeToGround';
  if (clean.includes('clamp')) return 'clampToGround';
  if (clean.includes('absolute')) return 'absolute';
  return 'unknown';
}

function processRawTrack(raw: ParsedRawTrack, defaultSpeedMps: number): FlightRoute {
  const points: FlightPoint[] = [];
  let cumulativeDistance = 0;

  // Determine if track has real non-zero altitudes
  const nonZeroAltCount = raw.coords.filter((c) => Math.abs(c.alt) > 1).length;
  const hasRealAltitude =
    raw.altitudeMode !== 'clampToGround' &&
    nonZeroAltCount >= Math.max(2, Math.floor(raw.coords.length * 0.3));

  // Determine if valid timestamps exist
  const hasRecordedTimestamps =
    raw.coords.filter((c) => c.time && !isNaN(Date.parse(c.time))).length >=
    Math.floor(raw.coords.length * 0.8);

  const baseStartTimeMs = hasRecordedTimestamps && raw.coords[0].time
    ? Date.parse(raw.coords[0].time)
    : Date.now();

  for (let i = 0; i < raw.coords.length; i++) {
    const curr = raw.coords[i];
    let segDist = 0;
    if (i > 0) {
      const prev = raw.coords[i - 1];
      segDist = calculateHaversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);
      cumulativeDistance += segDist;
    }

    let secondsFromStart = 0;
    if (hasRecordedTimestamps && curr.time) {
      const currTimeMs = Date.parse(curr.time);
      secondsFromStart = Math.max(0, (currTimeMs - baseStartTimeMs) / 1000);
    } else {
      // Simulated timeline based on speed and cumulative distance
      secondsFromStart = cumulativeDistance / defaultSpeedMps;
    }

    const timeIsoNormalized = curr.time && !isNaN(Date.parse(curr.time))
      ? new Date(curr.time).toISOString()
      : new Date(baseStartTimeMs + secondsFromStart * 1000).toISOString();

    points.push({
      longitude: curr.lon,
      latitude: curr.lat,
      altitude: curr.alt,
      timeIso: timeIsoNormalized,
      secondsFromStart,
      distanceFromStartMeters: cumulativeDistance,
    });
  }

  // Calculate speeds, bearings, pitch, and bank roll
  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const prev = i > 0 ? points[i - 1] : null;
    const next = i < points.length - 1 ? points[i + 1] : null;

    // Heading calculation
    let heading = 0;
    if (next) {
      heading = calculateBearing(curr.latitude, curr.longitude, next.latitude, next.longitude);
    } else if (prev) {
      heading = calculateBearing(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
    }
    curr.headingDeg = heading;

    // Pitch calculation
    if (next) {
      const dDist = calculateHaversineDistance(curr.latitude, curr.longitude, next.latitude, next.longitude);
      const dAlt = next.altitude - curr.altitude;
      curr.pitchDeg = calculatePitch(dDist, dAlt);
    } else if (prev) {
      curr.pitchDeg = prev.pitchDeg || 0;
    }

    // Speed calculation
    if (next) {
      const dt = next.secondsFromStart - curr.secondsFromStart;
      const dd = next.distanceFromStartMeters - curr.distanceFromStartMeters;
      curr.speedMps = dt > 0 ? dd / dt : defaultSpeedMps;
    } else if (prev) {
      curr.speedMps = prev.speedMps || defaultSpeedMps;
    }

    // Roll / banking angle
    if (next && prev) {
      const bearingChange = (next.headingDeg || 0) - (prev.headingDeg || 0);
      const dt = next.secondsFromStart - prev.secondsFromStart;
      curr.rollDeg = calculateBankAngle(bearingChange, dt, curr.speedMps || defaultSpeedMps);
    } else {
      curr.rollDeg = 0;
    }
  }

  const totalDurationSeconds =
    points.length > 0 ? points[points.length - 1].secondsFromStart : 0;
  const altitudes = points.map((p) => p.altitude);
  const maxAltitudeMeters = Math.max(...altitudes, 0);
  const minAltitudeMeters = Math.min(...altitudes, 0);
  const avgSpeedMps =
    totalDurationSeconds > 0 ? cumulativeDistance / totalDurationSeconds : defaultSpeedMps;

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    altitudeMode: raw.altitudeMode,
    hasRecordedTimestamps,
    hasRealAltitude,
    isSimulatedAltitude: false,
    totalDistanceMeters: cumulativeDistance,
    totalDurationSeconds,
    maxAltitudeMeters,
    minAltitudeMeters,
    avgSpeedMps,
    points,
    startTimeIso: points[0]?.timeIso || new Date(baseStartTimeMs).toISOString(),
    stopTimeIso: points[points.length - 1]?.timeIso || new Date(baseStartTimeMs + totalDurationSeconds * 1000).toISOString(),
  };
}

/**
 * Creates a realistic simulated altitude profile for routes that have no altitude data.
 */
export function applySimulatedAltitude(
  route: FlightRoute,
  cruiseAltitudeMeters: number = 9500
): FlightRoute {
  const totalDist = route.totalDistanceMeters;
  const climbDistance = totalDist * 0.25; // 25% climb phase
  const descentStart = totalDist * 0.75;  // 25% descent phase

  const updatedPoints = route.points.map((pt) => {
    let alt = 50;
    const d = pt.distanceFromStartMeters;

    if (d < climbDistance) {
      // Smooth sinusoidal climb
      const progress = d / climbDistance;
      alt = 50 + (cruiseAltitudeMeters - 50) * Math.sin((progress * Math.PI) / 2);
    } else if (d >= climbDistance && d < descentStart) {
      // Cruise phase with slight realistic variation (±50m)
      const cruiseProgress = (d - climbDistance) / (descentStart - climbDistance);
      alt = cruiseAltitudeMeters + Math.sin(cruiseProgress * Math.PI * 4) * 50;
    } else {
      // Smooth descent
      const descentProgress = (d - descentStart) / (totalDist - descentStart);
      alt = cruiseAltitudeMeters - (cruiseAltitudeMeters - 80) * Math.sin((descentProgress * Math.PI) / 2);
    }

    return {
      ...pt,
      altitude: Math.max(30, Math.round(alt)),
    };
  });

  // Recompute pitch angles
  for (let i = 0; i < updatedPoints.length - 1; i++) {
    const curr = updatedPoints[i];
    const next = updatedPoints[i + 1];
    const dDist = next.distanceFromStartMeters - curr.distanceFromStartMeters;
    const dAlt = next.altitude - curr.altitude;
    curr.pitchDeg = calculatePitch(dDist, dAlt);
  }

  const altitudes = updatedPoints.map((p) => p.altitude);

  return {
    ...route,
    hasRealAltitude: false,
    isSimulatedAltitude: true,
    maxAltitudeMeters: Math.max(...altitudes),
    minAltitudeMeters: Math.min(...altitudes),
    points: updatedPoints,
  };
}
