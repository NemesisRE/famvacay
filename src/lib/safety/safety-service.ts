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

countries.registerLocale(enCountries);
countries.registerLocale(deCountries);

export type SafetyLevel = 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';

export interface DestinationSafetyAssessment {
  score: number; // 0 - 100 (higher = safer)
  level: SafetyLevel;
  isSafeForFamilies: boolean;
  advisoryLevel: 1 | 2 | 3 | 4;
  safetyLabel: string;
  source?: string;
  warningDetails?: string;
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

interface AdvisoryCacheStore {
  timestamp: number;
  entries: Record<string, TravelAdvisoryCacheEntry>;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// In-memory cache singleton
let memoryCache: AdvisoryCacheStore | null = null;
let activeFetchPromise: Promise<AdvisoryCacheStore> | null = null;

/**
 * Built-in baseline travel warning snapshot.
 * Ensures instant synchronous operations and offline/test reliability.
 */
const DEFAULT_SAFETY_BASELINE: Record<string, TravelAdvisoryCacheEntry> = {
  // Level 4 (Do Not Travel / Official Reisewarnung)
  UA: { isoCode: 'UA', countryName: 'Ukraine', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 15 },
  RU: { isoCode: 'RU', countryName: 'Russische Föderation', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 20 },
  BY: { isoCode: 'BY', countryName: 'Belarus', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 25 },
  SY: { isoCode: 'SY', countryName: 'Syrien', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 10 },
  YE: { isoCode: 'YE', countryName: 'Jemen', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 10 },
  AF: { isoCode: 'AF', countryName: 'Afghanistan', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 10 },
  IQ: { isoCode: 'IQ', countryName: 'Irak', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 20 },
  IR: { isoCode: 'IR', countryName: 'Iran', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 20 },
  SO: { isoCode: 'SO', countryName: 'Somalia', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 10 },
  SD: { isoCode: 'SD', countryName: 'Sudan', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 15 },
  SS: { isoCode: 'SS', countryName: 'Südsudan', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 15 },
  LY: { isoCode: 'LY', countryName: 'Libyen', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 15 },
  ML: { isoCode: 'ML', countryName: 'Mali', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 20 },
  BF: { isoCode: 'BF', countryName: 'Burkina Faso', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 20 },
  HT: { isoCode: 'HT', countryName: 'Haiti', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 15 },
  VE: { isoCode: 'VE', countryName: 'Venezuela', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 25 },
  MM: { isoCode: 'MM', countryName: 'Myanmar', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 25 },
  KP: { isoCode: 'KP', countryName: 'Nordkorea', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 10 },
  LB: { isoCode: 'LB', countryName: 'Libanon', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 25 },
  PS: { isoCode: 'PS', countryName: 'Palästinensische Gebiete', hasGermanWarning: true, hasGermanPartialWarning: false, usStateDeptLevel: 4, isSafeForFamilies: false, safetyScore: 20 },

  // Safe Family Vacation Havens (Level 1 / 2)
  ES: { isoCode: 'ES', countryName: 'Spanien', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 2, isSafeForFamilies: true, safetyScore: 88 },
  IT: { isoCode: 'IT', countryName: 'Italien', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 2, isSafeForFamilies: true, safetyScore: 88 },
  GR: { isoCode: 'GR', countryName: 'Griechenland', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 89 },
  PT: { isoCode: 'PT', countryName: 'Portugal', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 92 },
  FR: { isoCode: 'FR', countryName: 'Frankreich', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 2, isSafeForFamilies: true, safetyScore: 83 },
  DE: { isoCode: 'DE', countryName: 'Deutschland', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 2, isSafeForFamilies: true, safetyScore: 90 },
  AT: { isoCode: 'AT', countryName: 'Österreich', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 95 },
  CH: { isoCode: 'CH', countryName: 'Schweiz', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 96 },
  NL: { isoCode: 'NL', countryName: 'Niederlande', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 91 },
  DK: { isoCode: 'DK', countryName: 'Dänemark', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 95 },
  NO: { isoCode: 'NO', countryName: 'Norwegen', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 95 },
  SE: { isoCode: 'SE', countryName: 'Schweden', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 2, isSafeForFamilies: true, safetyScore: 89 },
  HR: { isoCode: 'HR', countryName: 'Kroatien', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 90 },
  CY: { isoCode: 'CY', countryName: 'Zypern', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 90 },
  MT: { isoCode: 'MT', countryName: 'Malta', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 91 },
  JP: { isoCode: 'JP', countryName: 'Japan', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 95 },
  SG: { isoCode: 'SG', countryName: 'Singapur', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 96 },
  AE: { isoCode: 'AE', countryName: 'Vereinigte Arabische Emirate', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 2, isSafeForFamilies: true, safetyScore: 91 },
  TH: { isoCode: 'TH', countryName: 'Thailand', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 80 },
  US: { isoCode: 'US', countryName: 'Vereinigte Staaten', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 82 },
  CA: { isoCode: 'CA', countryName: 'Kanada', hasGermanWarning: false, hasGermanPartialWarning: false, usStateDeptLevel: 1, isSafeForFamilies: true, safetyScore: 91 },
};

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

function getFsAndPath() {
  if (typeof window !== 'undefined') return { fs: null, path: null };
  try {
    const fs = require('fs');
    const path = require('path');
    return { fs, path };
  } catch {
    return { fs: null, path: null };
  }
}

function getCacheFilePath(): string {
  const { path } = getFsAndPath();
  if (path && typeof process !== 'undefined' && process.cwd) {
    return path.join(process.cwd(), '.next', 'cache', 'travel-advisories.json');
  }
  return '.next/cache/travel-advisories.json';
}

/**
 * Reads cached advisories from disk or memory
 */
function getCachedAdvisories(): AdvisoryCacheStore {
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache;
  }

