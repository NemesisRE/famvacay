import { getCached, setCached } from '@/lib/cache/redis';

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
 * Resolves cities, towns, administrative subdivisions, and postal codes worldwide
 * using live runtime geocoding services (OpenStreetMap Nominatim & Photon Komoot)
 * backed by a 7-day Redis caching layer. Zero hardcoded city or postal code dictionaries.
 */
export async function geocodeLocation(rawQuery: string): Promise<GeocodedLocation[]> {
  const query = rawQuery.trim();
  if (!query || query.length < 2) {
    return [];
  }

  const cacheKey = `geo:geocode:${query.toLowerCase()}`;
  const cached = await getCached<GeocodedLocation[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  const results: GeocodedLocation[] = [];

  // --- 1. Primary Engine: OpenStreetMap Nominatim ---
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=5&addressdetails=1`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FamVacay/1.0 (self-hosted family vacation optimizer)',
        'Accept-Language': 'en,de,fr,es,it',
      },
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          if (isNaN(lat) || isNaN(lon)) continue;

          const countryCode = (item.address?.country_code || '').toUpperCase();
          const isoState = item.address?.['ISO3166-2-lvl4'];
          const stateName = item.address?.state;

          const townOrCity =
            item.address?.city ||
            item.address?.town ||
            item.address?.village ||
            item.address?.municipality ||
            item.address?.suburb;

          const postcode = item.address?.postcode;

          let resolvedName = item.name;
          if (townOrCity) {
            resolvedName = postcode ? `${postcode} ${townOrCity}` : townOrCity;
          } else if (postcode && item.name === postcode) {
            const parts = (item.display_name || '').split(',').map((p: string) => p.trim());
            if (parts.length > 1) {
              resolvedName = `${postcode} ${parts[1]}`;
            }
          }

          const cleanCity = townOrCity || item.name || '';

          results.push({
            name: resolvedName,
            displayName: item.display_name,
            city: cleanCity,
            postcode,
            lat,
            lon,
            countryCode,
            stateCode: isoState,
            stateName,
          });
        }
      }
    }
  } catch {
    // Proceed to secondary geocoder fallback
  }

  // --- 2. Secondary Engine Fallback: Photon Komoot Global Geocoder ---
  if (results.length === 0) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);

      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;

      const photonRes = await fetch(photonUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'FamVacay/1.0 (self-hosted family vacation optimizer)',
        },
      });

      clearTimeout(timeout);

      if (photonRes.ok) {
        const photonData = await photonRes.json();
        if (photonData?.features && Array.isArray(photonData.features)) {
          for (const feat of photonData.features) {
            const coords = feat.geometry?.coordinates;
            if (!Array.isArray(coords) || coords.length < 2) continue;
            const lon = coords[0];
            const lat = coords[1];
            if (isNaN(lat) || isNaN(lon)) continue;

            const props = feat.properties || {};
            const countryCode = (props.countrycode || '').toUpperCase();
            const townOrCity = props.city || props.town || props.village || props.name || '';
            const postcode = props.postcode;
            const stateName = props.state;

            const resolvedName = postcode && townOrCity ? `${postcode} ${townOrCity}` : props.name || townOrCity;
            const displayNameParts = [
              resolvedName,
              props.county,
              props.state,
              props.country,
            ].filter(Boolean);

            results.push({
              name: resolvedName,
              displayName: displayNameParts.join(', '),
              city: townOrCity,
              postcode,
              lat,
              lon,
              countryCode,
              stateName,
            });
          }
        }
      }
    } catch {
      // Graceful termination
    }
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
