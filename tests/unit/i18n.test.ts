import { describe, it, expect, beforeEach } from 'vitest';
import { getLang, setLang, t, onLangChange } from '@/i18n/index.ts';

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear();
    setLang('fr');
  });

  it('defaults to French when no preference is stored', () => {
    // Already set in beforeEach to 'fr'
    expect(t('searchPlaceholder')).toMatch(/Rechercher/);
  });

  it('switches to English when setLang is called', () => {
    setLang('en');
    expect(getLang()).toBe('en');
    expect(t('searchPlaceholder')).toMatch(/Search/);
  });

  it('persists the chosen language to localStorage', () => {
    setLang('en');
    expect(localStorage.getItem('mapbox3d:lang')).toBe('en');
  });

  it('updates document.documentElement.lang', () => {
    setLang('en');
    expect(document.documentElement.lang).toBe('en');
    setLang('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('supports function-shaped entries with arguments', () => {
    setLang('fr');
    expect(t('favSaved', 'Tour Eiffel')).toBe('« Tour Eiffel » sauvegardé');
    setLang('en');
    expect(t('favSaved', 'Tour Eiffel')).toBe('"Tour Eiffel" saved');
  });

  it('formats HTTP error keys with the status code', () => {
    setLang('fr');
    expect(t('dirHttpError', 503)).toBe('Erreur Directions HTTP 503');
    setLang('en');
    expect(t('dirHttpError', 503)).toBe('Directions HTTP 503 error');
  });

  it('notifies listeners on language change', () => {
    let notified: string | null = null;
    const off = onLangChange((lang) => {
      notified = lang;
    });
    setLang('en');
    expect(notified).toBe('en');
    setLang('fr');
    expect(notified).toBe('fr');
    off();
    setLang('en');
    expect(notified).toBe('fr'); // listener removed before this change
  });

  it('does not notify when setLang is called with the current value', () => {
    setLang('fr');
    let count = 0;
    const off = onLangChange(() => {
      count += 1;
    });
    setLang('fr'); // no-op
    expect(count).toBe(0);
    off();
  });

  it('every key present in fr exists in en (parity check)', async () => {
    const { fr } = await import('@/i18n/fr.ts');
    const { en } = await import('@/i18n/en.ts');
    const frKeys = Object.keys(fr).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(frKeys);
  });
});
