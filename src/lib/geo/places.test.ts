import { describe, it, expect, vi } from 'vitest';
import { searchGlobalPlaces } from './places';

// Mock Redis caching so tests run in pure memory
vi.mock('../cache/redis', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(true),
}));

describe('Global Places Engine & Dynamic Geocoding Resolution', () => {
  it('searches and resolves places worldwide dynamically via runtime geocoding', async () => {
    // Dynamic search for Bali (island in Indonesia)
    const baliResults = await searchGlobalPlaces('Bali', 'en');
    expect(baliResults.length).toBeGreaterThan(0);
    const bali = baliResults[0];
    expect(bali.category).toBe('island');
    expect(bali.airportCodes).toContain('DPS');

    // Dynamic search for Mallorca
    const mallorcaResults = await searchGlobalPlaces('Mallorca', 'de');
    expect(mallorcaResults.length).toBeGreaterThan(0);
    const mallorca = mallorcaResults[0];
    expect(mallorca.airportCodes).toContain('PMI');

    // Dynamic search for international city Tokyo
    const tokyoResults = await searchGlobalPlaces('Tokyo', 'en');
    expect(tokyoResults.length).toBeGreaterThan(0);
    const tokyo = tokyoResults[0];
    expect(tokyo.category).toBe('city');
    expect(tokyo.airportCodes.length).toBeGreaterThan(0);

    // Multilingual country search in German (Ägypten)
    const egyptResults = await searchGlobalPlaces('Ägypten', 'de');
    expect(egyptResults.length).toBeGreaterThan(0);
    const egypt = egyptResults[0];
    expect(egypt.countryCode).toBe('EG');
  });

  it('resolves direct IATA commercial airports as dynamic entities', async () => {
    const pmiResults = await searchGlobalPlaces('PMI', 'en');
    expect(pmiResults.length).toBeGreaterThan(0);
    expect(pmiResults[0].category).toBe('airport');
    expect(pmiResults[0].airportCodes).toContain('PMI');

    const fraResults = await searchGlobalPlaces('FRA', 'en');
    expect(fraResults.length).toBeGreaterThan(0);
    expect(fraResults[0].category).toBe('airport');
    expect(fraResults[0].airportCodes).toContain('FRA');
  });
});
