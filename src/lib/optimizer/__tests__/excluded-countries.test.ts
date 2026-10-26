import { describe, it, expect, beforeEach } from 'vitest';
import { optimizeVacationWindows } from '../engine';
import { resolveDestinationCodes } from '../destinations';
import { getDestinationPoint } from '../../geo/destination-points';
import { getCountriesBlockedFromDiscovery, setAdvisoryStore } from '../../safety/advisory-store';
import type { DestinationType, TravelVehicle, TripPlanInput } from '../types';

const origin = {
  departureLat: 49.0,
  departureLon: 8.4,
  country: 'DE',
  federalState: 'DE-BW',
  originAirports: ['FRA'],
  travelVehicles: ['PLANE'] as TravelVehicle[],
  earliestDate: '2027-07-01',
  latestDate: '2027-08-31',
};

const countryOf = (code: string) => getDestinationPoint(code)?.state?.split('-')[0];

function mostFrequentCountry(codes: string[]): string {
  const counts = new Map<string, number>();
  for (const c of codes) {
    const country = countryOf(c);
    if (country) counts.set(country, (counts.get(country) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

describe('Excluded countries in open discovery', () => {
  beforeEach(() => setAdvisoryStore({ timestamp: Date.now(), entries: {} }));

  it('drops the countries and refills their slots with other destinations', () => {
    const types: DestinationType[] = ['ALL'];
    const baseline = resolveDestinationCodes(undefined, types, origin);
    const excluded = mostFrequentCountry(baseline);
    const filtered = resolveDestinationCodes(undefined, types, { ...origin, excludedCountries: [excluded.toLowerCase()] });

    expect(baseline.some((c) => countryOf(c) === excluded)).toBe(true);
    expect(filtered.some((c) => countryOf(c) === excluded)).toBe(false);
    expect(filtered.length).toBe(baseline.length);
  });

  it('applies to overland discovery too', () => {
    const overland = { ...origin, travelVehicles: ['CAR'] as TravelVehicle[] };
    const baseline = resolveDestinationCodes(undefined, ['ALL'], overland);
    const excluded = mostFrequentCountry(baseline);
    const filtered = resolveDestinationCodes(undefined, ['ALL'], { ...overland, excludedCountries: [excluded] });

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((c) => countryOf(c) === excluded)).toBe(false);
  });

  it('never overrides destinations the user named explicitly', () => {
    const named = resolveDestinationCodes(['Spain'], ['ALL'], { ...origin, excludedCountries: ['ES'] });
    expect(named.length).toBeGreaterThan(0);
    expect(named.every((c) => countryOf(c) === 'ES')).toBe(true);
  });

  it('lists the countries the safety filter already leaves out of discovery', () => {
    const entry = (isoCode: string, usStateDeptLevel: 1 | 2 | 3 | 4, isSafeForFamilies: boolean, hasGermanWarning = false) => ({
      isoCode, countryName: isoCode, hasGermanWarning, hasGermanPartialWarning: false, usStateDeptLevel, isSafeForFamilies, safetyScore: 50,
    });
    setAdvisoryStore({
      timestamp: Date.now(),
      entries: { ES: entry('ES', 2, true), MX: entry('MX', 3, false), RU: entry('RU', 4, false, true), EG: entry('EG', 2, true, true) },
    });
    expect(getCountriesBlockedFromDiscovery()).toEqual(['EG', 'MX', 'RU']);
  });

  it('keeps excluded countries out of the optimizer results', () => {
    const search = (extra: Partial<TripPlanInput> = {}): TripPlanInput => ({
      destinationTypes: ['LONGRANGE'],
      durationDays: 14,
      earliestDate: '2027-01-10',
      latestDate: '2027-01-31',
      travelVehicles: ['PLANE'],
      maxWindowsPerDestination: 0,
      userProfile: {
        homeLocation: 'Karlsruhe',
        departureLat: 49.0,
        departureLon: 8.4,
        federalState: 'DE-BW',
        originAirports: ['FRA'],
        childrenAges: [],
        blackoutRanges: [],
      },
      ...extra,
    });
    const baseline = optimizeVacationWindows(search(), {}, {});
    const excluded = mostFrequentCountry(baseline.map((w) => w.destinationAirport));
    const filtered = optimizeVacationWindows(search({ excludedCountries: [excluded] }), {}, {});

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((w) => countryOf(w.destinationAirport) === excluded)).toBe(false);
  });
});
