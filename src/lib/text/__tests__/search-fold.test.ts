import { describe, it, expect } from 'vitest';
import { foldForSearch, searchForms } from '../search-fold';
import { searchAirports } from '@/lib/airports/airport-service';

describe('search folding (umlauts, accents, ß)', () => {
  it('matches umlauts in any case and without the dots', () => {
    expect(foldForSearch('Ägypten')).toBe('agypten');
    expect(foldForSearch('ägypten')).toBe(foldForSearch('ÄGYPTEN'));
    expect(foldForSearch('Zürich')).toBe(foldForSearch('Zurich'));
    expect(foldForSearch('Málaga')).toBe('malaga');
    expect(foldForSearch('Straße')).toBe('strasse');
  });

  it('keeps letters of other scripts', () => {
    expect(foldForSearch('Αθήνα')).toBe('αθηνα');
    expect(foldForSearch('東京')).toBe('東京');
  });

  it('also offers the German transcription of umlauts', () => {
    expect(searchForms('München')).toEqual(['munchen', 'muenchen']);
    expect(searchForms('Paris')).toEqual(['paris']);
  });
});

describe('airport search with umlauts and localized names', () => {
  const codes = (q: string, locale = 'de') => searchAirports(q, undefined, 15, locale).map((a) => a.code);

  it('finds airports by their German names, with or without umlauts', () => {
    for (const q of ['München', 'münchen', 'Munchen', 'Muenchen', 'Munich']) expect(codes(q)).toContain('MUC');
    for (const q of ['Köln', 'koeln', 'Cologne']) expect(codes(q)).toContain('CGN');
    for (const q of ['Zürich', 'zurich']) expect(codes(q)).toContain('ZRH');
  });

  it('works whatever the interface language', () => {
    expect(codes('München', 'en')).toContain('MUC');
    expect(codes('Málaga', 'fr')).toContain('AGP');
  });

  it('finds the airports of a country by its German name', () => {
    expect(codes('Ägypten').length).toBeGreaterThan(0);
  });

  it('still ranks an exact IATA code first', () => {
    expect(codes('FRA')[0]).toBe('FRA');
  });
});
