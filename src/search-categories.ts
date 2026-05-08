import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import { showToast } from '@/ui/toast.ts';
import { lngLatToParam } from '@/utils/geo.ts';
import type { SearchBoxRetrieveFeature } from '@/types/mapbox.ts';

interface CategoryDef {
  id: string;
  label: string;
  icon: string;
  color: string;
}

// Mapbox Search Box canonical category IDs.
const CATEGORIES: readonly CategoryDef[] = [
  { id: 'restaurant', label: 'Restaurants', icon: '🍽', color: '#f87171' },
  { id: 'hotel', label: 'Hôtels', icon: '🏨', color: '#a78bfa' },
  { id: 'coffee', label: 'Cafés', icon: '☕', color: '#facc15' },
  { id: 'museum', label: 'Musées', icon: '🏛', color: '#60a5fa' },
  { id: 'park', label: 'Parcs', icon: '🌳', color: '#4ade80' },
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
    markers.forEach((m) => m.remove());
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
        showToast(`Erreur Catégories HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as CategoryResponse;
      clearMarkers();
      if (data.features.length === 0) {
        showToast(`Aucun ${def.label.toLowerCase()} à proximité`);
        return;
      }
      data.features.forEach((f) => {
        const [lng, lat] = f.geometry.coordinates;
        const el = document.createElement('div');
        el.className = 'cat-marker';
        el.style.background = def.color;
        el.textContent = def.icon;
        el.setAttribute('aria-label', f.properties?.name ?? def.label);
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
      showToast('Erreur réseau (Catégories)');
    }
  };

  // Build chips
  CATEGORIES.forEach((def) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cat-chip';
    btn.dataset.category = def.id;
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `<span class="cat-chip-icon" style="background:${def.color}">${def.icon}</span><span>${def.label}</span>`;
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

  return {
    destroy: () => {
      clearMarkers();
      abortCtrl?.abort();
    },
  };
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c
  );
}
