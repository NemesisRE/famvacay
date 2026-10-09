import { describe, it, expect, vi } from 'vitest';
import { searchGlobalPlaces, GLOBAL_PLACES_CATALOG } from './places';

// Mock Redis caching so tests run in pure memory
vi.mock('../cache/redis', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(true),
}));

describe('Global Places Engine & Taxonomy Resolution', () => {
  it('covers major global leisure hubs and islands across all continents', () => {
    const ids = GLOBAL_PLACES_CATALOG.map((p) => p.id);
    // Asia-Pacific
    expect(ids).toContain('bali');
    expect(ids).toContain('denpasar');
    expect(ids).toContain('ko_samui');
    expect(ids).toContain('phuket');
    expect(ids).toContain('tokyo');
    expect(ids).toContain('sydney');

    // Americas
    expect(ids).toContain('cancun');
    expect(ids).toContain('honolulu');
    expect(ids).toContain('orlando');

    // Middle East & Africa
    expect(ids).toContain('dubai');
    expect(ids).toContain('hurghada_city');
    expect(ids).toContain('red_sea');
    expect(ids).toContain('cape_town');

    // Europe & Mediterranean
    expect(ids).toContain('mallorca');
    expect(ids).toContain('palma');
    expect(ids).toContain('tenerife');
    expect(ids).toContain('santorini');
  });

  it('correctly classifies entities into taxonomy categories', () => {
    const bali = GLOBAL_PLACES_CATALOG.find((p) => p.id === 'bali');
    expect(bali?.category).toBe('island');

    const denpasar = GLOBAL_PLACES_CATALOG.find((p) => p.id === 'denpasar');
    expect(denpasar?.category).toBe('city');
    expect(denpasar?.parentRegionId).toBe('bali');

    const australia = GLOBAL_PLACES_CATALOG.find((p) => p.id === 'australia');
    expect(australia?.category).toBe('country');

    const costaDelSol = GLOBAL_PLACES_CATALOG.find((p) => p.id === 'costa_del_sol');
    expect(costaDelSol?.category).toBe('region');
  });

  it('searches and autocompletes places worldwide with multilingual support', async () => {
    // Search in English
    const baliResults = await searchGlobalPlaces('Bali', 'en');
    expect(baliResults.length).toBeGreaterThan(0);
    expect(baliResults.some((p) => p.id === 'bali')).toBe(true);
    expect(baliResults.find((p) => p.id === 'bali')?.airportCodes).toContain('DPS');

    // Search in German
    const egyptResults = await searchGlobalPlaces('Ägypten', 'de');
    expect(egyptResults.length).toBeGreaterThan(0);
    expect(egyptResults.some((p) => p.id === 'egypt')).toBe(true);

    // Search international city
    const tokyoResults = await searchGlobalPlaces('Tokyo', 'en');
    expect(tokyoResults.length).toBeGreaterThan(0);
    expect(tokyoResults.some((p) => p.id === 'tokyo')).toBe(true);
  });
});
