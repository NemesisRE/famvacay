import type { CandidateWindow } from '../optimizer/types';
import { getDestinationVacationStyles } from '../optimizer/destination-styles';

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
  heat: string;
  boardType: string;
  overlandDuration: string;
  flightStops: string;
  schoolHoliday: string;
  maxCost?: number;
}

export type ResultFilterKey = keyof ResultFilterState;

/** The value each filter has when it does not filter anything */
export const NEUTRAL_FILTER_VALUES: { [K in ResultFilterKey]: ResultFilterState[K] } = {
  destinations: [],
  month: 'ALL',
  style: 'ALL',
  distance: 'ALL',
  vehicle: 'ALL',
  safety: 'ALL',
  warning: 'ALL',
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

type Tests = { [K in ResultFilterKey]: (w: CandidateWindow, value: ResultFilterState[K]) => boolean };

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
        return dist <= 3500;
      case 'LONG':
        return dist <= 6000;
      case 'INTERCONTINENTAL':
        return dist > 3500;
      default:
        return true;
    }
  },
  // The trip's own vehicle: since a destination can be reached by several vehicles, each trip is one
  // of them (filtering "plane" must not keep car trips to a destination that also has an airport)
  vehicle: (w, vehicle) => vehicle === 'ALL' || (w.travelVehicle || 'PLANE') === vehicle,
  safety: (w, safety) => {
    if (safety !== 'SAFE_ONLY') return true;
    const s = w.destinationSafety || w.safetyAssessment;
    return s ? s.isSafe : true;
  },
  warning: (w, warning) =>
    warning !== 'CLEAN_ONLY' || !w.seasonalWarning || w.seasonalWarning.seasonType === 'EXTREME_HEAT',
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
  value: ResultFilterState[K]
): boolean {
  return TESTS[key](w, value);
}

/** Results passing every filter, optionally ignoring one (for that filter's option counts). */
export function applyResultFilters(
  windows: CandidateWindow[],
  state: ResultFilterState,
  except?: ResultFilterKey
): CandidateWindow[] {
  const keys = KEYS.filter((k) => k !== except);
  return windows.filter((w) => keys.every((k) => (TESTS[k] as (w: CandidateWindow, v: unknown) => boolean)(w, state[k])));
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
      counts[value] = base.filter((w) => (TESTS[key] as (w: CandidateWindow, v: unknown) => boolean)(w, value)).length;
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
