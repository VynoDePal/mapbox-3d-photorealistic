import { describe, it, expect, vi, afterEach } from 'vitest';
import { adaptiveFlyTo, prefersReducedMotion } from '@/utils/motion.ts';

const flyOpts = {
  center: [2.29, 48.86] as [number, number],
  zoom: 17,
  pitch: 70,
  bearing: -20,
  duration: 5000,
  curve: 1.42,
  essential: true,
};

const stubMatchMedia = (matches: boolean): void => {
  vi.stubGlobal('matchMedia', () => ({ matches }) as MediaQueryList);
};

describe('utils/motion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('prefersReducedMotion', () => {
    it('returns true when the OS reports reduce', () => {
      stubMatchMedia(true);
      expect(prefersReducedMotion()).toBe(true);
    });

    it('returns false when the OS reports no-preference', () => {
      stubMatchMedia(false);
      expect(prefersReducedMotion()).toBe(false);
    });
  });

  describe('adaptiveFlyTo', () => {
    it('calls flyTo when motion is allowed', () => {
      stubMatchMedia(false);
      const map = { flyTo: vi.fn(), jumpTo: vi.fn() };
      adaptiveFlyTo(map, flyOpts);
      expect(map.flyTo).toHaveBeenCalledOnce();
      expect(map.jumpTo).not.toHaveBeenCalled();
    });

    it('calls jumpTo when motion is reduced', () => {
      stubMatchMedia(true);
      const map = { flyTo: vi.fn(), jumpTo: vi.fn() };
      adaptiveFlyTo(map, flyOpts);
      expect(map.jumpTo).toHaveBeenCalledOnce();
      expect(map.flyTo).not.toHaveBeenCalled();
      // jumpTo only takes static opts, no duration/curve
      expect(map.jumpTo).toHaveBeenCalledWith({
        center: flyOpts.center,
        zoom: flyOpts.zoom,
        pitch: flyOpts.pitch,
        bearing: flyOpts.bearing,
      });
    });
  });
});
