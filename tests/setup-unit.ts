/**
 * Test Infrastructure Setup: Deterministic Mocks for Unit & Integration Tests
 * Per Master Prompt §14: "Tests never depend on live third-party APIs."
 * Mocks live exclusively in test infrastructure, never in application source code.
 */

import { beforeAll, afterAll } from 'vitest';

const originalFetch = global.fetch;

beforeAll(() => {
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // 1. Nominatim Geocoding Mock
    if (urlStr.includes('nominatim.openstreetmap.org')) {
      const parsedUrl = new URL(urlStr);
      const rawQ = (parsedUrl.searchParams.get('q') || '').toLowerCase();
      const q = rawQ.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      let mockData: any[] = [];

      if (q.includes('mars') || q.includes('atlantis')) {
        mockData = [];
      } else if (q.includes('karlsruhe')) {
        mockData = [
          {
            name: 'Karlsruhe',
            display_name: 'Karlsruhe, Baden-Württemberg, Germany',
            lat: '49.0069',
            lon: '8.4037',
            address: {
              city: 'Karlsruhe',
              country_code: 'de',
              'ISO3166-2-lvl4': 'DE-BW',
              state: 'Baden-Württemberg',
            },
          },
        ];
      } else if (q.includes('sydney')) {
        mockData = [
          {
            name: 'Sydney',
            display_name: 'Sydney, New South Wales, Australia',
            lat: '-33.8688',
            lon: '151.2093',
            address: {
              city: 'Sydney',
              country_code: 'au',
              state: 'New South Wales',
            },
          },
        ];
      } else if (q.includes('paris')) {
        mockData = [
          {
            name: 'Paris',
            display_name: 'Paris, Île-de-France, France',
            lat: '48.8566',
            lon: '2.3522',
            address: {
              city: 'Paris',
              country_code: 'fr',
              'ISO3166-2-lvl4': 'FR-IDF',
              state: 'Île-de-France',
            },
          },
        ];
      } else if (q.includes('berlin')) {
        mockData = [
          {
            name: 'Berlin',
            display_name: 'Berlin, Germany',
            lat: '52.5200',
            lon: '13.4050',
            address: {
              city: 'Berlin',
              country_code: 'de',
              'ISO3166-2-lvl4': 'DE-BE',
              state: 'Berlin',
            },
          },
        ];
      } else if (q.includes('mallorca')) {
        mockData = [
          {
            name: 'Mallorca',
            display_name: 'Mallorca, Illes Balears, Spain',
            lat: '39.5517',
            lon: '2.7388',
            type: 'island',
            address: {
              island: 'Mallorca',
              state: 'Illes Balears',
              country_code: 'es',
              'ISO3166-2-lvl4': 'ES-IB',
            },
          },
        ];
      } else if (q.includes('athen')) {
        mockData = [
          {
            name: 'Athens',
            display_name: 'Athens, Attica, Greece',
            lat: '37.9838',
            lon: '23.7275',
            type: 'city',
            address: {
              city: 'Athens',
              state: 'Attica',
              country_code: 'gr',
              'ISO3166-2-lvl4': 'GR-I',
            },
          },
        ];
      } else if (q.includes('agypten') || q.includes('egypt')) {
        mockData = [
          {
            name: 'Egypt',
            display_name: 'Egypt',
            lat: '26.8206',
            lon: '30.8025',
            type: 'country',
            address: {
              country: 'Egypt',
              country_code: 'eg',
            },
          },
        ];
      } else if (q.includes('dubai')) {
        mockData = [
          {
            name: 'Dubai',
            display_name: 'Dubai, United Arab Emirates',
            lat: '25.2048',
            lon: '55.2708',
            type: 'city',
            address: {
              city: 'Dubai',
              state: 'Dubai',
              country_code: 'ae',
            },
          },
        ];
      } else if (q.includes('hurghada') || q.includes('rotes meer') || q.includes('red sea')) {
        mockData = [
          {
            name: 'Hurghada',
            display_name: 'Hurghada, Red Sea Governorate, Egypt',
            lat: '27.2579',
            lon: '33.8116',
            type: 'city',
            address: {
              city: 'Hurghada',
              state: 'Red Sea',
              country_code: 'eg',
            },
          },
        ];
      } else if (q.includes('bali')) {
        mockData = [
          {
            name: 'Bali',
            display_name: 'Bali, Indonesia',
            lat: '-8.4095',
            lon: '115.1889',
            type: 'island',
            address: {
              island: 'Bali',
              country_code: 'id',
            },
          },
        ];
      } else if (q.includes('tokyo') || q.includes('tokio')) {
        mockData = [
          {
            name: 'Tokyo',
            display_name: 'Tokyo, Japan',
            lat: '35.6762',
            lon: '139.6503',
            type: 'city',
            address: {
              city: 'Tokyo',
              country_code: 'jp',
            },
          },
        ];
      } else if (q.includes('kreta') || q.includes('crete')) {
        mockData = [
          {
            name: 'Kreta',
            display_name: 'Kreta, Region Kreta, Griechenland',
            lat: '35.3084',
            lon: '24.4633',
            type: 'island',
            address: {
              island: 'Kreta',
              state: 'Region Kreta',
              country: 'Griechenland',
              country_code: 'gr',
              'ISO3166-2-lvl5': 'GR-M',
            },
          },
        ];
      } else if (q.includes('algarve') || q.includes('faro')) {
        mockData = [
          {
            name: 'Algarve',
            display_name: 'Algarve, Faro, Portugal',
            lat: '37.1928',
            lon: '-8.2632',
            type: 'region',
            class: 'boundary',
            address: {
              state: 'Algarve',
              country: 'Portugal',
              country_code: 'pt',
              'ISO3166-2-lvl4': 'PT-08',
            },
          },
        ];
      }

      return new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Photon Geocoding Mock
    if (urlStr.includes('photon.komoot.io')) {
      const parsedUrl = new URL(urlStr);
      const rawQ = (parsedUrl.searchParams.get('q') || '').toLowerCase();
      const q = rawQ.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      let features: any[] = [];
      if (!q.includes('mars') && !q.includes('atlantis')) {
        let coords = [13.4050, 52.5200];
        let country = 'Germany';
        let countryCode = 'DE';

        if (q.includes('sydney')) {
          coords = [151.2093, -33.8688];
          country = 'Australia';
          countryCode = 'AU';
        } else if (q.includes('paris')) {
          coords = [2.3522, 48.8566];
          country = 'France';
          countryCode = 'FR';
        } else if (q.includes('karlsruhe')) {
          coords = [8.4037, 49.0069];
        } else if (q.includes('athen')) {
          coords = [23.7275, 37.9838];
          country = 'Greece';
          countryCode = 'GR';
        } else if (q.includes('kreta') || q.includes('crete')) {
          coords = [24.4633, 35.3084];
          country = 'Greece';
          countryCode = 'GR';
        } else if (q.includes('algarve')) {
          coords = [-8.2632, 37.1928];
          country = 'Portugal';
          countryCode = 'PT';
        }

        features = [
          {
            type: 'Feature',
            geometry: { coordinates: coords },
            properties: {
              name: rawQ,
              city: rawQ,
              country,
              countrycode: countryCode,
            },
          },
        ];
      }

      return new Response(JSON.stringify({ features }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. OpenHolidays API Mock
    if (urlStr.includes('openholidaysapi.org')) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Open-Meteo Archive API Mock
    if (urlStr.includes('archive-api.open-meteo.com')) {
      return new Response(
        JSON.stringify({
          daily: {
            temperature_2m_max: [28, 29, 30, 27, 28],
            temperature_2m_min: [20, 21, 20, 19, 20],
            precipitation_sum: [0, 0, 2.5, 0, 0],
            sunshine_duration: [36000, 38000, 35000, 36000, 37000],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return originalFetch(input, init);
  };
});

afterAll(() => {
  global.fetch = originalFetch;
});
