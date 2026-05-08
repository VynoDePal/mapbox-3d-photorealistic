import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import { showToast } from '@/ui/toast.ts';
import { lngLatToParam } from '@/utils/geo.ts';
import type { SearchBoxRetrieveFeature } from '@/types/mapbox.ts';
import { t, onLangChange, type DictKey } from '@/i18n/index.ts';

interface CategoryDef {
  id: string;
  labelKey: DictKey;
  icon: string;
  color: string;
}

// Mapbox Search Box canonical category IDs.
const CATEGORIES: readonly CategoryDef[] = [
  { id: 'restaurant', labelKey: 'categoryRestaurants', icon: '🍽', color: '#f87171' },
  { id: 'hotel', labelKey: 'categoryHotels', icon: '🏨', color: '#a78bfa' },
  { id: 'coffee', labelKey: 'categoryCafes', icon: '☕', color: '#facc15' },
  { id: 'museum', labelKey: 'categoryMuseums', icon: '🏛', color: '#60a5fa' },
  { id: 'park', labelKey: 'categoryParks', icon: '🌳', color: '#4ade80' },
];

interface CategoryResponse {
  type: 'FeatureCollection';
  features: SearchBoxRetrieveFeature[];
}

export interface CategoryController {
  destroy(): void;
}

export function initSearchCategories(map: MapboxMap): CategoryController {
  const container = document.getElementById('category-chips');
  if (!container) return { destroy: () => undefined };

  let activeCategory: string | null = null;
  let abortCtrl: AbortController | undefined;
  const markers: mapboxgl.Marker[] = [];

  const clearMarkers = (): void => {
    // BUG-004 v2 : explicitly close any popup tied to a marker before
    // removing it. mapboxgl's marker.remove() sometimes leaves an
    // already-opened popup on the map; close them defensively.
    markers.forEach((m) => {
      const popup = m.getPopup();
      if (popup?.isOpen()) popup.remove();
      m.remove();
    });
    markers.length = 0;
  };

  const setActive = (id: string | null): void => {
    activeCategory = id;
    container.querySelectorAll<HTMLButtonElement>('button[data-category]').forEach((b) => {
      b.classList.toggle('active', b.dataset.category === id);
    });
  };

  const fetchCategory = async (def: CategoryDef): Promise<void> => {
    abortCtrl?.abort();
    abortCtrl = new AbortController();
    const c = map.getCenter();
    const url = new URL(
      `/api/category/${encodeURIComponent(def.id)}`,
      window.location.origin
    );
    url.searchParams.set('proximity', lngLatToParam(c.lng, c.lat));
    url.searchParams.set('limit', '12');
    try {
      const res = await fetch(url, { signal: abortCtrl.signal });
      if (!res.ok) {
        showToast(t('dirHttpError', res.status));
        return;
      }
      const data = (await res.json()) as CategoryResponse;
      clearMarkers();
      if (data.features.length === 0) {
        showToast(t('categoryNoneNearby', t(def.labelKey) as string));
        return;
      }
      data.features.forEach((f) => {
        const [lng, lat] = f.geometry.coordinates;
        const el = document.createElement('div');
        el.className = 'cat-marker';
        el.style.background = def.color;
        el.textContent = def.icon;
        el.setAttribute('aria-label', f.properties?.name ?? (t(def.labelKey) as string));
        const popup = new mapboxgl.Popup({ offset: 16 }).setHTML(
          `<div><strong>${escapeHtml(f.properties?.name ?? '—')}</strong></div>` +
            (f.properties?.full_address
              ? `<div style="color:var(--text-dim);font-size:12px;margin-top:4px">${escapeHtml(f.properties.full_address)}</div>`
              : '')
        );
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);
        markers.push(marker);
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showToast(t('searchNetworkError'));
    }
  };

  // Build chips
  const chipLabels = new Map<string, HTMLSpanElement>();
  CATEGORIES.forEach((def) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cat-chip';
    btn.dataset.category = def.id;
    btn.setAttribute('aria-pressed', 'false');
    const labelEl = document.createElement('span');
    labelEl.textContent = t(def.labelKey) as string;
    chipLabels.set(def.id, labelEl);
    btn.innerHTML = `<span class="cat-chip-icon" style="background:${def.color}">${def.icon}</span>`;
    btn.append(labelEl);
    btn.addEventListener('click', () => {
      if (activeCategory === def.id) {
        clearMarkers();
        setActive(null);
        return;
      }
      setActive(def.id);
      void fetchCategory(def);
    });
    container.append(btn);
  });

  // Re-translate chip labels on language change.
  const offLang = onLangChange(() => {
    CATEGORIES.forEach((def) => {
      const labelEl = chipLabels.get(def.id);
      if (labelEl) labelEl.textContent = t(def.labelKey) as string;
    });
  });

  return {
    destroy: () => {
      clearMarkers();
      abortCtrl?.abort();
      offLang();
    },
  };
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c
  );
}
