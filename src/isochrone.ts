import type { Map as MapboxMap } from 'mapbox-gl';
import { showToast } from '@/ui/toast.ts';
import type { IsochroneFeatureCollection, DirectionsProfile } from '@/types/mapbox.ts';
import { t } from '@/i18n/index.ts';
import type { DirectionsController } from '@/directions.ts';

const SOURCE_ID = 'isochrone-src';
const LAYER_ID = 'isochrone-fill';

type IsoProfile = Extract<DirectionsProfile, 'driving' | 'walking' | 'cycling'>;

export interface IsochroneController {
  destroy(): void;
}

// BUG-003 v2 : si un controller Directions est passé, le 1er waypoint est
// utilisé comme centre de calcul et le profil est synchronisé avec celui
// d'Itinéraire. Sinon, comportement legacy (clic carte = centre).
export function initIsochrone(map: MapboxMap, directions?: DirectionsController): IsochroneController {
  const toggleBtn = document.getElementById('btn-isochrone');
  const controls = document.getElementById('iso-controls');
  const profileSelect = document.getElementById('iso-profile') as HTMLSelectElement | null;
  const clearBtn = document.getElementById('iso-clear');
  if (!toggleBtn || !controls || !profileSelect || !clearBtn) return { destroy: () => undefined };

  let active = false;
  let profile: IsoProfile = 'walking';
  let abortCtrl: AbortController | undefined;
  let lastClick: { lng: number; lat: number } | null = null;

  const currentProfile = (): IsoProfile => {
    // Sync with Directions when available (BUG-003 v2).
    const fromDir = directions?.getProfile();
    if (fromDir && (fromDir === 'driving' || fromDir === 'walking' || fromDir === 'cycling')) {
      return fromDir;
    }
    return profile;
  };

  const refreshFromDirections = (): void => {
    if (!active) return;
    const wps = directions?.getWaypoints() ?? [];
    if (wps.length > 0) {
      const start = wps[0]!;
      lastClick = { lng: start.lng, lat: start.lat };
      void compute(start.lng, start.lat);
    } else {
      removeLayer();
      lastClick = null;
    }
  };

  profileSelect.addEventListener('change', () => {
    profile = (profileSelect.value as IsoProfile) || 'walking';
    if (lastClick) void compute(lastClick.lng, lastClick.lat);
  });

  toggleBtn.addEventListener('click', () => {
    active = !active;
    toggleBtn.classList.toggle('active', active);
    controls.hidden = !active;
    if (active) {
      const wps = directions?.getWaypoints() ?? [];
      if (wps.length > 0) {
        toggleBtn.removeAttribute('title');
        map.getCanvas().style.cursor = '';
        const start = wps[0]!;
        lastClick = { lng: start.lng, lat: start.lat };
        directions?.setIsoLegendVisible(true);
        void compute(start.lng, start.lat);
      } else {
        toggleBtn.setAttribute('title', t('isoNeedWaypoint'));
        map.getCanvas().style.cursor = 'crosshair';
        showToast(t('isoHint'));
      }
    } else {
      toggleBtn.removeAttribute('title');
      map.getCanvas().style.cursor = '';
      directions?.setIsoLegendVisible(false);
      removeLayer();
      lastClick = null;
    }
  });

  clearBtn.addEventListener('click', () => {
    removeLayer();
    lastClick = null;
  });

  // React to Directions changes (waypoint added/removed/dragged, profile change).
  window.addEventListener('mapbox3d:directions-change', refreshFromDirections);

  const onClick = (e: mapboxgl.MapMouseEvent): void => {
    if (!active) return;
    // Skip standalone clicks when the Directions panel is providing the start.
    if (directions && (directions.getWaypoints().length ?? 0) > 0) return;
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
    url.searchParams.set('profile', currentProfile());
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
      window.removeEventListener('mapbox3d:directions-change', refreshFromDirections);
      abortCtrl?.abort();
    },
  };
}
