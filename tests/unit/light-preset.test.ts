import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getStoredPreset, initLightPresetBar } from '@/light-preset.ts';

describe('light-preset', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div class="light-preset-bar">
        <button data-preset="dawn" type="button">Dawn</button>
        <button data-preset="day" type="button">Day</button>
        <button data-preset="dusk" type="button">Dusk</button>
        <button data-preset="night" type="button">Night</button>
      </div>
    `;
  });

  describe('getStoredPreset', () => {
    it('returns the stored preset when valid', () => {
      localStorage.setItem('mapbox-light-preset', 'night');
      expect(getStoredPreset('dusk')).toBe('night');
    });

    it('returns the fallback when storage is empty', () => {
      expect(getStoredPreset('dawn')).toBe('dawn');
    });

    it('returns the fallback when storage holds an invalid value', () => {
      localStorage.setItem('mapbox-light-preset', 'noon');
      expect(getStoredPreset('dusk')).toBe('dusk');
    });
  });

  describe('initLightPresetBar', () => {
    it('marks the initial button active and calls setConfigProperty', () => {
      const map = { setConfigProperty: vi.fn() };
      initLightPresetBar(map, 'dusk');
      expect(map.setConfigProperty).toHaveBeenCalledWith('basemap', 'lightPreset', 'dusk');
      const active = document.querySelector<HTMLButtonElement>('button.active');
      expect(active?.dataset.preset).toBe('dusk');
    });

    it('switches active state and persists to localStorage on click', () => {
      const map = { setConfigProperty: vi.fn() };
      initLightPresetBar(map, 'dusk');
      const dayBtn = document.querySelector<HTMLButtonElement>('button[data-preset="day"]');
      dayBtn?.click();
      expect(map.setConfigProperty).toHaveBeenLastCalledWith('basemap', 'lightPreset', 'day');
      expect(localStorage.getItem('mapbox-light-preset')).toBe('day');
      expect(document.querySelector('button.active')?.getAttribute('data-preset')).toBe('day');
    });
  });
});
