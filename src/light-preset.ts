import type { LightPreset } from '@/types/mapbox.ts';

const STORAGE_KEY = 'mapbox-light-preset';
const VALID: LightPreset[] = ['dawn', 'day', 'dusk', 'night'];

function isValidPreset(v: string | null): v is LightPreset {
  return v !== null && (VALID as string[]).includes(v);
}

export function getStoredPreset(fallback: LightPreset = 'dusk'): LightPreset {
  const v = localStorage.getItem(STORAGE_KEY);
  return isValidPreset(v) ? v : fallback;
}

interface PresetCapableMap {
  setConfigProperty(importId: string, configName: string, value: unknown): void;
}

export interface PresetController {
  current: () => LightPreset;
  set: (preset: LightPreset) => void;
}

export function initLightPresetBar(map: PresetCapableMap, initial: LightPreset): PresetController {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    '.light-preset-bar button[data-preset]'
  );
  let active: LightPreset = initial;
  const apply = (preset: LightPreset): void => {
    active = preset;
    map.setConfigProperty('basemap', 'lightPreset', preset);
    localStorage.setItem(STORAGE_KEY, preset);
    buttons.forEach((b) => b.classList.toggle('active', b.dataset.preset === preset));
    window.dispatchEvent(new CustomEvent('mapbox3d:preset-change', { detail: preset }));
  };
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.preset;
      if (isValidPreset(p ?? null)) apply(p as LightPreset);
    });
  });
  apply(initial);
  return {
    current: () => active,
    set: (preset) => apply(preset),
  };
}
