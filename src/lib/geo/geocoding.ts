import { getCached, setCached } from '@/lib/cache/redis';

export interface GeocodedLocation {
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  countryCode: string;
  stateCode?: string; // e.g. DE-BW, AT-9, FR-IDF
  stateName?: string;
}

// Built-in reliable offline coordinates index for common European hubs & cities
export const OFFLINE_CITY_INDEX: Record<string, { lat: number; lon: number; stateCode: string; countryCode: string; name: string }> = {
  karlsruhe: { lat: 49.0069, lon: 8.4037, stateCode: 'DE-BW', countryCode: 'DE', name: 'Karlsruhe' },
  stuttgart: { lat: 48.7758, lon: 9.1829, stateCode: 'DE-BW', countryCode: 'DE', name: 'Stuttgart' },
  mannheim: { lat: 49.4875, lon: 8.4660, stateCode: 'DE-BW', countryCode: 'DE', name: 'Mannheim' },
  freiburg: { lat: 47.9990, lon: 7.8421, stateCode: 'DE-BW', countryCode: 'DE', name: 'Freiburg im Breisgau' },
  heidelberg: { lat: 49.3988, lon: 8.6724, stateCode: 'DE-BW', countryCode: 'DE', name: 'Heidelberg' },
  badenbaden: { lat: 48.7606, lon: 8.2398, stateCode: 'DE-BW', countryCode: 'DE', name: 'Baden-Baden' },
  'baden-baden': { lat: 48.7606, lon: 8.2398, stateCode: 'DE-BW', countryCode: 'DE', name: 'Baden-Baden' },
  ulm: { lat: 48.4011, lon: 9.9876, stateCode: 'DE-BW', countryCode: 'DE', name: 'Ulm' },
  munich: { lat: 48.1351, lon: 11.5820, stateCode: 'DE-BY', countryCode: 'DE', name: 'München' },
  muenchen: { lat: 48.1351, lon: 11.5820, stateCode: 'DE-BY', countryCode: 'DE', name: 'München' },
  münchen: { lat: 48.1351, lon: 11.5820, stateCode: 'DE-BY', countryCode: 'DE', name: 'München' },
  nuremberg: { lat: 49.4521, lon: 11.0767, stateCode: 'DE-BY', countryCode: 'DE', name: 'Nürnberg' },
  nuernberg: { lat: 49.4521, lon: 11.0767, stateCode: 'DE-BY', countryCode: 'DE', name: 'Nürnberg' },
  nürnberg: { lat: 49.4521, lon: 11.0767, stateCode: 'DE-BY', countryCode: 'DE', name: 'Nürnberg' },
  frankfurt: { lat: 50.1109, lon: 8.6821, stateCode: 'DE-HE', countryCode: 'DE', name: 'Frankfurt am Main' },
  wiesbaden: { lat: 50.0782, lon: 8.2398, stateCode: 'DE-HE', countryCode: 'DE', name: 'Wiesbaden' },
  mainz: { lat: 49.9929, lon: 8.2473, stateCode: 'DE-RP', countryCode: 'DE', name: 'Mainz' },
  cologne: { lat: 50.9375, lon: 6.9603, stateCode: 'DE-NW', countryCode: 'DE', name: 'Köln' },
  koeln: { lat: 50.9375, lon: 6.9603, stateCode: 'DE-NW', countryCode: 'DE', name: 'Köln' },
  köln: { lat: 50.9375, lon: 6.9603, stateCode: 'DE-NW', countryCode: 'DE', name: 'Köln' },
  dusseldorf: { lat: 51.2277, lon: 6.7735, stateCode: 'DE-NW', countryCode: 'DE', name: 'Düsseldorf' },
  duesseldorf: { lat: 51.2277, lon: 6.7735, stateCode: 'DE-NW', countryCode: 'DE', name: 'Düsseldorf' },
  düsseldorf: { lat: 51.2277, lon: 6.7735, stateCode: 'DE-NW', countryCode: 'DE', name: 'Düsseldorf' },
  berlin: { lat: 52.5200, lon: 13.4050, stateCode: 'DE-BE', countryCode: 'DE', name: 'Berlin' },
  hamburg: { lat: 53.5511, lon: 9.9937, stateCode: 'DE-HH', countryCode: 'DE', name: 'Hamburg' },
  hannover: { lat: 52.3759, lon: 9.7320, stateCode: 'DE-NI', countryCode: 'DE', name: 'Hannover' },
  bremen: { lat: 53.0793, lon: 8.8017, stateCode: 'DE-HB', countryCode: 'DE', name: 'Bremen' },
  dresden: { lat: 51.0504, lon: 13.7373, stateCode: 'DE-SN', countryCode: 'DE', name: 'Dresden' },
  leipzig: { lat: 51.3397, lon: 12.3731, stateCode: 'DE-SN', countryCode: 'DE', name: 'Leipzig' },
  saarbruecken: { lat: 49.2402, lon: 6.9969, stateCode: 'DE-SL', countryCode: 'DE', name: 'Saarbrücken' },
  saarbrücken: { lat: 49.2402, lon: 6.9969, stateCode: 'DE-SL', countryCode: 'DE', name: 'Saarbrücken' },
  basel: { lat: 47.5596, lon: 7.5886, stateCode: 'CH-BS', countryCode: 'CH', name: 'Basel' },
  zurich: { lat: 47.3769, lon: 8.5417, stateCode: 'CH-ZH', countryCode: 'CH', name: 'Zürich' },
  zuerich: { lat: 47.3769, lon: 8.5417, stateCode: 'CH-ZH', countryCode: 'CH', name: 'Zürich' },
  zürich: { lat: 47.3769, lon: 8.5417, stateCode: 'CH-ZH', countryCode: 'CH', name: 'Zürich' },
  geneva: { lat: 46.2044, lon: 6.1432, stateCode: 'CH-GE', countryCode: 'CH', name: 'Genève' },
  genf: { lat: 46.2044, lon: 6.1432, stateCode: 'CH-GE', countryCode: 'CH', name: 'Genève' },
  bern: { lat: 46.9480, lon: 7.4474, stateCode: 'CH-BE', countryCode: 'CH', name: 'Bern' },
  vienna: { lat: 48.2082, lon: 16.3738, stateCode: 'AT-9', countryCode: 'AT', name: 'Wien' },
  wien: { lat: 48.2082, lon: 16.3738, stateCode: 'AT-9', countryCode: 'AT', name: 'Wien' },
  salzburg: { lat: 47.8095, lon: 13.0550, stateCode: 'AT-5', countryCode: 'AT', name: 'Salzburg' },
  innsbruck: { lat: 47.2692, lon: 11.4041, stateCode: 'AT-7', countryCode: 'AT', name: 'Innsbruck' },
  graz: { lat: 47.0707, lon: 15.4395, stateCode: 'AT-6', countryCode: 'AT', name: 'Graz' },
  linz: { lat: 48.3069, lon: 14.2858, stateCode: 'AT-4', countryCode: 'AT', name: 'Linz' },
  paris: { lat: 48.8566, lon: 2.3522, stateCode: 'FR-IDF', countryCode: 'FR', name: 'Paris' },
  strasbourg: { lat: 48.5734, lon: 7.7521, stateCode: 'FR-GES', countryCode: 'FR', name: 'Strasbourg' },
  strassburg: { lat: 48.5734, lon: 7.7521, stateCode: 'FR-GES', countryCode: 'FR', name: 'Strasbourg' },
  straßburg: { lat: 48.5734, lon: 7.7521, stateCode: 'FR-GES', countryCode: 'FR', name: 'Strasbourg' },
  lyon: { lat: 45.7640, lon: 4.8357, stateCode: 'FR-ARA', countryCode: 'FR', name: 'Lyon' },
  nice: { lat: 43.7102, lon: 7.2620, stateCode: 'FR-PAC', countryCode: 'FR', name: 'Nice' },
  marseille: { lat: 43.2965, lon: 5.3698, stateCode: 'FR-PAC', countryCode: 'FR', name: 'Marseille' },
  milan: { lat: 45.4642, lon: 9.1900, stateCode: 'IT-LOM', countryCode: 'IT', name: 'Milano' },
  milano: { lat: 45.4642, lon: 9.1900, stateCode: 'IT-LOM', countryCode: 'IT', name: 'Milano' },
  rome: { lat: 41.9028, lon: 12.4964, stateCode: 'IT-LAZ', countryCode: 'IT', name: 'Roma' },
  roma: { lat: 41.9028, lon: 12.4964, stateCode: 'IT-LAZ', countryCode: 'IT', name: 'Roma' },
  madrid: { lat: 40.4168, lon: -3.7038, stateCode: 'ES-MD', countryCode: 'ES', name: 'Madrid' },
  barcelona: { lat: 41.3879, lon: 2.1699, stateCode: 'ES-CT', countryCode: 'ES', name: 'Barcelona' },
};

