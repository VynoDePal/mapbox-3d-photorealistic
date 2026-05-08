import type { LightPreset, MapState } from '@/types/mapbox.ts';

// Hash format: #zoom/lat/lng/pitch/bearing/preset
// Compatible with Mapbox GL conventions (zoom first), preset is our addition.
//
// Floats are rounded to keep URLs short and avoid jitter from sub-pixel moveend events.

const PRESET_VALUES: readonly LightPreset[] = ['dawn', 'day', 'dusk', 'night'] as const;

function isPreset(v: string): v is LightPreset {
  return (PRESET_VALUES as readonly string[]).includes(v);
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function serializeHash(state: MapState): string {
  return [
    round(state.zoom, 2),
    round(state.lat, 5),
    round(state.lng, 5),
    round(state.pitch, 1),
    round(state.bearing, 1),
    state.preset,
  ].join('/');
}

export function parseHash(hash: string): MapState | null {
  const trimmed = hash.replace(/^#/, '').trim();
  if (!trimmed) return null;
  const parts = trimmed.split('/');
  if (parts.length !== 6) return null;
  const [zoomStr, latStr, lngStr, pitchStr, bearingStr, presetStr] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  const zoom = Number(zoomStr);
  const lat = Number(latStr);
  const lng = Number(lngStr);
  const pitch = Number(pitchStr);
  const bearing = Number(bearingStr);
  if (
    !Number.isFinite(zoom) ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(pitch) ||
    !Number.isFinite(bearing)
  ) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (zoom < 0 || zoom > 24) return null;
  if (pitch < 0 || pitch > 85) return null;
  if (!isPreset(presetStr)) return null;
  return { zoom, lat, lng, pitch, bearing, preset: presetStr };
}

export function readHashState(): MapState | null {
  return parseHash(window.location.hash);
}

// Trimmed mapbox-gl Map surface — keeps url-state independent of the full type.
interface MapWithState {
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  getPitch(): number;
  getBearing(): number;
  on(event: 'moveend', listener: () => void): void;
  off(event: 'moveend', listener: () => void): void;
}

export interface BindOpts {
  getPreset: () => LightPreset;
  debounceMs?: number;
}

// Push current map state into location.hash. Listens to moveend + the
// 'mapbox3d:preset-change' custom event dispatched by light-preset.ts.
export function bindToMap(map: MapWithState, opts: BindOpts): () => void {
  const debounceMs = opts.debounceMs ?? 500;
  let timer: number | undefined;

  const update = (): void => {
    const c = map.getCenter();
    const state: MapState = {
      lng: c.lng,
      lat: c.lat,
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
      preset: opts.getPreset(),
    };
    const hash = '#' + serializeHash(state);
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash);
    }
  };

  const schedule = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = window.setTimeout(update, debounceMs);
  };

  map.on('moveend', schedule);
  window.addEventListener('mapbox3d:preset-change', schedule);

  return () => {
    if (timer !== undefined) clearTimeout(timer);
    map.off('moveend', schedule);
    window.removeEventListener('mapbox3d:preset-change', schedule);
  };
}
