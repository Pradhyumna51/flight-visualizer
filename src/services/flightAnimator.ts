import * as Cesium from 'cesium';
import type {
  FlightPoint,
  FlightRoute,
  FlightTelemetry,
  ModelSettings,
  VisualizationSettings,
} from '../types/flight';
import {
  calculateBearing,
  calculatePitch,
  mpsToKnots,
  mpsToKmh,
  metersToFeet,
} from './geoUtils';

export interface CesiumFlightTrajectory {
  positionProperty: Cesium.SampledPositionProperty;
  orientationProperty: Cesium.SampledProperty;
  startJulianDate: Cesium.JulianDate;
  stopJulianDate: Cesium.JulianDate;
  cartesianCoordinates: Cesium.Cartesian3[];
}

/**
 * Builds Cesium SampledPositionProperty and SampledProperty (Quaternion)
 * from a FlightRoute and user settings.
 */
export function buildCesiumTrajectory(
  route: FlightRoute,
  modelSettings: ModelSettings,
  visSettings: VisualizationSettings
): CesiumFlightTrajectory {
  const startJulianDate = Cesium.JulianDate.fromIso8601(route.startTimeIso);
  const stopJulianDate = Cesium.JulianDate.fromIso8601(route.stopTimeIso);

  const positionProperty = new Cesium.SampledPositionProperty();

  // Configure interpolation
  if (visSettings.interpolationAlgorithm === 'hermite') {
    positionProperty.setInterpolationOptions({
      interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
      interpolationDegree: 2,
    });
  } else if (visSettings.interpolationAlgorithm === 'lagrange') {
    positionProperty.setInterpolationOptions({
      interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
      interpolationDegree: 2,
    });
  } else {
    positionProperty.setInterpolationOptions({
      interpolationAlgorithm: Cesium.LinearApproximation,
      interpolationDegree: 1,
    });
  }

  positionProperty.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
  positionProperty.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;

  const orientationProperty = new Cesium.SampledProperty(Cesium.Quaternion);
  orientationProperty.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
  orientationProperty.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;

  const cartesianCoordinates: Cesium.Cartesian3[] = [];

  // Model offset rotation quaternion
  const headingOffsetRad = Cesium.Math.toRadians(modelSettings.headingOffsetDeg);
  const pitchOffsetRad = Cesium.Math.toRadians(modelSettings.pitchOffsetDeg);
  const rollOffsetRad = Cesium.Math.toRadians(modelSettings.rollOffsetDeg);
  const modelOffsetQuat = Cesium.Quaternion.fromHeadingPitchRoll(
    new Cesium.HeadingPitchRoll(headingOffsetRad, pitchOffsetRad, rollOffsetRad)
  );

  for (let i = 0; i < route.points.length; i++) {
    const pt = route.points[i];
    const time = Cesium.JulianDate.addSeconds(
      startJulianDate,
      pt.secondsFromStart,
      new Cesium.JulianDate()
    );

    // Apply vertical exaggeration to altitude for dramatic visual feedback
    const displayAltitude = pt.altitude * visSettings.verticalExaggeration;

    const cartesian = Cesium.Cartesian3.fromDegrees(
      pt.longitude,
      pt.latitude,
      displayAltitude
    );

    cartesianCoordinates.push(cartesian);
    positionProperty.addSample(time, cartesian);

    // Calculate orientation using local East-North-Up (ENU) frame
    const headingRad = Cesium.Math.toRadians(pt.headingDeg || 0);
    const pitchRad = Cesium.Math.toRadians(pt.pitchDeg || 0);
    const rollRad = Cesium.Math.toRadians(pt.rollDeg || 0);

    const hpr = new Cesium.HeadingPitchRoll(headingRad, pitchRad, rollRad);
    const baseQuat = Cesium.Transforms.headingPitchRollQuaternion(
      cartesian,
      hpr,
      Cesium.Ellipsoid.WGS84,
      Cesium.Transforms.eastNorthUpToFixedFrame
    );

    // Combine base aircraft orientation with model adjustment quaternion
    const finalQuat = Cesium.Quaternion.multiply(
      baseQuat,
      modelOffsetQuat,
      new Cesium.Quaternion()
    );

    orientationProperty.addSample(time, finalQuat);
  }

  return {
    positionProperty,
    orientationProperty,
    startJulianDate,
    stopJulianDate,
    cartesianCoordinates,
  };
}

