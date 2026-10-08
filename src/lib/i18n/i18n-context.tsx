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

  const stored = localStorage.getItem('famvacay_locale') as SupportedLocale;
  if (stored && ['en', 'de', 'fr', 'es', 'it'].includes(stored)) {
    return stored;
  }

  const browserLanguages = navigator.languages || [navigator.language];
  for (const lang of browserLanguages) {
    const code = lang.split('-')[0].toLowerCase() as SupportedLocale;
    if (['en', 'de', 'fr', 'es', 'it'].includes(code)) {
      return code;
    }
  }

  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    const detected = detectBrowserLocale();
    setLocaleState(detected);
  }, []);

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('famvacay_locale', newLocale);
      document.documentElement.lang = newLocale;
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

