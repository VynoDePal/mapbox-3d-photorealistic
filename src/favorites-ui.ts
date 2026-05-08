import type { Map as MapboxMap } from 'mapbox-gl';
import { add, list, remove, rename, type Favorite, type FavoriteInput } from '@/favorites.ts';
import { createPanel, h, type PanelHandle } from '@/ui/panel.ts';
import { showToast } from '@/ui/toast.ts';
import type { PresetController } from '@/light-preset.ts';
import type { LightPreset } from '@/types/mapbox.ts';

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
}

export function initFavoritesPanel(map: MapboxMap, preset: PresetController): void {
  const trigger = document.getElementById('btn-favorites');
  if (!trigger) return;

  const panel = createPanel({ title: 'Mes lieux', side: 'right' });
  trigger.addEventListener('click', () => panel.toggle());

  const render = (): void => {
    panel.setBody(buildBody(map as unknown as FavMap, preset, render, panel));
  };
  render();
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
    placeholder: 'Nom du lieu (ex : Notre-Dame)',
    'aria-label': 'Nom du lieu',
    class: 'fav-input',
  }) as HTMLInputElement;

  const saveBtn = h('button', {
    type: 'button',
    class: 'fav-save-btn',
  }, ['+ Sauvegarder cette vue']);

  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      showToast('Donne un nom au lieu d’abord');
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
    showToast(`« ${name} » sauvegardé`);
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
    wrapper.append(
      h('p', { class: 'fav-empty' }, [
        'Aucun lieu sauvegardé. Navigue sur la carte, ajuste l’angle, puis sauvegarde la vue.',
      ])
    );
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

  const goBtn = h('button', { type: 'button', class: 'fav-btn fav-go', 'aria-label': `Aller à ${fav.name}` }, ['Aller']);
  goBtn.addEventListener('click', () => {
    map.flyTo({
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

  const renameBtn = h('button', {
    type: 'button',
    class: 'fav-btn fav-rename',
    'aria-label': `Renommer ${fav.name}`,
  }, ['✎']);
  renameBtn.addEventListener('click', () => {
    const next = window.prompt('Nouveau nom :', fav.name);
    if (next !== null && next.trim()) {
      rename(fav.id, next);
      rerender();
    }
  });

  const delBtn = h('button', {
    type: 'button',
    class: 'fav-btn fav-del',
    'aria-label': `Supprimer ${fav.name}`,
  }, ['×']);
  delBtn.addEventListener('click', () => {
    remove(fav.id);
    showToast(`« ${fav.name} » supprimé`);
    rerender();
  });

  return h('li', { class: 'fav-item' }, [
    h('div', { class: 'fav-item-main' }, [nameEl, presetChip]),
    h('div', { class: 'fav-item-actions' }, [goBtn, renameBtn, delBtn]),
  ]);
}
