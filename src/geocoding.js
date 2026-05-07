const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const SEARCHBOX = 'https://api.mapbox.com/search/searchbox/v1';
const GEOCODE_V6 = 'https://api.mapbox.com/search/geocode/v6';

// Session token partagé entre suggest() et retrieve() — facturation Search Box
// se fait au "search session" plutôt qu'à la requête. Régénéré après chaque retrieve.
let sessionToken = crypto.randomUUID();

export function rotateSessionToken() {
  sessionToken = crypto.randomUUID();
}

class GeocodingError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function fetchJSON(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    if (res.status === 401) throw new GeocodingError(401, 'Token Mapbox invalide ou expiré');
    if (res.status === 429) throw new GeocodingError(429, 'Quota dépassé, réessaie plus tard');
    throw new GeocodingError(res.status, `Erreur Mapbox HTTP ${res.status}`);
  }
  return res.json();
}

export async function suggest(query, { language = 'fr', limit = 6, signal } = {}) {
  const url = new URL(`${SEARCHBOX}/suggest`);
  url.searchParams.set('q', query);
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('session_token', sessionToken);
  url.searchParams.set('language', language);
  url.searchParams.set('limit', String(limit));
  const data = await fetchJSON(url, signal);
  return data.suggestions ?? [];
}

export async function retrieve(mapboxId, { signal } = {}) {
  const url = new URL(`${SEARCHBOX}/retrieve/${encodeURIComponent(mapboxId)}`);
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('session_token', sessionToken);
  const data = await fetchJSON(url, signal);
  rotateSessionToken();
  const feature = data.features?.[0];
  if (!feature) throw new GeocodingError(404, 'Feature non trouvée');
  return feature;
}

export async function reverse(lng, lat, { language = 'fr', signal } = {}) {
  const url = new URL(`${GEOCODE_V6}/reverse`);
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('language', language);
  url.searchParams.set('limit', '1');
  const data = await fetchJSON(url, signal);
  return data.features?.[0] ?? null;
}

export { GeocodingError };
