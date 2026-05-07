const STORAGE_KEY = 'mapbox-light-preset';
const VALID = ['dawn', 'day', 'dusk', 'night'];

export function getStoredPreset(fallback = 'dusk') {
  const v = localStorage.getItem(STORAGE_KEY);
  return VALID.includes(v) ? v : fallback;
}

export function initLightPresetBar(map, initial) {
  const buttons = document.querySelectorAll('.light-preset-bar button[data-preset]');
  const apply = (preset) => {
    map.setConfigProperty('basemap', 'lightPreset', preset);
    localStorage.setItem(STORAGE_KEY, preset);
    buttons.forEach((b) => b.classList.toggle('active', b.dataset.preset === preset));
  };
  buttons.forEach((btn) => btn.addEventListener('click', () => apply(btn.dataset.preset)));
  apply(initial);
}
