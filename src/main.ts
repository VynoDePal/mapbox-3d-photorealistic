// Style retry strategy (BUG-007): the upstream `mapbox/standard` style
// occasionally returns 503 at boot. Mapbox-gl retries internally once; if it
// still fails to apply, we surface a non-blocking toast and trigger a single
// `map.setStyle(...)` after 3s to give the CDN a chance to recover. Guarded
// by a flag so we never loop.
import mapboxgl, { type MapMouseEvent } from 'mapbox-gl';
import { initSearch } from '@/search.ts';
import { initLightPresetBar, getStoredPreset, type PresetController } from '@/light-preset.ts';
import { reverse, GeocodingError } from '@/geocoding.ts';
import { bindToMap as bindUrlState, readHashStateWithErrors } from '@/url-state.ts';
import { initFavoritesPanel } from '@/favorites-ui.ts';
import { showToast, showActionToast } from '@/ui/toast.ts';
import { initDirections } from '@/directions.ts';
import { initSearchCategories } from '@/search-categories.ts';
import { initIsochrone } from '@/isochrone.ts';
import { initStory } from '@/story.ts';
import { initAutoPreset } from '@/light-preset-auto.ts';
import { initI18nUI, applyStaticTranslations } from '@/i18n-ui.ts';
import { t, onLangChange } from '@/i18n/index.ts';

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
  const { state: hashState, errors: hashErrors } = readHashStateWithErrors();
  const initialPreset = hashState?.preset ?? getStoredPreset('dusk');
  // BUG-013: surface a non-blocking warning when the URL preset is invalid;
  // the parser falls back to a default preset gracefully, but we want the
  // user to know the URL parameter was ignored.
  if (hashErrors.includes('invalidPreset')) {
    console.warn('[url-state] invalid preset in URL, using default');
    setTimeout(() => showToast(t('presetInvalid'), 4000), 500);
  }

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
  // BUG-002 v2: replaced Mapbox FullscreenControl by a custom button targeting
  // document.body — see initFullscreenButton() below. The Mapbox control only
  // makes the canvas fullscreen, which hides our custom UI.
  initFullscreenButton();
  const geolocate = new mapboxgl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: false,
    showUserHeading: true,
  });
  map.addControl(geolocate, 'top-right');
  // BUG-012 v1 + BUG-008 v2 : surface a toast when geolocation fails.
  // Mapbox emits the browser PositionError on the 'error' event. The event
  // payload may also be wrapped (`e.error.code`) on some versions, so we
  // check both shapes defensively.
  geolocate.on('error', (event: unknown) => {
    const err = event as { code?: number; error?: { code?: number } } | undefined;
    const code = err?.code ?? err?.error?.code;
    let key: 'geolocDenied' | 'geolocUnavailable' | 'geolocTimeout';
    if (code === 1) key = 'geolocDenied';
    else if (code === 3) key = 'geolocTimeout';
    else key = 'geolocUnavailable';
    console.warn('[geolocate] error', { code, raw: event });
    showToast(t(key), 4000);
  });

  // BUG-006 v2: exponential backoff retry on style failures.
  // Attempts: 1s, 2s, 4s. After 3 failed retries, surface a persistent
  // toast with a manual "Retry" button that resets the cycle.
  let styleRetryCount = 0;
  let styleRetryScheduled = false;
  let styleLoadedOnce = false;
  const scheduleStyleRetry = (): void => {
    if (styleRetryScheduled || styleRetryCount >= 3) return;
    styleRetryScheduled = true;
    const delay = 1000 * 2 ** styleRetryCount;
    console.warn('[mapbox-style-retry]', { attempt: styleRetryCount + 1, delayMs: delay });
    setTimeout(() => {
      styleRetryScheduled = false;
      styleRetryCount += 1;
      try {
        map.setStyle('mapbox://styles/mapbox/standard');
      } catch (retryErr) {
        console.warn('[mapbox-style-retry] setStyle threw', retryErr);
      }
    }, delay);
  };
  const showStylePersistentFailure = (): void => {
    void (async () => {
      const retried = await showActionToast(t('styleFailed'), t('retry'), {
        durationMs: null,
        clickAnywhere: false,
      });
      if (retried) {
        styleRetryCount = 0;
        try {
          map.setStyle('mapbox://styles/mapbox/standard');
        } catch (e) {
          console.warn('[mapbox-style-retry] manual retry threw', e);
        }
      }
    })();
  };

  map.on('error', (e) => {
    const err = e.error as { status?: number; message?: string; url?: string } | undefined;
    const status = err?.status;
    if (status === 401) {
      showFatalError(t('errTokenInvalid'), t('errTokenInvalidHint'), t('errTokenInvalidHelp'));
      return;
    }
    const isStyleFailure =
      (status !== undefined && status >= 500 && status < 600) ||
      err?.url?.includes('/styles/v1/') ||
      err?.message?.toLowerCase().includes('style');
    if (!isStyleFailure || styleLoadedOnce) return;
    console.warn('[mapbox-style-retry] failure', { status, url: err?.url, message: err?.message });
    if (styleRetryCount === 0) showToast(t('styleRetrying'), 3000);
    if (styleRetryCount < 3) {
      scheduleStyleRetry();
    } else {
      showStylePersistentFailure();
    }
  });
  map.on('style.load', () => {
    styleLoadedOnce = true;
    styleRetryCount = 0;
  });

  // Idempotent: re-run on every style.load (initial + retries) to re-add the
  // DEM source, terrain and fog (a setStyle() wipes them).
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
  });

  // One-shot bootstrap: feature modules attach DOM listeners and should not
  // be re-initialised on style retries (BUG-006 v2 introduces such retries).
  map.once('style.load', () => {
    const presetCtl = initLightPresetBar(map, initialPreset);
    initSearch(map);
    initClickReverseGeocode(map);
    bindUrlState(map, { getPreset: presetCtl.current });
    initShareButton();
    initFavoritesPanel(map, presetCtl);
    const directionsCtl = initDirections(map);
    initSearchCategories(map);
    initIsochrone(map, directionsCtl);
    initStory(map, presetCtl);
    initAutoPreset(map, presetCtl);
    initI18nUI();
  });
}

// BUG-002 v2: keep custom UI visible in fullscreen by passing the whole body
// to the Fullscreen API instead of Mapbox's canvas-only control.
function initFullscreenButton(): void {
  const btn = document.getElementById('btn-fullscreen');
  if (!btn) return;
  const enterIcon = btn.querySelector<SVGElement>('.fs-icon-enter');
  const exitIcon = btn.querySelector<SVGElement>('.fs-icon-exit');

  const sync = (): void => {
    const inFs = Boolean(document.fullscreenElement);
    btn.setAttribute('aria-pressed', String(inFs));
    btn.setAttribute('aria-label', t(inFs ? 'toolbarFullscreenExit' : 'toolbarFullscreenEnter'));
    btn.setAttribute('title', t(inFs ? 'toolbarFullscreenExit' : 'toolbarFullscreenEnter'));
    if (enterIcon) enterIcon.toggleAttribute('hidden', inFs);
    if (exitIcon) exitIcon.toggleAttribute('hidden', !inFs);
  };

  btn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      void document.body.requestFullscreen().catch((err: unknown) => {
        console.warn('[fullscreen] enter failed', err);
      });
    } else {
      void document.exitFullscreen().catch((err: unknown) => {
        console.warn('[fullscreen] exit failed', err);
      });
    }
  });

  document.addEventListener('fullscreenchange', sync);
  // Re-sync labels when language changes.
  onLangChange(sync);
  sync();
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
