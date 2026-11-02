import React, { useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import type { FlightRoute, FlightTelemetry } from '../types/flight';
import { metersToFeet, metersToKm, metersToNauticalMiles } from '../services/geoUtils';

interface AltitudeChartProps {
  route: FlightRoute | null;
  telemetry: FlightTelemetry | null;
  onSeekFraction: (fraction: number) => void;
}

export const AltitudeChart: React.FC<AltitudeChartProps> = ({
  route,
  telemetry,
  onSeekFraction,
}) => {
  // Sample route points for the chart (up to 150 points for optimal performance and smooth curve)
  const chartData = useMemo(() => {
    if (!route || route.points.length === 0) return [];

    const totalPoints = route.points.length;
    const step = Math.max(1, Math.floor(totalPoints / 120));
    const data: Array<{
      fraction: number;
      distanceKm: number;
      distanceNm: number;
      altitudeM: number;
      altitudeFt: number;
      pointIndex: number;
    }> = [];

    for (let i = 0; i < totalPoints; i += step) {
      const pt = route.points[i];
      const frac = route.totalDistanceMeters > 0
        ? pt.distanceFromStartMeters / route.totalDistanceMeters
        : 0;
      data.push({
        fraction: frac,
        distanceKm: Math.round(metersToKm(pt.distanceFromStartMeters) * 10) / 10,
        distanceNm: Math.round(metersToNauticalMiles(pt.distanceFromStartMeters) * 10) / 10,
        altitudeM: Math.round(pt.altitude),
        altitudeFt: Math.round(metersToFeet(pt.altitude)),
        pointIndex: i,
      });
    }

    // Always include the final point
    const lastPt = route.points[totalPoints - 1];
    data.push({
      fraction: 1,
      distanceKm: Math.round(metersToKm(lastPt.distanceFromStartMeters) * 10) / 10,
      distanceNm: Math.round(metersToNauticalMiles(lastPt.distanceFromStartMeters) * 10) / 10,
      altitudeM: Math.round(lastPt.altitude),
      altitudeFt: Math.round(metersToFeet(lastPt.altitude)),
      pointIndex: totalPoints - 1,
    });

    return data;
  }, [route]);

  // Current aircraft position on the chart
  const currentDistanceKm = useMemo(() => {
    if (!telemetry) return 0;
    return Math.round(metersToKm(telemetry.distanceCoveredMeters) * 10) / 10;
  }, [telemetry]);

  const currentAltitudeM = useMemo(() => {
    if (!telemetry) return 0;
    return Math.round(telemetry.currentAltitudeMeters);
  }, [telemetry]);

  const handleClickOrHover = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      if (e && e.activePayload && e.activePayload.length > 0) {
        const item = e.activePayload[0].payload;
        if (item && typeof item.fraction === 'number') {
          onSeekFraction(item.fraction);
        }
      }
    },
    [onSeekFraction]
  );

  if (!route || chartData.length === 0) {
    return (
      <div className="altitude-chart-empty">
        <p>No altitude profile data loaded</p>
      </div>
    );
  }

  return (
    <div className="altitude-chart-container">
      <div className="altitude-chart-header">
        <div className="chart-title">
          <span className="hud-indicator active"></span>
          <span>ALTITUDE PROFILE (VS DISTANCE)</span>
        </div>
        <div className="chart-badges">
          <span className="hud-tag">
            MAX: {Math.round(route.maxAltitudeMeters)}m ({Math.round(metersToFeet(route.maxAltitudeMeters))}ft)
          </span>
          {route.isSimulatedAltitude && (
            <span className="hud-tag warning">SIMULATED ALT</span>
          )}
        </div>
      </div>

      <div className="chart-canvas-wrapper" style={{ width: '100%', height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            onClick={handleClickOrHover}
          >
            <defs>
              <linearGradient id="altitudeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.5} />
                <stop offset="60%" stopColor="#0077ff" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#0a192f" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="distanceKm"
              tickLine={false}
              axisLine={{ stroke: '#1e293b' }}
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={(val) => `${val}km`}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: '#1e293b' }}
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={(val) => `${val}m`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="chart-tooltip">
                      <div className="tooltip-line">
                        <span className="tooltip-label">Dist:</span>
                        <span className="tooltip-value">{data.distanceKm} km ({data.distanceNm} NM)</span>
                      </div>
                      <div className="tooltip-line">
                        <span className="tooltip-label">Alt:</span>
                        <span className="tooltip-value cyan">{data.altitudeM} m ({data.altitudeFt} ft)</span>
                      </div>
                      <div className="tooltip-hint">Click to scrub flight here</div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="altitudeM"
              stroke="#00f0ff"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#altitudeGradient)"
              isAnimationActive={false}
            />

            {/* Current aircraft position indicator line */}
            {telemetry && (
              <ReferenceLine
                x={currentDistanceKm}
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="3 3"
              />
            )}

            {/* Current aircraft position dot */}
            {telemetry && (
              <ReferenceDot
                x={currentDistanceKm}
                y={currentAltitudeM}
                r={4}
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth={2}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-footer-caption">
        Click or scrub anywhere on the graph to seek the flight to that position.
      </div>
    </div>
  );
};
