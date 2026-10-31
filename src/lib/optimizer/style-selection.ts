import type { DestinationType, TravelVehicle } from './types';

/**
 * Vacation-style multi-selection shared by the search form and the profile, so both pages
 * behave identically ("Flexible / All" highlights every style tile, deselecting the last
 * style falls back to "All", selecting every specific style collapses to "All").
 */
export const ALL_SPECIFIC_STYLES: DestinationType[] = ['BEACH', 'ALPINE', 'CITY', 'NATURE', 'LONGRANGE'];

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
 * Reads the stored profile preference: the multi-select list (current format) or the legacy
 * single preferredVacationStyle value.
 */
export function readStoredStyles(scoringWeights: { preferredVacationStyles?: unknown; preferredVacationStyle?: unknown } | null | undefined): DestinationType[] {
  const list = scoringWeights?.preferredVacationStyles;
  if (Array.isArray(list) && list.length > 0) {
    return list.map((s) => (s === 'SKI' ? 'ALPINE' : s)) as DestinationType[];
  }
  const single = scoringWeights?.preferredVacationStyle;
  if (typeof single === 'string' && single) return [single === 'SKI' ? 'ALPINE' : (single as DestinationType)];
  return ['ALL'];
}

/**
 * Whether minimum beach temperature / snow guarantee can matter for a style selection: the style
 * itself, "all styles", or a long-range selection whose preferred kind includes it.
 */
export function getClimateRelevance(styles: DestinationType[], longRangeStyles: DestinationType[] = []) {
  const all = isAllStylesSelection(styles);
  const longRangeOnly = !all && styles.includes('LONGRANGE');
  const longRangeWants = (style: DestinationType) =>
    longRangeOnly && (longRangeStyles.length === 0 || longRangeStyles.includes(style));
  return {
    isAll: all,
    isLongRangeSelected: longRangeOnly,
    beach: all || styles.includes('BEACH') || longRangeWants('BEACH'),
    alpine: all || styles.includes('ALPINE') || longRangeWants('ALPINE'),
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
  const all = ALL_TRAVEL_MODES as readonly string[] as T[];
  if (isAllTravelModesSelection(prev)) return [mode];
  if (prev.includes(mode)) {
    const next = prev.filter((m) => m !== mode);
    return next.length === 0 ? [...all] : next;
  }
  const next = [...prev, mode];
  return isAllTravelModesSelection(next) ? [...all] : next;
}

/** Kinds of long-haul trip; all of them selected is the same as "any" (an empty list) */
export const LONG_RANGE_STYLE_OPTIONS: DestinationType[] = ['BEACH', 'CITY', 'NATURE', 'ALPINE'];

export function toggleLongRangeStyle(current: DestinationType[], style: DestinationType): DestinationType[] {
  const next = current.includes(style) ? current.filter((s) => s !== style) : [...current, style];
  return next.length === LONG_RANGE_STYLE_OPTIONS.length ? [] : next;
}
