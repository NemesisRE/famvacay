'use client';

import React, { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
import { SupportedLocale, TranslationDictionary } from './types';
import { LOCALE_COOKIE, isSupportedLocale, readLocaleCookie, writeLocaleCookie } from './locale-negotiation';
import { en } from './locales/en';
import { de } from './locales/de';
import { fr } from './locales/fr';
import { es } from './locales/es';
import { it } from './locales/it';

const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  en,
  de,
  fr,
  es,
  it,
};

interface I18nContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: TranslationDictionary;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number, currency?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// The active language as an external store. The server decides the first one (cookie, otherwise
// Accept-Language - see locale-negotiation.ts) and hands it in as initialLocale, so server render and
// hydration agree and the first HTML is already in the right language. A switch in this visit lives
// here (and in the cookie for the next server render).
let chosenLocale: SupportedLocale | null = null;
const localeListeners = new Set<() => void>();
function subscribeToLocale(listener: () => void) {
  localeListeners.add(listener);
  return () => localeListeners.delete(listener);
}

function chooseLocale(newLocale: SupportedLocale) {
  chosenLocale = newLocale;
  writeLocaleCookie(newLocale);
  try {
    localStorage.setItem(LOCALE_COOKIE, newLocale);
  } catch {
    // Ignore localStorage quota or access restrictions
  }
  localeListeners.forEach((listener) => listener());
}

export function I18nProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale: SupportedLocale }) {
  const getServerLocale = useCallback(() => initialLocale, [initialLocale]);
  const getClientLocale = useCallback(() => chosenLocale ?? initialLocale, [initialLocale]);
  const locale = useSyncExternalStore(subscribeToLocale, getClientLocale, getServerLocale);

  // Keep <html lang> in sync after a switch (screen readers, hyphenation) - a DOM update, no React state
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Without the cookie the server guessed from Accept-Language: remember that guess - or, for
  // visitors from before the cookie existed, their saved choice (switches once, then never again)
  useEffect(() => {
    if (readLocaleCookie()) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LOCALE_COOKIE);
    } catch {
      // Private browsing / blocked storage
    }
    if (isSupportedLocale(stored) && stored !== initialLocale) chooseLocale(stored);
    else writeLocaleCookie(initialLocale);
  }, [initialLocale]);

  const setLocale = chooseLocale;

  const t = dictionaries[locale] || dictionaries.en;

  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return new Intl.DateTimeFormat(locale, options || { dateStyle: 'medium' }).format(d);
    } catch {
      return String(date);
    }
  };

  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
    try {
      return new Intl.NumberFormat(locale, options).format(value);
    } catch {
      return value.toLocaleString(locale);
    }
  };

  const formatCurrency = (value: number, currency: string = 'EUR') => {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `€${value}`;
    }
  };

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        formatDate,
        formatNumber,
        formatCurrency,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

