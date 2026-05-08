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
| BUG-001 (v2) | 🟡 Mineur | Toast Annuler trop court | TODO | — | 6s + barre progression + clic anywhere + pause focus |
| BUG-002 (v2) | 🟠 Majeur | Toolbar masquée en plein écran | ✅ DONE | _pending_ | `FullscreenControl` Mapbox remplacé par bouton custom dans la toolbar. Cible : `document.body.requestFullscreen()` (toute l'UI déjà dans body, donc visible automatiquement). Listener `fullscreenchange` synchronise icône / aria-pressed / aria-label. Re-sync au changement de langue. |
| BUG-003 (v2) | 🟡 Mineur | « Combien de temps ? » sans effet | TODO | — | Synchro Itinéraire (1er waypoint + profil) + légende |
| BUG-004 (v2) | 🟡 Mineur | Popup POI persiste après désélection | TODO | — | `marker.getPopup()?.remove()` avant clearMarkers |
| BUG-005 (v2) | 🟠 Majeur | Overflow mobile non corrigé | ✅ DONE | _pending_ | 3 ajustements : `.search-shell` → `width: min(480px, calc(100vw - 16px))` ; `.toolbar` mobile → `right: 8px; left: auto; flex-wrap: wrap; max-width: calc(100vw - 16px)` ; `.category-chips` → `max-width: 100%; min-width: 0; scrollbar masquée; scroll-snap`. |
| BUG-006 (v2) | 🟠 Majeur | Retry mapbox/standard | TODO | — | Backoff exponentiel 1s/2s/4s + toast persistant + bouton |
| BUG-007 (v2) | 🟡 Mineur | Escape 2-step non corrigé | TODO | — | Re-vérif + E2E robuste |
| BUG-008 (v2) | 🔵 Cosmétique | Toast géoloc | TODO | — | Re-vérif + 3 codes (1/2/3) + E2E mock |
| BUG-009 (v2) | 🔵 Cosmétique | Preset URL invalide | TODO | — | Toast 6s immédiat + cleanup hash + message nominatif |
| BUG-010 (v2) | 🟡 Mineur | × sur Itinéraire | TODO | — | `panel-close` + conserver waypoints |
| BUG-011 (v2) | 🔵 Cosmétique | Story ne masque pas Itin/Favoris | TODO | — | Mémoriser état + close + restore au sortie Story |
| BUG-012 (v2) | 🔵 Cosmétique | Auto preset peu visible | TODO | — | `.active` confirm + liseré sur preset auto-driven + aria-label dynamique |

## Tests de régression v2

8 nouveaux scénarios à ajouter dans `tests/e2e/qa-regression.spec.ts` (cf. plan).
