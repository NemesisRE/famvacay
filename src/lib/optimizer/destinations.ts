import { POPULAR_DESTINATIONS, DestinationProfile } from './weather';
import { getAirportByIata } from '../airports/airport-service';

export type DestinationCategory = 'country' | 'region' | 'city' | 'airport';

export interface LocalizedDestinationEntity {
  id: string;
  category: DestinationCategory;
  code?: string;
  parentRegionId?: string;
  aliases?: string[];
  airportCodes: string[];
  countryCode: string;
  names: {
    en: string;
    de: string;
    fr: string;
    es: string;
    it: string;
  };
  countryNames: {
    en: string;
    de: string;
    fr: string;
    es: string;
    it: string;
  };
}

export const CANONICAL_DESTINATIONS: LocalizedDestinationEntity[] = [
  // Regions & Resort Hubs
  {
    id: 'red_sea',
    category: 'region',
    code: 'HRG',
    airportCodes: ['HRG', 'SSH', 'RMF'],
    countryCode: 'EG',
    names: {
      en: 'Hurghada & Red Sea',
      de: 'Hurghada & Rotes Meer',
      fr: 'Hurghada et Mer Rouge',
      es: 'Hurgada y Mar Rojo',
      it: 'Hurghada e Mar Rosso',
    },
    countryNames: {
      en: 'Egypt',
      de: 'Ägypten',
      fr: 'Égypte',
      es: 'Egipto',
      it: 'Egitto',
    },
  },
  {
    id: 'sharm_el_sheikh',
    category: 'region',
    code: 'SSH',
    airportCodes: ['SSH'],
    countryCode: 'EG',
    names: {
      en: 'Sharm el-Sheikh',
      de: 'Scharm asch-Schaich',
      fr: 'Charm el-Cheikh',
      es: 'Sharm el-Sheij',
      it: 'Sharm el-Sheikh',
    },
    countryNames: {
      en: 'Egypt',
      de: 'Ägypten',
      fr: 'Égypte',
      es: 'Egipto',
      it: 'Egitto',
    },
  },
  {
    id: 'mallorca',
    category: 'region',
    code: 'PMI',
    airportCodes: ['PMI'],
    countryCode: 'ES',
    names: {
      en: 'Mallorca (Balearic Islands)',
      de: 'Mallorca (Balearen)',
      fr: 'Majorque (Îles Baléares)',
      es: 'Mallorca (Islas Baleares)',
      it: 'Maiorca (Isole Baleari)',
    },
    countryNames: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
  },
  {
    id: 'canary_islands',
    category: 'region',
    code: 'TFS',
    airportCodes: ['TFS', 'LPA', 'ACE', 'FUE'],
    countryCode: 'ES',
    names: {
      en: 'Canary Islands (Tenerife / Gran Canaria)',
      de: 'Kanarische Inseln (Teneriffa / Gran Canaria)',
      fr: 'Îles Canaries (Ténérife / Grande Canarie)',
      es: 'Islas Canarias (Tenerife / Gran Canaria)',
      it: 'Isole Canarie (Tenerife / Gran Canaria)',
    },
    countryNames: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
  },
  {
    id: 'turkish_riviera',
    category: 'region',
    code: 'AYT',
    airportCodes: ['AYT', 'GZP', 'BJV', 'DLM'],
    countryCode: 'TR',
    names: {
      en: 'Turkish Riviera & Antalya',
      de: 'Türkische Riviera & Antalya',
      fr: 'Riviera turque et Antalya',
      es: 'Riviera Turca y Antalya',
      it: 'Riviera Turca e Antalya',
    },
    countryNames: {
      en: 'Turkey',
      de: 'Türkei',
      fr: 'Turquie',
      es: 'Turquía',
      it: 'Turchia',
    },
  },
  {
    id: 'crete',
    category: 'region',
    code: 'HER',
    airportCodes: ['HER', 'CHQ'],
    countryCode: 'GR',
    names: {
      en: 'Crete & Greek Islands',
      de: 'Kreta & Griechische Inseln',
      fr: 'Crète et Îles Grecques',
      es: 'Creta e Islas Griegas',
      it: 'Creta e Isole Greche',
    },
    countryNames: {
      en: 'Greece',
      de: 'Griechenland',
      fr: 'Grèce',
      es: 'Grecia',
      it: 'Grecia',
    },
  },
  {
    id: 'rhodes',
    category: 'region',
    code: 'RHO',
    airportCodes: ['RHO'],
    countryCode: 'GR',
    names: {
      en: 'Rhodes',
      de: 'Rhodos',
      fr: 'Rhodes',
      es: 'Rodas',
      it: 'Rodi',
    },
    countryNames: {
      en: 'Greece',
      de: 'Griechenland',
      fr: 'Grèce',
      es: 'Grecia',
      it: 'Grecia',
    },
  },
  {
    id: 'kos',
    category: 'region',
    code: 'KGS',
    airportCodes: ['KGS'],
    countryCode: 'GR',
    names: {
      en: 'Kos',
      de: 'Kos',
      fr: 'Kos',
      es: 'Cos',
      it: 'Kos',
    },
    countryNames: {
      en: 'Greece',
      de: 'Griechenland',
      fr: 'Grèce',
      es: 'Grecia',
      it: 'Grecia',
    },
  },
  {
    id: 'djerba',
    category: 'region',
    code: 'DJE',
    airportCodes: ['DJE', 'MIR'],
    countryCode: 'TN',
    names: {
      en: 'Djerba',
      de: 'Djerba',
      fr: 'Djerba',
      es: 'Djerba',
      it: 'Gerba',
    },
    countryNames: {
      en: 'Tunisia',
      de: 'Tunesien',
      fr: 'Tunisie',
      es: 'Túnez',
      it: 'Tunisia',
    },
  },
  {
    id: 'algarve',
    category: 'region',
    code: 'FAO',
    airportCodes: ['FAO'],
    countryCode: 'PT',
    names: {
      en: 'Algarve',
      de: 'Algarve',
      fr: 'Algarve',
      es: 'Algarve',
      it: 'Algarve',
    },
    countryNames: {
      en: 'Portugal',
      de: 'Portugal',
      fr: 'Portugal',
      es: 'Portugal',
      it: 'Portogallo',
    },
  },
  {
    id: 'costa_del_sol',
    category: 'region',
    code: 'AGP',
    airportCodes: ['AGP'],
    countryCode: 'ES',
    names: {
      en: 'Costa del Sol (Málaga)',
      de: 'Costa del Sol (Málaga)',
      fr: 'Costa del Sol (Málaga)',
      es: 'Costa del Sol (Málaga)',
      it: 'Costa del Sol (Malaga)',
    },
    countryNames: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
  },
  {
    id: 'bali',
    category: 'region',
    code: 'DPS',
    airportCodes: ['DPS'],
    countryCode: 'ID',
    names: {
      en: 'Bali',
      de: 'Bali',
      fr: 'Bali',
      es: 'Bali',
      it: 'Bali',
    },
    countryNames: {
      en: 'Indonesia',
      de: 'Indonesien',
      fr: 'Indonésie',
      es: 'Indonesia',
      it: 'Indonesia',
    },
  },
  {
    id: 'phuket',
    category: 'region',
    code: 'HKT',
    airportCodes: ['HKT'],
    countryCode: 'TH',
    names: {
      en: 'Phuket',
      de: 'Phuket',
      fr: 'Phuket',
      es: 'Phuket',
      it: 'Phuket',
    },
    countryNames: {
      en: 'Thailand',
      de: 'Thailand',
      fr: 'Thaïlande',
      es: 'Tailandia',
      it: 'Thailandia',
    },
  },
  {
    id: 'cancun',
    category: 'region',
    code: 'CUN',
    airportCodes: ['CUN'],
    countryCode: 'MX',
    names: {
      en: 'Cancún & Riviera Maya',
      de: 'Cancún & Riviera Maya',
      fr: 'Cancún et Riviera Maya',
      es: 'Cancún y Riviera Maya',
      it: 'Cancún e Riviera Maya',
    },
    countryNames: {
      en: 'Mexico',
      de: 'Mexiko',
      fr: 'Mexique',
      es: 'México',
      it: 'Messico',
    },
  },
  // Cities
  {
    id: 'dubai',
    category: 'city',
    code: 'DXB',
    airportCodes: ['DXB'],
    countryCode: 'AE',
    names: {
      en: 'Dubai',
      de: 'Dubai',
      fr: 'Dubaï',
      es: 'Dubái',
      it: 'Dubai',
    },
    countryNames: {
      en: 'UAE',
      de: 'VAE',
      fr: 'Émirats arabes unis',
      es: 'EAU',
      it: 'Emirati Arabi Uniti',
    },
  },
  {
    id: 'barcelona',
    category: 'city',
    code: 'BCN',
    airportCodes: ['BCN'],
    countryCode: 'ES',
    names: {
      en: 'Barcelona',
      de: 'Barcelona',
      fr: 'Barcelone',
      es: 'Barcelona',
      it: 'Barcellona',
    },
    countryNames: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
  },
  {
    id: 'rome',
    category: 'city',
    code: 'FCO',
    airportCodes: ['FCO'],
    countryCode: 'IT',
    names: {
      en: 'Rome',
      de: 'Rom',
      fr: 'Rome',
      es: 'Roma',
      it: 'Roma',
    },
    countryNames: {
      en: 'Italy',
      de: 'Italien',
      fr: 'Italie',
      es: 'Italia',
      it: 'Italia',
    },
  },
  {
    id: 'athens',
    category: 'city',
    code: 'ATH',
    airportCodes: ['ATH'],
    countryCode: 'GR',
    aliases: ['athen', 'athens', 'athènes', 'atenas', 'atene', 'athina'],
    names: {
      en: 'Athens',
      de: 'Athen',
      fr: 'Athènes',
      es: 'Atenas',
      it: 'Atene',
    },
    countryNames: {
      en: 'Greece',
      de: 'Griechenland',
      fr: 'Grèce',
      es: 'Grecia',
      it: 'Grecia',
    },
  },
  {
    id: 'palma',
    category: 'city',
    code: 'PMI',
    parentRegionId: 'mallorca',
    airportCodes: ['PMI'],
    countryCode: 'ES',
    aliases: ['palma', 'palma de mallorca'],
    names: {
      en: 'Palma (Mallorca)',
      de: 'Palma (Mallorca)',
      fr: 'Palma (Majorque)',
      es: 'Palma (Mallorca)',
      it: 'Palma (Maiorca)',
    },
    countryNames: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
  },
  {
    id: 'hurghada_city',
    category: 'city',
    code: 'HRG',
    parentRegionId: 'red_sea',
    airportCodes: ['HRG'],
    countryCode: 'EG',
    aliases: ['hurghada', 'hurgada'],
    names: {
      en: 'Hurghada City',
      de: 'Hurghada Stadt',
      fr: 'Hurghada Ville',
      es: 'Ciudad de Hurghada',
      it: 'Città di Hurghada',
    },
    countryNames: {
      en: 'Egypt',
      de: 'Ägypten',
      fr: 'Égypte',
      es: 'Egipto',
      it: 'Egitto',
    },
  },
  {
    id: 'antalya_city',
    category: 'city',
    code: 'AYT',
    parentRegionId: 'turkish_riviera',
    airportCodes: ['AYT'],
    countryCode: 'TR',
    aliases: ['antalya'],
    names: {
      en: 'Antalya City',
      de: 'Antalya Stadt',
      fr: 'Antalya Ville',
      es: 'Ciudad de Antalya',
      it: 'Città di Antalya',
    },
    countryNames: {
      en: 'Turkey',
      de: 'Türkei',
      fr: 'Turquie',
      es: 'Turquía',
      it: 'Turchia',
    },
  },
  {
    id: 'heraklion_city',
    category: 'city',
    code: 'HER',
    parentRegionId: 'crete',
    airportCodes: ['HER'],
    countryCode: 'GR',
    aliases: ['heraklion', 'irakleio', 'iraklion'],
    names: {
      en: 'Heraklion (Crete)',
      de: 'Heraklion (Kreta)',
      fr: 'Héraklion (Crète)',
      es: 'Heraclión (Creta)',
      it: 'Heraklion (Creta)',
    },
    countryNames: {
      en: 'Greece',
      de: 'Griechenland',
      fr: 'Grèce',
      es: 'Grecia',
      it: 'Grecia',
    },
  },
  {
    id: 'rhodes_city',
    category: 'city',
    code: 'RHO',
    parentRegionId: 'rhodes',
    airportCodes: ['RHO'],
    countryCode: 'GR',
    aliases: ['rhodos', 'rhodes', 'rodas', 'rodi'],
    names: {
      en: 'Rhodes City',
      de: 'Rhodos Stadt',
      fr: 'Rhodes Ville',
      es: 'Ciudad de Rodas',
      it: 'Città di Rodi',
    },
    countryNames: {
      en: 'Greece',
      de: 'Griechenland',
      fr: 'Grèce',
      es: 'Grecia',
      it: 'Grecia',
    },
  },
  {
    id: 'lisbon',
    category: 'city',
    code: 'LIS',
    airportCodes: ['LIS'],
    countryCode: 'PT',
    aliases: ['lisbon', 'lissabon', 'lisbonne', 'lisboa'],
    names: {
      en: 'Lisbon',
      de: 'Lissabon',
      fr: 'Lisbonne',
      es: 'Lisboa',
      it: 'Lisbona',
    },
    countryNames: {
      en: 'Portugal',
      de: 'Portugal',
      fr: 'Portugal',
      es: 'Portugal',
      it: 'Portogallo',
    },
  },
  {
    id: 'vienna',
    category: 'city',
    code: 'VIE',
    airportCodes: ['VIE'],
    countryCode: 'AT',
    aliases: ['vienna', 'wien', 'vienne'],
    names: {
      en: 'Vienna',
      de: 'Wien',
      fr: 'Vienne',
      es: 'Viena',
      it: 'Vienna',
    },
    countryNames: {
      en: 'Austria',
      de: 'Österreich',
      fr: 'Autriche',
      es: 'Austria',
      it: 'Austria',
    },
  },
  {
    id: 'madrid',
    category: 'city',
    code: 'MAD',
    airportCodes: ['MAD'],
    countryCode: 'ES',
    aliases: ['madrid'],
    names: {
      en: 'Madrid',
      de: 'Madrid',
      fr: 'Madrid',
      es: 'Madrid',
      it: 'Madrid',
    },
    countryNames: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
  },
  {
    id: 'tenerife',
    category: 'region',
    code: 'TFS',
    parentRegionId: 'canary_islands',
    airportCodes: ['TFS', 'TFN'],
    countryCode: 'ES',
    aliases: ['teneriffa', 'tenerife'],
    names: {
      en: 'Tenerife (Canary Islands)',
      de: 'Teneriffa (Kanaren)',
      fr: 'Ténérife (Canaries)',
      es: 'Tenerife (Islas Canarias)',
      it: 'Tenerife (Isole Canarie)',
    },
    countryNames: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
  },
  {
    id: 'gran_canaria',
    category: 'region',
    code: 'LPA',
    parentRegionId: 'canary_islands',
    airportCodes: ['LPA'],
    countryCode: 'ES',
    aliases: ['gran canaria'],
    names: {
      en: 'Gran Canaria (Canary Islands)',
      de: 'Gran Canaria (Kanaren)',
      fr: 'Grande Canarie (Canaries)',
      es: 'Gran Canaria (Islas Canarias)',
      it: 'Gran Canaria (Isole Canarie)',
    },
    countryNames: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
  },
  // Countries
  {
    id: 'egypt',
    category: 'country',
    airportCodes: ['HRG', 'SSH', 'RMF'],
    countryCode: 'EG',
    names: {
      en: 'Egypt',
      de: 'Ägypten',
      fr: 'Égypte',
      es: 'Egipto',
      it: 'Egitto',
    },
    countryNames: {
      en: 'Egypt',
      de: 'Ägypten',
      fr: 'Égypte',
      es: 'Egipto',
      it: 'Egitto',
    },
  },
  {
    id: 'spain',
    category: 'country',
    airportCodes: ['PMI', 'AGP', 'BCN', 'TFS', 'LPA', 'IBZ'],
    countryCode: 'ES',
    names: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
    countryNames: {
      en: 'Spain',
      de: 'Spanien',
      fr: 'Espagne',
      es: 'España',
      it: 'Spagna',
    },
  },
  {
    id: 'greece',
    category: 'country',
    airportCodes: ['HER', 'RHO', 'CFU', 'KGS', 'CHQ', 'ATH'],
    countryCode: 'GR',
    names: {
      en: 'Greece',
      de: 'Griechenland',
      fr: 'Grèce',
      es: 'Grecia',
      it: 'Grecia',
    },
    countryNames: {
      en: 'Greece',
      de: 'Griechenland',
      fr: 'Grèce',
      es: 'Grecia',
      it: 'Grecia',
    },
  },
  {
    id: 'turkey',
    category: 'country',
    airportCodes: ['AYT', 'GZP', 'BJV', 'DLM', 'IST'],
    countryCode: 'TR',
    names: {
      en: 'Turkey',
      de: 'Türkei',
      fr: 'Turquie',
      es: 'Turquía',
      it: 'Turchia',
    },
    countryNames: {
      en: 'Turkey',
      de: 'Türkei',
      fr: 'Turquie',
      es: 'Turquía',
      it: 'Turchia',
    },
  },
  {
    id: 'italy',
    category: 'country',
    airportCodes: ['FCO', 'VCE', 'NAP', 'CTA', 'PMO'],
    countryCode: 'IT',
    names: {
      en: 'Italy',
      de: 'Italien',
      fr: 'Italie',
      es: 'Italia',
      it: 'Italia',
    },
    countryNames: {
      en: 'Italy',
      de: 'Italien',
      fr: 'Italie',
      es: 'Italia',
      it: 'Italia',
    },
  },
  {
    id: 'portugal',
    category: 'country',
    airportCodes: ['FAO', 'LIS', 'OPO', 'FNC'],
    countryCode: 'PT',
    names: {
      en: 'Portugal',
      de: 'Portugal',
      fr: 'Portugal',
      es: 'Portugal',
      it: 'Portogallo',
    },
    countryNames: {
      en: 'Portugal',
      de: 'Portugal',
      fr: 'Portugal',
      es: 'Portugal',
      it: 'Portogallo',
    },
  },
  {
    id: 'tunisia',
    category: 'country',
    airportCodes: ['DJE', 'MIR', 'TUN'],
    countryCode: 'TN',
    names: {
      en: 'Tunisia',
      de: 'Tunesien',
      fr: 'Tunisie',
      es: 'Túnez',
      it: 'Tunisia',
    },
    countryNames: {
      en: 'Tunisia',
      de: 'Tunesien',
      fr: 'Tunisie',
      es: 'Túnez',
      it: 'Tunisia',
    },
  },
  {
    id: 'thailand',
    category: 'country',
    airportCodes: ['HKT', 'BKK', 'USM'],
    countryCode: 'TH',
    names: {
      en: 'Thailand',
      de: 'Thailand',
      fr: 'Thaïlande',
      es: 'Tailandia',
      it: 'Thailandia',
    },
    countryNames: {
      en: 'Thailand',
      de: 'Thailand',
      fr: 'Thaïlande',
      es: 'Tailandia',
      it: 'Thailandia',
    },
  },
  {
    id: 'croatia',
    category: 'country',
    airportCodes: ['DBV', 'SPU', 'ZAD', 'PUY'],
    countryCode: 'HR',
    names: {
      en: 'Croatia',
      de: 'Kroatien',
      fr: 'Croatie',
      es: 'Croacia',
      it: 'Croazia',
    },
    countryNames: {
      en: 'Croatia',
      de: 'Kroatien',
      fr: 'Croatie',
      es: 'Croacia',
      it: 'Croazia',
    },
  },
  {
    id: 'cyprus',
    category: 'country',
    airportCodes: ['LCA', 'PFO'],
    countryCode: 'CY',
    names: {
      en: 'Cyprus',
      de: 'Zypern',
      fr: 'Chypre',
      es: 'Chipre',
      it: 'Cipro',
    },
    countryNames: {
      en: 'Cyprus',
      de: 'Zypern',
      fr: 'Chypre',
      es: 'Chipre',
      it: 'Cipro',
    },
  },
  {
    id: 'austria',
    category: 'country',
    airportCodes: ['VIE', 'SZG', 'INN'],
    countryCode: 'AT',
    names: {
      en: 'Austria',
      de: 'Österreich',
      fr: 'Autriche',
      es: 'Austria',
      it: 'Austria',
    },
    countryNames: {
      en: 'Austria',
      de: 'Österreich',
      fr: 'Autriche',
      es: 'Austria',
      it: 'Austria',
    },
  },
  {
    id: 'france',
    category: 'country',
    airportCodes: ['CDG', 'ORY', 'NCE', 'MRS'],
    countryCode: 'FR',
    names: {
      en: 'France',
      de: 'Frankreich',
      fr: 'France',
      es: 'Francia',
      it: 'Francia',
    },
    countryNames: {
      en: 'France',
      de: 'Frankreich',
      fr: 'France',
      es: 'Francia',
      it: 'Francia',
    },
  },
];

