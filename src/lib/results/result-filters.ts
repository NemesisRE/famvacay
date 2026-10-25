import type { CandidateWindow } from '../optimizer/types';
import { getDestinationVacationStyles } from '../optimizer/destination-styles';
import { LOW_DEMAND_THRESHOLD } from '../holidays/source-markets';
import { getSeasonalWarningTypeKey, getWindowFilterWarning } from '../optimizer/localized-warnings';
import { LONG_HAUL_KM } from '../optimizer/distance-bands';

/**
 * Result filters of the search page as pure functions, so the page can both filter the results
 * and tell, per option, how many results it would leave given all *other* active filters
 * (options without results are greyed out instead of leading to an empty page).
 */
export interface ResultFilterState {
  destinations: string[];
  /** 'ALL', 'YYYY-MM' or legacy month-only 'MM' */
  month: string;
  style: string;
  distance: string;
  vehicle: string;
  safety: string;
  warning: string;
  /** Seasonal warning type keys explicitly allowed to be shown when `warning !== 'ALL'` */
  allowedWarnings?: string[];
  /** Seasonal travel demand information filter: 'ALL' or 'QUIET_ONLY' */
  seasonalInfo?: string;
  heat: string;
  boardType: string;
  overlandDuration: string;
  flightStops: string;
  schoolHoliday: string;
  maxCost?: number;
}

export type ResultFilterKey = Exclude<keyof ResultFilterState, 'allowedWarnings'>;

/** The value each filter has when it does not filter anything */
export const NEUTRAL_FILTER_VALUES: { [K in ResultFilterKey]: ResultFilterState[K] } = {
  destinations: [],
  month: 'ALL',
  style: 'ALL',
  distance: 'ALL',
  vehicle: 'ALL',
  safety: 'ALL',
  warning: 'ALL',
  seasonalInfo: 'ALL',
  heat: 'ALL',
  boardType: 'ALL',
  overlandDuration: 'ALL',
  flightStops: 'ALL',
  schoolHoliday: 'all',
  maxCost: undefined,
};

const isOverland = (w: CandidateWindow) => Boolean(w.travelVehicle && w.travelVehicle !== 'PLANE');

const tripDistanceKm = (w: CandidateWindow) =>
  isOverland(w) ? w.vehicleDetails?.distanceKm || 0 : w.flightDistanceKm || 0;

function getWindowSafetyLevel(w: CandidateWindow): 1 | 2 | 3 | 4 {
  const s = w.destinationSafety || w.safetyAssessment;
  if (!s) return 1;
  if (s.advisoryLevel) return s.advisoryLevel;
  if (s.level === 'DANGER' || s.hasGermanWarning || s.usStateDeptLevel === 4) return 4;
  if (s.level === 'WARNING' || s.usStateDeptLevel === 3) return 3;
  if (s.level === 'CAUTION' || s.hasGermanPartialWarning || s.usStateDeptLevel === 2) return 2;
  if (s.isSafe === false) return 3;
  return 1;
}

type Tests = { [K in ResultFilterKey]: (w: CandidateWindow, value: ResultFilterState[K], state?: ResultFilterState) => boolean };

const TESTS: Tests = {
  destinations: (w, codes) => codes.length === 0 || codes.includes(w.destinationAirport),
  month: (w, month) =>
    month === 'ALL' || (month.length === 7 ? w.startDate.startsWith(month) : w.startDate.split('-')[1] === month),
  style: (w, style) => {
    if (style === 'ALL') return true;
    const styles = getDestinationVacationStyles(w.destinationAirport, w.flightDistanceKm);
    if (style === 'BEACH') return styles.includes('BEACH') && !styles.includes('LONGRANGE');
    return styles.includes(style as never);
  },
  distance: (w, distance) => {
    const dist = tripDistanceKm(w);
    switch (distance) {
      case 'SHORT':
        return dist <= 1000;
      case 'MID':
        return dist <= 2500;
      case 'EXTENDED':
        return dist <= LONG_HAUL_KM;
      case 'LONG':
        return dist <= 6000;
      case 'INTERCONTINENTAL':
        return dist > LONG_HAUL_KM;
      default:
        return true;
    }
  },
  // The trip's own vehicle: since a destination can be reached by several vehicles, each trip is one
  // of them (filtering "plane" must not keep car trips to a destination that also has an airport)
  vehicle: (w, vehicle) => vehicle === 'ALL' || (w.travelVehicle || 'PLANE') === vehicle,
  safety: (w, safety) => {
    if (safety === 'LEVEL_1') return getWindowSafetyLevel(w) <= 1;
    if (safety === 'SAFE_ONLY' || safety === 'LEVEL_2') return getWindowSafetyLevel(w) <= 2;
    return true;
  },
  warning: (w, warning, state) => {
    if (warning !== 'CLEAN_ONLY') return true;
    const filterWarning = getWindowFilterWarning(w);
    if (!filterWarning) return true;
    const allowed = state?.allowedWarnings || [];
    return allowed.includes(getSeasonalWarningTypeKey(filterWarning));
  },
  seasonalInfo: (w, seasonalInfo) =>
    seasonalInfo !== 'QUIET_ONLY' || Boolean(w.sourceMarketDemand && w.sourceMarketDemand.index <= LOW_DEMAND_THRESHOLD),
  heat: (w, heat) => heat !== 'AVOID_EXTREME_HEAT' || w.seasonalWarning?.seasonType !== 'EXTREME_HEAT',
  boardType: (w, boardType) => boardType === 'ALL' || w.boardType === boardType,
  overlandDuration: (w, maxMinutes) => {
    if (maxMinutes === 'ALL' || !isOverland(w) || !w.vehicleDetails?.durationMinutes) return true;
    return w.vehicleDetails.durationMinutes <= Number(maxMinutes);
  },
  flightStops: (w, stops) => {
    if (stops === 'ALL' || isOverland(w)) return true;
    if (stops === 'DIRECT_ONLY') return Boolean(w.isDirectFlight) || w.flightStops === 0;
    if (stops === 'MAX_1_STOP') return (w.flightStops ?? 0) <= 1;
    return true;
  },
  schoolHoliday: (w, schoolHoliday) => schoolHoliday !== 'holidaysOnly' || !w.requiresSchoolExemption,
  maxCost: (w, maxCost) => maxCost === undefined || maxCost <= 0 || w.estimatedTotalCost <= maxCost,
};

