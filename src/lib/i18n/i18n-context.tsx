'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLocale, TranslationDictionary, DEFAULT_LOCALE, SUPPORTED_LOCALES } from './types';
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

function detectBrowserLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  try {
    const stored = localStorage.getItem('famvacay_locale') as SupportedLocale;
    if (stored && ['en', 'de', 'fr', 'es', 'it'].includes(stored)) {
      return stored;
    }
  } catch {
    // Gracefully handle private browsing or restricted storage access
  }

  try {
    const browserLanguages = navigator.languages || (navigator.language ? [navigator.language] : []);
    for (const lang of browserLanguages) {
      const code = lang.split('-')[0].toLowerCase() as SupportedLocale;
      if (['en', 'de', 'fr', 'es', 'it'].includes(code)) {
        return code;
      }
    }
  } catch {
    // Non-critical language detection fallback
  }

  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const detected = detectBrowserLocale();
      setLocaleState(detected);
    } catch {
      // Keep default locale
    }
  }, []);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('famvacay_locale', newLocale);
      } catch {
        // Ignore localStorage quota or access restrictions
      }
      try {
        document.documentElement.lang = newLocale;
      } catch {}
    }
  };

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
      return new Intl.DateTimeFormat(locale, options).format(value as any);
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

