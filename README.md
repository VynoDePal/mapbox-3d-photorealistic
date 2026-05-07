# Mapbox 3D — Carte photoréaliste

Application web interactive démontrant une carte Mapbox 3D photoréaliste avec recherche autocomplete, popup d'adresse au clic et bascule d'éclairage cinématique. **v2** : passage TypeScript, tests, CI, et proxy Cloudflare Worker pour ne plus exposer le token côté client.

## Stack

**Frontend** (`/`) :
- **Vite 8** + **TypeScript strict** — bundler, HMR, types
- **Mapbox GL JS v3** — carte 3D + style Standard photoréaliste
- **Vitest** + **Playwright** — tests unitaires & E2E
- **ESLint** flat config

**Backend** (`/server`) :
- **Cloudflare Worker** + **Hono** — proxy `/api/*` vers Mapbox
- Endpoints : `search`, `retrieve/:id`, `reverse`, `category/:id`, `directions`, `isochrone`
- CORS allowlist + rate limit IP

> Le frontend ne contient **plus** le token Search Box / Geocoding. Seul le token public mapbox-gl (rendu carte) reste côté client, et il est protégé par une URL allowlist côté compte Mapbox.

## Architecture

```
mapbox-3d-photorealistic/
├── src/                       # frontend Vite + TS
│   ├── main.ts                # init carte 3D, contrôles, click→reverse
│   ├── geocoding.ts           # client du proxy /api/*
│   ├── search.ts              # autocomplete debounced + flyTo
│   ├── light-preset.ts        # bascule dawn/day/dusk/night
│   ├── types/mapbox.ts        # types Search Box + Geocoding v6 + Directions + Isochrone
│   └── styles.css
├── tests/
│   ├── unit/                  # Vitest (geocoding, light-preset)
│   ├── e2e/                   # Playwright (search.spec.ts)
│   └── setup.ts               # polyfill localStorage pour happy-dom
├── server/                    # Cloudflare Worker (Hono)
│   ├── src/index.ts           # tous les endpoints proxy
│   ├── wrangler.toml
│   └── tsconfig.json
├── .github/workflows/{ci,e2e}.yml
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
└── eslint.config.js
```

## Prérequis

- Node.js ≥ 20
- Compte Mapbox + 1 token public (`pk.*`) avec scopes par défaut

## Installation

```bash
# 1. Frontend
npm install

# 2. Worker proxy
npm --prefix server install
```

## Configuration

### 1. Token public (frontend / mapbox-gl)

```bash
cp .env.example .env
# Editer .env : VITE_MAPBOX_PUBLIC_TOKEN=pk.xxxxxxxx
```

⚠️ **Sécurité** : ce token finit dans le bundle JS, il est par nature visible. Restreins-le immédiatement :

1. Va sur [account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens/)
2. Édite ton token public
3. Active **URL allowlist** et ajoute les domaines autorisés :
   - `http://127.0.0.1:5173/*` (dev)
   - `http://localhost:5173/*` (dev)
   - `https://*.pages.dev/*` (preview Cloudflare Pages)
   - Ton domaine prod (ex : `https://mapbox-3d.example.com/*`)

Sans allowlist, le token peut être recopié et utilisé sur d'autres sites — facturation à ton compte.

### 2. Token secret (Worker proxy)

Crée [server/.dev.vars](server/.dev.vars) (gitignored) en t'inspirant de [server/.dev.vars.example](server/.dev.vars.example) :

```
MAPBOX_SECRET_TOKEN=pk.xxxxxxxx
```

Ce token est utilisé côté serveur uniquement et n'est jamais transmis au navigateur. En production : `wrangler secret put MAPBOX_SECRET_TOKEN`.

## Développement

Lancer **les deux** processus en parallèle (deux terminaux) :

```bash
# Terminal 1 — Worker proxy (port 8787)
npm run dev:server

# Terminal 2 — Vite (port 5173, proxie /api → :8787)
npm run dev
```

Ouvrir [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Vite dev server (5173) |
| `npm run dev:server` | Worker dev (wrangler, 8787) |
| `npm run build` | Build prod (bundle frontend ~ 1KB gzip + mapbox-gl chunk) |
| `npm run preview` | Preview du build prod |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:cov` | Couverture |
| `npm run test:e2e` | Tests E2E Playwright |
| `npm --prefix server run typecheck` | Typecheck du Worker |
| `npm --prefix server run deploy` | Deploy Worker (`wrangler deploy`) |

## CI

- [.github/workflows/ci.yml](.github/workflows/ci.yml) — sur push/PR : typecheck + lint + tests Vitest + build (frontend + Worker)
- [.github/workflows/e2e.yml](.github/workflows/e2e.yml) — déclenchement manuel (préserve quota Mapbox). Token via secret `MAPBOX_E2E_TOKEN`.

## Test manuel (livrable v1, toujours valide en v2)

1. `npm run dev:server` + `npm run dev`
2. Ouvrir [http://127.0.0.1:5173](http://127.0.0.1:5173)
3. Taper « Tour Eiffel » → suggestions via `/api/search` (DevTools network — aucun appel direct à `api.mapbox.com` pour le geocoding)
4. Cliquer la 1ère suggestion → flyTo cinématique 5s vers Paris
5. Clic sur la carte → popup adresse via `/api/reverse`
6. Cycler les presets (dawn/day/dusk/night) → ambiance change, persistance localStorage

## Vérifier que le MCP Mapbox répond (côté Claude Code)

```bash
claude mcp list | grep geocoding
# → geocoding: https://mcp.mapbox.com/mcp (HTTP) - ✓ Connected
```

Le MCP n'est pas appelable depuis le navigateur — il sert uniquement à Claude pour valider les endpoints pendant le développement.

## Roadmap v2 (phases suivantes)

- **Phase 2** : URL state sync, bouton "Partager cette vue", panneau favoris
- **Phase 3** : Itinéraires (Directions API) + recherche par catégorie + Isochrones
- **Phase 4** : Story mode scrollytelling + auto time-of-day
- **Phase 5** : i18n FR/EN, accessibilité Lighthouse ≥95, PWA, déploiement Cloudflare

## Dépannage

| Symptôme | Cause | Fix |
|---|---|---|
| Écran « Token Mapbox manquant » | Pas de `.env` ou clé fausse | Renommer `VITE_MAPBOX_ACCESS_TOKEN` → `VITE_MAPBOX_PUBLIC_TOKEN` |
| 401 sur `/api/search` | `MAPBOX_SECRET_TOKEN` absent côté Worker | Créer `server/.dev.vars` |
| 403 sur `/api/*` | Origin pas dans allowlist | Vérifier `ALLOWED_ORIGINS` dans `server/wrangler.toml` |
| 429 trop tôt | Rate limit Worker | Ajuster `RATE_LIMIT_PER_SECOND` ou désactiver en dev |
| Suggestions vides | Quota Mapbox dépassé | Vérifier le compte |

## Licence

Privé.
