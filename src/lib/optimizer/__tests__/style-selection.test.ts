import { describe, it, expect } from 'vitest';
import {
  isAllStylesSelection,
  toggleStyleSelection,
  readStoredStyleSelection,
  readStyleSelection,
  toOptimizerStyles,
  getClimateRelevance,
  ALL_SPECIFIC_STYLES,
  toggleTravelModeSelection,
  isAllTravelModesSelection,
  toggleTravelDistance,
} from '../style-selection';

describe('Vacation style selection (search form & profile)', () => {
  it('treats "ALL" and every specific style as the all-styles selection', () => {
    expect(isAllStylesSelection(['ALL'])).toBe(true);
    expect(isAllStylesSelection([...ALL_SPECIFIC_STYLES])).toBe(true);
    expect(isAllStylesSelection(['BEACH', 'CITY'])).toBe(false);
  });

  it('pressing a style while "all" is active selects just that style', () => {
    expect(toggleStyleSelection(['ALL'], 'BEACH')).toEqual(['BEACH']);
  });

  it('deselecting the last style falls back to all styles', () => {
    expect(toggleStyleSelection(['BEACH'], 'BEACH')).toEqual(['ALL']);
  });

  it('selecting every specific style collapses to all styles', () => {
    expect(toggleStyleSelection(['BEACH', 'ALPINE', 'CITY'], 'NATURE')).toEqual(['ALL']);
  });

  it('pressing "all" always resets to all styles', () => {
    expect(toggleStyleSelection(['BEACH', 'CITY'], 'ALL')).toEqual(['ALL']);
  });

  it('reads the stored profile selection, including the legacy single value', () => {
    expect(readStoredStyleSelection({ preferredVacationStyles: ['BEACH'], travelDistances: ['LONGHAUL'] })).toEqual({
      styles: ['BEACH'],
      distances: ['LONGHAUL'],
    });
    expect(readStoredStyleSelection({ preferredVacationStyle: 'SKI' })).toEqual({ styles: ['ALPINE'], distances: ['NEARBY'] });
    expect(readStoredStyleSelection({ preferredVacationStyle: 'ALL' })).toEqual({ styles: ['ALL'], distances: ['NEARBY', 'LONGHAUL'] });
    expect(readStoredStyleSelection(null)).toEqual({ styles: ['ALL'], distances: ['NEARBY', 'LONGHAUL'] });
  });
});

describe('selections saved before the distance choice (LONGRANGE as a style)', () => {
  it('reads a style without LONGRANGE as short/medium haul, as it was searched', () => {
    expect(readStyleSelection({ styles: ['BEACH', 'CITY'] })).toEqual({ styles: ['BEACH', 'CITY'], distances: ['NEARBY'] });
    expect(readStyleSelection({ styles: ['BEACH', 'ALPINE', 'CITY', 'NATURE'] })).toEqual({ styles: ['ALL'], distances: ['NEARBY'] });
  });

  it('reads LONGRANGE alone as long haul with its kinds as styles', () => {
    expect(readStyleSelection({ styles: ['LONGRANGE'], longRangeStyles: ['BEACH'] })).toEqual({ styles: ['BEACH'], distances: ['LONGHAUL'] });
    expect(readStyleSelection({ styles: ['LONGRANGE'], longRangeStyles: [] })).toEqual({ styles: ['ALL'], distances: ['LONGHAUL'] });
  });

  it('reads a mixed selection as the union at any distance', () => {
    expect(readStyleSelection({ styles: ['BEACH', 'LONGRANGE'], longRangeStyles: ['CITY'] })).toEqual({
      styles: ['BEACH', 'CITY'],
      distances: ['NEARBY', 'LONGHAUL'],
    });
    // No preferred kind of long-haul trip: any style far away
    expect(readStyleSelection({ styles: ['BEACH', 'LONGRANGE'] })).toEqual({ styles: ['ALL'], distances: ['NEARBY', 'LONGHAUL'] });
    expect(readStyleSelection({ styles: ['ALL'] })).toEqual({ styles: ['ALL'], distances: ['NEARBY', 'LONGHAUL'] });
  });

  it('ignores unknown values', () => {
    expect(readStyleSelection({ styles: 'BEACH', travelDistances: ['MOON'] })).toEqual({ styles: ['ALL'], distances: ['NEARBY', 'LONGHAUL'] });
  });
});

