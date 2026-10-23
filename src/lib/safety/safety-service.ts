/**
 * Travel Safety & Security Assessment Service
 * Dynamically ingests official government travel warnings from:
 * 1. Auswärtiges Amt Open Data API: https://www.auswaertiges-amt.de/opendata/travelwarning
 * 2. US Department of State Travel Advisories API: https://cadataapi.state.gov/api/TravelAdvisories
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

/**
 * Fetches US Department of State Travel Advisories using official JSON or XML/RSS feeds
 */
async function fetchUSStateDeptAdvisories(): Promise<Array<{ Title: string }>> {
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
      const items: Array<{ Title: string }> = [];
      const titleMatches = xml.matchAll(/<title>([^<]+)<\/title>/g);
      for (const match of titleMatches) {
        const title = match[1].trim();
        if (title && /Level\s*[1-4]/i.test(title)) {
          items.push({ Title: title });
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
      const [aaData, usData] = await Promise.all([
        fetchAuswaertigesAmtWarnings(),
        fetchUSStateDeptAdvisories(),
      ]);

      const entries: Record<string, TravelAdvisoryCacheEntry> = {};
      if (!aaData && (!Array.isArray(usData) || usData.length === 0)) {
        // Both providers unreachable: keep whatever we have (stale live data or the offline
        // full-warning snapshot) instead of caching an empty "everything is safe" store.
        return getAdvisoryStore();
      }

      // 1. Parse German Foreign Office (Auswärtiges Amt) warnings
      if (aaData) {
        for (const item of Object.values<any>(aaData)) {
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
          let iso = countries.getAlpha2Code(rawCountryName, 'en') || countries.getAlpha2Code(rawCountryName, 'de');

          // Fallback aliases for State Dept naming
          if (!iso) {
            const lower = rawCountryName.toLowerCase();
            if (lower.includes('bahamas')) iso = 'BS';
            else if (lower.includes('burma') || lower.includes('myanmar')) iso = 'MM';
            else if (lower.includes('russia')) iso = 'RU';
            else if (lower.includes('korea, north') || lower.includes('north korea')) iso = 'KP';
            else if (lower.includes('korea, south') || lower.includes('south korea')) iso = 'KR';
            else if (lower.includes('congo, democratic')) iso = 'CD';
            else if (lower.includes('congo, republic')) iso = 'CG';
            else if (lower.includes('vatican')) iso = 'VA';
          }

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
            entries[upperIso] = existing;
          }
        }
      }

      // 3. Compute unified safety score and safe place rating
      for (const entry of Object.values(entries)) {
        if (entry.hasGermanWarning || entry.usStateDeptLevel === 4) {
          entry.isSafeForFamilies = false;
          entry.safetyScore = 20;
        } else if (entry.usStateDeptLevel === 3) {
          entry.isSafeForFamilies = false;
          entry.safetyScore = 45;
        } else if (entry.hasGermanPartialWarning || entry.usStateDeptLevel === 2) {
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
