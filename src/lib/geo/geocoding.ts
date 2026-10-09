import { getCached, setCached } from '@/lib/cache/redis';

export interface GeocodedLocation {
  name: string;
  displayName: string;
  city?: string;
  postcode?: string;
  lat: number;
  lon: number;
  countryCode: string;
  stateCode?: string; // e.g. DE-BW, AT-9, FR-IDF
  stateName?: string;
}

// Built-in reliable offline coordinates & postal code index for common European hubs & cities
export const OFFLINE_CITY_INDEX: Record<
  string,
  { lat: number; lon: number; stateCode: string; countryCode: string; name: string; postcode?: string; city?: string }
> = {
  // Cities
  karlsruhe: { lat: 49.0069, lon: 8.4037, stateCode: 'DE-BW', countryCode: 'DE', name: 'Karlsruhe', city: 'Karlsruhe' },
  stuttgart: { lat: 48.7758, lon: 9.1829, stateCode: 'DE-BW', countryCode: 'DE', name: 'Stuttgart', city: 'Stuttgart' },
  mannheim: { lat: 49.4875, lon: 8.4660, stateCode: 'DE-BW', countryCode: 'DE', name: 'Mannheim', city: 'Mannheim' },
  freiburg: { lat: 47.9990, lon: 7.8421, stateCode: 'DE-BW', countryCode: 'DE', name: 'Freiburg im Breisgau', city: 'Freiburg' },
  heidelberg: { lat: 49.3988, lon: 8.6724, stateCode: 'DE-BW', countryCode: 'DE', name: 'Heidelberg', city: 'Heidelberg' },
  badenbaden: { lat: 48.7606, lon: 8.2398, stateCode: 'DE-BW', countryCode: 'DE', name: 'Baden-Baden', city: 'Baden-Baden' },
  'baden-baden': { lat: 48.7606, lon: 8.2398, stateCode: 'DE-BW', countryCode: 'DE', name: 'Baden-Baden', city: 'Baden-Baden' },
  ulm: { lat: 48.4011, lon: 9.9876, stateCode: 'DE-BW', countryCode: 'DE', name: 'Ulm', city: 'Ulm' },
  munich: { lat: 48.1351, lon: 11.5820, stateCode: 'DE-BY', countryCode: 'DE', name: 'München', city: 'München' },
  muenchen: { lat: 48.1351, lon: 11.5820, stateCode: 'DE-BY', countryCode: 'DE', name: 'München', city: 'München' },
  münchen: { lat: 48.1351, lon: 11.5820, stateCode: 'DE-BY', countryCode: 'DE', name: 'München', city: 'München' },
  nuremberg: { lat: 49.4521, lon: 11.0767, stateCode: 'DE-BY', countryCode: 'DE', name: 'Nürnberg', city: 'Nürnberg' },
  nuernberg: { lat: 49.4521, lon: 11.0767, stateCode: 'DE-BY', countryCode: 'DE', name: 'Nürnberg', city: 'Nürnberg' },
  nürnberg: { lat: 49.4521, lon: 11.0767, stateCode: 'DE-BY', countryCode: 'DE', name: 'Nürnberg', city: 'Nürnberg' },
  frankfurt: { lat: 50.1109, lon: 8.6821, stateCode: 'DE-HE', countryCode: 'DE', name: 'Frankfurt am Main', city: 'Frankfurt am Main' },
  wiesbaden: { lat: 50.0782, lon: 8.2398, stateCode: 'DE-HE', countryCode: 'DE', name: 'Wiesbaden', city: 'Wiesbaden' },
  mainz: { lat: 49.9929, lon: 8.2473, stateCode: 'DE-RP', countryCode: 'DE', name: 'Mainz', city: 'Mainz' },
  cologne: { lat: 50.9375, lon: 6.9603, stateCode: 'DE-NW', countryCode: 'DE', name: 'Köln', city: 'Köln' },
  koeln: { lat: 50.9375, lon: 6.9603, stateCode: 'DE-NW', countryCode: 'DE', name: 'Köln', city: 'Köln' },
  köln: { lat: 50.9375, lon: 6.9603, stateCode: 'DE-NW', countryCode: 'DE', name: 'Köln', city: 'Köln' },
  dusseldorf: { lat: 51.2277, lon: 6.7735, stateCode: 'DE-NW', countryCode: 'DE', name: 'Düsseldorf', city: 'Düsseldorf' },
  duesseldorf: { lat: 51.2277, lon: 6.7735, stateCode: 'DE-NW', countryCode: 'DE', name: 'Düsseldorf', city: 'Düsseldorf' },
  düsseldorf: { lat: 51.2277, lon: 6.7735, stateCode: 'DE-NW', countryCode: 'DE', name: 'Düsseldorf', city: 'Düsseldorf' },
  berlin: { lat: 52.5200, lon: 13.4050, stateCode: 'DE-BE', countryCode: 'DE', name: 'Berlin', city: 'Berlin' },
  hamburg: { lat: 53.5511, lon: 9.9937, stateCode: 'DE-HH', countryCode: 'DE', name: 'Hamburg', city: 'Hamburg' },
  hannover: { lat: 52.3759, lon: 9.7320, stateCode: 'DE-NI', countryCode: 'DE', name: 'Hannover', city: 'Hannover' },
  bremen: { lat: 53.0793, lon: 8.8017, stateCode: 'DE-HB', countryCode: 'DE', name: 'Bremen', city: 'Bremen' },
  dresden: { lat: 51.0504, lon: 13.7373, stateCode: 'DE-SN', countryCode: 'DE', name: 'Dresden', city: 'Dresden' },
  leipzig: { lat: 51.3397, lon: 12.3731, stateCode: 'DE-SN', countryCode: 'DE', name: 'Leipzig', city: 'Leipzig' },
  saarbruecken: { lat: 49.2402, lon: 6.9969, stateCode: 'DE-SL', countryCode: 'DE', name: 'Saarbrücken', city: 'Saarbrücken' },
  saarbrücken: { lat: 49.2402, lon: 6.9969, stateCode: 'DE-SL', countryCode: 'DE', name: 'Saarbrücken', city: 'Saarbrücken' },
  basel: { lat: 47.5596, lon: 7.5886, stateCode: 'CH-BS', countryCode: 'CH', name: 'Basel', city: 'Basel' },
  zurich: { lat: 47.3769, lon: 8.5417, stateCode: 'CH-ZH', countryCode: 'CH', name: 'Zürich', city: 'Zürich' },
  zuerich: { lat: 47.3769, lon: 8.5417, stateCode: 'CH-ZH', countryCode: 'CH', name: 'Zürich', city: 'Zürich' },
  zürich: { lat: 47.3769, lon: 8.5417, stateCode: 'CH-ZH', countryCode: 'CH', name: 'Zürich', city: 'Zürich' },
  geneva: { lat: 46.2044, lon: 6.1432, stateCode: 'CH-GE', countryCode: 'CH', name: 'Genève', city: 'Genève' },
  genf: { lat: 46.2044, lon: 6.1432, stateCode: 'CH-GE', countryCode: 'CH', name: 'Genève', city: 'Genève' },
  bern: { lat: 46.9480, lon: 7.4474, stateCode: 'CH-BE', countryCode: 'CH', name: 'Bern', city: 'Bern' },
  vienna: { lat: 48.2082, lon: 16.3738, stateCode: 'AT-9', countryCode: 'AT', name: 'Wien', city: 'Wien' },
  wien: { lat: 48.2082, lon: 16.3738, stateCode: 'AT-9', countryCode: 'AT', name: 'Wien', city: 'Wien' },
  salzburg: { lat: 47.8095, lon: 13.0550, stateCode: 'AT-5', countryCode: 'AT', name: 'Salzburg', city: 'Salzburg' },
  innsbruck: { lat: 47.2692, lon: 11.4041, stateCode: 'AT-7', countryCode: 'AT', name: 'Innsbruck', city: 'Innsbruck' },
  graz: { lat: 47.0707, lon: 15.4395, stateCode: 'AT-6', countryCode: 'AT', name: 'Graz', city: 'Graz' },
  linz: { lat: 48.3069, lon: 14.2858, stateCode: 'AT-4', countryCode: 'AT', name: 'Linz', city: 'Linz' },
  paris: { lat: 48.8566, lon: 2.3522, stateCode: 'FR-IDF', countryCode: 'FR', name: 'Paris', city: 'Paris' },
  strasbourg: { lat: 48.5734, lon: 7.7521, stateCode: 'FR-GES', countryCode: 'FR', name: 'Strasbourg', city: 'Strasbourg' },
  strassburg: { lat: 48.5734, lon: 7.7521, stateCode: 'FR-GES', countryCode: 'FR', name: 'Strasbourg', city: 'Strasbourg' },
  straßburg: { lat: 48.5734, lon: 7.7521, stateCode: 'FR-GES', countryCode: 'FR', name: 'Strasbourg', city: 'Strasbourg' },
  lyon: { lat: 45.7640, lon: 4.8357, stateCode: 'FR-ARA', countryCode: 'FR', name: 'Lyon', city: 'Lyon' },
  nice: { lat: 43.7102, lon: 7.2620, stateCode: 'FR-PAC', countryCode: 'FR', name: 'Nice', city: 'Nice' },
  marseille: { lat: 43.2965, lon: 5.3698, stateCode: 'FR-PAC', countryCode: 'FR', name: 'Marseille', city: 'Marseille' },
  milan: { lat: 45.4642, lon: 9.1900, stateCode: 'IT-LOM', countryCode: 'IT', name: 'Milano', city: 'Milano' },
  milano: { lat: 45.4642, lon: 9.1900, stateCode: 'IT-LOM', countryCode: 'IT', name: 'Milano', city: 'Milano' },
  rome: { lat: 41.9028, lon: 12.4964, stateCode: 'IT-LAZ', countryCode: 'IT', name: 'Roma', city: 'Roma' },
  roma: { lat: 41.9028, lon: 12.4964, stateCode: 'IT-LAZ', countryCode: 'IT', name: 'Roma', city: 'Roma' },
  madrid: { lat: 40.4168, lon: -3.7038, stateCode: 'ES-MD', countryCode: 'ES', name: 'Madrid', city: 'Madrid' },
  barcelona: { lat: 41.3879, lon: 2.1699, stateCode: 'ES-CT', countryCode: 'ES', name: 'Barcelona', city: 'Barcelona' },

  // Key Municipalities & Postal Codes
  '76334': { lat: 49.0768, lon: 8.3915, stateCode: 'DE-BW', countryCode: 'DE', name: '76334 Eggenstein-Leopoldshafen', city: 'Eggenstein-Leopoldshafen', postcode: '76334' },
  eggenstein: { lat: 49.0768, lon: 8.3915, stateCode: 'DE-BW', countryCode: 'DE', name: 'Eggenstein-Leopoldshafen', city: 'Eggenstein-Leopoldshafen', postcode: '76334' },
  'eggenstein-leopoldshafen': { lat: 49.0768, lon: 8.3915, stateCode: 'DE-BW', countryCode: 'DE', name: 'Eggenstein-Leopoldshafen', city: 'Eggenstein-Leopoldshafen', postcode: '76334' },
  leopoldshafen: { lat: 49.0768, lon: 8.3915, stateCode: 'DE-BW', countryCode: 'DE', name: 'Eggenstein-Leopoldshafen', city: 'Eggenstein-Leopoldshafen', postcode: '76334' },
  '76133': { lat: 49.0069, lon: 8.4037, stateCode: 'DE-BW', countryCode: 'DE', name: '76133 Karlsruhe', city: 'Karlsruhe', postcode: '76133' },
  '70173': { lat: 48.7758, lon: 9.1829, stateCode: 'DE-BW', countryCode: 'DE', name: '70173 Stuttgart', city: 'Stuttgart', postcode: '70173' },
  '80331': { lat: 48.1351, lon: 11.5820, stateCode: 'DE-BY', countryCode: 'DE', name: '80331 München', city: 'München', postcode: '80331' },
  '60311': { lat: 50.1109, lon: 8.6821, stateCode: 'DE-HE', countryCode: 'DE', name: '60311 Frankfurt am Main', city: 'Frankfurt am Main', postcode: '60311' },
  '50667': { lat: 50.9375, lon: 6.9603, stateCode: 'DE-NW', countryCode: 'DE', name: '50667 Köln', city: 'Köln', postcode: '50667' },
  '10115': { lat: 52.5200, lon: 13.4050, stateCode: 'DE-BE', countryCode: 'DE', name: '10115 Berlin', city: 'Berlin', postcode: '10115' },
  '20095': { lat: 53.5511, lon: 9.9937, stateCode: 'DE-HH', countryCode: 'DE', name: '20095 Hamburg', city: 'Hamburg', postcode: '20095' },
  '68159': { lat: 49.4875, lon: 8.4660, stateCode: 'DE-BW', countryCode: 'DE', name: '68159 Mannheim', city: 'Mannheim', postcode: '68159' },
  '69117': { lat: 49.3988, lon: 8.6724, stateCode: 'DE-BW', countryCode: 'DE', name: '69117 Heidelberg', city: 'Heidelberg', postcode: '69117' },
  '79098': { lat: 47.9990, lon: 7.8421, stateCode: 'DE-BW', countryCode: 'DE', name: '79098 Freiburg', city: 'Freiburg', postcode: '79098' },
  '76530': { lat: 48.7606, lon: 8.2398, stateCode: 'DE-BW', countryCode: 'DE', name: '76530 Baden-Baden', city: 'Baden-Baden', postcode: '76530' },
  '89073': { lat: 48.4011, lon: 9.9876, stateCode: 'DE-BW', countryCode: 'DE', name: '89073 Ulm', city: 'Ulm', postcode: '89073' },
  '90402': { lat: 49.4521, lon: 11.0767, stateCode: 'DE-BY', countryCode: 'DE', name: '90402 Nürnberg', city: 'Nürnberg', postcode: '90402' },
  '55116': { lat: 49.9929, lon: 8.2473, stateCode: 'DE-RP', countryCode: 'DE', name: '55116 Mainz', city: 'Mainz', postcode: '55116' },
  '65183': { lat: 50.0782, lon: 8.2398, stateCode: 'DE-HE', countryCode: 'DE', name: '65183 Wiesbaden', city: 'Wiesbaden', postcode: '65183' },
  '66111': { lat: 49.2402, lon: 6.9969, stateCode: 'DE-SL', countryCode: 'DE', name: '66111 Saarbrücken', city: 'Saarbrücken', postcode: '66111' },
  '40213': { lat: 51.2277, lon: 6.7735, stateCode: 'DE-NW', countryCode: 'DE', name: '40213 Düsseldorf', city: 'Düsseldorf', postcode: '40213' },
  '30159': { lat: 52.3759, lon: 9.7320, stateCode: 'DE-NI', countryCode: 'DE', name: '30159 Hannover', city: 'Hannover', postcode: '30159' },
  '28195': { lat: 53.0793, lon: 8.8017, stateCode: 'DE-HB', countryCode: 'DE', name: '28195 Bremen', city: 'Bremen', postcode: '28195' },
  '01067': { lat: 51.0504, lon: 13.7373, stateCode: 'DE-SN', countryCode: 'DE', name: '01067 Dresden', city: 'Dresden', postcode: '01067' },
  '04109': { lat: 51.3397, lon: 12.3731, stateCode: 'DE-SN', countryCode: 'DE', name: '04109 Leipzig', city: 'Leipzig', postcode: '04109' },
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
  const qClean = query.toLowerCase().replace(/[\s\-_]/g, '');

  // 1. Direct offline check: If exact match exists in OFFLINE_CITY_INDEX (e.g., postal code "76334" or "eggenstein"),
  // prioritize it immediately at the top of results
  if (OFFLINE_CITY_INDEX[qClean]) {
    const directCity = OFFLINE_CITY_INDEX[qClean];
    results.push({
      name: directCity.name,
      displayName: `${directCity.name}, ${directCity.stateCode}, ${directCity.countryCode}`,
      city: directCity.city || directCity.name,
      postcode: directCity.postcode,
      lat: directCity.lat,
      lon: directCity.lon,
      countryCode: directCity.countryCode,
      stateCode: directCity.stateCode,
      stateName: directCity.stateCode,
    });
  }

  // Try OpenStreetMap Nominatim with a fast timeout
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const isPostcode = /^\d{4,5}$/.test(query.trim());
    const countryParam = isPostcode ? '&countrycodes=de,at,ch,fr,it,es' : '';
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1${countryParam}`;
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

            const townOrCity =
              item.address?.village ||
              item.address?.town ||
              item.address?.city ||
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
    }
  } catch (err) {
    // Gracefully fall back to local index
  }

  // Fallback to offline index if Nominatim returned nothing or was unreachable
  if (results.length === 0) {
    const qLower = query.toLowerCase().replace(/\s+/g, '');
    for (const [key, city] of Object.entries(OFFLINE_CITY_INDEX)) {
      if (key.includes(qLower) || qLower.includes(key)) {
        results.push({
          name: city.name,
          displayName: `${city.name}, ${city.stateCode}, ${city.countryCode}`,
          city: city.city || city.name,
          postcode: city.postcode,
          lat: city.lat,
          lon: city.lon,
          countryCode: city.countryCode,
          stateCode: city.stateCode,
          stateName: city.stateCode,
        });
      }
    }
  }

  // Deduplicate results
  const uniqueResults: GeocodedLocation[] = [];
  const seenKeys = new Set<string>();
  for (const r of results) {
    const key = `${r.name.toLowerCase()}-${r.countryCode}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueResults.push(r);
    }
  }

  // Cache successful results for 7 days
  if (uniqueResults.length > 0) {
    await setCached(cacheKey, uniqueResults, 60 * 60 * 24 * 7);
  }

  return uniqueResults;
}

/**
 * Quick resolver to obtain coordinates from a location string
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

  // Check offline index directly
  const qLower = locationString.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');
  for (const [key, city] of Object.entries(OFFLINE_CITY_INDEX)) {
    if (qLower.includes(key) || key.includes(qLower)) {
      return {
        lat: city.lat,
        lon: city.lon,
        stateCode: city.stateCode,
        resolvedName: city.name,
      };
    }
  }

  return null;
}
