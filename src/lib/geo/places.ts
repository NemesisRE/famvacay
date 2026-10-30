import { GlobalPlaceEntity, PlaceCategory } from './places-data';
import { photonLanguage, photonSearch } from './photon';
import {
  getAirportByIata,
  getRecommendedAirportsForCoordinates,
  getMajorAirportsForCountry,
  getAllCommercialAirports,
  calculateGeodesicDistanceKm,
} from '../airports/airport-service';

export * from './places-data';

/** OSM place types too small to be a destination of their own */
const TOO_SMALL_PLACES = new Set(['hamlet', 'isolated_dwelling', 'farm', 'plot', 'neighbourhood', 'quarter', 'suburb', 'locality', 'city_block']);

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
  // Results depend on the Photon language (es/it get local names), not the interface locale itself
  const cacheKey = `geo:places:v2:${photonLanguage(loc)}:${q.toLowerCase()}`;

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

  // 2. Dynamic runtime geocoding via Photon: this backs a search-as-you-type field, which the
  //    public Nominatim server's usage policy forbids
  //    Only places, boundaries and natural features above hamlet level: Photon also finds radio
  //    studios, stations and restaurants named after a place
  const rawGeocodedItems: any[] = (await photonSearch(q, { locale: loc, limit: 12, timeoutMs: 2800 }))
    .filter(
      ({ properties: p }) =>
        ['place', 'boundary', 'natural'].includes(p.osm_key || '') && !TOO_SMALL_PLACES.has(p.osm_value || '')
    )
    .map(({ lat, lon, properties: p }) => ({
      lat,
      lon,
      name: p.name,
      type: p.osm_value || p.type,
      class: p.osm_key,
      address: {
        country: p.country,
        country_code: p.countrycode,
        state: p.state,
        city: p.city,
      },
    }));

  // Process raw geocoded places
  for (const item of rawGeocodedItems) {
    const lat = typeof item.lat === 'number' ? item.lat : parseFloat(item.lat);
    const lon = typeof item.lon === 'number' ? item.lon : parseFloat(item.lon);
    if (isNaN(lat) || isNaN(lon)) continue;

    const countryCode = (item.address?.country_code || '').toUpperCase();
    const rawCountryName = item.address?.country || countryCode;

    const rawName =
      item.name ||
      item.address?.island ||
      item.address?.city ||
      item.address?.town ||
      item.address?.village ||
      item.address?.municipality ||
      item.address?.region ||
      item.address?.state ||
      item.display_name?.split(',')?.[0]?.trim();

    const cleanName = rawName || q;

    let category: PlaceCategory = 'city';
    const placeType = (item.type || '').toLowerCase();
    const placeClass = (item.class || '').toLowerCase();
    const adminLevel = item.admin_level ? String(item.admin_level) : '';

    const isIsland =
      placeType === 'island' ||
      placeClass === 'island' ||
      Boolean(item.address?.island) ||
      /\b(island|islands|isle|isles|insel|inseln|île|îles|isla|islas|isola|isole|atoll|archipelago)\b/i.test(cleanName) ||
      /^(ko|koh|pulau)\s+/i.test(cleanName) ||
      /\b(island|islands|isle|isles|insel|inseln|île|îles|isla|islas|isola|isole|atoll|archipelago)\b/i.test(q);

    const isCountry =
      placeType === 'country' ||
      (placeClass === 'boundary' && adminLevel === '2') ||
      (Boolean(item.address?.country) &&
        !item.address?.state &&
        !item.address?.city &&
        cleanName.toLowerCase() === (item.address?.country || '').toLowerCase());

    const isMajorRegion =
      placeType === 'state' ||
      placeType === 'province' ||
      placeType === 'region' ||
      Boolean(item.address?.region) ||
      cleanName.includes('&') ||
      (placeClass === 'boundary' && (adminLevel === '3' || adminLevel === '4' || adminLevel === '5'));

    const isCity =
      placeType === 'city' ||
      placeType === 'town' ||
      placeType === 'municipality' ||
      Boolean(item.address?.city) ||
      Boolean(item.address?.town) ||
      (placeClass === 'boundary' && (adminLevel === '6' || adminLevel === '7'));

    const isSeaOrMajorRegion =
      placeType === 'sea' ||
      placeType === 'water' ||
      placeType === 'ocean' ||
      item.class === 'natural' ||
      item.class === 'water' ||
      /\b(sea|ocean|basin|caribbean|karibik|mediterranean|mittelmeer|alps|alpen|gulf|bay|archipelago|sound)\b/i.test(cleanName + ' ' + q);

    if (isIsland) {
      category = 'island';
    } else if (isCountry) {
      category = 'country';
    } else if (isSeaOrMajorRegion || isMajorRegion) {
      category = 'region';
    } else if (isCity) {
      category = 'city';
    } else {
      category = 'city';
    }

    const id = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    if (addedIds.has(id)) continue;

    // Dynamically resolve commercial passenger airport codes
    let airportCodes: string[] = [];
    if (category === 'country') {
      airportCodes = getMajorAirportsForCountry(countryCode || rawCountryName);
    } else if (isSeaOrMajorRegion) {
      // Broad seas and multinational basins (e.g. Caribbean, Mediterranean)
      const allAirports = getAllCommercialAirports();
      const isCaribbean = /\b(caribbean|karibik|caraibes|caribe|caraibi)\b/i.test(cleanName + ' ' + q);
      const nearbyAirports = allAirports
        .map((a) => ({ airport: a, distKm: calculateGeodesicDistanceKm(lat, lon, a.lat, a.lon) }))
        .filter((item) => {
          const altM = (item.airport.altitude || 0) * 0.3048;
          if (isCaribbean) {
            return (
              item.distKm <= 2600 &&
              altM < 350 &&
              item.airport.lat >= 9 &&
              item.airport.lat <= 28 &&
              item.airport.lon >= -90 &&
              item.airport.lon <= -58
            );
          }
          return item.distKm <= 1600 && altM < 400;
        })
        .sort((a, b) => {
          const aRank = (a.airport.type === 'large_airport' ? 3 : 0) + (a.airport.isMajorHub ? 2 : 0);
          const bRank = (b.airport.type === 'large_airport' ? 3 : 0) + (b.airport.isMajorHub ? 2 : 0);
          if (bRank !== aRank) return bRank - aRank;
          return a.distKm - b.distKm;
        });

      // Group airports by sovereign/island territory to guarantee representation of every island & country
      const byCountry = new Map<string, typeof nearbyAirports>();
      for (const item of nearbyAirports) {
        const c = item.airport.country || 'XX';
        const list = byCountry.get(c) || [];
        list.push(item);
        byCountry.set(c, list);
      }

      const selectedCodes: string[] = [];
      let round = 0;
      let added = true;
      while (added && round < 4) {
        added = false;
        for (const [, list] of byCountry.entries()) {
          if (round < list.length) {
            selectedCodes.push(list[round].airport.code);
            added = true;
          }
        }
        round++;
      }
      airportCodes = selectedCodes.length > 0 ? selectedCodes : nearbyAirports.map((item) => item.airport.code);
    } else {
      const isExtendedCorridor = cleanName.includes('&') || q.includes('&') || /\b(corridor|meer|sea|riviera)\b/i.test(cleanName + ' ' + q);
      const maxRadius = isExtendedCorridor ? 215 : 95;
      const nearbyAirports = getRecommendedAirportsForCoordinates(lat, lon, maxRadius);
      const inCountryAirports = countryCode
        ? nearbyAirports.filter(
            (a) =>
              (a.state && a.state.startsWith(countryCode.toUpperCase() + '-')) ||
              a.country.toUpperCase() === rawCountryName.toUpperCase()
          )
        : [];
      const candidateList = inCountryAirports.length >= 2 ? inCountryAirports : nearbyAirports;
      airportCodes = candidateList.map((a) => a.code).slice(0, 3);
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
