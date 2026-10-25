import { describe, expect, it } from 'vitest';
import { hasDistinctClimate } from '../destinations';
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
