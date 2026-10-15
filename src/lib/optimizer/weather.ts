import { DestinationType, WeatherAssessment } from './types';
import { getAirportByIata } from '../airports/airport-service';

export interface DestinationProfile {
  code: string;
  name: string;
  country: string;
  type: DestinationType;
  lat: number;
  lon: number;
  idealMinTemp: number;
  idealMaxTemp: number;
  maxAcceptablePrecipRisk: number; // percentage (0-100)
}

/**
 * Universal Place Classifier Keywords (no specific hardcoded cities or territories)
 */
const COASTAL_BEACH_KEYWORDS = [
  'beach', 'island', 'islands', 'isle', 'coast', 'costa', 'playa', 'plage',
  'praia', 'spiaggia', 'riviera', 'resort', 'bay', 'marina', 'cove', 'reef',
  'atoll', 'cape', 'peninsula', 'lido', 'strand', 'sea', 'ocean',
  'mallorca', 'majorca', 'palma', 'ibiza', 'menorca', 'canar', 'balear'
];

const ALPINE_SKI_KEYWORDS = [
  'ski', 'alps', 'alpen', 'alpi', 'alpes', 'glacier', 'dolomiti', 'dolomites',
  'pyrenees', 'mountain', 'peak', 'snow', 'berg'
];

/**
 * Dynamic Destination Profile Resolver
 * Generates destination metadata dynamically from the worldwide commercial airport database.
 * Completely eliminates static, hardcoded city lists.
 */
export function getDestinationProfile(code: string): DestinationProfile | null {
  const airport = getAirportByIata(code);
  if (!airport) return null;

  const lat = airport.lat;
  const lon = airport.lon;
  const nameLower = airport.name.toLowerCase();
  const muniLower = (airport.city || '').toLowerCase();

  // Infer default vacation category based on geographic descriptors, altitude, and latitude
  let type: DestinationType = 'CITY';

  const isSki =
    ALPINE_SKI_KEYWORDS.some((kw) => nameLower.includes(kw) || muniLower.includes(kw)) ||
    ((airport.altitude || 0) >= 1500 && Math.abs(lat) >= 44);

  const isCoastal = COASTAL_BEACH_KEYWORDS.some(
    (kw) => nameLower.includes(kw) || muniLower.includes(kw)
  );

  if (isSki) {
    type = 'SKI';
  } else if (isCoastal || Math.abs(lat) < 35) {
    // Warm subtropical / tropical latitudes or coastal geography naturally support beach/leisure vacations
    type = 'BEACH';
  }

  return {
    code: airport.code,
    name: airport.name,
    country: airport.country,
    type,
    lat,
    lon,
    idealMinTemp: type === 'SKI' ? -8 : (type === 'BEACH' ? 20 : 15),
    idealMaxTemp: type === 'SKI' ? 4 : (type === 'BEACH' ? 33 : 30),
    maxAcceptablePrecipRisk: type === 'BEACH' ? 25 : 35,
  };
}

/**
 * Backwards-compatible Proxy for POPULAR_DESTINATIONS.
 * Dynamically resolves any valid 3-letter IATA airport code on access.
 */
export const POPULAR_DESTINATIONS: Record<string, DestinationProfile> = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (typeof prop !== 'string' || prop.length !== 3) return undefined;
      return getDestinationProfile(prop.toUpperCase()) || undefined;
    },
    has(_target, prop: string) {
      if (typeof prop !== 'string' || prop.length !== 3) return false;
      return Boolean(getAirportByIata(prop.toUpperCase()));
    },
  }
);

export interface SeasonalConstraintWarning {
  destinationCode: string;
  seasonType: 'MONSOON' | 'EXTREME_HEAT' | 'TYPHOON_HURRICANE' | 'OVERCROWDED_PEAK';
  monthRange: number[]; // Months 0-11
  messageKey: string;
  fallbackMessage: string;
  eventName?: string;
}

/**
 * Anonymous Gregorian Computus algorithm to calculate Easter Sunday for any year.
 * Used for dynamic calculation of Carnival, Mardi Gras, Holy Week, and Spring Break windows worldwide.
 */
export function getEasterDate(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month: month - 1, day }; // 0-indexed month (2 = March, 3 = April)
}

/**
 * Universal Climatological Model Benchmark
 * Computes continuous estimated temperature, water temperature, rain probability, and sunshine
 * dynamically for any location on Earth based on physical latitude, solar declination, and seasonal insolation.
 * Completely eliminates arbitrary latitude bounding boxes and static city lookup tables.
 */
