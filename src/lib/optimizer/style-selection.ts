import type { DestinationType, TravelVehicle } from './types';

/**
 * Vacation-style multi-selection shared by the search form and the profile, so both pages
 * behave identically (no style or every style means "all", with all selected a click picks only
 * that style). How far the trip goes is a separate choice (TravelDistance): every style can be
 * short/medium or long haul.
 */
export const ALL_SPECIFIC_STYLES: DestinationType[] = ['BEACH', 'ALPINE', 'CITY', 'NATURE'];

export function isAllStylesSelection(styles: DestinationType[]): boolean {
  return styles.includes('ALL') || ALL_SPECIFIC_STYLES.every((s) => styles.includes(s));
}

export function toggleStyleSelection(prev: DestinationType[], style: DestinationType): DestinationType[] {
  if (style === 'ALL') return ['ALL'];
  if (isAllStylesSelection(prev)) return [style];
  if (prev.includes(style)) {
    const next = prev.filter((s) => s !== style);
    return next.length === 0 ? ['ALL'] : next;
  }
  const next = [...prev, style];
  return ALL_SPECIFIC_STYLES.every((s) => next.includes(s)) ? ['ALL'] : next;
}

/**
 * How far a trip may go: short/medium haul (up to LONG_HAUL_KM) or long haul. Selected like the
 * travel modes; both (or none) means any distance.
 */
export type TravelDistance = 'NEARBY' | 'LONGHAUL';
export const ALL_TRAVEL_DISTANCES: TravelDistance[] = ['NEARBY', 'LONGHAUL'];

export function isAllTravelDistances(distances: readonly string[]): boolean {
  return ALL_TRAVEL_DISTANCES.every((d) => distances.includes(d));
}

export function toggleTravelDistance(prev: readonly TravelDistance[], distance: TravelDistance): TravelDistance[] {
  return toggleWithinAll(ALL_TRAVEL_DISTANCES, prev, distance);
}

export interface StyleSelection {
  styles: DestinationType[];
  distances: TravelDistance[];
}

/**
 * The optimizer request for a style + distance selection. The engine keeps expressing long haul
 * as the LONGRANGE type narrowed by longRangeStyles, so every combination maps onto a search it
 * already runs: e.g. long-haul beach = LONGRANGE + [BEACH]; beach at any distance = BEACH (short
 * and medium haul) or LONGRANGE + [BEACH].
 */
export function toOptimizerStyles({ styles, distances }: StyleSelection): {
  destinationTypes?: DestinationType[];
  longRangeStyles?: DestinationType[];
} {
  const allStyles = isAllStylesSelection(styles);
  const specific = allStyles ? [] : ALL_SPECIFIC_STYLES.filter((s) => styles.includes(s));
  const nearby = distances.length === 0 || distances.includes('NEARBY');
  const longHaul = distances.length === 0 || distances.includes('LONGHAUL');
  if (nearby && longHaul) {
    return allStyles ? {} : { destinationTypes: [...specific, 'LONGRANGE'], longRangeStyles: specific };
  }
  if (longHaul) {
    return { destinationTypes: ['LONGRANGE'], longRangeStyles: allStyles ? undefined : specific };
  }
  // Every style without LONGRANGE is the short/medium-haul search ("ALL" would include long haul)
  return { destinationTypes: allStyles ? [...ALL_SPECIFIC_STYLES] : specific };
}

const VALID_STYLES = new Set<string>([...ALL_SPECIFIC_STYLES, 'ALL', 'LONGRANGE']);

function styleList(raw: unknown): DestinationType[] {
  if (!Array.isArray(raw)) return [];
  const styles = raw.map((s) => (s === 'SKI' ? 'ALPINE' : s)).filter((s): s is DestinationType => VALID_STYLES.has(s));
  return [...new Set(styles)];
}

function normalizedStyles(list: DestinationType[]): DestinationType[] {
  return list.length === 0 || isAllStylesSelection(list) ? ['ALL'] : list;
}

