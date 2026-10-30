import { describe, it, expect, beforeEach } from 'vitest';
import { optimizeVacationWindows } from '../engine';
import { resolveDestinationCodes } from '../destinations';
import { getDestinationVacationStyles } from '../destination-styles';
import { setAdvisoryStore } from '../../safety/advisory-store';
import type { DestinationType, TripPlanInput } from '../types';

const origin = {
  departureLat: 49.0,
  departureLon: 8.4,
  country: 'DE',
  federalState: 'DE-BW',
  originAirports: ['FRA'],
  travelVehicles: ['PLANE' as const],
  earliestDate: '2027-01-10',
  latestDate: '2027-02-20',
};

const longRangeSearch = (extra: Partial<TripPlanInput> = {}): TripPlanInput => ({
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

describe('Long-range trip preferences', () => {
  beforeEach(() => setAdvisoryStore({ timestamp: Date.now(), entries: {} }));

  // The first test builds the long-haul catalog (cold caches): too slow for 5 s in a parallel run
  it('narrows long-haul discovery to the preferred kind of trip', () => {
    const any = resolveDestinationCodes(undefined, ['LONGRANGE'], origin);
    const beach = resolveDestinationCodes(undefined, ['LONGRANGE'], { ...origin, longRangeStyles: ['BEACH'] as DestinationType[] });
    const city = resolveDestinationCodes(undefined, ['LONGRANGE'], { ...origin, longRangeStyles: ['CITY'] as DestinationType[] });

    expect(beach.length).toBeGreaterThan(0);
    expect(city.length).toBeGreaterThan(0);
    expect(new Set(beach)).not.toEqual(new Set(city));
    // Preferences only narrow, never invent destinations outside the long-haul catalog
    const beachShare = beach.filter((c) => getDestinationVacationStyles(c).includes('BEACH')).length / beach.length;
    const anyShare = any.filter((c) => getDestinationVacationStyles(c).includes('BEACH')).length / any.length;
    expect(beachShare).toBeGreaterThanOrEqual(anyShare);
  }, 20000);

  it('applies the minimum temperature to long-haul beach destinations of a long-range-only search', () => {
    const hot = optimizeVacationWindows(longRangeSearch({ longRangeStyles: ['BEACH'], minBeachTemp: 30 }), {}, {});
    expect(hot.length).toBeGreaterThan(0);
    for (const w of hot) {
      if (getDestinationVacationStyles(w.destinationAirport).includes('BEACH')) {
        expect(w.weather.maxTempC ?? w.weather.avgTempC).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it('only treats places with beach weather in the travel month as long-haul beach trips', () => {
    const beach = optimizeVacationWindows(longRangeSearch({ longRangeStyles: ['BEACH'] }), {}, {});
    const cities = new Set(beach.map((w) => w.destinationAirport));
    // January: New York / Providence / Oakland are coastal but not beach destinations
    for (const cold of ['LGA', 'JFK', 'PVD', 'OAK']) expect(cities.has(cold)).toBe(false);
  });

  it('does not apply beach temperatures when the long-range preference excludes beaches', () => {
    const cityOnly = optimizeVacationWindows(longRangeSearch({ longRangeStyles: ['CITY'] }), {}, {});
    const cityOnlyWithTemp = optimizeVacationWindows(longRangeSearch({ longRangeStyles: ['CITY'], minBeachTemp: 30 }), {}, {});
    expect(cityOnlyWithTemp.length).toBe(cityOnly.length);
  });

  it('applies the snow guarantee to long-haul alpine destinations', () => {
    const withoutSnow = optimizeVacationWindows(longRangeSearch({ longRangeStyles: ['ALPINE'] }), {}, {});
    const withSnow = optimizeVacationWindows(longRangeSearch({ longRangeStyles: ['ALPINE'], requireSnow: true }), {}, {});
    expect(withSnow.length).toBeLessThanOrEqual(withoutSnow.length);
    for (const w of withSnow) {
      if (getDestinationVacationStyles(w.destinationAirport).includes('ALPINE')) {
        expect(w.weather.avgTempC <= 3 || (w.weather.minTempC ?? 99) <= 0).toBe(true);
      }
    }
  });
});
