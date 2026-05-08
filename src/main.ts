// Style retry strategy (BUG-007): the upstream `mapbox/standard` style
// occasionally returns 503 at boot. Mapbox-gl retries internally once; if it
// still fails to apply, we surface a non-blocking toast and trigger a single
// `map.setStyle(...)` after 3s to give the CDN a chance to recover. Guarded
// by a flag so we never loop.
import mapboxgl, { type MapMouseEvent } from 'mapbox-gl';
import { initSearch } from '@/search.ts';
import { initLightPresetBar, getStoredPreset, type PresetController } from '@/light-preset.ts';
import { reverse, GeocodingError } from '@/geocoding.ts';
import { bindToMap as bindUrlState, readHashState } from '@/url-state.ts';
import { initFavoritesPanel } from '@/favorites-ui.ts';
import { showToast } from '@/ui/toast.ts';
import { initDirections } from '@/directions.ts';
import { initSearchCategories } from '@/search-categories.ts';
import { initIsochrone } from '@/isochrone.ts';
import { initStory } from '@/story.ts';
import { initAutoPreset } from '@/light-preset-auto.ts';
import { initI18nUI, applyStaticTranslations } from '@/i18n-ui.ts';
import { t } from '@/i18n/index.ts';

const TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

applyStaticTranslations();
if (!TOKEN || TOKEN.startsWith('pk.your_token')) {
  showFatalError(
    t('errTokenMissing'),
    t('errTokenMissingHint'),
    'VITE_MAPBOX_PUBLIC_TOKEN=pk.xxx',
    t('errTokenMissingHelp')
  );
} else {
  mapboxgl.accessToken = TOKEN;
  bootstrap();
}

function showFatalError(title: string, ...lines: string[]): void {
  const root = document.getElementById('map');
  if (!root) return;
  const err = document.createElement('div');
  err.className = 'fatal-error';
  const inner = document.createElement('div');
  inner.innerHTML =
    `<h1>${title}</h1>` +
    lines
      .map((l) => (l.startsWith('VITE_') ? `<code>${l}</code>` : `<p>${l}</p>`))
      .join('');
  err.appendChild(inner);
  root.appendChild(err);
}

function bootstrap(): void {
  const hashState = readHashState();
  const initialPreset = hashState?.preset ?? getStoredPreset('dusk');

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/standard',
    center: hashState ? [hashState.lng, hashState.lat] : [2.2945, 48.8584],
    zoom: hashState?.zoom ?? 16,
    pitch: hashState?.pitch ?? 70,
    bearing: hashState?.bearing ?? -20,
    antialias: true,
  });

  // Expose map for E2E tests in non-prod builds.
  if (import.meta.env.MODE !== 'production') {
    (window as unknown as { __map?: mapboxgl.Map }).__map = map;
  }

  map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
  map.addControl(
    new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showUserHeading: true,
    }),
    'top-right'
  );

  let styleRetried = false;
  map.on('error', (e) => {
    const err = e.error as { status?: number; message?: string; url?: string } | undefined;
    const status = err?.status;
    if (status === 401) {
      showFatalError(t('errTokenInvalid'), t('errTokenInvalidHint'), t('errTokenInvalidHelp'));
      return;
    }
    // BUG-007: 503 (and other transient failures) on the style endpoint.
    const isStyleFailure =
      (status !== undefined && status >= 500 && status < 600) ||
      err?.url?.includes('/styles/v1/') ||
      err?.message?.toLowerCase().includes('style');
    if (isStyleFailure && !styleRetried) {
      styleRetried = true;
      // eslint-disable-next-line no-console
      console.warn('[mapbox] style load failed', { status, url: err?.url, message: err?.message });
      showToast(t('styleRetrying'), 4000);
      setTimeout(() => {
        try {
          map.setStyle('mapbox://styles/mapbox/standard');
        } catch (retryErr) {
          // eslint-disable-next-line no-console
          console.warn('[mapbox] style retry failed', retryErr);
        }
      }, 3000);
    }
  });

  map.on('style.load', () => {
    if (!map.getSource('mapbox-dem')) {
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
    }
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    map.setFog({
      range: [0.5, 10],
      color: 'rgba(180, 200, 220, 0.4)',
      'horizon-blend': 0.2,
      'high-color': '#245cdf',
      'space-color': '#000000',
      'star-intensity': 0.6,
    });

    const presetCtl = initLightPresetBar(map, initialPreset);
    initSearch(map);
    initClickReverseGeocode(map);
    bindUrlState(map, { getPreset: presetCtl.current });
    initShareButton();
    initFavoritesPanel(map, presetCtl);
    initDirections(map);
    initSearchCategories(map);
    initIsochrone(map);
    initStory(map, presetCtl);
    initAutoPreset(map, presetCtl);
    initI18nUI();
  });
}

function initShareButton(): void {
  const btn = document.getElementById('btn-share');
  if (!btn) return;
  btn.addEventListener('click', () => {
    void copyCurrentUrl();
  });
}

async function copyCurrentUrl(): Promise<void> {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    showToast(t('shareCopied'));
  } catch {
    // Fallback if clipboard API is blocked (insecure context, permissions).
    showToast(t('shareCopyFail'));
  }
}

function initClickReverseGeocode(map: mapboxgl.Map): void {
  let abortCtrl: AbortController | undefined;
  map.on('click', (e: MapMouseEvent) => {
    abortCtrl?.abort();
    abortCtrl = new AbortController();

    const popup = new mapboxgl.Popup({ closeOnClick: true, offset: 12 })
      .setLngLat(e.lngLat)
      .setHTML(`<div class="popup-loading">${escapeHtml(t('popupLoading'))}</div>`)
      .addTo(map);

    void (async () => {
      try {
        const feature = await reverse(e.lngLat.lng, e.lngLat.lat, { signal: abortCtrl?.signal });
        if (!feature) {
          popup.setHTML(`<div>${escapeHtml(t('popupNoAddress'))}</div>`);
          return;
        }
        const name = feature.properties?.name ?? '—';
        const fullAddress =
          feature.properties?.full_address ?? feature.properties?.place_formatted ?? '';
        popup.setHTML(
          `<div><strong>${escapeHtml(name)}</strong></div>` +
            (fullAddress
              ? `<div style="color:var(--text-dim);margin-top:4px;font-size:12px">${escapeHtml(fullAddress)}</div>`
              : '')
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const msg = err instanceof GeocodingError ? err.message : t('searchNetworkError');
        popup.setHTML(`<div style="color:var(--danger)">${escapeHtml(msg)}</div>`);
      }
    })();
  });
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c
  );
}

// Suppress unused-import warning when bundler tree-shakes; type used implicitly.
export type { PresetController };