/**
 * Calculates current telemetry snapshot for a given elapsed time along the route.
 */
export function getTelemetryAtTime(
  route: FlightRoute,
  elapsedSeconds: number
): FlightTelemetry {
  const points = route.points;
  if (!points || points.length === 0) {
    throw new Error('No flight points available');
  }

  const clampedElapsed = Math.max(0, Math.min(elapsedSeconds, route.totalDurationSeconds));
  const fraction = route.totalDurationSeconds > 0 ? clampedElapsed / route.totalDurationSeconds : 0;

  // Find bounding points
  let idx = 0;
  while (idx < points.length - 1 && points[idx + 1].secondsFromStart < clampedElapsed) {
    idx++;
  }

  const p1 = points[idx];
  const p2 = points[Math.min(idx + 1, points.length - 1)];

  let currentLat = p1.latitude;
  let currentLon = p1.longitude;
  let currentAlt = p1.altitude;
  let currentDist = p1.distanceFromStartMeters;
  let currentSpeedMps = p1.speedMps || route.avgSpeedMps;
  let currentHeading = p1.headingDeg || 0;
  let currentPitch = p1.pitchDeg || 0;
  let currentRoll = p1.rollDeg || 0;
  let verticalSpeedMps = 0;

  if (p2 !== p1 && p2.secondsFromStart > p1.secondsFromStart) {
    const segmentDuration = p2.secondsFromStart - p1.secondsFromStart;
    const segmentElapsed = clampedElapsed - p1.secondsFromStart;
    const t = Math.max(0, Math.min(1, segmentElapsed / segmentDuration));

    currentLat = p1.latitude + (p2.latitude - p1.latitude) * t;
    currentLon = p1.longitude + (p2.longitude - p1.longitude) * t;
    currentAlt = p1.altitude + (p2.altitude - p1.altitude) * t;
    currentDist = p1.distanceFromStartMeters + (p2.distanceFromStartMeters - p1.distanceFromStartMeters) * t;
    currentHeading = calculateBearing(p1.latitude, p1.longitude, p2.latitude, p2.longitude);

    const dDist = p2.distanceFromStartMeters - p1.distanceFromStartMeters;
    const dAlt = p2.altitude - p1.altitude;
    currentPitch = calculatePitch(dDist, dAlt);
    currentRoll = (p1.rollDeg || 0) + ((p2.rollDeg || 0) - (p1.rollDeg || 0)) * t;

    currentSpeedMps = segmentDuration > 0 ? dDist / segmentDuration : route.avgSpeedMps;
    verticalSpeedMps = segmentDuration > 0 ? dAlt / segmentDuration : 0;
  }

  const verticalSpeedFpm = metersToFeet(verticalSpeedMps) * 60;
  const currentSpeedKnots = mpsToKnots(currentSpeedMps);
  const currentSpeedKmh = mpsToKmh(currentSpeedMps);

  const startMs = Date.parse(route.startTimeIso);
  const currentIso = new Date(startMs + clampedElapsed * 1000).toISOString();

  const currentPoint: FlightPoint = {
    latitude: currentLat,
    longitude: currentLon,
    altitude: currentAlt,
    secondsFromStart: clampedElapsed,
    distanceFromStartMeters: currentDist,
    headingDeg: currentHeading,
    pitchDeg: currentPitch,
    rollDeg: currentRoll,
    speedMps: currentSpeedMps,
    timeIso: currentIso,
  };

  return {
    currentTimeIso: currentIso,
    elapsedSeconds: clampedElapsed,
    totalDurationSeconds: route.totalDurationSeconds,
    fraction,
    currentPoint,
    currentSpeedKnots,
    currentSpeedKmh,
    currentAltitudeMeters: currentAlt,
    currentAltitudeFeet: metersToFeet(currentAlt),
    verticalSpeedFpm,
    verticalSpeedMps,
    currentHeadingDeg: currentHeading,
    currentPitchDeg: currentPitch,
    currentRollDeg: currentRoll,
    distanceCoveredMeters: currentDist,
    distanceRemainingMeters: Math.max(0, route.totalDistanceMeters - currentDist),
  };
}
