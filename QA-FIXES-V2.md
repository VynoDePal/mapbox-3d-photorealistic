# QA Fixes — Batch 2

Suivi des corrections de la **2e campagne QA** sur `feat/v2` (HEAD `bcc5467` au moment de la branche).

Branche : `fix/qa-batch-2` (depuis `feat/v2`).
Référence batch 1 : [PR #8](https://github.com/VynoDePal/mapbox-3d-photorealistic/pull/8).
Format des commits : `fix(qa-v2): BUG-00X (v2) — courte description`.

## Bilan QA v2 d'entrée

- ✅ **9 fixes batch 1 ont tenu** : BUG-001/002/003/004/006/009/010/011/014 v1 — non retouchés.
- ⚠️ **5 fixes batch 1 incomplets** (re-traités en Vagues 1-3) — voir analyse ci-dessous.
- 🆕 **6 nouvelles anomalies** introduites par les features Phase 3-5.

## Pourquoi les fixes v1 n'ont pas tenu (analyse pré-fix)

| Bug v2 | Bug v1 équivalent | Diagnostic |
|---|---|---|
| BUG-005 | BUG-005 v1 (overflow mobile) | **Nouveau périmètre** — le fix v1 visait `.dir-panel` et `.iso-controls` à 320px. Le QA v2 testait à 200px (extrême) et 375px : le coupable cette fois est la `.toolbar` mobile (5 boutons × 44px + 4 gaps × 8px = 252px + `left: 16px`) et potentiellement le parent `.search-shell` de la rangée de chips. |
| BUG-006 | BUG-007 v1 (503 mapbox/standard) | **Trop léger** — le fix v1 faisait 1 seule tentative `setStyle()` après 3s avec un toast `styleRetrying` court. QA v2 demande 3 tentatives backoff exponentiel (1s/2s/4s) + toast persistant à l'échec final + bouton « Réessayer ». |
| BUG-007 | BUG-008 v1 (Escape 2-step) | **Code semble correct** (search.ts L138-150). Re-vérification + ajout d'un test E2E robuste. Faux-négatif QA possible (focus perdu pendant le keydown ?). |
| BUG-008 | BUG-012 v1 (geoloc error) | **Code câblé** (`geolocate.on('error')` main.ts L88). Re-vérification + mock `navigator.geolocation` dans E2E. Probablement un cas edge (event pas déclenché par le mock initial du QA). |
| BUG-009 | BUG-013 v1 (preset URL invalide) | **Toast tardif/court** — `setTimeout(showToast, 500)` + 4s d'affichage = facilement noyé dans le boot. Le hash URL n'est pas non plus nettoyé après détection. |

## Table de suivi

| ID | Sévérité | Titre | Statut | Commit | Notes |
|---|---|---|---|---|---|
| BUG-001 (v2) | 🟡 Mineur | Toast Annuler trop court | ✅ DONE | _pending_ | Durée passée à 6000ms (call site favorites-ui), barre de progression CSS animée (`@keyframes toast-progress` scaleX 1→0), clic n'importe où sur le toast (`toast--clickable` + handler global), pause sur focus clavier (focusin/focusout dans showActionToast). Respect `prefers-reduced-motion`. |
| BUG-002 (v2) | 🟠 Majeur | Toolbar masquée en plein écran | ✅ DONE | _pending_ | `FullscreenControl` Mapbox remplacé par bouton custom dans la toolbar. Cible : `document.body.requestFullscreen()` (toute l'UI déjà dans body, donc visible automatiquement). Listener `fullscreenchange` synchronise icône / aria-pressed / aria-label. Re-sync au changement de langue. |
| BUG-003 (v2) | 🟡 Mineur | « Combien de temps ? » sans effet | ✅ DONE | _pending_ | `initIsochrone(map, directions?)` accepte le `DirectionsController`. Toggle ON + waypoints existants → calcul auto sur le 1er waypoint, profil sync via `directions.getProfile()`. Si pas de waypoint, fallback legacy (clic carte) avec `title="Posez d'abord un point de départ"`. Custom event `mapbox3d:directions-change` (drag/add/remove/clearAll/profile) → recompute. Légende `.iso-legend` (10/20/30) dans le panneau Itinéraire, toggled visible quand iso ON + waypoints. |
| BUG-004 (v2) | 🟡 Mineur | Popup POI persiste après désélection | ✅ DONE | _pending_ | Dans `clearMarkers()`, itérer chaque marker → `m.getPopup()?.isOpen() ? popup.remove()` puis `m.remove()`. Garantit qu'aucune popup ne reste affichée après un switch ou clear de catégorie. |
| BUG-005 (v2) | 🟠 Majeur | Overflow mobile non corrigé | ✅ DONE | _pending_ | 3 ajustements : `.search-shell` → `width: min(480px, calc(100vw - 16px))` ; `.toolbar` mobile → `right: 8px; left: auto; flex-wrap: wrap; max-width: calc(100vw - 16px)` ; `.category-chips` → `max-width: 100%; min-width: 0; scrollbar masquée; scroll-snap`. |
| BUG-006 (v2) | 🟠 Majeur | Retry mapbox/standard | ✅ DONE | _pending_ | Refactor du handler error : `styleRetryCount` 0→3, `setTimeout(retry, 1000 * 2^count)` (1s, 2s, 4s). Après 3 échecs, `showActionToast(styleFailed, retry, { durationMs: null })` persistant + click sur « Réessayer » reset le compteur. `console.warn('[mapbox-style-retry]', ...)` à chaque étape. `style.load` reset compteur. Bootstrap modules splitted : DEM/terrain/fog idempotent (re-run sur retry), feature modules en `map.once`. `showActionToast` étendu pour accepter `durationMs: null` + opt `clickAnywhere`. |
| BUG-007 (v2) | 🟡 Mineur | Escape 2-step non corrigé | ✅ DONE | _pending_ | Code v1 déjà 2-step correct. Hardening : cancel `debounceId` + `abortCtrl?.abort()` pendant le clear pour éviter qu'une recherche en vol ne ré-ouvre la dropdown après Escape. Test E2E à étendre dans qa-regression. |
| BUG-008 (v2) | 🔵 Cosmétique | Toast géoloc | ✅ DONE | _pending_ | Listener `geolocate.on('error')` durci : checks `err.code` ET `err.error.code` (selon version Mapbox), 3 codes mappés (1=denied, 3=timeout, autres=unavailable), `console.warn` structuré, toast 4s. Nouvelle clé i18n `geolocTimeout`. |
| BUG-009 (v2) | 🔵 Cosmétique | Preset URL invalide | TODO | — | Toast 6s immédiat + cleanup hash + message nominatif |
| BUG-010 (v2) | 🟡 Mineur | × sur Itinéraire | ✅ DONE | _pending_ | `<button class="panel-close">×` ajouté en haut-droit du `dir-panel` (header-row flex). Au clic : `active = false`, retire `.active` du toggle btn, `panel.hide()`, reset cursor — **sans clearAll** : waypoints + route conservés en state. Re-cliquer la toolbar restaure le panneau identique. Le bouton « Effacer » existant garde sa fonction de reset complet. |
| BUG-011 (v2) | 🔵 Cosmétique | Story ne masque pas Itin/Favoris | TODO | — | Mémoriser état + close + restore au sortie Story |
| BUG-012 (v2) | 🔵 Cosmétique | Auto preset peu visible | TODO | — | `.active` confirm + liseré sur preset auto-driven + aria-label dynamique |

## Tests de régression v2

8 nouveaux scénarios à ajouter dans `tests/e2e/qa-regression.spec.ts` (cf. plan).
