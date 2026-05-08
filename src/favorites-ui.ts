import type { Map as MapboxMap } from 'mapbox-gl';
import { add, findByName, list, remove, rename, type Favorite, type FavoriteInput } from '@/favorites.ts';
import { createPanel, h, type PanelHandle } from '@/ui/panel.ts';
import { showToast, showActionToast } from '@/ui/toast.ts';
import type { PresetController } from '@/light-preset.ts';
import type { LightPreset } from '@/types/mapbox.ts';
import { t } from '@/i18n/index.ts';
import { adaptiveFlyTo } from '@/utils/motion.ts';
import { onLangChange } from '@/i18n/index.ts';
import { truncate } from '@/utils/format.ts';

interface FavMap {
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  getPitch(): number;
  getBearing(): number;
  flyTo(opts: {
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
    duration: number;
    curve: number;
    essential: boolean;
  }): void;
  jumpTo(opts: { center: [number, number]; zoom: number; pitch: number; bearing: number }): void;
}

export function initFavoritesPanel(map: MapboxMap, preset: PresetController): void {
  const trigger = document.getElementById('btn-favorites');
  if (!trigger) return;

  const panel = createPanel({ title: t('favPanelTitle'), side: 'right' });
  trigger.addEventListener('click', () => panel.toggle());

  const render = (): void => {
    panel.setBody(buildBody(map as unknown as FavMap, preset, render, panel));
  };
  render();
  onLangChange(() => render());
}

function buildBody(
  map: FavMap,
  preset: PresetController,
  rerender: () => void,
  panel: PanelHandle
): HTMLElement {
  const wrapper = h('div', { class: 'fav-wrapper' });

  // "Save current view" form
  const nameInput = h('input', {
    type: 'text',
    placeholder: t('favPlaceholder'),
    'aria-label': t('favPlaceholder'),
    class: 'fav-input',
  }) as HTMLInputElement;

  const saveBtn = h('button', {
    type: 'button',
    class: 'fav-save-btn',
  }, [t('favSave')]);

  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      showToast(t('favSaveNeedName'));
      return;
    }
    if (findByName(name)) {
      nameInput.focus();
      nameInput.select();
      showToast(t('favDuplicate'));
      return;
    }
    const c = map.getCenter();
    const input: FavoriteInput = {
      name,
      lng: c.lng,
      lat: c.lat,
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
      preset: preset.current(),
    };
    add(input);
    nameInput.value = '';
    showToast(t('favSaved', truncate(name, 40)));
    rerender();
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });

  wrapper.append(
    h('div', { class: 'fav-form' }, [nameInput, saveBtn])
  );

  // List of favorites
  const items = list();
  if (items.length === 0) {
    wrapper.append(h('p', { class: 'fav-empty' }, [t('favEmpty')]));
  } else {
    const ul = h('ul', { class: 'fav-list' });
    for (const fav of items) {
      ul.append(buildItem(fav, map, preset, rerender, panel));
    }
    wrapper.append(ul);
  }

  return wrapper;
}

function buildItem(
  fav: Favorite,
  map: FavMap,
  preset: PresetController,
  rerender: () => void,
  panel: PanelHandle
): HTMLElement {
  const nameEl = h('span', { class: 'fav-name' }, [fav.name]);
  const presetChip = h('span', {
    class: 'fav-chip',
    dataset: { preset: fav.preset },
  }, [fav.preset]);

  const goBtn = h(
    'button',
    { type: 'button', class: 'fav-btn fav-go', 'aria-label': `${t('favGo')} — ${fav.name}` },
    [t('favGo')]
  );
  goBtn.addEventListener('click', () => {
    adaptiveFlyTo(map, {
      center: [fav.lng, fav.lat],
      zoom: fav.zoom,
      pitch: fav.pitch,
      bearing: fav.bearing,
      duration: 5000,
      curve: 1.42,
      essential: true,
    });
    preset.set(fav.preset as LightPreset);
    panel.close();
  });

  const renameBtn = h(
    'button',
    { type: 'button', class: 'fav-btn fav-rename', 'aria-label': `${t('favRename')} — ${fav.name}` },
    [t('favRename')]
  );
  renameBtn.addEventListener('click', () => {
    const next = window.prompt(t('favRenamePrompt'), fav.name);
    if (next !== null && next.trim()) {
      rename(fav.id, next);
      rerender();
    }
  });

  const delBtn = h(
    'button',
    { type: 'button', class: 'fav-btn fav-del', 'aria-label': `${t('favDelete')} — ${fav.name}` },
    [t('favDelete')]
  );

  const li = h('li', { class: 'fav-item', dataset: { id: fav.id } }, [
    h('div', { class: 'fav-item-main' }, [nameEl, presetChip]),
    h('div', { class: 'fav-item-actions' }, [goBtn, renameBtn, delBtn]),
  ]);

  delBtn.addEventListener('click', () => {
    // Optimistic hide; actual remove fires after the undo window.
    li.classList.add('fav-item--pending-delete');
    void (async () => {
      const undone = await showActionToast(
        t('favRemoved', truncate(fav.name, 40)),
        t('undo'),
        5000
      );
      if (undone) {
        li.classList.remove('fav-item--pending-delete');
      } else {
        remove(fav.id);
        rerender();
      }
    })();
  });

  return li;
}
