// `prefers-reduced-motion` helper. Lets feature modules collapse cinematic
// transitions to instant jumps when the OS is set to reduce motion.

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface FlyToOpts {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  duration: number;
  curve?: number;
  essential?: boolean;
}

interface FlyableMap {
  flyTo(opts: FlyToOpts): void;
  jumpTo(opts: { center: [number, number]; zoom: number; pitch: number; bearing: number }): void;
}

// Cinematic flyTo, falling back to instant jumpTo when motion is reduced.
export function adaptiveFlyTo(map: FlyableMap, opts: FlyToOpts): void {
  if (prefersReducedMotion()) {
    map.jumpTo({
      center: opts.center,
      zoom: opts.zoom,
      pitch: opts.pitch,
      bearing: opts.bearing,
    });
    return;
  }
  map.flyTo(opts);
}
