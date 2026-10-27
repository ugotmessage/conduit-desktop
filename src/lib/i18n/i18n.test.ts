import { afterEach, describe, expect, it } from 'vitest';
import dictionary from '../../../locales/zh-TW.json';
import nativeDictionary from '../../../electron/locales/zh-TW';
import { t, setLanguage, resolveLanguage, LANGUAGE_KEY } from './index';

afterEach(() => { setLanguage('en'); localStorage.removeItem(LANGUAGE_KEY); });

describe('UI language', () => {
  it('uses the chosen language and falls back to English for missing keys', () => {
    setLanguage('zh-TW');
    expect(t('New Entry')).toBe('新增項目');
    expect(t('Uncatalogued message')).toBe('Uncatalogued message');
    expect(document.documentElement.lang).toBe('zh-TW');
    setLanguage('en');
    expect(t('New Entry')).toBe('New Entry');
  });
  it('resolves explicit preferences before the system language', () => {
    expect(resolveLanguage('system', 'zh-Hant-TW')).toBe('zh-TW');
    expect(resolveLanguage('system', 'zh-CN')).toBe('zh-TW');
    expect(resolveLanguage('en', 'zh-TW')).toBe('en');
    expect(resolveLanguage('zh-TW', 'en-US')).toBe('zh-TW');
    expect(resolveLanguage('invalid', 'fr-FR')).toBe('en');
  });
  it('interpolates names once without translating or interpreting user data', () => {
    setLanguage('zh-TW');
    const name = 'New Entry / <script> / {v1} / $&';
    expect(t('Close {v0}', { v0: name })).toBe(`關閉 ${name}`);
    expect(t('No answer in {v0} seconds', { v0: 0 })).toBe('0 秒內沒有回應');
    expect(t('Close {v0}')).toBe('關閉 {v0}');
  });
  it('keeps the native and renderer catalogs identical and placeholders valid', () => {
    expect(nativeDictionary).toEqual(dictionary);
    for (const [key, value] of Object.entries(dictionary)) {
      expect(value.trim(), key).not.toBe('');
      const source = new Set(key.match(/\{\w+\}/g) ?? []);
      for (const placeholder of value.match(/\{\w+\}/g) ?? []) expect(source.has(placeholder), key).toBe(true);
    }
  });
});
