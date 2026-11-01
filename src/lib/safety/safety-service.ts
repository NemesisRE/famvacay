/**
 * Travel Safety & Security Assessment Service
 * Dynamically ingests official government travel warnings from:
 * 1. Auswärtiges Amt Open Data API: https://www.auswaertiges-amt.de/opendata/travelwarning
 * 2. US Department of State Travel Advisories API: https://cadataapi.state.gov/api/TravelAdvisories
 * 3. Global Affairs Canada open data: https://data.international.gc.ca/travel-voyage/index-alpha-eng.json
 * 4. Australian Smartraveller export: https://www.smartraveller.gov.au/destinations-export
 * Canada and Australia are optional extras: if they are unreachable the other sources still work.
 *
 * Features an intelligent cache with 6-hour TTL to prevent redundant requests and rate limits.
 */

import countries from 'i18n-iso-countries';
import enCountries from 'i18n-iso-countries/langs/en.json';
import deCountries from 'i18n-iso-countries/langs/de.json';
import { getCached, setCached } from '@/lib/cache/redis';
import {
  setAdvisoryStore,
  registerAdvisoryRefresh,
  getAdvisoryStore,
  hasLiveAdvisories,
  peakAdvisoryLevel,
  type AdvisoryCacheStore,
  type TravelAdvisoryCacheEntry,
} from './advisory-store';

// Evaluation lives in the dependency-free advisory store (importable from client bundles and
// statically from the optimizer); re-exported here for existing callers.
export {
  resolveIsoCountryCode,
  isDestinationSafeForVacation,
  isDestinationBanned,
  getDestinationSafetyAssessment,
  HIGH_RISK_AIRPORT_CODES,
} from './advisory-store';
export type {
  SafetyLevel,
  DestinationSafetyAssessment,
  TravelAdvisoryCacheEntry,
  AdvisoryCacheStore,
} from './advisory-store';

countries.registerLocale(enCountries);
countries.registerLocale(deCountries);

const CACHE_TTL_SECONDS = 6 * 60 * 60; // 21,600 seconds
const TRAVEL_ADVISORIES_CACHE_KEY = 'famvac:travel-advisories';

let activeFetchPromise: Promise<AdvisoryCacheStore> | null = null;

/**
 * Saves advisories to the shared advisory store and persistent Valkey / Dragonfly / Redis cache
 */
async function saveCachedAdvisories(store: AdvisoryCacheStore): Promise<void> {
  setAdvisoryStore(store);
  try {
    await setCached(TRAVEL_ADVISORIES_CACHE_KEY, store, CACHE_TTL_SECONDS);
  } catch (err) {
    console.warn('[SafetyService] Failed to cache advisories in cache engine:', err);
  }
}

/**
 * Ensures travel advisories are loaded into memory, checking the cache engine first.
 */
export async function ensureTravelAdvisoriesLoaded(): Promise<AdvisoryCacheStore> {
  if (typeof window !== 'undefined') {
    return getAdvisoryStore();
  }

  if (hasLiveAdvisories()) {
    return getAdvisoryStore();
  }

  try {
    const cached = await getCached<AdvisoryCacheStore>(TRAVEL_ADVISORIES_CACHE_KEY);
    if (cached && typeof cached.timestamp === 'number' && hasLiveAdvisories(cached)) {
      setAdvisoryStore(cached);
      return cached;
    }
  } catch {
    // Non-critical cache read fallback
  }

  return refreshTravelAdvisories();
}

/**
 * Fetches German Foreign Office (Auswärtiges Amt) Open Data travel warnings
 */
async function fetchAuswaertigesAmtWarnings(): Promise<Record<string, any> | null> {
  try {
    const res = await fetch('https://www.auswaertiges-amt.de/opendata/travelwarning', {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FamVacay/1.0',
      },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const data = await res.json();
      return data?.response || null;
    }
  } catch (err) {
    console.warn('[SafetyService] Auswärtiges Amt API request failed:', err);
  }
  return null;
}

/** Country name from a government feed to ISO alpha-2, including the feeds' own spellings */
function isoFromCountryName(rawName: string): string | undefined {
  const name = rawName.trim();
  const found = countries.getAlpha2Code(name, 'en') || countries.getAlpha2Code(name, 'de');
  if (found) return found;
  const lower = name.toLowerCase();
  if (lower.includes('bahamas')) return 'BS';
  if (lower.includes('burma') || lower.includes('myanmar')) return 'MM';
  if (lower.includes('russia')) return 'RU';
  if (lower.includes('korea, north') || lower.includes('north korea')) return 'KP';
  if (lower.includes('korea, south') || lower.includes('south korea')) return 'KR';
  if (lower.includes('congo, democratic') || lower.includes('democratic republic of the congo')) return 'CD';
  if (lower.includes('congo, republic') || lower.includes('republic of the congo')) return 'CG';
  if (lower.includes('vatican')) return 'VA';
  if (lower.includes('türkiye') || lower.includes('turkiye')) return 'TR';
  if (lower.includes('czech')) return 'CZ';
  if (lower.includes('timor')) return 'TL';
  if (lower.includes('eswatini') || lower.includes('swaziland')) return 'SZ';
  if (lower.includes('ivoire')) return 'CI';
  return undefined;
}

