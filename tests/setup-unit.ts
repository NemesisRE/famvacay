/**
 * Test Infrastructure Setup: Deterministic Mocks for Unit & Integration Tests
 * Per Master Prompt §14: "Tests never depend on live third-party APIs."
 * Mocks live exclusively in test infrastructure, never in application source code.
 */

import { beforeAll, afterAll } from 'vitest';

const originalFetch = global.fetch;

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
      } else if (q.includes('munich') || q.includes('munch')) {
        mockData = [
          {
            name: 'Munich',
            display_name: 'Munich, Bavaria, Germany',
            lat: '48.1351',
            lon: '11.5820',
            type: 'city',
            address: {
              city: 'Munich',
              country_code: 'de',
              'ISO3166-2-lvl4': 'DE-BY',
              state: 'Bavaria',
            },
          },
        ];
      } else if (q.includes('vienna') || q.includes('wien')) {
        mockData = [
          {
            name: 'Vienna',
            display_name: 'Vienna, Austria',
            lat: '48.2082',
            lon: '16.3738',
            type: 'city',
            address: {
              city: 'Vienna',
              country_code: 'at',
              'ISO3166-2-lvl4': 'AT-9',
              state: 'Wien',
            },
          },
        ];
      } else if (q.includes('rome') || q === 'rom' || q.includes('roma')) {
        mockData = [
          {
            name: 'Rome',
            display_name: 'Rome, Lazio, Italy',
            lat: '41.9028',
            lon: '12.4964',
            type: 'city',
            address: {
              city: 'Rome',
              country_code: 'it',
              'ISO3166-2-lvl4': 'IT-62',
              state: 'Lazio',
            },
          },
        ];
      } else if (q.includes('prague') || q.includes('prag') || q.includes('praha')) {
        mockData = [
          {
            name: 'Prague',
            display_name: 'Prague, Czech Republic',
            lat: '50.0755',
            lon: '14.4378',
            type: 'city',
            address: {
              city: 'Prague',
              country_code: 'cz',
              state: 'Prague',
            },
          },
        ];
      } else if (q.includes('lisbon') || q.includes('lissabon') || q.includes('lisboa')) {
        mockData = [
          {
            name: 'Lisbon',
            display_name: 'Lisbon, Portugal',
            lat: '38.7223',
            lon: '-9.1393',
            type: 'city',
            address: {
              city: 'Lisbon',
              country_code: 'pt',
              'ISO3166-2-lvl4': 'PT-11',
              state: 'Lisboa',
            },
          },
        ];
      } else if (q.includes('mallorca')) {
        mockData = [
          {
            name: 'Mallorca (Balearen)',
            display_name: 'Mallorca (Balearen), Illes Balears, Spain',
            lat: '39.5517',
            lon: '2.7388',
            type: 'region',
            address: {
              region: 'Mallorca (Balearen)',
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
            name: 'Hurghada & Rotes Meer',
            display_name: 'Hurghada & Rotes Meer, Red Sea Governorate, Egypt',
            lat: '27.2579',
            lon: '33.8116',
            type: 'region',
            address: {
              region: 'Hurghada & Rotes Meer',
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
        } else if (q.includes('munich') || q.includes('munch')) {
          coords = [11.5820, 48.1351];
          country = 'Germany';
          countryCode = 'DE';
        } else if (q.includes('vienna') || q.includes('wien')) {
          coords = [16.3738, 48.2082];
          country = 'Austria';
          countryCode = 'AT';
        } else if (q.includes('rome') || q === 'rom' || q.includes('roma')) {
          coords = [12.4964, 41.9028];
          country = 'Italy';
          countryCode = 'IT';
        } else if (q.includes('prague') || q.includes('prag') || q.includes('praha')) {
          coords = [14.4378, 50.0755];
          country = 'Czech Republic';
          countryCode = 'CZ';
        } else if (q.includes('lisbon') || q.includes('lissabon') || q.includes('lisboa')) {
          coords = [-9.1393, 38.7223];
          country = 'Portugal';
          countryCode = 'PT';
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

    // 5. Auswärtiges Amt (German Foreign Office) Travel Warnings Mock
    if (urlStr.includes('auswaertiges-amt.de')) {
      const mockAa: Record<string, any> = {
        DE: { countryCode: 'DE', countryName: 'Deutschland', warning: false },
        ES: { countryCode: 'ES', countryName: 'Spanien', warning: false },
        AT: { countryCode: 'AT', countryName: 'Österreich', warning: false },
        CH: { countryCode: 'CH', countryName: 'Schweiz', warning: false },
        IT: { countryCode: 'IT', countryName: 'Italien', warning: false },
        FR: { countryCode: 'FR', countryName: 'Frankreich', warning: false },
        PT: { countryCode: 'PT', countryName: 'Portugal', warning: false },
        GR: { countryCode: 'GR', countryName: 'Griechenland', warning: false },
        HR: { countryCode: 'HR', countryName: 'Kroatien', warning: false },
        NL: { countryCode: 'NL', countryName: 'Niederlande', warning: false },
        BE: { countryCode: 'BE', countryName: 'Belgien', warning: false },
        LU: { countryCode: 'LU', countryName: 'Luxemburg', warning: false },
        GB: { countryCode: 'GB', countryName: 'Vereinigtes Königreich', warning: false },
        IE: { countryCode: 'IE', countryName: 'Irland', warning: false },
        DK: { countryCode: 'DK', countryName: 'Dänemark', warning: false },
        NO: { countryCode: 'NO', countryName: 'Norwegen', warning: false },
        SE: { countryCode: 'SE', countryName: 'Schweden', warning: false },
        FI: { countryCode: 'FI', countryName: 'Finnland', warning: false },
        IS: { countryCode: 'IS', countryName: 'Island', warning: false },
        PL: { countryCode: 'PL', countryName: 'Polen', warning: false },
        CZ: { countryCode: 'CZ', countryName: 'Tschechien', warning: false },
        SK: { countryCode: 'SK', countryName: 'Slowakei', warning: false },
        HU: { countryCode: 'HU', countryName: 'Ungarn', warning: false },
        SI: { countryCode: 'SI', countryName: 'Slowenien', warning: false },
        RO: { countryCode: 'RO', countryName: 'Rumänien', warning: false },
        BG: { countryCode: 'BG', countryName: 'Bulgarien', warning: false },
        CY: { countryCode: 'CY', countryName: 'Zypern', warning: false },
        MT: { countryCode: 'MT', countryName: 'Malta', warning: false },
        EE: { countryCode: 'EE', countryName: 'Estland', warning: false },
        LV: { countryCode: 'LV', countryName: 'Lettland', warning: false },
        LT: { countryCode: 'LT', countryName: 'Litauen', warning: false },
        JP: { countryCode: 'JP', countryName: 'Japan', warning: false },
        KR: { countryCode: 'KR', countryName: 'Südkorea', warning: false },
        TH: { countryCode: 'TH', countryName: 'Thailand', warning: false },
        VN: { countryCode: 'VN', countryName: 'Vietnam', warning: false },
        ID: { countryCode: 'ID', countryName: 'Indonesien', warning: false },
        SG: { countryCode: 'SG', countryName: 'Singapur', warning: false },
        MY: { countryCode: 'MY', countryName: 'Malaysia', warning: false },
        AU: { countryCode: 'AU', countryName: 'Australien', warning: false },
        NZ: { countryCode: 'NZ', countryName: 'Neuseeland', warning: false },
        US: { countryCode: 'US', countryName: 'Vereinigte Staaten', warning: false },
        CA: { countryCode: 'CA', countryName: 'Kanada', warning: false },
        MX: { countryCode: 'MX', countryName: 'Mexiko', warning: false },
        CR: { countryCode: 'CR', countryName: 'Costa Rica', warning: false },
        DO: { countryCode: 'DO', countryName: 'Dominikanische Republik', warning: false },
        BS: { countryCode: 'BS', countryName: 'Bahamas', warning: false },
        ZA: { countryCode: 'ZA', countryName: 'Südafrika', warning: false },
        MU: { countryCode: 'MU', countryName: 'Mauritius', warning: false },
        SC: { countryCode: 'SC', countryName: 'Seychellen', warning: false },
        MV: { countryCode: 'MV', countryName: 'Malediven', warning: false },
        AE: { countryCode: 'AE', countryName: 'Vereinigte Arabische Emirate', warning: false, partialWarning: true },
        EG: { countryCode: 'EG', countryName: 'Ägypten', warning: false, partialWarning: true },
        TR: { countryCode: 'TR', countryName: 'Türkei', warning: false, partialWarning: true },
        TN: { countryCode: 'TN', countryName: 'Tunesien', warning: false, partialWarning: true },
        MA: { countryCode: 'MA', countryName: 'Marokko', warning: false, partialWarning: true },
        JO: { countryCode: 'JO', countryName: 'Jordanien', warning: false, partialWarning: true },
        OM: { countryCode: 'OM', countryName: 'Oman', warning: false },
        QA: { countryCode: 'QA', countryName: 'Katar', warning: false },
        UA: { countryCode: 'UA', countryName: 'Ukraine', warning: true },
        RU: { countryCode: 'RU', countryName: 'Russland', warning: true },
        BY: { countryCode: 'BY', countryName: 'Belarus', warning: true },
        SY: { countryCode: 'SY', countryName: 'Syrien', warning: true },
        YE: { countryCode: 'YE', countryName: 'Jemen', warning: true },
        AF: { countryCode: 'AF', countryName: 'Afghanistan', warning: true },
        IQ: { countryCode: 'IQ', countryName: 'Irak', warning: true },
        IR: { countryCode: 'IR', countryName: 'Iran', warning: true },
        SO: { countryCode: 'SO', countryName: 'Somalia', warning: true },
        SD: { countryCode: 'SD', countryName: 'Sudan', warning: true },
        LY: { countryCode: 'LY', countryName: 'Libyen', warning: true },
        HT: { countryCode: 'HT', countryName: 'Haiti', warning: true },
        LB: { countryCode: 'LB', countryName: 'Libanon', warning: true },
      };

      return new Response(JSON.stringify({ response: mockAa }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 6. US Department of State Travel Advisories Mock
    if (urlStr.includes('cadataapi.state.gov') || urlStr.includes('travel.state.gov')) {
      const mockUs = [
        { Title: 'Ukraine - Level 4: Do Not Travel' },
        { Title: 'Russia - Level 4: Do Not Travel' },
        { Title: 'Belarus - Level 4: Do Not Travel' },
        { Title: 'Syria - Level 4: Do Not Travel' },
        { Title: 'Yemen - Level 4: Do Not Travel' },
        { Title: 'Afghanistan - Level 4: Do Not Travel' },
        { Title: 'Iraq - Level 4: Do Not Travel' },
        { Title: 'Somalia - Level 4: Do Not Travel' },
        { Title: 'Sudan - Level 4: Do Not Travel' },
        { Title: 'Libya - Level 4: Do Not Travel' },
        { Title: 'Haiti - Level 4: Do Not Travel' },
        { Title: 'Lebanon - Level 4: Do Not Travel' },
        { Title: 'United Arab Emirates - Level 3: Reconsider Travel' },
        { Title: 'Egypt - Level 3: Reconsider Travel' },
        { Title: 'Spain - Level 1: Exercise Normal Precautions' },
        { Title: 'Austria - Level 1: Exercise Normal Precautions' },
        { Title: 'Japan - Level 1: Exercise Normal Precautions' },
        { Title: 'Portugal - Level 1: Exercise Normal Precautions' },
        { Title: 'Thailand - Level 1: Exercise Normal Precautions' },
        { Title: 'Germany - Level 1: Exercise Normal Precautions' },
        { Title: 'France - Level 2: Exercise Increased Caution' },
        { Title: 'United Kingdom - Level 2: Exercise Increased Caution' },
        { Title: 'Italy - Level 2: Exercise Increased Caution' },
      ];

      return new Response(JSON.stringify(mockUs), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return originalFetch(input, init);
};
