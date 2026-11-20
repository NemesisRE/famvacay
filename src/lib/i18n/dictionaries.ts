import type { SupportedLocale, TranslationDictionary } from './types';
import { en } from './locales/en';
import { de } from './locales/de';
import { fr } from './locales/fr';
import { es } from './locales/es';
import { it } from './locales/it';

/** All catalogs in one place, so server code (page metadata) can read them like the client does */
export const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  en,
  de,
  fr,
  es,
  it,
};
