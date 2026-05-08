# QA Fixes — Batch 1

Suivi des corrections appliquées au rapport QA reçu sur la v2 (branche `feat/v2`, commit `c6853b1`).

Branche : `fix/qa-batch-1`. Stratégie : un commit atomique par bug, format `fix(qa): BUG-00X — courte description`.

| ID | Sévérité | Titre | Statut | Commit | Notes |
|---|---|---|---|---|---|
| BUG-001 | 🟡 Mineur | Doublons de favoris autorisés | ✅ DONE | _pending_ | `findByName(name)` (case-insensitive, trim). Caller refuse + toast `favDuplicate` + `select()` de l'input pour faciliter la correction. 4 nouveaux tests. |
| BUG-002 | 🟠 Majeur | Toast déborde avec nom long | ✅ DONE | _pending_ | `.toast` `max-width: min(420px, calc(100vw - 32px))` + `word-break: break-word` + `border-radius: 14px` (au lieu de pill 999px). Util `truncate(name, 40)` appliqué avant l'injection dans `favSaved`/`favRemoved`. 5 nouveaux tests unit. |
| BUG-003 | 🟡 Mineur | Suppression sans confirmation | ✅ DONE | _pending_ | Nouveau `showActionToast(message, label, duration)` dans `src/ui/toast.ts` retournant Promise<boolean>. Le `<li>` du favori reçoit `fav-item--pending-delete` (`display:none`) immédiatement ; à 5s sans clic Annuler, `remove()` + rerender. Si Annuler → restauration. Clés i18n `undo`. CSS `.toast--action` + `.toast-action-btn` ajoutés. |
| BUG-004 | 🟡 Mineur | Renommage via prompt() natif | ✅ DONE | _pending_ | Édition inline : le `<span class="fav-name">` est remplacé par un `<input class="fav-rename-input" maxlength="80">` (focus + select). Enter ou blur valident, Escape annule (restore du span original sans rerender). Style aligné `.fav-name` + border accent. |
| BUG-005 | 🟠 Majeur | Overflow horizontal mobile | ✅ DONE | _pending_ | `.dir-panel` overflow @ 320px (left:80 + width:92vw=294 = 374). Capped to `min(320px, calc(100vw - 96px))` desktop, `left:8/right:8` mobile. Same for `.iso-controls`. |
| BUG-006 | 🟡 Mineur | Pas d'indicateur de focus | ✅ DONE | _pending_ | Mostly fixed in Phase 5 (`:focus-visible` global, commit `ea9a8e1`). Reste : `#search-input { outline: none }` ID-spécifique override. Remplacé par `#search-input:focus:not(:focus-visible) { outline: none }` qui supprime l'outline uniquement sur focus mouse, pas keyboard. |
| BUG-007 | 🟠 Majeur | 503 occasionnel sur `mapbox/standard` | ✅ DONE | _pending_ | Handler `map.on('error')` étendu : détecte 5xx OU url `/styles/v1/` OU message « style ». `console.warn` structuré, toast `styleRetrying`, `map.setStyle('...standard')` après 3s. Flag `styleRetried` empêche la boucle. Commentaire explicatif en haut de main.ts. |
| BUG-008 | 🟡 Mineur | Escape ne vide pas la barre de recherche | ✅ DONE | _pending_ | Handler keydown Escape sorti de la guard `list.hidden` early-return. 2-temps : (1) dropdown ouverte → close ; (2) sinon input non vide → clear + blur ; (3) input vide → no-op. |
| BUG-009 | 🟡 Mineur | Pas de `maxLength` sur input « Nom du lieu » | ✅ DONE | _pending_ | `maxlength: 80` ajouté à `nameInput` dans `favorites-ui.ts` (et déjà sur l'input rename inline via BUG-004). Le `.trim()` + check empty existaient déjà. |
| BUG-010 | 🟡 Mineur | « Aller » ferme le panneau Mes lieux | ✅ DONE | _pending_ | Retiré l'appel `panel.close()` du handler `goBtn`. Le panneau reste ouvert pour faciliter la navigation entre favoris. Dropping `panel` param de `buildBody`/`buildItem` (plus utilisé). |
| BUG-011 | 🔵 Cosmétique | Pas de `<h1>` sur la page | ✅ DONE | _pending_ | `<h1 class="sr-only" data-i18n="appTitle">` ajouté juste après le skip-link. CSS `.sr-only` standard (clip-rect + 1px). i18n FR/EN clé `appTitle`. |
| BUG-012 | 🔵 Cosmétique | Pas de retour si géoloc refusée | ✅ DONE | _pending_ | `GeolocateControl` réifié, listener `'error'` ajouté. Code 1 (denied) → `geolocDenied`, autres → `geolocUnavailable`. i18n FR/EN. |
| BUG-013 | 🔵 Cosmétique | Preset URL invalide silencieux | ✅ DONE | _pending_ | Nouveau `parseHashWithErrors(hash)` retournant `{ state, errors[] }`. Si seul le preset est invalide → fallback `'dusk'` + `errors.push('invalidPreset')`. main.ts boot lit l'erreur, console.warn + toast `presetInvalid`. `parseHash` strict reste pour les tests. 5 nouveaux tests unit. |
| BUG-014 | 🔵 Cosmétique | Cibles tactiles trop petites mobile | ✅ DONE | _pending_ | `@media (max-width: 600px)` ajoute `min-width: 44px; min-height: 44px` aux `.toolbar-btn`, `.light-preset-bar button`, `.fav-save-btn`, `.fav-btn`, `.lang-btn`, `.panel-close`, `.toast-action-btn`. `gap: 8px` sur toolbar/fav-actions, 6px sur light-preset. |

## Tests de régression

Fichier : `tests/e2e/qa-regression.spec.ts` (Playwright).

Couvre : viewports overflow (320/375/414/768/1366), nom 200 chars, doublon refusé, focus visible au Tab, Escape×2, maxLength 80, preset invalide.