// Ensure fallback profiles in POPULAR_DESTINATIONS
const EXTRA_DEST_PROFILES: Record<string, DestinationProfile> = {
  HRG: { code: 'HRG', name: 'Hurghada / Red Sea', country: 'EG', type: 'BEACH', lat: 27.1783, lon: 33.7994, idealMinTemp: 22, idealMaxTemp: 36, maxAcceptablePrecipRisk: 10 },
  SSH: { code: 'SSH', name: 'Sharm el Sheikh', country: 'EG', type: 'BEACH', lat: 27.9774, lon: 34.3951, idealMinTemp: 22, idealMaxTemp: 36, maxAcceptablePrecipRisk: 10 },
  RMF: { code: 'RMF', name: 'Marsa Alam', country: 'EG', type: 'BEACH', lat: 25.5569, lon: 34.5836, idealMinTemp: 22, idealMaxTemp: 36, maxAcceptablePrecipRisk: 10 },
  DJE: { code: 'DJE', name: 'Djerba', country: 'TN', type: 'BEACH', lat: 33.8750, lon: 10.7753, idealMinTemp: 20, idealMaxTemp: 34, maxAcceptablePrecipRisk: 20 },
  DPS: { code: 'DPS', name: 'Bali Denpasar', country: 'ID', type: 'BEACH', lat: -8.7482, lon: 115.1672, idealMinTemp: 24, idealMaxTemp: 32, maxAcceptablePrecipRisk: 35 },
  HKT: { code: 'HKT', name: 'Phuket', country: 'TH', type: 'BEACH', lat: 8.1132, lon: 98.3169, idealMinTemp: 24, idealMaxTemp: 33, maxAcceptablePrecipRisk: 40 },
  TFS: { code: 'TFS', name: 'Tenerife South', country: 'ES', type: 'BEACH', lat: 28.0445, lon: -16.5725, idealMinTemp: 21, idealMaxTemp: 30, maxAcceptablePrecipRisk: 15 },
  LPA: { code: 'LPA', name: 'Gran Canaria', country: 'ES', type: 'BEACH', lat: 27.9319, lon: -15.3866, idealMinTemp: 21, idealMaxTemp: 30, maxAcceptablePrecipRisk: 15 },
  ACE: { code: 'ACE', name: 'Lanzarote', country: 'ES', type: 'BEACH', lat: 28.9455, lon: -13.6052, idealMinTemp: 21, idealMaxTemp: 29, maxAcceptablePrecipRisk: 15 },
  FUE: { code: 'FUE', name: 'Fuerteventura', country: 'ES', type: 'BEACH', lat: 28.4527, lon: -13.8638, idealMinTemp: 21, idealMaxTemp: 29, maxAcceptablePrecipRisk: 15 },
  RHO: { code: 'RHO', name: 'Rhodes Diagoras', country: 'GR', type: 'BEACH', lat: 36.4054, lon: 28.0862, idealMinTemp: 21, idealMaxTemp: 33, maxAcceptablePrecipRisk: 20 },
  KGS: { code: 'KGS', name: 'Kos Hippocrates', country: 'GR', type: 'BEACH', lat: 36.7933, lon: 27.0917, idealMinTemp: 21, idealMaxTemp: 33, maxAcceptablePrecipRisk: 20 },
  CFU: { code: 'CFU', name: 'Corfu', country: 'GR', type: 'BEACH', lat: 39.6019, lon: 19.9117, idealMinTemp: 20, idealMaxTemp: 32, maxAcceptablePrecipRisk: 25 },
};

