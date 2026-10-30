import iso3166 from 'iso-3166-2';

/**
 * Photon (https://photon.komoot.io, or a self-hosted instance via PHOTON_API_URL): the geocoder for
 * everything typed letter by letter. The public Nominatim server forbids autocomplete in its usage
 * policy, so it is only used for one-off lookups (reverse geocoding on a click), see ADR 0003.
 */

export const GEOCODER_USER_AGENT = 'FamVacay/1.0 (self-hosted family vacation optimizer)';

/** Languages the public Photon server has names for; anything else gets the local names */
const PHOTON_LANGUAGES = new Set(['en', 'de', 'fr']);

/** 'default' asks for the local names explicitly */
export function photonLanguage(locale: string): string {
  if (locale === 'default') return 'default';
  const lang = (locale || 'en').slice(0, 2).toLowerCase();
  return PHOTON_LANGUAGES.has(lang) ? lang : 'default';
}

export interface PhotonProperties {
  osm_id?: number;
  osm_key?: string;
  osm_value?: string;
  type?: string;
  name?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  district?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
}

export interface PhotonFeature {
  lat: number;
  lon: number;
  properties: PhotonProperties;
}

function photonBaseUrl(): string {
  return (process.env.PHOTON_API_URL || 'https://photon.komoot.io/api').replace(/\/+$/, '');
}

/**
 * Forward search; [] on any error or timeout (callers treat that as "no suggestions"). `bias`
 * prefers results near a point at country scale (zoom 5): a bare postcode like 76131 then finds
 * Karlsruhe rather than Vietnam, while prominent places elsewhere (Paris) still come first.
 */
export async function photonSearch(
  query: string,
  {
    locale = 'en',
    limit = 5,
    timeoutMs = 3500,
    bias,
  }: { locale?: string; limit?: number; timeoutMs?: number; bias?: { lat: number; lon: number } | null } = {}
): Promise<PhotonFeature[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit), lang: photonLanguage(locale) });
  if (bias) {
    params.set('lat', bias.lat.toFixed(2));
    params.set('lon', bias.lon.toFixed(2));
    params.set('zoom', '5');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${photonBaseUrl()}?${params}`, {
      signal: controller.signal,
      headers: { 'User-Agent': GEOCODER_USER_AGENT },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.features)) return [];
    const features: PhotonFeature[] = [];
    for (const f of data.features) {
      const [lon, lat] = Array.isArray(f?.geometry?.coordinates) ? f.geometry.coordinates : [];
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      features.push({ lat, lon, properties: f.properties || {} });
    }
    return features;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * ISO 3166-2 code for a subdivision name (Photon has names only): "Bayern" -> DE-BY. Matches the
 * local names of the ISO data, so localized exonyms ("Bavaria") stay unresolved - better no code
 * than a wrong one.
 */
export function resolveSubdivisionCode(countryCode: string | undefined, stateName: string | undefined): string | undefined {
  if (!countryCode || !stateName) return undefined;
  const country = iso3166.country(countryCode.toUpperCase());
  if (!country?.sub) return undefined;
  const wanted = normalize(stateName);
  for (const [code, sub] of Object.entries(country.sub)) {
    if (normalize(sub.name) === wanted) return code;
  }
  return undefined;
}
