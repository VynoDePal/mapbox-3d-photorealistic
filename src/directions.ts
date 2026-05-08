import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl';
import type { DirectionsProfile, DirectionsResponse, DirectionsRoute } from '@/types/mapbox.ts';
import { h } from '@/ui/panel.ts';
import { showToast } from '@/ui/toast.ts';
import { bearing, formatDistance, formatDuration } from '@/utils/geo.ts';
import { t, onLangChange } from '@/i18n/index.ts';

const SOURCE_ID = 'directions-route';
const LAYER_GLOW = 'directions-route-glow';
const LAYER_LINE = 'directions-route-line';

interface Waypoint {
  id: string;
  lng: number;
  lat: number;
  marker: mapboxgl.Marker;
}

export interface DirectionsController {
  toggle(): void;
  isActive(): boolean;
  // Snapshot of the current waypoints (BUG-003 v2 — used by Isochrone to
  // pick the start point + sync with Directions).
  getWaypoints(): { lng: number; lat: number }[];
  getProfile(): DirectionsProfile;
  // Whether the panel is currently visible (BUG-011 v2 — used by Story).
  isPanelOpen(): boolean;
  hidePanel(): void;
  showPanel(): void;
  setIsoLegendVisible(visible: boolean): void;
  destroy(): void;
}

export function initDirections(map: MapboxMap): DirectionsController {
  let active = false;
  let profile: DirectionsProfile = 'driving';
  let waypoints: Waypoint[] = [];
  let lastRoute: DirectionsRoute | null = null;
  let abortCtrl: AbortController | undefined;
  let cameraFollowToken = 0;
  const isFollowCancelled = (token: number): boolean => token !== cameraFollowToken;

  // BUG-003 v2 : notify Isochrone (and any future consumer) when waypoints
  // or profile change so it can resync its center / profile.
  const notifyChange = (): void => {
    window.dispatchEvent(new CustomEvent('mapbox3d:directions-change'));
  };

  // ---- UI: panel + button ----
  const panel = buildPanel({
    profile,
    onProfileChange: (p) => {
      profile = p;
      notifyChange();
      void recompute();
    },
    onClear: () => {
      clearAll();
    },
    onFollow: () => {
      if (lastRoute) {
        const token = ++cameraFollowToken;
        followCamera(map, lastRoute, () => isFollowCancelled(token)).catch(() => undefined);
      }
    },
  });

  const toggleBtn = document.getElementById('btn-directions');
  toggleBtn?.addEventListener('click', () => {
    active = !active;
    toggleBtn.classList.toggle('active', active);
    if (active) {
      panel.show();
      showToast(t('dirHint'));
      map.getCanvas().style.cursor = 'crosshair';
    } else {
      clearAll();
      panel.hide();
      map.getCanvas().style.cursor = '';
    }
  });

  // ---- Map click → add waypoint (only when active) ----
  const onClick = (e: mapboxgl.MapMouseEvent): void => {
    if (!active) return;
    e.preventDefault?.();
    addWaypoint(e.lngLat.lng, e.lngLat.lat);
  };
  map.on('click', onClick);

  function addWaypoint(lng: number, lat: number): void {
    const id = crypto.randomUUID();
    const el = document.createElement('div');
    el.className = 'wp-marker';
    el.textContent = String(waypoints.length + 1);
    const marker = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat([lng, lat])
      .addTo(map);
    marker.on('dragend', () => {
      const ll = marker.getLngLat();
      const wp = waypoints.find((w) => w.id === id);
      if (wp) {
        wp.lng = ll.lng;
        wp.lat = ll.lat;
        notifyChange();
        void recompute();
      }
    });
    waypoints.push({ id, lng, lat, marker });
    renumber();
    panel.setWaypoints(waypoints, removeWaypoint);
    notifyChange();
    void recompute();
  }

  function removeWaypoint(id: string): void {
    const idx = waypoints.findIndex((w) => w.id === id);
    if (idx === -1) return;
    waypoints[idx]?.marker.remove();
    waypoints.splice(idx, 1);
    renumber();
    panel.setWaypoints(waypoints, removeWaypoint);
    notifyChange();
    void recompute();
  }

  function renumber(): void {
    waypoints.forEach((w, i) => {
      const el = w.marker.getElement();
      el.textContent = String(i + 1);
    });
  }

  async function recompute(): Promise<void> {
    if (waypoints.length < 2) {
      removeRouteLayer();
      lastRoute = null;
      panel.setSummary(null);
      return;
    }
    abortCtrl?.abort();
    abortCtrl = new AbortController();
    panel.setLoading(true);
    try {
      const res = await fetch('/api/directions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profile,
          coords: waypoints.map((w) => [w.lng, w.lat] as [number, number]),
        }),
        signal: abortCtrl.signal,
      });
      if (!res.ok) {
        showToast(t('dirHttpError', res.status));
        return;
      }
      const data = (await res.json()) as DirectionsResponse;
      const route = data.routes[0];
      if (!route) {
        showToast(t('dirNoRoute'));
        removeRouteLayer();
        lastRoute = null;
        panel.setSummary(null);
        return;
      }
      lastRoute = route;
      drawRoute(route);
      panel.setSummary({
        durationLabel: formatDuration(route.duration),
        distanceLabel: formatDistance(route.distance),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showToast(t('dirNetworkError'));
    } finally {
      panel.setLoading(false);
    }
  }

  function drawRoute(route: DirectionsRoute): void {
    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {},
      geometry: route.geometry,
    };
    const existing = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data, lineMetrics: true });
      map.addLayer({
        id: LAYER_GLOW,
        type: 'line',
        source: SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#4264fb',
          'line-width': 14,
          'line-blur': 10,
          'line-opacity': 0.4,
        },
      });
      map.addLayer({
        id: LAYER_LINE,
        type: 'line',
        source: SOURCE_ID,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-width': 6,
          'line-gradient': [
            'interpolate',
            ['linear'],
            ['line-progress'],
            0,
            '#4264fb',
            0.5,
            '#7a8cff',
            1,
            '#ffd166',
          ],
        },
      });
    }
  }

  function removeRouteLayer(): void {
    if (map.getLayer(LAYER_LINE)) map.removeLayer(LAYER_LINE);
    if (map.getLayer(LAYER_GLOW)) map.removeLayer(LAYER_GLOW);
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  }

  function clearAll(): void {
    waypoints.forEach((w) => w.marker.remove());
    waypoints = [];
    removeRouteLayer();
    lastRoute = null;
    panel.setWaypoints([], removeWaypoint);
    panel.setSummary(null);
    cameraFollowToken += 1; // cancels in-flight follow
    notifyChange();
  }

  return {
    toggle: () => toggleBtn?.click(),
    isActive: () => active,
    getWaypoints: () => waypoints.map((w) => ({ lng: w.lng, lat: w.lat })),
    getProfile: () => profile,
    isPanelOpen: () => panel.isOpen(),
    hidePanel: () => panel.hide(),
    showPanel: () => panel.show(),
    setIsoLegendVisible: (visible) => panel.setIsoLegend(visible),
    destroy: () => {
      clearAll();
      map.off('click', onClick);
      panel.destroy();
    },
  };
}

