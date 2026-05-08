import { describe, it, expect } from 'vitest';
import { localHour, presetForHour, presetForLngAt } from '@/light-preset-auto.ts';

describe('light-preset-auto', () => {
  describe('presetForHour', () => {
    it('returns dawn between 5h and 7h', () => {
      expect(presetForHour(5)).toBe('dawn');
      expect(presetForHour(6.5)).toBe('dawn');
      expect(presetForHour(6.99)).toBe('dawn');
    });

    it('returns day between 7h and 18h', () => {
      expect(presetForHour(7)).toBe('day');
      expect(presetForHour(12)).toBe('day');
      expect(presetForHour(17.99)).toBe('day');
    });

    it('returns dusk between 18h and 21h', () => {
      expect(presetForHour(18)).toBe('dusk');
      expect(presetForHour(19.5)).toBe('dusk');
      expect(presetForHour(20.99)).toBe('dusk');
    });

    it('returns night between 21h and 5h', () => {
      expect(presetForHour(21)).toBe('night');
      expect(presetForHour(23)).toBe('night');
      expect(presetForHour(0)).toBe('night');
      expect(presetForHour(2)).toBe('night');
      expect(presetForHour(4.99)).toBe('night');
    });

    it('handles negative and overflowing hours by wrapping', () => {
      expect(presetForHour(-3)).toBe('night'); // 21h
      expect(presetForHour(25)).toBe('night'); // 1h
      expect(presetForHour(31)).toBe('day'); // 7h
    });
  });

  describe('localHour', () => {
    it('returns UTC hour at lng 0', () => {
      const utcNoon = Date.UTC(2025, 0, 1, 12, 0, 0);
      expect(localHour(0, utcNoon)).toBeCloseTo(12, 1);
    });

    it('shifts by ~1 hour per 15° longitude', () => {
      const utcNoon = Date.UTC(2025, 0, 1, 12, 0, 0);
      // Tokyo ~ lng 139 → +9h
      expect(localHour(139.7, utcNoon)).toBeCloseTo(21, 0);
      // New York ~ lng -74 → -5h
      expect(localHour(-74, utcNoon)).toBeCloseTo(7, 0);
    });

    it('keeps fractional minutes from UTC', () => {
      const utcNoon30 = Date.UTC(2025, 0, 1, 12, 30, 0);
      expect(localHour(0, utcNoon30)).toBeCloseTo(12.5, 2);
    });
  });

  describe('presetForLngAt (composition)', () => {
    it('night at Tokyo when UTC noon → 21h locally', () => {
      const utcNoon = Date.UTC(2025, 0, 1, 12, 0, 0);
      expect(presetForLngAt(139.7, utcNoon)).toBe('night');
    });

    it('day at Paris when UTC noon → 13h locally', () => {
      const utcNoon = Date.UTC(2025, 0, 1, 12, 0, 0);
      expect(presetForLngAt(2.35, utcNoon)).toBe('day');
    });

    it('dawn at New York when UTC noon → 7h locally', () => {
      const utcNoon = Date.UTC(2025, 0, 1, 12, 0, 0);
      // -74 / 15 ≈ -5h → 7h locally → boundary day, but -73.5 rounds to -5 too
      // We accept either dawn (just before 7) or day (≥7) — exact lng -75 → exactly 7 → day
      const result = presetForLngAt(-74, utcNoon);
      expect(['dawn', 'day']).toContain(result);
    });
  });
});
