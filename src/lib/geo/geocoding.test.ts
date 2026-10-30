import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { geocodeLocation, resolveLocationCoordinates } from './geocoding';
import { photonLanguage, resolveSubdivisionCode } from './photon';

vi.mock('@/lib/cache/redis', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(true),
}));

type Props = Record<string, unknown>;
const feature = (lat: number, lon: number, properties: Props) => ({ geometry: { coordinates: [lon, lat] }, properties });

/** Photon stand-in: answers by `lang`, records every requested URL */
function mockPhoton(byLang: Record<string, ReturnType<typeof feature>[]>) {
  const urls: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input);
      urls.push(url);
      return new Response(JSON.stringify({ features: byLang[url.searchParams.get('lang') || ''] ?? [] }));
    })
  );
  return urls;
}

const MUNICH = { osm_id: 62428, osm_key: 'place', osm_value: 'city', countrycode: 'DE' };

describe('Location autocomplete (Photon)', () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllGlobals());

  it('never queries Nominatim and honours PHOTON_API_URL', async () => {
    vi.stubEnv('PHOTON_API_URL', 'http://photon.internal:2322/api/');
    const urls = mockPhoton({ de: [feature(49.01, 8.4, { osm_id: 1, name: 'Karlsruhe', state: 'Baden-Württemberg', countrycode: 'DE' })] });

    const [karlsruhe] = await geocodeLocation('Karlsruhe', 'de');

    expect(karlsruhe).toMatchObject({ name: 'Karlsruhe', countryCode: 'DE', stateCode: 'DE-BW', lat: 49.01, lon: 8.4 });
    expect(urls).toHaveLength(1);
    expect(urls[0].origin + urls[0].pathname).toBe('http://photon.internal:2322/api');
    expect(urls.some((u) => u.hostname.includes('nominatim'))).toBe(false);
  });

  it('resolves the holiday region of localized results from the local names', async () => {
    const urls = mockPhoton({
      en: [feature(48.14, 11.58, { ...MUNICH, name: 'Munich', state: 'Bavaria' })],
      default: [feature(48.14, 11.58, { ...MUNICH, name: 'München', state: 'Bayern' })],
    });

    const [munich] = await geocodeLocation('Munich', 'en');

    // Shown in the interface language, region code from the second (local-name) request
    expect(munich).toMatchObject({ name: 'Munich', stateName: 'Bavaria', stateCode: 'DE-BY' });
    expect(urls.map((u) => u.searchParams.get('lang'))).toEqual(['en', 'default']);
  });

  it('treats a city-state as its own region, but not a village of the same name', async () => {
    mockPhoton({
      default: [
        feature(48.21, 16.37, { osm_id: 109166, osm_value: 'city', name: 'Wien', countrycode: 'AT' }),
        feature(48.3, 15.6, { osm_id: 5, osm_value: 'village', name: 'Wien', state: 'Niederösterreich', countrycode: 'AT' }),
      ],
    });

    const [vienna, village] = await geocodeLocation('Wien', 'es');

    expect(vienna.stateCode).toBe('AT-9');
    expect(village.stateCode).toBe('AT-3');
  });

  it('names postcode areas after code and town, biased towards the home country', async () => {
    const urls = mockPhoton({
      de: [
        feature(49.05, 8.42, {
          osm_id: 907169,
          osm_value: 'postcode',
          name: '76131',
          city: 'Karlsruhe',
          state: 'Baden-Württemberg',
          countrycode: 'DE',
        }),
      ],
    });

    const [area] = await geocodeLocation('76131', 'de', 'de');

    expect(area).toMatchObject({ name: '76131 Karlsruhe', postcode: '76131', city: 'Karlsruhe', stateCode: 'DE-BW' });
    expect(urls[0].searchParams.get('zoom')).toBe('5');
    // Somewhere in the middle of Germany
    expect(Number(urls[0].searchParams.get('lat'))).toBeGreaterThan(48);
    expect(Number(urls[0].searchParams.get('lat'))).toBeLessThan(53);
  });

  it('ignores an invalid country hint and returns nothing when Photon fails', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) => {
        urls.push(input);
        return new Response('down', { status: 503 });
      })
    );

    expect(await geocodeLocation('Berlin', 'de', 'not-a-country')).toEqual([]);
    expect(urls[0]).not.toContain('zoom=');
    expect(await resolveLocationCoordinates('Berlin')).toBeNull();
  });
});

describe('Photon helpers', () => {
  it('asks for names the public server has, local names otherwise', () => {
    expect(photonLanguage('de-AT')).toBe('de');
    expect(photonLanguage('fr')).toBe('fr');
    expect(photonLanguage('it')).toBe('default');
    expect(photonLanguage('es')).toBe('default');
    expect(photonLanguage('default')).toBe('default');
  });

  it('maps local subdivision names to ISO 3166-2 codes, never guesses', () => {
    expect(resolveSubdivisionCode('DE', 'Baden-Wurttemberg')).toBe('DE-BW');
    expect(resolveSubdivisionCode('ch', 'Zürich')).toBe('CH-ZH');
    expect(resolveSubdivisionCode('DE', 'Bavaria')).toBeUndefined();
    expect(resolveSubdivisionCode(undefined, 'Bayern')).toBeUndefined();
  });
});