export interface ExtraAdvisory {
  iso: string;
  level: 1 | 2 | 3 | 4;
  title: string;
  url?: string;
}

/** Global Affairs Canada: advisory-state 0 (normal) to 3 (avoid all travel) */
export function parseCanadaAdvisories(json: unknown): ExtraAdvisory[] {
  const data = (json as { data?: Record<string, any> } | null)?.data;
  if (!data || typeof data !== 'object') return [];
  const out: ExtraAdvisory[] = [];
  for (const [key, item] of Object.entries(data)) {
    // Regions use keys such as "PT-20" (Azores): never let one rate the whole country
    if (!/^[A-Z]{2}$/.test(key)) continue;
    const iso = typeof item?.['country-iso'] === 'string' ? item['country-iso'].toUpperCase() : '';
    const state = item?.['advisory-state'];
    if (iso !== key || !Number.isInteger(state) || state < 0 || state > 3) continue;
    const slug = item?.eng?.['url-slug'];
    out.push({
      iso,
      level: (state + 1) as 1 | 2 | 3 | 4,
      title: String(item?.eng?.['advisory-text'] || ''),
      url: typeof slug === 'string' && /^[a-z0-9-]+$/.test(slug) ? `https://travel.gc.ca/destinations/${slug}` : undefined,
    });
  }
  return out;
}

const AU_LEVELS: Array<[RegExp, 1 | 2 | 3 | 4]> = [
  [/do not travel/i, 4],
  [/reconsider/i, 3],
  [/high degree of caution/i, 2],
  [/normal safety precautions/i, 1],
];

/** Smartraveller: overall advice level per destination (a destination name, not always a country) */
export function parseSmartravellerAdvisories(json: unknown): ExtraAdvisory[] {
  if (!Array.isArray(json)) return [];
  const out: ExtraAdvisory[] = [];
  for (const item of json) {
    const title = typeof item?.title === 'string' ? item.title : '';
    const text = typeof item?.field_overall_advice_level === 'string' ? item.field_overall_advice_level : '';
    const level = AU_LEVELS.find(([re]) => re.test(text))?.[1];
    const iso = title ? isoFromCountryName(title) : undefined;
    if (!level || !iso) continue;
    const url = typeof item.field_url === 'string' ? item.field_url : '';
    out.push({
      iso: iso.toUpperCase(),
      level,
      title: text,
      url: url.startsWith('https://www.smartraveller.gov.au/') ? url : undefined,
    });
  }
  return out;
}

async function fetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FamVacay/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return JSON.parse(await res.text());
  } catch (err) {
    console.warn(`[SafetyService] Advisory request to ${new URL(url).host} failed:`, err);
  }
  return null;
}

/**
 * Fetches US Department of State Travel Advisories using official JSON or XML/RSS feeds
 */
