# Mapbox 3D — Carte photoréaliste

Application web interactive démontrant une carte Mapbox 3D photoréaliste avec recherche autocomplete (forward geocoding), popup d'adresse au clic (reverse geocoding) et bascule d'éclairage cinématique.

## Stack

- **Vite** (vanilla JS) — bundler & dev server
- **Mapbox GL JS v3** — rendu carte 3D + style Standard photoréaliste
- **Mapbox Search Box API v1** — autocomplete (forward geocoding)
- **Mapbox Geocoding API v6** — reverse geocoding au clic

> Le serveur **MCP Mapbox** (`geocoding`) est utilisé en parallèle dans Claude Code pour valider les endpoints pendant le développement, mais l'application web tape directement les API REST publiques de Mapbox.

## Prérequis

- Node.js ≥ 18
- Un compte Mapbox + token public (préfixe `pk.`)

## Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Récupérer un token public sur https://account.mapbox.com/access-tokens/
#    Les scopes par défaut suffisent.

# 3. Créer .env à partir du template
cp .env.example .env

# 4. Coller le token dans .env
#    VITE_MAPBOX_ACCESS_TOKEN=pk.xxxxxxxx

# 5. Lancer le dev server
npm run dev
```

Ouvrir [http://127.0.0.1:5173](http://127.0.0.1:5173).

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Dev server avec HMR sur port 5173 |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Preview du build de prod |

## Architecture

```
src/
├── main.js          — Init carte 3D (Standard, terrain, fog, contrôles, click→reverse)
├── search.js        — Autocomplete debounced + dropdown + flyTo cinématique
├── geocoding.js     — Wrappers fetch pour Search Box + Geocoding v6 (session token, AbortController)
├── light-preset.js  — Bascule lightPreset (dawn/day/dusk/night) + persistance localStorage
└── styles.css       — UI dark minimaliste, responsive, popup Mapbox restyle
```

## Fonctionnalités

- **Carte 3D photoréaliste** : style `mapbox://styles/mapbox/standard`, bâtiments 3D inclus, terrain DEM avec exagération 1.5×, brouillard atmosphérique, pitch initial 70°
- **Recherche autocomplete** : debounce 300ms, navigation clavier (↑/↓/Enter/Esc), cancellation `AbortController` sur les requêtes obsolètes
- **flyTo cinématique** : 5s, courbe 1.42, zoom 17, pitch 70° vers le résultat sélectionné
- **Reverse geocoding** : clic sur la carte → popup avec adresse formatée
- **4 presets lumineux** : dawn / day / dusk / night, avec persistance localStorage
- **Contrôles natifs** : zoom, boussole avec visualisation du pitch, plein écran, géolocalisation
- **Gestion d'erreur** : token invalide (401), quota dépassé (429), aucun résultat — tous affichés dans l'UI
- **Responsive** : input et boutons adaptés au mobile

## Test manuel (livrable)

1. Lancer `npm run dev` → ouvrir [http://127.0.0.1:5173](http://127.0.0.1:5173)
2. Vérifier que la carte 3D charge sur Paris (Tour Eiffel par défaut), bâtiments 3D visibles
3. Taper « Tour Eiffel » dans la barre de recherche
4. Une dropdown apparaît avec des suggestions (la première devrait être la Tour Eiffel)
5. Cliquer sur la suggestion → la carte effectue un `flyTo` cinématique de 5s vers `[2.2945, 48.8584]`, zoom 17, pitch 70°
6. La Tour Eiffel doit être visible en 3D photoréaliste à l'arrivée
7. Cliquer ensuite sur la Place de la Concorde → popup avec l'adresse
8. Cycler les 4 boutons d'éclairage (Dawn / Day / Dusk / Night) → l'ambiance lumineuse change visiblement, l'état persiste après reload

## Vérifier que le MCP Mapbox répond

Côté Claude Code (terminal) :

```bash
claude mcp list
# Doit afficher : geocoding: https://mcp.mapbox.com/mcp (HTTP) - ✓ Connected
```

Si le statut est `! Needs authentication`, taper `/mcp` dans Claude Code et lancer le flux OAuth. Une fois authentifié, Claude peut invoquer les tools (`search_and_geocode_tool`, `reverse_geocode_tool`, etc.) pour vérifier les endpoints sans quitter la session.

> ⚠️ Le MCP n'est PAS appelable depuis le navigateur — il sert uniquement à Claude pour le diagnostic. Le frontend de cette app utilise les API REST Mapbox directement.

## Dépannage

| Symptôme | Cause probable | Fix |
|---|---|---|
| Écran « Token Mapbox manquant » | Pas de `.env` ou variable mal nommée | Vérifier `.env` : `VITE_MAPBOX_ACCESS_TOKEN=pk.xxx` |
| Écran « Token Mapbox invalide » | Token expiré ou faux | Régénérer un token sur account.mapbox.com |
| Suggestions vides | Quota dépassé / token sans scope geocoding | Vérifier le compte Mapbox |
| Bâtiments 3D absents | Pitch trop bas | Augmenter le pitch (≥ 60°) via le compass |

## Licence

Privé.
