import { describe, it, expect } from 'vitest';
import { bearing, formatDistance, formatDuration, lngLatToParam } from '@/utils/geo.ts';
import { sampleAlong } from '@/directions.ts';

describe('utils/geo', () => {
  describe('bearing', () => {
    it('returns ~0 for due-north travel', () => {
      const b = bearing([0, 0], [0, 1]);
      expect(b).toBeCloseTo(0, 1);
    });

    it('returns ~90 for due-east travel near the equator', () => {
      const b = bearing([0, 0], [1, 0]);
      expect(b).toBeCloseTo(90, 1);
    });

    it('returns ~180 for due-south travel', () => {
      const b = bearing([0, 1], [0, 0]);
      expect(b).toBeCloseTo(180, 1);
    });

    it('returns ~270 for due-west travel', () => {
      const b = bearing([1, 0], [0, 0]);
      expect(b).toBeCloseTo(270, 1);
    });

    it('always returns a value in [0, 360)', () => {
      for (const pair of [
        [[0, 0], [-1, 0]],
        [[10, 50], [-10, -50]],
        [[179, 0], [-179, 0]],
      ] as [[number, number], [number, number]][]) {
        const b = bearing(pair[0], pair[1]);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(360);
      }
    });
  });

  describe('formatDuration', () => {
    it('formats sub-hour durations in minutes', () => {
      expect(formatDuration(0)).toBe('0 min');
      expect(formatDuration(59)).toBe('1 min');
      expect(formatDuration(45 * 60)).toBe('45 min');
    });

    it('formats hour durations as "X h" when minutes round to 0', () => {
      expect(formatDuration(60 * 60)).toBe('1 h');
      expect(formatDuration(2 * 60 * 60)).toBe('2 h');
    });

    it('formats mixed durations as "X h Y min"', () => {
      expect(formatDuration(60 * 60 + 25 * 60)).toBe('1 h 25 min');
      expect(formatDuration(3 * 60 * 60 + 5 * 60)).toBe('3 h 5 min');
    });

    it('returns em-dash for invalid values', () => {
      expect(formatDuration(-1)).toBe('—');
      expect(formatDuration(NaN)).toBe('—');
      expect(formatDuration(Infinity)).toBe('—');
    });
  });

  describe('formatDistance', () => {
    it('uses meters under 1km', () => {
      expect(formatDistance(0)).toBe('0 m');
      expect(formatDistance(450)).toBe('450 m');
      expect(formatDistance(999)).toBe('999 m');
    });

    it('uses 1 decimal km between 1 and 10 km', () => {
      expect(formatDistance(1500)).toBe('1.5 km');
      expect(formatDistance(9990)).toBe('10.0 km'); // edge — Math.round will keep this
    });

    it('uses integer km above 10 km', () => {
      expect(formatDistance(15_400)).toBe('15 km');
      expect(formatDistance(125_900)).toBe('126 km');
    });

    it('returns em-dash for invalid values', () => {
      expect(formatDistance(-1)).toBe('—');
      expect(formatDistance(NaN)).toBe('—');
    });
  });

  describe('lngLatToParam', () => {
    it('formats with default 6 decimals', () => {
      expect(lngLatToParam(2.123456789, 48.987654321)).toBe('2.123457,48.987654');
    });
    it('respects requested decimals', () => {
      expect(lngLatToParam(2.5, 48.5, 2)).toBe('2.5,48.5');
    });
  });
});

describe('directions/sampleAlong', () => {
  it('returns the input when fewer points than samples', () => {
    const coords: [number, number][] = [[0, 0], [1, 1]];
    expect(sampleAlong(coords, 5)).toEqual(coords);
  });

  it('produces the requested number of points', () => {
    const coords: [number, number][] = Array.from({ length: 100 }, (_, i) => [i, i]);
    const sampled = sampleAlong(coords, 20);
    expect(sampled).toHaveLength(20);
  });

  it('keeps the start and end points', () => {
    const coords: [number, number][] = Array.from({ length: 50 }, (_, i) => [i * 0.1, i * 0.2]);
    const sampled = sampleAlong(coords, 10);
    expect(sampled[0]).toEqual(coords[0]);
    expect(sampled[sampled.length - 1]).toEqual(coords[coords.length - 1]);
  });
});
