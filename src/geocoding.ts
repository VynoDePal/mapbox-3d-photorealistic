import type {
  SearchBoxSuggestion,
  SearchBoxRetrieveFeature,
  GeocodeV6Feature,
} from '@/types/mapbox.ts';

// Proxy base URL — points to the Cloudflare Worker (in dev, Vite proxies /api → :8787).
// All Mapbox tokens stay server-side. Frontend never sees them.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// Session token shared between suggest() and retrieve() — Mapbox bills the
// "search session" rather than each request. Rotated after each successful retrieve.
let sessionToken = crypto.randomUUID();

export function rotateSessionToken(): void {
  sessionToken = crypto.randomUUID();
}

export class GeocodingError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'GeocodingError';
  }
}

interface FetchOpts {
  signal?: AbortSignal;
}

async function fetchJSON<T>(url: URL, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, signal ? { signal } : {});
  if (!res.ok) {
    if (res.status === 401) throw new GeocodingError(401, 'Token Mapbox invalide ou expiré');
    if (res.status === 429) throw new GeocodingError(429, 'Quota dépassé, réessaie plus tard');
    throw new GeocodingError(res.status, `Erreur Mapbox HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface SuggestOpts extends FetchOpts {
  language?: string;
  limit?: number;
  proximity?: { lng: number; lat: number };
  country?: string[];
}

export async function suggest(query: string, opts: SuggestOpts = {}): Promise<SearchBoxSuggestion[]> {
  const { language = 'fr', limit = 6, proximity, country, signal } = opts;
  const url = new URL(`${API_BASE}/api/search`, location.origin);
  url.searchParams.set('q', query);
  url.searchParams.set('session_token', sessionToken);
  url.searchParams.set('language', language);
  url.searchParams.set('limit', String(limit));
  if (proximity) url.searchParams.set('proximity', `${proximity.lng},${proximity.lat}`);
  if (country?.length) url.searchParams.set('country', country.join(','));
  const data = await fetchJSON<{ suggestions?: SearchBoxSuggestion[] }>(url, signal);
  return data.suggestions ?? [];
}

export async function retrieve(mapboxId: string, opts: FetchOpts = {}): Promise<SearchBoxRetrieveFeature> {
  const url = new URL(`${API_BASE}/api/retrieve/${encodeURIComponent(mapboxId)}`, location.origin);
  url.searchParams.set('session_token', sessionToken);
  const data = await fetchJSON<{ features?: SearchBoxRetrieveFeature[] }>(url, opts.signal);
  rotateSessionToken();
  const feature = data.features?.[0];
  if (!feature) throw new GeocodingError(404, 'Feature non trouvée');
  return feature;
}

export interface ReverseOpts extends FetchOpts {
  language?: string;
}

export async function reverse(lng: number, lat: number, opts: ReverseOpts = {}): Promise<GeocodeV6Feature | null> {
  const { language = 'fr', signal } = opts;
  const url = new URL(`${API_BASE}/api/reverse`, location.origin);
  url.searchParams.set('lng', String(lng));
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('language', language);
  const data = await fetchJSON<{ features?: GeocodeV6Feature[] }>(url, signal);
  return data.features?.[0] ?? null;
}