describe('optimizer request for a style + distance selection', () => {
  const BOTH = ['NEARBY', 'LONGHAUL'] as const;

  it('all styles at any distance is the open search', () => {
    expect(toOptimizerStyles({ styles: ['ALL'], distances: [...BOTH] })).toEqual({});
  });

  it('short/medium haul keeps long-haul destinations out, also for all styles', () => {
    expect(toOptimizerStyles({ styles: ['BEACH'], distances: ['NEARBY'] })).toEqual({ destinationTypes: ['BEACH'] });
    expect(toOptimizerStyles({ styles: ['ALL'], distances: ['NEARBY'] })).toEqual({ destinationTypes: ALL_SPECIFIC_STYLES });
  });

  it('long haul narrows the long-range search to the chosen styles', () => {
    expect(toOptimizerStyles({ styles: ['BEACH', 'CITY'], distances: ['LONGHAUL'] })).toEqual({
      destinationTypes: ['LONGRANGE'],
      longRangeStyles: ['BEACH', 'CITY'],
    });
    expect(toOptimizerStyles({ styles: ['ALL'], distances: ['LONGHAUL'] })).toEqual({ destinationTypes: ['LONGRANGE'], longRangeStyles: undefined });
  });

  it('a style at any distance searches it near and far', () => {
    expect(toOptimizerStyles({ styles: ['ALPINE'], distances: [...BOTH] })).toEqual({
      destinationTypes: ['ALPINE', 'LONGRANGE'],
      longRangeStyles: ['ALPINE'],
    });
  });

  it('beach temperature and snow follow the style, whatever the distance', () => {
    expect(getClimateRelevance(['BEACH'])).toEqual({ isAll: false, beach: true, alpine: false });
    expect(getClimateRelevance(['ALL']).alpine).toBe(true);
  });
});

describe('travel mode selection (same behaviour as the vacation styles)', () => {
  const ALL = ['PLANE', 'CAR', 'TRAIN', 'BUS'];

  it('picks only the clicked mode when every mode is selected', () => {
    expect(toggleTravelModeSelection(ALL, 'TRAIN')).toEqual(['TRAIN']);
    // Order of the full selection does not matter
    expect(toggleTravelModeSelection(['BUS', 'TRAIN', 'CAR', 'PLANE'], 'PLANE')).toEqual(['PLANE']);
  });

  it('adds and removes further modes one by one', () => {
    expect(toggleTravelModeSelection(['TRAIN'], 'CAR')).toEqual(['TRAIN', 'CAR']);
    expect(toggleTravelModeSelection(['TRAIN', 'CAR'], 'TRAIN')).toEqual(['CAR']);
  });

  it('falls back to every mode when the last one is deselected or all are picked', () => {
    expect(toggleTravelModeSelection(['CAR'], 'CAR')).toEqual(ALL);
    expect(toggleTravelModeSelection(['PLANE', 'CAR', 'TRAIN'], 'BUS')).toEqual(ALL);
    expect(isAllTravelModesSelection(ALL)).toBe(true);
    expect(isAllTravelModesSelection(['PLANE'])).toBe(false);
  });
});

describe('travel distance selection (same behaviour as the travel modes)', () => {
  it('picks one distance from both, and falls back to both', () => {
    expect(toggleTravelDistance(['NEARBY', 'LONGHAUL'], 'LONGHAUL')).toEqual(['LONGHAUL']);
    expect(toggleTravelDistance(['LONGHAUL'], 'NEARBY')).toEqual(['NEARBY', 'LONGHAUL']);
    expect(toggleTravelDistance(['LONGHAUL'], 'LONGHAUL')).toEqual(['NEARBY', 'LONGHAUL']);
  });
});