/**
 * Geocode query via Redis Cache -> Nominatim API -> Offline Index
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

  // Try OpenStreetMap Nominatim with a fast timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FamVacay/1.0 (self-hosted family vacation optimizer)',
        'Accept-Language': 'de,en,fr',
      },
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const item of data) {
          const lat = parseFloat(item.lat);
          const lon = parseFloat(item.lon);
          if (!isNaN(lat) && !isNaN(lon)) {
            const countryCode = (item.address?.country_code || 'de').toUpperCase();
            const isoState = item.address?.['ISO3166-2-lvl4'];
            const stateName = item.address?.state;

            results.push({
              name: item.name || item.display_name.split(',')[0],
              displayName: item.display_name,
              lat,
              lon,
              countryCode,
              stateCode: isoState,
              stateName,
            });
          }
        }
      }
    }
  } catch (err) {
    // Network or rate-limiting error, gracefully fall back to local index
  }

  // Fallback to offline index if Nominatim returned nothing or was unreachable
  if (results.length === 0) {
    const qLower = query.toLowerCase();
    for (const [key, city] of Object.entries(OFFLINE_CITY_INDEX)) {
      if (key.includes(qLower) || qLower.includes(key)) {
        results.push({
          name: city.name,
          displayName: `${city.name}, ${city.stateCode}, ${city.countryCode}`,
          lat: city.lat,
          lon: city.lon,
          countryCode: city.countryCode,
          stateCode: city.stateCode,
          stateName: city.stateCode,
        });
      }
    }
  }

  // Cache successful results for 7 days
  if (results.length > 0) {
    await setCached(cacheKey, results, 60 * 60 * 24 * 7);
  }

  return results;
}

/**
 * Quick resolver to obtain coordinates from a location string
 */
export async function resolveLocationCoordinates(
  locationString: string
): Promise<{ lat: number; lon: number; stateCode?: string } | null> {
  const geocoded = await geocodeLocation(locationString);
  if (geocoded.length > 0) {
    return {
      lat: geocoded[0].lat,
      lon: geocoded[0].lon,
      stateCode: geocoded[0].stateCode,
    };
  }

  // Check offline index directly
  const qLower = locationString.toLowerCase().replace(/[^a-zäöüß]/g, '');
  for (const [key, city] of Object.entries(OFFLINE_CITY_INDEX)) {
    if (qLower.includes(key) || key.includes(qLower)) {
      return {
        lat: city.lat,
        lon: city.lon,
        stateCode: city.stateCode,
      };
    }
  }

  return null;
}