/**
 * Reads a saved selection (form state in the browser, shared searches, the profile). Selections
 * saved before the distance choice existed carry LONGRANGE as a style and the kinds of long-haul
 * trip in longRangeStyles: a style without LONGRANGE meant short/medium haul only, LONGRANGE
 * alone meant long haul, and both together become their union at any distance (the closest fit
 * for "nearby X or far Y").
 */
export function readStyleSelection(saved: { styles?: unknown; longRangeStyles?: unknown; travelDistances?: unknown }): StyleSelection {
  const styles = styleList(saved.styles);
  const specific = styles.filter((s) => s !== 'ALL' && s !== 'LONGRANGE');

  const savedDistances = saved.travelDistances;
  const distances = Array.isArray(savedDistances) ? ALL_TRAVEL_DISTANCES.filter((d) => savedDistances.includes(d)) : [];
  if (distances.length > 0) {
    return { styles: styles.includes('ALL') ? ['ALL'] : normalizedStyles(specific), distances };
  }

  if (styles.length === 0 || styles.includes('ALL')) return { styles: ['ALL'], distances: [...ALL_TRAVEL_DISTANCES] };
  if (!styles.includes('LONGRANGE')) return { styles: normalizedStyles(specific), distances: ['NEARBY'] };
  const kinds = styleList(saved.longRangeStyles).filter((s) => ALL_SPECIFIC_STYLES.includes(s));
  if (specific.length === 0) return { styles: normalizedStyles(kinds), distances: ['LONGHAUL'] };
  const union = kinds.length === 0 ? [...ALL_SPECIFIC_STYLES] : [...new Set([...specific, ...kinds])];
  return { styles: normalizedStyles(union), distances: [...ALL_TRAVEL_DISTANCES] };
}

/**
 * Reads the stored profile preference: the multi-select list (current format) or the legacy
 * single preferredVacationStyle value, plus the distance choice.
 */
export function readStoredStyleSelection(
  scoringWeights:
    | { preferredVacationStyles?: unknown; preferredVacationStyle?: unknown; longRangeStyles?: unknown; travelDistances?: unknown }
    | null
    | undefined
): StyleSelection {
  const list = scoringWeights?.preferredVacationStyles;
  const single = scoringWeights?.preferredVacationStyle;
  const styles = Array.isArray(list) && list.length > 0 ? list : typeof single === 'string' && single ? [single] : [];
  return readStyleSelection({
    styles,
    longRangeStyles: scoringWeights?.longRangeStyles,
    travelDistances: scoringWeights?.travelDistances,
  });
}

/**
 * Whether minimum beach temperature / snow guarantee can matter for a style selection: the style
 * itself or "all styles", at any distance (a long-haul beach trip needs beach weather too).
 */
export function getClimateRelevance(styles: DestinationType[]) {
  const all = isAllStylesSelection(styles);
  return {
    isAll: all,
    beach: all || styles.includes('BEACH'),
    alpine: all || styles.includes('ALPINE'),
  };
}

/**
 * Travel modes behave like the vacation styles: with every mode selected (no restriction), a
 * click picks only that mode; deselecting the last mode, or selecting every mode, means "all".
 */
export const ALL_TRAVEL_MODES: TravelVehicle[] = ['PLANE', 'CAR', 'TRAIN', 'BUS'];

export function isAllTravelModesSelection(modes: readonly string[]): boolean {
  return ALL_TRAVEL_MODES.every((m) => modes.includes(m));
}

export function toggleTravelModeSelection<T extends string>(prev: readonly T[], mode: T): T[] {
  return toggleWithinAll(ALL_TRAVEL_MODES as readonly string[] as T[], prev, mode);
}

/** With every option selected a click picks only that one; none or every option means all. */
function toggleWithinAll<T extends string>(all: readonly T[], prev: readonly T[], item: T): T[] {
  const isAll = (list: readonly T[]) => all.every((x) => list.includes(x));
  if (isAll(prev)) return [item];
  const next = prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item];
  return next.length === 0 || isAll(next) ? [...all] : next;
}
