import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from './types';

/**
 * The interface language, decided on the server so the first HTML is already in it (no English
 * flash, and browsers do not offer to translate a page that only looks English). Shared by the
 * server (root layout) and the client (language switcher), so both read and write the same cookie.
 */
export const LOCALE_COOKIE = 'famvacay_locale';
/** One year: the choice survives browser restarts */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const SUPPORTED = new Set<string>(SUPPORTED_LOCALES.map((l) => l.code));

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && SUPPORTED.has(value);
}

/**
 * Best supported language of an Accept-Language header ("de-AT,de;q=0.9,en;q=0.8"): by quality,
 * then order; regional variants count for their language (de-AT -> de).
 */
export function localeFromAcceptLanguage(header: string | null | undefined): SupportedLocale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const quality = q ? Number(q.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split('-')[0], quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((entry) => entry.quality > 0 && isSupportedLocale(entry.lang))
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return ranked.length > 0 ? (ranked[0].lang as SupportedLocale) : null;
}

/** The saved choice (cookie), otherwise the browser's preference, otherwise English */
export function negotiateLocale(cookieValue: string | null | undefined, acceptLanguage: string | null | undefined): SupportedLocale {
  if (isSupportedLocale(cookieValue)) return cookieValue;
  return localeFromAcceptLanguage(acceptLanguage) ?? DEFAULT_LOCALE;
}

/** Client side: remember the language for the next server render */
export function writeLocaleCookie(locale: SupportedLocale): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function readLocaleCookie(): SupportedLocale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`));
  return match && isSupportedLocale(match[1]) ? match[1] : null;
}