// ---- Camera follow ----

async function followCamera(
  map: MapboxMap,
  route: DirectionsRoute,
  isCancelled: () => boolean
): Promise<void> {
  const coords = route.geometry.coordinates;
  if (coords.length < 2) return;

  // Aim for ~10s total, stepping every 100ms → 100 frames.
  const totalMs = 10_000;
  const step = 100;
  const frames = Math.max(20, Math.floor(totalMs / step));
  const sampled = sampleAlong(coords, frames);

  let userCancelled = false;
  const cancel = (): void => {
    userCancelled = true;
  };
  map.getCanvas().addEventListener('mousedown', cancel, { once: true });
  map.getCanvas().addEventListener('touchstart', cancel, { once: true });

  for (let i = 0; i < sampled.length - 1; i++) {
    if (userCancelled || isCancelled()) return;
    const a = sampled[i]!;
    const b = sampled[i + 1]!;
    const head = bearing(a, b);
    map.easeTo({
      center: a,
      bearing: head,
      pitch: 65,
      duration: step,
      essential: true,
    });
    await sleep(step);
  }
  if (!userCancelled && !isCancelled()) {
    map.easeTo({ pitch: 70, duration: 800, essential: true });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Resample a coord list to N evenly-spaced points (by index — good enough
// for camera follow, no haversine needed).
export function sampleAlong(coords: [number, number][], samples: number): [number, number][] {
  if (coords.length <= samples) return coords;
  const out: [number, number][] = [];
  const last = coords.length - 1;
  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * last;
    const idx = Math.floor(t);
    const frac = t - idx;
    const a = coords[idx]!;
    const b = coords[Math.min(idx + 1, last)]!;
    out.push([a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]);
  }
  return out;
}

// ---- Panel build (DOM, no framework) ----

interface PanelOpts {
  profile: DirectionsProfile;
  onProfileChange: (p: DirectionsProfile) => void;
  onClear: () => void;
  onFollow: () => void;
}

interface PanelHandle {
  show(): void;
  hide(): void;
  isOpen(): boolean;
  setLoading(v: boolean): void;
  setWaypoints(items: Waypoint[], onRemove: (id: string) => void): void;
  setSummary(s: { durationLabel: string; distanceLabel: string } | null): void;
  setIsoLegend(visible: boolean): void;
  destroy(): void;
}

function buildPanel(opts: PanelOpts): PanelHandle {
  const profileBar = h('div', { class: 'dir-profile-bar', role: 'radiogroup' });
  const profiles: DirectionsProfile[] = ['driving', 'walking', 'cycling'];
  const profileBtns = new Map<DirectionsProfile, HTMLButtonElement>();
  for (const p of profiles) {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'dir-profile-btn',
        role: 'radio',
        'aria-checked': p === opts.profile ? 'true' : 'false',
        dataset: { profile: p },
      },
      [labelFor(p)]
    );
    btn.addEventListener('click', () => {
      profileBtns.forEach((b, key) =>
        b.setAttribute('aria-checked', key === p ? 'true' : 'false')
      );
      opts.onProfileChange(p);
    });
    profileBtns.set(p, btn);
    profileBar.append(btn);
  }

  const list = h('ol', { class: 'dir-waypoints' });
  const summary = h('div', { class: 'dir-summary' });
  const followBtn = h('button', {
    type: 'button',
    class: 'dir-action',
    disabled: true,
  }, [t('dirFollow')]);
  followBtn.addEventListener('click', () => opts.onFollow());

  const clearBtn = h('button', {
    type: 'button',
    class: 'dir-action dir-clear',
  }, [t('dirClear')]);
  clearBtn.addEventListener('click', () => opts.onClear());

  const titleEl = h('h2', { class: 'dir-panel-title' }, [t('dirPanelTitle')]);

  // BUG-003 v2 — legend for the isochrone overlay (10 / 20 / 30 min).
  const isoLegend = h('div', { class: 'iso-legend', hidden: true }, [
    h('span', { class: 'iso-legend-title' }, [t('isoLegendTitle')]),
    h('span', { class: 'iso-legend-row' }, [
      h('span', { class: 'iso-legend-swatch iso-10' }, []),
      '10',
      h('span', { class: 'iso-legend-swatch iso-20' }, []),
      '20',
      h('span', { class: 'iso-legend-swatch iso-30' }, []),
      '30',
    ]),
  ]);

  const root = h('aside', { class: 'dir-panel', hidden: true }, [
    h('header', { class: 'dir-panel-header' }, [titleEl, profileBar]),
    list,
    summary,
    isoLegend,
    h('div', { class: 'dir-actions' }, [followBtn, clearBtn]),
  ]);
  document.body.appendChild(root);

  // Re-translate static labels when the language changes.
  onLangChange(() => {
    titleEl.textContent = t('dirPanelTitle');
    followBtn.textContent = t('dirFollow');
    clearBtn.textContent = t('dirClear');
    profileBtns.forEach((btn, p) => {
      btn.textContent = labelFor(p);
    });
  });

  return {
    show: () => {
      root.hidden = false;
    },
    hide: () => {
      root.hidden = true;
    },
    isOpen: () => !root.hidden,
    setIsoLegend: (visible) => {
      isoLegend.hidden = !visible;
    },
    setLoading: (v) => root.classList.toggle('dir-loading', v),
    setWaypoints: (items, onRemove) => {
      list.innerHTML = '';
      if (items.length === 0) {
        const empty = h('li', { class: 'dir-wp-empty' }, [t('dirEmpty')]);
        list.append(empty);
        return;
      }
      items.forEach((w, i) => {
        const li = h('li', { class: 'dir-wp-item' }, [
          h('span', { class: 'dir-wp-num' }, [String(i + 1)]),
          h('span', { class: 'dir-wp-coords' }, [
            `${w.lat.toFixed(4)}, ${w.lng.toFixed(4)}`,
          ]),
          h(
            'button',
            {
              type: 'button',
              class: 'dir-wp-del',
              'aria-label': `Retirer le point ${i + 1}`,
            },
            ['×']
          ),
        ]);
        const del = li.querySelector<HTMLButtonElement>('.dir-wp-del');
        del?.addEventListener('click', () => onRemove(w.id));
        list.append(li);
      });
    },
    setSummary: (s) => {
      summary.innerHTML = '';
      followBtn.toggleAttribute('disabled', s === null);
      if (!s) return;
      summary.append(
        h('div', { class: 'dir-summary-row' }, [
          h('span', { class: 'dir-summary-key' }, [t('dirSummaryDuration')]),
          h('span', { class: 'dir-summary-val' }, [s.durationLabel]),
        ]),
        h('div', { class: 'dir-summary-row' }, [
          h('span', { class: 'dir-summary-key' }, [t('dirSummaryDistance')]),
          h('span', { class: 'dir-summary-val' }, [s.distanceLabel]),
        ])
      );
    },
    destroy: () => root.remove(),
  };
}

function labelFor(p: DirectionsProfile): string {
  return p === 'driving' ? t('dirProfileDriving') : p === 'walking' ? t('dirProfileWalking') : t('dirProfileCycling');
}
