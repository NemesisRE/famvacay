import { describe, it, expect } from 'vitest';
import { isAllStylesSelection, toggleStyleSelection, readStoredStyles, ALL_SPECIFIC_STYLES } from '../style-selection';

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
