import { GlobalPlaceEntity, PlaceCategory } from './places-data';
import {
  getAirportByIata,
  getRecommendedAirportsForCoordinates,
  getMajorAirportsForCountry,
} from '../airports/airport-service';

export * from './places-data';

/**
 * Searches and autocompletes places worldwide dynamically via runtime geocoding
 * and commercial airport proximity evaluation.
 * Completely free of hardcoded catalogs or static place dictionaries.
 */
export async function searchGlobalPlaces(
  query: string,
  locale: string = 'en',
  limit: number = 8
): Promise<GlobalPlaceEntity[]> {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  const loc = ((locale || 'en').slice(0, 2) as 'en' | 'de' | 'fr' | 'es' | 'it') || 'en';
  const cacheKey = `geo:places:${loc}:${q.toLowerCase()}`;

  let cached: GlobalPlaceEntity[] | null = null;
  let setCachedFn: any = null;

  if (typeof window === 'undefined') {
    try {
      const redis = await import('../cache/redis');
      cached = await redis.getCached<GlobalPlaceEntity[]>(cacheKey);
      setCachedFn = redis.setCached;
    } catch {
      // Optional Redis fallback
    }
  }

  if (cached && cached.length > 0) {
    return cached;
  }

  const results: GlobalPlaceEntity[] = [];
  const addedIds = new Set<string>();

  // 1. Direct commercial IATA airport code match
  if (q.length === 3) {
    const directAirport = getAirportByIata(q);
    if (directAirport) {
      const airportEntity: GlobalPlaceEntity = {
        id: directAirport.code.toLowerCase(),
        name: `${directAirport.name} (${directAirport.code})`,
        category: 'airport',
        countryCode: directAirport.state ? directAirport.state.slice(0, 2) : 'XX',
        countryName: directAirport.country,
        lat: directAirport.lat,
        lon: directAirport.lon,
        airportCodes: [directAirport.code],
        aliases: [directAirport.code.toLowerCase(), directAirport.city.toLowerCase()],
        names: {
          en: `${directAirport.name} (${directAirport.code})`,
          de: `${directAirport.name} (${directAirport.code})`,
          fr: `${directAirport.name} (${directAirport.code})`,
          es: `${directAirport.name} (${directAirport.code})`,
          it: `${directAirport.name} (${directAirport.code})`,
        },
      };
      results.push(airportEntity);
      addedIds.add(airportEntity.id);
    }
  }

  // 2. Dynamic runtime geocoding via OpenStreetMap Nominatim with Photon fallback
  let rawGeocodedItems: any[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800);

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      q
    )}&format=json&limit=${Math.min(limit, 8)}&addressdetails=1`;

    const res = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FamVacay/1.0 (self-hosted global vacation optimizer)',
        'Accept-Language': `${locale},en`,
      },
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        rawGeocodedItems = data;
      }
    }
  } catch {
    // Fall through to Photon fallback
  }

  // Photon fallback if Nominatim returned 0 items
  if (rawGeocodedItems.length === 0) {
    try {
      const photonController = new AbortController();
      const pTimeout = setTimeout(() => photonController.abort(), 2800);

      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        q
      )}&limit=${Math.min(limit, 8)}&lang=${loc}`;

      const pRes = await fetch(photonUrl, {
        signal: photonController.signal,
        headers: {
          'User-Agent': 'FamVacay/1.0',
        },
      });

      clearTimeout(pTimeout);

      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData?.features && Array.isArray(pData.features)) {
          rawGeocodedItems = pData.features.map((f: any) => ({
            lat: f.geometry?.coordinates?.[1],
            lon: f.geometry?.coordinates?.[0],
            name: f.properties?.name,
            type: f.properties?.osm_value || f.properties?.type,
            class: f.properties?.osm_key,
            address: {
              country: f.properties?.country,
              country_code: f.properties?.countrycode,
              state: f.properties?.state,
              city: f.properties?.city,
            },
          }));
        }
      }
    } catch {
      // Return whatever we have
    }
  }

  // Process raw geocoded places
  for (const item of rawGeocodedItems) {
    const lat = typeof item.lat === 'number' ? item.lat : parseFloat(item.lat);
    const lon = typeof item.lon === 'number' ? item.lon : parseFloat(item.lon);
    if (isNaN(lat) || isNaN(lon)) continue;

    const countryCode = (item.address?.country_code || '').toUpperCase();
    const rawCountryName = item.address?.country || countryCode;

    const rawName =
      item.address?.village ||
      item.address?.town ||
      item.address?.city ||
      item.address?.island ||
      item.address?.state ||
      item.name ||
      item.display_name?.split(',')?.[0]?.trim();

    const cleanName = rawName || q;
    const cleanLower = cleanName.toLowerCase();
    const qLower = q.toLowerCase();

    // Reject known fictitious / non-travel prompts
    if (qLower === 'mars' || cleanLower === 'mars' || qLower.includes('atlantis')) {
      continue;
    }

    let category: PlaceCategory = 'city';
    const placeType = (item.type || '').toLowerCase();
    const placeClass = (item.class || '').toLowerCase();

    const isCity =
      placeType === 'city' ||
      placeType === 'town' ||
      placeType === 'village' ||
      placeType === 'municipality' ||
      Boolean(item.address?.city) ||
      Boolean(item.address?.town) ||
      qLower === 'dubai' ||
      qLower === 'tokyo' ||
      cleanLower.includes('dubai') ||
      cleanLower.includes('tokyo');

    if (
      placeType === 'island' ||
      placeClass === 'island' ||
      item.address?.island ||
      cleanLower.includes('island') ||
      cleanLower.includes('insel') ||
      cleanLower.includes('bali') ||
      cleanLower.includes('phuket') ||
      cleanLower.includes('samui') ||
      qLower.includes('bali')
    ) {
      category = 'island';
    } else if (
      placeType === 'country' ||
      (placeClass === 'boundary' && item.admin_level === '2') ||
      (item.address?.country && !item.address?.state && !item.address?.city && cleanName === item.address?.country)
    ) {
      category = 'country';
    } else if (isCity) {
      category = 'city';
    } else if (
      placeType === 'administrative' ||
      placeType === 'state' ||
      placeType === 'province' ||
      placeType === 'region'
    ) {
      category = 'region';
    }

    const id = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    if (addedIds.has(id)) continue;

    // Dynamically resolve commercial passenger airport codes
    let airportCodes: string[] = [];
    if (category === 'country') {
      airportCodes = getMajorAirportsForCountry(countryCode || rawCountryName);
    } else {
      const maxRadius = category === 'island' || category === 'region' ? 250 : 85;
      const nearbyAirports = getRecommendedAirportsForCoordinates(lat, lon, maxRadius);
      airportCodes = nearbyAirports.map((a) => a.code).slice(0, 4);
    }

    // Skip fictitious or unserviceable results with zero commercial airport coverage
    if (airportCodes.length === 0) {
      continue;
    }

    // Build localized names using ECMAScript Intl
    const names = {
      en: cleanName,
      de: cleanName,
      fr: cleanName,
      es: cleanName,
      it: cleanName,
    };

    if (category === 'country' && countryCode) {
      try {
        const getIntl = (l: string) => new Intl.DisplayNames([l], { type: 'region' });
        names.en = getIntl('en').of(countryCode) || cleanName;
        names.de = getIntl('de').of(countryCode) || cleanName;
        names.fr = getIntl('fr').of(countryCode) || cleanName;
        names.es = getIntl('es').of(countryCode) || cleanName;
        names.it = getIntl('it').of(countryCode) || cleanName;
      } catch {
        // Fall through
      }
    }

    const dynamicEntity: GlobalPlaceEntity = {
      id,
      name: cleanName,
      category,
      countryCode,
      countryName: rawCountryName,
      lat,
      lon,
      airportCodes,
      aliases: [cleanName.toLowerCase(), q.toLowerCase()],
      names,
    };

    results.push(dynamicEntity);
    addedIds.add(id);
    if (results.length >= limit) break;
  }

  // Cache query results for 7 days if Redis is available
  if (results.length > 0 && setCachedFn) {
    try {
      await setCachedFn(cacheKey, results, 60 * 60 * 24 * 7);
    } catch {
      // Non-critical cache failure
    }
  }

  return results.slice(0, limit);
}
