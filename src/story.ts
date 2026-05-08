import type { Map as MapboxMap } from 'mapbox-gl';
import type { LightPreset } from '@/types/mapbox.ts';
import type { PresetController } from '@/light-preset.ts';
import { h } from '@/ui/panel.ts';
import { showToast } from '@/ui/toast.ts';
import storyJson from '../stories/paris.json' with { type: 'json' };

interface Camera {
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

interface Orbit {
  rpm: number;
  tilt: number;
}

interface Chapter {
  id: string;
  title: string;
  narration: string;
  camera: Camera;
  preset: LightPreset;
  durationMs: number;
  orbit?: Orbit;
}

interface StoryFile {
  title: string;
  subtitle: string;
  chapters: Chapter[];
}

const STORY = storyJson as StoryFile;

export interface StoryController {
  destroy(): void;
}

export function initStory(map: MapboxMap, preset: PresetController): StoryController {
  const toggleBtn = document.getElementById('btn-story');
  if (!toggleBtn) return { destroy: () => undefined };

  let active = false;
  let activeIndex = -1;
  let orbitRafId: number | undefined;
  let orbitGeneration = 0;
  let initialState: Camera & { preset: LightPreset } | null = null;

  // ---- Build the panel shell once ----
  const titleEl = h('h2', { class: 'story-title' }, [STORY.title]);
  const subtitleEl = h('p', { class: 'story-subtitle' }, [STORY.subtitle]);
  const chaptersList = h('ol', { class: 'story-chapters' });
  const closeBtn = h('button', {
    type: 'button',
    class: 'story-close',
    'aria-label': 'Quitter la story',
  }, ['Quitter']);
  closeBtn.addEventListener('click', () => deactivate());

  const root = h('aside', {
    class: 'story-panel',
    role: 'region',
    'aria-label': 'Story interactive',
    hidden: true,
  }, [
    h('header', { class: 'story-header' }, [titleEl, subtitleEl, closeBtn]),
    chaptersList,
  ]);
  document.body.appendChild(root);

  // ---- Build chapter cards ----
  STORY.chapters.forEach((chapter, i) => {
    const card = h(
      'li',
      { class: 'story-chapter', dataset: { index: String(i) } },
      [
        h('div', { class: 'story-chapter-num' }, [String(i + 1)]),
        h('div', { class: 'story-chapter-body' }, [
          h('h3', { class: 'story-chapter-title' }, [chapter.title]),
          h('p', { class: 'story-chapter-narration' }, [chapter.narration]),
          h('span', { class: 'story-chapter-meta' }, [
            chapter.orbit ? '🎬 Orbite ' : '🎥 Transition ',
            `· ${chapter.preset}`,
            ` · ${Math.round(chapter.durationMs / 1000)}s`,
          ]),
        ]),
      ]
    );
    card.addEventListener('click', () => {
      jumpTo(i);
    });
    chaptersList.append(card);
  });

  // ---- Toggle ----
  toggleBtn.addEventListener('click', () => {
    if (active) deactivate();
    else activate();
  });

  function activate(): void {
    active = true;
    toggleBtn?.classList.add('active');
    initialState = {
      lng: map.getCenter().lng,
      lat: map.getCenter().lat,
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
      preset: preset.current(),
    };
    root.hidden = false;
    document.addEventListener('keydown', onKey);
    showToast('Clique sur un chapitre — appuie Esc pour quitter');
    if (STORY.chapters.length > 0) jumpTo(0);
  }

  function deactivate(): void {
    if (!active) return;
    active = false;
    toggleBtn?.classList.remove('active');
    stopOrbit();
    root.hidden = true;
    document.removeEventListener('keydown', onKey);
    setActiveCard(-1);
    if (initialState) {
      map.flyTo({
        center: [initialState.lng, initialState.lat],
        zoom: initialState.zoom,
        pitch: initialState.pitch,
        bearing: initialState.bearing,
        duration: 2500,
        essential: true,
      });
      preset.set(initialState.preset);
    }
  }

  function jumpTo(index: number): void {
    const chapter = STORY.chapters[index];
    if (!chapter) return;
    activeIndex = index;
    setActiveCard(index);
    stopOrbit();
    preset.set(chapter.preset);
    const useFlyTo = chapter.durationMs >= 6000;
    const opts = {
      center: [chapter.camera.lng, chapter.camera.lat] as [number, number],
      zoom: chapter.camera.zoom,
      pitch: chapter.camera.pitch,
      bearing: chapter.camera.bearing,
      duration: Math.min(chapter.durationMs, 6000),
      essential: true,
    };
    if (useFlyTo) map.flyTo({ ...opts, curve: 1.42 });
    else map.easeTo(opts);

    if (chapter.orbit) {
      const arrivalDelay = Math.min(chapter.durationMs, 6000);
      window.setTimeout(() => {
        if (activeIndex === index && active) startOrbit(chapter, chapter.orbit!);
      }, arrivalDelay + 100);
    }
  }

  function startOrbit(_chapter: Chapter, orbit: Orbit): void {
    stopOrbit();
    const generation = ++orbitGeneration;
    map.easeTo({ pitch: orbit.tilt, duration: 600, essential: true });
    // RPM → degrees per ms
    const degPerMs = (orbit.rpm * 360) / (60 * 1000);
    let lastTs: number | null = null;
    const tick = (ts: number): void => {
      if (generation !== orbitGeneration || !active) return;
      if (lastTs === null) lastTs = ts;
      const dt = ts - lastTs;
      lastTs = ts;
      map.setBearing(map.getBearing() + degPerMs * dt);
      orbitRafId = window.requestAnimationFrame(tick);
    };
    orbitRafId = window.requestAnimationFrame(tick);
  }

  function stopOrbit(): void {
    orbitGeneration += 1;
    if (orbitRafId !== undefined) {
      window.cancelAnimationFrame(orbitRafId);
      orbitRafId = undefined;
    }
  }

  function setActiveCard(index: number): void {
    chaptersList.querySelectorAll<HTMLLIElement>('.story-chapter').forEach((el, i) => {
      el.classList.toggle('active', i === index);
      if (i === index) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function onKey(e: KeyboardEvent): void {
    if (!active) return;
    if (e.key === 'Escape') deactivate();
    else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      const next = Math.min(activeIndex + 1, STORY.chapters.length - 1);
      jumpTo(next);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      const prev = Math.max(activeIndex - 1, 0);
      jumpTo(prev);
    }
  }

  return {
    destroy: () => {
      deactivate();
      root.remove();
    },
  };
}
