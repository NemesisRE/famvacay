import { describe, it, expect } from 'vitest';
import {
  isAllStylesSelection,
  toggleStyleSelection,
  readStoredStyles,
  ALL_SPECIFIC_STYLES,
  toggleTravelModeSelection,
  isAllTravelModesSelection,
  toggleLongRangeStyle,
  isAnyLongRangeStyle,
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
    expect(toggleStyleSelection(['BEACH', 'ALPINE', 'CITY', 'NATURE'], 'LONGRANGE')).toEqual(['ALL']);
  });

  it('pressing "all" always resets to all styles', () => {
    expect(toggleStyleSelection(['BEACH', 'CITY'], 'ALL')).toEqual(['ALL']);
  });

  it('reads the stored profile selection, including the legacy single value', () => {
    expect(readStoredStyles({ preferredVacationStyles: ['BEACH', 'LONGRANGE'] })).toEqual(['BEACH', 'LONGRANGE']);
    expect(readStoredStyles({ preferredVacationStyle: 'SKI' })).toEqual(['ALPINE']);
    expect(readStoredStyles({ preferredVacationStyle: 'ALL' })).toEqual(['ALL']);
    expect(readStoredStyles(null)).toEqual(['ALL']);
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

describe('long-haul trip kinds (same behaviour as the travel modes)', () => {
  it('picks only the clicked kind when any kind is allowed', () => {
    expect(toggleLongRangeStyle([], 'BEACH')).toEqual(['BEACH']);
    expect(toggleLongRangeStyle(['BEACH', 'CITY', 'NATURE', 'ALPINE'], 'CITY')).toEqual(['CITY']);
  });

  it('adds and removes kinds, and falls back to any', () => {
    expect(toggleLongRangeStyle(['BEACH'], 'CITY')).toEqual(['BEACH', 'CITY']);
    expect(toggleLongRangeStyle(['BEACH', 'CITY'], 'BEACH')).toEqual(['CITY']);
    expect(toggleLongRangeStyle(['BEACH'], 'BEACH')).toEqual([]);
    expect(toggleLongRangeStyle(['BEACH', 'CITY', 'NATURE'], 'ALPINE')).toEqual([]);
    expect(isAnyLongRangeStyle([])).toBe(true);
    expect(isAnyLongRangeStyle(['BEACH'])).toBe(false);
  });
});
