import { describe, it, expect } from 'vitest';
import {
  COUNTRIES,
  getCountryCodeFromSubdivision,
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
    // Bangkok in July (monthIndex 6) has Monsoon warning
    const bkkWarning = getDestinationSeasonalWarning('BKK', 6);
    expect(bkkWarning).not.toBeNull();
    expect(bkkWarning?.seasonType).toBe('MONSOON');

    // Bangkok in December (monthIndex 11) is cool and dry, no warning
    expect(getDestinationSeasonalWarning('BKK', 11)).toBeNull();

    // Dubai in July (monthIndex 6) has Extreme Heat warning
    const dxbWarning = getDestinationSeasonalWarning('DXB', 6);
    expect(dxbWarning).not.toBeNull();
    expect(dxbWarning?.seasonType).toBe('EXTREME_HEAT');

    // Tokyo in April (monthIndex 3) has Overcrowded Peak warning
    const hndWarning = getDestinationSeasonalWarning('HND', 3);
    expect(hndWarning).not.toBeNull();
    expect(hndWarning?.seasonType).toBe('OVERCROWDED_PEAK');

    // Unknown or standard beach destinations like PMI return null
    expect(getDestinationSeasonalWarning('PMI', 6)).toBeNull();
  });
});

