import zhTW from '../../../locales/zh-TW.json';

export type UiLanguage = 'system' | 'en' | 'zh-TW';
export const LANGUAGE_KEY = 'conduit:ui-language';
const dictionary: Readonly<Record<string, string>> = zhTW;

export function resolveLanguage(value: unknown, systemLocale = 'en'): 'en' | 'zh-TW' {
  if (value === 'zh-TW' || value === 'en') return value;
  return /^zh(?:-|$)/i.test(systemLocale) ? 'zh-TW' : 'en';
}

function cachedLanguage(): UiLanguage {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    return value === 'en' || value === 'zh-TW' ? value : 'system';
  } catch { return 'system'; }
}
let language = resolveLanguage(cachedLanguage(), typeof navigator === 'undefined' ? 'en' : navigator.language);

/** Only call on authored UI copy. Never pass names, credentials, commands, or remote output. */
export function t(english: string, values?: Readonly<Record<string, string | number>>): string {
  const copy = language === 'zh-TW' ? dictionary[english] ?? english : english;
  return values ? copy.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match) : copy;
}

export function setLanguage(value: UiLanguage, systemLocale = typeof navigator === 'undefined' ? 'en' : navigator.language): void {
  language = resolveLanguage(value, systemLocale);
  try { localStorage.setItem(LANGUAGE_KEY, value); } catch { /* Storage can be unavailable in auxiliary windows. */ }
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}

/** Load preferences before importing UI modules with module-level display labels. */
export async function initializeLanguage(): Promise<void> {
  try {
    const { invoke } = await import('../electron');
    const settings = await invoke<{ ui_language?: UiLanguage }>('settings_get');
    setLanguage(settings.ui_language ?? cachedLanguage());
  } catch { setLanguage(cachedLanguage()); }
}
