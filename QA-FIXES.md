# QA Fixes — Batch 1

Suivi des corrections appliquées au rapport QA reçu sur la v2 (branche `feat/v2`, commit `c6853b1`).

Branche : `fix/qa-batch-1`. Stratégie : un commit atomique par bug, format `fix(qa): BUG-00X — courte description`.

| ID | Sévérité | Titre | Statut | Commit | Notes |
|---|---|---|---|---|---|
| BUG-001 | 🟡 Mineur | Doublons de favoris autorisés | TODO | — | Refus + toast (cf. plan validé) |
| BUG-002 | 🟠 Majeur | Toast déborde avec nom long | TODO | — | `.toast` `max-width` + `word-break` + truncate 40 chars |
| BUG-003 | 🟡 Mineur | Suppression sans confirmation | TODO | — | Action toast 5s avec « Annuler » |
| BUG-004 | 🟡 Mineur | Renommage via prompt() natif | TODO | — | Édition inline du nom |
| BUG-005 | 🟠 Majeur | Overflow horizontal mobile | TODO | — | Audit conteneurs + ajustements responsive |
| BUG-006 | 🟡 Mineur | Pas d'indicateur de focus | TODO | — | Already mostly fixed in Phase 5 (`ea9a8e1`) — retirer `outline:none` résiduel sur `#search-input` |
| BUG-007 | 🟠 Majeur | 503 occasionnel sur `mapbox/standard` | TODO | — | Retry 3s + toast non-bloquant + console.warn |
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
