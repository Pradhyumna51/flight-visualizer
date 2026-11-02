import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import type { FlightRoute, FlightTelemetry, VisualizationSettings } from '../types/flight';
import { formatAltitude } from '../services/geoUtils';

interface FlightPathRendererProps {
  viewer: Cesium.Viewer | null;
  route: FlightRoute | null;
  telemetry: FlightTelemetry | null;
  visSettings: VisualizationSettings;
}

export const FlightPathRenderer = ({
  viewer,
  route,
  telemetry,
  visSettings,
}: FlightPathRendererProps) => {
  const fullPathEntityRef = useRef<Cesium.Entity | null>(null);
  const completedPathEntityRef = useRef<Cesium.Entity | null>(null);
  const markerEntitiesRef = useRef<Cesium.Entity[]>([]);

  // Cleanup existing entities
  const cleanup = () => {
    if (!viewer || viewer.isDestroyed()) return;

    if (fullPathEntityRef.current) {
      viewer.entities.remove(fullPathEntityRef.current);
      fullPathEntityRef.current = null;
    }
    if (completedPathEntityRef.current) {
      viewer.entities.remove(completedPathEntityRef.current);
      completedPathEntityRef.current = null;
    }
    for (const marker of markerEntitiesRef.current) {
      viewer.entities.remove(marker);
    }
    markerEntitiesRef.current = [];
  };

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !route || route.points.length < 2) {
      cleanup();
      return;
    }

    cleanup();

    const exaggeration = visSettings.verticalExaggeration || 1.0;

    // Full 3D path coordinates
    const allCartesians = route.points.map((p) =>
      Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, p.altitude * exaggeration)
    );

    // 1. Full/Remaining Flight Route Polyline (Translucent dashed cyan/slate)
    const fullRoute = viewer.entities.add({
      name: 'Flight Path (Planned)',
      polyline: {
        positions: allCartesians,
        width: 3,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString(visSettings.pathTrailColor || '#38bdf8').withAlpha(0.6),
          gapColor: Cesium.Color.BLACK.withAlpha(0.2),
          dashLength: 16,
        }),
      },
    });
    fullPathEntityRef.current = fullRoute;

    // 2. Dynamic Completed Flight Segment (Bright Solid Glow Cyan)
    const completedCallback = new Cesium.CallbackProperty(() => {
      if (!telemetry || !route.points.length) return [];
      const currentDist = telemetry.distanceCoveredMeters;

      const completedCartesians: Cesium.Cartesian3[] = [];
      for (const pt of route.points) {
        if (pt.distanceFromStartMeters <= currentDist) {
          completedCartesians.push(
            Cesium.Cartesian3.fromDegrees(pt.longitude, pt.latitude, pt.altitude * exaggeration)
          );
        } else {
          break;
        }
      }

      // Add current interpolated aircraft point at end
      completedCartesians.push(
        Cesium.Cartesian3.fromDegrees(
          telemetry.currentPoint.longitude,
          telemetry.currentPoint.latitude,
          telemetry.currentPoint.altitude * exaggeration
        )
      );

      return completedCartesians.length >= 2 ? completedCartesians : [];
    }, false);

    const completedRoute = viewer.entities.add({
      name: 'Flight Path (Completed)',
      polyline: {
        positions: completedCallback,
        width: 4,
        material: Cesium.Color.fromCssColorString(visSettings.pathLeadColor || '#00f0ff'),
      },
    });
    completedPathEntityRef.current = completedRoute;

    // 3. Start Point Marker (Departure)
    const startPt = route.points[0];
    const startAltFmt = formatAltitude(startPt.altitude);
    const startEntity = viewer.entities.add({
      name: 'Origin / Departure',
      position: Cesium.Cartesian3.fromDegrees(
        startPt.longitude,
        startPt.latitude,
        startPt.altitude * exaggeration
      ),
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString('#10b981'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: visSettings.showLabels
        ? {
            text: `DEPARTURE\nAlt: ${startAltFmt.m} / ${startAltFmt.ft}`,
            font: '11px monospace',
            fillColor: Cesium.Color.fromCssColorString('#10b981'),
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.75),
            pixelOffset: new Cesium.Cartesian2(0, -32),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000),
          }
        : undefined,
    });
    markerEntitiesRef.current.push(startEntity);

    // 4. End Point Marker (Destination)
    const endPt = route.points[route.points.length - 1];
    const endAltFmt = formatAltitude(endPt.altitude);
    const endEntity = viewer.entities.add({
      name: 'Destination / Arrival',
      position: Cesium.Cartesian3.fromDegrees(
        endPt.longitude,
        endPt.latitude,
        endPt.altitude * exaggeration
      ),
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString('#ef4444'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: visSettings.showLabels
        ? {
            text: `ARRIVAL\nAlt: ${endAltFmt.m} / ${endAltFmt.ft}`,
            font: '11px monospace',
            fillColor: Cesium.Color.fromCssColorString('#ef4444'),
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.75),
            pixelOffset: new Cesium.Cartesian2(0, -32),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000),
          }
        : undefined,
    });
    markerEntitiesRef.current.push(endEntity);

    // 5. Waypoints if enabled
    if (visSettings.showWaypoints && route.points.length > 2) {
      const step = Math.max(2, Math.floor(route.points.length / 10));
      for (let i = step; i < route.points.length - 1; i += step) {
        const wp = route.points[i];
        const wpAltFmt = formatAltitude(wp.altitude);
        const wpEntity = viewer.entities.add({
          name: `Waypoint ${i}`,
          position: Cesium.Cartesian3.fromDegrees(
            wp.longitude,
            wp.latitude,
            wp.altitude * exaggeration
          ),
          point: {
            pixelSize: 6,
            color: Cesium.Color.fromCssColorString('#f59e0b'),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
          },
          label: visSettings.showLabels
            ? {
                text: `WP${i}\n${wpAltFmt.m}`,
                font: '9px monospace',
                fillColor: Cesium.Color.fromCssColorString('#f59e0b'),
                showBackground: true,
                backgroundColor: Cesium.Color.BLACK.withAlpha(0.6),
                pixelOffset: new Cesium.Cartesian2(0, -20),
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1500000),
              }
            : undefined,
        });
        markerEntitiesRef.current.push(wpEntity);
      }
    }

    return () => {
      cleanup();
    };
  }, [
    viewer,
    route,
    visSettings.verticalExaggeration,
    visSettings.pathLeadColor,
    visSettings.pathTrailColor,
    visSettings.showLabels,
    visSettings.showWaypoints,
  ]);

  return null;
};
