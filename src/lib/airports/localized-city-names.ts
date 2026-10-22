import cityNames from './data/city-names.json';

export type DisplayLocale = 'en' | 'de' | 'fr' | 'es' | 'it';

/**
 * Localized display names of the place each airport serves, generated from Wikidata by
 * scripts/generate-city-names.js (only names differing from the raw dataset city are stored).
 *
 * Display-only: search and destination matching keep using the raw dataset names, so these
 * translations can never change which destination a query resolves to.
 */
const LOCALIZED_CITY_NAMES = cityNames as Record<string, Partial<Record<DisplayLocale, string>>>;

/**
 * Localized display name for an airport city, or undefined when the dataset name is already
 * correct for that language.
 */
export function getLocalizedCityName(code: string, locale: string): string | undefined {
  const entry = LOCALIZED_CITY_NAMES[(code || '').toUpperCase()];
  if (!entry) return undefined;
  const loc = (locale || 'en').slice(0, 2).toLowerCase() as DisplayLocale;
  return entry[loc] || entry.en;
}
