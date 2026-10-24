import { describe, it, expect } from 'vitest';
import {
  COUNTRIES,
  getCountryCodeFromSubdivision,
  getAllCountries,
  getLocalizedCountryName,
} from './subdivisions';
import { getRecommendedAirportsForRegion } from '../airports/airports-db';
import { getDestinationSeasonalWarning } from '../optimizer/weather';

describe('Regions, Subdivisions & Airport Proximity', () => {
  it('contains all 16 German federal states', () => {
    const deSubdivisions = COUNTRIES['DE'].subdivisions;
    expect(deSubdivisions).toHaveLength(16);
    const codes = deSubdivisions.map((s) => s.code);
    expect(codes).toContain('DE-BW');
    expect(codes).toContain('DE-BY');
    expect(codes).toContain('DE-BE');
    expect(codes).toContain('DE-BB');
    expect(codes).toContain('DE-HB');
    expect(codes).toContain('DE-HH');
    expect(codes).toContain('DE-HE');
    expect(codes).toContain('DE-MV');
    expect(codes).toContain('DE-NI');
    expect(codes).toContain('DE-NW');
    expect(codes).toContain('DE-RP');
    expect(codes).toContain('DE-SL');
    expect(codes).toContain('DE-SN');
    expect(codes).toContain('DE-ST');
    expect(codes).toContain('DE-SH');
    expect(codes).toContain('DE-TH');
  });

  it('supports key international countries (AT, CH, FR, ES, IT)', () => {
    expect(COUNTRIES['AT'].subdivisions.length).toBeGreaterThan(0);
    expect(COUNTRIES['CH'].subdivisions.length).toBeGreaterThan(0);
    expect(COUNTRIES['FR'].subdivisions.length).toBeGreaterThan(0);
    expect(COUNTRIES['ES'].subdivisions.length).toBeGreaterThan(0);
    expect(COUNTRIES['IT'].subdivisions.length).toBeGreaterThan(0);
  });

  it('correctly maps subdivision codes to country codes', () => {
    expect(getCountryCodeFromSubdivision('DE-BW')).toBe('DE');
    expect(getCountryCodeFromSubdivision('AT-9')).toBe('AT');
    expect(getCountryCodeFromSubdivision('CH-ZH')).toBe('CH');
    expect(getCountryCodeFromSubdivision('FR-IDF')).toBe('FR');
    expect(getCountryCodeFromSubdivision('ES-MD')).toBe('ES');
    expect(getCountryCodeFromSubdivision('IT-LOM')).toBe('IT');
  });

  it('recommends departure airports sorted by proximity for a given region', () => {
    const bwAirports = getRecommendedAirportsForRegion('DE-BW');
    expect(bwAirports.length).toBeGreaterThanOrEqual(4);
    // Closest airport to DE-BW center should be STR
    expect(bwAirports[0].code).toBe('STR');
    expect(bwAirports[0].distanceKm).toBeLessThan(50);

    const bayernAirports = getRecommendedAirportsForRegion('DE-BY');
    const bayernCodes = bayernAirports.map((a) => a.code);
    expect(bayernCodes).toContain('MUC');
    expect(bayernCodes).toContain('NUE');
  });

  it('evaluates destination seasonal constraints and warnings accurately', () => {
    // Bangkok in July (monthIndex 6) is noticeably rainier than usual but not yet the peak -
    // the milder RAINY_SEASON tier, not the full MONSOON severity
    const bkkWarning = getDestinationSeasonalWarning('BKK', 6);
    expect(bkkWarning).not.toBeNull();
    expect(bkkWarning?.seasonType).toBe('RAINY_SEASON');

    // Bangkok in September (monthIndex 8), the actual peak of Thailand's rainy season: heavy,
    // near-constant downpours - the severe MONSOON tier
    const bkkPeakWarning = getDestinationSeasonalWarning('BKK', 8);
    expect(bkkPeakWarning?.seasonType).toBe('MONSOON');

    // Bangkok in December (monthIndex 11) is cool and dry, no warning
    expect(getDestinationSeasonalWarning('BKK', 11)).toBeNull();

    // Dubai in July (monthIndex 6) has Extreme Heat warning
    const dxbWarning = getDestinationSeasonalWarning('DXB', 6);
    expect(dxbWarning).not.toBeNull();
    expect(dxbWarning?.seasonType).toBe('EXTREME_HEAT');

    // Tokyo in April (monthIndex 3) has Overcrowded Peak warning (Cherry blossom / Golden Week)
    const hndWarning = getDestinationSeasonalWarning('HND', 3);
    expect(hndWarning).not.toBeNull();
    expect(hndWarning?.seasonType).toBe('OVERCROWDED_PEAK');

    // Rio de Janeiro during Carnival (February, monthIndex 1) has Overcrowded Peak warning
    const rioWarning = getDestinationSeasonalWarning('GIG', 1);
    expect(rioWarning).not.toBeNull();
    expect(rioWarning?.seasonType).toBe('OVERCROWDED_PEAK');
    expect(rioWarning?.eventName).toContain('Carnival');

    // Venice during Carnevale (February, monthIndex 1) has Overcrowded Peak warning
    const vceWarning = getDestinationSeasonalWarning('VCE', 1);
    expect(vceWarning).not.toBeNull();
    expect(vceWarning?.seasonType).toBe('OVERCROWDED_PEAK');

    // Munich during Oktoberfest (September, monthIndex 8) has Overcrowded Peak warning
    const mucWarning = getDestinationSeasonalWarning('MUC', 8);
    expect(mucWarning).not.toBeNull();
    expect(mucWarning?.seasonType).toBe('OVERCROWDED_PEAK');
    expect(mucWarning?.eventName).toContain('Oktoberfest');

    // Bangkok during Songkran Festival (April, monthIndex 3) has Overcrowded Peak warning
    const songkranWarning = getDestinationSeasonalWarning('BKK', 3);
    expect(songkranWarning).not.toBeNull();
    expect(songkranWarning?.seasonType).toBe('OVERCROWDED_PEAK');

    // Standard Mediterranean beach destination in July like PMI returns null (normal family travel)
    expect(getDestinationSeasonalWarning('PMI', 6)).toBeNull();
  });

  it('allows enumerating all 249 ISO countries via Object.values and getAllCountries', () => {
    const listFromValues = Object.values(COUNTRIES);
    expect(listFromValues.length).toBeGreaterThanOrEqual(240);
    expect(listFromValues.some((c) => c.code === 'DE' && c.name === 'Germany')).toBe(true);

    const listFromHelper = getAllCountries();
    expect(listFromHelper.length).toBeGreaterThanOrEqual(240);
    expect(listFromHelper.some((c) => c.code === 'FR' && c.name === 'France')).toBe(true);
    expect(listFromHelper.some((c) => c.code === 'US')).toBe(true);
  });

  it('supports i18n country names across de, fr, es, it and en', () => {
    expect(getLocalizedCountryName('DE', 'de')).toBe('Deutschland');
    expect(getLocalizedCountryName('DE', 'en')).toBe('Germany');
    expect(getLocalizedCountryName('DE', 'fr')).toBe('Allemagne');
    expect(getLocalizedCountryName('DE', 'es')).toBe('Alemania');
    expect(getLocalizedCountryName('DE', 'it')).toBe('Germania');

    expect(getLocalizedCountryName('ES', 'de')).toBe('Spanien');
    expect(getLocalizedCountryName('AT', 'de')).toBe('Österreich');
    expect(getLocalizedCountryName('CH', 'de')).toBe('Schweiz');

    const germanCountries = getAllCountries('de');
    const deEntry = germanCountries.find((c) => c.code === 'DE');
    expect(deEntry?.name).toBe('Deutschland');

    const frenchCountries = getAllCountries('fr');
    const frEntry = frenchCountries.find((c) => c.code === 'DE');
    expect(frEntry?.name).toBe('Allemagne');
  });
});

