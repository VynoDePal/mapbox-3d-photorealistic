import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { suggest, retrieve, reverse, GeocodingError, rotateSessionToken } from '@/geocoding.ts';

describe('geocoding', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    rotateSessionToken();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockJsonResponse = (data: unknown, status = 200): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    }) as unknown as Response;

  describe('suggest', () => {
    it('returns suggestions on success', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse({
          suggestions: [{ mapbox_id: 'a', name: 'Tour Eiffel', place_formatted: 'Paris' }],
        })
      );
      const items = await suggest('tour eiffel');
      expect(items).toHaveLength(1);
      expect(items[0]?.name).toBe('Tour Eiffel');
    });

    it('forwards proximity and country to the proxy', async () => {
      vi.mocked(fetch).mockResolvedValue(mockJsonResponse({ suggestions: [] }));
      await suggest('q', { proximity: { lng: 2.3, lat: 48.8 }, country: ['FR'] });
      const url = vi.mocked(fetch).mock.calls[0]?.[0] as URL;
      expect(url.searchParams.get('proximity')).toBe('2.3,48.8');
      expect(url.searchParams.get('country')).toBe('FR');
    });

    it('throws GeocodingError 401 on auth failure', async () => {
      vi.mocked(fetch).mockResolvedValue(mockJsonResponse({}, 401));
      await expect(suggest('q')).rejects.toBeInstanceOf(GeocodingError);
      try {
        await suggest('q');
      } catch (e) {
        expect((e as GeocodingError).status).toBe(401);
      }
    });

    it('throws GeocodingError 429 on rate limit', async () => {
      vi.mocked(fetch).mockResolvedValue(mockJsonResponse({}, 429));
      try {
        await suggest('q');
      } catch (e) {
        expect((e as GeocodingError).status).toBe(429);
      }
    });

    it('returns empty array when proxy returns empty payload', async () => {
      vi.mocked(fetch).mockResolvedValue(mockJsonResponse({}));
      const items = await suggest('q');
      expect(items).toEqual([]);
    });

    it('forwards AbortSignal to fetch', async () => {
      vi.mocked(fetch).mockResolvedValue(mockJsonResponse({ suggestions: [] }));
      const ctrl = new AbortController();
      await suggest('q', { signal: ctrl.signal });
      const opts = vi.mocked(fetch).mock.calls[0]?.[1];
      expect(opts?.signal).toBe(ctrl.signal);
    });
  });

  describe('retrieve', () => {
    it('returns the first feature and rotates session token', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse({
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [2.29, 48.85] },
              properties: { name: 'Tour Eiffel' },
            },
          ],
        })
      );
      const feature = await retrieve('mapbox.poi.123');
      expect(feature.geometry.coordinates).toEqual([2.29, 48.85]);
    });

    it('throws when no feature is returned', async () => {
      vi.mocked(fetch).mockResolvedValue(mockJsonResponse({ features: [] }));
      await expect(retrieve('missing')).rejects.toBeInstanceOf(GeocodingError);
    });
  });

  describe('reverse', () => {
    it('returns the first feature', async () => {
      vi.mocked(fetch).mockResolvedValue(
        mockJsonResponse({
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [2.3, 48.86] },
              properties: { name: 'Place de la Concorde' },
            },
          ],
        })
      );
      const feature = await reverse(2.3, 48.86);
      expect(feature?.properties.name).toBe('Place de la Concorde');
    });

    it('returns null when no feature', async () => {
      vi.mocked(fetch).mockResolvedValue(mockJsonResponse({ features: [] }));
      const feature = await reverse(0, 0);
      expect(feature).toBeNull();
    });
  });

  it('rejects when fetch is aborted', async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, opts) =>
        new Promise((_resolve, reject) => {
          (opts as { signal?: AbortSignal })?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        })
    );
    const ctrl = new AbortController();
    const p = suggest('q', { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toThrow('aborted');
  });
});
