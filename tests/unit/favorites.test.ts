import { describe, it, expect, beforeEach } from 'vitest';
import { add, list, remove, rename, clear, type FavoriteInput } from '@/favorites.ts';

const sample: FavoriteInput = {
  name: 'Tour Eiffel',
  lng: 2.2945,
  lat: 48.8584,
  zoom: 17,
  pitch: 70,
  bearing: -20,
  preset: 'dusk',
};

describe('favorites', () => {
  beforeEach(() => {
    clear();
  });

  it('adds and lists a favorite', () => {
    const fav = add(sample);
    expect(fav.id).toBeDefined();
    expect(fav.createdAt).toBeGreaterThan(0);
    const items = list();
    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe('Tour Eiffel');
  });

  it('lists favorites sorted by recency (newest first)', async () => {
    add({ ...sample, name: 'Older' });
    await new Promise((r) => setTimeout(r, 5));
    add({ ...sample, name: 'Newer' });
    const items = list();
    expect(items.map((f) => f.name)).toEqual(['Newer', 'Older']);
  });

  it('removes a favorite by id', () => {
    const fav = add(sample);
    add({ ...sample, name: 'Other' });
    remove(fav.id);
    const items = list();
    expect(items.map((f) => f.name)).toEqual(['Other']);
  });

  it('renames a favorite', () => {
    const fav = add(sample);
    const updated = rename(fav.id, 'New Name');
    expect(updated?.name).toBe('New Name');
    expect(list()[0]?.name).toBe('New Name');
  });

  it('returns null when renaming an unknown id', () => {
    expect(rename('nope', 'x')).toBeNull();
  });

  it('keeps the previous name when the new name is empty/whitespace', () => {
    const fav = add(sample);
    rename(fav.id, '   ');
    expect(list()[0]?.name).toBe('Tour Eiffel');
  });

  it('survives roundtrip through localStorage', () => {
    add(sample);
    const items = list();
    const raw = window.localStorage.getItem('mapbox3d:favorites:v1');
    expect(raw).toBeDefined();
    expect(items[0]?.name).toBe('Tour Eiffel');
  });

  it('returns [] when storage holds invalid JSON', () => {
    window.localStorage.setItem('mapbox3d:favorites:v1', 'not json');
    expect(list()).toEqual([]);
  });

  it('filters out malformed entries', () => {
    const valid = { ...sample, id: 'a', createdAt: Date.now() };
    const malformed = { name: 'broken' };
    window.localStorage.setItem('mapbox3d:favorites:v1', JSON.stringify([valid, malformed]));
    const items = list();
    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe('Tour Eiffel');
  });
});
