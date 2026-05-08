import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface Env {
  MAPBOX_SECRET_TOKEN: string;
  ALLOWED_ORIGINS: string;
  RATE_LIMIT_PER_SECOND: string;
}

const SEARCHBOX = 'https://api.mapbox.com/search/searchbox/v1';
const GEOCODE_V6 = 'https://api.mapbox.com/search/geocode/v6';
const DIRECTIONS = 'https://api.mapbox.com/directions/v5/mapbox';
const ISOCHRONE = 'https://api.mapbox.com/isochrone/v1/mapbox';

const app = new Hono<{ Bindings: Env }>();

// CORS — allowed origins are CSV in env vars, parsed at runtime.
app.use('/api/*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 600,
  })(c, next);
});

// Sliding-window in-memory rate limiter (per Worker isolate).
// Sufficient for demo/portfolio. For production scale, swap for Durable Object or KV.
const rateBuckets = new Map<string, number[]>();

app.use('/api/*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
  const limit = Number(c.env.RATE_LIMIT_PER_SECOND ?? '10');
  const now = Date.now();
  const window = 1000;
  const arr = (rateBuckets.get(ip) ?? []).filter((t) => now - t < window);
  if (arr.length >= limit) {
    return c.json({ error: 'rate_limited', message: 'Too many requests, slow down.' }, 429);
  }
  arr.push(now);
  rateBuckets.set(ip, arr);
  return next();
});

// ---- Helpers ----
function buildUrl(base: string, params: Record<string, string | undefined>, token: string): string {
  const url = new URL(base);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  }
  return url.toString();
}

async function forwardJson(upstream: string, cacheSeconds = 60): Promise<Response> {
  const res = await fetch(upstream, { cf: { cacheTtl: cacheSeconds, cacheEverything: true } });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': res.ok ? `public, max-age=${cacheSeconds}` : 'no-store',
    },
  });
}

// ---- Endpoints ----

// GET /api/search?q&proximity?&country?&language?&limit?&session_token?
app.get('/api/search', async (c) => {
  const q = c.req.query('q');
  if (!q) return c.json({ error: 'missing_q' }, 400);
  const upstream = buildUrl(
    `${SEARCHBOX}/suggest`,
    {
      q,
      session_token: c.req.query('session_token'),
      proximity: c.req.query('proximity'),
      country: c.req.query('country'),
      language: c.req.query('language') ?? 'fr',
      limit: c.req.query('limit') ?? '6',
    },
    c.env.MAPBOX_SECRET_TOKEN
  );
  return forwardJson(upstream, 30);
});

// GET /api/retrieve/:mapboxId?session_token
app.get('/api/retrieve/:id', async (c) => {
  const id = c.req.param('id');
  const upstream = buildUrl(
    `${SEARCHBOX}/retrieve/${encodeURIComponent(id)}`,
    { session_token: c.req.query('session_token') },
    c.env.MAPBOX_SECRET_TOKEN
  );
  return forwardJson(upstream, 60);
});

// GET /api/reverse?lng&lat&language?
app.get('/api/reverse', async (c) => {
  const lng = c.req.query('lng');
  const lat = c.req.query('lat');
  if (!lng || !lat) return c.json({ error: 'missing_coords' }, 400);
  const upstream = buildUrl(
    `${GEOCODE_V6}/reverse`,
    {
      longitude: lng,
      latitude: lat,
      language: c.req.query('language') ?? 'fr',
      limit: '1',
    },
    c.env.MAPBOX_SECRET_TOKEN
  );
  return forwardJson(upstream, 60);
});

// GET /api/category/:id?proximity?&limit?&language?
app.get('/api/category/:id', async (c) => {
  const id = c.req.param('id');
  const upstream = buildUrl(
    `${SEARCHBOX}/category/${encodeURIComponent(id)}`,
    {
      proximity: c.req.query('proximity'),
      language: c.req.query('language') ?? 'fr',
      limit: c.req.query('limit') ?? '10',
    },
    c.env.MAPBOX_SECRET_TOKEN
  );
  return forwardJson(upstream, 60);
});

// POST /api/directions  body: { profile: "driving"|"walking"|"cycling", coords: [[lng,lat], ...] }
app.post('/api/directions', async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { profile?: string; coords?: [number, number][] }
    | null;
  if (!body?.profile || !Array.isArray(body.coords) || body.coords.length < 2) {
    return c.json({ error: 'invalid_body' }, 400);
  }
  const profile = ['driving', 'walking', 'cycling'].includes(body.profile) ? body.profile : 'driving';
  const path = body.coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const upstream = buildUrl(
    `${DIRECTIONS}/${profile}/${path}`,
    {
      geometries: 'geojson',
      overview: 'full',
      steps: 'false',
    },
    c.env.MAPBOX_SECRET_TOKEN
  );
  return forwardJson(upstream, 30);
});

// GET /api/isochrone?lng&lat&profile?&minutes?
app.get('/api/isochrone', async (c) => {
  const lng = c.req.query('lng');
  const lat = c.req.query('lat');
  if (!lng || !lat) return c.json({ error: 'missing_coords' }, 400);
  const profileQ = c.req.query('profile') ?? 'walking';
  const profile = ['driving', 'walking', 'cycling'].includes(profileQ) ? profileQ : 'walking';
  const upstream = buildUrl(
    `${ISOCHRONE}/${profile}/${lng},${lat}`,
    {
      contours_minutes: c.req.query('minutes') ?? '10,20,30',
      polygons: 'true',
      denoise: '1',
    },
    c.env.MAPBOX_SECRET_TOKEN
  );
  return forwardJson(upstream, 60);
});

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

export default app;