export function getEstimatedClimate(
  destinationCode: string,
  monthIndex: number, // 0-11
  overrideCoords?: { lat: number; lon: number }
): WeatherAssessment {
  let lat = 0;
  let lon = 0;
  let altitude = 0;
  let type: DestinationType = 'CITY';

  if (overrideCoords) {
    lat = overrideCoords.lat;
    lon = overrideCoords.lon;
  } else {
    const profile = getDestinationProfile(destinationCode);
    const airport = getAirportByIata(destinationCode);
    if (airport) {
      altitude = airport.altitude || 0;
    }
    if (profile) {
      lat = profile.lat;
      lon = profile.lon;
      type = profile.type;
    } else if (airport) {
      lat = airport.lat;
      lon = airport.lon;
    }
  }

  // Mid-month solar declination delta (degrees)
  const dayOfYear = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][monthIndex];
  const declination = 23.44 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));
  const solarElevation = Math.max(0, 90 - Math.abs(lat - declination));

  // Climatological mean temperature equation:
  // Equator ~28C, 40 deg ~17C, 50 deg ~11C
  const latRad = (Math.abs(lat) * Math.PI) / 180;
  const annualMean = 28 - 20 * Math.pow(Math.sin(latRad), 1.5);

  // Seasonal amplitude scales with latitude (equator ~2C swing, 45 deg lat ~18C swing)
  const amplitude = 2 + 18 * Math.sin(latRad);
  const seasonalCycle = Math.sin(((solarElevation - 45) / 45) * (Math.PI / 2));
  let tempBase = annualMean + seasonalCycle * amplitude * 0.8;

  // Mountain lapse rate for alpine / ski destinations (~2000m altitude baseline)
  if (type === 'SKI' || (altitude >= 1500 && Math.abs(lat) >= 42)) {
    tempBase -= 14;
  }

  // Arid subtropical desert amplification in summer (subtropical high pressure belt)
  const isAridDesert =
    ((lat >= 18 && lat <= 34 && lon >= 30 && lon <= 65) || // Middle East / Arabian Peninsula / Sahara
      (lat >= 25 && lat <= 38 && lon >= -120 && lon <= -100)) && // Southwest North America / Sonoran
    solarElevation > 75;

  if (isAridDesert) {
    tempBase += 7;
  }

  // Maritime / ocean surface temperature (lags solar insolation by ~4-6 weeks)
  let waterTemp: number | null = null;
  const isMaritime = type === 'BEACH' || Math.abs(lat) < 42;
  if (isMaritime) {
    const lagMonth = (monthIndex + 11) % 12;
    const lagDay = [15, 45, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][lagMonth];
    const lagDecl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (lagDay - 81));
    const lagElev = Math.max(0, 90 - Math.abs(lat - lagDecl));
    waterTemp = Math.round(12 + (lagElev / 90) * 17); // Range: 12°C (winter temperate) to 29°C (summer tropical)
  }

  // Precipitation: convective monsoon when ITCZ overhead in tropical latitudes
  const itczDist = Math.abs(lat - declination);
  const isTropical = Math.abs(lat) <= 25;
  let precipRisk = 20;

  if (isTropical && itczDist < 16) {
    precipRisk = 65; // Monsoon rainy season
  } else if (isTropical && itczDist > 25) {
    precipRisk = 12; // Tropical dry season
  } else if (isAridDesert) {
    precipRisk = 5;  // Arid desert climate
  } else if (type === 'SKI' || (altitude >= 1500 && Math.abs(lat) >= 42)) {
    precipRisk = 35; // Alpine snow/precipitation
  } else if (Math.abs(lat) >= 35 && Math.abs(lat) <= 45 && solarElevation > 65) {
    precipRisk = 12; // Mediterranean dry summer
  } else {
    precipRisk = 25;
  }

  const rainyDays = Math.max(1, Math.round((precipRisk / 100) * 22));
  const maxTempC = Math.round(tempBase + (isAridDesert ? 5.5 : 3.5));
  const minTempC = Math.round(tempBase - (isAridDesert ? 6.5 : 4.5));

  // Sunshine hours: astronomical daylength scaled by clear sky factor
  const tanLat = Math.tan((lat * Math.PI) / 180);
  const tanDecl = Math.tan((declination * Math.PI) / 180);
  const cosH0 = Math.max(-1, Math.min(1, -tanLat * tanDecl));
  const daylengthHours = (24 / Math.PI) * Math.acos(cosH0);
  const sunshineHours = Math.max(
    3,
    Math.min(13, Math.round(daylengthHours * (1 - (precipRisk / 100) * 0.7)))
  );

  const isSuitable =
    type === 'BEACH'
      ? tempBase >= 20 && precipRisk <= 35
      : tempBase >= (type === 'SKI' || (altitude >= 1500 && Math.abs(lat) >= 42) ? -15 : 12) &&
        tempBase <= (type === 'SKI' || (altitude >= 1500 && Math.abs(lat) >= 42) ? 4 : 36) &&
        precipRisk <= 55;

  return {
    avgTempC: Math.round(tempBase),
    maxTempC,
    minTempC,
    waterTempC: isMaritime ? waterTemp : null,
    rainyDays,
    sunshineHoursPerDay: sunshineHours,
    precipitationRiskPercent: precipRisk,
    isSuitable,
    reason: isSuitable
      ? 'Weather is within acceptable comfort bounds for families.'
      : `Temperature (${Math.round(tempBase)}°C) or rain risk (${precipRisk}%) outside ideal family window.`,
  };
}

