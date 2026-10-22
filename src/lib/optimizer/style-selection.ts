import type { DestinationType } from './types';

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