const KEYS = Object.keys(TESTS) as ResultFilterKey[];

export function matchesResultFilter<K extends ResultFilterKey>(
  w: CandidateWindow,
  key: K,
  value: ResultFilterState[K],
  state?: ResultFilterState
): boolean {
  return TESTS[key](w, value, state);
}

/** Results passing every filter, optionally ignoring one (for that filter's option counts). */
export function applyResultFilters(
  windows: CandidateWindow[],
  state: ResultFilterState,
  except?: ResultFilterKey
): CandidateWindow[] {
  const keys = KEYS.filter((k) => k !== except);
  return windows.filter((w) =>
    keys.every((k) => (TESTS[k] as (w: CandidateWindow, v: unknown, s?: ResultFilterState) => boolean)(w, state[k], state))
  );
}

/**
 * For each listed filter option: how many results it would leave, given all other active filters.
 * Returns { [filterKey]: { [optionValue]: count } }.
 */
export function countResultFilterOptions(
  windows: CandidateWindow[],
  state: ResultFilterState,
  options: Partial<{ [K in ResultFilterKey]: string[] }>
): Partial<Record<ResultFilterKey, Record<string, number>>> {
  const out: Partial<Record<ResultFilterKey, Record<string, number>>> = {};
  for (const key of Object.keys(options) as ResultFilterKey[]) {
    const base = applyResultFilters(windows, state, key);
    const counts: Record<string, number> = {};
    for (const value of options[key] || []) {
      counts[value] = base.filter((w) =>
        (TESTS[key] as (w: CandidateWindow, v: unknown, s?: ResultFilterState) => boolean)(w, value, state)
      ).length;
    }
    out[key] = counts;
  }
  return out;
}

/**
 * Whether a filter can change anything for the current results (given the other filters):
 * flight stops need flights, the overland travel time needs car/train/bus trips, and so on.
 */
export function isResultFilterApplicable(
  windows: CandidateWindow[],
  state: ResultFilterState,
  key: 'flightStops' | 'overlandDuration'
): boolean {
  const base = applyResultFilters(windows, state, key);
  return key === 'flightStops' ? base.some((w) => !isOverland(w)) : base.some(isOverland);
}

export interface ResultFilterExclusion {
  key: ResultFilterKey;
  /** Specific seasonal warning type key when `key === 'warning'` */
  warningKey?: string;
  /** Results this filter hides in addition to the filters listed before it */
  excluded: number;
}

/**
 * Why fewer results are shown than were found: the filters are applied one after another (in a
 * fixed order) and each reports how many of the remaining results it hides, so the rows add up
 * exactly to "found - shown". Filters that hide nothing are left out.
 * Seasonal warnings are broken down by individual warning type so each can be resolved separately.
 */
export function explainResultFilterExclusions(windows: CandidateWindow[], state: ResultFilterState): ResultFilterExclusion[] {
  const rows: ResultFilterExclusion[] = [];
  let remaining = windows;
  for (const key of KEYS) {
    if (key === 'warning') {
      if (state.warning === 'CLEAN_ONLY') {
        const allowed = state.allowedWarnings || [];
        const byWarningKey = new Map<string, number>();
        const kept: CandidateWindow[] = [];
        for (const w of remaining) {
          const fw = getWindowFilterWarning(w);
          const wk = fw ? getSeasonalWarningTypeKey(fw) : null;
          if (wk && !allowed.includes(wk)) {
            byWarningKey.set(wk, (byWarningKey.get(wk) || 0) + 1);
          } else {
            kept.push(w);
          }
        }
        for (const [warningKey, excluded] of byWarningKey.entries()) {
          rows.push({ key: 'warning', warningKey, excluded });
        }
        remaining = kept;
      }
      continue;
    }
    const test = TESTS[key] as (w: CandidateWindow, v: unknown, s?: ResultFilterState) => boolean;
    const next = remaining.filter((w) => test(w, state[key], state));
    if (next.length < remaining.length) rows.push({ key, excluded: remaining.length - next.length });
    remaining = next;
  }
  return rows;
}
