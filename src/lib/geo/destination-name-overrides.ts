/**
 * Hand-curated holiday names for airports where the generated Wikivoyage names (see the
 * holiday-appeal generator) or the airport data miss the name people book: the island instead
 * of its capital or airport town ("Mauritius", not Plaine Magnien), Hawaii's islands, and a few
 * broken airport city names (Grenada's airport is listed in "Gonabad").
 * They win over the generated names.
 */

type Language = 'en' | 'de' | 'fr' | 'es' | 'it';
type LocalizedNames = Record<Language, string>;

/** The country's own name (localized), for island states known by it */
export const USE_COUNTRY_NAME = 'COUNTRY';

const same = (name: string): LocalizedNames => ({ en: name, de: name, fr: name, es: name, it: name });
const hawaii = (island: string): LocalizedNames => ({
  en: `Hawaii (${island})`,
  de: `Hawaii (${island})`,
  fr: `Hawaï (${island})`,
  es: `Hawái (${island})`,
  it: `Hawaii (${island})`,
});
const azores = (island: string): LocalizedNames => ({
  en: `Azores (${island})`,
  de: `Azoren (${island})`,
  fr: `Açores (${island})`,
  es: `Azores (${island})`,
  it: `Azzorre (${island})`,
});

const OVERRIDES: Record<string, LocalizedNames | typeof USE_COUNTRY_NAME> = {
  // Island states: the country is the destination
  MRU: USE_COUNTRY_NAME,
  RUN: USE_COUNTRY_NAME,
  SEZ: USE_COUNTRY_NAME,
  MLE: USE_COUNTRY_NAME,
  NAN: USE_COUNTRY_NAME,
  UVF: USE_COUNTRY_NAME,
  GND: USE_COUNTRY_NAME,
  AUA: USE_COUNTRY_NAME,
  CUR: USE_COUNTRY_NAME,
  SXM: USE_COUNTRY_NAME,

  ZNZ: { en: 'Zanzibar', de: 'Sansibar', fr: 'Zanzibar', es: 'Zanzíbar', it: 'Zanzibar' },
  ACE: same('Lanzarote'),
  SPC: same('La Palma'),
  PMI: { en: 'Mallorca', de: 'Mallorca', fr: 'Majorque', es: 'Mallorca', it: 'Maiorca' },
  MAH: { en: 'Menorca', de: 'Menorca', fr: 'Minorque', es: 'Menorca', it: 'Minorca' },
  HER: { en: 'Crete (Heraklion)', de: 'Kreta (Heraklion)', fr: 'Crète (Héraklion)', es: 'Creta (Heraclión)', it: 'Creta (Heraklion)' },
  CJU: same('Jeju'),
  ACA: same('Acapulco'),
  LOP: same('Lombok'),
  POP: same('Puerto Plata'),
  TAB: same('Tobago'),
  SKB: same('St. Kitts'),

  HNL: hawaii('Honolulu'),
  OGG: hawaii('Maui'),
  KOA: hawaii('Kona'),
  ITO: hawaii('Hilo'),
  LIH: hawaii('Kauai'),

  PDL: azores('São Miguel'),
  TER: azores('Terceira'),
  HOR: azores('Faial'),
  PIX: azores('Pico'),
  FLW: azores('Flores'),
  SMA: azores('Santa Maria'),

  MNL: same('Manila'),
  CEB: same('Cebu'),
  TAG: same('Bohol'),
  PPS: same('Palawan (Puerto Princesa)'),
  KLO: same('Boracay (Kalibo)'),
};

export function getDestinationNameOverride(code: string): LocalizedNames | typeof USE_COUNTRY_NAME | undefined {
  return OVERRIDES[(code || '').toUpperCase()];
}
