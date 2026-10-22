import { getAirportByIata, getLocalizedAirportDetails, type DynamicAirport } from '../airports/airport-service';
import { getSurfaceDestination, type SurfaceDestination } from './surface-destinations';

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

  let point = airportPointCache.get(airport.code);
  if (!point) {
    point = { ...airport, kind: 'AIRPORT' };
    airportPointCache.set(airport.code, point);
  }
  return point;
}

const airportPointCache = new Map<string, DestinationPoint>();

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
  const city = point?.city || fallback?.city || fallback?.name || code;
  const country = point?.country || fallback?.country || '';
  return { city, country, label: country ? `${city}, ${country}` : city };
}
