import { describe, it, expect } from 'vitest';
import { isSupportedLocale, localeFromAcceptLanguage, negotiateLocale } from '../locale-negotiation';

describe('locale negotiation', () => {
  it('takes the best supported language of Accept-Language, by quality then order', () => {
    expect(localeFromAcceptLanguage('de-DE,de;q=0.9,en;q=0.8')).toBe('de');
    expect(localeFromAcceptLanguage('ja-JP,fr;q=0.7,it;q=0.9')).toBe('it');
    expect(localeFromAcceptLanguage('pt-BR, es-AR;q=0.5, es;q=0.5')).toBe('es');
    expect(localeFromAcceptLanguage('EN-gb')).toBe('en');
    expect(localeFromAcceptLanguage('fr;q=0, de;q=0.1')).toBe('de');
  });

  it('returns nothing for unsupported or missing headers', () => {
    expect(localeFromAcceptLanguage('ja,zh-CN;q=0.9')).toBeNull();
    expect(localeFromAcceptLanguage('')).toBeNull();
    expect(localeFromAcceptLanguage(undefined)).toBeNull();
    expect(localeFromAcceptLanguage('*')).toBeNull();
  });

  it('prefers the saved choice, then the browser, then English', () => {
    expect(negotiateLocale('fr', 'de-DE,de;q=0.9')).toBe('fr');
    expect(negotiateLocale('xx', 'de-DE,de;q=0.9')).toBe('de');
    expect(negotiateLocale(undefined, 'ja')).toBe('en');
    expect(negotiateLocale(undefined, undefined)).toBe('en');
  });

  it('only accepts the five supported locales', () => {
    expect(['en', 'de', 'fr', 'es', 'it'].every(isSupportedLocale)).toBe(true);
    expect(isSupportedLocale('pt')).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
  });
});