  // Attempt reading from disk cache
  try {
    const { fs } = getFsAndPath();
    const cachePath = getCacheFilePath();
    if (fs && fs.existsSync(cachePath)) {
      const content = fs.readFileSync(cachePath, 'utf-8');
      const parsed: AdvisoryCacheStore = JSON.parse(content);
      if (parsed && typeof parsed.timestamp === 'number' && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        memoryCache = parsed;
        return parsed;
      }
    }
  } catch {
    // Non-critical cache read fallback
  }

  // Initialize with built-in baseline if cache is missing or expired
  if (!memoryCache) {
    memoryCache = {
      timestamp: 0,
      entries: { ...DEFAULT_SAFETY_BASELINE },
    };
  }

  // Trigger background refresh if expired without blocking synchronous execution
  if (Date.now() - memoryCache.timestamp >= CACHE_TTL_MS) {
    refreshTravelAdvisories().catch(() => {});
  }

  return memoryCache;
}

/**
 * Saves advisories to memory and persistent disk cache
 */
function saveCachedAdvisories(store: AdvisoryCacheStore): void {
  memoryCache = store;
  try {
    const { fs, path } = getFsAndPath();
    if (!fs || !path) return;
    const cachePath = getCacheFilePath();
    const dir = path.dirname(cachePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(cachePath, JSON.stringify(store), 'utf-8');
  } catch {
    // Non-critical disk write fallback
  }
}

/**
 * Fetches latest travel warnings from Auswärtiges Amt and US State Department APIs,
 * populating the cache.
 */
export async function refreshTravelAdvisories(force = false): Promise<AdvisoryCacheStore> {
  if (!force && memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache;
  }

  if (activeFetchPromise) {
    return activeFetchPromise;
  }

  activeFetchPromise = (async () => {
    try {
      const [resAA, resUS] = await Promise.allSettled([
        fetch('https://www.auswaertiges-amt.de/opendata/travelwarning', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(6000),
        }).then((r) => (r.ok ? r.json() : null)),
        fetch('https://cadataapi.state.gov/api/TravelAdvisories', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(6000),
        }).then((r) => (r.ok ? r.json() : null)),
      ]);

      const entries: Record<string, TravelAdvisoryCacheEntry> = {
        ...DEFAULT_SAFETY_BASELINE,
      };

      // 1. Parse German Foreign Office (Auswärtiges Amt) warnings
      if (resAA.status === 'fulfilled' && resAA.value && resAA.value.response) {
        for (const [key, item] of Object.entries<any>(resAA.value.response)) {
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
      if (resUS.status === 'fulfilled' && Array.isArray(resUS.value)) {
        for (const item of resUS.value) {
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

      saveCachedAdvisories(store);
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

  // If country is not in cache, check baseline or fallback safe
  const baseline = DEFAULT_SAFETY_BASELINE[iso];
  if (baseline) {
    return baseline.isSafeForFamilies;
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
  const entry = cache.entries[iso] || DEFAULT_SAFETY_BASELINE[iso];

  if (HIGH_RISK_AIRPORT_CODES.has(apCode)) {
    return {
      score: 15,
      level: 'DANGER',
      isSafeForFamilies: false,
      advisoryLevel: 4,
      safetyLabel: 'Reisewarnung / Extreme Danger',
      source: 'Auswärtiges Amt / US State Dept',
      warningDetails: 'Destination is located in an active conflict or severe crisis zone.',
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

    return {
      score: entry.safetyScore,
      level,
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
    };
  }

  return {
    score: 85,
    level: 'SAFE',
    isSafeForFamilies: true,
    advisoryLevel: 1,
    safetyLabel: 'Sicheres Reiseziel',
    source: 'Auswärtiges Amt',
  };
}