for (const [code, prof] of Object.entries(EXTRA_DEST_PROFILES)) {
  if (!POPULAR_DESTINATIONS[code]) {
    POPULAR_DESTINATIONS[code] = prof;
  }
}

// Synonyms and normalization dictionary
const DESTINATION_MAPPINGS: Record<string, string[]> = {
  // Egypt & Red Sea
  egypt: ['HRG', 'SSH', 'RMF'],
  aegypten: ['HRG', 'SSH', 'RMF'],
  ägypten: ['HRG', 'SSH', 'RMF'],
  egypte: ['HRG', 'SSH', 'RMF'],
  egipto: ['HRG', 'SSH', 'RMF'],
  egitto: ['HRG', 'SSH', 'RMF'],
  hurghada: ['HRG'],
  'sharm el sheikh': ['SSH'],
  'sharm el-sheikh': ['SSH'],
  'marsa alam': ['RMF'],
  'red sea': ['HRG', 'SSH', 'RMF'],
  'rotes meer': ['HRG', 'SSH', 'RMF'],
  rotes_meer: ['HRG', 'SSH', 'RMF'],

  // Tunisia
  tunisia: ['DJE'],
  tunesien: ['DJE'],
  tunisie: ['DJE'],
  túnez: ['DJE'],
  djerba: ['DJE'],

  // Turkey & Riviera
  turkey: ['AYT', 'GZP', 'BJV', 'DLM'],
  türkei: ['AYT', 'GZP', 'BJV', 'DLM'],
  tuerkei: ['AYT', 'GZP', 'BJV', 'DLM'],
  turquie: ['AYT', 'GZP', 'BJV', 'DLM'],
  turquía: ['AYT', 'GZP', 'BJV', 'DLM'],
  turchia: ['AYT', 'GZP', 'BJV', 'DLM'],
  antalya: ['AYT'],
  'turkish riviera': ['AYT', 'GZP', 'BJV', 'DLM'],
  'türkische riviera': ['AYT', 'GZP', 'BJV', 'DLM'],
  tuerkische_riviera: ['AYT', 'GZP', 'BJV', 'DLM'],

  // Spain & Islands
  spain: ['PMI', 'AGP', 'BCN', 'TFS', 'LPA'],
  spanien: ['PMI', 'AGP', 'BCN', 'TFS', 'LPA'],
  espagne: ['PMI', 'AGP', 'BCN', 'TFS', 'LPA'],
  españa: ['PMI', 'AGP', 'BCN', 'TFS', 'LPA'],
  spagna: ['PMI', 'AGP', 'BCN', 'TFS', 'LPA'],
  mallorca: ['PMI'],
  majorca: ['PMI'],
  palma: ['PMI'],
  ibiza: ['IBZ'],
  canaries: ['TFS', 'LPA', 'ACE', 'FUE'],
  kanaren: ['TFS', 'LPA', 'ACE', 'FUE'],
  'canary islands': ['TFS', 'LPA', 'ACE', 'FUE'],
  'kanarische inseln': ['TFS', 'LPA', 'ACE', 'FUE'],
  tenerife: ['TFS'],
  teneriffa: ['TFS'],
  'gran canaria': ['LPA'],
  lanzarote: ['ACE'],
  fuerteventura: ['FUE'],
  malaga: ['AGP'],
  málaga: ['AGP'],
  'costa del sol': ['AGP'],
  barcelona: ['BCN'],

  // Greece & Islands
  greece: ['HER', 'RHO', 'CFU', 'KGS', 'ATH'],
  griechenland: ['HER', 'RHO', 'CFU', 'KGS', 'ATH'],
  grèce: ['HER', 'RHO', 'CFU', 'KGS', 'ATH'],
  grecia: ['HER', 'RHO', 'CFU', 'KGS', 'ATH'],
  athens: ['ATH'],
  athen: ['ATH'],
  athènes: ['ATH'],
  athenes: ['ATH'],
  atenas: ['ATH'],
  atene: ['ATH'],
  athina: ['ATH'],
  crete: ['HER', 'CHQ'],
  kreta: ['HER', 'CHQ'],
  heraklion: ['HER'],
  rhodes: ['RHO'],
  rhodos: ['RHO'],
  corfu: ['CFU'],
  korfu: ['CFU'],
  kos: ['KGS'],

  // Italy
  italy: ['FCO', 'VCE'],
  italien: ['FCO', 'VCE'],
  italie: ['FCO', 'VCE'],
  italia: ['FCO', 'VCE'],
  rome: ['FCO'],
  rom: ['FCO'],
  venice: ['VCE'],
  venedig: ['VCE'],

  // Austria
  austria: ['VIE', 'SZG', 'INN'],
  österreich: ['VIE', 'SZG', 'INN'],
  oesterreich: ['VIE', 'SZG', 'INN'],
  autriche: ['VIE', 'SZG', 'INN'],
  vienna: ['VIE'],
  wien: ['VIE'],
  vienne: ['VIE'],
  viena: ['VIE'],

  // Spain & Madrid additions
  madrid: ['MAD'],

  // Portugal
  portugal: ['FAO', 'LIS', 'FNC'],
  algarve: ['FAO'],
  faro: ['FAO'],
  lisbon: ['LIS'],
  lissabon: ['LIS'],
  madeira: ['FNC'],

  // Long-haul & Exotic
  bali: ['DPS'],
  indonesia: ['DPS'],
  thailand: ['HKT', 'BKK'],
  phuket: ['HKT'],
  bangkok: ['BKK'],
  cancun: ['CUN'],
  cancún: ['CUN'],
  mexico: ['CUN'],
  mexiko: ['CUN'],
  dubai: ['DXB'],
  uae: ['DXB'],
  vae: ['DXB'],
};

