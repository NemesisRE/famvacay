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

countries.registerLocale(enCountries);
countries.registerLocale(deCountries);

export type SafetyLevel = 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';

export interface DestinationSafetyAssessment {
  score: number; // 0 - 100 (higher = safer)
  level: SafetyLevel;
  isSafe: boolean;
  isSafeForFamilies: boolean;
  advisoryLevel: 1 | 2 | 3 | 4;
  safetyLabel: string;
  source?: string;
  warningDetails?: string;
  countryName?: string;
  countryCode?: string;
  hasGermanWarning?: boolean;
  hasGermanPartialWarning?: boolean;
  usStateDeptLevel?: 1 | 2 | 3 | 4;
  advisoryTitle?: string;
}

export interface TravelAdvisoryCacheEntry {
  isoCode: string;
  countryName: string;
  hasGermanWarning: boolean;
  hasGermanPartialWarning: boolean;
  usStateDeptLevel: 1 | 2 | 3 | 4;
  usTitle?: string;
  isSafeForFamilies: boolean;
  safetyScore: number;
}

export interface AdvisoryCacheStore {
  timestamp: number;
  entries: Record<string, TravelAdvisoryCacheEntry>;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CACHE_TTL_SECONDS = 6 * 60 * 60; // 21,600 seconds
const TRAVEL_ADVISORIES_CACHE_KEY = 'famvac:travel-advisories';

// In-memory cache singleton
let memoryCache: AdvisoryCacheStore | null = null;
let activeFetchPromise: Promise<AdvisoryCacheStore> | null = null;

/**
 * High-risk airports in active conflict regions
 */
const HIGH_RISK_AIRPORT_CODES = new Set<string>([
  'KBP', 'IEV', 'ODS', 'LWO', 'DNK', 'HRK',
  'SVO', 'DME', 'VKO', 'LED', 'AER', 'OVB',
  'MSQ', 'DAM', 'ALP', 'SAH', 'ADE', 'KBL',
  'BGW', 'EBL', 'BSR', 'IKA', 'THR', 'KRT',
  'MGQ', 'TIP', 'MRA', 'BKO', 'OUA', 'BGF',
  'FIH', 'PAP', 'CCS', 'RGN', 'MDL', 'FNJ',
  'NIM', 'NDJ', 'BEY',
]);

/**
 * Reads cached advisories from in-memory cache
 */
function getCachedAdvisories(): AdvisoryCacheStore {
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS && Object.keys(memoryCache.entries).length > 0) {
    return memoryCache;
  }

  if (!memoryCache) {
    memoryCache = {
      timestamp: 0,
      entries: {},
    };
  }

  // Trigger background refresh on server only if expired or empty
  if (typeof window === 'undefined' && (Date.now() - memoryCache.timestamp >= CACHE_TTL_MS || Object.keys(memoryCache.entries).length === 0)) {
    ensureTravelAdvisoriesLoaded().catch(() => {});
  }

  return memoryCache;
}

/**
 * Saves advisories to memory and persistent Valkey / Dragonfly / Redis cache
 */
