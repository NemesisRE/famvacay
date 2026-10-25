import { describe, expect, it } from 'vitest';
import { discoverDestinationsDynamically, hasDistinctClimate } from '../destinations';
import { getAirportByIata } from '../../airports/airport-service';

function place(code: string) {
  const airport = getAirportByIata(code);
  if (!airport) throw new Error(`unknown airport ${code}`);
  return { code, lat: airport.lat, lon: airport.lon };
}

describe('hasDistinctClimate', () => {
  it('separates regions of one country with a different monsoon, rainy season or altitude', () => {
    expect(hasDistinctClimate(place('BKK'), place('HKT'))).toBe(true); // Andaman coast, wettest Sep
    expect(hasDistinctClimate(place('HKT'), place('USM'))).toBe(true); // Gulf of Thailand, wettest Nov
    expect(hasDistinctClimate(place('BKK'), place('CNX'))).toBe(true); // northern highlands, cooler
  });

  it('treats resorts on the same stretch of coast as the same trip', () => {
    expect(hasDistinctClimate(place('HKT'), place('KBV'))).toBe(false); // Phuket / Krabi
    expect(hasDistinctClimate(place('HRG'), place('SSH'))).toBe(false); // Red Sea resorts
    expect(hasDistinctClimate(place('PMI'), place('IBZ'))).toBe(false); // Balearics
  });
});

describe('discoverDestinationsDynamically: climatically different regions', () => {
  const stuttgart = { departureLat: 48.78, departureLon: 9.18, travelVehicles: ['PLANE' as const] };

  it('offers more than one Thai destination for long-haul searches', () => {
    const codes = discoverDestinationsDynamically(['LONGRANGE'], stuttgart);
    expect(codes).toEqual(expect.arrayContaining(['BKK', 'HKT']));
  });

  it('adds extra regions only next to a climatically different pick of the same country', () => {
    const codes = discoverDestinationsDynamically(['LONGRANGE'], stuttgart);
    const byCountry = new Map<string, string[]>();
    for (const code of codes) {
      const country = getAirportByIata(code)?.country ?? '?';
      byCountry.set(country, [...(byCountry.get(country) ?? []), code]);
    }
    for (const [country, list] of byCountry) {
      if (['United States of America', 'United States', 'Canada', 'Australia'].includes(country)) continue;
      expect(list.length, country).toBeLessThanOrEqual(3);
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          expect(hasDistinctClimate(place(list[i]), place(list[j])), `${list[i]} / ${list[j]}`).toBe(true);
        }
      }
    }
  });
});