/**
 * Normalizes query string for matching
 */
export function normalizeDestinationString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[_\-\/()&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if two strings match via full equality or whole-word phrase match
 */
function isWordMatch(source: string, target: string): boolean {
  if (source === target) return true;
  const sWords = source.split(/\s+/);
  const tWords = target.split(/\s+/);

  // If one contains the other as a whole multi-word phrase
  if (tWords.length > 1 && source.includes(target)) return true;
  if (sWords.length > 1 && target.includes(source)) return true;

  // Single word must strictly match a complete token
  return sWords.includes(target) || tWords.includes(source);
}

/**
 * Finds a canonical destination entity by tag or query
 */
export function getDestinationEntity(
  queryOrTag: string,
  locale: string = 'de'
): LocalizedDestinationEntity | null {
  const clean = normalizeDestinationString(queryOrTag);
  if (!clean || clean.length < 2) return null;

  const upper = queryOrTag.trim().toUpperCase();

  // 1. Direct code or ID match
  const byCodeOrId = CANONICAL_DESTINATIONS.find(
    (d) =>
      d.id === clean ||
      d.code === upper ||
      d.airportCodes.includes(upper) ||
      d.countryCode === upper
  );
  if (byCodeOrId) return byCodeOrId;

  // 2. Exact name match across all locales (exact name takes highest priority)
  for (const dest of CANONICAL_DESTINATIONS) {
    for (const name of Object.values(dest.names)) {
      if (clean === normalizeDestinationString(name)) {
        return dest;
      }
    }
  }

  // 3. Substring match on entity names (e.g. "Mallorca" matching "Mallorca (Balearen)")
  for (const dest of CANONICAL_DESTINATIONS) {
    for (const name of Object.values(dest.names)) {
      const cleanName = normalizeDestinationString(name);
      if (isWordMatch(cleanName, clean)) {
        return dest;
      }
    }
  }

  // 4. Country entity exact match
  for (const dest of CANONICAL_DESTINATIONS) {
    if (dest.category === 'country') {
      for (const cName of Object.values(dest.countryNames)) {
        if (clean === normalizeDestinationString(cName)) {
          return dest;
        }
      }
    }
  }

  // 5. Explicit alias match
  for (const dest of CANONICAL_DESTINATIONS) {
    if (dest.aliases) {
      for (const alias of dest.aliases) {
        const cleanAlias = normalizeDestinationString(alias);
        if (clean === cleanAlias || isWordMatch(cleanAlias, clean)) {
          return dest;
        }
      }
    }
  }

  // 6. Mapping synonym match with word boundaries
  for (const [key, codes] of Object.entries(DESTINATION_MAPPINGS)) {
    const cleanKey = normalizeDestinationString(key);
    if (isWordMatch(cleanKey, clean) || cleanKey === clean) {
      const matched = CANONICAL_DESTINATIONS.find((d) =>
        d.airportCodes.some((ac) => codes.includes(ac))
      );
      if (matched) return matched;
    }
  }

  // 7. Fuzzy match across all canonical destinations
  const fuzzy = fuzzyMatchDestinationEntity(queryOrTag, locale);
  if (fuzzy) return fuzzy;

  return null;
}

/**
 * Calculates Levenshtein edit distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/**
 * Resilient fuzzy matching across canonical destination names and aliases
 */
export function fuzzyMatchDestinationEntity(
  query: string,
  locale: string = 'de'
): LocalizedDestinationEntity | null {
  const clean = normalizeDestinationString(query);
  if (!clean || clean.length < 3) return null;

  let bestMatch: LocalizedDestinationEntity | null = null;
  let minDistance = Infinity;

  for (const dest of CANONICAL_DESTINATIONS) {
    const candidates = [
      dest.id,
      ...Object.values(dest.names),
      ...(dest.aliases || []),
      ...(dest.category === 'country' ? Object.values(dest.countryNames) : []),
    ];

    for (const cand of candidates) {
      const candNorm = normalizeDestinationString(cand);
      const dist = levenshteinDistance(clean, candNorm);
      const maxAllowed = clean.length <= 4 ? 1 : 2;

      if (dist <= maxAllowed && dist < minDistance) {
        minDistance = dist;
        bestMatch = dest;
      }
    }
  }

  return bestMatch;
}

export interface ContainmentCheckResult {
  isContained: boolean;
  parentTag?: string;
  parentEntity?: LocalizedDestinationEntity;
  childEntity?: LocalizedDestinationEntity;
}

/**
 * Detects if a candidate destination entity is already encompassed by an active parent destination.
 * e.g. "Palma" when "Mallorca" is already active, or "Hurghada City" when "Red Sea" is active.
 */
export function checkRegionalContainment(
  candidateInputOrEntity: string | LocalizedDestinationEntity,
  selectedDestinations: string[],
  locale: string = 'de'
): ContainmentCheckResult {
  const child = typeof candidateInputOrEntity === 'string'
    ? getDestinationEntity(candidateInputOrEntity, locale)
    : candidateInputOrEntity;

  if (!child || !selectedDestinations || selectedDestinations.length === 0) {
    return { isContained: false };
  }

  for (const existingTag of selectedDestinations) {
    const parent = getDestinationEntity(existingTag, locale);
    if (!parent || parent.id === child.id) continue;

    // 1. Explicit parentRegionId hierarchy
    if (child.parentRegionId && child.parentRegionId === parent.id) {
      return {
        isContained: true,
        parentTag: existingTag,
        parentEntity: parent,
        childEntity: child,
      };
    }

    // 2. Airport codes containment: If all airport codes of child are encompassed by parent region
    if (
      (parent.category === 'region' || parent.category === 'country') &&
      child.airportCodes.length > 0 &&
      child.airportCodes.every((code) => parent.airportCodes.includes(code))
    ) {
      return {
        isContained: true,
        parentTag: existingTag,
        parentEntity: parent,
        childEntity: child,
      };
    }

    // 3. Country-level containment
    if (parent.category === 'country' && child.countryCode === parent.countryCode) {
      return {
        isContained: true,
        parentTag: existingTag,
        parentEntity: parent,
        childEntity: child,
      };
    }
  }

  return { isContained: false };
}

/**
 * Returns localized name for destination entity
 */
export function getLocalizedDestinationName(
  entity: LocalizedDestinationEntity,
  locale: string = 'de'
): string {
  const l = (locale.slice(0, 2) as keyof typeof entity.names) || 'de';
  return entity.names[l] || entity.names.en || entity.names.de;
}

/**
 * Returns localized category name for entity
 */
export function getLocalizedCategoryName(
  category: DestinationCategory,
  locale: string = 'de'
): string {
  const l = locale.slice(0, 2);
  const map: Record<string, Record<DestinationCategory, string>> = {
    de: { country: 'Land', region: 'Region', city: 'Stadt', airport: 'Flughafen' },
    en: { country: 'Country', region: 'Region', city: 'City', airport: 'Airport' },
    fr: { country: 'Pays', region: 'Région', city: 'Ville', airport: 'Aéroport' },
    es: { country: 'País', region: 'Región', city: 'Ciudad', airport: 'Aeropuerto' },
    it: { country: 'Paese', region: 'Regione', city: 'Città', airport: 'Aeroporto' },
  };

  const set = map[l] || map.de;
  return set[category] || category;
}

/**
 * Resolves user destination tags into valid candidate destination airport codes.
 * STRICT: If destination tags are provided, returns ONLY the matching airports.
 * If none match, returns an EMPTY array (no unrequested fallback destinations).
 */
export function resolveDestinationCodes(destinationTags?: string[]): string[] {
  // If no destination filter was set by user, provide open discovery hubs
  if (!destinationTags || destinationTags.length === 0) {
    return ['PMI', 'AYT', 'HRG', 'HER', 'AGP', 'FAO', 'BCN', 'DJE'];
  }

  const resolved = new Set<string>();

  for (const tag of destinationTags) {
    const clean = normalizeDestinationString(tag);
    const upper = tag.trim().toUpperCase();

    // 1. Direct 3-letter IATA code
    if (upper.length === 3 && (POPULAR_DESTINATIONS[upper] || getAirportByIata(upper))) {
      resolved.add(upper);
      continue;
    }

    // 2. Canonical Destination Entity
    const entity = getDestinationEntity(tag);
    if (entity) {
      entity.airportCodes.forEach((code) => resolved.add(code));
      continue;
    }

    // 3. Check mapping dictionary with word-boundary matching
    let found = false;
    for (const [key, codes] of Object.entries(DESTINATION_MAPPINGS)) {
      const cleanKey = normalizeDestinationString(key);
      if (isWordMatch(cleanKey, clean)) {
        codes.forEach((c) => resolved.add(c));
        found = true;
      }
    }

    // 4. Check POPULAR_DESTINATIONS by name or country with word-boundary matching
    if (!found) {
      for (const [code, dest] of Object.entries(POPULAR_DESTINATIONS)) {
        const destName = normalizeDestinationString(dest.name);
        const destCountry = dest.country.toLowerCase();
        if (isWordMatch(destName, clean) || destCountry === clean) {
          resolved.add(code);
          found = true;
        }
      }
    }
  }

  // STRICT FILTERING: Do NOT fall back to arbitrary destinations if user specified tags
  return Array.from(resolved);
}

/**
 * Strict pre-validation for destination inputs with regional containment detection.
 * Rejects fictitious/unknown inputs (e.g. "Mars") that cannot be mapped to any airport or recognized entity.
 */
export async function validateDestinationInput(
  rawInput: string,
  locale: string = 'de',
  selectedDestinations: string[] = []
): Promise<{
  isValid: boolean;
  entity?: LocalizedDestinationEntity;
  resolvedName?: string;
  category?: DestinationCategory;
  categoryLabel?: string;
  airportCodes?: string[];
  isContained?: boolean;
  containment?: ContainmentCheckResult;
}> {
  const clean = rawInput.trim();
  if (!clean || clean.length < 2) {
    return { isValid: false };
  }

  // 1. Check canonical destinations catalog (exact + alias + fuzzy)
  const entity = getDestinationEntity(clean, locale);
  if (entity) {
    const localizedName = getLocalizedDestinationName(entity, locale);
    const containment = checkRegionalContainment(entity, selectedDestinations, locale);
    return {
      isValid: true,
      entity,
      resolvedName: localizedName,
      category: entity.category,
      categoryLabel: getLocalizedCategoryName(entity.category, locale),
      airportCodes: entity.airportCodes,
      isContained: containment.isContained,
      containment,
    };
  }

  // 2. Check direct commercial airport IATA code
  const upper = clean.toUpperCase();
  if (upper.length === 3) {
    const airport = getAirportByIata(upper);
    if (airport) {
      const containment = checkRegionalContainment(upper, selectedDestinations, locale);
      return {
        isValid: true,
        resolvedName: `${airport.name} (${upper})`,
        category: 'airport',
        categoryLabel: getLocalizedCategoryName('airport', locale),
        airportCodes: [upper],
        isContained: containment.isContained,
        containment,
      };
    }
  }

  // 3. Check mapping dictionary with word matching
  const cleanNorm = normalizeDestinationString(clean);
  for (const [key, codes] of Object.entries(DESTINATION_MAPPINGS)) {
    const cleanKey = normalizeDestinationString(key);
    if (isWordMatch(cleanKey, cleanNorm) || cleanKey === cleanNorm) {
      return {
        isValid: true,
        resolvedName: clean,
        category: 'region',
        categoryLabel: getLocalizedCategoryName('region', locale),
        airportCodes: codes,
      };
    }
  }

  // 4. Strict rejection for unknown or fictitious places (e.g. "Mars")
  return { isValid: false };
}
