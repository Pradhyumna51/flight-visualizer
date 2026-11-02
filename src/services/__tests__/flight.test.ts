import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateHaversineDistance,
  calculateBearing,
  calculatePitch,
  calculateBankAngle,
  metersToFeet,
  feetToMeters,
  mpsToKnots,
} from '../geoUtils';
import { parseKML, applySimulatedAltitude } from '../kmlParser';
import { buildCesiumTrajectory, getTelemetryAtTime } from '../flightAnimator';
import type { ModelSettings, VisualizationSettings } from '../../types/flight';

const defaultModelSettings: ModelSettings = {
  modelType: 'cesiumAir',
  scale: 1.0,
  headingOffsetDeg: 0,
  pitchOffsetDeg: 0,
  rollOffsetDeg: 0,
};

const defaultVisSettings: VisualizationSettings = {
  verticalExaggeration: 1.0,
  pathLeadColor: '#00f0ff',
  pathTrailColor: '#38bdf8',
  showDropLine: true,
  showWaypoints: true,
  showLabels: true,
  showTerrain: false,
  simulationCruiseAltitudeMeters: 9500,
  simulationSpeedKnots: 450,
  cesiumIonToken: '',
  interpolationAlgorithm: 'hermite',
};

describe('Geodesic & Aviation Math Utilities', () => {
  it('correctly calculates Haversine distance between SFO and LAS', () => {
    // SFO: 37.619N, -122.375W | LAS: 36.084N, -115.152W
    const distMeters = calculateHaversineDistance(37.619, -122.375, 36.084, -115.152);
    const distKm = distMeters / 1000;
    // Expected distance is approximately 665 km
    expect(distKm).toBeGreaterThan(650);
    expect(distKm).toBeLessThan(680);
  });

  it('correctly calculates initial bearing from SFO to LAS', () => {
    const bearing = calculateBearing(37.619, -122.375, 36.084, -115.152);
    // Heading should be East-Southeast (~100 degrees)
    expect(bearing).toBeGreaterThan(90);
    expect(bearing).toBeLessThan(120);
  });

  it('calculates accurate climb and descent pitch angles', () => {
    // 1000m horizontal distance, +100m climb
    const climbPitch = calculatePitch(1000, 100);
    expect(climbPitch).toBeCloseTo(5.71, 1);

    // 1000m horizontal distance, -150m descent
    const descentPitch = calculatePitch(1000, -150);
    expect(descentPitch).toBeCloseTo(-8.53, 1);

    // Level flight
    const levelPitch = calculatePitch(1000, 0);
    expect(levelPitch).toBe(0);
  });

  it('calculates banked turn angle correctly and clamps within civil aviation limits', () => {
    const bankRight = calculateBankAngle(15, 5, 100); // 15 deg in 5s at 100m/s
    expect(bankRight).toBeGreaterThan(0);
    expect(bankRight).toBeLessThanOrEqual(35);

    const bankLeft = calculateBankAngle(-20, 5, 100);
    expect(bankLeft).toBeLessThan(0);
    expect(bankLeft).toBeGreaterThanOrEqual(-35);
  });

  it('accurately converts units (meters to feet, knots to mps)', () => {
    expect(metersToFeet(10000)).toBeCloseTo(32808.4, 0);
    expect(feetToMeters(32808.4)).toBeCloseTo(10000, 0);
    expect(mpsToKnots(100)).toBeCloseTo(194.38, 1);
  });
});

