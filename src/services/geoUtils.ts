// Geodesic calculations and unit conversions for flight simulation

const EARTH_RADIUS_METERS = 6371008.8;

/**
 * Calculates great-circle distance between two coordinates in meters using the Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(rLat1) * Math.cos(rLat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates initial true bearing (heading) from point 1 to point 2 in degrees (0 to 360)
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const bearingRad = Math.atan2(y, x);
  const bearingDeg = (bearingRad * 180) / Math.PI;
  return (bearingDeg + 360) % 360;
}

/**
 * Calculates pitch angle in degrees from horizontal distance and altitude change.
 * Positive pitch is climbing (+), negative pitch is descending (-).
 */
export function calculatePitch(horizontalDistanceMeters: number, altitudeDeltaMeters: number): number {
  if (horizontalDistanceMeters <= 0.001) {
    return altitudeDeltaMeters > 0 ? 90 : altitudeDeltaMeters < 0 ? -90 : 0;
  }
  const pitchRad = Math.atan2(altitudeDeltaMeters, horizontalDistanceMeters);
  return (pitchRad * 180) / Math.PI;
}

/**
 * Calculates standard aircraft banking roll angle in degrees based on yaw rate (heading turn rate).
 * Left turn (negative turn rate) results in left bank; right turn in right bank.
 * Clamped to typical civil aviation bank limits (-30 to +30 degrees).
 */
export function calculateBankAngle(
  deltaBearingDeg: number,
  deltaTimeSeconds: number,
  speedMps: number
): number {
  if (deltaTimeSeconds <= 0.1 || speedMps < 5) return 0;
  
  // Normalize delta bearing to -180 .. +180
  let diff = (deltaBearingDeg + 540) % 360 - 180;
  
  const turnRateDegPerSec = diff / deltaTimeSeconds;
  
  // Coordinated turn equation: tan(bank) = (V * omega) / g
  const g = 9.80665;
  const omegaRadPerSec = (turnRateDegPerSec * Math.PI) / 180;
  const tanBank = (speedMps * omegaRadPerSec) / g;
  
  let bankDeg = (Math.atan(tanBank) * 180) / Math.PI;
  
  // Clamp bank angle to ±35 degrees for realistic aircraft visualization
  return Math.max(-35, Math.min(35, bankDeg));
}

// Unit conversions
export const metersToFeet = (m: number) => m * 3.2808399;
export const feetToMeters = (ft: number) => ft / 3.2808399;
export const mpsToKnots = (mps: number) => mps * 1.943844;
export const knotsToMps = (kts: number) => kts / 1.943844;
export const mpsToKmh = (mps: number) => mps * 3.6;
export const kmhToMps = (kmh: number) => kmh / 3.6;
export const metersToKm = (m: number) => m / 1000;
export const metersToNauticalMiles = (m: number) => m / 1852;

export function formatDuration(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatAltitude(meters: number): { m: string; ft: string } {
  const ft = metersToFeet(meters);
  return {
    m: `${Math.round(meters).toLocaleString()} m`,
    ft: `${Math.round(ft).toLocaleString()} ft`,
  };
}

export function formatDistance(meters: number): { km: string; nm: string } {
  const km = metersToKm(meters);
  const nm = metersToNauticalMiles(meters);
  return {
    km: `${km.toFixed(1)} km`,
    nm: `${nm.toFixed(1)} NM`,
  };
}

export function formatSpeed(mps: number): { knots: string; kmh: string } {
  const kts = mpsToKnots(mps);
  const kmh = mpsToKmh(mps);
  return {
    knots: `${Math.round(kts)} kts`,
    kmh: `${Math.round(kmh)} km/h`,
  };
}

export function formatCoordinate(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lon).toFixed(4)}°${lonDir}`;
}

export function getCompassHeading(degrees: number): string {
  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((degrees % 360) / 22.5) % 16;
  return `${Math.round(degrees).toString().padStart(3, '0')}° ${cardinals[index]}`;
}

