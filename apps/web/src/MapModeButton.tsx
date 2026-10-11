'use client';
import { Layers, Map } from 'lucide-react';
import type { MapMode } from '@estate-atlas/shared/map';
export default function MapModeButton({
  mode,
  disabled,
  onToggle,
}: {
  mode: MapMode;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="map-mode-button"
      disabled={disabled}
      aria-pressed={mode === 'detail'}
      onClick={onToggle}
    >
      {mode === 'simple' ? (
        <Layers size={16} aria-hidden="true" />
      ) : (
        <Map size={16} aria-hidden="true" />
      )}
      <span>{mode === 'simple' ? 'Details anzeigen' : 'Vereinfacht anzeigen'}</span>
    </button>
  );
}