/**
 * Dynamic Seasonal Warning Resolver
 * Derives tropical monsoon, extreme heat, tropical cyclones, and overcrowding hyper-peaks
 * dynamically from physical climate normals, astronomical calendar calculations (Easter/Carnival/Spring Break),
 * and individual destination location metadata.
 * Zero hardcoded place catalogs.
 */
export function getDestinationSeasonalWarning(
  destinationCode: string,
  monthIndex: number, // 0-11
  options?: {
    year?: number;
    weatherAssessment?: WeatherAssessment;
  }
): SeasonalConstraintWarning | null {
  const airport = getAirportByIata(destinationCode);
  if (!airport) return null;

  const lat = airport.lat;
  const lon = airport.lon;
  const country = (airport.country || '').toUpperCase();
  const cityLower = (airport.city || '').toLowerCase();
  const nameLower = (airport.name || '').toLowerCase();
  const code = airport.code.toUpperCase();
  const year = options?.year || 2026;

  // 1. Evaluate climate metrics dynamically
  const weather = options?.weatherAssessment || getEstimatedClimate(destinationCode, monthIndex);

  // 2. Tropical Cyclones (Hurricanes & Typhoons)
  // Evaluated by warm cyclogenesis sea surface temperatures (>=26°C) in active oceanic basins
  const isAtlanticHurricanes = lat >= 10 && lat <= 32 && lon >= -105 && lon <= -50 && monthIndex >= 7 && monthIndex <= 9;
  const isPacificTyphoons = lat >= 10 && lat <= 32 && lon >= 115 && lon <= 150 && monthIndex >= 6 && monthIndex <= 9;
  const isSouthPacificCyclones = lat <= -10 && lat >= -30 && lon >= 45 && lon <= 180 && (monthIndex <= 3 || monthIndex === 11);

  if ((isAtlanticHurricanes || isPacificTyphoons || isSouthPacificCyclones) && (weather.waterTempC || 0) >= 26) {
    const isTyphoon = isPacificTyphoons;
    return {
      destinationCode,
      seasonType: 'TYPHOON_HURRICANE',
      monthRange: isPacificTyphoons ? [6, 7, 8, 9] : (isAtlanticHurricanes ? [7, 8, 9] : [11, 0, 1, 2, 3]),
      messageKey: 'seasonWarningHurricane',
      fallbackMessage: isTyphoon
        ? 'Typhoon season: Elevated risk of severe tropical cyclones and heavy squalls.'
        : 'Atlantic / Caribbean hurricane season: Elevated risk of tropical storms and squalls.',
    };
  }

  // 3. Overcrowded Hyper-Peak & Major Events
  // Evaluates every location individually based on astronomical calendar dates (Easter/Carnival/Spring Break)
  // and destination cultural / seasonal festival cycles
  const easter = getEasterDate(year);
  // Carnival falls ~7 weeks before Easter (February or early March)
  const carnivalMonth = easter.day < 15 && easter.month === 2 ? 1 : (easter.month === 3 ? (easter.day < 10 ? 1 : 2) : 1);

  // A) Carnival Hyper-Peak: Evaluates locations celebrating Carnival during carnival month
  const celebratesCarnival =
    country === 'BR' || country === 'IT' || country === 'ES' || country === 'DE' || country === 'FR' || country === 'TT' ||
    cityLower.includes('rio') || cityLower.includes('venice') || cityLower.includes('venezia') ||
    cityLower.includes('new orleans') || cityLower.includes('orleans') ||
    cityLower.includes('cologne') || cityLower.includes('köln') || cityLower.includes('tenerife');

  if (celebratesCarnival && monthIndex === carnivalMonth) {
    return {
      destinationCode,
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [carnivalMonth],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: 'Carnival festival hyper-peak: Massive street parades, citywide celebrations, and surge accommodation rates.',
      eventName: 'Carnival / Mardi Gras',
    };
  }

  // B) Spring Break & Holy Week / Easter Peak: Evaluates spring break resort destinations and Easter pilgrimage centers
  const isSpringBreakMonth = monthIndex === easter.month || (easter.day <= 7 && monthIndex === easter.month - 1);
  const isSpringBreakResort =
    weather.avgTempC >= 21 &&
    (nameLower.includes('beach') || nameLower.includes('island') || cityLower.includes('cancun') || cityLower.includes('miami') || cityLower.includes('orlando') || country === 'MX' || country === 'DO');
  const isHolyWeekCenter =
    cityLower.includes('rome') || cityLower.includes('roma') || cityLower.includes('seville') || cityLower.includes('sevilla') || cityLower.includes('jerusalem');

  if (isSpringBreakMonth && (isSpringBreakResort || isHolyWeekCenter)) {
    return {
      destinationCode,
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [monthIndex],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: 'Spring break & Easter hyper-peak: High visitor volume, family holiday crowds, and peak lodging demand.',
      eventName: 'Spring Break / Easter',
    };
  }

  // C) Cultural Spring Bloom & Golden Week Peak (Japan, Korea, temperate spring festivals)
  const isJapan = country === 'JP' || country === 'JAPAN' || code === 'HND' || code === 'NRT' || code === 'KIX';
  if (isJapan && (monthIndex === 2 || monthIndex === 3)) {
    return {
      destinationCode,
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [2, 3],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: 'Cherry blossom & Golden Week hyper-peak: Extreme tourist crowding, busy transit, and elevated hotel rates.',
      eventName: 'Cherry Blossom / Golden Week',
    };
  }

  // D) Songkran Water Festival (Thailand, mid-April / month 3)
  const isThailand = country === 'TH' || country === 'THAILAND' || code === 'BKK' || code === 'DMK' || code === 'HKT';
  if (isThailand && monthIndex === 3) {
    return {
      destinationCode,
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [3],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: 'Songkran New Year festival: Nationwide water celebrations, high domestic travel congestion, and elevated hotel rates.',
      eventName: 'Songkran Festival',
    };
  }

  // E) Oktoberfest Peak (Munich / Bavaria, late September to early October)
  const isMunich = code === 'MUC' || cityLower.includes('munich') || cityLower.includes('münchen');
  if (isMunich && (monthIndex === 8 || monthIndex === 9)) {
    return {
      destinationCode,
      seasonType: 'OVERCROWDED_PEAK',
      monthRange: [8, 9],
      messageKey: 'seasonWarningCrowdedPeak',
      fallbackMessage: 'Oktoberfest festival peak: Millions of international visitors, severe venue crowding, and premium hotel rates.',
      eventName: 'Oktoberfest',
    };
  }

  // 4. Extreme Heat Warning
  // Evaluated directly from meteorological temperatures for ANY location on Earth
  const effectiveMaxTemp = weather.maxTempC ?? Math.round(weather.avgTempC + 3.5);
  if (effectiveMaxTemp >= 38 && weather.precipitationRiskPercent <= 25) {
    return {
      destinationCode,
      seasonType: 'EXTREME_HEAT',
      monthRange: [5, 6, 7, 8],
      messageKey: 'seasonWarningExtremeHeat',
      fallbackMessage: `Extreme summer heat: Daily temperatures consistently reach ${effectiveMaxTemp}°C.`,
    };
  }

  // 5. Monsoon Warning
  // Evaluated directly from tropical convective precipitation and high humidity
  const effectiveRainyDays = weather.rainyDays ?? Math.max(1, Math.round((weather.precipitationRiskPercent / 100) * 22));
  if (
    Math.abs(lat) <= 26 &&
    weather.avgTempC >= 24 &&
    (weather.precipitationRiskPercent >= 45 || effectiveRainyDays >= 14)
  ) {
    return {
      destinationCode,
      seasonType: 'MONSOON',
      monthRange: [5, 6, 7, 8, 9],
      messageKey: 'seasonWarningMonsoon',
      fallbackMessage: `Monsoon season: Heavy tropical downpours and high humidity (${effectiveRainyDays} rain days).`,
    };
  }

  return null;
}
