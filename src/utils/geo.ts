// Pure geo / formatting utilities — kept side-effect-free for unit tests.

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

// Initial bearing from A to B (degrees, 0 = north, clockwise).
export function bearing([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Format duration in seconds to "X h Y min" or "Y min" (rounding minutes).
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds / 60);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// Format distance in meters to "X.X km" or "Y m".
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

// Format coords as "lng,lat" with capped precision (Mapbox APIs).
export function lngLatToParam(lng: number, lat: number, decimals = 6): string {
  const f = 10 ** decimals;
  return `${Math.round(lng * f) / f},${Math.round(lat * f) / f}`;
}
