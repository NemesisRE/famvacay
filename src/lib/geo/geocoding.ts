import { getCached, setCached } from '@/lib/cache/redis';
import { getAllCommercialAirports } from '@/lib/airports/airport-service';
import { GEOCODER_USER_AGENT, photonLanguage, photonSearch, resolveSubdivisionCode } from './photon';

export interface GeocodedLocation {
  name: string;
  displayName: string;
  city?: string;
  postcode?: string;
  lat: number;
  lon: number;
  countryCode: string;
  stateCode?: string; // e.g. DE-BW, AT-9, FR-IDF, US-CA
  stateName?: string;
}

/**
 * Universal Dynamic Geocoding Service.
 * Resolves cities, towns, administrative subdivisions, and postal codes worldwide via Photon
 * (search as you type) and OpenStreetMap Nominatim (reverse lookups on a click only), backed by
 * a 7-day cache. Zero hardcoded city or postal code dictionaries.
 */
export async function geocodeLocation(rawQuery: string, language = 'en', countryHint?: string): Promise<GeocodedLocation[]> {
  const query = rawQuery.trim();
  if (!query || query.length < 2) {
    return [];
  }

  const lang = (language || 'en').slice(0, 2).toLowerCase();
  const country = countryHint && /^[a-z]{2}$/i.test(countryHint) ? countryHint.toUpperCase() : undefined;
  const cacheKey = `geo:geocode:v3:${photonLanguage(lang)}:${country || '-'}:${query.toLowerCase()}`;
  const cached = await getCached<GeocodedLocation[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  const results: GeocodedLocation[] = [];

  // Photon only: this backs a search-as-you-type field (Nominatim's usage policy forbids that).
  // Biased towards the home country chosen in the form, so a bare postcode lands there.
  const bias = country ? getCountryCenter(country) : null;
  const features = await photonSearch(query, { locale: lang, limit: 5, bias });

  // The holiday region needs the ISO code, which only matches local names ("Bayern", not
  // "Bavaria"; a city-state like Wien is its own region): for localized results that do not
  // resolve, the same search once more in local names, matched by OSM id
  const regionCode = (cc: string | undefined, p?: { state?: string; name?: string }) =>
    p?.state ? resolveSubdivisionCode(cc, p.state) : resolveSubdivisionCode(cc, p?.name);
  const localById = new Map<number, { state?: string; name?: string }>();
  const unresolved = features.some((f) => !regionCode(f.properties.countrycode, f.properties));
  if (unresolved && photonLanguage(lang) !== 'default') {
    for (const f of await photonSearch(query, { locale: 'default', limit: 5, bias })) {
      if (f.properties.osm_id !== undefined) localById.set(f.properties.osm_id, f.properties);
    }
  }

  for (const { lat, lon, properties: props } of features) {
    const countryCode = (props.countrycode || '').toUpperCase();
    // A town itself has no city property, a postcode area or street has the town in `city`; a
    // postcode area is named after its code ("76131", city "Karlsruhe")
    const isPostcodeArea = props.osm_value === 'postcode';
    const townOrCity = props.city || props.town || props.village || (isPostcodeArea ? '' : props.name) || '';
    const postcode = props.postcode || (isPostcodeArea ? props.name : undefined);
    const resolvedName = postcode && townOrCity ? `${postcode} ${townOrCity}` : props.name || townOrCity;

    results.push({
      name: resolvedName,
      displayName: [resolvedName, props.county, props.state, props.country].filter(Boolean).join(', '),
      city: townOrCity,
      postcode,
      lat,
      lon,
      countryCode,
      stateCode:
        regionCode(countryCode, props) ??
        regionCode(countryCode, props.osm_id !== undefined ? localById.get(props.osm_id) : undefined),
      stateName: props.state,
    });
  }

  // Deduplicate results by coordinate proximity and name
  const uniqueResults: GeocodedLocation[] = [];
  const seenKeys = new Set<string>();
  for (const r of results) {
    const key = `${r.name.toLowerCase()}-${r.countryCode}-${r.lat.toFixed(2)}-${r.lon.toFixed(2)}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueResults.push(r);
    }
  }

  // Cache successful results in Redis for 7 days
  if (uniqueResults.length > 0) {
    await setCached(cacheKey, uniqueResults, 60 * 60 * 24 * 7);
  }

  return uniqueResults;
}

/** Rough center of a country (mean of its commercial airports), for the search bias */
function getCountryCenter(countryCode: string): { lat: number; lon: number } | null {
  const airports = getAllCommercialAirports().filter((a) => a.state?.startsWith(`${countryCode}-`));
  if (airports.length === 0) return null;
  return {
    lat: airports.reduce((sum, a) => sum + a.lat, 0) / airports.length,
    lon: airports.reduce((sum, a) => sum + a.lon, 0) / airports.length,
  };
}

/**
 * Quick resolver to obtain coordinates from a location string dynamically.
 */
export async function resolveLocationCoordinates(
  locationString: string
): Promise<{ lat: number; lon: number; stateCode?: string; resolvedName?: string } | null> {
  const geocoded = await geocodeLocation(locationString);
  if (geocoded.length > 0) {
    return {
      lat: geocoded[0].lat,
      lon: geocoded[0].lon,
      stateCode: geocoded[0].stateCode,
      resolvedName: geocoded[0].name,
    };
  }
  return null;
}

/**
 * Reverse geocoding (coordinates -> town) for the browser's location: OpenStreetMap Nominatim at
 * town level, names in the interface language. Coordinates are rounded to ~1 km for the cache key
 * (and the request), which is plenty for a home town and keeps the exact position out of logs.
 */
export async function reverseGeocodeLocation(lat: number, lon: number, language = 'en'): Promise<GeocodedLocation | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const rLat = Math.round(lat * 100) / 100;
  const rLon = Math.round(lon * 100) / 100;
  const lang = (language || 'en').slice(0, 2).toLowerCase();
  const cacheKey = `geo:reverse:v1:${rLat}:${rLon}:${lang}`;
  const cached = await getCached<GeocodedLocation>(cacheKey);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${rLat}&lon=${rLon}&format=jsonv2&zoom=12&addressdetails=1`,
      {
        signal: controller.signal,
        headers: {
          'User-Agent': GEOCODER_USER_AGENT,
          'Accept-Language': lang,
        },
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const item = await res.json();
    if (!item || item.error) return null;

    const address = item.address || {};
    const townOrCity = address.city || address.town || address.village || address.municipality || address.suburb || item.name;
    if (!townOrCity) return null;
    const postcode = address.postcode;
    const result: GeocodedLocation = {
      name: postcode ? `${postcode} ${townOrCity}` : townOrCity,
      displayName: item.display_name || townOrCity,
      city: townOrCity,
      postcode,
      // The town's own coordinates, not the device's
      lat: parseFloat(item.lat) || rLat,
      lon: parseFloat(item.lon) || rLon,
      countryCode: (address.country_code || '').toUpperCase(),
      stateCode: address['ISO3166-2-lvl4'],
      stateName: address.state,
    };
    await setCached(cacheKey, result, 60 * 60 * 24 * 30);
    return result;
  } catch {
    return null;
  }
}
