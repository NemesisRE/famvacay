import {
  GLOBAL_PLACES_CATALOG,
  GlobalPlaceEntity,
  PlaceCategory,
} from './places-data';

export * from './places-data';

/**
 * Searches and autocompletes places worldwide.
 * Prioritizes:
 * 1. Exact / Substring matches from curated Global Places Catalog
 * 2. Fuzzy Levenshtein matches
 * 3. Dynamic Nominatim place resolution with airport proximity mapping for uncataloged places
 */
export async function searchGlobalPlaces(
  query: string,
  locale: string = 'en',
  limit: number = 8
): Promise<GlobalPlaceEntity[]> {
  const q = query.trim().toLowerCase();
  if (!q || q.length < 2) return [];

  const loc = (locale || 'en').slice(0, 2) as 'en' | 'de' | 'fr' | 'es' | 'it';
  const cacheKey = `geo:places:${loc}:${q}`;

  let cached: GlobalPlaceEntity[] | null = null;
  let setCachedFn: any = null;

  try {
    const redis = await import('../cache/redis');
    cached = await redis.getCached<GlobalPlaceEntity[]>(cacheKey);
    setCachedFn = redis.setCached;
  } catch {
    // Optional Redis fallback
  }

  if (cached && cached.length > 0) {
    return cached;
  }

  const results: GlobalPlaceEntity[] = [];
  const addedIds = new Set<string>();

  // 1. Direct Catalog Match (Name, Localized Name, or Aliases)
  for (const place of GLOBAL_PLACES_CATALOG) {
    const locName = (place.names[loc] || place.name).toLowerCase();
    const hasNameMatch = locName.includes(q) || place.name.toLowerCase().includes(q);
    const hasAliasMatch = place.aliases.some((a) => a.toLowerCase().includes(q));

    if (hasNameMatch || hasAliasMatch) {
      results.push(place);
      addedIds.add(place.id);
      if (results.length >= limit) break;
    }
  }

  // 2. Fuzzy Match against catalog if results < limit
  if (results.length < limit) {
    for (const place of GLOBAL_PLACES_CATALOG) {
      if (addedIds.has(place.id)) continue;
      const cleanQ = q.replace(/[^a-z0-9]/g, '');
      const cleanName = place.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanQ.length >= 3 && cleanName.length >= 3) {
        const isPrefix = cleanName.startsWith(cleanQ) || cleanQ.startsWith(cleanName);
        if (isPrefix) {
          results.push(place);
          addedIds.add(place.id);
          if (results.length >= limit) break;
        }
      }
    }
  }

  // 3. Dynamic OpenStreetMap Nominatim Resolution if no / few catalog matches
  if (results.length < 3) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2800);

      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        query
      )}&format=json&limit=5&addressdetails=1`;

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'FamVacay/1.0 (self-hosted global vacation optimizer)',
          'Accept-Language': `${locale},en`,
        },
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Import dynamic airports index for geodesic proximity lookup
          const { getRecommendedAirportsForCoordinates } = await import(
            '../airports/airport-service'
          );

          for (const item of data) {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            if (isNaN(lat) || isNaN(lon)) continue;

            const countryCode = (item.address?.country_code || '').toUpperCase();
            const countryName = item.address?.country || countryCode;

            // Determine entity classification
            let category: PlaceCategory = 'city';
            const placeType = (item.type || '').toLowerCase();
            const placeClass = (item.class || '').toLowerCase();

            if (placeType === 'island' || placeClass === 'island') {
              category = 'island';
            } else if (placeType === 'country' || placeClass === 'country') {
              category = 'country';
            } else if (
              placeType === 'administrative' ||
              placeType === 'state' ||
              placeType === 'province' ||
              placeType === 'region'
            ) {
              category = 'region';
            }

            const rawName =
              item.address?.village ||
              item.address?.town ||
              item.address?.city ||
              item.address?.island ||
              item.address?.state ||
              item.name;

            const cleanName = rawName || item.display_name.split(',')[0].trim();
            const id = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');

            if (addedIds.has(id)) continue;

            // Find closest commercial airports within 350km
            const nearbyAirports = getRecommendedAirportsForCoordinates(lat, lon, 350);
            const airportCodes = nearbyAirports.map((a: any) => a.code).slice(0, 3);

            const dynamicEntity: GlobalPlaceEntity = {
              id,
              name: cleanName,
              category,
              countryCode,
              countryName,
              lat,
              lon,
              airportCodes,
              aliases: [cleanName.toLowerCase()],
              names: {
                en: cleanName,
                de: cleanName,
                fr: cleanName,
                es: cleanName,
                it: cleanName,
              },
            };

            results.push(dynamicEntity);
            addedIds.add(id);
            if (results.length >= limit) break;
          }
        }
      }
    } catch {
      // Gracefully return whatever catalog matches we found
    }
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

