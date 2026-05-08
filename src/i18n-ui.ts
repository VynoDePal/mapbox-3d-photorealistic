import { getLang, setLang, onLangChange, t, type Lang, type DictKey } from '@/i18n/index.ts';

// --- Static DOM translation system ----------------------------------------
// Elements declare their key in `data-i18n` (text content) or `data-i18n-attr`
// ("placeholder=key,aria-label=key" CSV). On every language change, all such
// elements are updated. This avoids re-rendering the whole UI.

function applyTo(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n as DictKey | undefined;
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-attr]').forEach((el) => {
    const spec = el.dataset.i18nAttr ?? '';
    spec.split(',').forEach((pair) => {
      const [attr, k] = pair.split('=').map((s) => s.trim());
      if (!attr || !k) return;
      el.setAttribute(attr, t(k as DictKey));
    });
  });
}

export function applyStaticTranslations(): void {
  document.documentElement.lang = getLang();
  applyTo();
}

export function initI18nUI(): void {
  applyStaticTranslations();
  onLangChange(() => applyStaticTranslations());

  const container = document.getElementById('lang-switcher');
  if (!container) return;
  container.innerHTML = '';
  const buildBtn = (lang: Lang, label: string): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-btn';
    btn.dataset.lang = lang;
    btn.textContent = label;
    btn.setAttribute('aria-pressed', String(getLang() === lang));
    btn.addEventListener('click', () => setLang(lang));
    return btn;
  };
  const frBtn = buildBtn('fr', 'FR');
  const enBtn = buildBtn('en', 'EN');
  container.append(frBtn, enBtn);
  container.setAttribute('aria-label', t('langSwitchLabel'));

  onLangChange((lang) => {
    frBtn.setAttribute('aria-pressed', String(lang === 'fr'));
    enBtn.setAttribute('aria-pressed', String(lang === 'en'));
    container.setAttribute('aria-label', t('langSwitchLabel'));
  });
}
