# Changelog

All notable changes to this project are documented here. Format inspired by [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ; the project follows [Semantic Versioning](https://semver.org/).

## [2.0.0] — 2026-05-08

Refonte majeure : passage TypeScript strict, sécurisation du token via proxy, et empilement de fonctionnalités portfolio-grade au-dessus d'une CI complète.

### Added

- **TypeScript strict** sur tout le code (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`). Path alias `@/`. Types Mapbox (Search Box, Geocoding v6, Directions, Isochrone) extraits dans `src/types/mapbox.ts`.
- **Cloudflare Worker proxy** (`server/`) avec Hono : endpoints `/api/{search,retrieve,reverse,category,directions,isochrone}`, CORS allowlist via env, rate limit IP sliding-window, cache 30-60s sur GET idempotents.
- **CI GitHub Actions** : workflow `ci.yml` (typecheck + lint + test + build, frontend & server) à chaque push/PR ; workflow `e2e.yml` déclenchable manuellement (préserve le quota Mapbox).
- **Tests** : 77 tests Vitest (geocoding, light-preset, url-state, favorites, geo utils, light-preset-auto, i18n, motion) + 1 spec Playwright E2E pour la recherche Tour Eiffel.
- **URL state sync** : hash `#zoom/lat/lng/pitch/bearing/preset` mis à jour au moveend (debounce 500ms), restauré au boot. Bouton « Partager cette vue » avec toast.
- **Favoris** persistés `localStorage:mapbox3d:favorites:v1` avec drawer latéral (sauvegarder, aller, renommer, supprimer).
- **Itinéraires** (Mapbox Directions API) avec waypoints draggables, profils driving/walking/cycling, tracé GeoJSON glow + gradient au-dessus des bâtiments 3D, durée/distance, **camera follow** cinématique 10s annulable.
- **Recherche par catégorie** (Search Box) : chips Restaurants / Hôtels / Cafés / Musées / Parcs avec markers customs colorés.
- **Isochrones** (Mapbox Isochrone API) : 3 polygones empilés 10/20/30 min, profils marche/vélo/voiture.
- **Story mode** (scrollytelling) : 6 chapitres scénarisés à Paris, transitions flyTo/easeTo, **2 orbites cinématiques** (Louvre 12s, Tour Eiffel dusk 14s), navigation clavier `↑/↓/PageUp/PageDown/Esc`.
- **Auto time-of-day** : 5e bouton dans la light-preset-bar, bascule dawn/day/dusk/night selon l'heure locale (heuristique tz par longitude), recalculé sur moveend + toutes les 60s, auto-disable si l'utilisateur reprend la main.
- **i18n FR / EN** : module typé sans dépendance externe, `t(key, ...args)` avec entrées chaînes ou fonctions, switcher FR/EN persisté localStorage, parité de clés vérifiée par test.
- **A11y** : skip-link clavier, focus-visible global, ARIA combobox / listbox / option avec `aria-activedescendant`, support `prefers-reduced-motion` (cinématiques → jumpTo, orbites désactivées dans Story mode, transitions CSS rabaissées).

### Changed

- **Token Mapbox** scindé en deux : `VITE_MAPBOX_PUBLIC_TOKEN` (mapbox-gl côté client, à protéger via URL allowlist) et `MAPBOX_SECRET_TOKEN` (server-only). Le frontend ne contient plus aucun token Search Box / Geocoding.
- **`VITE_MAPBOX_ACCESS_TOKEN` → `VITE_MAPBOX_PUBLIC_TOKEN`** (rappelle que c'est un token public).
- **`light-preset.ts`** retourne désormais un `PresetController { current, set }` réutilisable et dispatche `mapbox3d:preset-change` à chaque changement.
- **Bundle** : code-split mapbox-gl (chunk séparé). App code passe de 0.82 KB (Phase 1) à ~14 KB gzipped (Phase 5) — bien sous le budget de 400 KB hors mapbox-gl.

### Security

- Le token Search Box / Geocoding **n'est plus exposé** côté client : tout passe par le Worker proxy.
- CORS strict sur les endpoints `/api/*` : seules les origines listées dans `ALLOWED_ORIGINS` (env) acceptent les réponses.
- Rate limit basique IP sliding-window 1s configurable par `RATE_LIMIT_PER_SECOND` (défaut 10) — suffisant pour démo, à remplacer par Durable Object pour production scale.
- Token public mapbox-gl à protéger via **URL allowlist** côté compte Mapbox (documenté en README) — empêche son réemploi sur d'autres domaines.

### Fixed

- L'AbortController des requêtes geocoding annulait correctement les appels obsolètes mais ne signalait pas l'origine au caller — désormais via `DOMException name === 'AbortError'`.
- happy-dom 20 expose un stub `Storage` non fonctionnel : ajout d'un polyfill in-memory dans `tests/setup.ts`.

## [1.0.0] — 2026-05-07

Première version publique : carte Mapbox 3D photoréaliste avec autocomplete, reverse geocoding au clic, et 4 presets lumineux (dawn/day/dusk/night). Stack vanilla JS + Vite, token directement dans le bundle.
