import { fr, type Dict } from './fr.ts';
import { en } from './en.ts';

export type Lang = 'fr' | 'en';
export type DictKey = keyof Dict;

const STORAGE_KEY = 'mapbox3d:lang';

const dicts: Record<Lang, Dict> = { fr, en };

function detect(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'fr' || stored === 'en') return stored;
  const nav = (typeof navigator !== 'undefined' ? navigator.language : '') ?? '';
  return nav.toLowerCase().startsWith('en') ? 'en' : 'fr';
}

let current: Lang = typeof window !== 'undefined' ? detect() : 'fr';
const listeners = new Set<(lang: Lang) => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  if (current === lang) return;
  current = lang;
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn: (lang: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// `t(key)` for plain strings, `t(key, ...args)` for function-shaped entries.
type DictValue<K extends DictKey> = Dict[K];
type FunctionEntry = (...args: never[]) => string;

export function t<K extends DictKey>(
  key: K,
  ...args: DictValue<K> extends FunctionEntry ? Parameters<DictValue<K>> : []
): string {
  const dict = dicts[current];
  const v = dict[key];
  if (typeof v === 'function') {
    return (v as (...a: unknown[]) => string)(...(args as unknown[]));
  }
  return v as string;
}
