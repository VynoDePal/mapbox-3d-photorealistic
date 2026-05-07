import { suggest, retrieve, GeocodingError } from './geocoding.js';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

export function initSearch(map) {
  const input = document.getElementById('search-input');
  const list = document.getElementById('search-results');
  const spinner = document.getElementById('search-spinner');

  let debounceId;
  let abortCtrl;
  let activeIndex = -1;
  let suggestions = [];

  const setLoading = (loading) => spinner.classList.toggle('visible', loading);

  const closeDropdown = () => {
    list.hidden = true;
    list.innerHTML = '';
    activeIndex = -1;
    suggestions = [];
  };

  const renderError = (msg) => {
    list.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'no-result';
    li.textContent = msg;
    list.appendChild(li);
    list.hidden = false;
  };

  const renderSuggestions = (items) => {
    list.innerHTML = '';
    if (items.length === 0) {
      renderError('Aucun résultat');
      return;
    }
    items.forEach((s, i) => {
      const li = document.createElement('li');
      li.role = 'option';
      li.dataset.index = String(i);
      const name = document.createElement('span');
      name.className = 'result-name';
      name.textContent = s.name ?? s.full_address ?? '—';
      const detail = document.createElement('span');
      detail.className = 'result-detail';
      detail.textContent = s.place_formatted ?? s.full_address ?? '';
      li.append(name, detail);
      li.addEventListener('click', () => choose(i));
      list.appendChild(li);
    });
    list.hidden = false;
  };

  const updateSelection = () => {
    [...list.children].forEach((el, i) => {
      el.setAttribute('aria-selected', String(i === activeIndex));
    });
  };

  const choose = async (index) => {
    const item = suggestions[index];
    if (!item) return;
    setLoading(true);
    try {
      const feature = await retrieve(item.mapbox_id);
      const [lng, lat] = feature.geometry.coordinates;
      input.value = item.name ?? item.full_address ?? '';
      closeDropdown();
      map.flyTo({
        center: [lng, lat],
        zoom: 17,
        pitch: 70,
        bearing: -20,
        duration: 5000,
        curve: 1.42,
        essential: true,
      });
    } catch (err) {
      renderError(err instanceof GeocodingError ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async (query) => {
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    setLoading(true);
    try {
      const items = await suggest(query, { signal: abortCtrl.signal });
      suggestions = items;
      renderSuggestions(items);
    } catch (err) {
      if (err.name === 'AbortError') return;
      renderError(err instanceof GeocodingError ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearTimeout(debounceId);
    if (query.length < MIN_CHARS) {
      closeDropdown();
      return;
    }
    debounceId = setTimeout(() => runSearch(query), DEBOUNCE_MS);
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
      if (activeIndex >= 0) choose(activeIndex);
      else if (suggestions.length > 0) choose(0);
    } else if (e.key === 'Escape') {
      closeDropdown();
      input.blur();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-shell')) closeDropdown();
  });
}