describe('Acceptance Criteria & KML Route Processing', () => {
  it('TEST 1: KML with altitude data preserves climb, cruise, and descent profile', () => {
    const kmlPath = path.resolve('public/samples/flight-with-altitude.kml');
    const kmlText = fs.readFileSync(kmlPath, 'utf-8');
    const routes = parseKML(kmlText);

    expect(routes.length).toBe(1);
    const route = routes[0];

    // Coordinates MUST NOT be reversed: Lon is negative (-122), Lat is positive (+37)
    expect(route.points[0].longitude).toBeCloseTo(-122.375, 2);
    expect(route.points[0].latitude).toBeCloseTo(37.619, 2);

    // Altitude MUST be preserved (takeoff ~5m, cruise >10,000m)
    expect(route.hasRealAltitude).toBe(true);
    expect(route.maxAltitudeMeters).toBeGreaterThanOrEqual(10400);
    expect(route.points[0].altitude).toBe(5);

    // Visibly climbs then descends
    const climbPt = route.points[5];
    const cruisePt = route.points[10];
    const descentPt = route.points[route.points.length - 2];

    expect(cruisePt.altitude).toBeGreaterThan(climbPt.altitude);
    expect(cruisePt.altitude).toBeGreaterThan(descentPt.altitude);
    expect(climbPt.pitchDeg).toBeGreaterThan(0); // Climbing
    expect(descentPt.pitchDeg).toBeLessThan(0);  // Descending
  });

  it('TEST 2: Long-distance transatlantic flight follows complete route without jumping or reversing', () => {
    const kmlPath = path.resolve('public/samples/flight-long-distance.kml');
    const kmlText = fs.readFileSync(kmlPath, 'utf-8');
    const routes = parseKML(kmlText);
    const route = routes[0];

    expect(route.points.length).toBe(25);
    expect(route.totalDistanceMeters / 1000).toBeGreaterThan(5000); // > 5000 km

    // Verify distance monotonically increases along the entire trajectory
    for (let i = 1; i < route.points.length; i++) {
      expect(route.points[i].distanceFromStartMeters).toBeGreaterThan(
        route.points[i - 1].distanceFromStartMeters
      );
    }
  });

  it('TEST 3: Trajectory interpolation works smoothly across speeds without distorting route', () => {
    const kmlPath = path.resolve('public/samples/flight-with-altitude.kml');
    const kmlText = fs.readFileSync(kmlPath, 'utf-8');
    const route = parseKML(kmlText)[0];

    const traj = buildCesiumTrajectory(route, defaultModelSettings, defaultVisSettings);
    expect(traj.positionProperty).toBeDefined();
    expect(traj.orientationProperty).toBeDefined();

    // Telemetry at 25% and 75%
    const t25 = getTelemetryAtTime(route, route.totalDurationSeconds * 0.25);
    const t75 = getTelemetryAtTime(route, route.totalDurationSeconds * 0.75);

    expect(t25.distanceCoveredMeters).toBeLessThan(t75.distanceCoveredMeters);
    expect(t25.currentAltitudeMeters).toBeGreaterThan(0);
    expect(t75.currentAltitudeMeters).toBeGreaterThan(0);
  });

  it('TEST 5: Timeline scrubbing immediately calculates accurate telemetry and position', () => {
    const kmlPath = path.resolve('public/samples/flight-with-altitude.kml');
    const kmlText = fs.readFileSync(kmlPath, 'utf-8');
    const route = parseKML(kmlText)[0];

    const targetTime = route.totalDurationSeconds * 0.5; // Mid flight
    const telem = getTelemetryAtTime(route, targetTime);

    expect(telem.elapsedSeconds).toBeCloseTo(targetTime, 1);
    expect(telem.fraction).toBeCloseTo(0.5, 2);
    expect(telem.currentAltitudeMeters).toBeGreaterThan(8000);
    expect(telem.currentHeadingDeg).toBeGreaterThan(0);
  });

  it('TEST 6: KML without altitude data is flagged and can apply realistic simulated altitude', () => {
    const kmlPath = path.resolve('public/samples/flight-no-altitude.kml');
    const kmlText = fs.readFileSync(kmlPath, 'utf-8');
    const routes = parseKML(kmlText);
    const flatRoute = routes[0];

    // Initial state: hasRealAltitude must be FALSE
    expect(flatRoute.hasRealAltitude).toBe(false);
    expect(flatRoute.altitudeMode).toBe('clampToGround');
    expect(flatRoute.maxAltitudeMeters).toBe(0);

    // Apply simulated altitude (FL310 / 9500m)
    const simulated = applySimulatedAltitude(flatRoute, 9500);
    expect(simulated.isSimulatedAltitude).toBe(true);
    expect(simulated.maxAltitudeMeters).toBeGreaterThanOrEqual(9400);

    // Verify climb, cruise, and descent phases in simulated profile
    const climbPt = simulated.points[1];
    const cruisePt = simulated.points[5];
    const descentPt = simulated.points[simulated.points.length - 2];

    expect(cruisePt.altitude).toBeGreaterThan(climbPt.altitude);
    expect(cruisePt.altitude).toBeGreaterThan(descentPt.altitude);
    expect(climbPt.pitchDeg).toBeGreaterThan(0);
    expect(descentPt.pitchDeg).toBeLessThan(0);
  });

  it('TEST 7: Supports gx:Track format with original GPS recorded timestamps', () => {
    const kmlPath = path.resolve('public/samples/flight-with-timestamps.kml');
    const kmlText = fs.readFileSync(kmlPath, 'utf-8');
    const routes = parseKML(kmlText);
    const route = routes[0];

    expect(route.hasRecordedTimestamps).toBe(true);
    expect(route.startTimeIso).toBe('2026-06-01T10:00:00.000Z');
    expect(route.stopTimeIso).toBe('2026-06-01T11:00:00.000Z');
    expect(route.totalDurationSeconds).toBe(3600); // 1 hour
  });

  it('Supports Multi-Track/Multi-Placemark KML files', () => {
    const kmlPath = path.resolve('public/samples/flight-multi-track.kml');
    const kmlText = fs.readFileSync(kmlPath, 'utf-8');
    const routes = parseKML(kmlText);

    expect(routes.length).toBe(2);
    expect(routes[0].name).toContain('Leg 1');
    expect(routes[1].name).toContain('Leg 2');
  });
});

