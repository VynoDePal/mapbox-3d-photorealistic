import type { Map as MapboxMap } from 'mapbox-gl';
import { suggest, retrieve, GeocodingError } from '@/geocoding.ts';
import type { SearchBoxSuggestion } from '@/types/mapbox.ts';
import { t } from '@/i18n/index.ts';
import { adaptiveFlyTo } from '@/utils/motion.ts';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

export function initSearch(map: MapboxMap): void {
  const input = document.getElementById('search-input') as HTMLInputElement | null;
  const list = document.getElementById('search-results') as HTMLUListElement | null;
  const spinner = document.getElementById('search-spinner') as HTMLSpanElement | null;
  if (!input || !list || !spinner) return;

  let debounceId: number | undefined;
  let abortCtrl: AbortController | undefined;
  let activeIndex = -1;
  let suggestions: SearchBoxSuggestion[] = [];

  const setLoading = (loading: boolean): void => {
    spinner.classList.toggle('visible', loading);
  };

  const closeDropdown = (): void => {
    list.hidden = true;
    list.innerHTML = '';
    activeIndex = -1;
    suggestions = [];
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const renderError = (msg: string): void => {
    list.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'no-result';
    li.textContent = msg;
    list.appendChild(li);
    list.hidden = false;
  };

  const renderSuggestions = (items: SearchBoxSuggestion[]): void => {
    list.innerHTML = '';
    if (items.length === 0) {
      renderError(t('searchNoResults'));
      return;
    }
    items.forEach((s, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = `search-result-${i}`;
      li.dataset.index = String(i);
      const name = document.createElement('span');
      name.className = 'result-name';
      name.textContent = s.name ?? s.full_address ?? '—';
      const detail = document.createElement('span');
      detail.className = 'result-detail';
      detail.textContent = s.place_formatted ?? s.full_address ?? '';
      li.append(name, detail);
      li.addEventListener('click', () => {
        void choose(i);
      });
      list.appendChild(li);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const updateSelection = (): void => {
    Array.from(list.children).forEach((el, i) => {
      el.setAttribute('aria-selected', String(i === activeIndex));
    });
    if (activeIndex >= 0) {
      input.setAttribute('aria-activedescendant', `search-result-${activeIndex}`);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };

  const choose = async (index: number): Promise<void> => {
    const item = suggestions[index];
    if (!item) return;
    setLoading(true);
    try {
      const feature = await retrieve(item.mapbox_id);
      const [lng, lat] = feature.geometry.coordinates;
      input.value = item.name ?? item.full_address ?? '';
      closeDropdown();
      adaptiveFlyTo(map, {
        center: [lng, lat],
        zoom: 17,
        pitch: 70,
        bearing: -20,
        duration: 5000,
        curve: 1.42,
        essential: true,
      });
    } catch (err) {
      renderError(err instanceof GeocodingError ? err.message : t('searchNetworkError'));
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async (query: string): Promise<void> => {
    abortCtrl?.abort();
    abortCtrl = new AbortController();
    setLoading(true);
    try {
      const items = await suggest(query, { signal: abortCtrl.signal });
      suggestions = items;
      renderSuggestions(items);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      renderError(err instanceof GeocodingError ? err.message : t('searchNetworkError'));
    } finally {
      setLoading(false);
    }
  };

  input.addEventListener('input', () => {
    const query = input.value.trim();
    if (debounceId !== undefined) clearTimeout(debounceId);
    if (query.length < MIN_CHARS) {
      closeDropdown();
      return;
    }
    debounceId = window.setTimeout(() => {
      void runSearch(query);
    }, DEBOUNCE_MS);
  });

  input.addEventListener('keydown', (e) => {
    if (list.hidden || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % suggestions.length;
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + suggestions.length) % suggestions.length;
      updateSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) void choose(activeIndex);
      else if (suggestions.length > 0) void choose(0);
    } else if (e.key === 'Escape') {
      closeDropdown();
      input.blur();
    }
  });

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.search-shell')) closeDropdown();
  });
}