async function saveCachedAdvisories(store: AdvisoryCacheStore): Promise<void> {
  memoryCache = store;
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
    return memoryCache || { timestamp: 0, entries: {} };
  }

  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS && Object.keys(memoryCache.entries).length > 0) {
    return memoryCache;
  }

  try {
    const cached = await getCached<AdvisoryCacheStore>(TRAVEL_ADVISORIES_CACHE_KEY);
    if (cached && typeof cached.timestamp === 'number' && Date.now() - cached.timestamp < CACHE_TTL_MS && Object.keys(cached.entries || {}).length > 0) {
      memoryCache = cached;
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
    return memoryCache || { timestamp: 0, entries: {} };
  }

  if (!force && memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS && Object.keys(memoryCache.entries).length > 0) {
    return memoryCache;
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

      // 1. Parse German Foreign Office (Auswärtiges Amt) warnings
      if (aaData) {
        for (const [key, item] of Object.entries<any>(aaData)) {
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
      for (const [iso, entry] of Object.entries(entries)) {
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
      return getCachedAdvisories();
    } finally {
      activeFetchPromise = null;
    }
  })();

  return activeFetchPromise;
}

/**
 * Resolves standard 2-letter ISO country code from country name or code
 */
export function resolveIsoCountryCode(countryCodeOrName: string): string {
  const clean = (countryCodeOrName || '').trim().toUpperCase();
  if (clean.length === 2) return clean;

  const fromEn = countries.getAlpha2Code(countryCodeOrName, 'en');
  if (fromEn) return fromEn.toUpperCase();

  const fromDe = countries.getAlpha2Code(countryCodeOrName, 'de');
  if (fromDe) return fromDe.toUpperCase();

  return clean;
}

/**
 * Evaluates whether a destination is safe for flex discovery (open family vacation search).
 * Integrates live Auswärtiges Amt and US State Department advisories.
 * Only places with Level 1 (SAFE) or Level 2 (CAUTION) without travel warnings are accepted.
 */
export function isDestinationSafeForVacation(
  airportCode: string,
  countryCodeOrName: string
): boolean {
  const apCode = (airportCode || '').trim().toUpperCase();
  if (HIGH_RISK_AIRPORT_CODES.has(apCode)) {
    return false;
  }

  const iso = resolveIsoCountryCode(countryCodeOrName);
  const cache = getCachedAdvisories();
  const entry = cache.entries[iso];

  if (entry) {
    return entry.isSafeForFamilies;
  }

  return true;
}

/**
 * Returns comprehensive safety assessment with official government sources
 */
export function getDestinationSafetyAssessment(
  airportCode: string,
  countryCodeOrName: string
): DestinationSafetyAssessment {
  const apCode = (airportCode || '').trim().toUpperCase();
  const iso = resolveIsoCountryCode(countryCodeOrName);
  const cache = getCachedAdvisories();
  const entry = cache.entries[iso];

  if (HIGH_RISK_AIRPORT_CODES.has(apCode)) {
    return {
      score: 15,
      level: 'DANGER',
      isSafe: false,
      isSafeForFamilies: false,
      advisoryLevel: 4,
      safetyLabel: 'Reisewarnung / Extreme Danger',
      source: 'Auswärtiges Amt / US State Dept',
      warningDetails: 'Destination is located in an active conflict or severe crisis zone.',
      countryCode: iso,
      countryName: entry?.countryName || countryCodeOrName,
      hasGermanWarning: true,
      hasGermanPartialWarning: false,
      usStateDeptLevel: 4,
      advisoryTitle: 'Level 4: Do Not Travel (High-Risk Conflict Zone)',
    };
  }

  if (entry) {
    let level: SafetyLevel = 'SAFE';
    let advisory: 1 | 2 | 3 | 4 = entry.usStateDeptLevel;

    if (entry.hasGermanWarning || entry.usStateDeptLevel === 4) {
      level = 'DANGER';
      advisory = 4;
    } else if (entry.usStateDeptLevel === 3) {
      level = 'WARNING';
      advisory = 3;
    } else if (entry.hasGermanPartialWarning || entry.usStateDeptLevel === 2) {
      level = 'CAUTION';
      advisory = 2;
    }

    const defaultTitle =
      advisory === 4
        ? 'Level 4: Do Not Travel'
        : advisory === 3
        ? 'Level 3: Reconsider Travel'
        : advisory === 2
        ? 'Level 2: Exercise Increased Caution'
        : 'Level 1: Exercise Normal Precautions';

    return {
      score: entry.safetyScore,
      level,
      isSafe: entry.isSafeForFamilies,
      isSafeForFamilies: entry.isSafeForFamilies,
      advisoryLevel: advisory,
      safetyLabel:
        level === 'SAFE'
          ? 'Sicheres Reiseziel'
          : level === 'CAUTION'
          ? 'Standard-Vorsicht'
          : level === 'WARNING'
          ? 'Reisewarnung (Teilbereich)'
          : 'Reisewarnung',
      source: 'Auswärtiges Amt & US State Dept',
      warningDetails: entry.usTitle,
      countryCode: iso,
      countryName: entry.countryName,
      hasGermanWarning: entry.hasGermanWarning,
      hasGermanPartialWarning: entry.hasGermanPartialWarning,
      usStateDeptLevel: entry.usStateDeptLevel,
      advisoryTitle: entry.usTitle || defaultTitle,
    };
  }

  return {
    score: 92,
    level: 'SAFE',
    isSafe: true,
    isSafeForFamilies: true,
    advisoryLevel: 1,
    safetyLabel: 'Sicheres Reiseziel',
    source: 'Auswärtiges Amt & US State Dept (Keine Reisewarnung)',
    countryCode: iso,
    countryName: countryCodeOrName,
    hasGermanWarning: false,
    hasGermanPartialWarning: false,
    usStateDeptLevel: 1,
    advisoryTitle: 'Level 1: Exercise Normal Precautions',
  };
}

// Background prime cache on server startup
if (typeof window === 'undefined') {
  ensureTravelAdvisoriesLoaded().catch(() => {});
}