async function fetchUSStateDeptAdvisories(): Promise<Array<{ Title: string; Link?: string }>> {
  // 1. Try official JSON API
  try {
    const res = await fetch('https://cadataapi.state.gov/api/TravelAdvisories', {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FamVacay/1.0',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const text = await res.text();
      if (!text.trim().startsWith('<')) {
        const json = JSON.parse(text);
        if (Array.isArray(json) && json.length > 0) return json;
      }
    }
  } catch {
    // Proceed to robust RSS fallback
  }

  // 2. Official RSS feed fallback from travel.state.gov (immune to Cloudflare bot challenge)
  try {
    const res = await fetch('https://travel.state.gov/_res/rss/TAsTWs.xml', {
      headers: {
        Accept: 'application/xml, text/xml, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FamVacay/1.0',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const xml = await res.text();
      const items: Array<{ Title: string; Link?: string }> = [];
      for (const [, body] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const title = body.match(/<title>([^<]+)<\/title>/)?.[1].trim();
        if (title && /Level\s*[1-4]/i.test(title)) {
          items.push({ Title: title, Link: body.match(/<link>([^<]+)<\/link>/)?.[1].trim() });
        }
      }
      if (items.length > 0) return items;
    }
  } catch (err) {
    console.warn('[SafetyService] US State Dept advisory fetch failed:', err);
  }

  return [];
}

/**
 * Fetches latest travel warnings from Auswärtiges Amt and US State Department APIs,
 * populating the cache.
 */
export async function refreshTravelAdvisories(force = false): Promise<AdvisoryCacheStore> {
  if (typeof window !== 'undefined') {
    return getAdvisoryStore();
  }

  if (!force && hasLiveAdvisories()) {
    return getAdvisoryStore();
  }

  if (activeFetchPromise) {
    return activeFetchPromise;
  }

  activeFetchPromise = (async () => {
    try {
      const [aaData, usData, caData, auData] = await Promise.all([
        fetchAuswaertigesAmtWarnings(),
        fetchUSStateDeptAdvisories(),
        fetchJson('https://data.international.gc.ca/travel-voyage/index-alpha-eng.json').then(parseCanadaAdvisories),
        fetchJson('https://www.smartraveller.gov.au/destinations-export').then(parseSmartravellerAdvisories),
      ]);

      const entries: Record<string, TravelAdvisoryCacheEntry> = {};
      if (!aaData && (!Array.isArray(usData) || usData.length === 0)) {
        // Both providers unreachable: keep whatever we have (stale live data or the offline
        // full-warning snapshot) instead of caching an empty "everything is safe" store.
        return getAdvisoryStore();
      }

      // 1. Parse German Foreign Office (Auswärtiges Amt) warnings
      if (aaData) {
        for (const [contentId, item] of Object.entries<any>(aaData)) {
          if (!item || !item.countryCode) continue;
          const iso = item.countryCode.toUpperCase();
          const hasWarning = Boolean(item.warning);
          const hasPartial = Boolean(item.partialWarning || item.situationWarning || item.situationPartWarning);

          const existing = entries[iso] || {
            isoCode: iso,
            countryName: item.countryName || iso,
            hasGermanWarning: false,
            hasGermanPartialWarning: false,
            usStateDeptLevel: 1,
            isSafeForFamilies: true,
            safetyScore: 85,
          };

          existing.hasGermanWarning = hasWarning;
          existing.hasGermanPartialWarning = hasPartial;
          if (item.countryName) existing.countryName = item.countryName;
          // The open-data key is the content id of the country's travel and safety advice page
          if (/^\d+$/.test(contentId)) existing.germanContentId = contentId;

          entries[iso] = existing;
        }
      }

      // 2. Parse US Department of State Travel Advisories
      if (Array.isArray(usData) && usData.length > 0) {
        for (const item of usData) {
          if (!item || !item.Title) continue;
          const title = item.Title as string;

          // Extract advisory Level: 1 to 4
          let level: 1 | 2 | 3 | 4 = 1;
          const levelMatch = title.match(/Level\s*([1-4])/i);
          if (levelMatch) {
            level = parseInt(levelMatch[1], 10) as any;
          }

          // Extract country name from title prefix
          const rawCountryName = title.split(/\s*[-–]\s*Level/i)[0].trim();
          const iso = isoFromCountryName(rawCountryName);

          if (iso) {
            const upperIso = iso.toUpperCase();
            const existing = entries[upperIso] || {
              isoCode: upperIso,
              countryName: rawCountryName,
              hasGermanWarning: false,
              hasGermanPartialWarning: false,
              usStateDeptLevel: 1,
              isSafeForFamilies: true,
              safetyScore: 85,
            };

            existing.usStateDeptLevel = level;
            existing.usTitle = title;
            if (typeof item.Link === 'string' && item.Link.startsWith('https://travel.state.gov/')) {
              existing.usUrl = item.Link;
            }
            entries[upperIso] = existing;
          }
        }
      }

      // 3. Canada and Australia (they only add to countries the main sources already know, or
      // create an entry of their own when the others do not list the country)
      const addExtra = (list: ExtraAdvisory[], key: 'ca' | 'au') => {
        for (const item of list) {
          const entry = entries[item.iso] || {
            isoCode: item.iso,
            countryName: countries.getName(item.iso, 'en') || item.iso,
            hasGermanWarning: false,
            hasGermanPartialWarning: false,
            usStateDeptLevel: 1 as const,
            isSafeForFamilies: true,
            safetyScore: 85,
          };
          entry[`${key}Level`] = item.level;
          entry[`${key}Title`] = item.title;
          if (item.url) entry[`${key}Url`] = item.url;
          entries[item.iso] = entry;
        }
      };
      addExtra(caData, 'ca');
      addExtra(auData, 'au');

      // 4. Compute unified safety score and safe place rating
      for (const entry of Object.values(entries)) {
        const peak = peakAdvisoryLevel(entry);
        if (entry.hasGermanWarning || entry.usStateDeptLevel === 4) {
          entry.isSafeForFamilies = false;
          entry.safetyScore = 20;
        } else if (peak === 3) {
          entry.isSafeForFamilies = false;
          entry.safetyScore = 45;
        } else if (entry.hasGermanPartialWarning || peak === 2) {
          entry.isSafeForFamilies = true;
          entry.safetyScore = 75;
        } else {
          entry.isSafeForFamilies = true;
          entry.safetyScore = 92;
        }
      }

      const store: AdvisoryCacheStore = {
        timestamp: Date.now(),
        entries,
      };

      await saveCachedAdvisories(store);
      return store;
    } catch (err) {
      console.warn('[SafetyService] Failed to fetch live travel advisories, using cached fallback:', err);
      return getAdvisoryStore();
    } finally {
      activeFetchPromise = null;
    }
  })();

  return activeFetchPromise;
}

// Stale or missing data read by the store triggers a background refresh on the server
registerAdvisoryRefresh(() => {
  ensureTravelAdvisoriesLoaded().catch(() => {});
});

// Background prime cache on server startup
if (typeof window === 'undefined') {
  ensureTravelAdvisoriesLoaded().catch(() => {});
}
