import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import type { ModelSettings, FlightTelemetry, VisualizationSettings } from '../types/flight';
import type { CesiumFlightTrajectory } from '../services/flightAnimator';

interface AircraftEntityProps {
  viewer: Cesium.Viewer | null;
  trajectory: CesiumFlightTrajectory | null;
  telemetry: FlightTelemetry | null;
  modelSettings: ModelSettings;
  visSettings: VisualizationSettings;
  onModelLoadError?: (errMessage: string) => void;
  onEntityCreated?: (entity: Cesium.Entity) => void;
}

export const AircraftEntity = ({
  viewer,
  trajectory,
  telemetry,
  modelSettings,
  visSettings,
  onModelLoadError,
  onEntityCreated,
}: AircraftEntityProps) => {
  const aircraftEntityRef = useRef<Cesium.Entity | null>(null);
  const dropLineEntityRef = useRef<Cesium.Entity | null>(null);
  const primitivePartsRef = useRef<Cesium.Entity[]>([]);

  // Cleanup helper
  const removeEntities = () => {
    if (!viewer || viewer.isDestroyed()) return;

    if (aircraftEntityRef.current) {
      viewer.entities.remove(aircraftEntityRef.current);
      aircraftEntityRef.current = null;
    }
    if (dropLineEntityRef.current) {
      viewer.entities.remove(dropLineEntityRef.current);
      dropLineEntityRef.current = null;
    }
    for (const part of primitivePartsRef.current) {
      viewer.entities.remove(part);
    }
    primitivePartsRef.current = [];
  };

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !trajectory) {
      removeEntities();
      return;
    }

    removeEntities();

    // Determine model URI
    let modelUri = '/Cesium_Air.glb';
    if (modelSettings.modelType === 'cesiumDrone') {
      modelUri = '/Cesium_Drone.glb';
    } else if (modelSettings.modelType === 'custom' && modelSettings.customModelUrl) {
      modelUri = modelSettings.customModelUrl;
    }

    const isPrimitive = modelSettings.modelType === 'primitiveFallback';

    if (!isPrimitive) {
      try {
        const aircraft = viewer.entities.add({
          name: '3D Aircraft',
          position: trajectory.positionProperty,
          orientation: trajectory.orientationProperty,
          model: {
            uri: modelUri,
            minimumPixelSize: 64,
            maximumScale: 500,
            scale: modelSettings.scale || 1.0,
            runAnimations: true,
            shadows: Cesium.ShadowMode.ENABLED,
          },
        });

        aircraftEntityRef.current = aircraft;
        if (onEntityCreated) {
          onEntityCreated(aircraft);
        }
      } catch (err: unknown) {
        console.error('Failed to create 3D GLB model entity:', err);
        if (onModelLoadError) {
          onModelLoadError(
            `Unable to load 3D GLB aircraft model: ${err instanceof Error ? err.message : String(err)}. Falling back to procedural 3D aircraft.`
          );
        }
      }
    } else {
      // Create Procedural Genuine 3D Aircraft using Cesium Primitives
      // Main Fuselage (Cylinder)
      const fuselage = viewer.entities.add({
        name: 'Aircraft Fuselage',
        position: trajectory.positionProperty,
        orientation: trajectory.orientationProperty,
        cylinder: {
          length: 38.0 * (modelSettings.scale || 1.0),
          topRadius: 2.2 * (modelSettings.scale || 1.0),
          bottomRadius: 1.8 * (modelSettings.scale || 1.0),
          material: Cesium.Color.fromCssColorString('#f8fafc'),
        },
      });

      // Swept Wings (Box)
      const wings = viewer.entities.add({
        name: 'Aircraft Wings',
        position: trajectory.positionProperty,
        orientation: trajectory.orientationProperty,
        box: {
          dimensions: new Cesium.Cartesian3(
            34.0 * (modelSettings.scale || 1.0), // Wingspan
            5.0 * (modelSettings.scale || 1.0),  // Chord
            0.6 * (modelSettings.scale || 1.0)   // Thickness
          ),
          material: Cesium.Color.fromCssColorString('#38bdf8'),
        },
      });

      // Vertical Tail Fin (Box)
      const tailFin = viewer.entities.add({
        name: 'Aircraft Tail Fin',
        position: trajectory.positionProperty,
        orientation: trajectory.orientationProperty,
        box: {
          dimensions: new Cesium.Cartesian3(
            0.5 * (modelSettings.scale || 1.0),
            4.0 * (modelSettings.scale || 1.0),
            6.5 * (modelSettings.scale || 1.0)
          ),
          material: Cesium.Color.fromCssColorString('#0284c7'),
        },
      });

      primitivePartsRef.current = [fuselage, wings, tailFin];
      aircraftEntityRef.current = fuselage;
      if (onEntityCreated) {
        onEntityCreated(fuselage);
      }
    }

    // Dynamic Altitude Drop-Line to terrain
    if (visSettings.showDropLine) {
      const dropLineCallback = new Cesium.CallbackProperty(() => {
        if (!telemetry) return [];
        const pt = telemetry.currentPoint;
        const topCartesian = Cesium.Cartesian3.fromDegrees(
          pt.longitude,
          pt.latitude,
          pt.altitude * visSettings.verticalExaggeration
        );
        const groundCartesian = Cesium.Cartesian3.fromDegrees(
          pt.longitude,
          pt.latitude,
          0
        );
        return [topCartesian, groundCartesian];
      }, false);

      const dropLine = viewer.entities.add({
        name: 'Altitude Drop Indicator',
        polyline: {
          positions: dropLineCallback,
          width: 2,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#00f0ff').withAlpha(0.7),
            dashLength: 12,
          }),
        },
      });
      dropLineEntityRef.current = dropLine;
    }

    return () => {
      removeEntities();
    };
  }, [
    viewer,
    trajectory,
    modelSettings.modelType,
    modelSettings.customModelUrl,
    modelSettings.scale,
    visSettings.showDropLine,
    visSettings.verticalExaggeration,
  ]);

  return null;
};
