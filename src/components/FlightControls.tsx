import React, { useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Repeat,
  Sliders,
} from 'lucide-react';
import type { FlightRoute } from '../types/flight';
import { formatDuration } from '../services/geoUtils';

interface FlightControlsProps {
  route: FlightRoute | null;
  isPlaying: boolean;
  currentTimeSeconds: number;
  totalDurationSeconds: number;
  playbackSpeed: number;
  isLooping: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSeek: (seconds: number) => void;
  onChangeSpeed: (speed: number) => void;
  onToggleLoop: () => void;
  onOpenSpeedConfig: () => void;
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 5, 10, 20];

export const FlightControls: React.FC<FlightControlsProps> = ({
  route,
  isPlaying,
  currentTimeSeconds,
  totalDurationSeconds,
  playbackSpeed,
  isLooping,
  onTogglePlay,
  onRestart,
  onSeek,
  onChangeSpeed,
  onToggleLoop,
  onOpenSpeedConfig,
}) => {
  const fraction =
    totalDurationSeconds > 0 ? Math.min(1, Math.max(0, currentTimeSeconds / totalDurationSeconds)) : 0;

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      onSeek(val * totalDurationSeconds);
    },
    [onSeek, totalDurationSeconds]
  );

  const disabled = !route || totalDurationSeconds <= 0;

  return (
    <div className="flight-controls-bar">
      {/* Playback Buttons Group */}
      <div className="controls-left">
        <button
          className="control-btn restart"
          onClick={onRestart}
          disabled={disabled}
          title="Restart Flight (Home)"
        >
          <RotateCcw size={16} />
        </button>

        <button
          className={`control-btn play-pause ${isPlaying ? 'playing' : ''}`}
          onClick={onTogglePlay}
          disabled={disabled}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="icon-play-offset" />}
        </button>

        <button
          className={`control-btn loop ${isLooping ? 'active' : ''}`}
          onClick={onToggleLoop}
          disabled={disabled}
          title={isLooping ? 'Looping Enabled' : 'Loop Flight'}
        >
          <Repeat size={15} />
        </button>
      </div>

      {/* Center Timeline Scrubber */}
      <div className="controls-center">
        <span className="time-display current">{formatDuration(currentTimeSeconds)}</span>

        <div className="scrubber-wrapper">
          <input
            type="range"
            min="0"
            max="1"
            step="0.0005"
            value={fraction}
            onChange={handleSliderChange}
            disabled={disabled}
            className="timeline-slider"
            style={{
              background: `linear-gradient(to right, #00f0ff 0%, #00f0ff ${
                fraction * 100
              }%, #1e293b ${fraction * 100}%, #1e293b 100%)`,
            }}
          />
        </div>

        <span className="time-display total">{formatDuration(totalDurationSeconds)}</span>
      </div>

      {/* Right Speed & Settings Group */}
      <div className="controls-right">
        {/* Playback Speed Selector */}
        <div className="speed-selector">
          <FastForward size={14} className="speed-icon" />
          <div className="speed-buttons">
            {SPEED_OPTIONS.map((speed) => (
              <button
                key={speed}
                className={`speed-pill ${playbackSpeed === speed ? 'active' : ''}`}
                onClick={() => onChangeSpeed(speed)}
                disabled={disabled}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Speed / Sim Config button */}
        <button
          className="control-btn config"
          onClick={onOpenSpeedConfig}
          title="Flight Speed & Simulation Config"
        >
          <Sliders size={16} />
        </button>
      </div>
    </div>
  );
};
