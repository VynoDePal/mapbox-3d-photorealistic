import { describe, it, expect } from 'vitest';
import { parseHash, serializeHash } from '@/url-state.ts';
import type { MapState } from '@/types/mapbox.ts';

describe('url-state', () => {
  describe('serializeHash', () => {
    it('serializes a state to zoom/lat/lng/pitch/bearing/preset', () => {
      const state: MapState = {
        lng: 2.29449,
        lat: 48.85837,
        zoom: 16.123,
        pitch: 70,
        bearing: -20,
        preset: 'dusk',
      };
      expect(serializeHash(state)).toBe('16.12/48.85837/2.29449/70/-20/dusk');
    });

    it('rounds floats compactly', () => {
      expect(
        serializeHash({
          lng: 2.123456789,
          lat: 48.123456789,
          zoom: 14.999,
          pitch: 65.55,
          bearing: 30.123,
          preset: 'day',
        })
      ).toBe('15/48.12346/2.12346/65.6/30.1/day');
    });
  });

  describe('parseHash', () => {
    it('parses a valid hash', () => {
      const s = parseHash('#16.12/48.85837/2.29449/70/-20/dusk');
      expect(s).toEqual({ zoom: 16.12, lat: 48.85837, lng: 2.29449, pitch: 70, bearing: -20, preset: 'dusk' });
    });

    it('handles hash without leading #', () => {
      const s = parseHash('15/48.85/2.29/65/0/day');
      expect(s?.preset).toBe('day');
    });

    it('returns null when number of parts is wrong', () => {
      expect(parseHash('#16/48/2/70/-20')).toBeNull();
      expect(parseHash('#16/48/2/70/-20/dusk/extra')).toBeNull();
    });

    it('returns null when preset is invalid', () => {
      expect(parseHash('#16/48/2/70/-20/noon')).toBeNull();
    });

    it('returns null when coords are out of range', () => {
      expect(parseHash('#16/95/2/70/-20/dusk')).toBeNull();
      expect(parseHash('#16/48/200/70/-20/dusk')).toBeNull();
    });

    it('returns null when zoom or pitch are out of range', () => {
      expect(parseHash('#-1/48/2/70/-20/dusk')).toBeNull();
      expect(parseHash('#30/48/2/70/-20/dusk')).toBeNull();
      expect(parseHash('#16/48/2/100/-20/dusk')).toBeNull();
    });

    it('returns null on empty input', () => {
      expect(parseHash('')).toBeNull();
      expect(parseHash('#')).toBeNull();
    });

    it('roundtrips via serialize → parse', () => {
      const state: MapState = {
        lng: 2.34527,
        lat: 48.85837,
        zoom: 14.5,
        pitch: 60,
        bearing: 45.2,
        preset: 'night',
      };
      const back = parseHash('#' + serializeHash(state));
      expect(back).toEqual(state);
    });
  });
});
