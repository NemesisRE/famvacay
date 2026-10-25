import { getAirportByIata, getLocalizedAirportDetails, type DynamicAirport } from '../airports/airport-service';
import { getSurfaceDestination, type SurfaceDestination } from './surface-destinations';
import { datasetScopedCache, getDataset } from '@/lib/datasets/store';
import destinationNamesSeed from './data/destination-names.json';
import type { DestinationNameEntry } from '@/lib/datasets/generators/holiday-appeal';

export type DestinationPointKind = 'AIRPORT' | 'SURFACE';

/**
 * A destination the optimizer can score, whether it is a commercial airport or an overland
 * surface node. Shape-compatible with DynamicAirport (altitude in feet) so climate, style,
 * and pricing models can consume either without caring which index it came from.
 */
export interface DestinationPoint extends DynamicAirport {
  kind: DestinationPointKind;
  surface?: SurfaceDestination;
}

const FEET_PER_METER = 3.28084;
const surfacePointCache = new Map<string, DestinationPoint>();

function surfaceToPoint(s: SurfaceDestination): DestinationPoint {
  let point = surfacePointCache.get(s.code);
  if (!point) {
    point = {
      kind: 'SURFACE',
      surface: s,
      code: s.code,
      icao: '',
      name: `${s.city} (${s.region})`,
      city: s.city,
      country: s.country,
      lat: s.lat,
      lon: s.lon,
      altitude: Math.round(s.altitudeMeters * FEET_PER_METER),
      state: s.state,
      isHighSpeedRailConnected: Boolean(s.isHighSpeedRailConnected),
      isMajorHub: false,
      keywords: [s.region, s.keywords].filter(Boolean).join(' '),
    };
    surfacePointCache.set(s.code, point);
  }
  return point;
}

/**
 * Resolves any destination code (IATA airport or "srf:" surface node) to its geo point.
 * Use this - not getAirportByIata - wherever a *destination* is looked up; origins and
 * flight legs are still airport-only.
 */
export function getDestinationPoint(code: string, locale?: string): DestinationPoint | undefined {
  if (!code) return undefined;
  const surface = getSurfaceDestination(code);
  if (surface) {
    const point = surfaceToPoint(surface);
    return locale ? localizeSurfacePoint(point, surface, locale) : point;
  }

  const airport = getAirportByIata(code);
  if (!airport) return undefined;
  if (locale) return { ...getLocalizedAirportDetails(airport, locale), kind: 'AIRPORT' };

  const cache = airportPointCache();
  let point = cache.get(airport.code);
  if (!point) {
    point = { ...airport, kind: 'AIRPORT' };
    cache.set(airport.code, point);
  }
  return point;
}

// Copies of airport records: emptied whenever a refreshed airport dataset lands
const airportPointCache = datasetScopedCache<string, DestinationPoint>();

function localizeSurfacePoint(point: DestinationPoint, s: SurfaceDestination, locale: string): DestinationPoint {
  const loc = (locale || 'en').slice(0, 2).toLowerCase() as 'en' | 'de' | 'fr' | 'es' | 'it';
  let country = point.country;
  try {
    country = new Intl.DisplayNames([loc], { type: 'region' }).of(s.state.split('-')[0]) || point.country;
  } catch {
    // Keep the English country name
  }
  return { ...point, city: s.localizedCity?.[loc] || s.localizedCity?.en || s.city, country };
}

export interface LocalizedDestinationLabel {
  city: string;
  country: string;
  /** "City, Country" in the UI language */
  label: string;
}

/**
 * Display name of any destination (airport or surface node) in the UI language. Every place
 * that shows a destination should use this rather than the raw candidate fields, which carry
 * the dataset's (mostly English, sometimes local-language) names.
 */
export function getLocalizedDestinationLabel(
  code: string,
  locale: string,
  fallback?: { city?: string; country?: string; name?: string }
): LocalizedDestinationLabel {
  const point = getDestinationPoint(code, locale);
  const pointCity = point?.city || fallback?.city || fallback?.name || code;
  const country = point?.country || fallback?.country || '';
  const famous = getFamousDestinationName(code, locale);
  // "Bali" instead of Denpasar; "Kreta (Heraklion)" where several airports share the island
  const city = famous
    ? famous.shared && foldName(famous.name) !== foldName(pointCity)
      ? `${famous.name} (${pointCity})`
      : famous.name
    : pointCity;
  const label = country && city.toLowerCase() !== country.toLowerCase() ? `${city}, ${country}` : city;
  return { city, country, label };
}

const destinationNames = () =>
  getDataset('destination-names', destinationNamesSeed as unknown as Record<string, DestinationNameEntry>);

/**
 * The famous island or region an airport serves (from Wikivoyage, see the holiday-appeal
 * generator), in the UI language; undefined to show the city.
 */
export function getFamousDestinationName(code: string, locale: string): { name: string; shared: boolean } | undefined {
  const entry = destinationNames()[(code || '').toUpperCase()];
  if (!entry) return undefined;
  // Only a different place than the city names already show (Bali for Denpasar): where it is the
  // same place under another spelling (Santorini), the localized city name ("Santorin") is better
  const englishCity = getDestinationPoint(code, 'en')?.city;
  if (entry.n.en && englishCity && foldName(entry.n.en) === foldName(englishCity)) return undefined;
  const lang = (locale || 'en').slice(0, 2).toLowerCase() as keyof DestinationNameEntry['n'];
  const name = entry.n[lang] ?? entry.n.en ?? entry.n.de;
  return name ? { name, shared: entry.s === 1 } : undefined;
}

/** Case- and accent-insensitive form for comparing place names */
function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
