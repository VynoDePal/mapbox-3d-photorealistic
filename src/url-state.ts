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

export type HashParseError = 'invalidPreset' | 'malformed' | 'outOfRange';

export interface HashParseResult {
  state: MapState | null;
  errors: HashParseError[];
}

const DEFAULT_PRESET: LightPreset = 'dusk';

// Permissive parser: when the only issue is an invalid preset, fall back to
// `DEFAULT_PRESET` and surface 'invalidPreset' so the caller can warn the
// user (BUG-013). Other malformed cases still return state=null.
export function parseHashWithErrors(hash: string): HashParseResult {
  const errors: HashParseError[] = [];
  const trimmed = hash.replace(/^#/, '').trim();
  if (!trimmed) return { state: null, errors };
  const parts = trimmed.split('/');
  if (parts.length !== 6) {
    errors.push('malformed');
    return { state: null, errors };
  }
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
    errors.push('malformed');
    return { state: null, errors };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    errors.push('outOfRange');
    return { state: null, errors };
  }
  if (zoom < 0 || zoom > 24 || pitch < 0 || pitch > 85) {
    errors.push('outOfRange');
    return { state: null, errors };
  }
  let preset: LightPreset;
  if (isPreset(presetStr)) {
    preset = presetStr;
  } else {
    errors.push('invalidPreset');
    preset = DEFAULT_PRESET;
  }
  return { state: { zoom, lat, lng, pitch, bearing, preset }, errors };
}

// Strict parser kept for backwards compatibility — returns null whenever any
// part is invalid (including the preset). Used by tests that assert strict
// validation; runtime callers should prefer `parseHashWithErrors`.
export function parseHash(hash: string): MapState | null {
  const { state, errors } = parseHashWithErrors(hash);
  if (errors.includes('invalidPreset')) return null;
  return state;
}

export function readHashState(): MapState | null {
  return parseHash(window.location.hash);
}

export function readHashStateWithErrors(): HashParseResult {
  return parseHashWithErrors(window.location.hash);
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
