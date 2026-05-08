import type { LightPreset } from '@/types/mapbox.ts';

export interface Favorite {
  id: string;
  name: string;
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
  preset: LightPreset;
  createdAt: number;
}

const STORAGE_KEY = 'mapbox3d:favorites:v1';
const PRESETS: readonly LightPreset[] = ['dawn', 'day', 'dusk', 'night'] as const;

function isPreset(v: unknown): v is LightPreset {
  return typeof v === 'string' && (PRESETS as readonly string[]).includes(v);
}

function isFavorite(v: unknown): v is Favorite {
  if (!v || typeof v !== 'object') return false;
  const f = v as Record<string, unknown>;
  return (
    typeof f.id === 'string' &&
    typeof f.name === 'string' &&
    typeof f.lng === 'number' &&
    typeof f.lat === 'number' &&
    typeof f.zoom === 'number' &&
    typeof f.pitch === 'number' &&
    typeof f.bearing === 'number' &&
    isPreset(f.preset) &&
    typeof f.createdAt === 'number'
  );
}

function load(): Favorite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFavorite);
  } catch {
    return [];
  }
}

function save(items: Favorite[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function list(): Favorite[] {
  return load().sort((a, b) => b.createdAt - a.createdAt);
}

export type FavoriteInput = Omit<Favorite, 'id' | 'createdAt'>;

export function add(input: FavoriteInput): Favorite {
  const fav: Favorite = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  const items = load();
  items.push(fav);
  save(items);
  return fav;
}

export function remove(id: string): void {
  save(load().filter((f) => f.id !== id));
}

export function rename(id: string, name: string): Favorite | null {
  const items = load();
  const idx = items.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  const existing = items[idx];
  if (!existing) return null;
  const updated: Favorite = { ...existing, name: name.trim() || existing.name };
  items[idx] = updated;
  save(items);
  return updated;
}

export function clear(): void {
  localStorage.removeItem(STORAGE_KEY);
}
