/**
 * Travel advisory store & evaluation - pure, dependency-free (no Redis, no fetch), so it can be
 * imported statically from both server code (optimizer engine, discovery) and client bundles.
 * Live data is fetched and pushed in by safety-service.ts.
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
  /** Active conflict / crisis zone (high-risk airport list) */
  conflictZone?: boolean;
  /** Official sources: the country page when known, otherwise the provider's overview */
  germanAdvisoryUrl?: string;
  usAdvisoryUrl?: string;
}

export interface TravelAdvisoryCacheEntry {
  isoCode: string;
  countryName: string;
  hasGermanWarning: boolean;
  hasGermanPartialWarning: boolean;
  /** Auswärtiges Amt open-data key = content id of the country's travel and safety advice page */
  germanContentId?: string;
  usStateDeptLevel: 1 | 2 | 3 | 4;
  usTitle?: string;
  /** Country advisory page from the State Department feed */
  usUrl?: string;
  isSafeForFamilies: boolean;
  safetyScore: number;
}

export interface AdvisoryCacheStore {
  timestamp: number;
  entries: Record<string, TravelAdvisoryCacheEntry>;
}

export const ADVISORY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * High-risk airports in active conflict regions
 */
export const HIGH_RISK_AIRPORT_CODES = new Set<string>([
  'KBP', 'IEV', 'ODS', 'LWO', 'DNK', 'HRK',
  'SVO', 'DME', 'VKO', 'LED', 'AER', 'OVB',
  'MSQ', 'DAM', 'ALP', 'SAH', 'ADE', 'KBL',
  'BGW', 'EBL', 'BSR', 'IKA', 'THR', 'KRT',
  'MGQ', 'TIP', 'MRA', 'BKO', 'OUA', 'BGF',
  'FIH', 'PAP', 'CCS', 'RGN', 'MDL', 'FNJ',
  'NIM', 'NDJ', 'BEY',
]);

/**
 * Offline fallback: countries under a full Auswärtiges Amt travel warning (Reisewarnung) as
 * published at https://www.auswaertiges-amt.de/opendata/travelwarning on 2026-10-21.
 * Only used while no live advisory data is available (APIs unreachable, cold start), so the
 * hard safety filter fails closed instead of letting every destination through.
 */
export const OFFLINE_FULL_WARNING_COUNTRIES = new Set<string>([
  'AF', 'BY', 'CF', 'HT', 'IQ', 'IR', 'LY', 'ML', 'MM', 'NE',
  'PS', 'RU', 'SA', 'SD', 'SO', 'SS', 'SY', 'UA', 'YE',
]);
export const OFFLINE_SNAPSHOT_DATE = '2026-10-21';

let liveStore: AdvisoryCacheStore | null = null;
let refreshHook: (() => void) | null = null;

/** Called by safety-service.ts once live advisories have been fetched or read from cache. */
export function setAdvisoryStore(store: AdvisoryCacheStore): void {
  liveStore = store;
}

/** safety-service.ts registers its background refresher so stale reads can trigger it. */
export function registerAdvisoryRefresh(hook: () => void): void {
  refreshHook = hook;
}

export function hasLiveAdvisories(store: AdvisoryCacheStore | null = liveStore): boolean {
  return Boolean(store && Date.now() - store.timestamp < ADVISORY_CACHE_TTL_MS && Object.keys(store.entries).length > 0);
}

/**
 * Current advisory entries: live data when fresh, otherwise the offline full-warning snapshot.
 */
export function getAdvisoryStore(): AdvisoryCacheStore {
  if (hasLiveAdvisories()) return liveStore!;
  if (typeof window === 'undefined' && refreshHook) refreshHook();
  if (liveStore && Object.keys(liveStore.entries).length > 0) return liveStore; // stale beats none
  return offlineStore;
}

const offlineStore: AdvisoryCacheStore = {
  timestamp: 0,
  entries: Object.fromEntries(
    Array.from(OFFLINE_FULL_WARNING_COUNTRIES).map((iso) => [
      iso,
      {
        isoCode: iso,
        countryName: countries.getName(iso, 'en') || iso,
        hasGermanWarning: true,
        hasGermanPartialWarning: false,
        usStateDeptLevel: 4 as const,
        usTitle: `Reisewarnung (offline snapshot ${OFFLINE_SNAPSHOT_DATE})`,
        isSafeForFamilies: false,
        safetyScore: 20,
      },
    ])
  ),
};

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
 * Hard exclusion boundary: a destination under a *full* national travel warning (Auswärtiges
 * Amt Reisewarnung, or US State Dept Level 4 "Do Not Travel"), or an airport in an active
 * conflict zone, is never calculated or returned - not even when the user names it explicitly.
 * Partial travel warnings (Teilreisewarnungen) are explicitly allowed.
 */
export function isDestinationBanned(airportCode: string, countryCodeOrName: string): boolean {
  const apCode = (airportCode || '').trim().toUpperCase();
  if (HIGH_RISK_AIRPORT_CODES.has(apCode)) return true;
  const entry = getAdvisoryStore().entries[resolveIsoCountryCode(countryCodeOrName)];
  return Boolean(entry && (entry.hasGermanWarning || entry.usStateDeptLevel === 4));
}

/**
 * Evaluates whether a destination is suitable for flex discovery (open family vacation search).
 * Besides the hard ban, US Level 3 ("Reconsider Travel") destinations are left out of open
 * discovery; they stay reachable when the user asks for them explicitly.
 */
export function isDestinationSafeForVacation(airportCode: string, countryCodeOrName: string): boolean {
  if (isDestinationBanned(airportCode, countryCodeOrName)) return false;
  const entry = getAdvisoryStore().entries[resolveIsoCountryCode(countryCodeOrName)];
  return entry ? entry.isSafeForFamilies : true;
}

const AA_OVERVIEW_URL = 'https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/reise-und-sicherheitshinweise';
const US_OVERVIEW_URL = 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html';

/** Links to the official advisories; the AA site resolves a page by its content id alone */
export function getAdvisorySourceUrls(
  entry?: Pick<TravelAdvisoryCacheEntry, 'germanContentId' | 'usUrl'>
): Pick<DestinationSafetyAssessment, 'germanAdvisoryUrl' | 'usAdvisoryUrl'> {
  return {
    germanAdvisoryUrl: entry?.germanContentId
      ? `${AA_OVERVIEW_URL}/${entry.germanContentId}`
      : AA_OVERVIEW_URL,
    usAdvisoryUrl: entry?.usUrl || US_OVERVIEW_URL,
  };
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
  const entry = getAdvisoryStore().entries[iso];
  const sourceUrls = getAdvisorySourceUrls(entry);

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
      conflictZone: true,
      ...sourceUrls,
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
      ...sourceUrls,
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
    ...sourceUrls,
  };
}
