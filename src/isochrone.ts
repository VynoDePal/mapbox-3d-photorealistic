import type { Map as MapboxMap } from 'mapbox-gl';
import { showToast } from '@/ui/toast.ts';
import type { IsochroneFeatureCollection, DirectionsProfile } from '@/types/mapbox.ts';
import { t } from '@/i18n/index.ts';

const SOURCE_ID = 'isochrone-src';
const LAYER_ID = 'isochrone-fill';

type IsoProfile = Extract<DirectionsProfile, 'driving' | 'walking' | 'cycling'>;

export interface IsochroneController {
  destroy(): void;
}

export function initIsochrone(map: MapboxMap): IsochroneController {
  const toggleBtn = document.getElementById('btn-isochrone');
  const controls = document.getElementById('iso-controls');
  const profileSelect = document.getElementById('iso-profile') as HTMLSelectElement | null;
  const clearBtn = document.getElementById('iso-clear');
  if (!toggleBtn || !controls || !profileSelect || !clearBtn) return { destroy: () => undefined };

  let active = false;
  let profile: IsoProfile = 'walking';
  let abortCtrl: AbortController | undefined;
  let lastClick: { lng: number; lat: number } | null = null;

  profileSelect.addEventListener('change', () => {
    profile = (profileSelect.value as IsoProfile) || 'walking';
    if (lastClick) void compute(lastClick.lng, lastClick.lat);
  });

  toggleBtn.addEventListener('click', () => {
    active = !active;
    toggleBtn.classList.toggle('active', active);
    controls.hidden = !active;
    map.getCanvas().style.cursor = active ? 'crosshair' : '';
    if (active) {
      showToast(t('isoHint'));
    } else {
      removeLayer();
      lastClick = null;
    }
  });

  clearBtn.addEventListener('click', () => {
    removeLayer();
    lastClick = null;
  });

  const onClick = (e: mapboxgl.MapMouseEvent): void => {
    if (!active) return;
    e.preventDefault?.();
    lastClick = { lng: e.lngLat.lng, lat: e.lngLat.lat };
    void compute(e.lngLat.lng, e.lngLat.lat);
  };
  map.on('click', onClick);

  async function compute(lng: number, lat: number): Promise<void> {
    abortCtrl?.abort();
    abortCtrl = new AbortController();
    const url = new URL('/api/isochrone', window.location.origin);
    url.searchParams.set('lng', String(lng));
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('profile', profile);
    url.searchParams.set('minutes', '10,20,30');
    try {
      const res = await fetch(url, { signal: abortCtrl.signal });
      if (!res.ok) {
        showToast(t('isoHttpError', res.status));
        return;
      }
      const data = (await res.json()) as IsochroneFeatureCollection;
      drawLayer(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showToast(t('isoNetworkError'));
    }
  }

  function drawLayer(data: IsochroneFeatureCollection): void {
    const existing = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data as unknown as GeoJSON.FeatureCollection);
    } else {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: data as unknown as GeoJSON.FeatureCollection,
      });
      map.addLayer({
        id: LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          // Mapbox Isochrone returns features with `contour` in minutes; smaller
          // contour = inner ring, drawn last so the outer rings show through.
          'fill-color': [
            'match',
            ['get', 'contour'],
            10,
            '#4ade80',
            20,
            '#facc15',
            30,
            '#f87171',
            '#ffffff',
          ],
          'fill-opacity': [
            'match',
            ['get', 'contour'],
            10,
            0.4,
            20,
            0.3,
            30,
            0.2,
            0.1,
          ],
          'fill-outline-color': 'rgba(0,0,0,0.4)',
        },
      });
    }
  }

  function removeLayer(): void {
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  }

  return {
    destroy: () => {
      removeLayer();
      map.off('click', onClick);
      abortCtrl?.abort();
    },
  };
}
