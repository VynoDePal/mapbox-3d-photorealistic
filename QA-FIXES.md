# QA Fixes — Batch 1

Suivi des corrections appliquées au rapport QA reçu sur la v2 (branche `feat/v2`, commit `c6853b1`).

Branche : `fix/qa-batch-1`. Stratégie : un commit atomique par bug, format `fix(qa): BUG-00X — courte description`.

| ID | Sévérité | Titre | Statut | Commit | Notes |
|---|---|---|---|---|---|
| BUG-001 | 🟡 Mineur | Doublons de favoris autorisés | TODO | — | Refus + toast (cf. plan validé) |
| BUG-002 | 🟠 Majeur | Toast déborde avec nom long | ✅ DONE | _pending_ | `.toast` `max-width: min(420px, calc(100vw - 32px))` + `word-break: break-word` + `border-radius: 14px` (au lieu de pill 999px). Util `truncate(name, 40)` appliqué avant l'injection dans `favSaved`/`favRemoved`. 5 nouveaux tests unit. |
| BUG-003 | 🟡 Mineur | Suppression sans confirmation | TODO | — | Action toast 5s avec « Annuler » |
| BUG-004 | 🟡 Mineur | Renommage via prompt() natif | TODO | — | Édition inline du nom |
| BUG-005 | 🟠 Majeur | Overflow horizontal mobile | ✅ DONE | _pending_ | `.dir-panel` overflow @ 320px (left:80 + width:92vw=294 = 374). Capped to `min(320px, calc(100vw - 96px))` desktop, `left:8/right:8` mobile. Same for `.iso-controls`. |
| BUG-006 | 🟡 Mineur | Pas d'indicateur de focus | TODO | — | Already mostly fixed in Phase 5 (`ea9a8e1`) — retirer `outline:none` résiduel sur `#search-input` |
| BUG-007 | 🟠 Majeur | 503 occasionnel sur `mapbox/standard` | ✅ DONE | _pending_ | Handler `map.on('error')` étendu : détecte 5xx OU url `/styles/v1/` OU message « style ». `console.warn` structuré, toast `styleRetrying`, `map.setStyle('...standard')` après 3s. Flag `styleRetried` empêche la boucle. Commentaire explicatif en haut de main.ts. |
| BUG-008 | 🟡 Mineur | Escape ne vide pas la barre de recherche | TODO | — | 2-temps : 1ère = ferme dropdown, 2ème = vide input + blur |
| BUG-009 | 🟡 Mineur | Pas de `maxLength` sur input « Nom du lieu » | TODO | — | `maxlength="80"` |
| BUG-010 | 🟡 Mineur | « Aller » ferme le panneau Mes lieux | TODO | — | Retirer `panel.close()` |
| BUG-011 | 🔵 Cosmétique | Pas de `<h1>` sur la page | TODO | — | `<h1 class="sr-only">` au début du body |
| BUG-012 | 🔵 Cosmétique | Pas de retour si géoloc refusée | TODO | — | Listener `error` du `GeolocateControl` + toast |
| BUG-013 | 🔵 Cosmétique | Preset URL invalide silencieux | TODO | — | console.warn + toast au boot |
| BUG-014 | 🔵 Cosmétique | Cibles tactiles trop petites mobile | TODO | — | `min-width/height: 44px` en `@media (max-width: 600px)` |

## Tests de régression

Fichier : `tests/e2e/qa-regression.spec.ts` (Playwright).

Couvre : viewports overflow (320/375/414/768/1366), nom 200 chars, doublon refusé, focus visible au Tab, Escape×2, maxLength 80, preset invalide.
