import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchGlobalPlaces } from './places';

// Mock Redis caching so tests run in pure memory
vi.mock('../cache/redis', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(true),
}));

const feature = (lat: number, lon: number, properties: Record<string, unknown>) => ({
  geometry: { coordinates: [lon, lat] },
  properties,
});

/** Photon stand-in answering by query text; records the requested URLs */
function mockPhoton(byQuery: Record<string, ReturnType<typeof feature>[]>) {
  const urls: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input);
      urls.push(url);
      return new Response(JSON.stringify({ features: byQuery[url.searchParams.get('q') || ''] ?? [] }));
    })
  );
  return urls;
}

describe('Global Places Engine & Dynamic Geocoding Resolution', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('categorizes islands, regions, countries and cities and attaches their airports', async () => {
    const urls = mockPhoton({
      Mallorca: [feature(39.61, 2.99, { name: 'Mallorca', osm_key: 'place', osm_value: 'island', countrycode: 'ES', country: 'Spanien' })],
      Bali: [
        feature(-8.34, 115.09, { name: 'Bali', osm_key: 'place', osm_value: 'state', type: 'state', countrycode: 'ID' }),
        feature(-8.45, 115.17, { name: 'Bali Island', osm_key: 'place', osm_value: 'island', countrycode: 'ID' }),
      ],
      Ägypten: [feature(26.25, 29.27, { name: 'Ägypten', osm_key: 'place', osm_value: 'country', type: 'country', countrycode: 'EG', country: 'Ägypten' })],
      Hurghada: [feature(27.26, 33.81, { name: 'Hurghada', osm_key: 'place', osm_value: 'city', type: 'city', countrycode: 'EG' })],
    });

    const [mallorca] = await searchGlobalPlaces('Mallorca', 'de');
    expect(mallorca).toMatchObject({ category: 'island', countryCode: 'ES' });
    expect(mallorca.airportCodes).toContain('PMI');

    const bali = await searchGlobalPlaces('Bali', 'en');
    expect(bali.map((b) => b.category)).toEqual(['region', 'island']);
    expect(bali[0].airportCodes).toContain('DPS');

    const [egypt] = await searchGlobalPlaces('Ägypten', 'de');
    expect(egypt).toMatchObject({ category: 'country', countryCode: 'EG' });
    expect(egypt.names.en).toBe('Egypt');

    const [hurghada] = await searchGlobalPlaces('Hurghada', 'it');
    expect(hurghada).toMatchObject({ category: 'city', airportCodes: ['HRG'] });

    // Photon only, in the interface language where the public server has it
    expect(urls.every((u) => u.hostname === 'photon.komoot.io')).toBe(true);
    expect(urls.find((u) => u.searchParams.get('q') === 'Hurghada')?.searchParams.get('lang')).toBe('default');
  });

  it('drops businesses and hamlets that merely carry the name', async () => {
    mockPhoton({
      Tokyo: [
        feature(35.68, 139.69, { name: 'Tokyo', osm_key: 'place', osm_value: 'province', countrycode: 'JP' }),
        feature(35.68, 139.74, { name: 'TOKYO-FM', osm_key: 'amenity', osm_value: 'studio', countrycode: 'JP' }),
        feature(50.1, 8.6, { name: 'Tokyo', osm_key: 'amenity', osm_value: 'restaurant', countrycode: 'DE' }),
        feature(51.2, 10.1, { name: 'Tokyo Hof', osm_key: 'place', osm_value: 'hamlet', countrycode: 'DE' }),
      ],
    });

    const results = await searchGlobalPlaces('Tokyo', 'en');
    expect(results).toHaveLength(1);
    expect(results[0].countryCode).toBe('JP');
    expect(results[0].airportCodes).toContain('HND');
  });

  it('resolves direct IATA commercial airports as dynamic entities', async () => {
    mockPhoton({});
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
