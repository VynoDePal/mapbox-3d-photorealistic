import type { LightPreset } from '@/types/mapbox.ts';
import type { PresetController } from '@/light-preset.ts';

// Map a 0-23 local hour to a lightPreset.
// Boundaries chosen for natural transitions: dawn 5-7, day 7-18, dusk 18-21, night otherwise.
export function presetForHour(hour: number): LightPreset {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 18) return 'day';
  if (h >= 18 && h < 21) return 'dusk';
  return 'night';
}

// Coarse timezone heuristic from longitude — no DST, no proper IANA tzdb.
// Enough for the "auto preset" demo: ~95% accuracy on populated areas.
export function localHour(lng: number, nowUtcMs: number): number {
  const tzOffsetHours = Math.round(lng / 15);
  const ms = nowUtcMs + tzOffsetHours * 3_600_000;
  const d = new Date(ms);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export function presetForLngAt(lng: number, nowUtcMs: number = Date.now()): LightPreset {
  return presetForHour(localHour(lng, nowUtcMs));
}

interface AutoMap {
  getCenter(): { lng: number };
  on(event: 'moveend', listener: () => void): void;
  off(event: 'moveend', listener: () => void): void;
}

export interface AutoController {
  enabled: () => boolean;
  toggle: () => void;
  destroy: () => void;
}

export function initAutoPreset(map: AutoMap, preset: PresetController): AutoController {
  const btn = document.querySelector<HTMLButtonElement>('.light-preset-bar button[data-preset="auto"]');
  if (!btn) {
    return { enabled: () => false, toggle: () => undefined, destroy: () => undefined };
  }

  let enabled = false;
  let intervalId: number | undefined;

  const apply = (): void => {
    if (!enabled) return;
    const lng = map.getCenter().lng;
    preset.set(presetForLngAt(lng));
  };

  const onMove = (): void => {
    if (enabled) apply();
  };

  const enable = (): void => {
    enabled = true;
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    map.on('moveend', onMove);
    intervalId = window.setInterval(apply, 60_000);
    apply();
  };

  const disable = (): void => {
    enabled = false;
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
    map.off('moveend', onMove);
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
      intervalId = undefined;
    }
  };

  btn.addEventListener('click', () => (enabled ? disable() : enable()));

  // When the user picks a manual preset, auto turns off.
  window.addEventListener('mapbox3d:preset-change', (e) => {
    const detail = (e as CustomEvent<LightPreset>).detail;
    // If we just set this preset programmatically, ignore.
    if (!enabled) return;
    const expected = presetForLngAt(map.getCenter().lng);
    if (detail !== expected) disable();
  });

  return {
    enabled: () => enabled,
    toggle: () => (enabled ? disable() : enable()),
    destroy: () => disable(),
  };
}
